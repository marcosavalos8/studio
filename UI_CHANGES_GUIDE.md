# UI Changes Guide - Piece-Work Implementation

## Visual Layout Changes

### Time-Tracking Page Navigation

#### Before:
```
┌─────────────────────────────────────────────────┐
│  QR Scanner  │  Manual Entry  │  History        │
└─────────────────────────────────────────────────┘
```

#### After:
```
┌─────────────────────────────────────────────────────────────┐
│  QR Scanner  │  Manual Entry  │  Piece-Work  │  History     │
└─────────────────────────────────────────────────────────────┘
```

---

## QR Scanner Tab Changes

### Before: Clock-In/Out + Piecework (3 options)
```
┌─────────────────────────────────────────────────┐
│ Scan Mode:                                      │
│  ○ Clock In    ○ Clock Out    ○ Piecework      │
│                                                 │
│ [Piecework Options when selected]              │
│  ☐ Shared Piece (Multiple Workers)             │
│  ○ Scan Bins    ○ Manual Count                 │
│                                                 │
│ [Scanned Employees List]                       │
│ [QR Scanner Component]                         │
└─────────────────────────────────────────────────┘
```

### After: Clock-In/Out Only (2 options)
```
┌─────────────────────────────────────────────────┐
│ Scan Mode:                                      │
│  ○ Clock In    ○ Clock Out                     │
│                                                 │
│ [QR Scanner Component]                         │
└─────────────────────────────────────────────────┘
```

---

## Manual Entry Tab Changes

### Before: 3 Log Types
```
┌─────────────────────────────────────────────────┐
│ Log Type:                                       │
│  ▼ [Clock In / Clock Out / Record Piecework]   │
│                                                 │
│ [When Piecework selected:]                     │
│  Quantity: [____] pieces                       │
│  Notes: [________________]                     │
└─────────────────────────────────────────────────┘
```

### After: 2 Log Types
```
┌─────────────────────────────────────────────────┐
│ Log Type:                                       │
│  ▼ [Clock In / Clock Out]                      │
│                                                 │
│ [Bulk operations and sick leave remain below]  │
└─────────────────────────────────────────────────┘
```

---

## NEW: Piece-Work Tab

### Structure: Two Sub-Tabs
```
┌─────────────────────────────────────────────────────────────┐
│  📱 QR Code Scanner  │  📝 Manual Log Entry                  │
└─────────────────────────────────────────────────────────────┘

Sub-Tab 1: QR Code Scanner
┌─────────────────────────────────────────────────┐
│ Selection Fields:                               │
│  Client: [____]  Ranch: [____]                 │
│  Block:  [____]  Task:  [____]                 │
│                                                 │
│ ☐ Use Manual Date/Time                         │
│   [Date/Time Picker if checked]                │
│                                                 │
│ ☐ Shared Piece (Multiple Workers)              │
│  ○ Scan Bins    ○ Manual Count                 │
│                                                 │
│ [QR Scanner or Manual Count Input]             │
│                                                 │
│ Scanned Employees (2):                         │
│  ✓ Juan Pérez                                  │
│  ✓ María García                                │
└─────────────────────────────────────────────────┘

Sub-Tab 2: Manual Log Entry
┌─────────────────────────────────────────────────┐
│ Selection Fields:                               │
│  Client: [____]  Ranch: [____]                 │
│  Block:  [____]  Task:  [____]                 │
│                                                 │
│ ☐ Use Manual Date/Time                         │
│   [Date/Time Picker if checked]                │
│                                                 │
│ Employee: [Search...                         ▼]│
│  Selected: Juan Pérez         [Change]         │
│                                                 │
│ Quantity: [____] pieces/bins                   │
│                                                 │
│ Notes (Optional):                              │
│  [____________________________________]        │
│                                                 │
│ [Submit Piecework]                             │
└─────────────────────────────────────────────────┘
```

**Note**: No Bulk Clock In/Out or Sick Leave in Piece-Work tab

