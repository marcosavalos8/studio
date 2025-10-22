# Payroll Calculation Verification

## Overview
This document verifies that payroll calculations work correctly with the simplified task model after removing `employeePayType` and `employeeRate` fields.

## Date/Timezone Fix
**Issue**: Work entries appeared on wrong dates in payroll reports due to UTC timezone conversion.

**Example Problem**:
- Employee Marco clocked in at 12:00 AM on October 22 (local time)
- System converted to UTC, which could be 7:00 AM on October 21 (depending on timezone)
- Payroll report showed work on October 21 instead of October 22

**Solution**:
- Changed timestamp conversion from `.toISOString()` (UTC) to `format(date, "yyyy-MM-dd'T'HH:mm:ss")` (local time)
- Updated report interval to use `endOfDay()` instead of `startOfDay()` for end date
- Now dates are consistently handled in local timezone throughout the system

**Files Modified**:
- `src/app/(app)/payroll/payroll-form.tsx`
- `src/app/(app)/invoicing/invoicing-form.tsx`
- `src/ai/flows/generate-payroll-report.ts`

## Calculation Logic Verification

### Task Model
```typescript
export type Task = {
  id: string;
  name: string;
  clientId: string;
  clientRate: number;              // What you charge client ($/hr or $/piece)
  clientRateType: "hourly" | "piece"; // How you charge client
  piecePrice?: number;             // What you pay employees per piece
  status: "Active" | "Inactive" | "Completed";
}
```

### Employee Payment Calculations

#### Scenario 1: Piecework Task with Pieces Recorded
**Task**: Apple Picking
- `piecePrice = $0.50`
- Employee picked 200 pieces
- Worked 5 hours

**Calculation**:
```javascript
// Step 1: Calculate piecework earnings
pieceworkEarnings = 200 pieces × $0.50 = $100

// Step 2: Calculate minimum wage requirement
minimumWageEarnings = 5 hours × $16.28 = $81.40

// Step 3: Daily earnings (take maximum)
dailyEarnings = Math.max($100, $81.40) = $100

// Step 4: Add paid rest breaks (10 min per 4 hours)
restBreakHours = Math.floor(5 / 4) × (10/60) = 1 × 0.167 = 0.167 hours
regularRate = $100 / 5 = $20/hr
restBreakPay = 0.167 × $20 = $3.34

// Step 5: Final pay
finalPay = $100 + $3.34 = $103.34
```

**Result**: Employee earns $103.34 ✅

#### Scenario 2: Piecework Task but Low Piece Count
**Task**: Apple Picking
- `piecePrice = $0.50`
- Employee picked 50 pieces
- Worked 5 hours

**Calculation**:
```javascript
// Step 1: Calculate piecework earnings
pieceworkEarnings = 50 pieces × $0.50 = $25

// Step 2: Calculate minimum wage requirement
minimumWageEarnings = 5 hours × $16.28 = $81.40

// Step 3: Daily earnings (take maximum)
dailyEarnings = Math.max($25, $81.40) = $81.40

// Step 4: Add paid rest breaks
restBreakHours = Math.floor(5 / 4) × (10/60) = 0.167 hours
regularRate = $81.40 / 5 = $16.28/hr
restBreakPay = 0.167 × $16.28 = $2.72

// Step 5: Final pay
finalPay = $81.40 + $2.72 = $84.12
```

**Result**: Employee earns minimum wage + rest breaks = $84.12 ✅

#### Scenario 3: Hourly Task (No piecePrice)
**Task**: Vineyard Pruning
- `piecePrice = undefined` (hourly task)
- Worked 8 hours
- No pieces recorded

**Calculation**:
```javascript
// Step 1: No piecework earnings (piecePrice not set)
pieceworkEarnings = $0

// Step 2: Calculate minimum wage requirement
minimumWageEarnings = 8 hours × $16.28 = $130.24

// Step 3: Daily earnings (take maximum)
dailyEarnings = Math.max($0, $130.24) = $130.24

// Step 4: Add paid rest breaks
restBreakHours = Math.floor(8 / 4) × (10/60) = 2 × 0.167 = 0.334 hours
regularRate = $130.24 / 8 = $16.28/hr
restBreakPay = 0.334 × $16.28 = $5.44

// Step 5: Final pay
finalPay = $130.24 + $5.44 = $135.68
```

**Result**: Employee earns minimum wage + rest breaks = $135.68 ✅

#### Scenario 4: Meal Break Deduction
**Task**: Any task
- Worked 6.5 hours (clock in to clock out)

**Calculation**:
```javascript
// Step 1: Apply meal break deduction (after 5 hours)
actualHours = 6.5 - 0.5 = 6 hours

// Remaining calculations use 6 hours, not 6.5
```

**Result**: Meal break automatically deducted ✅

### Client Billing Calculations

#### Scenario 1: Hourly Client Rate
**Task**: Vineyard Pruning
- `clientRateType = "hourly"`
- `clientRate = $22/hr`
- Employee worked 8 hours

**Billing**:
```javascript
clientBill = 8 hours × $22 = $176
```

**Result**: Client billed $176 ✅

#### Scenario 2: Piece Client Rate
**Task**: Apple Picking
- `clientRateType = "piece"`
- `clientRate = $0.80/piece`
- Employee picked 200 pieces

**Billing**:
```javascript
clientBill = 200 pieces × $0.80 = $160
```

**Result**: Client billed $160 ✅

## Weekly Aggregation

The system properly aggregates work across the week and applies Washington state labor laws:

1. **Daily minimum wage check**: Each day's earnings must be at least `hours × minimumWage`
2. **Weekly comparison**: Final pay is `max(weeklyPiecework, weeklyMinimumWage)`
3. **Rest breaks**: Added on top based on total hours and regular rate
4. **Top-up reporting**: Shows how much was added to meet minimum wage

## Verification Summary

✅ **Piecework calculations**: Correctly multiplies pieces × piecePrice
✅ **Minimum wage guarantee**: Always ensures at least minimum wage per hour
✅ **Meal breaks**: Automatically deducted after 5 hours
✅ **Rest breaks**: Properly calculated at 10 min per 4 hours
✅ **Client billing**: Correctly uses clientRate based on clientRateType
✅ **Timezone handling**: Fixed to use local time consistently
✅ **Date grouping**: Work appears on correct date in reports

## Code References

- Employee payment logic: `src/ai/flows/generate-payroll-report.ts` (lines 276-370)
- Client billing logic: `src/app/(app)/invoicing/invoicing-form.tsx` (lines 194-206)
- Timezone fixes: All three files modified in latest commit
