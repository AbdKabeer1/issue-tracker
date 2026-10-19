import { prisma } from "@/lib/prisma";

export type BulkOption = { id: string; name: string };

/** Active rows for the bulk-action menus. Inactive ones stay out of the dropdown. */
export function activeBulkOptions(
  rows: { id: string; name: string; isActive: boolean }[],
): BulkOption[] {
  return rows.filter((row) => row.isActive).map(({ id, name }) => ({ id, name }));
}

/**
 * Admins who can be assigned in bulk. A failure here must not blank the
 * issues list: the menus are optional, the rows are not.
 */
export async function loadBulkAssignees(): Promise<BulkOption[]> {
  try {
    return await prisma.user.findMany({
      where: { role: { in: ["admin", "super_admin"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("[bugs] bulk assignee lookup failed", error);
    return [];
  }
}
