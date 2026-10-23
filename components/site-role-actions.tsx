"use client";

import type { Role } from "@prisma/client";
import { useState, useTransition } from "react";
import { setSiteRoleAction } from "@/app/actions/admin-roles";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { roleViewLabels } from "@/lib/header-nav";

const OPTIONS: Role[] = ["user", "admin", "super_admin"];

/** Super admin changes another person's site-wide role. */
export function SiteRoleActions({
  userId,
  userName,
  siteRole,
  disabled = false,
}: {
  userId: string;
  userName: string;
  siteRole: Role;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState(siteRole);
  const [pending, startTransition] = useTransition();

  function changeRole(next: Role) {
    if (next === current || disabled) return;
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const result = await setSiteRoleAction(userId, next);
      if (result.ok) {
        toast(
          `${userName} is now a ${next === "user" ? "member" : roleViewLabels[next].toLowerCase()}.`,
          "success",
        );
      } else {
        setCurrent(previous);
        toast(result.error, "error");
      }
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      Site role
      <Select
        aria-label={`Site role for ${userName}`}
        value={current}
        disabled={pending || disabled}
        onChange={(event) => changeRole(event.target.value as Role)}
        className="w-auto py-1"
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === "user" ? "Member" : roleViewLabels[option]}
          </option>
        ))}
      </Select>
    </label>
  );
}
