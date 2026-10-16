import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const DEFAULT_ISSUE_TYPES = [
  { name: "Marketing", description: "Marketing and promotion related tasks" },
  { name: "Design", description: "UI/UX and visual design tasks" },
  { name: "Fix", description: "Issue fixes and defect resolutions" },
  { name: "Feat", description: "New features and enhancements" },
] as const;

export const issueTypeInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Type name must be at least 2 characters")
    .max(50, "Type name must be at most 50 characters"),
  description: z.string().trim().max(300).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type IssueTypeInput = z.infer<typeof issueTypeInputSchema>;

export const issueTypeBadgeClass: Record<string, string> = {
  Marketing: "bg-pink-100 text-pink-800 border-pink-200",
  Design: "bg-purple-100 text-purple-800 border-purple-200",
  Fix: "bg-amber-100 text-amber-800 border-amber-200",
  Feat: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function getIssueTypeBadgeClass(name: string): string {
  return (
    issueTypeBadgeClass[name] ??
    "bg-indigo-100 text-indigo-800 border-indigo-200"
  );
}

/**
 * Checks whether an issue type can be safely deleted.
 * Types in use cannot be deleted without handling existing issues.
 */
export function canDeleteIssueType(bugCount: number): {
  allowed: boolean;
  reason?: string;
} {
  if (bugCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete type because it is in use by ${bugCount} issue${bugCount === 1 ? "" : "s"}. Deactivate it instead.`,
    };
  }
  return { allowed: true };
}

/**
 * Ensures default issue types (Marketing, Design, Fix, Feat) exist in the database only when empty.
 */
export async function ensureDefaultIssueTypes(): Promise<void> {
  const count = await prisma.issueType.count();
  if (count > 0) return;

  for (const item of DEFAULT_ISSUE_TYPES) {
    await prisma.issueType.upsert({
      where: { name: item.name },
      update: {},
      create: {
        name: item.name,
        description: item.description,
        isActive: true,
      },
    });
  }
}

/**
 * Retrieves all active issue types for issue creation.
 */
export async function getActiveIssueTypes() {
  return prisma.issueType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

