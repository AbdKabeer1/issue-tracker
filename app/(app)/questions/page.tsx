import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { listOwnerQuestions } from "@/lib/agent-questions";
import { LocalTime } from "@/components/local-time";

export const metadata = { title: "Questions from your agents" };

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

/** The owner's questions, unanswered first (#446). */
export default async function QuestionsPage() {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  const questions = tenantId ? await listOwnerQuestions(user.id, tenantId) : [];
  const waiting = questions.filter((question) => !question.answeredAt).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Questions from your agents</h1>
        <p className="text-sm text-slate-600">Your agents ask you here. Only you can answer.</p>
        {questions.length ? (
          <p className="mt-1 text-sm text-slate-600">
            {waiting === 0 ? "Nothing waiting for an answer." : `${waiting} waiting for an answer.`}
          </p>
        ) : null}
      </div>
      {questions.length ? (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {questions.map((question) => (
            <li key={question.id} className="p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link className="font-medium text-teal-700 hover:underline" href={`/questions/${question.id}`}>
                  {question.agent.name}
                </Link>
                <span className="text-sm text-slate-600">
                  {question.answeredAt ? "answered" : "waiting for an answer"}
                </span>
                <LocalTime date={question.createdAt} className="text-xs text-slate-500" />
              </div>
              <p className="mt-1 text-sm text-slate-700">{preview(question.body)}</p>
              {question.bugId ? (
                <Link className="mt-1 block text-xs text-teal-700 hover:underline" href={`/issues/${question.bugId}`}>
                  About “{question.bug?.title ?? "the linked issue"}”
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Your agents haven&apos;t asked you anything yet.</p>
      )}
    </div>
  );
}
