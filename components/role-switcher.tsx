"use client";

import { useId, useTransition } from "react";
import { switchActiveRoleAction } from "@/app/actions/auth";
import { roleViewLabels } from "@/lib/header-nav";
import type { AppRole } from "@/lib/roles";

type RoleSwitcherProps = {
  activeRole: AppRole;
  isSuperAdmin?: boolean;
};

/**
 * "View as" control for admins: lets them see the app as a lower role.
 * Rendered as a radio group so every option is visible at once.
 */
export function RoleSwitcher({
  activeRole,
  isSuperAdmin = false,
}: RoleSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const name = useId();
  const options: AppRole[] = isSuperAdmin
    ? ["super_admin", "admin", "user"]
    : ["admin", "user"];

  const choose = (next: AppRole) => {
    if (next === activeRole) return;
    startTransition(async () => {
      await switchActiveRoleAction(next);
      window.location.reload();
    });
  };

  return (
    <fieldset disabled={pending} className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-slate-500">
        View as
      </legend>
      <div className="space-y-0.5">
        {options.map((option) => {
          const checked = option === activeRole;
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600 ${
                checked
                  ? "bg-teal-50 font-medium text-teal-900"
                  : "text-slate-700 hover:bg-slate-50"
              } ${pending ? "opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => choose(option)}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              {roleViewLabels[option]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
