import { PrismaClient, Severity, Status } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MIN_SUPER_ADMIN_PASSWORD_LENGTH = 12;

/**
 * Idempotent super-admin provisioning from env.
 * - Creates the account when missing
 * - Leaves an existing super_admin unchanged unless SUPER_ADMIN_FORCE_UPDATE=true
 * - With force update, promotes/rotates credentials for the configured email
 */
async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const forceUpdate = process.env.SUPER_ADMIN_FORCE_UPDATE === "true";
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    console.log(
      "Skipping super admin seed (set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD).",
    );
    return;
  }

  if (password.length < MIN_SUPER_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `SUPER_ADMIN_PASSWORD must be at least ${MIN_SUPER_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === "super_admin" && !forceUpdate) {
      console.log(`Super admin already exists (${email}); leaving unchanged.`);
      return;
    }

    if (!forceUpdate) {
      console.log(
        `User ${email} exists with role=${existing.role}; left unchanged. Set SUPER_ADMIN_FORCE_UPDATE=true to promote and set password.`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "super_admin",
        passwordHash,
        name,
      },
    });
    console.log(`Updated super admin (${email}).`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "super_admin",
      emailVerified: new Date(),
    },
  });
  console.log(`Created super admin (${email}).`);
}

async function seedDemoData() {
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
      role: "admin",
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

  console.log("Seeded 3 demo users, 8 bugs, and sample votes.");
  console.log("Demo login: alice@zendor.dev / 12345678 (admin)");
}

async function main() {
  const wasEmpty = (await prisma.user.count()) === 0;

  // Always idempotent; safe when a DB already has real accounts.
  await ensureSuperAdmin();

  const seedDemo =
    process.env.SEED_DEMO_DATA === "true" ||
    (wasEmpty && process.env.SEED_DEMO_DATA !== "false");

  if (!seedDemo) {
    console.log(
      "Demo data seed skipped (DB not empty). Set SEED_DEMO_DATA=true to force sample data (wipes users/bugs).",
    );
    return;
  }

  await seedDemoData();
  // Demo wipe removes the super admin — restore from env afterward.
  await ensureSuperAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
