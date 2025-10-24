# Visual Changes Guide - Time-Tracking Improvements

## Screenshots and Visual Descriptions

### 1. QR Scanner Tab - New "Past Records" Mode

**Before:**
```
┌─────────────────────────────────────┐
│ QR Code Scanner                     │
├─────────────────────────────────────┤
│ [Select Client/Ranch/Block/Task]    │
│                                     │
│ ☐ Use Manual Date/Time              │
│                                     │
│ Scan Mode:                          │
│ ○ Clock In  ○ Clock Out             │
│                                     │
│ [QR Scanner Video Preview]          │
└─────────────────────────────────────┘
```

**After (with Past Records enabled):**
```
┌─────────────────────────────────────┐
│ QR Code Scanner                     │
├─────────────────────────────────────┤
│ [Select Client/Ranch/Block/Task]    │
│                                     │
│ ☑ Use Manual Date/Time for Past     │
│   Records                           │
│                                     │
│ Clock-In Date & Time                │
│ [📅 2025-01-20] [🕐 08:00]          │
│                                     │
│ Clock-Out Date & Time               │
│ [📅 2025-01-20] [🕐 17:00]          │
│                                     │
│ Pieces Completed (if piecework)     │
│ [45                             ]   │
│                                     │
│ [QR Scanner Video Preview]          │
│                                     │
│ (Scan Mode selector is HIDDEN)      │
└─────────────────────────────────────┘
```

### 2. Manual Entry Tab - New "Past Records" Mode

**Before:**
```
┌─────────────────────────────────────┐
│ Manual Log Entry                    │
├─────────────────────────────────────┤
│ [Select Client/Ranch/Block/Task]    │
│                                     │
│ ☐ Use Manual Date/Time              │
│                                     │
│ Log Type:                           │
│ [Clock In ▼]                        │
│                                     │
│ Employee:                           │
│ [Search employee...             ]   │
│                                     │
│ [Submit Log]                        │
└─────────────────────────────────────┘
```

**After (with Past Records enabled):**
```
┌─────────────────────────────────────┐
│ Manual Log Entry                    │
├─────────────────────────────────────┤
│ [Select Client/Ranch/Block/Task]    │
│                                     │
│ ☑ Use Manual Date/Time for Past     │
│   Records                           │
│                                     │
│ Clock-In Date & Time                │
│ [📅 2025-01-20] [🕐 08:00]          │
│                                     │
│ Clock-Out Date & Time               │
│ [📅 2025-01-20] [🕐 17:00]          │
│                                     │
│ Pieces Completed (if piecework)     │
│ [45                             ]   │
│                                     │
│ (Log Type selector is HIDDEN)       │
│                                     │
│ Employee:                           │
│ [Search employee...             ]   │
│                                     │
│ [Submit Log]                        │
└─────────────────────────────────────┘
```

### 3. History Tab - Unified View

**Before (Two Separate Sections):**
```
┌─────────────────────────────────────┐
│ Complete History                    │
├─────────────────────────────────────┤
│ [Date Filter Controls]              │
│                                     │
│ Clock-In/Clock-Out Records          │
│ ┌─────────────────────────────────┐ │
│ │ 👤 Juan Pérez                   │ │
│ │ 🔵 Hourly                       │ │
│ │ 📦 Harvest - Strawberries       │ │
│ │ 🕐 In: 1/20 8:00 AM            │ │
│ │ 🕐 Out: 1/20 5:00 PM           │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Piecework Records                   │
│ ┌─────────────────────────────────┐ │
│ │ 👤 María López                  │ │
│ │ 📦 Packing - Berries           │ │
│ │ 📅 1/20 2:30 PM                │ │
│ │ ✓ Quantity: 120                │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**After (Unified View):**
```
┌─────────────────────────────────────┐
│ Complete History                    │
├─────────────────────────────────────┤
│ [Date Filter Controls]              │
│                                     │
│ All Records (Clock-In/Out & Piece)  │
│ ┌─────────────────────────────────┐ │
│ │ 👤 Juan Pérez                   │ │
│ │ 🔵 Time Entry 🟠 Hourly         │ │
│ │ 📦 Harvest - Strawberries       │ │
│ │ 🕐 In: 1/20 8:00 AM            │ │
│ │ 🕐 Out: 1/20 5:00 PM           │ │
│ │ Pieces: 45                      │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 👤 María López                  │ │
│ │ 🟣 Piecework                    │ │
│ │ 📦 Packing - Berries           │ │
│ │ 📅 1/20 2:30 PM                │ │
│ │ ✓ Quantity: 120                │ │
│ │ 🔵 Manual Entry                 │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 👤 Carlos Rodríguez             │ │
│ │ 🔵 Time Entry 🟣 Piecework      │ │
│ │ 🟢 Active (not clocked out)     │ │
│ │ 📦 Pruning - Roses             │ │
│ │ 🕐 In: 1/21 7:00 AM            │ │
│ │ [Edit] [Delete]                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Color Coding and Badges

