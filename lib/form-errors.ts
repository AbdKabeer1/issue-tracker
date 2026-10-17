/**
 * Validation errors that know which field they belong to (#309).
 *
 * Server actions used to return only `issues[0].message`, so a screen-reader
 * user heard "Title must be at least 3 characters" from a message at the
 * bottom of the form with nothing tying it to the title field. Zod already
 * records the field in `issue.path`; this keeps it.
 */

/** What an action returns on a validation failure. */
export type FieldErrorResult = {
  error: string;
  /** The first field that failed, which is where focus goes. */
  field?: string;
  /** Every failing field and its first message, for the summary. */
  fieldErrors?: Record<string, string>;
};

type ZodLikeIssue = { path: readonly PropertyKey[]; message: string };

export function fromZodError(
  error: { issues: readonly ZodLikeIssue[] },
  fallback = "Invalid input",
): FieldErrorResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    // The first message per field is the one to show; later ones for the
    // same field are usually consequences of it.
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  const first = error.issues[0];
  const field = typeof first?.path[0] === "string" ? first.path[0] : undefined;

  return {
    error: first?.message ?? fallback,
    ...(field ? { field } : {}),
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
  };
}

/** An error about one known field, for checks that are not Zod's. */
export function fieldError(field: string, error: string): FieldErrorResult {
  return { error, field, fieldErrors: { [field]: error } };
}

/** The id an error message for this field is rendered with. */
export function errorIdFor(formId: string, field: string): string {
  return `${formId}-${field}-error`;
}

/**
 * Attributes for a control, given the current errors. A field with an error
 * is marked invalid and described by its message; any other field gets
 * nothing, so it is not announced as invalid by mistake.
 */
export function fieldErrorAttrs(
  formId: string,
  field: string,
  fieldErrors: Record<string, string> | undefined,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  if (!fieldErrors?.[field]) return {};
  return {
    "aria-invalid": true,
    "aria-describedby": errorIdFor(formId, field),
  };
}
