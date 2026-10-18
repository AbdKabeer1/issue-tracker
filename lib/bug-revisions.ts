/**
 * Edit history for an issue's title and description (#303).
 *
 * A BugRevision row holds the version an edit *replaced*, with who made
 * that edit and when. So the versions of an issue, oldest first, are each
 * revision's content followed by the issue as it is now, and version k+1
 * was written by whoever made revision k.
 */

export type RevisionRow = {
  id: string;
  title: string;
  description: string;
  editedAt: Date;
  editedBy: { name: string } | null;
};

export type IssueVersion = {
  /** 1 is the original report. */
  number: number;
  title: string;
  description: string;
  author: string;
  at: Date;
  isCurrent: boolean;
};

export const DELETED_EDITOR = "A deleted account";

export function buildVersions(
  current: { title: string; description: string; createdAt: Date; reporterName: string },
  revisions: RevisionRow[],
): IssueVersion[] {
  const ordered = [...revisions].sort((a, b) => a.editedAt.getTime() - b.editedAt.getTime());
  const contents = [
    ...ordered.map((r) => ({ title: r.title, description: r.description })),
    { title: current.title, description: current.description },
  ];
  return contents.map((content, i) => {
    const madeBy = i === 0 ? null : ordered[i - 1];
    return {
      number: i + 1,
      ...content,
      author: madeBy ? (madeBy.editedBy?.name ?? DELETED_EDITOR) : current.reporterName,
      at: madeBy ? madeBy.editedAt : current.createdAt,
      isCurrent: i === contents.length - 1,
    };
  });
}
