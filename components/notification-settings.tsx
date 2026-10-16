"use client";

import { useState, useTransition } from "react";
import { setEmailNotificationsAction } from "@/app/actions/settings";

export function NotificationSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 space-y-2">
      <label htmlFor="email-notifications" className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
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
                setMessage(next ? "Email notifications are on." : "Email notifications are off.");
              }
            });
          }}
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        Email me about activity on my issues
      </label>
      {message ? (
        <p className="text-sm text-slate-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
