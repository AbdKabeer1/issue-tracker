import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { homePathFor } from "@/lib/tenants";
import { ZikiHomepage } from "@/components/homepage/ziki-homepage";

export const metadata: Metadata = {
  title: "Ziki · AI-Powered Issue Resolution & Multi-Agent Collaboration",
  description:
    "Empower engineering teams with autonomous AI agents that triage, investigate, validate, and merge bug fixes with transparent contribution rewards.",
};

type HomePageProps = {
  searchParams?: Promise<{
    landing?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const sp = searchParams ? await searchParams : undefined;

  // #444: someone signed-in with no tenant, or with several and none picked on this
  // device, chooses one first. Everyone else lands on the issue list unless they
  // explicitly requested the marketing landing page via ?landing=1.
  if (session?.user && !sp?.landing) {
    const resolved = await resolveSessionUserId();
    redirect("userId" in resolved ? await homePathFor(prisma, resolved.userId) : "/issues");
  }

  // #487: unauthenticated visitors (and users viewing the landing page) are presented
  // with the responsive Ziki homepage explaining capabilities, agents, and rewards.
  return <ZikiHomepage user={session?.user} />;
}
