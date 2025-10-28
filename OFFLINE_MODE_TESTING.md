# Offline Mode Testing Guide

## Test Scenarios for Offline Functionality

### Prerequisites
- Chrome/Firefox DevTools open (F12)
- Application loaded and logged in
- At least one active employee and task configured

## Test 1: Basic Clock-In Offline

**Steps:**
1. Open DevTools → Network tab
2. Check "Offline" checkbox to simulate no internet
3. Verify orange "Offline" indicator appears
4. Navigate to Time Tracking page
5. Scan employee QR or use manual entry
6. Perform clock-in operation
7. Verify toast message includes "(Saved locally - will sync when online)"
8. Uncheck "Offline" in DevTools
9. Verify "Back Online" toast appears
10. Check Firestore console to confirm data was synced

**Expected Results:**
- ✅ Offline indicator shows correctly
- ✅ Clock-in works without internet
- ✅ Local confirmation message appears
- ✅ Data syncs automatically when online
- ✅ No errors in console

## Test 2: Clock-Out Offline

**Steps:**
1. Clock-in an employee while online
2. Go offline (DevTools → Network → Offline)
3. Perform clock-out operation
4. Verify offline message in toast
5. Go back online
6. Verify sync occurs

**Expected Results:**
- ✅ Clock-out works offline
- ✅ Hours calculated correctly
- ✅ Sick hours accrued properly
- ✅ Data syncs when online

## Test 3: Piecework Recording Offline

**Steps:**
1. Select a piecework task
2. Go offline
3. Scan employee QR code
4. Scan bin QR code (or use manual entry)
5. Verify piecework recorded with offline message
6. Go online
7. Verify data synced

**Expected Results:**
- ✅ Piecework scan works offline
- ✅ Multiple pieces can be recorded
- ✅ All pieces sync correctly

## Test 4: Multiple Operations Offline

**Steps:**
1. Go offline
2. Perform multiple operations:
   - Clock-in 3 different employees
   - Record 5 piecework entries
   - Clock-out 1 employee
   - Create 1 past record
3. Verify all operations show offline message
4. Go online
5. Verify all operations synced in correct order

**Expected Results:**
- ✅ All operations work offline
- ✅ Operations maintain correct timestamp order
- ✅ All data syncs correctly
- ✅ No duplicate entries created

## Test 5: Edit Operations Offline

**Steps:**
1. Go offline
2. Navigate to History tab
3. Edit a time entry or piecework record
4. Verify offline message
5. Go online
6. Verify changes synced

**Expected Results:**
- ✅ Edit works offline
- ✅ Changes saved locally
- ✅ Changes sync when online

## Test 6: Delete Operations Offline

**Steps:**
1. Go offline
2. Delete a time entry or piecework record
3. Verify offline message
4. Go online
5. Verify deletion synced

**Expected Results:**
- ✅ Delete works offline
- ✅ Record removed from local view
- ✅ Deletion syncs correctly

## Test 7: Bulk Operations Offline

**Steps:**
1. Go offline
2. Perform bulk clock-in for 5 employees
3. Verify offline message
4. Perform bulk clock-out for same task
5. Go online
6. Verify all operations synced

**Expected Results:**
- ✅ Bulk operations work offline
- ✅ All employees processed
- ✅ Sync successful

## Test 8: Network Interruption During Operation

**Steps:**
1. Start a clock-in operation
2. Go offline mid-operation (after clicking but before confirmation)
3. Verify operation completes locally
4. Go online
5. Verify sync occurs

**Expected Results:**
- ✅ Operation completes despite network loss
- ✅ Data saved locally
- ✅ Syncs when connection returns

## Test 9: Extended Offline Period

**Steps:**
1. Go offline
2. Perform 20+ operations over "simulated time"
3. Keep browser/tab open
4. Go online after significant delay
5. Verify all operations sync

**Expected Results:**
- ✅ All operations preserved
- ✅ No data loss
- ✅ Successful bulk sync

## Test 10: Multiple Tabs (Limitation Test)

**Steps:**
1. Open application in 2 tabs
2. Check console for persistence warnings
3. Go offline
4. Try operations in both tabs
5. Verify only first tab has persistence

**Expected Results:**
- ✅ Warning in console for second tab
- ✅ First tab works offline
- ✅ Second tab may have limited offline capability

## Test 11: Browser Storage Limit (Stress Test)

**Steps:**
1. Go offline
2. Create 100+ operations (script or manual)
3. Verify all saved locally
4. Go online
5. Verify all sync correctly

**Expected Results:**
- ✅ Large number of operations handled
- ✅ No storage errors
- ✅ Successful sync

## Test 12: Page Reload While Offline

**Steps:**
1. Go offline
2. Perform several operations
3. Reload page (F5)
4. Verify previously cached data visible
5. Perform new operations
6. Go online
7. Verify all operations sync

**Expected Results:**
- ✅ Page loads offline
- ✅ Cached data accessible
- ✅ New operations work
- ✅ All operations sync

## Manual Network Testing (Real-World)

**For actual field testing:**

### Airplane Mode Test
1. Enable airplane mode on device
2. Perform all standard operations
3. Disable airplane mode
4. Verify sync

### Weak Signal Test
1. Move to area with weak signal
2. Perform operations
3. Observe behavior during intermittent connectivity
4. Verify eventual sync

### Complete Loss Test
1. Work in area with no signal
2. Perform full day operations
3. Return to area with signal
4. Verify complete sync

## Debugging

### Console Messages to Monitor
- Firestore persistence status
- Network online/offline events
- Sync operations
- Any errors or warnings

### DevTools Network Tab
- Monitor Firestore requests
- Verify requests queued when offline
- Verify requests sent when online

### Firestore Console
- Check document timestamps
- Verify data integrity
- Check for duplicate entries

## Known Issues to Watch For
- Multiple tab warnings
- Browser storage quota exceeded
- Sync conflicts (rare)
- Timestamp inconsistencies

## Success Criteria
All tests pass with:
- ✅ No data loss
- ✅ Correct synchronization
- ✅ Proper user feedback
- ✅ No console errors
- ✅ Consistent behavior across browsers
