import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { ownerQuestion } from "@/lib/agent-questions";
import { LocalTime } from "@/components/local-time";
import { AnswerForm } from "../answer-form";

export const metadata = { title: "Answer your agent" };

/** Only the owner may open this page; anyone else sees nothing (#446). */
export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) notFound();
  const { id } = await params;
  const question = await ownerQuestion(user.id, tenantId, id);
  if (!question) notFound();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/questions" className="text-sm text-teal-700 hover:underline">
        ← All questions
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{question.agent.name} has a question</h1>
        <LocalTime date={question.createdAt} className="text-xs text-slate-500" />
      </div>
      <p className="whitespace-pre-wrap rounded border border-slate-200 bg-white p-5">{question.body}</p>
      {question.bug ? (
        <Link href={`/issues/${question.bug.id}`} className="block text-sm text-teal-700 hover:underline">
          About “{question.bug.title}”
        </Link>
      ) : null}
      <div className="space-y-2 rounded border border-slate-200 bg-white p-5">
        <h2 id="your-answer-heading" className="font-medium">
          Your answer
        </h2>
        {question.answeredAt ? (
          <>
            <p className="whitespace-pre-wrap">{question.answer}</p>
            <LocalTime date={question.answeredAt} className="text-xs text-slate-500" />
          </>
        ) : (
          <AnswerForm questionId={question.id} labelledBy="your-answer-heading" />
        )}
      </div>
    </article>
  );
}
