import { Bar, SkeletonPage } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <SkeletonPage label="Loading leaderboard…">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Bar className="h-8 w-44" />
            <Bar className="h-4 w-96 max-w-full" />
          </div>
          <Bar className="h-[42px] w-28 rounded-full" />
        </div>
        <div className="flex flex-wrap items-stretch gap-4">
          <div className="grid min-w-0 flex-[999_1_640px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 rounded-[20px] border border-zk-border bg-zk-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <Bar className="h-9 w-9 rounded-xl" />
                  <Bar className="h-4 w-8" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-zk-chip" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Bar className="h-4 w-28" />
                    <Bar className="h-3 w-16" />
                  </div>
                </div>
                <Bar className="h-8 w-20" />
                <Bar className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-[1_1_300px] rounded-[20px] bg-deep-ocean p-[22px]">
            <Bar className="mb-4 h-3 w-28 bg-blue-slate" />
            <Bar className="mb-4 h-11 w-24 bg-blue-slate" />
            <Bar className="mb-2 h-2.5 w-full rounded-full bg-blue-slate" />
            <Bar className="h-3 w-40 bg-blue-slate" />
          </div>
        </div>
        <div className="rounded-[20px] border border-zk-border bg-zk-surface p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <Bar className="h-6 w-28" />
            <div className="flex gap-2.5">
              <Bar className="h-10 w-60 rounded-full" />
              <Bar className="h-10 w-36 rounded-full" />
            </div>
          </div>
          <Bar className="mb-2 h-11 w-full rounded-full" />
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-zk-divider px-4 py-3 last:border-0"
            >
              <Bar className="h-4 w-8" />
              <div className="h-9 w-9 rounded-full bg-zk-chip" />
              <Bar className="h-4 w-32 flex-1" />
              <Bar className="h-2 w-40 rounded-full" />
              <Bar className="h-4 w-12" />
              <Bar className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