---

## Task Creation/Edit Form Changes

### Before: Confusing Dual Rate Fields
```
┌─────────────────────────────────────────────────┐
│ Rate Type: ▼ [Hourly / Piece]                  │
│                                                 │
│ Client Rate ($): [25.00]                       │
│  ℹ️ Hourly rate or piece rate charged to client│
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Piece Price (Optional)                  │   │
│ │ Price per piece for employees ($)       │   │
│ │ [0.50]                                  │   │
│ │ ℹ️ Set the price per piece paid to     │   │
│ │   employees for piecework tasks...     │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### After: Conditional Single Rate Field

#### When Hourly Selected:
```
┌─────────────────────────────────────────────────┐
│ Rate Type: ▼ [Hourly ✓]                        │
│                                                 │
│ Hourly Rate ($): [25.00]                       │
│  ℹ️ Hourly rate for this task                  │
└─────────────────────────────────────────────────┘
```

#### When Piecework Selected:
```
┌─────────────────────────────────────────────────┐
│ Rate Type: ▼ [Piecework ✓]                     │
│                                                 │
│ Piece Price ($): [0.50]                        │
│  ℹ️ Price per piece paid to employees          │
│  ⚠️ Required for piecework tasks               │
└─────────────────────────────────────────────────┘
```

---

## Task List Display Changes

### Rate Column Now Shows:

#### Hourly Tasks:
```
┌─────────────────┐
│ $25.00/hr       │
│ Hourly          │
└─────────────────┘
```

#### Piecework Tasks:
```
┌─────────────────┐
│ $0.50/piece     │
│ Piecework       │
└─────────────────┘
```

---

## User Workflow Examples

### Example 1: Recording Piecework via QR Scanner

1. Click "Piece-Work" tab
2. Click "QR Code Scanner" sub-tab
3. Select Client, Ranch, Block, Task
4. Optional: Check "Use Manual Date/Time" and set date
5. Optional: Check "Shared Piece" for multiple workers
6. Scan employee QR code(s)
7. Either:
   - Leave "Scan Bins" selected and scan bin QR
   - OR select "Manual Count", enter quantity, click "Submit Pieces"
8. Record is saved to database

### Example 2: Recording Piecework Manually

1. Click "Piece-Work" tab
2. Click "Manual Log Entry" sub-tab
3. Select Client, Ranch, Block, Task
4. Optional: Check "Use Manual Date/Time" and set date
5. Search and select employee
6. Enter quantity (number of pieces/bins)
7. Optional: Add notes (QC issues, etc.)
8. Click "Submit Piecework"
9. Record is saved to database

### Example 3: Creating a Piecework Task

1. Go to Tasks page
2. Click "Add Task"
3. Fill in basic info (Name, Client, Ranch, Block, etc.)
4. Set Status to "Active"
5. Select "Piecework" from Rate Type dropdown
6. **Notice**: Only "Piece Price ($)" field appears
7. Enter price per piece (e.g., 0.50)
8. Click "Add Task"
9. Task is now available for piecework recording

---

## Key Benefits Illustrated

### Before (Confusing):
- 3 scan modes in one tab (mixing clock-in/out with piecework)
- Dual rate fields (Client Rate + Piece Price) causing confusion
- Unclear which field to use for what purpose

### After (Clear):
- ✅ Dedicated Piece-Work tab for all piecework operations
- ✅ Conditional form fields (one rate field based on task type)
- ✅ Clear separation of clock-in/out vs piecework workflows
- ✅ No confusion about which fields affect payroll calculations

---

## Mobile Responsive Design

All tabs and forms remain fully responsive:
- Tabs show abbreviated labels on small screens
- Forms stack vertically on mobile
- Selection fields remain usable
- QR scanner adapts to screen size

---

## Accessibility

All changes maintain accessibility:
- Proper label associations
- Keyboard navigation support
- Screen reader friendly
- Clear focus indicators
- Descriptive error messages
