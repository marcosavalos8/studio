# Manual Testing Guide - Payroll Fix

This guide provides step-by-step instructions for manually testing the payroll calculation fix.

## Prerequisites

1. Access to the application (localhost or deployed instance)
2. Login credentials (Demo: David / 1234)
3. At least one active employee
4. At least one client

## Test Case 1: Create Task with Zero Rate (Should Fail)

**Purpose:** Verify validation prevents creating tasks with $0 employee rate

**Steps:**
1. Navigate to Tasks page
2. Click "Add Task" button
3. Fill in task details:
   - Name: "Test Hourly Task"
   - Client: Select any client
   - Client Rate Type: Hourly
   - Client Rate: Leave empty or enter 0
   - Employee Pay Type: Hourly
   - Employee Rate: Leave empty or enter 0
4. Click "Add Task"

**Expected Result:**
- ❌ Form validation should prevent submission
- Error message: "Employee rate must be greater than 0"
- Error message: "Client rate must be greater than 0"
- Task should NOT be created

## Test Case 2: Create Task with Valid Rate (Should Succeed)

**Purpose:** Verify valid tasks can be created successfully

**Steps:**
1. Navigate to Tasks page
2. Click "Add Task" button
3. Fill in task details:
   - Name: "Wire Work"
   - Client: Select any client
   - Ranch: "Ranch A" (optional)
   - Block: "Block 1" (optional)
   - Client Rate Type: Hourly
   - Client Rate: 25.00
   - Employee Pay Type: Hourly
   - Employee Rate: 19.82
4. Click "Add Task"

**Expected Result:**
- ✅ Task should be created successfully
- Success toast: "Task Added - Wire Work has been added successfully"
- Task appears in the tasks list

## Test Case 3: Edit Task to Zero Rate (Should Fail)

**Purpose:** Verify validation prevents editing existing tasks to have $0 rate

**Steps:**
1. Navigate to Tasks page
2. Find an existing task
3. Click edit icon
4. Change Employee Rate to 0
5. Click "Save Changes"

**Expected Result:**
- ❌ Form validation should prevent submission
- Error message: "Employee rate must be greater than 0"
- Task should NOT be updated

## Test Case 4: Record Hourly Work

**Purpose:** Verify time tracking works for hourly tasks

**Steps:**
1. Navigate to Time Tracking page
2. Select the "Wire Work" task created in Test Case 2
3. Select Clock In mode
4. Scan employee QR code (or use manual entry)
5. Wait a few seconds or minutes
6. Select Clock Out mode
7. Scan the same employee QR code

**Expected Result:**
- ✅ Clock in successful: "Clocked in [Employee Name]"
- ✅ Clock out successful: "Clocked out [Employee Name]"
- Time entry created in database with start and end times

## Test Case 5: Generate Payroll Report with Hourly Work

**Purpose:** Verify payroll calculation shows correct earnings for hourly work

**Steps:**
1. Navigate to Payroll page
2. Select date range that includes the time entries from Test Case 4
3. Select pay date
4. Ensure employee is selected
5. Click "Generate Report"

**Expected Result:**
- ✅ Report generates successfully
- ✅ Daily breakdown shows:
  - Task: "Wire Work"
  - Hours: Actual hours worked (e.g., 0.05 hours for 3 minutes)
  - Raw Earnings: hours × $19.82 (e.g., $0.99 for 0.05 hours)
  - Should NOT show $0.00
- ✅ Weekly summary shows:
  - Total Hours: Sum of all hours
  - Total Earnings (Raw): Sum of all raw earnings
  - Minimum Wage Top-Up: Correct adjustment if earnings < minimum wage
  - Final Pay: Correct total

## Test Case 6: Complex Scenario (José Example)

**Purpose:** Verify the example from the problem statement works correctly

**Prerequisites:**
- Create 2 tasks:
  1. "Apple Picking" - Piecework, employee rate: $35/piece
  2. "Wire Work" - Hourly, employee rate: $19.82/hour

**Steps:**
1. Time Tracking - Clock in employee to "Apple Picking"
2. Time Tracking - Record 2 pieces (bins) for employee
3. Wait to simulate 6 hours (or manually edit time entry in database)
4. Time Tracking - Clock in employee to "Wire Work" (auto clocks out of previous)
5. Wait to simulate 2 hours (or manually edit time entry)
6. Time Tracking - Clock out employee
7. Generate payroll report for the date range

**Expected Calculation:**
```
Piecework earnings: 2 pieces × $35 = $70.00
Hourly earnings: 2 hours × $19.82 = $39.64
Total raw earnings: $109.64

Total hours: 8 hours
Minimum wage: 8 × $16.28 = $130.24 (or client minimum wage)
Top-up needed: $130.24 - $109.64 = $20.60

Final pay: $130.24 (whichever is higher: raw earnings or minimum wage)
```

**Expected Result in Report:**
- ✅ Raw Earnings for hourly work should be $39.64 (NOT $0.00)
- ✅ Raw Earnings for piecework should be $70.00
- ✅ Total should be calculated correctly
- ✅ Minimum wage adjustment should only be the difference

## Test Case 7: Team Piecework

**Purpose:** Verify team piecework still works correctly

**Steps:**
1. Navigate to Time Tracking
2. Select a piecework task
3. Set mode to "Piecework"
4. Enable "Shared Piece (Multiple Workers)"
5. Scan first employee QR code
6. Scan second employee QR code
7. Scan bin QR code (or enter manual count)

**Expected Result:**
- ✅ Both employees added to group
- ✅ Piece recorded and split between employees
- ✅ Toast confirmation shows both employee names

## Test Case 8: Task Switching

**Purpose:** Verify workers can switch tasks during the day

**Steps:**
1. Navigate to Time Tracking
2. Clock in employee to Task A
3. Immediately clock in the same employee to Task B
4. Check database or UI

**Expected Result:**
- ✅ Employee is automatically clocked out of Task A
- ✅ Employee is clocked in to Task B
- ✅ Time entry for Task A has an endTime
- ✅ Time entry for Task B is active (endTime = null)

## Troubleshooting

### Issue: Validation not working

**Check:**
- Browser cache - try hard refresh (Ctrl+Shift+R)
- Verify you're testing with the latest code
- Check browser console for JavaScript errors

### Issue: Payroll shows $0.00 for old data

**Check:**
- Console logs for warning: "Task ... has invalid employee rate"
- Edit the task to set a proper employee rate
- Regenerate the payroll report

### Issue: Tasks with $0 rate already exist

**Fix:**
1. Navigate to Tasks page
2. Find tasks with $0 employee rate
3. Edit each task
4. Set valid employee rates (> $0)
5. Save changes

## Success Criteria

All test cases should pass with expected results:

- [ ] Cannot create tasks with $0 rates
- [ ] Can create tasks with valid positive rates
- [ ] Cannot edit tasks to have $0 rates
- [ ] Hourly work earnings show correctly (not $0.00)
- [ ] Piecework earnings show correctly
- [ ] Minimum wage adjustments calculate correctly
- [ ] Team piecework works
- [ ] Task switching works

## Reporting Issues

If any test case fails:

1. Note the exact steps to reproduce
2. Check browser console for errors
3. Check server logs for warnings
4. Take screenshots if UI issues
5. Document expected vs actual behavior
6. Report to development team
