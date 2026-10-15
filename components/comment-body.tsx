import { tokenizeMentions } from "@/lib/mentions";

export function CommentBody({ body }: { body: string }) {
  const tokens = tokenizeMentions(body);

  return (
    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
      {tokens.map((token, index) => {
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
      })}
    </p>
  );
}
