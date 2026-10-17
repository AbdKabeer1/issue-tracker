import { requireSuperAdmin } from "@/lib/auth-helpers";

/** As for the admin layout: super-admin only, decided before streaming. */
export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return children;
}
