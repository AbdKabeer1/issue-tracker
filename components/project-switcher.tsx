"use client";

import { switchProjectAction } from "@/app/(app)/projects/actions";
import type { ProjectChoice } from "@/lib/project-context";
import { Select } from "@/components/ui/select";

/**
 * The active project in the header (#426). Changing the select submits the
 * server action, which validates the project against the current tenant and
 * redirects to the issue list it now scopes.
 */
export function ProjectSwitcher({
  projects,
  activeProjectId,
  className = "",
  fullWidth = false,
}: {
  projects: ProjectChoice[];
  activeProjectId: string | null;
  className?: string;
  fullWidth?: boolean;
}) {
  if (projects.length === 0) return null;

  return (
    <form action={switchProjectAction} className={className}>
      <label className="block">
        <span className="sr-only">Active project</span>
        <div className={fullWidth ? "w-full" : "w-44 max-w-[11rem]"}>
          <Select
            name="projectId"
            defaultValue={activeProjectId ?? projects[0].id}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            title="Switch project"
            className="h-9 truncate py-1.5 text-xs font-medium"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      </label>
      <noscript>
        <button type="submit" className="mt-1 text-xs text-teal-700 underline">
          Switch project
        </button>
      </noscript>
    </form>
  );
}
