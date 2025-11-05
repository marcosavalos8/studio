# Overtime Calculation Implementation - Complete Documentation

## Overview
This document describes the implementation of overtime pay calculation for the payroll and invoicing system, following Washington state labor law requirements.

## Client Requirements
The client provided 4 detailed scenarios showing how overtime should be calculated:
1. Pure piecework with earnings above minimum wage
2. Pure piecework with earnings below minimum wage
3. Mixed hourly + piecework with earnings above minimum wage
4. Mixed hourly + piecework with earnings below minimum wage

## Implementation Details

### Core Calculation Function
**Location:** `/src/lib/calculations.ts`

```typescript
calculateOvertimePay(totalHours, totalEarnings, minimumWage = 19.82)
```

**Logic:**
1. If hours ≤ 40: No overtime, return 0
2. If hours > 40:
   - Calculate overtime hours = hours - 40
   - Calculate regular rate = totalEarnings / totalHours
   - Ensure regular rate ≥ minimum wage ($19.82)
   - Calculate overtime premium = (regular rate × 0.5) × overtime hours
   - Return overtime hours, premium, and regular rate

**Important:** The `totalEarnings` parameter should include minimum wage adjustments that have already been applied. This ensures the regular rate is calculated from the adjusted (compliant) earnings.

### Payroll Integration
**Location:** `/src/ai/flows/generate-payroll-report.ts`

**Calculation Flow:**
1. Calculate base earnings (hourly + piecework)
2. Apply rest breaks (piecework only)
3. Apply minimum wage adjustments (piecework only)
4. **Calculate overtime on adjusted total**
5. Add overtime premium to final pay

**Display:**
- Weekly summaries show overtime hours, regular rate, and premium
- Purple highlighting in UI for overtime information
- Detailed breakdown for transparency

### Invoice Integration
**Locations:**
- `/src/app/(app)/invoicing/invoicing-form.tsx` - Calculation
- `/src/app/(app)/invoicing/report-display.tsx` - Display
- `/src/app/(app)/invoicing/page.tsx` - Type definitions

**Features:**
- Overtime premium added to invoice subtotal
- Shown in main cost breakdown
- Included in per-employee details (grouped view)
- Properly included in commission calculations

## Verification Against Client Scenarios

### Scenario 1: Efficient Piecework Worker ✅
**Input:**
- Hours: 50
- Units: 600 × $2.00 = $1,200
- Minimum wage: $19.82/hr

**Calculation:**
1. Regular rate: $1,200 / 50 hrs = $24.00/hr
2. Rate check: $24.00 > $19.82 ✓
3. Overtime hours: 50 - 40 = 10 hrs
4. Overtime premium: ($24.00 × 0.5) × 10 = $120.00

**Result:**
- Base pay: $1,200.00
- Overtime premium: $120.00
- **Total pay: $1,320.00** ✅ (matches client expectation)

### Scenario 2: Slow Piecework Worker ✅
**Input:**
- Hours: 50
- Units: 400 × $2.00 = $800
- Minimum wage: $19.82/hr

**Calculation:**
1. Calculated rate: $800 / 50 hrs = $16.00/hr
2. Rate check: $16.00 < $19.82 ❌
3. Adjustment: 50 × $19.82 = $991.00
4. Top-up: $991.00 - $800.00 = $191.00
5. Regular rate: $991.00 / 50 = $19.82/hr
6. Overtime hours: 10 hrs
7. Overtime premium: ($19.82 × 0.5) × 10 = $99.10

**Result:**
- Base pay (adjusted): $991.00
- Overtime premium: $99.10
- **Total pay: $1,090.10** ✅ (matches client expectation)

### Scenario 3: Efficient Mixed Worker ✅
**Input:**
- Hours: 50 (25 piecework + 25 hourly)
- Piecework: 18 units × $30.00 = $540.00
- Hourly: 25 hrs × $19.82 = $495.50
- Total earnings: $1,035.50

**Calculation:**
1. Regular rate: $1,035.50 / 50 hrs = $20.71/hr
2. Rate check: $20.71 > $19.82 ✓
3. Overtime hours: 10 hrs
4. Overtime premium: ($20.71 × 0.5) × 10 = $103.55

**Result:**
- Base pay: $1,035.50
- Overtime premium: $103.55
- **Total pay: $1,139.05** ✅ (matches client expectation)

