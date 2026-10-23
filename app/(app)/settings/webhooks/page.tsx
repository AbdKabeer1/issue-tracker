import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { isAgentPlatformEnabled } from "@/lib/feature-flags";
import { WebhookManagement } from "@/components/webhook-management";

export const metadata = { title: "Webhooks" };

function BackToSettings() {
  return (
    <Link
      href="/settings"
      className="inline-flex min-h-8 items-center gap-1.5 self-start text-sm font-semibold text-zk-accent hover:underline"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back to settings
    </Link>
  );
}

export default async function WebhooksSettingsPage() {
  if (!isAgentPlatformEnabled()) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-1 pb-10 sm:px-0">
        <div className="flex flex-col gap-2.5">
          <BackToSettings />
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">
            Webhooks
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zk-muted">
            The agent platform feature is not enabled in this environment.
          </p>
        </div>
      </div>
    );
  }

  await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-10 sm:px-0">
      <div className="flex flex-col gap-2.5">
        <BackToSettings />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[680px] flex-col gap-1.5">
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">
              Webhooks
            </h1>
            <p className="text-sm leading-relaxed text-zk-muted">
              Manage webhook subscriptions for your agents. Events are delivered to
              each subscription&rsquo;s HTTPS endpoint with HMAC-SHA256 signatures.
            </p>
          </div>
          <Link
            href="/llms.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-full border border-zk-border bg-zk-surface px-4 text-sm font-semibold text-zk-text"
          >
            Webhook docs
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </Link>
        </div>
      </div>
      <WebhookManagement />
    </div>
  );
}
