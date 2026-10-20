"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { fieldError, fromZodError } from "@/lib/form-errors";
import { prisma } from "@/lib/prisma";
import { setActiveProjectCookie } from "@/lib/project-context";
import { currentTenantIdFor, NO_TENANT_MESSAGE } from "@/lib/tenant-context";
import { isTenantAdmin } from "@/lib/agents/membership";
import { createMissionSchema, createTestMissions } from "@/lib/missions";
import { nextProjectSlug, projectNameSchema, projectSlugBase } from "./validation";

export type ProjectActionResult = {
  error?: string;
  field?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

/** Create a route/role/viewport mission set for a project (#619). */
export async function createTestMissionAction(
  _previous: ProjectActionResult | undefined,
  formData: FormData,
): Promise<ProjectActionResult> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return { error: NO_TENANT_MESSAGE };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const project = projectId ? await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: { id: true },
  }) : null;
  if (!project) return { error: "Project not found." };
  if (!(await isTenantAdmin(user, tenantId))) {
    return { error: "Only project admins can manage test missions." };
  }

  const parsed = createMissionSchema.safeParse({
    routePattern: formData.get("routePattern"),
    brief: formData.get("brief"),
    roles: formData.getAll("roles"),
    viewports: formData.getAll("viewports"),
  });
  if (!parsed.success) return fromZodError(parsed.error, "Check the mission details");

  const result = await createTestMissions(project.id, parsed.data);
  revalidatePath("/projects");
  return result.count > 0
    ? { message: `Added ${result.count} test mission${result.count === 1 ? "" : "s"}.` }
    : { message: "Those route, role, and viewport missions already exist." };
}

/**
 * Create a project in the current tenant and make it active (#426).
 *
 * The slug is derived from the name; a second "Zedu Web" becomes
 * "zedu-web-2" rather than failing the person's click.
 */
export async function createProjectAction(
  _previous: ProjectActionResult | undefined,
  formData: FormData,
): Promise<ProjectActionResult> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return { error: NO_TENANT_MESSAGE };

  const parsed = projectNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return fromZodError(parsed.error, "Invalid project name");

  const existing = await prisma.project.findMany({
    where: { tenantId },
    select: { slug: true },
  });
  const slug = nextProjectSlug(
    projectSlugBase(parsed.data.name),
    new Set(existing.map((project) => project.slug)),
  );

  let project: { id: string };
  try {
    project = await prisma.project.create({
      data: { tenantId, name: parsed.data.name, slug },
      select: { id: true },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return fieldError("name", "A project with that name already exists.");
    }
    throw error;
  }

  await setActiveProjectCookie(project.id);
  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath("/issues");
  redirect("/issues");
}

/**
 * Switch the active project, but only within the person's current tenant.
 *
 * Returns nothing: the switcher only offers projects the tenant owns, and a
 * forged id is ignored rather than exposing whether another tenant has it.
 */
export async function switchProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return;

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return;

  // The tenantId is part of the lookup, not the cookie: a forged project id
  // from another tenant is simply not found.
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: { id: true },
  });
  if (!project) return;

  await setActiveProjectCookie(project.id);
  revalidatePath("/", "layout");
  revalidatePath("/issues");
  redirect("/issues");
}
