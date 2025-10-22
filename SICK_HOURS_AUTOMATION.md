# Automatic Sick Hours Calculation Implementation

## Overview
This document describes the implementation of automatic sick hours calculation and tracking that occurs during clock-in/clock-out operations. Sick hours are now automatically calculated and saved in real-time as employees work, eliminating the need for manual saving in the payroll module.

## Key Changes

### 1. Automatic Calculation on Clock-Out
When an employee clocks out, the system now automatically:
- Calculates the hours worked in that session
- Updates the employee's `totalHoursWorked` (cumulative lifetime hours)
- Calculates sick hours accrued (1 hour per 40 hours worked)
- Updates the employee's `sickHoursBalance`

### 2. Use Sick Hours for Payment Option
A new checkbox option has been added to the clock-in process that allows marking a shift to be paid using sick hours:
- When enabled during clock-in, the shift is flagged as `useSickHoursForPayment: true`
- When the employee clocks out, the hours worked are deducted from their sick hours balance instead of accruing new sick hours
- The system validates that the employee has sufficient sick hours before deducting

### 3. Payroll Module Changes
- The "Save Sick Hours" button has been **removed** from the payroll report display
- Sick hours information in payroll reports is now **display-only** and informational
- Sick hours are already saved in real-time, so no manual action is needed

### 4. Employees Module
- Sick hours display remains **informational only**
- Shows real-time sick hours balance that has been automatically calculated

## Technical Implementation

### Data Model Changes

#### TimeEntry Type
```typescript
export type TimeEntry = {
  // ... existing fields ...
  useSickHoursForPayment?: boolean; // NEW: Whether employee wants to use sick hours to pay for this shift
}
```

#### Employee Type (No changes, already has these fields)
```typescript
export type Employee = {
  // ... existing fields ...
  sickHoursBalance?: number; // Accumulated sick hours available
  totalHoursWorked?: number; // Total hours worked for sick hours calculation
}
```

### Clock-In Changes

**Location**: `src/app/(app)/time-tracking/page.tsx`

#### New UI Elements
1. **QR Scanner Tab**: Added checkbox "Use Sick Hours for Payment" that appears only when scan mode is "clock-in"
2. **Manual Entry Tab**: Added the same checkbox that appears only when log type is "clock-in"
3. Both checkboxes include warning text explaining that hours will be deducted from sick hours balance

#### Function Signature Update
```typescript
const clockInEmployee = useCallback(
  async (employee: Employee, taskId: string, customTimestamp?: Date, useSickHours?: boolean)
```

The function now:
- Accepts a `useSickHours` parameter
- Saves the `useSickHoursForPayment` flag in the time entry
- Shows confirmation in toast message when using sick hours

### Clock-Out Changes

**Location**: `src/app/(app)/time-tracking/page.tsx`

The `clockOutEmployee` function has been significantly enhanced:

```typescript
const clockOutEmployee = useCallback(
  async (employee: Employee, taskId: string, customTimestamp?: Date) => {
    // ... validation code ...
    
    // Calculate hours worked
    const hoursWorked = (clockOutTime - clockInTime) / (1000 * 60 * 60);
    
    // Update totalHoursWorked
    const newTotalHours = currentTotalHours + hoursWorked;
    
    // Calculate sick hours
    const sickHoursAccrued = hoursWorked / 40; // 1 hour per 40 worked
    
    // Handle sick hours based on useSickHoursForPayment flag
    if (usingSickHours) {
      // Deduct hours from balance (validate sufficient balance first)
      newSickBalance = currentSickBalance - hoursWorked;
    } else {
      // Accrue new sick hours
      newSickBalance = currentSickBalance + sickHoursAccrued;
    }
    
    // Update employee record in Firestore
    batch.update(employeeRef, {
      totalHoursWorked: newTotalHours,
      sickHoursBalance: newSickBalance,
    });
    
    await batch.commit();
  }
);
```

#### Validation
- Checks if clock-out time is valid (not before clock-in)
- When using sick hours, validates that employee has sufficient balance
- Shows detailed error messages for any validation failures

#### Automatic Updates
The system updates the employee record with:
1. **totalHoursWorked**: Cumulative lifetime hours worked
2. **sickHoursBalance**: Updated based on whether hours were accrued or used

### Payroll Report Display Changes

**Location**: `src/app/(app)/payroll/report-display.tsx`

#### Removed Components
- Removed state variables: `isSavingSickHours`, `sickHoursSaved`
- Removed function: `handleSaveSickHours()`
- Removed the "Save Sick Hours" button from the UI
- Removed related imports: `useFirestore`, `useToast`, `Save`, `CheckCircle` icons

#### Remaining Functionality
- Sick hours information is still **displayed** in the report
- Shows accumulated sick hours per week and per employee
- Shows new sick hours balance (informational only)
- Users can still print/save the report as PDF

## User Workflows

### Workflow 1: Normal Work (Accruing Sick Hours)

1. Employee clocks in (checkbox unchecked)
2. Employee works their shift
3. Employee clocks out
4. System automatically:
   - Calculates hours worked
   - Updates `totalHoursWorked`
   - Accrues sick hours (1:40 ratio)
   - Updates `sickHoursBalance`
5. Toast notification shows hours worked and sick hours accrued

### Workflow 2: Using Sick Hours for Payment

1. Employee clocks in **with checkbox enabled** "Use Sick Hours for Payment"
2. Employee works their shift
3. Employee clocks out
4. System automatically:
   - Calculates hours worked
   - Validates sufficient sick hours balance
   - Updates `totalHoursWorked`
   - **Deducts** hours worked from `sickHoursBalance`
   - Does NOT accrue new sick hours
5. Toast notification shows hours worked and sick hours deducted

### Workflow 3: Viewing Sick Hours

