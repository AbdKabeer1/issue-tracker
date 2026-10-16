import Link from "next/link";
import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/roles";
import { buildUserSearchWhere } from "@/lib/user-search";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { PromoteUserButton } from "@/components/promote-user-button";
import { DemoteUserButton } from "@/components/demote-user-button";
import { UserSearch } from "@/components/user-search";

const roleBadgeClass: Record<string, string> = {
  user: "bg-slate-100 text-slate-700",
  admin: "bg-teal-100 text-teal-800",
  super_admin: "bg-amber-100 text-amber-900",
};

const roleOrder = { super_admin: 0, admin: 1, user: 2 } as const;

type SearchParams = Promise<{
  q?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireSuperAdmin();

  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() ?? "";
  const where = buildUserSearchWhere(query);

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  users.sort(
    (a, b) =>
      roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Admin management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Super admins can promote users to admin and remove admin again.
            Role changes apply immediately in this list.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Suspense
            fallback={
              <div className="h-9 w-full sm:w-64 animate-pulse rounded-lg bg-slate-100" />
            }
          >
            <UserSearch />
          </Suspense>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {users.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">User</th>
                <th className="whitespace-nowrap px-4 py-3">Role</th>
                <th className="whitespace-nowrap px-4 py-3">Joined</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{user.name}</div>
                    <div className="text-xs sm:text-sm text-slate-500 break-all">{user.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge className={roleBadgeClass[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    <LocalTime date={user.createdAt} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {user.role === "user" ? (
                      <PromoteUserButton
                        userId={user.id}
                        userName={user.name}
                      />
                    ) : user.role === "admin" ? (
                      <DemoteUserButton
                        userId={user.id}
                        userName={user.name}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : query ? (
          <div className="px-4 py-12 text-center">
            <p className="font-medium text-slate-800">
              No users matching &ldquo;{query}&rdquo;
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Check the spelling or try searching by email address instead.
            </p>
            <Link
              href="/admin/users"
              className="mt-3 inline-flex text-sm font-medium text-teal-700 hover:underline"
            >
              Clear search
            </Link>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No users found.
          </p>
        )}
      </div>
    </div>
  );
}
