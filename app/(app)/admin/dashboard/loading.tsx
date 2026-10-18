import { Bar, CardSkeleton, SkeletonPage } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonPage label="Loading dashboard…">
      <div className="space-y-2">
        <Bar className="h-3 w-28" />
        <Bar className="h-7 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="h-48 rounded-xl border border-slate-200 bg-white p-4">
        <Bar className="h-full w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    </SkeletonPage>
  );
}
