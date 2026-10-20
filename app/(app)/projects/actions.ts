"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { fieldError, fromZodError } from "@/lib/form-errors";
import { prisma } from "@/lib/prisma";
import { setActiveProjectCookie } from "@/lib/project-context";
import { currentTenantIdFor, NO_TENANT_MESSAGE } from "@/lib/tenant-context";
import { nextProjectSlug, projectNameSchema, projectSlugBase } from "./validation";

export type ProjectActionResult = {
  error?: string;
  field?: string;
  fieldErrors?: Record<string, string>;
};

function projectsMessage(key: "error" | "notice", message: string): string {
  return `/projects?${key}=${encodeURIComponent(message)}`;
}

/** The current tenant, only when the signed-in person owns it. */
async function ownerTenantFor(
  userId: string,
): Promise<{ tenantId: string } | { error: string }> {
  const tenantId = await currentTenantIdFor(userId);
  if (!tenantId) return { error: NO_TENANT_MESSAGE };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  });
  if (membership?.role !== "owner") {
    return { error: "Only a tenant owner can manage its projects." };
  }
  return { tenantId };
}

function projectInTenant(tenantId: string, projectId: string) {
  if (!projectId) return null;
  return prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      _count: { select: { bugs: true } },
    },
  });
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
    where: { id: projectId, tenantId, archivedAt: null },
    select: { id: true },
  });
  if (!project) return;

  await setActiveProjectCookie(project.id);
  revalidatePath("/", "layout");
  revalidatePath("/issues");
  redirect("/issues");
}

/** Rename a project in the owner's tenant; the slug stays the same. */
export async function renameProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const owner = await ownerTenantFor(user.id);
  if ("error" in owner) redirect(projectsMessage("error", owner.error));

  const project = await projectInTenant(owner.tenantId, String(formData.get("projectId") ?? ""));
  if (!project) redirect(projectsMessage("error", "That project isn't in this workspace."));
  if (project.archivedAt) {
    redirect(projectsMessage("error", "Restore this project before renaming it."));
  }

  const parsed = projectNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(
      projectsMessage(
        "error",
        parsed.error.issues[0]?.message ?? "Check the project's name.",
      ),
    );
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { name: parsed.data.name },
  });
  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath("/issues");
  redirect(projectsMessage("notice", "Project renamed."));
}

/** Archive or restore a project the tenant owner owns. */
export async function setProjectArchivedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const owner = await ownerTenantFor(user.id);
  if ("error" in owner) redirect(projectsMessage("error", owner.error));

  const project = await projectInTenant(owner.tenantId, String(formData.get("projectId") ?? ""));
  if (!project) redirect(projectsMessage("error", "That project isn't in this workspace."));

  const archived = String(formData.get("archived") ?? "") === "true";
  if (Boolean(project.archivedAt) !== archived) {
    await prisma.project.update({
      where: { id: project.id },
      data: { archivedAt: archived ? new Date() : null },
    });
  }

  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath("/issues");
  redirect(projectsMessage("notice", archived ? "Project archived." : "Project restored."));
}

/** Delete a project after the owner types its name, and only when it has no issues. */
export async function deleteProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const owner = await ownerTenantFor(user.id);
  if ("error" in owner) redirect(projectsMessage("error", owner.error));

  const project = await projectInTenant(owner.tenantId, String(formData.get("projectId") ?? ""));
  if (!project) redirect(projectsMessage("error", "That project isn't in this workspace."));

  if (project._count.bugs > 0) {
    redirect(
      projectsMessage("error", "This project still has issues. Archive it instead."),
    );
  }

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed !== project.name) {
    redirect(projectsMessage("error", "Type the project's name exactly to confirm."));
  }

  try {
    await prisma.project.delete({ where: { id: project.id } });
  } catch (error) {
    console.error("[projects] deleteProjectAction failed", error);
    redirect(projectsMessage("error", "Couldn't delete this project. Archive it instead."));
  }

  revalidatePath("/", "layout");
  revalidatePath("/projects");
  revalidatePath("/issues");
  redirect(projectsMessage("notice", "Project deleted."));
}
