# Time Tracking History - UI Preview

## History Tab Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📜 Complete History                                                  │
│ View and manage all clock-in/clock-out records and piecework        │
│ entries. Filter by date range and delete individual records.        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 🔍 Filter by Date Range                                             │
│ ┌──────────────────────┐  ┌──────────────────────┐                 │
│ │ Start Date           │  │ End Date             │                 │
│ │ [2025-01-01____]     │  │ [2025-01-31____]     │                 │
│ └──────────────────────┘  └──────────────────────┘                 │
│ [ Clear Filters ]                                                   │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ 🔵 Clock-In/Clock-Out Records                                       │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ 👤 John Doe                              [Active]  [🗑️ Delete] │  │
│ │ 📦 Harvesting Strawberries (Premium)                          │  │
│ │ Client: ABC Farm                                              │  │
│ │ ⬇️  In:  Jan 15, 2025, 7:30 AM                                │  │
│ │ ⬆️  Out: Jan 15, 2025, 4:30 PM                                │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ 👤 Jane Smith                                    [🗑️ Delete]   │  │
│ │ 📦 Pruning Vines (Cabernet)                                   │  │
│ │ Client: XYZ Vineyard                                          │  │
│ │ ⬇️  In:  Jan 14, 2025, 6:00 AM                                │  │
│ │ ⬆️  Out: Jan 14, 2025, 2:00 PM                                │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ 🟣 Piecework Records                                                │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ 👤 Maria Garcia, Carlos Rodriguez            [🗑️ Delete]      │  │
│ │ 📦 Berry Picking (Strawberries)                               │  │
│ │ Client: Berry Farm Co                                         │  │
│ │ 📅 Jan 15, 2025, 11:30 AM                                     │  │
│ │ ✅ Quantity: 24                                               │  │
│ │ Bin: BIN-1234                                                 │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ 👤 Tom Wilson                     [Manual Entry] [🗑️ Delete]  │  │
│ │ 📦 Grape Harvesting (Pinot Noir)                              │  │
│ │ Client: Premium Vineyards                                     │  │
│ │ 📅 Jan 14, 2025, 3:45 PM                                      │  │
│ │ ✅ Quantity: 15                                               │  │
│ │ Note: High quality grapes                                     │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Delete Confirmation Dialog

```
┌─────────────────────────────────────────────────┐
│ Are you absolutely sure?                        │
├─────────────────────────────────────────────────┤
│                                                 │
│ This action cannot be undone. This will        │
│ permanently delete this time entry record      │
│ from the database and it will not appear in    │
│ any reports.                                    │
│                                                 │
├─────────────────────────────────────────────────┤
│                     [ Cancel ]  [ Delete ]      │
└─────────────────────────────────────────────────┘
```

## Key Visual Elements

### Time Entry Card
- **Employee Icon (👤)**: Indicates employee name
- **Package Icon (📦)**: Shows task information
- **Green Badge "Active"**: For entries without clock-out time
- **Green Arrow Down (⬇️)**: Clock-in timestamp
- **Red Arrow Up (⬆️)**: Clock-out timestamp
- **Red Trash Icon (🗑️)**: Delete button

### Piecework Card
- **Employee Icon (👤)**: Shows employee name(s) - can be multiple
- **Package Icon (📦)**: Task information
- **Calendar Icon (📅)**: Timestamp
- **Check Circle Icon (✅)**: Quantity information
- **Blue Badge "Manual Entry"**: For manually entered records
- **Red Trash Icon (🗑️)**: Delete button

### Filter Section
- **Filter Icon (🔍)**: Indicates filtering functionality
- **Date Inputs**: HTML5 date pickers for start and end dates
- **Clear Filters Button**: Removes all date constraints

## Color Scheme

- **Green**: Active entries, clock-in actions, success states
- **Red**: Clock-out actions, delete buttons, destructive actions
- **Blue**: Manual entries, informational badges
- **Purple**: Piecework section header
- **Gray**: Muted information, secondary text

## Responsive Design

### Mobile (< 640px)
- Single column layout
- Stacked date filters
- Full-width cards
- Compact information display

### Tablet/Desktop (≥ 640px)
- Two-column date filters
- Grid layout for cards
- Expanded information display
- Side-by-side clock-in/out times

## User Interactions

1. **Filter by Date**
   - Click start date → Calendar picker appears
   - Select date → Records filter automatically
   - Click "Clear Filters" → Shows all records

2. **Delete Record**
   - Click red trash icon → Confirmation dialog appears
   - Click "Delete" → Record removed, toast notification
   - Click "Cancel" → Dialog closes, no changes

3. **View Details**
   - Hover over card → Subtle background color change
   - All information visible at a glance
   - No need to click for details

## Empty States

### No Records
```
┌─────────────────────────────────────────┐
│         No time entries found.          │
│                                         │
│   All employees are currently           │
│   clocked out.                          │
└─────────────────────────────────────────┘
```

### No Records (Filtered)
```
┌─────────────────────────────────────────┐
│      No piecework records found.        │
│                                         │
│   Try adjusting your date filter.      │
└─────────────────────────────────────────┘
```
