"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, isTheme } from "@/lib/theme";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PREF_FIELD, isNotificationKind } from "@/lib/notification-prefs";
import { displayNameSchemaFor } from "@/lib/display-name";
import { walletAddressSchema } from "@/lib/validations/issue";
import { isAdmin } from "@/lib/roles";
import { fromZodError, fieldError, type FieldErrorResult } from "@/lib/form-errors";
import { appCookieOptions } from "@/lib/cookie-options";

export type SettingsResult = { error?: string; ok?: boolean; emailNotifications?: boolean };

export type DisplayNameResult = Partial<FieldErrorResult> & { ok?: boolean; name?: string };

export type WalletResult = Partial<FieldErrorResult> & { ok?: boolean; walletAddress?: string | null };

/** Turn the signed-in user's email notifications on or off (#151). */
export async function setEmailNotificationsAction(enabled: unknown): Promise<SettingsResult> {
  if (typeof enabled !== "boolean") return { error: "Invalid setting" };
  const user = await requireUser();
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailNotifications: enabled },
    });
  } catch (err) {
    console.error("[settings] setEmailNotificationsAction failed:", err);
    return { error: "Could not update email notifications setting" };
  }
  revalidatePath("/settings");
  return { ok: true, emailNotifications: enabled };
}

/** Turn the site-wide keyboard shortcuts on or off (#287). */
export async function setKeyboardShortcutsAction(enabled: unknown): Promise<SettingsResult> {
  if (typeof enabled !== "boolean") return { error: "Invalid setting" };
  const user = await requireUser();
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { keyboardShortcuts: enabled },
    });
  } catch (err) {
    console.error("[settings] setKeyboardShortcutsAction failed:", err);
    return { error: "Could not update keyboard shortcuts setting" };
  }
  // The layout reads the setting, so every page needs the new value.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Light, dark or follow the device (#277). Saved on the user so it follows
 * them, and in a cookie so this device's signed-out pages match.
 */
export async function setThemeAction(theme: unknown): Promise<SettingsResult> {
  if (!isTheme(theme)) return { error: "Invalid setting" };
  const user = await requireUser();
  try {
    await prisma.user.update({ where: { id: user.id }, data: { theme } });
  } catch (err) {
    console.error("[settings] setThemeAction user update failed:", err);
  }
  (await cookies()).set(THEME_COOKIE, theme, appCookieOptions(THEME_COOKIE_MAX_AGE));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Turn one kind of email on or off. The master switch above is unchanged, so
 * someone can keep mentions while dropping status changes.
 */
export async function setNotificationKindAction(
  kind: unknown,
  enabled: unknown,
): Promise<SettingsResult> {
  if (!isNotificationKind(kind)) return { error: "Invalid setting" };
  if (typeof enabled !== "boolean") return { error: "Invalid setting" };
  const user = await requireUser();
  try {
    await prisma.user.update({
      where: { id: user.id },
      // PREF_FIELD is a fixed lookup over a validated kind, so the column name
      // can never come from the request.
      data: { [PREF_FIELD[kind]]: enabled },
    });
  } catch (err) {
    console.error("[settings] setNotificationKindAction failed:", err);
    return { error: "Could not update notification preference" };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Change the signed-in user's display name (#293).
 *
 * Only `name` is written, never email (the sign-in identity) or role. Names
 * are read from the User row wherever they're shown — issues, comments, the
 * admin table — so this updates old comments too, with nothing to backfill.
 */
export async function updateDisplayNameAction(
  _prev: DisplayNameResult | undefined,
  formData: FormData,
): Promise<DisplayNameResult> {
  const user = await requireUser();
  const parsed = displayNameSchemaFor(isAdmin(user.role)).safeParse(formData.get("name") ?? "");
  if (!parsed.success) {
    // Zod's issue has no path for a bare string schema, so name the field.
    const first = fromZodError(parsed.error, "Enter a valid name.");
    return { error: first.error, field: "name", fieldErrors: { name: first.error } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data } });
  // The name is in the header on every page, and on every issue and comment.
  revalidatePath("/", "layout");
  return { ok: true, name: parsed.data };
}

/**
 * Save or clear the signed-in person's EVM wallet address (#618).
 *
 * Only the caller's own row is ever written: the id comes from the session,
 * never from the form, so no submitted field can set a wallet for anyone else.
 * The address is readable only by them and by admins of a workspace they share
 * (`canViewWallet`), so nothing else in the app displays it.
 */
export async function setWalletAddressAction(
  _prev: WalletResult | undefined,
  formData: FormData,
): Promise<WalletResult> {
  const user = await requireUser();
  const parsed = walletAddressSchema.safeParse(formData.get("walletAddress") ?? "");
  if (!parsed.success) {
    // A bare string schema has no issue path, so the field is named here.
    return fieldError("walletAddress", parsed.error.issues[0]?.message ?? "Enter a valid EVM address.");
  }
  await prisma.user.update({ where: { id: user.id }, data: { walletAddress: parsed.data } });
  revalidatePath("/settings");
  revalidatePath(`/users/${user.id}`);
  return { ok: true, walletAddress: parsed.data };
}
