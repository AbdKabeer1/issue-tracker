import { prisma } from "@/lib/prisma";

export const DEFAULT_PLATFORMS = ["Desktop", "Web", "Mobile"] as const;
const RETIRED_PLATFORMS = ["Backend", "Frontend", "FE"] as const;

/** Ensure the standard platforms exist and retire the former web subcategories. */
export async function ensureDefaultPlatforms(): Promise<void> {
  await Promise.all(
    DEFAULT_PLATFORMS.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name, isActive: true },
      }),
    ),
  );

  await prisma.category.updateMany({
    where: { name: { in: [...RETIRED_PLATFORMS] }, isActive: true },
    data: { isActive: false },
  });
}
