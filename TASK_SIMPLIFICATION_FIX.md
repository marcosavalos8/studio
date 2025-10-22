# Task Simplification Fix - Implementation Summary

## Problem Statement
The previous PR simplified task management by removing dual fields for "Employee Pay" and "Client Billing". However, this caused errors when loading tasks and calculating payroll because some components still referenced the removed fields `employeePayType` and `employeeRate`.

## Solution Overview
This PR fixes all references to the removed fields and ensures the system works correctly with the simplified task model.

## Changes Made

### 1. Task Display Page (`src/app/(app)/tasks/page.tsx`)
**Problem**: Lines 184-189 tried to access `task.employeeRate` and `task.employeePayType` which no longer exist.

**Fix**: Updated the display logic to show:
- For piecework tasks: `${task.piecePrice}/piece` (employee piece price)
- For hourly tasks: `${task.clientRate}/hr` (client hourly rate)

**Code Changes**:
```typescript
// Before (lines 184-189):
<span className="font-medium">
  ${task.employeeRate.toFixed(2)}/
  {task.employeePayType === "hourly" ? "hr" : "piece"}
</span>

// After:
{task.clientRateType === "piece" && task.piecePrice ? (
  <>
    <span className="font-medium">
      ${task.piecePrice.toFixed(2)}/piece
    </span>
    <span className="text-muted-foreground capitalize">
      Piecework
    </span>
  </>
) : (
  <>
    <span className="font-medium">
      ${task.clientRate.toFixed(2)}/hr
    </span>
    <span className="text-muted-foreground capitalize">
      Hourly
    </span>
  </>
)}
```

### 2. Mock Data (`src/lib/mock-data.ts`)
**Problem**: Mock task data still included `employeePayType` and `employeeRate` fields.

**Fix**: 
- Removed `employeePayType` and `employeeRate` from all mock tasks
- Added `piecePrice` to piecework tasks
- Example:
```typescript
// Before:
{ name: 'Apple Picking', clientRate: 20, clientRateType: 'piece', 
  employeePayType: 'piecework', employeeRate: 0.5, status: 'Active' }

// After:
{ name: 'Apple Picking', clientRate: 20, clientRateType: 'piece', 
  piecePrice: 0.5, status: 'Active' }
```

### 3. Task Forms (`src/app/(app)/tasks/add-task-dialog.tsx` and `edit-task-dialog.tsx`)
**Problem**: Forms were missing UI fields for `clientRate` and `clientRateType`, which are required fields in the schema.

**Fix**: Added form fields for:
- **Client Rate Type**: Dropdown to select "Hourly" or "Piece"
- **Client Rate**: Input field for the rate charged to the client ($/hr or $/piece)
- **Piece Price**: Optional input field for the price paid to employees per piece

This provides clear separation:
- `clientRate` + `clientRateType`: What you charge the client
- `piecePrice`: What you pay employees for piecework (optional, defaults to minimum wage for hourly)

## How the System Works Now

### Employee Payment Calculation (Payroll)
Located in: `src/ai/flows/generate-payroll-report.ts`

**For Piecework Tasks**:
- If `task.piecePrice` is set and pieces > 0:
  - Earnings = `pieces * task.piecePrice`
- Minimum wage adjustment is applied daily and weekly to ensure compliance

**For Hourly Tasks**:
- If no pieces or no piecePrice:
  - Earnings based on hours worked
  - Minimum wage adjustment ensures at least minimum wage per hour

**Code Logic** (lines 276-301):
```typescript
if (pieces > 0 && task.piecePrice && task.piecePrice > 0) {
  earningsForTask = pieces * task.piecePrice;
  weeklyTotalPieceworkEarnings += earningsForTask;
} else if (hours > 0) {
  // For hourly work, minimum wage adjustment will be applied
  console.log("Hourly work (will be adjusted to minimum wage)");
}
```

### Client Billing Calculation (Invoicing)
Located in: `src/app/(app)/invoicing/invoicing-form.tsx`

**Billing Logic** (lines 198-202):
```typescript
if (task.clientRateType === "hourly") {
  task.cost = task.hours * task.clientRate;
} else {
  task.cost = task.pieces * task.clientRate;
}
```

This means:
- Hourly tasks: Bill client for `hours * clientRate`
- Piece tasks: Bill client for `pieces * clientRate`

## Data Model
The simplified Task type:
```typescript
export type Task = {
  id: string;
  name: string;
  variety?: string;
  ranch?: string;
  block?: string;
  clientId: string;
  clientRate: number;              // What you charge the client (per hour or per piece)
  clientRateType: "hourly" | "piece"; // How you charge the client
  piecePrice?: number;             // What you pay employees per piece (optional)
  status: "Active" | "Inactive" | "Completed";
};
```

## Benefits of Simplified Model
1. **Clearer separation**: Client billing vs. employee payment
2. **Less confusion**: No more mixing up hourly rates with piece counts
3. **Automatic compliance**: Minimum wage adjustments handled automatically
4. **Simpler UI**: One rate type, one piece price field

## Testing Recommendations
1. Create a new hourly task and verify it displays correctly
2. Create a new piecework task with piecePrice and verify it displays correctly
3. Generate a payroll report with both hourly and piecework tasks
4. Generate an invoice for a client with mixed task types
5. Verify that minimum wage adjustments are applied correctly

## Files Modified
1. `/src/app/(app)/tasks/page.tsx` - Task display logic
2. `/src/lib/mock-data.ts` - Mock data structure
3. `/src/app/(app)/tasks/add-task-dialog.tsx` - Add task form
4. `/src/app/(app)/tasks/edit-task-dialog.tsx` - Edit task form

## Files Verified (No Changes Needed)
1. `/src/ai/flows/generate-payroll-report.ts` - Already uses piecePrice correctly
2. `/src/app/(app)/invoicing/invoicing-form.tsx` - Already uses clientRate correctly
3. `/src/lib/types.ts` - Task type already updated in previous PR
