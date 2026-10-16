import type { ReactNode, SVGProps } from "react";

/**
 * Editor toolbar icons, sized to GitHub's 16px toolbar. Paths are drawn from
 * simple geometry so they stay crisp at small sizes and inherit `currentColor`.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

function Stroke({ children }: { children: ReactNode }) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

export function BoldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Bold B: enlarged and vertically centered in the 16px icon frame. */}
      <g transform="translate(0 0.2) scale(1 1.3)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M4 2h4.1c1.4 0 2.4.8 2.4 2 0 .7-.3 1.3-.9 1.6.8.3 1.3 1 1.3 1.9 0 1.5-1.1 2.5-2.8 2.5H4V2Zm2.4 3.6h1.2c.5 0 .8-.3.8-.8s-.3-.8-.8-.8H6.4v1.6Zm0 3.7h1.4c.6 0 1-.4 1-1.1 0-.7-.4-1.1-1-1.1H6.4v2.2Z"
        />
      </g>
    </Icon>
  );
}

export function ItalicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fill="currentColor"
        d="M6.6 2.5h4.9v1.6h-1.5L7.6 11.9h1.5v1.6H4.2v-1.6h1.5l2.4-7.8H6.6V2.5Z"
      />
    </Icon>
  );
}

export function StrikethroughIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <text
        x="8"
        y="12"
        fill="currentColor"
        fontSize="12"
        fontWeight="600"
        textAnchor="middle"
      >
        S
      </text>
      <path
        d="M2.5 8h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function HeadingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fill="currentColor"
        d="M1.5 3h2v3.6h3.4V3h2v10h-2V8.5H3.5V13h-2V3Zm9.2 0h1.5l2 2.7V3h1.7v10h-1.5l-2-2.7V13h-1.7V3Z"
      />
    </Icon>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fill="currentColor"
        d="M6.4 3.6C4.4 4.3 3 5.9 3 8v4.4h4.6V7.5H5.3c.1-1.2.7-2 1.8-2.5l-.7-1.4Zm6.6 0c-2 .7-3.4 2.3-3.4 4.4v4.4h4.6V7.5H12c.1-1.2.7-2 1.8-2.5l-.8-1.4Z"
      />
    </Icon>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <polyline points="6 4.4 2.9 8 6 11.6" />
        <polyline points="10 4.4 13.1 8 10 11.6" />
      </Stroke>
    </Icon>
  );
}

export function CodeBlockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <rect x="1.7" y="2.2" width="12.6" height="11.6" rx="1.6" />
        <polyline points="6.2 6.4 4.4 8 6.2 9.6" />
        <polyline points="9.8 6.4 11.6 8 9.8 9.6" />
      </Stroke>
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <rect x="1.9" y="5.9" width="7" height="4.2" rx="2.1" />
        <rect x="7.1" y="5.9" width="7" height="4.2" rx="2.1" />
        <path d="M6.2 8h3.6" />
      </Stroke>
    </Icon>
  );
}

export function BulletedListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <path d="M6 4.2h8.3M6 8h8.3M6 11.8h8.3" />
      </Stroke>
      <g fill="currentColor">
        <circle cx="3.1" cy="4.2" r="1.1" />
        <circle cx="3.1" cy="8" r="1.1" />
        <circle cx="3.1" cy="11.8" r="1.1" />
      </g>
    </Icon>
  );
}

export function NumberedListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <path d="M6.4 4.2h8M6.4 8h8M6.4 11.8h8" />
        <path d="M1.2 2.9 2.3 2.5v3.6" />
        <path d="M1 5.4c.2-.6.6-.9 1.2-.9s1.1.4 1.1 1c0 .8-.7 1.3-1.6 1.9H3.3" />
        <path d="M1.1 11.1c.1-.5.5-.8 1-.8.6 0 1 .3 1 .8s-.3.7-.7.9c.5.1.8.5.8 1 0 .6-.5 1-1.2 1-.6 0-1-.3-1.1-.8" />
      </Stroke>
    </Icon>
  );
}

export function TaskListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <rect x="1.6" y="2.4" width="3" height="3" rx="0.6" />
        <path d="M2.1 3.9 2.7 4.5l1.5-1.7" />
        <rect x="1.6" y="10.6" width="3" height="3" rx="0.6" />
        <path d="M6.6 3.9h8M6.6 8h8M6.6 12.1h8" />
      </Stroke>
    </Icon>
  );
}

export function MentionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <path d="M11.2 12.2a5.6 5.6 0 1 1 1.9-2.1" />
        <circle cx="7" cy="8.2" r="2.3" />
        <path d="M9.3 5.9v4.6c0 .6.3.9.8.9" />
      </Stroke>
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 3.2c3.1 0 5.6 2.2 6.8 4.8-1.2 2.6-3.7 4.8-6.8 4.8S2.4 10.6 1.2 8C2.4 5.4 4.9 3.2 8 3.2Zm0 1.5c-2 0-3.7 1.5-4.6 3.3C4.3 9.8 6 11.3 8 11.3s3.7-1.5 4.6-3.3C11.7 6.2 10 4.7 8 4.7Zm0 1.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z"
      />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Stroke>
        <polyline points="4 6.4 8 10.2 12 6.4" />
      </Stroke>
    </Icon>
  );
}