### Scenario 4: Slow Mixed Worker ✅
**Input:**
- Hours: 50 (25 piecework + 25 hourly)
- Piecework: 10 units × $30.00 = $300.00
- Hourly: 25 hrs × $19.82 = $495.50
- Total earnings: $795.50

**Calculation:**
1. Calculated rate: $795.50 / 50 hrs = $15.91/hr
2. Rate check: $15.91 < $19.82 ❌
3. Adjustment: 50 × $19.82 = $991.00
4. Top-up: $991.00 - $795.50 = $195.50
5. Regular rate: $991.00 / 50 = $19.82/hr
6. Overtime hours: 10 hrs
7. Overtime premium: ($19.82 × 0.5) × 10 = $99.10

**Result:**
- Base pay (adjusted): $991.00
- Overtime premium: $99.10
- **Total pay: $1,090.10** ✅ (matches client expectation)

## Legal Compliance

### Washington State Requirements ✅
- **Minimum wage:** $19.82/hr (2025 rate) - Updated in code
- **Overtime threshold:** 40 hours per week - Implemented
- **Overtime rate:** Time and a half (1.5x) - Implemented as base (1.0x) + premium (0.5x)
- **Minimum wage priority:** Adjustments applied before overtime - Implemented

### Federal FLSA Requirements ✅
- Overtime for non-exempt employees - Implemented
- Combined rate for mixed work types - Implemented
- Proper record keeping - Displayed in reports

## User Interface Updates

### Payroll Report
**Location:** `/src/app/(app)/payroll/report-display.tsx`

**New Display Elements:**
- Overtime Hours: Shows hours worked over 40
- Regular Rate for OT Calculation: The rate used for overtime premium
- Overtime Premium: The additional 0.5x pay
- Purple background highlighting for overtime information

### Invoice Report
**Location:** `/src/app/(app)/invoicing/report-display.tsx`

**New Display Elements:**
- Overtime Premium line item in cost breakdown
- Per-employee overtime premium in grouped view
- Included in subtotal before commission

## Type Definitions Updated

### WeeklySummary Type
**Location:** `/src/lib/types.ts`

**New Fields:**
```typescript
overtimeHours?: number;      // Hours worked over 40
overtimePremium?: number;    // Additional 0.5x pay
regularRate?: number;        // Rate used for OT calculation
```

### InvoiceData & DetailedInvoiceData Types
**Locations:** `/src/lib/types.ts`, `/src/app/(app)/invoicing/page.tsx`

**New Fields:**
```typescript
overtimePremium?: number;    // Total overtime premium
```

**Employee Details:**
```typescript
overtimePremium?: number;    // Per-employee overtime premium
```

## Testing Recommendations

### Manual Testing Steps
1. Create test data with 50 hours worked
2. Test pure piecework scenarios:
   - High production (>$19.82/hr effective rate)
   - Low production (<$19.82/hr effective rate)
3. Test mixed hourly + piecework scenarios:
   - High combined rate
   - Low combined rate
4. Verify calculations match client scenarios
5. Check payroll report display
6. Check invoice report display
7. Verify overtime flows through to commission calculation

### Edge Cases to Test
- Exactly 40 hours (no overtime)
- 39.99 hours (no overtime)
- 40.01 hours (minimal overtime)
- Multiple weeks with different hour totals
- Workers with only hourly work
- Workers with only piecework
- Workers with mixed work

## Files Modified

1. `/src/lib/calculations.ts` - New `calculateOvertimePay()` function
2. `/src/lib/types.ts` - Added overtime fields to types
3. `/src/ai/flows/generate-payroll-report.ts` - Integrated overtime calculation
4. `/src/app/(app)/payroll/report-display.tsx` - Added overtime display
5. `/src/app/(app)/invoicing/invoicing-form.tsx` - Added overtime to invoice calculation
6. `/src/app/(app)/invoicing/page.tsx` - Added overtime to type definitions
7. `/src/app/(app)/invoicing/report-display.tsx` - Added overtime display

## Summary

✅ All 4 client scenarios verified and match expected results
✅ Washington state minimum wage updated to $19.82
✅ Overtime calculation integrated into payroll generation
✅ Overtime displayed in payroll reports
✅ Overtime included in invoices
✅ No security vulnerabilities introduced
✅ Type-safe implementation with proper TypeScript types
✅ Comprehensive documentation and comments

**Status:** Ready for client testing and approval
