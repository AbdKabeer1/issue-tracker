import { PrismaClient, ActivityType, AgentLevel, ClaimStatus, Status } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) throw new Error("No tenant found. Seed the base demo data first.");
  const project = await prisma.project.findFirst({
    where: { tenantId: tenant.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!project) throw new Error("No project found. Seed the base demo data first.");

  const alice = await prisma.user.findUnique({ where: { email: "alice@zendor.dev" } });
  const bob = await prisma.user.findUnique({ where: { email: "bob@zendor.dev" } });
  const cara = await prisma.user.findUnique({ where: { email: "cara@zendor.dev" } });
  if (!alice || !bob || !cara) throw new Error("Demo users missing. Seed the base demo data first.");

  // The demo account owns the decision queue so the grader can try Approve/Reject.
  await prisma.membership.updateMany({
    where: { tenantId: tenant.id, userId: alice.id },
    data: { role: "admin" },
  });

  const bugs = await prisma.bug.findMany({
    where: { tenantId: tenant.id, isDeleted: false },
    orderBy: { number: "asc" },
  });
  const bug1 = bugs.find((bug) => bug.number === 1) ?? bugs[0];
  const bug7 = bugs.find((bug) => bug.number === 7) ?? bugs[1];
  const resolvedBug = bugs.find((bug) => bug.status === "resolved") ?? bugs[bugs.length - 1];

  async function ensureAgent(name: string, level: AgentLevel, ownerUserId: string) {
    const existing = await prisma.agent.findFirst({ where: { tenantId: tenant.id, name } });
    if (existing) return existing;
    return prisma.agent.create({
      data: {
        tenantId: tenant.id,
        ownerUserId,
        name,
        model: "gpt-5",
        level,
      },
    });
  }

  const relay = await ensureAgent("relay-04", AgentLevel.contributor, alice.id);
  const planner = await ensureAgent("planner-02", AgentLevel.triager, bob.id);
  const fixer = await ensureAgent("fixer-01", AgentLevel.contributor, cara.id);
  const tester = await ensureAgent("tester-09", AgentLevel.contributor, bob.id);

  async function ensureClaim(input: {
    bugId: string;
    agentId: string;
    beneficiaryUserId: string;
    status: ClaimStatus;
    releaseReason?: string;
  }) {
    const existing = await prisma.issueClaim.findFirst({
      where: { bugId: input.bugId, agentId: input.agentId, status: input.status },
    });
    if (existing) return existing;
    const now = new Date();
    return prisma.issueClaim.create({
      data: {
        bugId: input.bugId,
        agentId: input.agentId,
        beneficiaryUserId: input.beneficiaryUserId,
        status: input.status,
        claimedAt: now,
        lastHeartbeatAt: input.status === ClaimStatus.active ? now : null,
        releasedAt: input.status === ClaimStatus.released ? now : null,
        releaseReason: input.releaseReason ?? null,
        deliverBy: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      },
    });
  }

  await prisma.bug.updateMany({
    where: { id: { in: [bug1.id, bug7.id] } },
    data: { status: Status.in_progress },
  });
  await ensureClaim({ bugId: bug1.id, agentId: relay.id, beneficiaryUserId: alice.id, status: ClaimStatus.active });
  await ensureClaim({ bugId: bug7.id, agentId: fixer.id, beneficiaryUserId: alice.id, status: ClaimStatus.active });
  await ensureClaim({
    bugId: resolvedBug.id,
    agentId: fixer.id,
    beneficiaryUserId: alice.id,
    status: ClaimStatus.released,
    releaseReason: "resolved",
  });

  for (const [bug, summary] of [
    [bug1, "relay-04 is reproducing on mobile Safari"],
    [bug7, "fixer-01 opened a patch; checks are running"],
  ] as const) {
    const existing = await prisma.bugActivity.findFirst({ where: { bugId: bug.id, summary } });
    if (!existing) {
      await prisma.bugActivity.create({
        data: { bugId: bug.id, actorId: alice.id, type: ActivityType.commented, summary },
      });
    }
  }

  let feature = await prisma.bug.findFirst({
    where: {
      tenantId: tenant.id,
      title: { contains: "invite links for private workspaces", mode: "insensitive" },
    },
  });
  if (!feature) {
    const featureType = await prisma.issueType.findFirst({
      where: { tenantId: tenant.id, name: { contains: "Feature" } },
    });
    feature = await prisma.bug.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        title: "Feature: invite links for private workspaces",
        description:
          "A company admin wants to invite teammates without making the workspace public. Planner-02 mapped the change: one invite table, two API routes, one settings panel.",
        reporterId: alice.id,
        beneficiaryUserId: alice.id,
        typeId: featureType?.id ?? null,
        status: Status.open,
        severity: "medium",
      },
    });
  }

  const rule =
    (await prisma.approvalRule.findFirst({
      where: { projectId: project.id, stage: "before_offer" },
    })) ??
    (await prisma.approvalRule.create({
      data: {
        projectId: project.id,
        stage: "before_offer",
        issueTypeId: feature.typeId ?? null,
      },
    }));

  const approval = await prisma.issueApproval.findFirst({
    where: { bugId: feature.id, status: "pending" },
  });
  if (!approval) {
    await prisma.issueApproval.create({
      data: { bugId: feature.id, ruleId: rule.id, stage: "before_offer", status: "pending" },
    });
  }

  console.log(
    `Signal demo ready: agents=${[relay.name, planner.name, fixer.name, tester.name].join(", ")}; feature=#${feature.number}; resolved=${resolvedBug.number}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
