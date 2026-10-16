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
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/bug";

const FORGOT_PASSWORD_SUCCESS =
  "If an account exists for that email, we've sent a password reset link.";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
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
  await signOut({ redirectTo: "/login" });
}

export async function switchActiveRoleAction(
  newRole: "super_admin" | "admin" | "user",
) {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  // Only verified super admins can switch viewing roles
  const isSuper = isSuperAdminEmail(session.user.email);
  if (!isSuper) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (user?.role !== "super_admin") {
      return { error: "Only super admins can switch roles" };
    }
  }

  const cookieStore = await cookies();
  if (newRole === "super_admin") {
    cookieStore.delete(ACTIVE_ROLE_COOKIE_NAME);
  } else {
    cookieStore.set(ACTIVE_ROLE_COOKIE_NAME, newRole, {
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
        subject: "Reset your Zedu Bugs password",
        text: [
          "You requested a password reset for your Zedu Bugs account.",
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

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
      },
    }),
  ]);

  redirect("/login");
}
