"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export interface IssuesSidebarProps {
  counts: {
    all: number;
    mine: number;
    assigned: number;
    created: number;
    saved: number;
    categories: Record<string, number>;
    platforms: Record<string, number>;
  };
  tagTypes?: { id: string; name: string }[];
  platforms?: { id: string; name: string }[];
}

export function IssuesSidebar({
  counts,
  tagTypes = [],
  platforms = [],
}: IssuesSidebarProps) {
  const searchParams = useSearchParams();
  const currentMine = searchParams.get("mine") ?? "";
  const currentTags = searchParams.get("tags") ?? "";
  const currentPlatform = searchParams.get("platform") ?? "";

  function makeHref(paramKey: string, paramValue: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (paramValue) {
      next.set(paramKey, paramValue);
    } else {
      next.delete(paramKey);
    }
    // Reset page on filter switch
    next.delete("page");
    const qs = next.toString();
    return qs ? `/issues?${qs}` : "/issues";
  }

  // Predefined category styling
  const categoryColors: Record<string, string> = {
    Features: "bg-emerald-500",
    Fixes: "bg-red-500",
    Design: "bg-purple-500",
    Marketing: "bg-amber-500",
    Documentation: "bg-sky-500",
    Other: "bg-slate-500",
  };

  const defaultCategories = [
    "Features",
    "Fixes",
    "Design",
    "Marketing",
    "Documentation",
    "Other",
  ];

  // Merge default categories with any dynamic ones from tagTypes
  const allCategoryNames = Array.from(
    new Set([...defaultCategories, ...tagTypes.map((t) => t.name)]),
  );

  const defaultPlatforms = ["Web", "Mobile", "Desktop", "API/Backend"];
  const allPlatformNames = Array.from(
    new Set([...defaultPlatforms, ...platforms.map((p) => p.name)]),
  );

  const views = [
    {
      id: "all",
      label: "All issues",
      mineKey: "",
      count: counts.all,
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      id: "mine",
      label: "My issues",
      mineKey: "mine",
      count: counts.mine,
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      id: "assigned",
      label: "Assigned to me",
      mineKey: "assigned",
      count: counts.assigned,
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      id: "created",
      label: "Created by me",
      mineKey: "created",
      count: counts.created,
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
    },
    {
      id: "saved",
      label: "Saved",
      mineKey: "watching",
      count: counts.saved,
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Issues Navigation"
      className="w-full space-y-6 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
    >
      {/* 1. Main Navigation Views */}
      <div className="space-y-1">
        {views.map((v) => {
          const isActive =
            v.mineKey === ""
              ? currentMine === "" && currentTags === "" && currentPlatform === ""
              : currentMine === v.mineKey;

          return (
            <Link
              key={v.id}
              href={makeHref("mine", v.mineKey)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span
                className={`shrink-0 ${
                  isActive ? "text-blue-600" : "text-slate-400"
                }`}
              >
                {v.icon}
              </span>
              <span className="truncate">{v.label}</span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  isActive
                    ? "bg-blue-100 text-blue-800"
                    : "text-slate-400"
                }`}
              >
                {v.count}
              </span>
            </Link>
          );
        })}
      </div>

      <hr className="border-slate-100" />

      {/* 2. Categories Section */}
      <div className="space-y-1">
        <div className="px-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Categories
        </div>

        {/* All Categories Option */}
        <Link
          href={makeHref("tags", "")}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            currentTags === ""
              ? "text-slate-900 font-semibold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
          <span className="truncate">All categories</span>
          <span className="ml-auto text-xs text-slate-400 tabular-nums">
            {counts.all}
          </span>
        </Link>

        {allCategoryNames.map((name) => {
          const isCategoryActive =
            currentTags.toLowerCase() === name.toLowerCase();
          const dotColor = categoryColors[name] ?? "bg-slate-400";
          const catCount = counts.categories[name] ?? 0;

          return (
            <Link
              key={name}
              href={makeHref("tags", name)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isCategoryActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />
              <span className="truncate">{name}</span>
              <span className="ml-auto text-xs text-slate-400 tabular-nums">
                {catCount}
              </span>
            </Link>
          );
        })}
      </div>

      <hr className="border-slate-100" />

      {/* 3. Platforms Section */}
      <div className="space-y-1">
        <div className="px-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Platforms
        </div>

        {/* All Platforms Option */}
        <Link
          href={makeHref("platform", "")}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            currentPlatform === ""
              ? "text-slate-900 font-semibold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <svg
            className="h-4 w-4 text-slate-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="truncate">All platforms</span>
          <span className="ml-auto text-xs text-slate-400 tabular-nums">
            {counts.all}
          </span>
        </Link>

        {allPlatformNames.map((platformName) => {
          const matchingPlatform = platforms.find(
            (p) =>
              p.name.toLowerCase() === platformName.toLowerCase() ||
              p.id === platformName,
          );
          const platformTarget = matchingPlatform
            ? matchingPlatform.id
            : platformName;
          const isPlatformActive =
            currentPlatform === platformTarget ||
            (matchingPlatform && currentPlatform === matchingPlatform.id) ||
            currentPlatform.toLowerCase() === platformName.toLowerCase();
          const platCount =
            (matchingPlatform
              ? counts.platforms[matchingPlatform.id]
              : undefined) ??
            counts.platforms[platformName] ??
            0;

          return (
            <Link
              key={platformName}
              href={makeHref("platform", platformTarget)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isPlatformActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {platformName === "Web" ? (
                <svg
                  className="h-4 w-4 text-slate-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              ) : platformName === "Mobile" ? (
                <svg
                  className="h-4 w-4 text-slate-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              ) : platformName === "Desktop" ? (
                <svg
                  className="h-4 w-4 text-slate-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-slate-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
              )}
              <span className="truncate">{platformName}</span>
              <span className="ml-auto text-xs text-slate-400 tabular-nums">
                {platCount}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
