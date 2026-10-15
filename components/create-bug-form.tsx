"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { createBugAction, type ActionResult } from "@/app/actions/bugs";
import { severities } from "@/lib/validations/bug";
import { severityLabels } from "@/lib/labels";
import { formatUserLabel, type AppRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/rich-text-editor";

type UserOption = { id: string; name: string; role: AppRole };

export function CreateBugForm({
  users,
  isAdmin,
}: {
  users: UserOption[];
  isAdmin: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proofLinks, setProofLinks] = useState("");
  const [severity, setSeverity] = useState<(typeof severities)[number]>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData();
        formData.set("title", title);
        formData.set("description", description);
        formData.set("proofLinks", proofLinks);
        if (isAdmin) {
          formData.set("severity", severity);
          formData.set("assigneeId", assigneeId);
        }
        startTransition(async () => {
          try {
            const result: ActionResult = await createBugAction(formData);
            if (result.error) setError(result.error);
          } catch (error) {
            unstable_rethrow(error);
            setError("Something went wrong. Please try again.");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium text-slate-700">
          Title
        </label>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          placeholder="Short summary of the issue"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="text-sm font-medium text-slate-700"
        >
          Description
        </label>
        <RichTextEditor
          id="description"
          name="description"
          required
          minLength={10}
          rows={6}
          placeholder="Steps to reproduce, expected vs actual, environment…"
          value={description}
          onChange={setDescription}
          footer={
            <p className="text-xs text-slate-500">
              Markdown supported (bold, italic, lists, code, links). Be
              specific: what should happen, what actually happens, and how to
              reproduce it.
            </p>
          }
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="proofLinks"
          className="text-sm font-medium text-slate-700"
        >
          Proof links (screenshots / videos)
        </label>
        <Textarea
          id="proofLinks"
          name="proofLinks"
          rows={3}
          placeholder={
            "https://example.com/screenshot.png\nhttps://example.com/repro-video.mp4"
          }
          value={proofLinks}
          onChange={(event) => setProofLinks(event.target.value)}
        />
        <p className="text-xs text-slate-500">
          Optional. One http(s) URL per line (hosted screenshots or videos — not
          uploads). In the description above, say what to look for in each link,
          expected vs actual, and repro context so triage is fast.
        </p>
      </div>
      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="severity"
              className="text-sm font-medium text-slate-700"
            >
              Severity
            </label>
            <Select
              id="severity"
              name="severity"
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as (typeof severities)[number])
              }
            >
              {severities.map((value) => (
                <option key={value} value={value}>
                  {severityLabels[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="assigneeId"
              className="text-sm font-medium text-slate-700"
            >
              Assignee
            </label>
            <Select
              id="assigneeId"
              name="assigneeId"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUserLabel(user.name, user.role)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create bug"}
      </Button>
    </form>
  );
}
