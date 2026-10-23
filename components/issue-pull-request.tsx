interface IssuePullRequestProps {
  pullRequestUrl: string | null | undefined;
}

function prLabel(url: string): { title: string; subtitle: string } {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const number = parts.includes("pull") ? parts[parts.indexOf("pull") + 1] : null;
    const shortRepo = parts.length >= 2 ? parts[1] : parts[0] || parsed.hostname;
    return {
      title: number ? `${shortRepo} #${number}` : shortRepo,
      subtitle: parts.length >= 1 ? `${parts[0]} · GitHub` : "GitHub",
    };
  } catch {
    return { title: url, subtitle: "GitHub" };
  }
}

export function IssuePullRequest({ pullRequestUrl }: IssuePullRequestProps) {
  if (!pullRequestUrl) {
    return null;
  }

  const { title, subtitle } = prLabel(pullRequestUrl);

  return (
    <section className="rounded-[20px] border border-zk-border bg-zk-surface p-5" data-testid="attached-pr-section">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-zk-muted">
          GitHub Pull Request
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zk-warn-bg px-2.5 py-0.5 text-[11px] font-bold text-zk-warn-fg">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Pending review
        </span>
      </div>
      <a
        href={pullRequestUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 rounded-[14px] border border-zk-border p-3 text-zk-text transition-colors hover:bg-zk-chip/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-zk-tint text-zk-accent">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="M6 9v12M13 6h3a2 2 0 0 1 2 2v7" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-bold">{title}</span>
          <span className="text-xs text-zk-muted">{subtitle}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="ml-auto shrink-0 text-zk-muted">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </a>
    </section>
  );
}
