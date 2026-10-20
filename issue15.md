## Summary

The search functionality in the issues list uses `escapeSearchQuery` which escapes SQL LIKE wildcards, but the actual query uses Prisma's `contains` filter which doesn't use LIKE syntax directly.

## Current Code

```typescript
// lib/search.ts
export function escapeSearchQuery(query: string): string {
  return query.replace(/[\\%_]/g, "\\$&");
}

// app/(app)/issues/(list)/page.tsx, lines 207-217
if (qParam?.trim()) {
  const q = escapeSearchQuery(qParam.trim());
  where.OR = [
    { title: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
  ];
}
```

## Issue

- `escapeSearchQuery` escapes `%`, `_`, and `\` for SQL LIKE patterns
- But Prisma's `contains` filter translates to `ILIKE '%value%'` in PostgreSQL
- The escaping is unnecessary and may cause search issues for queries containing `%` or `_`
- The escape character `\` itself gets double-escaped

## Proposed Fix

1. Remove `escapeSearchQuery` since Prisma handles escaping internally for `contains`
2. Or verify if Prisma actually needs this escaping (it shouldn't for parameterized queries)