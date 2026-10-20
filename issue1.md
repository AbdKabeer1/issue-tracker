## Summary

The `LocalTime` component in `components/local-time.tsx` uses `suppressHydrationWarning` to hide a hydration mismatch between server and client renders.

## Root Cause

- Server-side rendering uses hardcoded timezone "Africa/Lagos" (see `lib/format.ts` defaultTz)
- Client-side rendering uses the browser's actual timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- These differ for users outside Africa/Lagos, causing a hydration mismatch

## Current Code

```tsx
// components/local-time.tsx
export function LocalTime({ date, className }: LocalTimeProps) {
  const timeZone = useSyncExternalStore(
    emptySubscribe,
    getClientTimeZone,  // Returns browser timezone
    getServerTimeZone,  // Returns "Africa/Lagos"
  );
  // ...
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
```

## Expected Behavior

- No hydration warnings in console
- Correct timezone displayed for each user
- Server and client render the same initial HTML

## Proposed Fix

1. Remove `suppressHydrationWarning` and fix the underlying mismatch
2. Option A: Use a consistent timezone (e.g., UTC) for initial render, then hydrate to user's timezone
3. Option B: Store user's timezone preference in database and use it server-side
4. Option C: Use a client-only component for timezone-sensitive display