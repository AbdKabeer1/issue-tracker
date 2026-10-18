import { Bar, CardSkeleton, SkeletonPage } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading settings…">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <Bar className="h-3 w-28" />
          <Bar className="h-7 w-40" />
        </div>
        <CardSkeleton rows={4} />
      </div>
    </SkeletonPage>
  );
}
