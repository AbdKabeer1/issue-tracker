import { requireSuperAdmin } from "@/lib/auth-helpers";

export default async function AdminRewardsLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return children;
}
