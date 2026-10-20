import { execSync } from "child_process";
import { existsSync } from "fs";

/**
 * Container start step: apply pending Prisma migrations, nothing else (#112).
 *
 * Production schema changes must go through reviewed migrations. This script
 * used to follow `migrate deploy` with `prisma db push --accept-data-loss`,
 * which silently drops columns/tables that schema.prisma no longer has.
 *
 * If deploy stops early, scripts/sql/ensure-bug-number.sql still adds the
 * missing issue reference column, scripts/sql/ensure-bug-duplicates.sql adds
 * Bug.duplicateOfId, and scripts/sql/ensure-agent-key-project-scope.sql adds
 * AgentApiKey.projectId and AgentPairing.projectId. scripts/sql/ensure-shipped-agent-schema.sql
 * adds the personal-agent columns, issue bids, and redesign preview columns.
 * None of them drop anything.
 */

/**
 * #580: whether a migration that is still failing after every repair step
 * should stop the container. True in production, so the server never starts
 * on a schema its code doesn't match: the Dockerfile only runs `pnpm run start`
 * when this script exits 0, and Coolify keeps the previous container serving.
 * ALLOW_START_WITH_FAILED_MIGRATION=true is the escape hatch for an incident
 * where starting anyway is the lesser evil. Outside production it only warns.
 */
function stopOnFailure() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_START_WITH_FAILED_MIGRATION !== "true"
  );
}

let url = process.env.DATABASE_URL;
if (url) {
  url = url.trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }
  process.env.DATABASE_URL = url;
}

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db:migrate] WARNING: DATABASE_URL is not set. Skipping database migrations.",
  );
  // #220, #580: in production a missing DATABASE_URL means the app would start
  // against no database at all, so stop here and let the deploy fail.
  if (stopOnFailure()) {
    console.error(
      "[db:migrate] DATABASE_URL is not set in production. Not starting the server.",
    );
    process.exit(1);
  }
  process.exit(0);
}

const prismaBin = existsSync("./node_modules/.bin/prisma")
  ? "./node_modules/.bin/prisma"
  : "pnpm exec prisma";

const bugNumberMigration = "20261017140000_bug_reference_number";
const duplicateMigration = "20261019020000_bug_duplicates";
const milestoneMigration = "20261019030000_milestones";
const detailMigrations = [
  "20261017140000_issue_watch_and_notifications",
  "20261017150000_attachments",
];
const userSettingsMigrations = [
  "20261017100000_user_email_notifications",
  "20261017150000_notification_preferences",
  "20261020000000_keyboard_shortcuts",
  "20261020010000_theme_preference",
];
const agentPlatformMigration = "20261021000000_agent_platform";
const agentKeyProjectScopeMigration = "20261022120000_agent_key_project_scope";
const redesignPreviewMigration = "20261022000000_redesign_mockups_and_choice";
const disputeRequestedRoleMigration = "20261022120000_dispute_requested_role";
const defaultProjectKeyMigration = "20261022150000_default_project_agent_key";
const issueBidsMigration = "20261022160000_issue_bids";

