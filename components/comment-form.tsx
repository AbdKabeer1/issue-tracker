"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions/issues";
import { openDisputeAction } from "@/app/(app)/points/disputes/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { MentionText } from "@/components/comment-body";
import { AttachmentPicker } from "@/components/attachment-picker";
import { clearDraft, discardLegacyDraft, draftKey, readDraft, writeDraft } from "@/lib/comment-draft";
import { useToast } from "@/components/ui/toast";
import type { CommentType } from "@/lib/validations/issue";

type UserOption = { id: string; name: string };

/** An award the viewer may dispute on this issue: "reporter" for its reporter, "solver" for its assignee. */
export type DisputeRole = "solver" | "reporter";

/** Comment types, plus "dispute": a points dispute filed from the same form (reviewed by admins, not posted). */
type FormType = CommentType | "dispute";

type CommentFormProps = {
  bugId: string;
  users: UserOption[];
  /** The signed-in viewer, so drafts never cross accounts (#481). */
  viewerId?: string | null;
  parentId?: string;
  parentAuthorName?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
  /** The issue number, for disputes. */
  bugNumber?: number;
  /** Awards the viewer may dispute; empty or missing hides the "Dispute award" type. */
  disputeRoles?: DisputeRole[];
};

export function CommentForm({
  bugId,
  users,
  viewerId,
  parentId,
  parentAuthorName,
  onCancel,
  onSuccess,
  bugNumber,
  disputeRoles = [],
}: CommentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [body, setBody] = useState("");
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remounts the file picker after a successful post, clearing it (#215).
  const [pickerKey, setPickerKey] = useState(0);
  const toast = useToast();
  const [commentType, setCommentType] = useState<FormType>("comment");
  const isDispute = commentType === "dispute";
  const canDispute = !parentId && bugNumber !== undefined && disputeRoles.length > 0;
  const [statusMessage, setStatusMessage] = useState("");
  const [isSettling, setIsSettling] = useState(false);
  const [pending, startTransition] = useTransition();
  const isReply = Boolean(parentId);
  const key = draftKey(viewerId, bugId, parentId);
  const bodyId = parentId ? `body-${parentId}` : "body";
  const errorId = `${bodyId}-error`;
  const [bodyInvalid, setBodyInvalid] = useState(false);
  const [editorUploading, setEditorUploading] = useState(false);
  const [pickerUploading, setPickerUploading] = useState(false);
  const isUploading = editorUploading || pickerUploading;

  // localStorage only exists on the client, so this cannot be a state
  // initializer without the server and client rendering different markup,
  // and setting state during the effect would be the cascading render the
  // lint rule warns about. A microtask after mount is the first safe moment.
  useEffect(() => {
    // Drafts saved before #481 have no viewer in the key. They cannot be
    // attributed, so drop them here instead of handing them to whoever is
    // signed in now.
    discardLegacyDraft(localStorage, bugId, parentId);
    const saved = readDraft(localStorage, key);
    if (!saved) return;
    queueMicrotask(() => {
      // Don't stamp over anything typed in the moment before this ran.
      setBody((current) => (current ? current : saved));
      setRestored(true);
    });
  }, [bugId, key, parentId]);

  const update = useCallback(
    (next: string) => {
      setBody(next);
      setRestored(false);
      setStatusMessage("");
      writeDraft(localStorage, key, next);
    },
    [key],
  );

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(event) => {
        if (pending || isSettling || isUploading) {
          event.preventDefault();
        }
      }}
      action={(formData) => {
        if (pending || isSettling || isUploading) return;
        setError(null);
        setBodyInvalid(false);
        setStatusMessage("");
        setIsSettling(true);
        startTransition(async () => {
          try {
            if (isDispute) {
              const dispute = new FormData();
              dispute.set("bugNumber", String(bugNumber));
              dispute.set("kind", "missing");
              dispute.set("role", String(formData.get("disputeRole") ?? disputeRoles[0]));
              dispute.set("reason", body);
              const result = await openDisputeAction(undefined, dispute);
              if (!result.ok) {
                setError(result.error);
                if (result.field === "reason") {
                  setBodyInvalid(true);
                  document.getElementById(bodyId)?.focus();
                }
                return;
              }
              setBody("");
              setRestored(false);
              clearDraft(localStorage, key);
              setCommentType("comment");
              setStatusMessage(result.message);
              toast(result.message);
              onSuccess?.();
              return;
            }
            const result = await addCommentAction(bugId, formData);
            if (result.error) {
              setError(result.error);
              // The only field is the body, so a field error is about it (#309).
              if (result.field) {
                setBodyInvalid(true);
                document.getElementById(bodyId)?.focus();
              }
            } else {
              setBody("");
              setRestored(false);
              clearDraft(localStorage, key);
              formRef.current?.reset();
              setPickerKey((k) => k + 1);
              const message = isReply ? "Reply posted." : "Comment posted.";
              setStatusMessage(message);
              toast(message);

              if (result.commentId && typeof window !== "undefined") {
                const targetId = `comment-${result.commentId}`;
                window.history.replaceState(null, "", `#${targetId}`);
                const scrollToComment = (attempts = 0) => {
                  const el = document.getElementById(targetId);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    const article = el.querySelector("article");
                    if (article) {
                      article.classList.add("ring-2", "ring-teal-500", "ring-offset-2");
                      setTimeout(() => {
                        article.classList.remove("ring-2", "ring-teal-500", "ring-offset-2");
                      }, 2000);
                    }
                    const focusTarget =
                      el.querySelector<HTMLElement>("a[href^='#comment-']") ?? el;
                    if (!focusTarget.hasAttribute("tabindex") && focusTarget === el) {
                      focusTarget.setAttribute("tabindex", "-1");
                    }
                    focusTarget.focus();
                  } else if (attempts < 5) {
                    setTimeout(() => scrollToComment(attempts + 1), 100);
                  }
                };
                requestAnimationFrame(() => scrollToComment(0));
              }

              onSuccess?.();
            }
          } finally {
            setIsSettling(false);
          }
        });
      }}
    >
      {parentId ? (
        <input type="hidden" name="parentId" value={parentId} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-[15px] font-bold text-zk-text">Add to conversation</span>
          <label htmlFor="comment-type-select" className="inline-flex items-center gap-2 text-[13px] font-semibold text-zk-muted">
            Type
            <select
              id="comment-type-select"
              name="type"
              value={commentType}
              onChange={(e) => setCommentType(e.target.value as FormType)}
              className="h-[38px] rounded-full border border-zk-border bg-zk-surface px-3 text-[13px] font-bold text-zk-text shadow-xs focus:border-electric-blue-strong focus:outline-none focus:ring-1 focus:ring-electric-blue-strong"
            >
              <option value="comment">Comment</option>
              <option value="bid">Bid</option>
              <option value="review">Review</option>
              <option value="delivery">Delivery</option>
              <option value="request_to_merge">Merge request</option>
              {canDispute ? <option value="dispute">Dispute award</option> : null}
            </select>
          </label>
        </div>
      )}
      {isDispute ? (
        <div className="flex flex-col gap-2 rounded-xl border border-zk-warn-bd bg-zk-warn-bg px-3 py-2.5 text-[13px] text-zk-warn-fg">
          <p>
            Say your points award for this issue is missing. A workspace admin reviews it; it isn&apos;t posted to
            the conversation. For a wrong points entry, use the{" "}
            <Link href={`/points/disputes/new?bug=${bugNumber}`} className="font-bold underline">
              disputes page
            </Link>
            .
          </p>
          {disputeRoles.length > 1 ? (
            <label className="inline-flex items-center gap-2 font-semibold">
              Missing award
              <select
                name="disputeRole"
                defaultValue={disputeRoles[0]}
                className="h-8 rounded-lg border border-zk-border bg-zk-surface px-2 text-[13px] text-zk-text"
              >
                {disputeRoles.map((role) => (
                  <option key={role} value={role}>
                    {role === "solver" ? "Solver award" : "Reporter award"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="disputeRole" value={disputeRoles[0]} />
          )}
        </div>
      ) : null}
      <label
        id={`${parentId ? `body-${parentId}` : "body"}-label`}
        htmlFor={parentId ? `body-${parentId}` : "body"}
        className={isReply ? "block text-sm font-medium text-zk-text2" : "sr-only"}
      >
        {isReply
          ? `Reply to ${parentAuthorName ?? "comment"}`
          : "Add to conversation"}
      </label>
      <MarkdownEditor
        ref={editorRef}
        id={parentId ? `body-${parentId}` : "body"}
        labelId={`${parentId ? `body-${parentId}` : "body"}-label`}
        name="body"
        required
        rows={isReply ? 3 : 4}
        maxLength={isDispute ? 1000 : 2000}
        disabled={pending}
        value={body}
        onChange={update}
        {...(bodyInvalid ? { "aria-invalid": true, "aria-describedby": errorId } : {})}
        users={users}
        renderMentions={(text) => <MentionText text={text} users={users} />}
        onUploadingChange={setEditorUploading}
        placeholder={
          isReply
            ? "Write your reply… Type @ to mention someone (they get notified)"
            : isDispute
              ? "What's missing? e.g. I resolved this on Tuesday but no solver points appeared."
              : "Add to the conversation… Type @ to mention someone (they get notified)"
        }
        footer={
          isDispute ? undefined : (
            <p className="text-xs text-zk-muted">
              Markdown is supported. People you @mention get an email and an
              in-app notification (they can turn these off in Settings).
            </p>
          )
        }
      />
      {isDispute ? null : (
        <AttachmentPicker
          key={pickerKey}
          disabled={pending}
          onUploadingChange={setPickerUploading}
        />
      )}
      {error ? (
        <p id={errorId} className="text-sm text-zk-bad-fg" role="alert">
          {error}
        </p>
      ) : null}
      {restored ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-zk-text2" role="status">
          <span>Restored an unsent draft.</span>
          <button
            type="button"
            className="rounded-sm font-bold text-zk-accent underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong"
            onClick={() => update("")}
          >
            Discard it
          </button>
        </p>
      ) : null}
      {statusMessage ? (
        <p role="status" aria-live="polite" className="text-xs font-medium text-zk-ok-fg">
          {statusMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || isSettling || !body.trim() || isUploading} className="h-11 rounded-full px-[22px] shadow-[0_8px_20px_rgba(46,111,239,0.30)]">
          {pending || isSettling
            ? isReply
              ? "Replying…"
              : "Posting…"
            : isUploading
              ? "Uploading…"
              : isReply
                ? "Post reply"
                : isDispute
                  ? "Open dispute"
                  : "Post to conversation"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending || isSettling}
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