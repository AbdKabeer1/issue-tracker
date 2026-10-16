"use server";

import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { ACTIVE_ROLE_COOKIE_NAME } from "@/lib/roles";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { sendMail } from "@/lib/mail";
import {
  PASSWORD_RESET_TTL_MS,
  buildPasswordResetUrl,
  createRawResetToken,
  hashResetToken,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import {
  isPasswordAuthEnabled,
  PASSWORD_AUTH_DISABLED_MESSAGE,
} from "@/lib/auth-mode";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/bug";

const FORGOT_PASSWORD_SUCCESS =
  "If an account exists for that email, we've sent a password reset link.";

/** Raised inside the reset transaction when the token was already consumed. */
class PasswordResetTokenAlreadyUsedError extends Error {
  constructor() {
    super("Password reset token already used");
    this.name = "PasswordResetTokenAlreadyUsedError";
  }
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  // Server actions stay callable even when no UI renders them.
  if (!isPasswordAuthEnabled()) {
    return { error: PASSWORD_AUTH_DISABLED_MESSAGE };
  }

  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    console.error("[loginAction] signIn error:", error);
    return { error: "Invalid email or password" };
  }

  redirect(callbackUrl);
}

export async function signupAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  // Server actions stay callable even when no UI renders them.
  if (!isPasswordAuthEnabled()) {
    return { error: PASSWORD_AUTH_DISABLED_MESSAGE };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hash(password, 10);
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  try {
    await prisma.user.create({
      data: { name, email, passwordHash },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "An account with this email already exists" };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Account created, but sign-in failed. Try logging in.",
      };
    }
    console.error("[signupAction] signIn error after user creation:", error);
    return {
      error: "Account created! Please sign in with your email and password.",
    };
  }


  redirect(callbackUrl);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ROLE_COOKIE_NAME);
  await signOut({ redirectTo: "/login" });
}

export async function switchActiveRoleAction(
  newRole: "super_admin" | "admin" | "user",
) {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const isSuper = isSuperAdminEmail(session.user.email);
  let isRealAdmin = isSuper;
  let isRealSuper = isSuper;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (user?.role === "super_admin" || isSuper) {
    isRealSuper = true;
    isRealAdmin = true;
  } else if (user?.role === "admin") {
    isRealAdmin = true;
  }

  if (!isRealAdmin) {
    return { error: "Unauthorized: only admins and super admins can switch roles" };
  }

  if (!isRealSuper && newRole === "super_admin") {
    return { error: "Only super admins can switch to super admin" };
  }

  const cookieStore = await cookies();
  const baseRole = isRealSuper ? "super_admin" : "admin";
  if (newRole === baseRole) {
    cookieStore.delete(ACTIVE_ROLE_COOKIE_NAME);
  } else {
    const cookieValue = user?.id ? `${newRole}:${user.id}` : newRole;
    cookieStore.set(ACTIVE_ROLE_COOKIE_NAME, cookieValue, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  revalidatePath("/");
  return { ok: true, activeRole: newRole };
}

export async function googleSignInAction(
  callbackUrlOrFormData?: string | FormData,
) {
  let target = "/bugs";
  if (typeof callbackUrlOrFormData === "string") {
    target = callbackUrlOrFormData;
  } else if (
    callbackUrlOrFormData &&
    typeof callbackUrlOrFormData === "object" &&
    "get" in callbackUrlOrFormData
  ) {
    const raw = callbackUrlOrFormData.get("callbackUrl");
    if (typeof raw === "string") target = raw;
  }
  const safeTarget = safeCallbackUrl(target);
  await signIn("google", { redirectTo: safeTarget });
}



export async function forgotPasswordAction(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData,
) {
  // Server actions stay callable even when no UI renders them.
  if (!isPasswordAuthEnabled()) {
    return { error: PASSWORD_AUTH_DISABLED_MESSAGE };
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const email = parsed.data.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Only credentials accounts (passwordHash set) can reset via email.
    // Always return the same success copy to avoid account enumeration.
    if (user?.passwordHash) {
      const rawToken = createRawResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        prisma.passwordResetToken.create({
          data: { tokenHash, userId: user.id, expiresAt },
        }),
      ]);

      const resetUrl = buildPasswordResetUrl(rawToken);
      await sendMail({
        to: email,
        subject: "Reset your Zedu Issues password",
        text: [
          "You requested a password reset for your Zedu Issues account.",
          "",
          `Open this link within 30 minutes to set a new password:`,
          resetUrl,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
      });
    }
  } catch (error) {
    console.error("[forgot-password]", error);
    // Still return the generic message — do not leak failure mode.
  }

  return { success: FORGOT_PASSWORD_SUCCESS };
}

export async function resetPasswordAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  // Server actions stay callable even when no UI renders them.
  if (!isPasswordAuthEnabled()) {
    return { error: PASSWORD_AUTH_DISABLED_MESSAGE };
  }

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await hash(password, 10);

  // #209: the previous code read the token, checked `usedAt` in application
  // code, and only marked it used later - so two concurrent requests with the
  // same valid token both passed the check and both wrote, defeating the
  // documented single-use guarantee. Claim the token with a conditional update
  // inside the transaction and abort unless exactly one row was claimed.
  const outcome = await prisma
    .$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new PasswordResetTokenAlreadyUsedError();
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: record.userId,
          id: { not: record.id },
        },
      });
    })
    .catch((error) => {
      if (error instanceof PasswordResetTokenAlreadyUsedError) {
        return {
          error: "This reset link is invalid or has expired. Request a new one.",
        };
      }
      throw error;
    });

  if (outcome) return outcome;

  redirect("/login");
}
