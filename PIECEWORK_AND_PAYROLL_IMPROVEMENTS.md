# Piecework and Payroll Improvements

This document describes the improvements made to the piecework tracking and payroll calculation system.

## Changes Implemented

### 1. Filter Piecework Tasks in Piece-Work Tabs ✅

**Problem**: When entering the piece-work tab, all tasks (hourly and piecework) were shown, making it difficult to identify which tasks are for piecework.

**Solution**: 
- Modified `SelectionFields` component to accept a `filterPiecework` parameter
- When `filterPiecework={true}`, only tasks with `clientRateType === 'piece'` are shown
- Added visual indicators (emojis) to all task selections:
  - 📦 for Piecework tasks
  - ⏰ for Hourly tasks
- Applied the filter to both QR Scanner and Manual Entry tabs within the Piece-Work section

**Files Changed**:
- `src/app/(app)/time-tracking/page.tsx`

### 2. Individual Piecework Entry Timestamps ✅

**Problem**: The system was registering multiple pieces in a single record (e.g., 5 pieces at 12pm), making it difficult to track when each individual piece was completed.

**Solution**:
- Modified manual piecework entry to create individual records for each piece
- Each piece now has its own timestamp
- For multiple pieces entered manually, timestamps are incremented by 1 second to maintain order
- QR code scanning already created individual records (pieceCount = 1 per scan)
- Applied to both:
  - Manual Piecework Entry (piece-work tab)
  - QR Scanner Manual Count mode

**Example**:
- Before: 1 record → {pieceCount: 5, timestamp: 12:00pm}
- After: 5 records → 
  - {pieceCount: 1, timestamp: 12:00:00}
  - {pieceCount: 1, timestamp: 12:00:01}
  - {pieceCount: 1, timestamp: 12:00:02}
  - {pieceCount: 1, timestamp: 12:00:03}
  - {pieceCount: 1, timestamp: 12:00:04}

**Files Changed**:
- `src/app/(app)/time-tracking/page.tsx`

### 3. Auto Clock-Out on Task Switch ✅

**Problem**: When a worker had an active clock-in on a piecework task and tried to clock into an hourly task, they had to manually clock out first, losing valuable time.

**Solution**:
- Modified `clockInEmployee` function to automatically close any active time entries when clocking into a new task
- Added notification to user when previous tasks are automatically clocked out
- Works for any task switch (piecework to hourly, hourly to piecework, or same type)

**Example Flow**:
1. Worker clocks in to Piecework Task A at 8:00 AM
2. Worker scans to clock in to Hourly Task B at 10:00 AM
3. System automatically:
   - Clocks out Task A at 10:00 AM
   - Clocks in to Task B at 10:00 AM
   - Shows message: "Clocked in John Doe. Previous task(s) automatically clocked out."

**Files Changed**:
- `src/app/(app)/time-tracking/page.tsx`

### 4. Weekly Payroll Adjustment Fix ✅

**Problem**: The payroll calculation was applying daily minimum wage adjustments and then comparing with piecework earnings, which could result in overpayment when workers exceeded minimum wage on some days.

**Solution**:
- Simplified the weekly calculation logic:
  1. Accumulate ALL raw earnings (hourly + piecework) for the entire week
  2. Calculate minimum wage requirement for the week (total hours × minimum wage)
  3. Pay the MAXIMUM of these two amounts
  4. Calculate the adjustment (top-up) as the difference
- This ensures that if a worker earns more than minimum wage for the week (through any combination of hourly and piecework), they receive that higher amount
- If they earn less, they receive minimum wage (with the difference shown as adjustment)

**Example**:
```
Week: 40 hours worked
Minimum wage: $16.28/hour
Weekly minimum requirement: $651.20

Scenario 1 - Worker exceeds minimum:
- 30 hours hourly @ $16.28 = $488.40
- 200 pieces @ $1.00 = $200.00
- Total raw earnings: $688.40
- Payment: $688.40 (no adjustment needed)

Scenario 2 - Worker below minimum:
- 20 hours hourly @ $16.28 = $325.60
- 100 pieces @ $1.00 = $100.00
- Total raw earnings: $425.60
- Weekly minimum: $651.20 (for 40 hours)
- Adjustment needed: $225.60
- Payment: $651.20 (includes $225.60 adjustment)
```

**Files Changed**:
- `src/ai/flows/generate-payroll-report.ts`

## Technical Details

### Data Structure
The `Piecework` type remains unchanged:
```typescript
type Piecework = {
  id: string;
  employeeId: string;
  taskId: string;
  timestamp: Date;
  pieceCount: number;  // Always 1 for new entries
  pieceQrCode: string;
  qcNote?: string;
};
```

### Backwards Compatibility
The system maintains backwards compatibility with existing piecework records that may have `pieceCount > 1`. The history view will display them correctly.

## Testing Recommendations

1. **Piecework Filtering**:
   - Navigate to Piece-Work tab
   - Verify only piecework tasks appear in dropdowns
   - Check that task labels show type (Piecework/Hourly)

2. **Individual Timestamps**:
   - Create a manual piecework entry with quantity > 1
   - Check history tab to see individual records with timestamps
   - Verify timestamps are sequential (1 second apart)

3. **Auto Clock-Out**:
   - Clock in to a piecework task
   - Clock in to an hourly task without manually clocking out
   - Verify first task is automatically clocked out
   - Check notification message

4. **Payroll Calculation**:
   - Generate payroll for a week with mixed hourly and piecework
   - Verify weekly adjustment is calculated correctly
   - Test scenarios where worker exceeds and falls below minimum wage

## Future Improvements

Potential enhancements for future iterations:
1. Batch piecework entry with timestamp ranges
2. Visual indicators in history showing piecework clusters
3. Statistics dashboard showing pieces per hour/day
4. Export functionality for piecework reports
