"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { severities, statuses } from "@/lib/validations/issue";
import { severityLabel, statusLabel } from "@/lib/labels";
import {
  BUG_SORT_OPTIONS,
  bugSortLabels,
  parseBugSort,
} from "@/lib/issues-sort";
import {
  TAGS_PARAM,
  parseTagFilter,
  serializeTags,
  suggestTags,
} from "@/lib/tag-filter";
import {
  MINE_FILTER_OPTIONS,
  mineFilterLabels,
  parseMineFilter,
  defaultSortFor,
} from "@/lib/mine-filter";
import {
  PLATFORM_NONE,
  PLATFORM_PARAM,
  parsePlatformFilter,
  platformChoices,
  type PlatformOption,
} from "@/lib/platform-filter";
import { MILESTONE_NONE, MILESTONE_PARAM } from "@/lib/milestones";

type TagType = { id: string; name: string; isActive?: boolean };

/** URL params owned by the filter bar. `page` is paging, not a filter. */
const FILTER_PARAMS = [
  "q",
  TAGS_PARAM,
  "mine",
  "status",
  "severity",
  PLATFORM_PARAM,
  "sort",
];

export function IssueFilters({
  tagTypes = [],
  platforms = [],
  milestones = [],
}: {
  tagTypes?: TagType[];
  platforms?: PlatformOption[];
  /** #289: open milestones first; closed ones stay selectable for history. */
  milestones?: { id: string; title: string; isClosed: boolean }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCmdOrCtrlK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlash =
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;

      if (!isCmdOrCtrlK && !isSlash) return;
      if (event.isComposing) return;

      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          Boolean(target.closest?.("[contenteditable='true']")));

      if (isSlash && isEditable) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function updateMany(changes: Record<string, string>) {
    // Nothing changed: don't navigate (and don't reset the page, #132).
    if (Object.entries(changes).every(([key, value]) => (params.get(key) ?? "") === value)) {
      return;
    }
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/issues?${qs}` : "/issues");
  }

  function update(key: string, value: string) {
    updateMany({ [key]: value });
  }

  // Tag (issue type) filter from the search box (#102).
  const selectedTags = parseTagFilter(params.get(TAGS_PARAM), tagTypes);
  const selectedNames = selectedTags.map((t) => t.name);
  const currentQuery = params.get("q") ?? "";
  const [text, setText] = useState(currentQuery);
  // Follow the URL when it changes from outside (Back, a link), adjusting
  // state during render rather than in an effect.
  const [lastQuery, setLastQuery] = useState(currentQuery);
  if (currentQuery !== lastQuery) {
    setLastQuery(currentQuery);
    setText(currentQuery);
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Only active types are suggested; inactive ones still work in a shared link.
  const suggestions = open
    ? suggestTags(tagTypes.filter((t) => t.isActive !== false), text, selectedNames)
    : [];

  function addTag(name: string) {
    // The typed text was only for finding the tag, so put the real search back.
    setText(currentQuery);
    setOpen(false);
    setActive(-1);
    updateMany({ [TAGS_PARAM]: serializeTags([...selectedNames, name]) });
  }

  function removeTag(name: string) {
    update(TAGS_PARAM, serializeTags(selectedNames.filter((n) => n !== name)));
  }

  /** Real link for each chip, so removing a tag also works before hydration. */
  function tagHref(name: string) {
    const next = new URLSearchParams(params.toString());
    const rest = serializeTags(selectedNames.filter((n) => n !== name));
    if (rest) next.set(TAGS_PARAM, rest);
    else next.delete(TAGS_PARAM);
    next.delete("page");
    const qs = next.toString();
    return qs ? `/issues?${qs}` : "/issues";
  }

  const currentSort = parseBugSort(
    params.get("sort"),
    defaultSortFor(parseMineFilter(params.get("mine"))),
  );
  const currentPlatform =
    parsePlatformFilter(params.get(PLATFORM_PARAM), platforms) ?? "";
  const platformOptions = platformChoices(platforms, currentPlatform || null);
  const currentMine = parseMineFilter(params.get("mine")) ?? "";

  // Only worth offering when there is something to clear (#336).
  const hasActiveFilters = FILTER_PARAMS.some((key) => (params.get(key) ?? "") !== "");

  function clearAllFilters() {
    // Empty the box straight away: until the navigation lands, the local draft
    // would otherwise keep showing the text that was just cleared.
    setText("");
    setOpen(false);
    setActive(-1);
    router.push("/bugs");
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end print:hidden">
      <div className="col-span-2 min-w-0 sm:min-w-[200px] sm:flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-600">
          Search
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="q"
            name="q"
            role="combobox"
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls={suggestions.length > 0 ? listId : undefined}
            aria-activedescendant={active >= 0 && suggestions[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={text}
            placeholder="Search, or type a tag like Design (/)"
            className="w-full rounded-lg border border-slate-300 pl-3 pr-8 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            onChange={(event) => {
              setText(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && suggestions.length > 0) {
                event.preventDefault();
                setActive((i) => (i + 1) % suggestions.length);
              } else if (event.key === "ArrowUp" && suggestions.length > 0) {
                event.preventDefault();
                setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
              } else if (event.key === "Escape") {
                setOpen(false);
                setActive(-1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const picked = active >= 0 ? suggestions[active] : undefined;
                if (picked) addTag(picked.name);
                else update("q", text.trim());
              } else if (event.key === "Backspace" && text === "" && selectedNames.length > 0) {
                removeTag(selectedNames[selectedNames.length - 1]);
              }
            }}
            onBlur={() => {
              setOpen(false);
              setActive(-1);
              update("q", text.trim());
            }}
          />
          {!text ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
              <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 select-none">
                /
              </kbd>
            </div>
          ) : null}
          {suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Filter by tag"
              className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
            >
              {suggestions.map((type, index) => (
                // Same combobox pattern as the assignee picker: the input owns
                // the keyboard handling via aria-activedescendant.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={type.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => addTag(type.name)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                    index === active ? "bg-teal-50 text-teal-900" : "text-slate-800"
                  }`}
                >
                  <span className="font-medium">{type.name}</span>
                  <span className="text-xs text-slate-500">Filter by tag</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {selectedTags.length > 0 ? (
          <ul className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Tag filters">
            {selectedTags.map((type) => (
              <li key={type.id}>
                <a
                  href={tagHref(type.name)}
                  onClick={(event) => {
                    event.preventDefault();
                    removeTag(type.name);
                  }}
                  aria-label={`Remove tag ${type.name}`}
                  className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-teal-900 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {type.name}
                  <span aria-hidden="true" className="text-teal-700">×</span>
                </a>
              </li>
            ))}
            {selectedTags.length > 1 ? (
              <li>
                <button
                  type="button"
                  onClick={() => update(TAGS_PARAM, "")}
                  className="px-1 text-xs text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Clear tags
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="mine"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Show
        </label>
        <select
          id="mine"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={currentMine}
          onChange={(event) => update("mine", event.target.value)}
        >
          <option value="">All issues</option>
          {MINE_FILTER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {mineFilterLabels[option]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="status"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Status
        </label>
        <select
          id="status"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={params.get("status") ?? ""}
          onChange={(event) => update("status", event.target.value)}
        >
          <option value="">All</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="severity"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Severity
        </label>
        <select
          id="severity"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={params.get("severity") ?? ""}
          onChange={(event) => update("severity", event.target.value)}
        >
          <option value="">All</option>
          {severities.map((severity) => (
            <option key={severity} value={severity}>
              {severityLabel[severity]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-auto">
        <label
          htmlFor="category"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Category
        </label>
        <select
          id="category"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={selectedNames[0] ?? ""}
          onChange={(event) => update(TAGS_PARAM, event.target.value)}
        >
          <option value="">All</option>
          {Array.from(
            new Set([
              "Features",
              "Fixes",
              "Design",
              "Marketing",
              "Documentation",
              "Other",
              ...tagTypes.filter((t) => t.isActive !== false).map((t) => t.name),
            ]),
          ).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {platformOptions.length > 0 ? (
        <div className="w-full sm:w-auto">
          <label
            htmlFor="platform"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Platform
          </label>
          <select
            id="platform"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
            value={currentPlatform}
            onChange={(event) => update(PLATFORM_PARAM, event.target.value)}
          >
            <option value="">All</option>
            {platformOptions.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
            {/* Unset is a real state, and the only way to find those issues. */}
            <option value={PLATFORM_NONE}>No platform</option>
          </select>
        </div>
      ) : null}
      {milestones.length > 0 ? (
        <div className="w-full sm:w-auto">
          <label htmlFor="milestone" className="mb-1 block text-xs font-medium text-slate-600">
            Milestone
          </label>
          <select
            id="milestone"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
            value={
              milestones.some((m) => m.id === params.get(MILESTONE_PARAM)) ||
              params.get(MILESTONE_PARAM) === MILESTONE_NONE
                ? (params.get(MILESTONE_PARAM) ?? "")
                : ""
            }
            onChange={(event) => update(MILESTONE_PARAM, event.target.value)}
          >
            <option value="">All</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
                {m.isClosed ? " (closed)" : ""}
              </option>
            ))}
            <option value={MILESTONE_NONE}>No milestone</option>
          </select>
        </div>
      ) : null}
      <div className="w-full sm:w-auto">
        <label
          htmlFor="sort"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Sort
        </label>
        <select
          id="sort"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto"
          value={currentSort}
          onChange={(event) => update("sort", event.target.value)}
        >
          {BUG_SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {bugSortLabels[option]}
            </option>
          ))}
        </select>
      </div>
      {hasActiveFilters ? (
        <div className="col-span-2 flex w-full flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-600">Active filters:</span>
          {currentQuery ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-teal-900">
              Search: &ldquo;{currentQuery}&rdquo;
              <button
                type="button"
                onClick={() => {
                  setText("");
                  update("q", "");
                }}
                aria-label="Remove search filter"
                className="ml-0.5 rounded-full p-0.5 text-teal-700 hover:bg-teal-200/60"
              >
                ✕
              </button>
            </span>
          ) : null}
          {params.get("status") ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-emerald-900">
              Status: {statusLabel[params.get("status") as keyof typeof statusLabel] ?? params.get("status")}
              <button
                type="button"
                onClick={() => update("status", "")}
                aria-label="Remove status filter"
                className="ml-0.5 rounded-full p-0.5 text-emerald-700 hover:bg-emerald-200/60"
              >
                ✕
              </button>
            </span>
          ) : null}
          {params.get("severity") ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-amber-900">
              Severity: {severityLabel[params.get("severity") as keyof typeof severityLabel] ?? params.get("severity")}
              <button
                type="button"
                onClick={() => update("severity", "")}
                aria-label="Remove severity filter"
                className="ml-0.5 rounded-full p-0.5 text-amber-700 hover:bg-amber-200/60"
              >
                ✕
              </button>
            </span>
          ) : null}
          {selectedTags.map((type) => (
            <span
              key={type.id}
              className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-purple-900"
            >
              Category: {type.name}
              <button
                type="button"
                onClick={() => removeTag(type.name)}
                aria-label={`Remove tag ${type.name}`}
                className="ml-0.5 rounded-full p-0.5 text-purple-700 hover:bg-purple-200/60"
              >
                ✕
              </button>
            </span>
          ))}
          {currentPlatform ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-sky-900">
              Platform: {platforms.find((p) => p.id === currentPlatform)?.name ?? currentPlatform}
              <button
                type="button"
                onClick={() => update(PLATFORM_PARAM, "")}
                aria-label="Remove platform filter"
                className="ml-0.5 rounded-full p-0.5 text-sky-700 hover:bg-sky-200/60"
              >
                ✕
              </button>
            </span>
          ) : null}
          {currentMine ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-slate-800">
              View: {mineFilterLabels[currentMine as keyof typeof mineFilterLabels] ?? currentMine}
              <button
                type="button"
                onClick={() => update("mine", "")}
                aria-label="Remove view filter"
                className="ml-0.5 rounded-full p-0.5 text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            Clear all filters
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { IssueFilters as BugFilters };
