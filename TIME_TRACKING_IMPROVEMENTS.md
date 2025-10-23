# Time Tracking History Tab Improvements

## Summary
This update addresses two key issues in the Time Tracking History tab related to editing records and displaying payment types.

## Changes Made

### 1. Piecework Record Editing
**Problem:** Piecework records could only have their timestamp edited, not the quantity. Additionally, decimal values were not supported.

**Solution:**
- Added `editPieceCount` state to track the quantity being edited
- Updated the `handleEditPiecework` function to:
  - Validate and parse the quantity (supporting decimal values using `parseFloat`)
  - Save the `pieceCount` field to the database
  - Show validation errors if quantity is invalid or zero
- Updated the edit dialog to include a quantity input field for piecework records:
  - Type: `number` with `step="0.01"` to support decimals
  - Label: "Quantity (can include decimals)"
  - Min value: 0.01
  - Includes validation on blur to ensure valid values
- Updated the piecework edit button click handler to initialize `editPieceCount` with the current value
- Updated the cancel button to reset `editPieceCount` state

### 2. Payment Type Display and Selection
**Problem:** Clock-in/Clock-out records didn't show what type of task they were (Hourly vs Piecework), and when editing, the payment type wasn't correctly pre-selected.

**Solution:**
- Added a payment type badge to time entries in the History tab:
  - Shows "Hourly" with blue styling (bg-blue-100 text-blue-800)
  - Shows "Piecework" with purple styling (bg-purple-100 text-purple-800)
  - Determines type from `entry.paymentModality` if set, otherwise infers from the task's `clientRateType`
- Updated the time entry edit button click handler to:
  - Look up the task associated with the entry
  - Determine the correct initial payment modality from either:
    1. The entry's `paymentModality` field (if already set)
    2. The task's `clientRateType` ("piece" → "Piecework", otherwise "Hourly")
  - Pre-select this value when opening the edit dialog
- Updated the edit dialog description to be more descriptive:
  - Time entries: "Update the timestamps and payment details for this time entry."
  - Piecework: "Update the timestamp and quantity for this piecework record."

## Technical Details

### Files Modified
- `src/app/(app)/time-tracking/page.tsx`

### New State Variables
```typescript
const [editPieceCount, setEditPieceCount] = useState<number | string>(1);
```

### Key Functions Modified
1. `handleEditPiecework` - Now validates and saves quantity
2. Time entry display rendering - Now includes payment type badge
3. Edit button handlers - Now properly initialize payment modality and piece count

### Validation
- Piecework quantity must be a positive number (can include decimals)
- Invalid values default to 1 on blur
- Clear error messages guide users to correct inputs

## User Impact

### Before
- Users could edit piecework timestamps but not quantities
- No way to enter decimal quantities for piecework
- Clock-in/Clock-out records didn't show payment type
- Edit dialog might show wrong payment type

### After
- Users can edit both timestamp and quantity for piecework records
- Decimal quantities are fully supported (e.g., 2.5 bins)
- Time entries clearly display their payment type (Hourly or Piecework)
- Edit dialog correctly pre-selects the payment type based on task configuration
- Better UX with clear labels and descriptions

## Testing Recommendations
1. Test editing a piecework record and changing the quantity to:
   - A whole number (e.g., 5)
   - A decimal number (e.g., 2.5)
   - An invalid value (should show error)
2. Verify that time entries display the correct payment type badge:
   - For hourly tasks (should show blue "Hourly" badge)
   - For piecework tasks (should show purple "Piecework" badge)
3. Test editing a time entry and verify:
   - Hourly task entries default to "Hourly" payment modality
   - Piecework task entries default to "Piecework" payment modality
   - Can change payment modality in the edit dialog
4. Verify that piecework quantity persists after saving
