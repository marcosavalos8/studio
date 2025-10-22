# Sick Hours Tracking Implementation

## Overview
This document describes the implementation of sick hours tracking for the payroll system, as requested by the client. Employees accumulate sick hours based on hours worked, which can then be used when they need time off.

## Requirements Met
1. ✅ Employees accumulate 1 hour of sick time for every 40 hours worked
2. ✅ Sick hours accumulate over time
3. ✅ Sick hours appear in the payroll report  
4. ✅ Sick hours are updated each time they are accumulated
5. ✅ Employees can use sick hours when they miss work
6. ✅ Sick hours are deducted from their balance when used
7. ✅ Sick hours appear in the Employees section

## Implementation Details

### 1. Data Model Changes

#### Employee Type (`src/lib/types.ts`)
- Added `sickHoursBalance?: number` - Current available sick hours
- Added `totalHoursWorked?: number` - Total hours worked (for future tracking)

#### TimeEntry Type (`src/lib/types.ts`)
- Added `isSickLeave?: boolean` - Indicates if this is a sick leave entry
- Added `sickHoursUsed?: number` - Number of sick hours used for this entry

#### WeeklySummary Type (`src/lib/types.ts`)
- Added `sickHoursAccrued?: number` - Sick hours earned in this week

#### EmployeePayrollSummary Type (`src/lib/types.ts`)
- Added `totalSickHoursAccrued?: number` - Total sick hours earned in payroll period
- Added `newSickHoursBalance?: number` - Updated balance after payroll period

### 2. Payroll Calculation (`src/ai/flows/generate-payroll-report.ts`)

#### Sick Hours Accrual
- Calculates sick hours as: `weeklyTotalHours / 40`
- Adds sick hours to weekly summary
- Accumulates total sick hours for the payroll period
- Calculates new balance: `currentBalance + totalSickHoursAccrued`

#### Sick Leave Exclusion
- Time entries marked as `isSickLeave` are excluded from work hours
- This prevents sick leave from counting towards earning more sick hours
- Sick leave entries are not included in payroll calculations

### 3. Payroll Report Display (`src/app/(app)/payroll/report-display.tsx`)

#### Weekly Display
- Shows "Sick Hours Accrued" in each week's summary
- Displays hours in green with "+ X.XX hrs" format

#### Employee Summary
- Shows "Total Sick Hours Accrued" for the entire period
- Shows "New Sick Hours Balance" after the payroll period

#### Save Functionality
- Added "Save Sick Hours" button
- Updates all employee records in Firestore with new sick hours balances
- Provides visual feedback with success state

### 4. Employees Page (`src/app/(app)/employees/page.tsx`)

#### Display
- Added "Sick Hours" column (visible on large screens)
- Shows current sick hours balance as a badge
- Displays "0.00 hrs" for employees without sick hours

#### Table Structure
- Name | Role | Status | Sick Hours | QR Code | Actions
- Responsive design hides columns on smaller screens

### 5. Time Tracking - Sick Leave Logging (`src/app/(app)/time-tracking/page.tsx`)

#### New "Log Sick Leave" Card
Located in the Manual Entry tab after Bulk Clock Out.

**Features:**
1. Employee search with sick hours balance display
2. Shows current available sick hours for selected employee
3. Input for hours to use (with validation)
4. Date picker for absence date
5. Optional notes field
6. Submit button with loading state

#### Validation
- Ensures employee is selected
- Validates hours are positive and not empty
- Checks that hours requested don't exceed available balance
- Requires a date for the absence

#### Processing
- Creates a TimeEntry marked as sick leave
- Sets appropriate start/end times (default 8 AM + hours)
- Uses first active task as placeholder
- Deducts hours from employee's sick hours balance
- Updates Firestore employee record immediately

## Usage Flow

### Accruing Sick Hours
1. Generate payroll report for a period
2. System automatically calculates sick hours (1 per 40 worked)
3. Review sick hours in the report
4. Click "Save Sick Hours" to persist new balances
5. Employee records are updated in Firestore

### Using Sick Hours
1. Go to Time Tracking → Manual Entry tab
2. Scroll to "Log Sick Leave" section
3. Search and select employee
4. View their available sick hours
5. Enter hours to use and date of absence
6. Add optional notes
7. Submit to log sick leave
8. Hours are immediately deducted from balance

### Viewing Sick Hours
1. **Employees Page**: See current balance for all employees
2. **Payroll Report**: See hours accrued during payroll period
3. **Time Tracking**: See available hours when logging sick leave

## Technical Notes

### Firestore Updates
- Sick hours balance updates use `updateDoc()` 
- Only the `sickHoursBalance` field is updated
- Updates are atomic per employee

### Calculations
- Sick hours accrued: `totalHours / 40`
- Rounded to 2 decimal places for display
- Stored as floating point numbers

### Sick Leave Entries
- Marked with `isSickLeave: true`
- Include `sickHoursUsed` field
- Excluded from regular payroll hour calculations
- Show in time tracking history but don't count as work time

## Future Enhancements

Potential improvements that could be made:
1. Add sick leave approval workflow
2. Create dedicated "Sick Leave" task type
3. Add reporting for sick leave usage trends
4. Implement sick hours expiration policies
5. Add notifications when sick hours are low
6. Track sick leave reasons for HR purposes
7. Generate sick leave usage reports
8. Add maximum sick hours cap per year
9. Support half-day sick leave increments
10. Add sick leave calendar view

## Testing Recommendations

1. **Accrual Testing**
   - Generate payroll for various hour amounts
   - Verify 40:1 ratio is correct
   - Check accumulation across multiple payrolls

2. **Usage Testing**
   - Log sick leave with valid hours
   - Test validation (insufficient hours, invalid input)
   - Verify balance deduction

3. **Display Testing**
   - Check Employees page on different screen sizes
   - Verify payroll report displays correctly
   - Test print/PDF with sick hours

4. **Edge Cases**
   - Employee with 0 sick hours
   - Requesting more hours than available
   - Multiple sick leaves in one day
   - Sick leave spanning multiple days

## Support

For questions or issues with the sick hours feature, refer to:
- This documentation
- Type definitions in `src/lib/types.ts`
- Payroll calculation in `src/ai/flows/generate-payroll-report.ts`