function runPrisma(args, inherit = false) {
  return execSync(`${prismaBin} ${args}`, {
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

function recordApplied(name) {
  try {
    runPrisma(`migrate resolve --applied ${name}`, true);
    console.log(`[db:migrate] Recorded ${name} as applied.`);
  } catch (resolveError) {
    const message = resolveError instanceof Error ? resolveError.message : String(resolveError);
    console.log(`[db:migrate] ${name} was already recorded:`, message.split("\n")[0]);
    if (/failed|P3018|P3009/i.test(message)) {
      try {
        runPrisma(`migrate resolve --rolled-back ${name}`, true);
        runPrisma(`migrate resolve --applied ${name}`, true);
        console.log(`[db:migrate] Recorded ${name} as applied.`);
      } catch (retryResolveError) {
        console.error(
          `[db:migrate] Could not record ${name}:`,
          retryResolveError instanceof Error
            ? retryResolveError.message.split("\n")[0]
            : retryResolveError,
        );
      }
    }
  }
}

function deploy() {
  console.log(`[db:migrate] Running ${prismaBin} migrate deploy...`);
  runPrisma("migrate deploy", true);
  console.log("[db:migrate] Migrations applied.");
}

let firstDeployFailed = false;
try {
  deploy();
} catch (error) {
  firstDeployFailed = true;
  console.error(
    "[db:migrate] prisma migrate deploy encountered error:",
    error instanceof Error ? error.message : String(error),
  );
}

// A normal container start runs `migrate deploy` only (#581). The repair
// steps below exist to unstick databases from an earlier incident; leave them
// available but opt-in, and say so in the log when they do run.
if (process.env.MIGRATION_REPAIR !== "1") {
  if (firstDeployFailed) {
    if (stopOnFailure()) {
      console.error(
        "[db:migrate] Not starting the server. Fix the migration, or set ALLOW_START_WITH_FAILED_MIGRATION=true to start anyway.",
      );
      process.exit(1);
    }
    console.warn("[db:migrate] Continuing outside production.");
  } else {
    console.log(
      "[db:migrate] Repair steps skipped (set MIGRATION_REPAIR=1 to run the legacy repairs once).",
    );
  }
  process.exit(0);
}
console.log(
  "[db:migrate] MIGRATION_REPAIR=1: running legacy repair steps; every action below is logged.",
);

// migrate deploy can stop on an earlier failure and never reach the reference
// number migration. db push is not used here: without --accept-data-loss it
// bails on any drift, and with that flag it can drop columns. This statement
// only adds Bug.number when it is missing.
try {
  console.log("[db:migrate] Ensuring Bug.number exists...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-bug-number.sql",
    true,
  );
  console.log("[db:migrate] Bug.number is present.");
  try {
    console.log("[db:migrate] Ensuring issue detail tables exist...");
    runPrisma(
      "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-issue-detail.sql",
      true,
    );
    console.log("[db:migrate] Issue detail tables are present.");
    for (const name of detailMigrations) {
      try {
        runPrisma(`migrate resolve --applied ${name}`, true);
        console.log(`[db:migrate] Recorded ${name} as applied.`);
      } catch (detailResolveError) {
        console.log(
          `[db:migrate] ${name} was already recorded:`,
          detailResolveError instanceof Error
            ? detailResolveError.message.split("\n")[0]
            : detailResolveError,
        );
      }
    }
  } catch (detailError) {
    console.error(
      "[db:migrate] Could not add issue detail tables:",
      detailError instanceof Error ? detailError.message : String(detailError),
    );
  }
  try {
    runPrisma(`migrate resolve --applied ${bugNumberMigration}`, true);
    console.log(`[db:migrate] Recorded ${bugNumberMigration} as applied.`);
  } catch (resolveError) {
    console.log(
      "[db:migrate] Reference-number migration was already recorded:",
      resolveError instanceof Error ? resolveError.message.split("\n")[0] : resolveError,
    );
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after Bug.number repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (ensureError) {
  console.error(
    "[db:migrate] Could not add Bug.number:",
    ensureError instanceof Error ? ensureError.message : String(ensureError),
  );
}

// The issues list filters on Bug.duplicateOfId. If an earlier migration is
// stuck, deploy never reaches 20261019020000_bug_duplicates and every list
// request fails. Add the column, then record that migration so the retry
// does not try to add it again.
try {
  console.log("[db:migrate] Ensuring Bug.duplicateOfId exists...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-bug-duplicates.sql",
    true,
  );
  console.log("[db:migrate] Bug.duplicateOfId is present.");
  try {
    runPrisma(
      "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-duplicate-activity-type.sql",
      true,
    );
  } catch (enumError) {
    console.error(
      "[db:migrate] Could not add ActivityType duplicate_changed:",
      enumError instanceof Error ? enumError.message.split("\n")[0] : enumError,
    );
  }
  try {
    runPrisma(`migrate resolve --applied ${duplicateMigration}`, true);
    console.log(`[db:migrate] Recorded ${duplicateMigration} as applied.`);
  } catch (resolveError) {
    const message =
      resolveError instanceof Error ? resolveError.message : String(resolveError);
    console.log(
      "[db:migrate] Duplicate migration was already recorded:",
      message.split("\n")[0],
    );
    // A failed row blocks resolve --applied. Clear it, then record the repair.
    if (/failed|P3018|P3009/i.test(message)) {
      try {
        runPrisma(`migrate resolve --rolled-back ${duplicateMigration}`, true);
        runPrisma(`migrate resolve --applied ${duplicateMigration}`, true);
        console.log(`[db:migrate] Recorded ${duplicateMigration} as applied.`);
      } catch (retryResolveError) {
        console.error(
          "[db:migrate] Could not record the duplicate migration:",
          retryResolveError instanceof Error
            ? retryResolveError.message.split("\n")[0]
            : retryResolveError,
        );
      }
    }
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after duplicate repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (duplicateError) {
  console.error(
    "[db:migrate] Could not add Bug.duplicateOfId:",
    duplicateError instanceof Error ? duplicateError.message : String(duplicateError),
  );
}

// #289: The issue page queries Bug.milestoneId and Milestone. If an earlier
// migration failed or stopped, deploy never reaches 20261019030000_milestones
// and issue detail pages crash. Add the table and column, then record that
// migration so the retry does not try to add it again.
try {
  console.log("[db:migrate] Ensuring Milestone and Bug.milestoneId exist...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-milestones.sql",
    true,
  );
  console.log("[db:migrate] Milestone and Bug.milestoneId are present.");
  try {
    runPrisma(
      "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-milestone-activity-type.sql",
      true,
    );
  } catch (enumError) {
    console.error(
      "[db:migrate] Could not add ActivityType milestone_changed:",
      enumError instanceof Error ? enumError.message.split("\n")[0] : enumError,
    );
  }
  try {
    runPrisma(`migrate resolve --applied ${milestoneMigration}`, true);
    console.log(`[db:migrate] Recorded ${milestoneMigration} as applied.`);
  } catch (resolveError) {
    const message =
      resolveError instanceof Error ? resolveError.message : String(resolveError);
    console.log(
      "[db:migrate] Milestone migration was already recorded:",
      message.split("\n")[0],
    );
    // A failed row blocks resolve --applied. Clear it, then record the repair.
    if (/failed|P3018|P3009/i.test(message)) {
      try {
        runPrisma(`migrate resolve --rolled-back ${milestoneMigration}`, true);
        runPrisma(`migrate resolve --applied ${milestoneMigration}`, true);
        console.log(`[db:migrate] Recorded ${milestoneMigration} as applied.`);
      } catch (retryResolveError) {
        console.error(
          "[db:migrate] Could not record the milestone migration:",
          retryResolveError instanceof Error
            ? retryResolveError.message.split("\n")[0]
            : retryResolveError,
        );
      }
    }
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after milestone repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (milestoneError) {
  console.error(
    "[db:migrate] Could not add Milestone or Bug.milestoneId:",
    milestoneError instanceof Error ? milestoneError.message : String(milestoneError),
  );
}

// Settings page queries User.theme, User.keyboardShortcuts, and email notification preferences.
// If an earlier migration was stuck, deploy never reaches those migrations and settings crashes.
try {
  console.log("[db:migrate] Ensuring User settings columns and ThemePreference exist...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-user-settings.sql",
    true,
  );
  console.log("[db:migrate] User settings columns are present.");
  for (const name of userSettingsMigrations) {
    try {
      runPrisma(`migrate resolve --applied ${name}`, true);
      console.log(`[db:migrate] Recorded ${name} as applied.`);
    } catch (resolveError) {
      const message =
        resolveError instanceof Error ? resolveError.message : String(resolveError);
      console.log(
        `[db:migrate] ${name} was already recorded:`,
        message.split("\n")[0],
      );
      if (/failed|P3018|P3009/i.test(message)) {
        try {
          runPrisma(`migrate resolve --rolled-back ${name}`, true);
          runPrisma(`migrate resolve --applied ${name}`, true);
          console.log(`[db:migrate] Recorded ${name} as applied.`);
        } catch (retryResolveError) {
          console.error(
            `[db:migrate] Could not record ${name}:`,
            retryResolveError instanceof Error
              ? retryResolveError.message.split("\n")[0]
              : retryResolveError,
          );
        }
      }
    }
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after user settings repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (settingsError) {
  console.error(
    "[db:migrate] Could not add User settings columns:",
    settingsError instanceof Error ? settingsError.message : String(settingsError),
  );
}

// Agent platform data model (tenants, projects, memberships, agent tables, Bug/Comment columns).
// If an earlier migration was stuck or 20261021000000_agent_platform failed partially,
// migrate deploy halts and /issues, /tenants, and layout crash.
try {
  console.log("[db:migrate] Ensuring Agent platform schema (tenants, projects, memberships) exists...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-agent-platform.sql",
    true,
  );
  console.log("[db:migrate] Agent platform schema is present.");
  try {
    runPrisma(`migrate resolve --applied ${agentPlatformMigration}`, true);
    console.log(`[db:migrate] Recorded ${agentPlatformMigration} as applied.`);
  } catch (resolveError) {
    const message =
      resolveError instanceof Error ? resolveError.message : String(resolveError);
    console.log(
      `[db:migrate] ${agentPlatformMigration} was already recorded:`,
      message.split("\n")[0],
    );
    if (/failed|P3018|P3009/i.test(message)) {
      try {
        runPrisma(`migrate resolve --rolled-back ${agentPlatformMigration}`, true);
        runPrisma(`migrate resolve --applied ${agentPlatformMigration}`, true);
        console.log(`[db:migrate] Recorded ${agentPlatformMigration} as applied.`);
      } catch (retryResolveError) {
        console.error(
          `[db:migrate] Could not record ${agentPlatformMigration}:`,
          retryResolveError instanceof Error
            ? retryResolveError.message.split("\n")[0]
            : retryResolveError,
        );
      }
    }
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after agent platform repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (agentPlatformError) {
  console.error(
    "[db:migrate] Could not add Agent platform schema:",
    agentPlatformError instanceof Error ? agentPlatformError.message : String(agentPlatformError),
  );
}

// Pairing's insert returns AgentPairing.projectId (#742). If an earlier
// migration is stuck, deploy never reaches 20261022120000_agent_key_project_scope
// and POST /api/v1/agents/pairing returns 500 after the name is accepted.
try {
  console.log("[db:migrate] Ensuring agent key project columns exist...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-agent-key-project-scope.sql",
    true,
  );
  console.log("[db:migrate] AgentApiKey.projectId and AgentPairing.projectId are present.");
  try {
    runPrisma(`migrate resolve --applied ${agentKeyProjectScopeMigration}`, true);
    console.log(`[db:migrate] Recorded ${agentKeyProjectScopeMigration} as applied.`);
  } catch (resolveError) {
    const message =
      resolveError instanceof Error ? resolveError.message : String(resolveError);
    console.log(
      `[db:migrate] ${agentKeyProjectScopeMigration} was already recorded:`,
      message.split("\n")[0],
    );
    if (/failed|P3018|P3009/i.test(message)) {
      try {
        runPrisma(`migrate resolve --rolled-back ${agentKeyProjectScopeMigration}`, true);
        runPrisma(`migrate resolve --applied ${agentKeyProjectScopeMigration}`, true);
        console.log(`[db:migrate] Recorded ${agentKeyProjectScopeMigration} as applied.`);
      } catch (retryResolveError) {
        console.error(
          `[db:migrate] Could not record ${agentKeyProjectScopeMigration}:`,
          retryResolveError instanceof Error
            ? retryResolveError.message.split("\n")[0]
            : retryResolveError,
        );
      }
    }
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after agent key project repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (projectScopeError) {
  console.error(
    "[db:migrate] Could not add agent key project columns:",
    projectScopeError instanceof Error ? projectScopeError.message : String(projectScopeError),
  );
}

// Issue pages select RedesignProposal.previewUrl and IssueBid. The header
// creates a personal agent, which writes Agent.defaultProjectId and
// AgentApiKey.sealedKey. A stuck earlier migration never reaches those files,
// and the signed-in app then crashes on the missing relation.
try {
  console.log("[db:migrate] Ensuring redesign status value exists...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-redesign-status.sql",
    true,
  );
} catch (enumError) {
  console.error(
    "[db:migrate] Could not add RedesignStatus superseded:",
    enumError instanceof Error ? enumError.message.split("\n")[0] : enumError,
  );
}
try {
  console.log("[db:migrate] Ensuring personal agent columns, bids, and redesign preview exist...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-shipped-agent-schema.sql",
    true,
  );
  console.log("[db:migrate] Personal agent columns, bids, and redesign preview are present.");
  for (const name of [redesignPreviewMigration, defaultProjectKeyMigration, issueBidsMigration]) {
    recordApplied(name);
  }
  try {
    deploy();
  } catch (retryError) {
    console.error(
      "[db:migrate] migrate deploy still failing after shipped agent schema repair:",
      retryError instanceof Error ? retryError.message : String(retryError),
    );
  }
} catch (shippedSchemaError) {
  console.error(
    "[db:migrate] Could not add personal agent columns, bids, or redesign preview:",
    shippedSchemaError instanceof Error ? shippedSchemaError.message : String(shippedSchemaError),
  );
}
try {
  console.log("[db:migrate] Ensuring PointDispute.requestedRole exists...");
  runPrisma(
    "db execute --schema prisma/schema.prisma --file scripts/sql/ensure-dispute-requested-role.sql",
    true,
  );
  recordApplied(disputeRequestedRoleMigration);
} catch (disputeRoleError) {
  console.error(
    "[db:migrate] Could not add PointDispute.requestedRole:",
    disputeRoleError instanceof Error ? disputeRoleError.message : String(disputeRoleError),
  );
}

// #580: every repair above has had its turn. One last `migrate deploy` must
// succeed (it is a no-op when everything is applied); if it doesn't, the
// schema is still behind the code and the server must not start on it.
try {
  deploy();
} catch (finalError) {
  console.error(
    "[db:migrate] Migrations are still failing after every repair step:",
    finalError instanceof Error ? finalError.message : String(finalError),
  );
  if (stopOnFailure()) {
    console.error(
      "[db:migrate] Not starting the server. Fix the migration, or set ALLOW_START_WITH_FAILED_MIGRATION=true to start anyway.",
    );
    process.exit(1);
  }
  console.warn("[db:migrate] Continuing outside production.");
}
