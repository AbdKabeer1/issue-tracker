"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  leaveTenantAction,
  removeMemberAction,
  setMemberRoleAction,
} from "@/app/actions/membership";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { OrganizationRole } from "@/lib/organization-role";

/**
 * Promote, demote, remove, or leave inside one organization.
 * A site super admin's site role is not edited here.
 */
export function MemberRoleActions({
  tenantId,
  tenantName,
  userId,
  userName,
  membershipRole,
  siteSuperAdmin = false,
  canChangeRoles,
  canRemove,
  isSelf,
  ownerCount,
}: {
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  membershipRole: OrganizationRole;
  siteSuperAdmin?: boolean;
  canChangeRoles: boolean;
  canRemove: boolean;
  isSelf: boolean;
  ownerCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  function run(
    task: () => Promise<{ error?: string; ok?: boolean }>,
    success: string,
    href?: string,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (result?.error) {
          setError(result.error);
          toast(result.error, "error");
        } else {
          toast(success);
          if (href) router.push(href);
        }
      } catch {
        const message = "Couldn't update that membership. Try again.";
        setError(message);
        toast(message, "error");
      }
    });
  }

  const lastOwner = membershipRole === "owner" && ownerCount <= 1;
  const buttons: { key: string; node: ReactNode }[] = [];

  if (canChangeRoles && !siteSuperAdmin && membershipRole === "member") {
    buttons.push({
      key: "promote",
      node: (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            const confirmed = await confirm({
              title: `Make ${userName} an admin of ${tenantName}?`,
              body: `They will be able to triage and delete issues in ${tenantName}. This does not make them an admin of any other organization.`,
              confirmLabel: "Promote to admin",
            });
            if (!confirmed) return;
            run(
              () => setMemberRoleAction(tenantId, userId, "admin"),
              `${userName} is now an admin of ${tenantName}.`,
            );
          }}
        >
          {pending ? "Promoting…" : "Promote to admin"}
        </Button>
      ),
    });
  }

  if (canChangeRoles && !siteSuperAdmin && membershipRole === "admin") {
    buttons.push({
      key: "demote",
      node: (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            const confirmed = await confirm({
              title: `Remove admin from ${userName}?`,
              body: `They stay in ${tenantName} as a member. They will no longer be able to triage its issues.`,
              confirmLabel: "Remove admin",
              tone: "danger",
            });
            if (!confirmed) return;
            run(
              () => setMemberRoleAction(tenantId, userId, "member"),
              `${userName} is a member of ${tenantName}.`,
            );
          }}
        >
          {pending ? "Removing…" : "Remove admin"}
        </Button>
      ),
    });
  }

  if (canChangeRoles && !siteSuperAdmin && membershipRole === "owner" && !lastOwner) {
    buttons.push({
      key: "demote-owner",
      node: (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            const confirmed = await confirm({
              title: `Make ${userName} an admin instead of an owner?`,
              body: `${tenantName} still has another owner.`,
              confirmLabel: "Demote to admin",
              tone: "danger",
            });
            if (!confirmed) return;
            run(
              () => setMemberRoleAction(tenantId, userId, "admin"),
              `${userName} is an admin of ${tenantName}.`,
            );
          }}
        >
          {pending ? "Updating…" : "Demote to admin"}
        </Button>
      ),
    });
  }

  if (canRemove && !isSelf && !lastOwner && (canChangeRoles || membershipRole === "member")) {
    buttons.push({
      key: "remove",
      node: (
        <Button
          type="button"
          variant="danger-secondary"
          disabled={pending}
          onClick={async () => {
            const confirmed = await confirm({
              title: `Remove ${userName} from ${tenantName}?`,
              body: "They keep their account. They lose access to this organization's issues until someone invites them again.",
              confirmLabel: "Remove",
              tone: "danger",
            });
            if (!confirmed) return;
            run(
              () => removeMemberAction(tenantId, userId),
              `${userName} was removed from ${tenantName}.`,
            );
          }}
        >
          Remove
        </Button>
      ),
    });
  }

  if (isSelf && !lastOwner) {
    buttons.push({
      key: "leave",
      node: (
        <Button
          type="button"
          variant="danger-secondary"
          disabled={pending}
          onClick={async () => {
            const confirmed = await confirm({
              title: `Leave ${tenantName}?`,
              body: "You will lose access to its issues until someone invites you back.",
              confirmLabel: "Leave",
              tone: "danger",
            });
            if (!confirmed) return;
            run(() => leaveTenantAction(tenantId), `You left ${tenantName}.`, "/tenants");
          }}
        >
          Leave
        </Button>
      ),
    });
  }

  if (buttons.length === 0) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {buttons.map((button) => (
          <span key={button.key}>{button.node}</span>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
