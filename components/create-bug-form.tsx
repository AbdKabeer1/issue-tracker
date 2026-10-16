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
import { MarkdownEditor } from "@/components/markdown-editor";

type UserOption = { id: string; name: string; role: AppRole };
type CategoryOption = { id: string; name: string };
type TypeOption = { id: string; name: string; description?: string | null };

export function CreateBugForm({
  users,
  categories = [],
  types = [],
  isAdmin,
}: {
  users: UserOption[];
  categories?: CategoryOption[];
  types?: TypeOption[];
  isAdmin: boolean;
}) {
  const defaultTypeId =
    types.find((t) => t.name.toLowerCase() === "fix")?.id ?? types[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState(defaultTypeId);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [proofLinks, setProofLinks] = useState("");
  const [severity, setSeverity] = useState<(typeof severities)[number]>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mentionUsers = users.map((user) => ({ id: user.id, name: user.name }));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData();
        formData.set("title", title);
        formData.set("typeId", typeId);
        formData.set("description", description);
        formData.set("categoryId", categoryId);
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
      <div className="grid gap-4 sm:grid-cols-2">
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
        {types.length > 0 ? (
          <div className="space-y-1.5">
            <label htmlFor="typeId" className="text-sm font-medium text-slate-700">
              Type
            </label>
            <Select
              id="typeId"
              name="typeId"
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="categoryId"
          className="text-sm font-medium text-slate-700"
        >
          Category
        </label>
        <Select
          id="categoryId"
          name="categoryId"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="text-sm font-medium text-slate-700"
        >
          Description
        </label>
        <MarkdownEditor
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="Steps to reproduce, expected vs actual, environment…"
          value={description}
          onChange={setDescription}
          users={mentionUsers}
          footer={
            <p className="text-xs text-slate-500">
              Markdown is supported. Be specific: what should happen, what
              actually happens, and how to reproduce it.
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
        {pending ? "Creating…" : "Create issue"}
      </Button>
    </form>
  );
}
