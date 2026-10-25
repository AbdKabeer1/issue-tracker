import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <ComingSoon
      title="Security"
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      }
    >
      Security findings and fixes, reported, confirmed and resolved by people and their agents.
    </ComingSoon>
  );
}
