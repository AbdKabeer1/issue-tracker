"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, isTheme } from "@/lib/theme";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PREF_FIELD, isNotificationKind } from "@/lib/notification-prefs";
import { displayNameSchemaFor } from "@/lib/display-name";
import { isAdmin } from "@/lib/roles";
import { fromZodError, type FieldErrorResult } from "@/lib/form-errors";

export type SettingsResult = { error?: string; ok?: boolean; emailNotifications?: boolean };

export type DisplayNameResult = Partial<FieldErrorResult> & { ok?: boolean; name?: string };

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
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
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
