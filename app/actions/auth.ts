"use server";

import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { signupSchema } from "@/lib/validations/bug";

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
    throw error;
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
    throw error;
  }

  redirect(callbackUrl);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/bugs" });
}
