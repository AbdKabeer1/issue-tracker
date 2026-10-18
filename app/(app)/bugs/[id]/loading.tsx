import { Bar, CardSkeleton, SkeletonPage } from "@/components/ui/skeleton";

/**
 * Shaped like the issue page: back link, title, badges, then the
 * description, details and comments cards (#291).
 */
export default function IssueLoading() {
  return (
    <SkeletonPage label="Loading issue…">
      <div className="space-y-3">
        <Bar className="h-3 w-28" />
        <Bar className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Bar className="h-5 w-16 rounded-full" />
          <Bar className="h-5 w-16 rounded-full" />
          <Bar className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <CardSkeleton rows={4} />
      <CardSkeleton rows={2} />
      <CardSkeleton rows={3} />
    </SkeletonPage>
  );
}
