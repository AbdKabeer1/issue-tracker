"use client";

import { useState, useTransition } from "react";
import {
  setEmailNotificationsAction,
  setNotificationKindAction,
} from "@/app/actions/settings";
import {
  NOTIFICATION_KINDS,
  PREF_FIELD,
  notificationDescriptions,
  notificationLabels,
  type NotificationKind,
  type PrefField,
} from "@/lib/notification-prefs";

export type NotificationPrefs = Record<PrefField, boolean>;

export function NotificationSettings({
  initialEnabled,
  initialPrefs,
}: {
  initialEnabled: boolean;
  initialPrefs: NotificationPrefs;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleKind(kind: NotificationKind, next: boolean) {
    const field = PREF_FIELD[kind];
    setPrefs((current) => ({ ...current, [field]: next }));
    setMessage(null);
    startTransition(async () => {
      const result = await setNotificationKindAction(kind, next);
      if (result.error) {
        setPrefs((current) => ({ ...current, [field]: !next }));
        setMessage(result.error);
      } else {
        setMessage(
          `${notificationLabels[kind]} ${next ? "turned on" : "turned off"}.`,
        );
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <label
        htmlFor="email-notifications"
        className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800"
      >
        <input
          id="email-notifications"
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.checked;
            setEnabled(next);
            setMessage(null);
            startTransition(async () => {
              const result = await setEmailNotificationsAction(next);
              if (result.error) {
                setEnabled(!next);
                setMessage(result.error);
              } else {
                setMessage(
                  next
                    ? "Email notifications are on."
                    : "Email notifications are off.",
                );
              }
            });
          }}
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        Email me about activity on my issues
      </label>

      {/*
        The per-kind choices stay in the DOM while the master switch is off,
        disabled rather than removed, so turning it back on shows what is
        still selected instead of looking like a fresh opt-in to everything.
      */}
      <fieldset
        disabled={!enabled || pending}
        className="space-y-3 border-l-2 border-slate-100 pl-4 disabled:opacity-50"
      >
        <legend className="sr-only">Which emails to send</legend>
        {NOTIFICATION_KINDS.map((kind) => {
          const id = `notify-${kind}`;
          return (
            <div key={kind} className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                checked={prefs[PREF_FIELD[kind]]}
                onChange={(event) => toggleKind(kind, event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor={id} className="cursor-pointer text-sm">
                <span className="font-medium text-slate-800">
                  {notificationLabels[kind]}
                </span>
                <span className="block text-slate-600">
                  {notificationDescriptions[kind]}
                </span>
              </label>
            </div>
          );
        })}
      </fieldset>

      <p className="text-sm text-slate-600 empty:hidden" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
