import type { ReactNode } from "react";
import { RichText } from "@/components/rich-text";
import { tokenizeMentions } from "@/lib/mentions";

function MentionSpans({ text }: { text: string }): ReactNode {
  const tokens = tokenizeMentions(text);

  return tokens.map((token, index) => {
    if (token.type === "text") {
      return <span key={`t-${index}`}>{token.value}</span>;
    }

    return (
      <span
        key={`m-${index}-${token.userId}`}
        title={token.name}
        data-user-id={token.userId}
        className="mx-0.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200"
      >
        @{token.name}
      </span>
    );
  });
}

export function CommentBody({ body }: { body: string }) {
  return (
    <RichText
      content={body}
      className="rich-text mt-2 space-y-2 text-sm text-slate-800 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      renderMentions={(text) => <MentionSpans text={text} />}
    />
  );
}
