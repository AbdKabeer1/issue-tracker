import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { isSuperAdmin } from "@/lib/roles";

export default async function AdminIndexPage() {
  const user = await requireAdmin();
  if (isSuperAdmin(user.role)) {
    redirect("/admin/users");
  } else {
    redirect("/admin/types");
  }
}
