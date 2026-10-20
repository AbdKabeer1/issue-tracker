import { randomUUID } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin";

export type GoogleAccount = {
  id: string;
  name: string;
  role: Role;
  sessionVersion: number;
};

/**
 * Persist a Google sign-in. The full upsert is tried first. If a column the
 * current schema expects is missing in production, fall back to email and
 * name, then to a direct insert. A Google subject must never be used as User.id.
 */
export async function upsertGoogleUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  /** Google's own claim about this address (`profile.email_verified`). */
  emailVerified?: boolean;
}): Promise<GoogleAccount> {
  const email = input.email.toLowerCase();
  const name = input.name?.trim() || email.split("@")[0] || "User";
  const image = input.image || undefined;
  const role: Role = isSuperAdminEmail(email) ? "super_admin" : "user";

  // A password preregistered at an address is unproven: when Google claims
  // the address, the unknown credential must not survive as a second login
  // method (#736).
  let neutralizePassword = false;
  let existing: { passwordHash: string | null; emailVerified: Date | null } | null | undefined;
  try {
    existing = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true, emailVerified: true },
    });
  } catch (error) {
    console.error("[auth] Google account pre-read failed:", error);
    throw error;
  }
  if (existing?.passwordHash) {
    if (input.emailVerified === false) {
      throw new Error(
        "Google sign-in email is unverified; refusing to link it to a password account",
      );
    }
    // Verified credentials kept their password (the owner proved the
    // address some other way or still signs in with it).
    neutralizePassword = !existing.emailVerified;
  }

  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        ...(image ? { image } : {}),
        emailVerified: new Date(),
        ...(role === "super_admin" ? { role } : {}),
      },
      // `name` is only used when the account is created. Updating it here
      // would undo a display name the person chose in Settings (#293) at
      // their next sign-in.
      update: {
        ...(image ? { image } : {}),
        emailVerified: new Date(),
        ...(role === "super_admin" ? { role } : {}),
        ...(neutralizePassword ? { passwordHash: null } : {}),
      },
      select: { id: true, name: true, role: true, sessionVersion: true },
    });
    return { id: user.id, name: user.name, role: user.role, sessionVersion: user.sessionVersion };
  } catch (error) {
    console.error("[auth] Google user upsert failed:", error);
  }

  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name },
      update: {
        ...(neutralizePassword ? { passwordHash: null } : {}),
      },
      select: { id: true, name: true, sessionVersion: true },
    });
    return { id: user.id, name: user.name, role, sessionVersion: user.sessionVersion ?? 0 };
  } catch (error) {
    console.error("[auth] Minimal Google user upsert failed:", error);
  }

  const id = randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "name", "email", "createdAt")
      VALUES (${id}, ${name}, ${email}, CURRENT_TIMESTAMP)
      ON CONFLICT ("email") DO NOTHING
    `;
  } catch (error) {
    console.error("[auth] Google user insert without password failed:", error);
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "name", "email", "passwordHash", "createdAt")
      VALUES (${id}, ${name}, ${email}, '', CURRENT_TIMESTAMP)
      ON CONFLICT ("email") DO NOTHING
    `;
  }

  const saved = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, sessionVersion: true },
  });
  if (!saved) {
    throw new Error("Google sign-in could not save the user");
  }
  return { id: saved.id, name: saved.name, role, sessionVersion: saved.sessionVersion ?? 0 };
}
