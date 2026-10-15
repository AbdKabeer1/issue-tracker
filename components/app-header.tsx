import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { isSuperAdmin, type AppRole } from "@/lib/roles";

export function AppHeader({
  userName,
  role,
}: {
  userName?: string | null;
  role?: AppRole | null;
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
          <span className="hidden max-w-[10rem] truncate text-sm text-slate-500 sm:inline">
            {userName}
          </span>
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
