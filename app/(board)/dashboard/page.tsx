import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantAccess } from "@/lib/tenant-access";
import {
  loadSignalBrief,
  loadSignalChannels,
  loadSignalDecisions,
  loadSignalWorkforce,
  parseSignalView,
  type OperationsBrief,
} from "@/lib/signal-board";
import { toSingleQueryParam } from "@/lib/search";
import { SignalBoard } from "@/components/signal-board/signal-board";

export const metadata: Metadata = { title: "Signal Board" };

type SearchParams = Promise<{
  view?: string | string[];
  pulse?: string | string[];
}>;

const EMPTY_BRIEF: OperationsBrief = {
  openIssues: 0,
  autoResolved: 0,
  pendingDecisions: 0,
  automationPct: 0,
  highPriority: 0,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const access = await currentTenantAccess(user.id, user.role);
  const tenantId = access.tenantId;
  const view = parseSignalView(toSingleQueryParam(params.view));
  const pulseId = toSingleQueryParam(params.pulse) ?? null;

  if (!tenantId) {
    return (
      <SignalBoard
        brief={EMPTY_BRIEF}
        channels={[]}
        decisions={[]}
        workforce={[]}
        canDecide={false}
        view={view}
        pulseId={pulseId}
      />
    );
  }

  const [brief, channelResult, decisions, workforce] = await Promise.all([
    loadSignalBrief(tenantId).catch((error) => {
      console.error("[signal-board] brief failed", error);
      return EMPTY_BRIEF;
    }),
    loadSignalChannels({ tenantId, userId: user.id, view }).catch((error) => {
      console.error("[signal-board] channels failed", error);
      return { channels: [], total: 0 };
    }),
    loadSignalDecisions(tenantId).catch((error) => {
      console.error("[signal-board] decisions failed", error);
      return [];
    }),
    loadSignalWorkforce(tenantId).catch((error) => {
      console.error("[signal-board] workforce failed", error);
      return [];
    }),
  ]);

  return (
    <SignalBoard
      brief={brief}
      channels={channelResult.channels}
      decisions={decisions}
      workforce={workforce}
      canDecide={access.admin}
      view={view}
      pulseId={pulseId}
    />
  );
}
