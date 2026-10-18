import { requireAdmin } from "@/lib/auth-helpers";

/**
 * Admin pages have loading skeletons (#291), which make them stream, and a
 * redirect thrown from a page after its shell has been sent becomes a 200
 * with a client-side redirect instead of a 307. Guarding in the layout runs
 * before the loading boundary, so a non-admin still gets the real redirect.
 * Each page keeps its own guard as well.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
