import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor, defaultProjectIdFor } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Redesign proposals" };
export default async function RedesignsPage() {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  const projectId = tenantId ? await defaultProjectIdFor(prisma, tenantId) : null;
  const proposals = tenantId && projectId ? await prisma.redesignProposal.findMany({
    where: { tenantId, projectId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    select: { id: true, title: true, status: true },
  }) : [];
  return <section className="space-y-5">
    <h1 className="text-2xl font-semibold">Redesign proposals</h1>
    <p>Proposals need a person&apos;s approval before linked work can be claimed.</p>
    {proposals.length ? <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
      {proposals.map((proposal) => <li key={proposal.id} className="p-4">
        <Link className="font-medium text-indigo-700 underline" href={`/redesigns/${proposal.id}`}>{proposal.title}</Link>
        <p className="text-sm text-slate-600">{proposal.status === "proposed" ? "waiting for a person" : proposal.status}</p>
      </li>)}
    </ul> : <p>No redesign proposals in this project yet.</p>}
    <Link className="text-indigo-700 underline" href="/issues">Browse issues</Link>
  </section>;
}
