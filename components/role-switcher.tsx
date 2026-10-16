"use client";

import { useTransition } from "react";
import { switchActiveRoleAction } from "@/app/actions/auth";
import type { AppRole } from "@/lib/roles";

type RoleSwitcherProps = {
  activeRole: AppRole;
};

export function RoleSwitcher({ activeRole }: RoleSwitcherProps) {
  const [pending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as "super_admin" | "admin" | "user";
    startTransition(async () => {
      await switchActiveRoleAction(next);
      window.location.reload();
    });
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <label
        htmlFor="role-switcher-select"
        className="hidden font-medium text-slate-500 md:inline"
      >
        View as:
      </label>
      <div className="relative inline-flex items-center">
        <select
          id="role-switcher-select"
          disabled={pending}
          value={activeRole}
          onChange={handleChange}
          aria-label="Switch active role view"
          className={`cursor-pointer appearance-none rounded-lg border py-1 pl-2 pr-6 text-xs font-semibold shadow-xs transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:opacity-50 ${
            activeRole === "super_admin"
              ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : activeRole === "admin"
                ? "border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100"
                : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
          }`}
        >
          <option value="super_admin">👑 Super Admin</option>
          <option value="admin">🛡️ Team Lead (Admin)</option>
          <option value="user">👤 Normal User</option>
        </select>
        <span className="pointer-events-none absolute right-2 text-[10px] text-slate-500">
          ▾
        </span>
      </div>
    </div>
  );
}
