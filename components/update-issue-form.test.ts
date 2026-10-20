import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * Guards the triage form's two fixes:
 *  - controlled selects, so a save doesn't leave the pre-save value on screen;
 *  - submitted by hand, because React 19 resets a form after an action and
 *    that reset was what put the old value back.
 */
const source = readFileSync("components/update-issue-form.tsx", "utf8");

describe("UpdateIssueForm", () => {
  it("has no uncontrolled field left", () => {
    expect(source).not.toMatch(/defaultValue=\{/);
  });

  it("drives every triage field from state", () => {
    for (const field of ["draft.status", "draft.severity", "draft.typeId", "draft.categoryId", "draft.assigneeId"]) {
      expect(source).toContain(`value={${field}}`);
    }
  });

  it("submits via onSubmit, not the action prop, to avoid React's form reset", () => {
    expect(source).toContain("onSubmit={(event) => {");
    expect(source).toContain("event.preventDefault();");
    expect(source).not.toMatch(/<form[^>]*\n\s*action=\{/);
  });

  it("announces the result of a save", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });

  it("tracks unsaved changes and warns before the page unloads", () => {
    expect(source).toContain("const dirty = !sameDraft(draft, serverDraft);");
    expect(source).toContain('window.addEventListener("beforeunload", warn)');
    expect(source).toContain('window.removeEventListener("beforeunload", warn)');
    expect(source).toContain("disabled={pending || !dirty}");
  });

  it("adopts a change made elsewhere only when there are no local edits", () => {
    expect(source).toContain("const wasUnedited = sameDraft(draft, lastServer);");
    expect(source).toContain("if (wasUnedited) setDraft(serverDraft);");
  });
});
