import { PrismaClient, Severity, Status } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.bug.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("12345678", 10);

  const alice = await prisma.user.create({
    data: {
      name: "Alice Mentor",
      email: "alice@zendor.dev",
      passwordHash,
    },
  });
  const bob = await prisma.user.create({
    data: {
      name: "Bob Builder",
      email: "bob@zendor.dev",
      passwordHash,
    },
  });
  const cara = await prisma.user.create({
    data: {
      name: "Cara QA",
      email: "cara@zendor.dev",
      passwordHash,
    },
  });

  const samples: Array<{
    title: string;
    description: string;
    severity: Severity;
    status: Status;
    reporterId: string;
    assigneeId?: string;
    proofLinks?: string[];
  }> = [
    {
      title: "Login button unresponsive on mobile Safari",
      description:
        "Tapping Sign in on iPhone 14 (iOS 18) does nothing. Console shows no network request. Repro: clear site data, open /login, enter credentials, tap button. Proof: first link is the frozen button; second is a screen recording of the tap.",
      severity: "high",
      status: "open",
      reporterId: cara.id,
      assigneeId: bob.id,
      proofLinks: [
        "https://example.com/proof/login-button-frozen.png",
        "https://example.com/proof/login-tap-recording.mp4",
      ],
    },
    {
      title: "Bug list filter resets after navigation",
      description:
        "Selecting status=in_progress then opening a bug and going back loses the filter. Expected: preserve query params.",
      severity: "medium",
      status: "in_progress",
      reporterId: alice.id,
      assigneeId: alice.id,
    },
    {
      title: "Critical: seed script wipes production",
      description:
        "Running pnpm db:seed against a non-local DATABASE_URL deletes all rows. Add an environment guard before deleteMany. Screenshot shows wipe on staging.",
      severity: "critical",
      status: "open",
      reporterId: bob.id,
      proofLinks: ["https://example.com/proof/seed-wipe-staging.png"],
    },
    {
      title: "Comment timestamps show UTC only",
      description:
        "Detail page renders createdAt without local timezone. Prefer relative time or locale formatting.",
      severity: "low",
      status: "resolved",
      reporterId: cara.id,
      assigneeId: alice.id,
    },
    {
      title: "Assignee dropdown missing empty option",
      description:
        "Cannot unassign a bug once assigned. Need an Unassigned option that sets assigneeId null.",
      severity: "medium",
      status: "open",
      reporterId: bob.id,
      assigneeId: cara.id,
    },
    {
      title: "Empty state copy too vague",
      description:
        "When filters match nothing, show Clear filters CTA instead of a blank panel.",
      severity: "low",
      status: "closed",
      reporterId: alice.id,
      assigneeId: bob.id,
    },
    {
      title: "Severity badge contrast fails WCAG AA",
      description:
        "Yellow medium badge on white background is ~2.8:1. Darken text or badge background. Link shows contrast check.",
      severity: "medium",
      status: "in_progress",
      reporterId: cara.id,
      assigneeId: bob.id,
      proofLinks: ["https://example.com/proof/contrast-audit.png"],
    },
    {
      title: "Create bug allows blank description via spaces",
      description:
        "Trimming is missing on the server for description-only-whitespace. Zod trim should reject it.",
      severity: "high",
      status: "open",
      reporterId: alice.id,
    },
  ];

  const bugs = [];
  for (const sample of samples) {
    const bug = await prisma.bug.create({ data: sample });
    await prisma.comment.create({
      data: {
        bugId: bug.id,
        authorId: sample.reporterId,
        body: "Initial report filed during Zedu Bugs mini-project kickoff.",
      },
    });
    bugs.push(bug);
  }

  // Seed votes so list sorting by popularity is visible out of the box.
  const votePairs: Array<{ userId: string; bugId: string }> = [
    { userId: alice.id, bugId: bugs[0].id },
    { userId: bob.id, bugId: bugs[0].id },
    { userId: cara.id, bugId: bugs[0].id },
    { userId: alice.id, bugId: bugs[2].id },
    { userId: bob.id, bugId: bugs[2].id },
    { userId: cara.id, bugId: bugs[6].id },
    { userId: alice.id, bugId: bugs[7].id },
  ];

  for (const vote of votePairs) {
    await prisma.vote.create({ data: vote });
    await prisma.bug.update({
      where: { id: vote.bugId },
      data: { voteCount: { increment: 1 } },
    });
  }

  console.log("Seeded 3 users, 8 bugs, and sample votes.");
  console.log("Demo login: alice@zendor.dev / 12345678");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
