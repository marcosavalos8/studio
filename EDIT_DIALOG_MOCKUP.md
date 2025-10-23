# Edit Dialog UI Mockup

## Before (Old Edit Dialog)
```
┌─────────────────────────────────────────────┐
│ Edit Time Entry                        [X]  │
├─────────────────────────────────────────────┤
│ Update the timestamps and payment details  │
│ for this time entry.                        │
│                                              │
│ Clock-In Time                               │
│ ┌─────────────────────────────────────────┐│
│ │ Oct 22, 2025, 4:00 PM              [▼] ││
│ └─────────────────────────────────────────┘│
│                                              │
│ Clock-Out Time (optional)                   │
│ ┌─────────────────────────────────────────┐│
│ │ Oct 22, 2025, 8:00 PM              [▼] ││
│ └─────────────────────────────────────────┘│
│                                              │
│ Payment Modality                            │
│ ┌─────────────────────────────────────────┐│
│ │ Hourly                              [▼] ││
│ └─────────────────────────────────────────┘│
│                                              │
│            [Cancel]  [Save Changes]         │
└─────────────────────────────────────────────┘
```
**Problem:** Cannot change client or task!

---

## After (New Edit Dialog with Client/Task Selection)
```
┌──────────────────────────────────────────────────────────────┐
│ Edit Time Entry                                         [X]  │
├──────────────────────────────────────────────────────────────┤
│ Update the client, task, timestamps and payment details     │
│ for this time entry.                                         │
│                                                              │
│ Clock-In Time                                                │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Oct 22, 2025, 4:00 PM                               [▼] ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ╔════════════════════════════════════════════════════════╗ │
│ ║         🎯 Task Selection (NEW!)                      ║ │
│ ╠════════════════════════════════════════════════════════╣ │
│ ║ Client                                                 ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ prueba Marcos                                  [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ║                                                        ║ │
│ ║ Ranch                                                  ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ North Ranch                                    [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ║                                                        ║ │
│ ║ Block                                                  ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ Block A                                        [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ║                                                        ║ │
│ ║ Task                                                   ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ Apple picking (Kanzi)                          [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ╚════════════════════════════════════════════════════════╝ │
│                                                              │
│ Clock-Out Time (optional)                                    │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Oct 22, 2025, 8:00 PM                               [▼] ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Pieces Worked (optional)                                     │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 0                                                        ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Payment Modality                                             │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Hourly                                              [▼] ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                  [Cancel]  [Save Changes]                    │
└──────────────────────────────────────────────────────────────┘
```
**Solution:** Now you can change client and task! ✅

---

## For Piecework Records
```
┌──────────────────────────────────────────────────────────────┐
│ Edit Piecework Record                                   [X]  │
├──────────────────────────────────────────────────────────────┤
│ Update the client, task, timestamp and quantity for this    │
│ piecework record.                                            │
│                                                              │
│ Timestamp                                                    │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Oct 22, 2025, 2:00 PM                               [▼] ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ╔════════════════════════════════════════════════════════╗ │
│ ║         🎯 Task Selection (NEW!)                      ║ │
│ ╠════════════════════════════════════════════════════════╣ │
│ ║ Client                                                 ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ prueba Marcos                                  [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ║                                                        ║ │
│ ║ Ranch                                                  ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ South Ranch                                    [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ║                                                        ║ │
│ ║ Block                                                  ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ Block B                                        [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ║                                                        ║ │
│ ║ Task                                                   ║ │
│ ║ ┌────────────────────────────────────────────────────┐ ║ │
│ ║ │ Apple picking (Kanzi)                          [▼] │ ║ │
│ ║ └────────────────────────────────────────────────────┘ ║ │
│ ╚════════════════════════════════════════════════════════╝ │
│                                                              │
│ Quantity (can include decimals)                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 2.5                                                      ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                  [Cancel]  [Save Changes]                    │
└──────────────────────────────────────────────────────────────┘
```
**Solution:** Piecework records can also change client and task! ✅

---

## Usage Example

### Step 1: Click Edit Button
In the History tab, click the edit button (✏️) on any time entry or piecework record.

### Step 2: Change Client (if needed)
Click the Client dropdown and select a different client. This will reset Ranch, Block, and Task fields.

### Step 3: Select Ranch
After selecting client, choose the appropriate ranch.

### Step 4: Select Block
After selecting ranch, choose the block.

### Step 5: Select Task
Finally, select the task from the filtered list.

### Step 6: Save
Click "Save Changes" to update the record with the new task assignment!

---

## Key Features

### 🔄 Cascading Dropdowns
- Selecting Client → Shows only ranches for that client
- Selecting Ranch → Shows only blocks for that ranch  
- Selecting Block → Shows only tasks for that block

### ✨ Smart Initialization
When you open the edit dialog, all fields are pre-populated with the current values, so you only need to change what's incorrect.

### 🛡️ Validation
Can't save without selecting a task - you'll get a clear error message: "Task is required."

### 💾 Data Preservation
All other data (timestamps, quantities, payment modality) is preserved when you change the task.

---

## Real-World Scenario

**Situation:** Worker scanned into "Supervision (general)" but was actually doing "Apple picking (Kanzi)"

**Old Process (Without This Feature):**
1. Delete the time entry ❌
2. Go to Manual Entry tab
3. Search for worker
4. Select client
5. Select ranch
6. Select block
7. Select correct task "Apple picking"
8. Enter clock-in time manually
9. Enter clock-out time manually
10. Select payment modality
11. Click Submit

**Total Time:** ~60 seconds, high error risk

**New Process (With This Feature):**
1. Click Edit button ✏️
2. Change task from "Supervision" to "Apple picking"
3. Click Save Changes ✅

**Total Time:** ~10 seconds, no data re-entry!

**Time Saved:** 83% faster! 🚀
