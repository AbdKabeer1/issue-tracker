import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { viewInvite } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/roles";
import { currentTenantIdFor } from "@/lib/tenant-context";
import {
  MEMBERSHIP_ROLE_LABELS,
  TENANT_NAME_MAX,
  tenantsForUser,
  zeduNeedsOwner,
} from "@/lib/tenants";
import { selectTenantAction } from "./actions";
import { CreateTenantForm } from "./create-tenant-form";
import { InviteCard } from "./invite-card";
import { InviteLinkForm } from "./invite-link-form";
import { ZeduOwnerForm } from "./zedu-owner-form";

/* Distinct browser-tab title; the root layout appends "· Ziki Issues". */
export const metadata = { title: "Tenants" };

const card = "rounded-xl border border-slate-200 bg-white p-4 sm:p-6";

/**
 * Where a person picks the tenant to work in, creates one, or accepts an
 * invite (#444). It lists only the tenants they belong to.
 */
export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const user = await requireUser();
  // In-app invite notifications (#443) link here with the invite's id.
  const { invite: inviteParam } = await searchParams;
  const inviteId = typeof inviteParam === "string" ? inviteParam : "";

  const [tenants, currentTenantId, invite, zeduOwnerNeeded] = await Promise.all([
    tenantsForUser(prisma, user.id),
    currentTenantIdFor(user.id),
    inviteId ? viewInvite(prisma, { inviteId }, user) : null,
    isSuperAdmin(user.role) ? zeduNeedsOwner(prisma) : false,
  ]);
  const hasTenants = tenants.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {hasTenants ? "Choose a tenant" : "Join or create a tenant"}
        </h1>
        <p className="text-sm text-slate-600">
          {hasTenants
            ? "A tenant is one organisation's workspace: its projects, issues and people. Pick the one to work in."
            : "You're not in a tenant yet. Accept an invite from someone in one, or create a tenant of your own."}
        </p>
      </div>

      {inviteId ? (
        <InviteCard invite={invite} accept={{ inviteId }} accountEmail={user.email} />
      ) : null}

      {hasTenants ? (
        <section aria-labelledby="your-tenants" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2
            id="your-tenants"
            className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 sm:px-6"
          >
            Your tenants
          </h2>
          <ul className="divide-y divide-slate-200">
            {tenants.map((tenant) => {
              const current = tenant.id === currentTenantId;
              return (
                <li key={tenant.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{tenant.name}</span>
                      {current ? (
                        <Badge className="bg-teal-50 text-teal-800 ring-1 ring-teal-200">Current</Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {MEMBERSHIP_ROLE_LABELS[tenant.role]} ·{" "}
                      <Link href={`/tenants/${tenant.slug}`} className="text-teal-700 hover:underline">
                        People and invites
                      </Link>
                    </p>
                  </div>
                  <form action={selectTenantAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <Button type="submit" variant={current ? "secondary" : "primary"}>
                      Open {tenant.name}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="join-with-invite" className={card}>
        <h2 id="join-with-invite" className="text-base font-semibold text-slate-900">
          Join with an invite
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Tenants are invite-only. Open the link an owner or admin sent you, or paste it here.
        </p>
        <InviteLinkForm />
      </section>

      <section aria-labelledby="create-tenant" className={card}>
        <h2 id="create-tenant" className="text-base font-semibold text-slate-900">
          Create a tenant
        </h2>
        <CreateTenantForm nameMax={TENANT_NAME_MAX} />
      </section>

      {zeduOwnerNeeded ? (
        <section aria-labelledby="zedu-owner" className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
          <h2 id="zedu-owner" className="text-base font-semibold text-amber-900">
            Ziki has no owner yet
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Everyone moved into Ziki is a member, so nobody can invite people. As the site&apos;s
            super admin, choose its first owner from its existing members.
          </p>
          <ZeduOwnerForm />
        </section>
      ) : null}
    </div>
  );
}
