import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { BrandLockup } from "@/components/brand-lockup";
import { UserNameWithBadges } from "@/components/user-name-with-badges";
import { Button } from "@/components/ui/button";
import { isAdmin, isSuperAdmin, type AppRole } from "@/lib/roles";
import { RoleSwitcher } from "@/components/role-switcher";

export function AppHeader({
  userName,
  role,
  isRealSuperAdmin,
}: {
  userName?: string | null;
  role?: AppRole | null;
  isRealSuperAdmin?: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <BrandLockup href="/bugs" size="sm" />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/bugs" className="text-slate-600 hover:text-slate-900">
              All bugs
            </Link>
            <Link
              href="/bugs/new"
              className="rounded-md bg-teal-50 px-2 py-1 font-medium text-teal-800 hover:bg-teal-100"
            >
              New bug
            </Link>
            {isAdmin(role) ? (
              <Link
                href="/admin/categories"
                className="text-slate-600 hover:text-slate-900"
              >
                Categories
              </Link>
            ) : null}
            {isSuperAdmin(role) ? (
              <Link
                href="/admin/users"
                className="text-slate-600 hover:text-slate-900"
              >
                Admins
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isRealSuperAdmin && role ? <RoleSwitcher activeRole={role} /> : null}
          {userName ? (
            <UserNameWithBadges
              name={userName}
              role={role}
              className="hidden max-w-[14rem] text-sm text-slate-500 sm:inline-flex"
            />
          ) : null}
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
