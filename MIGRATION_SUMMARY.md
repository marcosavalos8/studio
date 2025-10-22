# Firebase to Next.js API Migration Summary

## Migration Overview

This migration replaces Firebase Firestore as the backend data store with Next.js API routes and a file-based JSON storage system. Firebase Authentication is intentionally preserved for user authentication.

## What Was Changed

### 1. New Infrastructure Created

#### Data Storage Layer (`src/lib/db.ts`)
- File-based JSON storage system
- CRUD operations (getCollection, getDocument, addDocument, updateDocument, deleteDocument)
- Query operations with filtering and ordering
- Data stored in `/data` directory (gitignored)

#### API Routes (`src/app/api/`)
Created RESTful API endpoints for all collections:
- `/api/employees` - Employee CRUD operations
- `/api/tasks` - Task CRUD operations
- `/api/clients` - Client CRUD operations  
- `/api/time_entries` - Time entry CRUD operations
- `/api/piecework` - Piecework CRUD operations

Each collection has:
- `GET /api/{collection}` - List all items (with optional orderBy query param)
- `POST /api/{collection}` - Create new item
- `GET /api/{collection}/[id]` - Get single item
- `PATCH /api/{collection}/[id]` - Update item
- `DELETE /api/{collection}/[id]` - Delete item

#### Client Library (`src/lib/api/client.ts`)
- `useCollection<T>(endpoint, options)` - Hook for fetching collections with polling
- `useDocument<T>(endpoint, options)` - Hook for fetching single documents with polling
- `apiClient` - Utility functions for direct API calls:
  - `apiClient.create<T>(endpoint, data)`
  - `apiClient.update<T>(endpoint, data)`
  - `apiClient.delete(endpoint)`
  - `apiClient.getCollection<T>(endpoint, params)`
  - `apiClient.getDocument<T>(endpoint)`

### 2. Migrated Features

#### ✅ Employees Feature
- **Page:** `src/app/(app)/employees/page.tsx`
- **Dialogs:** add, edit, delete
- **Print Badge:** `src/app/(app)/employees/print-badge/[id]/page.tsx`
- **Changes:**
  - Replaced `useFirestore()` and Firebase query builders with `useCollection('/api/employees')`
  - Replaced `addDoc`, `updateDoc`, `deleteDoc` with `apiClient` methods
  - Removed Firebase error handling, replaced with try/catch

#### ✅ Tasks Feature
- **Page:** `src/app/(app)/tasks/page.tsx`
- **Dialogs:** add, edit, delete
- **Changes:**
  - Replaced Firebase queries with API calls
  - Updated task grouping logic (no changes needed, data structure same)

#### ✅ Clients Feature
- **Page:** `src/app/(app)/clients/page.tsx`
- **Dialogs:** add, edit, delete
- **Changes:**
  - Replaced Firebase queries with API calls
  - Maintained all business logic

### 3. Migration Pattern

For any component using Firebase Firestore, follow this pattern:

#### Before (Firebase):
```typescript
import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

const firestore = useFirestore();
const employeesQuery = useMemo(() => {
  if (!firestore) return null;
  return query(collection(firestore, "employees"), orderBy("name"));
}, [firestore]);
const { data: employees, isLoading } = useCollection<Employee>(employeesQuery);

// Create
await addDoc(collection(firestore, 'employees'), newEmployee);

// Update
await updateDoc(doc(firestore, 'employees', id), updates);

// Delete
await deleteDoc(doc(firestore, 'employees', id));
```

#### After (Next.js API):
```typescript
import { useCollection } from "@/lib/api/client";
import { apiClient } from "@/lib/api/client";

const { data: employees, isLoading } = useCollection<Employee>(
  '/api/employees', 
  { params: { orderBy: 'name' } }
);

// Create
await apiClient.create('/api/employees', newEmployee);

// Update
await apiClient.update(`/api/employees/${id}`, updates);

// Delete
await apiClient.delete(`/api/employees/${id}`);
```

## What Still Needs Migration

### ❌ Time Tracking Page (`src/app/(app)/time-tracking/page.tsx`)
This is the most complex file (2775 lines) with extensive Firebase usage:
- Multiple complex queries with date ranges and filters
- Real-time active entries monitoring
- Batch write operations
- QR code scanning integration