**In Employees Page**:
- View current sick hours balance for all employees
- Balance is always up-to-date (updated on every clock-out)

**In Payroll Report**:
- View sick hours accrued during the payroll period
- View projected new sick hours balance
- Information is display-only

## UI Screenshots and Locations

### Clock-In Checkbox - QR Scanner Tab
- Location: Time Tracking → QR Scanner tab
- Appears: Only when scan mode is "Clock In"
- Color: Blue background (bg-blue-50 in light mode)
- Warning: Shows alert text when checkbox is enabled

### Clock-In Checkbox - Manual Entry Tab
- Location: Time Tracking → Manual Entry tab
- Appears: Only when log type is "Clock In"
- Same styling as QR Scanner version
- Independent checkbox state for each tab

### Employee Sick Hours Display
- Location: Employees page
- Column: "Sick Hours" (visible on large screens)
- Format: "X.XX hrs" in a badge
- Always shows 2 decimal places

### Payroll Sick Hours Display
- Location: Payroll → Generated Report
- Shows per week: "Sick Hours Accrued: + X.XX hrs" (green text)
- Shows per employee: "Total Sick Hours Accrued" and "New Sick Hours Balance"
- No action buttons (informational only)

## Benefits

### 1. Real-Time Accuracy
- Sick hours are calculated and saved immediately
- No delay between work and sick hours accrual
- Eliminates risk of forgetting to save sick hours

### 2. Simplified Payroll Process
- Payroll administrators don't need to remember to save sick hours
- Sick hours are already in the system when generating reports
- Reports show accurate, up-to-date information

### 3. Transparency
- Employees can check their balance anytime in the Employees section
- Toast notifications show exactly what changed after clock-out
- Clear messaging when using sick hours for payment

### 4. Validation
- System prevents using more sick hours than available
- Calculations are consistent (1:40 ratio)
- No manual entry errors

## Edge Cases Handled

### 1. Insufficient Sick Hours
- When trying to use sick hours for payment but balance is insufficient
- System prevents clock-out and shows error message
- Displays current available balance

### 2. Multiple Active Sessions
- If employee has multiple active clock-ins, all are clocked out
- Hours are calculated for each session and summed
- Single atomic update to employee record

### 3. Manual Date/Time
- Works with custom timestamps
- Calculations based on actual time difference
- Respects user-specified times

### 4. First-Time Users
- Employees without `totalHoursWorked` or `sickHoursBalance` fields
- System treats undefined as 0
- Initializes fields on first clock-out

## Testing Recommendations

### Basic Functionality
1. ✅ Clock in and out normally → Verify sick hours accrued
2. ✅ Clock in with checkbox → Verify sick hours deducted
3. ✅ Check employee page → Verify balance updated
4. ✅ Generate payroll → Verify information displayed correctly

### Validation Testing
1. ✅ Try to use more sick hours than available → Should show error
2. ✅ Clock out with invalid time → Should show error
3. ✅ Multiple clock-ins/outs in same day → Should accumulate correctly

### Edge Case Testing
1. ✅ Employee with no sick hours history → Should initialize
2. ✅ Very short shift (< 1 minute) → Should calculate correctly
3. ✅ Manual date/time entry → Should use custom times
4. ✅ Checkbox state persistence → Should reset appropriately

## Migration Notes

### Existing Data
- No migration needed for existing employees
- System treats undefined fields as 0
- First clock-out will initialize `totalHoursWorked` and `sickHoursBalance`

### Existing Time Entries
- Old time entries without `useSickHoursForPayment` are treated as normal work
- System works with both old and new data formats

### Payroll Reports
- Previously generated reports still show sick hours information
- Only difference is the missing "Save Sick Hours" button
- No data loss or compatibility issues

## Future Enhancements

Potential improvements for consideration:
1. Add sick hours usage history/log
2. Create reports showing sick hours trends
3. Add notifications when sick hours balance is low
4. Implement sick hours caps or expiration policies
5. Add bulk operations for sick hours adjustments
6. Create audit trail for sick hours changes
7. Add sick hours forecasting based on schedule
8. Implement different accrual rates based on employee type
9. Add approval workflow for using sick hours
10. Create sick hours transfer/donation between employees

## Technical Notes

### Firestore Updates
- Uses batch writes for atomic updates
- Updates both time entry and employee record in same batch
- Ensures consistency between clock-out and balance update

### Calculations
- Sick hours accrued: `hoursWorked / 40`
- Stored as floating point numbers
- Displayed with 2 decimal places (toFixed(2))

### State Management
- `useSickHoursForPayment` checkbox state resets:
  - When switching scan modes
  - When switching tabs
  - After successful clock-in submission
- Prevents accidental reuse of checkbox state

### Performance
- Single Firestore read to get employee data
- Single batch write to update time entry and employee
- No additional round trips or queries

## Support and Troubleshooting

### Common Issues

**Issue**: Sick hours not updating
**Solution**: Check browser console for errors, verify Firestore permissions

**Issue**: Checkbox not appearing
**Solution**: Ensure scan mode or log type is set to "Clock In"

**Issue**: Error when using sick hours
**Solution**: Verify employee has sufficient balance, check employee record

**Issue**: Calculations seem incorrect
**Solution**: Verify time difference is correct, check for timezone issues

## Documentation References

- Type definitions: `src/lib/types.ts`
- Time tracking page: `src/app/(app)/time-tracking/page.tsx`
- Payroll display: `src/app/(app)/payroll/report-display.tsx`
- Employees page: `src/app/(app)/employees/page.tsx`
- Original sick hours implementation: `SICK_HOURS_IMPLEMENTATION.md`

---

**Last Updated**: October 22, 2025
**Version**: 2.0 (Automated Sick Hours)
