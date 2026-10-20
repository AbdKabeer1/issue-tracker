import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { tenantForOwner } from "@/lib/agents/membership";
import { projectsForTenant } from "@/lib/project-context";
import { PairForm } from "./pair-form";

export const metadata = { title: "Pair an agent" };

/** Where an agent sends its owner to approve a pairing (#427). */
export default async function PairAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const user = await requireUser();
  const tenant = await tenantForOwner(user.id);
  const projects = tenant ? await projectsForTenant(prisma, tenant.tenantId) : [];
  const { code } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/settings/agents" className="text-sm text-teal-700 hover:underline">
          ← Back to agents
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Pair an agent</h1>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <p className="text-sm text-slate-600">
          Your agent asked to pair and showed you a code. Enter it here to approve the agent. Codes
          last 15 minutes and work once.
        </p>
        <PairForm initialCode={typeof code === "string" ? code.slice(0, 20) : ""} projects={projects} />
      </section>
    </div>
  );
}
