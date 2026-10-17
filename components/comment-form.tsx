"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { MentionText } from "@/components/comment-body";
import { AttachmentPicker } from "@/components/attachment-picker";
import { clearDraft, draftKey, readDraft, writeDraft } from "@/lib/comment-draft";

type UserOption = { id: string; name: string };

type CommentFormProps = {
  bugId: string;
  users: UserOption[];
  parentId?: string;
  parentAuthorName?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function CommentForm({
  bugId,
  users,
  parentId,
  parentAuthorName,
  onCancel,
  onSuccess,
}: CommentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [body, setBody] = useState("");
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remounts the file picker after a successful post, clearing it (#215).
  const [pickerKey, setPickerKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const isReply = Boolean(parentId);
  const key = draftKey(bugId, parentId);

  // localStorage only exists on the client, so this cannot be a state
  // initializer without the server and client rendering different markup,
  // and setting state during the effect would be the cascading render the
  // lint rule warns about. A microtask after mount is the first safe moment.
  useEffect(() => {
    const saved = readDraft(localStorage, key);
    if (!saved) return;
    queueMicrotask(() => {
      // Don't stamp over anything typed in the moment before this ran.
      setBody((current) => (current ? current : saved));
      setRestored(true);
    });
  }, [key]);

  const update = useCallback(
    (next: string) => {
      setBody(next);
      setRestored(false);
      writeDraft(localStorage, key, next);
    },
    [key],
  );

  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await addCommentAction(bugId, formData);
          if (result.error) {
            setError(result.error);
          } else {
            setBody("");
            setRestored(false);
            clearDraft(localStorage, key);
            formRef.current?.reset();
            setPickerKey((k) => k + 1);
            onSuccess?.();
          }
        });
      }}
    >
      {parentId ? (
        <input type="hidden" name="parentId" value={parentId} />
      ) : null}
      <label
        id={`${parentId ? `body-${parentId}` : "body"}-label`}
        htmlFor={parentId ? `body-${parentId}` : "body"}
        className="block text-sm font-medium text-slate-700"
      >
        {isReply
          ? `Reply to ${parentAuthorName ?? "comment"}`
          : "Add a comment"}
      </label>
      <MarkdownEditor
        ref={editorRef}
        id={parentId ? `body-${parentId}` : "body"}
        labelId={`${parentId ? `body-${parentId}` : "body"}-label`}
        name="body"
        required
        rows={isReply ? 3 : 4}
        maxLength={2000}
        value={body}
        onChange={update}
        users={users}
        renderMentions={(text) => <MentionText text={text} users={users} />}
        placeholder={
          isReply
            ? "Write your reply… Type @ to mention someone"
            : "Share triage notes… Type @ to mention someone"
        }
        footer={
          !isReply ? (
            <p className="text-xs text-slate-500">
              Markdown is supported. People you @mention get an email (they
              can turn these off in Settings).
            </p>
          ) : null
        }
      />
      <AttachmentPicker key={pickerKey} disabled={pending} />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {restored ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600" role="status">
          <span>Restored an unsent draft.</span>
          <button
            type="button"
            className="rounded-sm font-medium text-teal-700 underline hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            onClick={() => update("")}
          >
            Discard it
          </button>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending
            ? isReply
              ? "Replying…"
              : "Posting…"
            : isReply
              ? "Post reply"
              : "Post comment"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onCancel}
            // The draft stays saved: cancelling a reply is usually "not now",
            // and re-opening it restores what was typed.
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}