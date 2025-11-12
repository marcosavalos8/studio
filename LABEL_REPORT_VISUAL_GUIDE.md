# Label Report - Visual Reference

## Navigation
The Label Report is accessible from the sidebar menu with a Tag (🏷️) icon:

```
Dashboard
Time Tracking
Employees
Clients
Tasks
Payroll
Invoicing
Label Report  ← NEW SECTION
```

## Report Selection Screen

```
┌─────────────────────────────────────────────────────────────┐
│ Generate Label Report                                       │
│ Select a client and date range to generate a label report  │
│ showing worker details grouped by the selected date range. │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Select a client ▼]  [Pick a date range ▼]  [Generate Report] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Generated Report Layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  [← Generate New Report]              [Export to Excel] [Print / Save as PDF]   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  LABEL REPORT                                                                    │
│  Client: ABC Orchards                                                            │
│                                                                                  │
│  Tuesday - Friday, Oct 21-24 2025                                               │
│  ──────────────────────────────────────────────────────────────────────────     │
│                                                                                  │
│  ╔═══════════════╤═══════╤════════════════════════════════════════════════════╗ │
│  ║ Worker Name   │ Hours │ Apple Picking - │ Rate │ Pay     │ Total │ MIN PAY │ Diff  ║ │
│  ║               │       │ Piecework       │      │         │ Pieces│ REQ     │ Owed  ║ │
│  ║               │       │ Pieces          │      │         │ Pay   │         │       ║ │
│  ╠═══════════════╪═══════╪═════════════════╪══════╪═════════╪═══════╪═════════╪═══════╣ │
│  ║ Jose Gomez    │ 40.00 │ 8.00            │$30.00│ $240.00 │$532.50│ $792.80 │$260.30║ │
│  ║ Jesus Niño    │ 40.00 │ 10.00           │$30.00│ $300.00 │$660.00│ $792.80 │$132.80║ │
│  ║ Freddy V.     │ 40.00 │ 12.00           │$30.00│ $360.00 │$810.00│ $843.75 │ $33.75║ │
│  ║ Cristina B.   │ 40.00 │ 8.00            │$30.00│ $240.00 │$532.50│ $792.80 │$260.30║ │
│  ║ Jose Niño     │ 40.00 │ 9.00            │$30.00│ $270.00 │$562.50│ $792.80 │$230.30║ │
│  ║ Antonio G.    │ 40.00 │ 9.00            │$30.00│ $270.00 │$562.50│ $792.80 │$230.30║ │
│  ║ Adolfo M.     │ 35.50 │ 11.00           │$30.00│ $330.00 │$645.00│ $703.61 │ $58.61║ │
│  ║ Olimpia H.    │ 40.00 │ 9.00            │$30.00│ $270.00 │$540.00│ $792.80 │$252.80║ │
│  ║ Leticia L.    │ 40.00 │ 6.50            │$30.00│ $195.00 │$465.00│ $792.80 │$327.80║ │
│  ║ Benigno C.    │ 40.00 │ 9.00            │$30.00│ $270.00 │$585.00│ $792.80 │$207.80║ │
│  ╚═══════════════╧═══════╧═════════════════╧══════╧═════════╧═══════╧═════════╧═══════╝ │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Multi-Task Example

When workers perform multiple tasks, the table expands dynamically:

```
╔═══════════╤══════╤═══════════════════════════════════════════════════════════════════════════════╗
║ Worker    │Hours │ Apple Picking │      │         │ Supervision │      │         │ Total │ MIN   │ Diff ║
║ Name      │      │ Pieces        │ Rate │   Pay   │ Hours       │ Rate │   Pay   │ Pay   │ PAY   │ Owed ║
╠═══════════╪══════╪═══════════════╪══════╪═════════╪═════════════╪══════╪═════════╪═══════╪═══════╪══════╣
║ Maria G.  │42.00 │ 10.00         │$30.00│ $300.00 │ 2.00        │$25.00│  $50.00 │$350.00│$850.00│$500.0║
║ Pedro L.  │40.00 │ 15.00         │$30.00│ $450.00 │ 0.00        │$25.00│   $0.00 │$450.00│$792.80│$342.8║
╚═══════════╧══════╧═══════════════╧══════╧═════════╧═════════════╧══════╧═════════╧═══════╧═══════╧══════╝
```

## Column Explanations

### Worker Name
The employee's full name as registered in the system.

### Hours
Total hours worked by the employee during the selected date range across all tasks.

### [Task Name] - Pieces
The quantity of work completed for that specific task. For piecework tasks, this shows the number of pieces. For hourly tasks, this shows hours.

### [Task Name] - Rate
The pay rate for that task. Shows as "$ XX.XX / piece" or "$ XX.XX / hour" depending on the task type.

### [Task Name] - Pay
The total earned for that specific task (Pieces × Rate).

### Total Pieces Pay
Sum of all task payments for that worker (sum of all task pays).

### MIN PAY REQ (Minimum Pay Required)
The minimum amount the worker must be paid according to WA state law, which includes:
- Base task pay
- Paid rest breaks
- Minimum wage adjustments (if task pay doesn't meet minimum wage)
- Overtime premium (if applicable)

### Diff Owed (Difference Owed)
The additional amount beyond task pay that must be paid to meet minimum wage requirements:
- Paid rest breaks
- Minimum wage top-up
- Overtime premium

**Formula**: `Diff Owed = MIN PAY REQ - Total Pieces Pay`

## Excel Export Format

When exported to Excel, the file contains:

```
Row 1:  Tuesday - Friday, Oct 21-24 2025
Row 2:  [blank]
Row 3:  Worker Name | Hours | [Task 1] - Pieces | [Task 1] - Rate | [Task 1] - Pay | ... | Total Pieces Pay | MIN PAY REQ | Diff Owed
Row 4+: [Data rows with all values in separate cells]
```

Each cell is properly formatted:
- Numbers: 2 decimal places
- Currency: $ symbol with 2 decimal places
- Text: Left-aligned
- Numbers: Right-aligned

## Print Layout

When printing or saving as PDF:
- Automatically switches to **landscape orientation**
- Optimized font sizes for readability
- Professional formatting maintained
- Page breaks handled intelligently
- All navigation elements hidden

## Comparison with Invoicing

### What's Different:
1. **No checkbox**: The "incluir reporte agrupado" option is removed
2. **Button text**: "Generate Report" instead of "Generate Invoice"
3. **Table format**: Always shows tabular/grouped view (not daily breakdown)
4. **No totals section**: Removed "Total Base Labor Cost", "Commission", "Subtotal", "Total Due"
5. **Excel export**: NEW - Export button added
6. **Focus**: Worker-centric view for tracking pay and compliance

### What's the Same:
1. Client selection
2. Date range picker
3. Data source (same payroll calculations)
4. Print/PDF capability
5. Professional layout and styling
