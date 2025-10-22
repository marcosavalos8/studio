# Quick Reference: Key Code Changes

## Overview
This document highlights the most important code changes for the automated sick hours system.

## 1. New Type Definition

### File: `src/lib/types.ts`
```typescript
export type TimeEntry = {
  id: string;
  employeeId: string;
  taskId: string;
  timestamp: Date;
  endTime?: Date | null;
  isBreak: boolean;
  breakReason?: "Paid" | "Unpaid Meal";
  piecesWorked?: number;
  paymentModality?: "Hourly" | "Piecework";
  isSickLeave?: boolean;
  sickHoursUsed?: number;
  useSickHoursForPayment?: boolean; // ← NEW FIELD
};
```

## 2. Clock-In Function Update

### File: `src/app/(app)/time-tracking/page.tsx`

**Before:**
```typescript
const clockInEmployee = useCallback(
  async (employee: Employee, taskId: string, customTimestamp?: Date) => {
    // ... code ...
    const newTimeEntry: Omit<TimeEntry, "id"> = {
      employeeId: employee.id,
      taskId: taskId,
      timestamp: customTimestamp || new Date(),
      endTime: null,
      isBreak: false,
    };
    // ... code ...
  }
);
```

**After:**
```typescript
const clockInEmployee = useCallback(
  async (employee: Employee, taskId: string, customTimestamp?: Date, useSickHours?: boolean) => {
    // ... code ...
    const newTimeEntry: Omit<TimeEntry, "id"> = {
      employeeId: employee.id,
      taskId: taskId,
      timestamp: customTimestamp || new Date(),
      endTime: null,
      isBreak: false,
      useSickHoursForPayment: useSickHours || false, // ← NEW FIELD
    };
    // ... code ...
    toast({
      title: "Clock In Successful",
      description: `Clocked in ${employee.name}.${useSickHours ? ' (Using sick hours for payment)' : ''}`,
    });
  }
);
```

## 3. Clock-Out Function - Complete Rewrite

### File: `src/app/(app)/time-tracking/page.tsx`

**Major New Logic:**
```typescript
const clockOutEmployee = useCallback(
  async (employee: Employee, taskId: string, customTimestamp?: Date) => {
    // ... existing validation code ...
    
    // NEW: Calculate hours worked and check sick hours flag
    let totalHoursForThisSession = 0;
    let usingSickHours = false;
    
    querySnapshot.forEach((docSnap) => {
      const entry = docSnap.data() as TimeEntry;
      const clockInTime = /* convert timestamp */;
      const hoursWorked = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      totalHoursForThisSession += hoursWorked;
      usingSickHours = entry.useSickHoursForPayment || false;
    });
    
    // NEW: Update employee's totalHoursWorked
    const currentTotalHours = employee.totalHoursWorked || 0;
    const newTotalHours = currentTotalHours + totalHoursForThisSession;
    
    // NEW: Calculate sick hours
    const currentSickBalance = employee.sickHoursBalance || 0;
    let newSickBalance = currentSickBalance;
    let sickHoursAccrued = 0;
    
    if (usingSickHours) {
      // NEW: Deduct hours when using sick hours for payment
      newSickBalance = currentSickBalance - totalHoursForThisSession;
      if (newSickBalance < 0) {
        toast({ /* error: insufficient hours */ });
        return;
      }
    } else {
      // NEW: Accrue sick hours (1 per 40 worked)
      sickHoursAccrued = totalHoursForThisSession / 40;
      newSickBalance = currentSickBalance + sickHoursAccrued;
    }
    
    // NEW: Update employee record
    const employeeRef = doc(firestore, "employees", employee.id);
    batch.update(employeeRef, {
      totalHoursWorked: newTotalHours,
      sickHoursBalance: newSickBalance,
    });
    
    await batch.commit();
    
    // NEW: Enhanced toast notification
    let description = `Clocked out ${employee.name}. Worked ${totalHoursForThisSession.toFixed(2)} hrs.`;
    if (usingSickHours) {
      description += ` Used sick hours for payment. New balance: ${newSickBalance.toFixed(2)} hrs.`;
    } else {
      description += ` Accrued ${sickHoursAccrued.toFixed(2)} sick hrs. New balance: ${newSickBalance.toFixed(2)} hrs.`;
    }
    toast({ title: "Clock Out Successful", description });
  }
);
```

## 4. New UI: Checkbox in QR Scanner Tab

### File: `src/app/(app)/time-tracking/page.tsx`

**New Section Added:**
```tsx
{scanMode === "clock-in" && (
  <div className="p-4 border rounded-lg space-y-4 bg-blue-50 dark:bg-blue-950/20">
    <div className="flex items-center space-x-2">
      <Checkbox
        id="use-sick-hours-checkbox"
        checked={useSickHoursForPayment}
        onCheckedChange={(checked: boolean) => {
          setUseSickHoursForPayment(checked);
        }}
      />
      <Label
        htmlFor="use-sick-hours-checkbox"
        className="font-semibold text-blue-900 dark:text-blue-100"
      >
        Use Sick Hours for Payment
      </Label>
    </div>
    {useSickHoursForPayment && (
      <p className="text-sm text-blue-700 dark:text-blue-300">
        ⚠️ The hours worked in this shift will be deducted from the employee's 
        sick hours balance when they clock out.
      </p>
    )}
  </div>
)}
```

## 5. New UI: Checkbox in Manual Entry Tab

### File: `src/app/(app)/time-tracking/page.tsx`

