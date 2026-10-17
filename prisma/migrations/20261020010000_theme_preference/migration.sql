-- Dark mode (#277): each user's appearance choice, following them across
-- devices. "system" keeps today's behaviour of following the device.
CREATE TYPE "ThemePreference" AS ENUM ('system', 'light', 'dark');

ALTER TABLE "User" ADD COLUMN "theme" "ThemePreference" NOT NULL DEFAULT 'system';
