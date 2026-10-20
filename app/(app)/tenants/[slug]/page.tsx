import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { MemberRoleActions } from "@/components/member-role-actions";
import { requireUser } from "@/lib/auth-helpers";
import { isSuperAdmin } from "@/lib/roles";
import { INVITE_TTL_DAYS, canInvite, pendingInvites } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { ZEDU_SLUG } from "@/lib/tenant";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { MEMBERSHIP_ROLE_LABELS, memberTenantBySlug, tenantMembersFrom } from "@/lib/tenants";
import { revokeInviteAction, revokeShareLinkAction, selectTenantAction } from "../actions";
import { CopyLinkButton } from "@/components/copy-link-button";
import { joinedSummary, listShareLinks, shareLinkStatusLabel } from "@/lib/share-invites";
import { InviteForm } from "./invite-form";
import { ShareLinkForm } from "./share-link-form";
import { pendingTenantJoinRequests, TENANT_DESCRIPTION_MAX } from "@/lib/tenant-join-requests";
import { reviewTenantJoinRequestAction, updateTenantDiscoveryAction } from "../actions";

/* Static on purpose: a title built from the slug could name someone else's tenant. */
export const metadata = { title: "Tenant" };

const card = "rounded-xl border border-slate-200 bg-white p-4 sm:p-6";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Memberships and users are loaded apart so a missing user does not fail the page. */
async function loadTenantMembers(tenantId: string) {
  try {
    const rows = await prisma.membership.findMany({
      where: { tenantId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: 200,
      select: { role: true, createdAt: true, userId: true },
    });
    if (rows.length === 0) return [];
    const people = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.userId) } },
      select: { id: true, name: true, email: true, image: true, role: true },
    });
    return tenantMembersFrom(rows, people);
  } catch (error) {
    console.error("[tenant] member list failed", error);
    return [];
  }
}

/**
 * One of the person's tenants (#444): who can invite, and for its owners and
 * admins, sending and withdrawing invites.
 */
