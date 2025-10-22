# Getting Started with the New Next.js API Backend

## Quick Start

### 1. Initialize Sample Data

Run the initialization script to create sample data:

```bash
node scripts/init-data.js
```

This creates the `/data` directory with sample employees, clients, and tasks.

### 2. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 3. Test the API (Optional)

In a separate terminal, test the API endpoints:

```bash
node scripts/test-api.js
```

## What's Different?

### Before (Firebase)
- Data stored in Firebase Firestore (cloud)
- Required Firebase project setup
- Used Firebase SDK for all data operations
- Real-time updates via `onSnapshot`

### After (Next.js API)
- Data stored in local JSON files (`/data` directory)
- No external dependencies for data storage
- Uses REST API endpoints
- Real-time updates via polling (3-second interval)

## Features Working Now

✅ **Employees Management**
- View all employees
- Add new employees
- Edit employee details
- Delete employees
- Print employee badges

✅ **Tasks Management**
- View all tasks grouped by client
- Add new tasks
- Edit task details
- Delete tasks

✅ **Clients Management**
- View all clients
- Add new clients
- Edit client details
- Delete clients

## API Endpoints

All endpoints return JSON:

### Employees
- `GET /api/employees` - List all employees
- `GET /api/employees?orderBy=name` - List employees ordered by name
- `GET /api/employees/[id]` - Get single employee
- `POST /api/employees` - Create employee
- `PATCH /api/employees/[id]` - Update employee
- `DELETE /api/employees/[id]` - Delete employee

### Tasks
- `GET /api/tasks` - List all tasks
- `GET /api/tasks?orderBy=name` - List tasks ordered by name
- `GET /api/tasks/[id]` - Get single task
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

### Clients
- `GET /api/clients` - List all clients
- `GET /api/clients?orderBy=name` - List clients ordered by name
- `GET /api/clients/[id]` - Get single client
- `POST /api/clients` - Create client
- `PATCH /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Delete client

### Time Entries
- `GET /api/time_entries` - List all time entries
- `GET /api/time_entries?employeeId=xxx` - Filter by employee
- `GET /api/time_entries/[id]` - Get single time entry
- `POST /api/time_entries` - Create time entry
- `PATCH /api/time_entries/[id]` - Update time entry
- `DELETE /api/time_entries/[id]` - Delete time entry

### Piecework
- `GET /api/piecework` - List all piecework
- `GET /api/piecework?employeeId=xxx` - Filter by employee
- `GET /api/piecework/[id]` - Get single piecework
- `POST /api/piecework` - Create piecework
- `PATCH /api/piecework/[id]` - Update piecework
- `DELETE /api/piecework/[id]` - Delete piecework

## Data Storage

Data is stored in JSON files in the `/data` directory:

```
/data/
  employees.json
  tasks.json
  clients.json
  time_entries.json
  piecework.json
```

**Important:** The `/data` directory is gitignored to prevent committing sensitive data.

## Example API Usage

### Using cURL

```bash
# List all employees
curl http://localhost:3000/api/employees

# Get single employee
curl http://localhost:3000/api/employees/emp_1

# Create employee
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","role":"Worker","status":"Active","qrCode":"emp_123"}'

# Update employee
curl -X PATCH http://localhost:3000/api/employees/emp_1 \
  -H "Content-Type: application/json" \
  -d '{"status":"Inactive"}'

# Delete employee
curl -X DELETE http://localhost:3000/api/employees/emp_1
```

### Using JavaScript/TypeScript

```typescript
// In your components (already implemented)
import { useCollection, apiClient } from '@/lib/api/client';

// Fetch data with auto-refresh
const { data: employees, isLoading, error } = useCollection('/api/employees', {
  params: { orderBy: 'name' },
  pollInterval: 3000 // refresh every 3 seconds
});

// Create
await apiClient.create('/api/employees', {
  name: 'John Doe',
  role: 'Worker',
  status: 'Active',
  qrCode: 'emp_123'
});

// Update
await apiClient.update('/api/employees/emp_123', {
  status: 'Inactive'
});

// Delete
await apiClient.delete('/api/employees/emp_123');
```

## Troubleshooting

### Data not persisting?
Make sure the `/data` directory exists and is writable. Run `node scripts/init-data.js` to initialize it.

### API returning 404?
Make sure the dev server is running (`npm run dev`) and you're using the correct endpoint URLs.

### Changes not showing up?
The polling interval is 3 seconds. Wait a few seconds or refresh the page.

### Cannot read from /data directory?
Make sure you've initialized the data with `node scripts/init-data.js` or that the files exist in `/data`.

## Migration Status

### ✅ Completed (60%)
- Employees feature
- Tasks feature  
- Clients feature
- API infrastructure
- Data storage layer

### ⏳ Pending (40%)
- Time tracking page
- Dashboard live activity
- Payroll form
- Invoicing form

See `MIGRATION_NEXT_STEPS.md` for details on completing the migration.

## Authentication

**Note:** Firebase Authentication is still used for user login. Only the database (Firestore) has been migrated to the Next.js API. The default login credentials remain:
- Username: `David`
- Password: `1234`

## Support

For questions or issues with the migration, refer to:
- `MIGRATION_SUMMARY.md` - Complete overview of changes
- `MIGRATION_NEXT_STEPS.md` - Guide for completing remaining work
- Migrated component files for working examples
