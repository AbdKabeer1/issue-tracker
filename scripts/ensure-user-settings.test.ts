import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const userSettingsSql = readFileSync("scripts/sql/ensure-user-settings.sql", "utf8");
const migrate = readFileSync("scripts/migrate.mjs", "utf8");

describe("User settings startup repair", () => {
  it("adds the user settings columns and theme enum without dropping anything", () => {
    expect(userSettingsSql).toContain('ADD COLUMN IF NOT EXISTS "emailNotifications"');
    expect(userSettingsSql).toContain('ADD COLUMN IF NOT EXISTS "notifyMentions"');
    expect(userSettingsSql).toContain('ADD COLUMN IF NOT EXISTS "notifyAssignments"');
    expect(userSettingsSql).toContain('ADD COLUMN IF NOT EXISTS "notifyStatusChanges"');
    expect(userSettingsSql).toContain('ADD COLUMN IF NOT EXISTS "keyboardShortcuts"');
    expect(userSettingsSql).toContain('CREATE TYPE "ThemePreference" AS ENUM');
    expect(userSettingsSql).toContain('ADD COLUMN IF NOT EXISTS "theme" "ThemePreference"');
    expect(userSettingsSql.toLowerCase()).not.toMatch(/\bdrop\b/);
  });

  it("runs the repair and records the user settings migrations", () => {
    expect(migrate).toContain("scripts/sql/ensure-user-settings.sql");
    expect(migrate).toContain("20261017100000_user_email_notifications");
    expect(migrate).toContain("20261017150000_notification_preferences");
    expect(migrate).toContain("20261020000000_keyboard_shortcuts");
    expect(migrate).toContain("20261020010000_theme_preference");
  });
});
