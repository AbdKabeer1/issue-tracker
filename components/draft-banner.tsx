"use client";

export function DraftBanner({
  onDiscard,
  message = "Draft restored from earlier",
}: {
  onDiscard: () => void;
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-800"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDiscard}
        className="font-medium underline hover:text-teal-950 focus:outline-hidden cursor-pointer"
      >
        Discard
      </button>
    </div>
  );
}