**Similar Section Added:**
```tsx
{manualLogType === "clock-in" && (
  <div className="p-4 border rounded-lg space-y-4 bg-blue-50 dark:bg-blue-950/20">
    <div className="flex items-center space-x-2">
      <Checkbox
        id="use-sick-hours-checkbox-manual"
        checked={useSickHoursForPayment}
        onCheckedChange={(checked: boolean) => {
          setUseSickHoursForPayment(checked);
        }}
      />
      <Label
        htmlFor="use-sick-hours-checkbox-manual"
        className="font-semibold text-blue-900 dark:text-blue-100"
      >
        Use Sick Hours for Payment
      </Label>
    </div>
    {useSickHoursForPayment && (
      <p className="text-sm text-blue-700 dark:text-blue-300">
        ⚠️ The hours worked in this shift will be deducted from the employee's 
        sick hours balance when they clock out.
      </p>
    )}
  </div>
)}
```

## 6. State Management Updates

### File: `src/app/(app)/time-tracking/page.tsx`

**New State Variable:**
```typescript
const [useSickHoursForPayment, setUseSickHoursForPayment] = useState(false);
```

**Reset Logic:**
```typescript
// Reset when switching modes
useEffect(() => {
  setScannedSharedEmployees([]);
  setUseSickHoursForPayment(false); // ← Reset checkbox
}, [scanMode, isSharedPiece, selectedTask, pieceEntryMode]);

// Reset after successful submission
const handleManualSubmit = async () => {
  // ... existing code ...
  setUseSickHoursForPayment(false); // ← Reset checkbox
  setIsManualSubmitting(false);
};
```

**Updated Function Calls:**
```typescript
// In handleScanResult
await clockInEmployee(scannedEmployee, selectedTask, timestamp, useSickHoursForPayment);

// In handleManualSubmit
await clockInEmployee(manualSelectedEmployee, selectedTask, timestamp, useSickHoursForPayment);
```

## 7. Payroll Display Changes

### File: `src/app/(app)/payroll/report-display.tsx`

**Removed Imports:**
```typescript
// REMOVED:
import { useState } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
```

**Removed State and Function:**
```typescript
// REMOVED:
const [isSavingSickHours, setIsSavingSickHours] = useState(false);
const [sickHoursSaved, setSickHoursSaved] = useState(false);

const handleSaveSickHours = async () => {
  // Entire function removed
};
```

**Simplified UI:**
```tsx
// BEFORE:
<div className="flex gap-2">
  <Button onClick={handleSaveSickHours}>
    <Save className="mr-2 h-4 w-4" />
    Save Sick Hours
  </Button>
  <Button onClick={handlePrint}>
    <Printer className="mr-2 h-4 w-4" />
    Print / Save as PDF
  </Button>
</div>

// AFTER:
<Button onClick={handlePrint}>
  <Printer className="mr-2 h-4 w-4" />
  Print / Save as PDF
</Button>
```

## 8. Key Business Logic

### Sick Hours Accrual Formula
```typescript
const sickHoursAccrued = totalHoursForThisSession / 40;
// 1 hour of sick time per 40 hours worked
```

### Sick Hours Deduction Logic
```typescript
if (usingSickHours) {
  newSickBalance = currentSickBalance - totalHoursForThisSession;
  if (newSickBalance < 0) {
    // Prevent clock-out and show error
    return;
  }
}
```

### Total Hours Tracking
```typescript
const currentTotalHours = employee.totalHoursWorked || 0;
const newTotalHours = currentTotalHours + totalHoursForThisSession;
// Always accumulates, regardless of sick hours usage
```

## 9. Validation Rules

### Clock-Out Validation
```typescript
// Rule 1: Clock-out time must be after clock-in time
if (clockOutTime < clockInTime) {
  toast({ error: "Clock-out time cannot be before clock-in time" });
  return;
}

// Rule 2: Must have sufficient sick hours when using them
if (usingSickHours && newSickBalance < 0) {
  toast({ error: `Employee only has ${currentSickBalance.toFixed(2)} sick hours available` });
  return;
}
```

## 10. Database Updates

### Firestore Batch Write
```typescript
const batch = writeBatch(firestore);

// Update time entry with end time
querySnapshot.forEach((doc) => {
  batch.update(doc.ref, { endTime: clockOutTime });
});

// Update employee record with new totals
const employeeRef = doc(firestore, "employees", employee.id);
batch.update(employeeRef, {
  totalHoursWorked: newTotalHours,
  sickHoursBalance: newSickBalance,
});

// Commit all changes atomically
await batch.commit();
```

## Summary of Changes

### Files Modified: 3
1. ✅ `src/lib/types.ts` - Added new field
2. ✅ `src/app/(app)/time-tracking/page.tsx` - Major updates
3. ✅ `src/app/(app)/payroll/report-display.tsx` - Simplified

### New Documentation: 3
1. ✅ `SICK_HOURS_AUTOMATION.md` - Technical documentation
2. ✅ `GUIA_HORAS_ENFERMEDAD_ES.md` - Spanish user guide
3. ✅ `IMPLEMENTATION_SUMMARY_SICK_HOURS.md` - Summary

### Lines Changed
- Added: ~1,056 lines (including documentation)
- Removed: ~78 lines
- Net: +978 lines

### Key Features Added
1. ✅ Checkbox for using sick hours as payment
2. ✅ Automatic totalHoursWorked calculation
3. ✅ Automatic sickHoursBalance calculation
4. ✅ Validation for sufficient sick hours
5. ✅ Enhanced toast notifications
6. ✅ Removed manual save from payroll
7. ✅ Real-time balance updates

---

**Implementation Complete**: October 22, 2025
**Version**: 2.0 - Automated Sick Hours System