**Migration Strategy:**
1. Replace `useCollection` queries with API calls
2. Convert `where` clauses to query parameters in API calls
3. Replace `getDocs` with `apiClient.getCollection`
4. Replace batch operations with individual API calls
5. Keep real-time updates via polling (already implemented in useCollection)

### ❌ Dashboard Live Activity (`src/app/(app)/dashboard/live-activity.tsx`)
- Real-time time entries monitoring
- Similar pattern to time tracking but simpler

### ❌ Payroll Form (`src/app/(app)/payroll/payroll-form.tsx`)
- Complex queries across multiple collections
- Date range filtering
- Aggregation logic

### ❌ Invoicing Form (`src/app/(app)/invoicing/invoicing-form.tsx`)
- Similar complexity to payroll
- Multi-collection queries

## Data Migration

Since we're using file-based storage, you'll need to:

1. Export existing data from Firebase (if any)
2. Convert to JSON format matching the data structure
3. Place in `/data` directory:
   - `/data/employees.json`
   - `/data/tasks.json`
   - `/data/clients.json`
   - `/data/time_entries.json`
   - `/data/piecework.json`

The `/data` directory is gitignored for security.

## Key Differences

### Real-time Updates
- **Firebase:** Uses `onSnapshot` for instant updates
- **Next.js API:** Uses polling (default 3 seconds) with `useCollection` and `useDocument`
- **Impact:** Slight delay in updates (3 seconds) instead of instant

### Query Capabilities
- **Firebase:** Rich query language with `where`, `orderBy`, `limit`, etc.
- **Next.js API:** Simplified - currently supports `orderBy` via query params
- **Note:** Complex filtering should be implemented in API routes as needed

### Error Handling
- **Firebase:** Custom `FirestorePermissionError` and `errorEmitter`
- **Next.js API:** Standard try/catch with toast notifications

## Testing

To test the migrated features:

1. Start the development server: `npm run dev`
2. Access the application at `http://localhost:3000`
3. Test CRUD operations for:
   - Employees (add, edit, delete, print badge)
   - Tasks (add, edit, delete)
   - Clients (add, edit, delete)
4. Verify data persists in `/data` directory
5. Test polling by opening multiple browser tabs

## Benefits of Migration

1. **No External Dependencies:** No Firebase project configuration needed
2. **Full Control:** Complete control over data storage and API behavior
3. **Simpler Deployment:** No Firebase credentials or configuration needed
4. **Local Development:** Easier to develop and test locally
5. **Data Portability:** Data stored in standard JSON format

## Remaining Considerations

1. **Scalability:** File-based storage works for small to medium datasets. For larger scale, consider:
   - PostgreSQL with Prisma
   - MongoDB
   - Another database solution

2. **Concurrent Access:** Current implementation doesn't handle concurrent writes optimally

3. **Search:** Complex search operations would benefit from a proper database

4. **Authentication:** Firebase Auth is still used - this is intentional as the requirement was only to migrate the backend/database, not authentication

## Files Changed

### Created:
- `src/lib/db.ts`
- `src/lib/api/client.ts`
- `src/app/api/employees/route.ts`
- `src/app/api/employees/[id]/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/clients/route.ts`
- `src/app/api/clients/[id]/route.ts`
- `src/app/api/time_entries/route.ts`
- `src/app/api/time_entries/[id]/route.ts`
- `src/app/api/piecework/route.ts`
- `src/app/api/piecework/[id]/route.ts`

### Modified:
- `src/app/(app)/employees/page.tsx`
- `src/app/(app)/employees/add-employee-dialog.tsx`
- `src/app/(app)/employees/edit-employee-dialog.tsx`
- `src/app/(app)/employees/delete-employee-dialog.tsx`
- `src/app/(app)/employees/print-badge/[id]/page.tsx`
- `src/app/(app)/tasks/page.tsx`
- `src/app/(app)/tasks/add-task-dialog.tsx`
- `src/app/(app)/tasks/edit-task-dialog.tsx`
- `src/app/(app)/tasks/delete-task-dialog.tsx`
- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/clients/add-client-dialog.tsx`
- `src/app/(app)/clients/edit-client-dialog.tsx`
- `src/app/(app)/clients/delete-client-dialog.tsx`
- `.gitignore` (added `/data`)
