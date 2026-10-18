"use client";

import { useState, useTransition } from "react";
import { setThemeAction } from "@/app/actions/settings";
import { THEMES, themeAttribute, themeDescriptions, themeLabels, type Theme } from "@/lib/theme";

/** Shows a choice on this page at once, before the server has saved it. */
function showTheme(theme: Theme) {
  const root = document.documentElement;
  const attr = themeAttribute(theme);
  if (attr) root.setAttribute("data-theme", attr);
  else root.removeAttribute("data-theme");
}

/** Settings → Appearance (#277): System / Light / Dark. */
export function ThemeSettings({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (next: Theme) => {
    const previous = theme;
    setTheme(next);
    setMessage(null);
    // Straight away on this page; the server renders it from now on.
    showTheme(next);
    startTransition(async () => {
      const result = await setThemeAction(next);
      if (result.error) {
        setTheme(previous);
        showTheme(previous);
        setMessage(result.error);
      } else {
        setMessage(`Appearance set to ${themeLabels[next].toLowerCase()}.`);
      }
    });
  };

  return (
    <fieldset className="mt-4" disabled={pending}>
      <legend className="sr-only">Appearance</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {THEMES.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition ${
              theme === option
                ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => apply(option)}
              className="mt-0.5 h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              <span className="block font-medium text-slate-900">{themeLabels[option]}</span>
              <span className="block text-xs text-slate-600">{themeDescriptions[option]}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Saved to your account, so it follows you to every device.</p>
      <p role="status" aria-live="polite" className="mt-1 text-sm text-emerald-700 empty:hidden">
        {message ?? ""}
      </p>
    </fieldset>
  );
}