### Badge Colors:
- **🔵 Blue** - Time Entry records
- **🟣 Purple** - Piecework records or Piecework payment type
- **🟠 Orange** - Hourly payment type
- **🟢 Green** - Active (not clocked out yet)
- **⚪ White/Gray** - Manual Entry indicator

### Visual Indicators:
- **Active Records:** Show green "Active" badge
- **Payment Types:** Displayed with colored badges
- **Record Types:** Always shown (Time Entry vs Piecework)
- **Pieces Count:** Shows in time entries when applicable

## User Flow Examples

### Flow 1: Creating Past Record via QR Scanner

```
User Action                     System Response
──────────────────────────────────────────────────────
1. Navigate to QR Scanner      → Shows task selection
2. Select Client/Ranch/Task    → Form updates
3. Check "Past Records" box    → Shows date/time pickers
                                → Hides "Scan Mode" selector
4. Set Clock-In: 1/20 8:00 AM  → Date picker closes
5. Set Clock-Out: 1/20 5:00 PM → Date picker closes
6. Enter Pieces: 45 (if piece) → Number validates
7. Scan employee QR code       → Validates times
                                → Creates complete record
                                → Shows success:
                                  "Created past record for Juan.
                                   Worked 9.00 hrs.
                                   Accrued 0.23 sick hrs.
                                   New balance: 15.48 hrs.
                                   Pieces worked: 45."
```

### Flow 2: Viewing Unified History

```
User Action                     What User Sees
──────────────────────────────────────────────────────
1. Click "History" tab         → All records listed together
                                → Newest at top
                                → Color-coded badges

2. Look for Juan's work        → See both time entries AND
                                  piecework mixed together
                                → Easy to track full day

3. Filter by date range        → All record types filter
                                → Still chronological

4. Click Edit on any record    → Dialog adapts to type:
                                  - Time Entry: shows times
                                  - Piecework: shows quantity
```

## Responsive Design

### Mobile View (< 640px):
- Date/time pickers stack vertically
- Badges wrap to multiple lines if needed
- Employee names truncate with ellipsis
- Edit/Delete buttons remain accessible

### Tablet View (640px - 1024px):
- Two-column layout for date pickers
- Badges display inline with spacing
- Full task names visible

### Desktop View (> 1024px):
- Optimal spacing and readability
- All information visible at once
- Hover effects on records

## Accessibility Features

- **Keyboard Navigation:** Tab through all form fields
- **Screen Reader Support:** Proper ARIA labels
- **High Contrast:** Color badges have text labels
- **Focus Indicators:** Clear visual feedback
- **Error Messages:** Screen reader announcements

## Animation and Transitions

- **Checkbox Toggle:** Smooth expand/collapse of sections
- **Record Hover:** Subtle background color change
- **Date Picker:** Fade in/out animation
- **Success Toast:** Slide in from top-right

## Error States

### Invalid Time Range:
```
┌─────────────────────────────────────┐
│ ⚠️ Invalid Times                     │
│ Clock-out time must be after        │
│ clock-in time.                      │
│                                     │
│ [OK]                                │
└─────────────────────────────────────┘
```

### Missing Required Fields:
```
┌─────────────────────────────────────┐
│ ⚠️ Missing Times                     │
│ Please set both clock-in and        │
│ clock-out times for past records.   │
│                                     │
│ [OK]                                │
└─────────────────────────────────────┘
```

## Success Messages

### Past Record Created:
```
┌─────────────────────────────────────┐
│ ✅ Past Record Created               │
│                                     │
│ Created past record for Juan Pérez. │
│ Worked 9.00 hrs.                    │
│ Accrued 0.23 sick hrs.              │
│ New balance: 15.48 hrs.             │
│ Pieces worked: 45.                  │
└─────────────────────────────────────┘
```

This visual guide helps users understand exactly what changed and where to find the new features.
