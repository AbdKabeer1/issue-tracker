"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editProofLinksAction } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type EditableProofLinksProps = {
  bugId: string;
  initialLinks: string[];
  canEdit: boolean;
};

/** The issue's proof links, which the reporter or an admin can change after filing (#737). */
export function EditableProofLinks({ bugId, initialLinks, canEdit }: EditableProofLinksProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialLinks.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleStartEdit = () => {
    setValue(initialLinks.join("\n"));
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setValue(initialLinks.join("\n"));
    setError(null);
    setIsEditing(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);

    const formData = new FormData();
    formData.set("proofLinks", value);

    startTransition(async () => {
      const result = await editProofLinksAction(bugId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setIsEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Proof links
        </h2>
        {canEdit && !isEditing ? (
          <Button
            variant="ghost"
            className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
            onClick={handleStartEdit}
          >
            Edit
          </Button>
        ) : null}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          {error ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <label htmlFor="edit-proof-links" className="sr-only">
            Proof links (GitHub)
          </label>
          <Textarea
            id="edit-proof-links"
            name="proofLinks"
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            placeholder={
              "https://github.com/organization/repo/issues/123\nhttps://github.com/organization/repo/pull/456"
            }
          />
          <p className="text-xs text-slate-500">
            One GitHub link per line, at most 20. Leave empty to remove them all.
          </p>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </form>
      ) : initialLinks.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No proof links attached to this report.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {initialLinks.map((url, index) => (
            <li key={`${index}-${url}`}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-teal-700 hover:underline"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-slate-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>{url}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
