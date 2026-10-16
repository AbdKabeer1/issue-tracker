"use client";

import { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        {/* Left: Brand + Desktop Nav */}
        <div className="flex items-center gap-6">
          <BrandLockup href="/bugs" size="sm" />
          <nav className="hidden items-center gap-3 text-sm sm:flex">
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
              <>
                <Link
                  href="/admin/categories"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Categories
                </Link>
                <Link
                  href="/admin/types"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Types
                </Link>
              </>
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

        {/* Right: Desktop Controls */}
        <div className="hidden items-center gap-3 sm:flex">
          {isRealSuperAdmin && role ? <RoleSwitcher activeRole={role} /> : null}
          {userName ? (
            <UserNameWithBadges
              name={userName}
              role={role}
              className="max-w-[14rem] text-sm text-slate-500"
            />
          ) : null}
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>

        {/* Right: Mobile Controls (Quick New Bug + Menu Toggle) */}
        <div className="flex items-center gap-2 sm:hidden">
          <Link
            href="/bugs/new"
            className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            + Issue
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {mobileMenuOpen ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
          {userName && (
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Signed in as</span>
              <UserNameWithBadges
                name={userName}
                role={role}
                className="text-xs"
              />
            </div>
          )}

          {isRealSuperAdmin && role && (
            <div className="mb-3 border-b border-slate-100 pb-2">
              <RoleSwitcher activeRole={role} />
            </div>
          )}

          <nav className="flex flex-col space-y-1">
            <Link
              href="/bugs"
              onClick={closeMenu}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              All bugs
            </Link>
            <Link
              href="/bugs/new"
              onClick={closeMenu}
              className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
            >
              New bug
            </Link>
            {isAdmin(role) ? (
              <>
                <Link
                  href="/admin/categories"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Categories
                </Link>
                <Link
                  href="/admin/types"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Types
                </Link>
              </>
            ) : null}
            {isSuperAdmin(role) ? (
              <Link
                href="/admin/users"
                onClick={closeMenu}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Admin management
              </Link>
            ) : null}
          </nav>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <form action={logoutAction} className="w-full">
              <Button type="submit" variant="secondary" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
