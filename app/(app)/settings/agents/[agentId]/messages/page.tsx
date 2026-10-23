import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { isAgentPlatformEnabled } from "@/lib/feature-flags";
import { AGENT_INSTRUCTIONS_MAX, AGENT_MESSAGE_MAX, listAgentThread } from "@/lib/agent-messages";
import { LocalTime } from "@/components/local-time";
import { InstructionsForm, SendMessageForm } from "./message-forms";
import { agentsLink, agentsMutedClass, agentsSurface } from "../../agents-ui";

export const metadata = { title: "Agent messages" };

export default async function AgentMessagesPage({ params }: { params: Promise<{ agentId: string }> }) {
  if (!isAgentPlatformEnabled()) notFound();
  const user = await requireUser();
  const { agentId } = await params;
  const thread = await listAgentThread(user, agentId);
  if (!thread) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/settings/agents" className={`text-sm ${agentsLink}`}>
          ← Back to agents
        </Link>
        <h1 className="break-words text-3xl font-extrabold tracking-tight text-zk-text">
          {thread.agent.name}
        </h1>
        <p className={agentsMutedClass}>
          Messages reach the agent through its inbox.{" "}
          {thread.isOwner
            ? "Its questions to you appear here too."
            : "Questions it asks go to its owner and aren't shown here."}
        </p>
      </div>

      {thread.isOwner && !thread.agent.revoked ? (
        <section className={`${agentsSurface} p-4 sm:p-6`} aria-labelledby="instructions-heading">
          <h2 id="instructions-heading" className="text-sm font-bold uppercase tracking-[0.06em] text-zk-muted">
            Instructions
          </h2>
          <p className={`mt-2 ${agentsMutedClass}`}>
            A standing brief the agent reads from <code className="font-mono text-xs">GET /api/v1/agents/me</code>.
          </p>
          <div className="mt-3">
            <InstructionsForm
              agentId={thread.agent.id}
              instructions={thread.instructions}
              maxLength={AGENT_INSTRUCTIONS_MAX}
            />
          </div>
        </section>
      ) : null}

      <section className={`${agentsSurface} p-4 sm:p-6`} aria-labelledby="thread-heading">
        <h2 id="thread-heading" className="text-sm font-bold uppercase tracking-[0.06em] text-zk-muted">
          Conversation
        </h2>
        {thread.entries.length === 0 ? (
          <p className={`mt-3 ${agentsMutedClass}`}>Nothing yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {thread.entries.map((entry) =>
              entry.kind === "question" ? (
                <li key={`question-${entry.id}`} className="rounded-[16px] border border-zk-border bg-zk-chip/40 p-4">
                  <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-zk-muted">
                    <span>
                      <span className="font-semibold text-zk-text">{thread.agent.name}</span> asked
                      {entry.bug ? (
                        <>
                          {" "}about{" "}
                          <Link href={`/issues/${entry.bug.id}`} className={agentsLink}>
                            {entry.bug.title}
                          </Link>
                        </>
                      ) : null}
                    </span>
                    <LocalTime date={entry.createdAt} />
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zk-text">{entry.body}</p>
                  {entry.answeredAt ? (
                    <div className="mt-2 border-t border-zk-divider pt-2">
                      <p className="text-xs text-zk-muted">
                        You answered <LocalTime date={entry.answeredAt} />
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zk-text">{entry.answer}</p>
                    </div>
                  ) : (
                    <Link href={`/escalations/${entry.id}`} className={`mt-2 inline-block text-sm ${agentsLink}`}>
                      Answer →
                    </Link>
                  )}
                </li>
              ) : (
                <li key={`message-${entry.id}`} className="rounded-[16px] border border-zk-border bg-zk-tint/70 p-4 sm:ml-8">
                  <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-zk-muted">
                    <span>
                      <span className="font-semibold text-zk-text">
                        {entry.from.id === user.id ? "You" : entry.from.name}
                      </span>{" "}
                      wrote{entry.readAt ? " · read" : ""}
                    </span>
                    <LocalTime date={entry.createdAt} />
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zk-text">{entry.body}</p>
                </li>
              ),
            )}
          </ol>
        )}
        {thread.agent.revoked ? (
          <p className={`mt-4 ${agentsMutedClass}`}>This agent is revoked, so it can&apos;t receive messages.</p>
        ) : (
          <div className="mt-4 border-t border-zk-divider pt-4">
            <SendMessageForm agentId={thread.agent.id} maxLength={AGENT_MESSAGE_MAX} />
          </div>
        )}
      </section>
    </div>
  );
}