export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const tenant = await memberTenantBySlug(prisma, user.id, slug);
  // Someone else's tenant looks exactly like no tenant: its name is never read.
  if (!tenant) notFound();

  const canManage = canInvite(tenant.role);
  const canChangeRoles = tenant.role === "owner" || isSuperAdmin(user.role);
  const [currentTenantId, counts, managers, invites, members, shareLinks, joinRequests] = await Promise.all([
    currentTenantIdFor(user.id),
    prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        description: true,
        discoverable: true,
        _count: { select: { memberships: true, projects: true } },
      },
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, role: { in: ["owner", "admin"] } },
      select: { role: true, user: { select: { id: true, name: true } } },
      // Owners first: the enum is declared owner, admin, member.
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: 20,
    }),
    canManage ? pendingInvites(prisma, tenant.id) : [],
    loadTenantMembers(tenant.id),
    canManage ? listShareLinks(prisma, tenant.id) : [],
    canManage ? pendingTenantJoinRequests(prisma, tenant.id) : [],
  ]);
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const current = tenant.id === currentTenantId;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href="/tenants" className="text-sm text-teal-700 hover:underline">
          ← All tenants
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 truncate text-2xl font-semibold text-slate-900">{tenant.name}</h1>
          {current ? (
            <Badge className="bg-teal-50 text-teal-800 ring-1 ring-teal-200">Current</Badge>
          ) : null}
        </div>
        <p className="text-sm text-slate-600">
          You&apos;re {tenant.role === "member" ? "a" : "an"} {MEMBERSHIP_ROLE_LABELS[tenant.role].toLowerCase()}
          {counts
            ? ` · ${plural(counts._count.memberships, "member")} · ${plural(counts._count.projects, "project")}`
            : null}
        </p>
        {current ? null : (
          <form action={selectTenantAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <Button type="submit">Open {tenant.name}</Button>
          </form>
        )}
      </div>

      <section aria-labelledby="tenant-managers" className={card}>
        <h2 id="tenant-managers" className="text-base font-semibold text-slate-900">
          Owners and admins
        </h2>
        {managers.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">
            {tenant.slug === ZEDU_SLUG
              ? "Ziki has no owner yet, so nobody can invite people. The site's super admin can choose one from its members."
              : "Nobody here can invite people yet."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {managers.map((manager) => (
              <li key={manager.user.id} className="flex items-center gap-2 text-sm text-slate-800">
                <span className="truncate">{manager.user.name}</span>
                <Badge className="bg-slate-100 text-slate-700">{MEMBERSHIP_ROLE_LABELS[manager.role]}</Badge>
              </li>
            ))}
          </ul>
        )}
        {canManage ? null : (
          <p className="mt-3 text-xs text-slate-500">
            Only owners and admins can invite people. Ask one of them to invite your teammate.
          </p>
        )}
      </section>

      <section aria-labelledby="tenant-members" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2
          id="tenant-members"
          className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 sm:px-6"
        >
          Members
        </h2>
        <p className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:px-6">
          Roles here apply only in {tenant.name}. Someone who is an admin somewhere else is a member here until an owner promotes them.
        </p>
        <ul className="divide-y divide-slate-200">
          {members.map((member) => (
            <li key={member.user.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <Avatar name={member.user.name} image={member.user.image} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{member.user.name}</p>
                <p className="truncate text-xs text-slate-500">{member.user.email}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Joined <LocalTime date={member.createdAt} />
                </p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">{MEMBERSHIP_ROLE_LABELS[member.role]}</Badge>
              <MemberRoleActions
                tenantId={tenant.id}
                tenantName={tenant.name}
                userId={member.user.id}
                userName={member.user.name ?? member.user.email ?? "Member"}
                membershipRole={member.role}
                siteSuperAdmin={member.user.role === "super_admin"}
                canChangeRoles={canChangeRoles}
                canRemove={canManage || isSuperAdmin(user.role)}
                isSelf={member.user.id === user.id}
                ownerCount={ownerCount}
              />
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <>
          <section aria-labelledby="workspace-discovery" className={card}>
            <h2 id="workspace-discovery" className="text-base font-semibold text-slate-900">Workspace discovery</h2>
            <p className="mt-1 text-sm text-slate-600">When enabled, people without a workspace can find this one and request access. They become members only after an owner or admin approves.</p>
            <form action={updateTenantDiscoveryAction} className="mt-4 space-y-4">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <label className="flex items-start gap-3 text-sm text-slate-800">
                <input type="checkbox" name="discoverable" defaultChecked={counts?.discoverable ?? false} className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                <span><span className="font-medium">Accept join requests</span><span className="mt-0.5 block text-xs text-slate-500">Show this workspace in discovery to users who do not belong to a workspace.</span></span>
              </label>
              <label className="block text-sm font-medium text-slate-800" htmlFor="workspace-description">Description <span className="font-normal text-slate-500">(optional, up to {TENANT_DESCRIPTION_MAX} characters)</span></label>
              <textarea id="workspace-description" name="description" maxLength={TENANT_DESCRIPTION_MAX} rows={3} defaultValue={counts?.description ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600" />
              <Button type="submit">Save discovery settings</Button>
            </form>
          </section>

          <section aria-labelledby="join-requests" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 id="join-requests" className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 sm:px-6">Workspace join requests</h2>
            {joinRequests.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-600 sm:px-6">No pending requests.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {joinRequests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{request.user.name ?? request.user.email}</p>
                      <p className="truncate text-xs text-slate-500">{request.user.email} · requested <LocalTime date={request.requestedAt} /></p>
                    </div>
                    <form action={reviewTenantJoinRequestAction} className="flex gap-2">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Button name="status" value="approved" type="submit">Approve</Button>
                      <Button name="status" value="rejected" type="submit" variant="danger-secondary">Reject</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="share-link" className={card}>
            <h2 id="share-link" className="text-base font-semibold text-slate-900">
              Invite link
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Share one link instead of typing each email. Anyone who opens it and signs in with Google
              joins as a member — a new Google account is created if they don&apos;t have one, and this
              organization is added to it. Pick how long the link lasts and how many people can use it.
              Once that limit is reached, or you revoke the link, it stops working.
            </p>
            <ShareLinkForm tenantId={tenant.id} />
            <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {shareLinks.length === 0 ? (
                <li className="pt-4 text-sm text-slate-600">No invite links yet.</li>
              ) : (
                shareLinks.map((link) => {
                  const who = joinedSummary(link.joinedNames, link.useCount);
                  const statusClass =
                    link.state === "open"
                      ? "bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                      : link.state === "revoked"
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-700";
                  return (
                    <li key={link.id} className="flex flex-wrap items-start gap-3 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                          <span className="truncate">{link.label || "Invite link"}</span>
                          <Badge className={statusClass}>{shareLinkStatusLabel(link.state)}</Badge>
                        </p>
                        <p className="text-xs text-slate-500">
                          {link.useCount} joined{link.maxUses != null ? ` of ${link.maxUses}` : ""}
                          {who ? ` · ${who}` : ""}
                          {" · "}
                          {link.state === "expired" ? "expired" : "expires"} <LocalTime date={link.expiresAt} />
                          {" · "}
                          {link.invitedByName}
                        </p>
                        {link.url ? (
                          <p className="truncate font-mono text-xs text-slate-600">{link.url}</p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            This link can&apos;t be shown. Revoke it and create another.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {link.url ? <CopyLinkButton url={link.url} label="invite" /> : null}
                        {link.state === "open" ? (
                          <form action={revokeShareLinkAction}>
                            <input type="hidden" name="linkId" value={link.id} />
                            <Button type="submit" variant="danger-secondary" aria-label={`Revoke invite link${link.label ? ` ${link.label}` : ""}`}>
                              Revoke
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section aria-labelledby="invite-someone" className={card}>
            <h2 id="invite-someone" className="text-base font-semibold text-slate-900">
              Invite by email
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              For one person. The link works once, only for the address you enter, and expires after{" "}
              {INVITE_TTL_DAYS} days. To invite several people at once, create an invite link above.
            </p>
            <InviteForm tenantId={tenant.id} />
          </section>

          <section aria-labelledby="pending-invites" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2
              id="pending-invites"
              className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 sm:px-6"
            >
              Pending email invites
            </h2>
            {invites.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-600 sm:px-6">No invites waiting to be accepted.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{invite.email}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Invited by {invite.invitedByName} · expires <LocalTime date={invite.expiresAt} />
                      </p>
                    </div>
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <Button type="submit" variant="danger-secondary" aria-label={`Revoke the invite for ${invite.email}`}>
                        Revoke
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
