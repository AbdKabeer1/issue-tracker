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
