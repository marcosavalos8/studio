# Date Timezone Fix Explanation

## Problem
Dates in the payroll and invoicing reports were displaying as one day earlier than expected. For example, if an employee clocked in on October 22nd, the payroll report showed October 21st.

## Root Cause
When a date string like "2025-10-22" is parsed using `new Date("2025-10-22")`, JavaScript interprets it as UTC midnight (00:00 UTC). In timezones west of UTC (like Pacific Time, which is UTC-7 or UTC-8), this UTC midnight gets converted to the previous day's evening time.

For example:
- Date string: `"2025-10-22"` 
- Parsed by `new Date()`: `2025-10-22T00:00:00Z` (UTC)
- In Pacific Time (UTC-8): `2025-10-21T16:00:00` (4pm on Oct 21)
- When formatted: Shows as **October 21** ❌

## Solution
Created utility functions in `/src/lib/utils.ts` to parse date strings as local timezone dates:

1. **`parseLocalDate(dateString: string)`** - For date-only strings (YYYY-MM-DD)
2. **`parseLocalDateOrDateTime(dateString: string)`** - For both date-only and datetime strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)

These functions explicitly construct Date objects in the local timezone by parsing the components:

```typescript
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}
```

Now:
- Date string: `"2025-10-22"`
- Parsed by `parseLocalDate()`: `2025-10-22T00:00:00` (Local Time)
- In Pacific Time: Stays as `2025-10-22T00:00:00`
- When formatted: Shows as **October 22** ✅

## Files Changed

### Core Utilities
- `/src/lib/utils.ts` - Added `parseLocalDate()` and `parseLocalDateOrDateTime()`

### Payroll Module
- `/src/app/(app)/payroll/report-display.tsx` - Updated date formatting to use `parseLocalDate()`
- `/src/ai/flows/generate-payroll-report.ts` - Replaced all `parseISO()` calls with `parseLocalDateOrDateTime()`

### Invoicing Module
- `/src/app/(app)/invoicing/report-display.tsx` - Updated date formatting to use `parseLocalDate()`

## Verification
To verify the fix works:

1. Create a time entry on October 22nd
2. Generate a payroll report for that period
3. The report should display October 22nd (not October 21st)

The fix ensures that all dates throughout the application are consistently interpreted in the local timezone, preventing the off-by-one day issue.
