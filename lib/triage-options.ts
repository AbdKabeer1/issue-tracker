export type TriageOption = { id: string; name: string };

/**
 * Options for a triage <select> that only lists active types/categories.
 *
 * If the issue's current value has since been deactivated it is missing from
 * the active list, so the browser falls back to "No type"/"None" and saving
 * any other field clears it (#115). Keep the current value selectable,
 * labelled as inactive, so an unrelated save leaves it untouched.
 */
export function withCurrentOption(
  active: TriageOption[],
  current: (TriageOption & { isActive?: boolean }) | null | undefined,
): TriageOption[] {
  if (!current || active.some((option) => option.id === current.id)) {
    return active;
  }
  return [...active, { id: current.id, name: `${current.name} (inactive)` }];
}
