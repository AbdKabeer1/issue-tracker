"use client";

import { useState, type ReactNode } from "react";

type TabId = "conversation" | "decisions";

type IssueSectionTabsProps = {
  conversationCount: number;
  decisionsCount: number;
  conversation: ReactNode;
  decisions: ReactNode;
};

/**
 * Conversation / Agent decisions segmented control from the issue mockup.
 * Both panels stay mounted so permalinks and SSR content remain available.
 */
export function IssueSectionTabs({
  conversationCount,
  decisionsCount,
  conversation,
  decisions,
}: IssueSectionTabsProps) {
  const [tab, setTab] = useState<TabId>("conversation");

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "conversation", label: "Conversation", count: conversationCount },
    { id: "decisions", label: "Agent decisions", count: decisionsCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Issue sections"
        className="flex w-fit max-w-full flex-wrap gap-1 self-start rounded-full bg-zk-seg p-1"
      >
        {tabs.map((item) => {
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              id={`issue-tab-${item.id}`}
              aria-controls={`issue-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong ${
                on
                  ? "bg-zk-surface font-bold text-zk-text shadow-[0_1px_3px_rgba(21,18,31,0.12)]"
                  : "bg-transparent font-medium text-zk-text2 hover:text-zk-text"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-1.5 text-xs font-bold ${
                  on ? "bg-zk-tint text-zk-accent" : "bg-zk-chip text-zk-text2"
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="issue-panel-conversation"
        aria-labelledby="issue-tab-conversation"
        hidden={tab !== "conversation"}
        className={tab === "conversation" ? "block" : "hidden"}
      >
        {conversation}
      </div>
      <div
        role="tabpanel"
        id="issue-panel-decisions"
        aria-labelledby="issue-tab-decisions"
        hidden={tab !== "decisions"}
        className={tab === "decisions" ? "block" : "hidden"}
      >
        {decisions}
      </div>
    </div>
  );
}
