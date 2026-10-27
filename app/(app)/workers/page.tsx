import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { loadSignalWorkforce } from "@/lib/signal-board";
import { WorkforceRoster } from "@/components/workforce-roster";

export const metadata = { title: "Workforce" };

export default async function WorkersPage() {
  const user = await requireUser();

  let tenantId: string | null = null;
  try {
    tenantId = await currentTenantIdFor(user.id);
  } catch (error) {
    console.error("[workforce] tenant resolution failed", error);
  }

  const workers = tenantId
    ? await loadSignalWorkforce(tenantId).catch((error) => {
        console.error("[workforce] roster failed", error);
        return [];
      })
    : [];

  return <WorkforceRoster workers={workers} />;
}
