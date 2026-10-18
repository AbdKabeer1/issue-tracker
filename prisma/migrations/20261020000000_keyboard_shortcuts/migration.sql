-- Keyboard shortcuts (#287): on by default, switchable in Settings.
ALTER TABLE "User" ADD COLUMN "keyboardShortcuts" BOOLEAN NOT NULL DEFAULT true;
