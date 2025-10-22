# Next Steps for Migration

## Completed ✅
- Created Next.js API infrastructure
- Migrated Employees, Tasks, and Clients features
- File-based JSON storage system working
- API routes for all collections created

## To Complete the Migration

### 1. Migrate Remaining Pages

The following pages still use Firebase and need to be updated:

#### Time Tracking Page (Most Complex)
**File:** `src/app/(app)/time-tracking/page.tsx`

**Current Firebase Usage:**
- Multiple `useCollection` with complex queries
- `getDocs` for fetching data
- `addDoc`, `updateDoc`, `deleteDoc` for CRUD
- Batch operations
- Real-time queries for active entries

**Migration Steps:**
1. Replace imports:
   ```typescript
   // Remove
   import { useFirestore } from "@/firebase";
   import { useCollection } from "@/firebase/firestore/use-collection";
   import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
   
   // Add
   import { useCollection } from "@/lib/api/client";
   import { apiClient } from "@/lib/api/client";
   ```

2. Replace collection queries:
   ```typescript
   // Before
   const clientsQuery = useMemo(() => {
     if (!firestore) return null;
     return query(collection(firestore, "clients"), where("name", "!=", ""));
   }, [firestore]);
   const { data: clients } = useCollection<Client>(clientsQuery);
   
   // After
   const { data: allClients } = useCollection<Client>('/api/clients');
   const clients = allClients?.filter(c => c.name !== "") || null;
   ```

3. Replace getDocs calls:
   ```typescript
   // Before
   const activeEntriesSnap = await getDocs(activeEntriesQuery);
   const activeEntries = activeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
   
   // After
   const activeEntries = await apiClient.getCollection('/api/time_entries', { employeeId: employee.id });
   const filtered = activeEntries.filter(e => e.endTime === null);
   ```

4. Replace CRUD operations:
   ```typescript
   // Before
   await addDoc(collection(firestore, 'time_entries'), newEntry);
   
   // After
   await apiClient.create('/api/time_entries', newEntry);
   ```

#### Dashboard Live Activity
**File:** `src/app/(app)/dashboard/live-activity.tsx`

Much simpler than time tracking - follow same pattern as above.

#### Payroll Form
**File:** `src/app/(app)/payroll/payroll-form.tsx`

Replace `getDocs` calls with `apiClient.getCollection` for:
- Employees
- Tasks
- Clients
- Time entries (with date filtering)
- Piecework (with date filtering)

#### Invoicing Form
**File:** `src/app/(app)/invoicing/invoicing-form.tsx`

Similar to payroll form.

### 2. Enhance API Routes (Optional)

For complex filtering that was done with Firebase `where` clauses, you can enhance the API routes:

**Example: Add date filtering to time_entries API**

```typescript
// src/app/api/time_entries/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let entries = await getCollection<TimeEntry>('time_entries');
    
    // Filter by date range
    if (startDate) {
      entries = entries.filter(e => 
        new Date(e.timestamp) >= new Date(startDate)
      );
    }
    if (endDate) {
      entries = entries.filter(e => 
        new Date(e.timestamp) <= new Date(endDate)
      );
    }
    
    return NextResponse.json(entries);
  } catch (error) {
    // ...
  }
}
```

### 3. Testing

After migrating each page:

1. Start dev server: `npm run dev`
2. Test all functionality on that page
3. Verify data persists in `/data` directory
4. Check browser console for errors
5. Test with multiple browser tabs (for polling)

### 4. Cleanup (Final Step)

Once all pages are migrated:

1. Remove unused Firebase imports
2. Consider removing `src/firebase/` directory (keep auth if still needed)
3. Update `package.json` to remove unused Firebase packages (keep auth packages)
4. Remove `firestore.rules` and `firestore.indexes.json`

## Quick Reference

### Common Replacements

| Firebase | Next.js API |
|----------|-------------|
| `useFirestore()` | Not needed |
| `collection(firestore, 'employees')` | `'/api/employees'` |
| `query(collection(...), orderBy('name'))` | `useCollection('/api/employees', { params: { orderBy: 'name' } })` |
| `useCollection<T>(firestoreQuery)` | `useCollection<T>(apiEndpoint, options)` |
| `addDoc(collection(...), data)` | `apiClient.create(endpoint, data)` |
| `updateDoc(doc(...), data)` | `apiClient.update(endpoint, data)` |
| `deleteDoc(doc(...))` | `apiClient.delete(endpoint)` |
| `getDocs(query(...))` | `apiClient.getCollection(endpoint, params)` |
| `doc(firestore, 'employees', id)` | `'/api/employees/${id}'` |
| `onSnapshot` | Automatic polling in `useCollection`/`useDocument` |

### Error Handling

Replace:
```typescript
.catch(async (serverError) => {
  const permissionError = new FirestorePermissionError({...});
  errorEmitter.emit('permission-error', permissionError);
})
```

With:
```typescript
try {
  // operation
} catch (error) {
  console.error('Error:', error);
  toast({
    variant: 'destructive',
    title: 'Error',
    description: 'Operation failed. Please try again.',
  });
}
```

## Need Help?

Refer to the migrated files for examples:
- `src/app/(app)/employees/page.tsx` - Complex queries and calculated fields
- `src/app/(app)/employees/add-employee-dialog.tsx` - Create operations
- `src/app/(app)/employees/edit-employee-dialog.tsx` - Update operations
- `src/app/(app)/employees/delete-employee-dialog.tsx` - Delete operations
