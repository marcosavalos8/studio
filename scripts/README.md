# Calculate Sick Hours Script

## Purpose

This script calculates and updates sick hours for all employees based on their historical time entries (clock-in/clock-out records).

## What It Does

1. **Fetches all employees** from the database
2. **Fetches all time entries** for each employee
3. **Calculates total hours worked** from completed time entries
4. **Calculates sick hours balance** using the formula: 1 sick hour per 40 hours worked
5. **Accounts for sick hours used** by subtracting hours where `useSickHoursForPayment` was true
6. **Updates employee records** with:
   - `totalHoursWorked`: Total hours worked across all time entries
   - `sickHoursBalance`: Accumulated sick hours minus used hours

## When to Use

- **Initial Migration**: Run once to populate sick hours for existing employees who have historical time entries
- **Data Correction**: Run if sick hours data becomes out of sync
- **Periodic Verification**: Run periodically to ensure data integrity

## Setup

### 1. Install Dependencies

```bash
npm install firebase-admin
```

### 2. Set Up Firebase Admin Credentials

You need a Firebase service account key. Get it from:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file

### 3. Set Environment Variables

Create a `.env.local` file or set these environment variables:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Or use the service account JSON directly:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
```

## Usage

### Using tsx (recommended)

```bash
npx tsx scripts/calculate-sick-hours.ts
```

### Using ts-node

```bash
npx ts-node scripts/calculate-sick-hours.ts
```

### Compile and Run

```bash
npx tsc scripts/calculate-sick-hours.ts
node scripts/calculate-sick-hours.js
```

## Example Output

```
Starting sick hours calculation for all employees...

Found 5 employees

Processing employee: Juan Pérez (emp123)
  - Total hours worked: 320.00 hrs (40 entries)
  - Sick hours accrued: 8.00 hrs
  - Sick hours used: 0.00 hrs
  - Final sick hours balance: 8.00 hrs
  ✓ Updated employee record

Processing employee: María García (emp456)
  - Total hours worked: 160.00 hrs (20 entries)
  - Sick hours accrued: 4.00 hrs
  - Sick hours used: 8.00 hrs
  - Final sick hours balance: -4.00 hrs
  ✓ Updated employee record

...

✅ Sick hours calculation completed successfully!
```

## Important Notes

### Time Entry Filtering

The script only counts time entries that:
- ✅ Have a completed `endTime` (not active/ongoing)
- ✅ Are NOT marked as breaks (`isBreak: false`)
- ✅ Are NOT sick leave entries (`isSickLeave: false`)
- ✅ Have positive hours worked (endTime > timestamp)

### Sick Hours Calculation

```
sickHoursAccrued = totalHoursWorked / 40
sickHoursBalance = sickHoursAccrued - hoursUsedForSickPayment
```

### Negative Balance

If an employee has used more sick hours than they've accrued, they may have a negative balance. This is normal and indicates they need to work more hours to build up their balance.

### Data Safety

- The script only **updates** employee records, it doesn't delete anything
- Time entries are **read-only**, never modified
- You can run the script multiple times safely - it recalculates from scratch each time

## Troubleshooting

### "Permission Denied" Error

Make sure your Firebase service account has the necessary permissions:
- Read access to `employees` collection
- Read access to `time_entries` collection
- Write access to `employees` collection

### "Module not found" Error

Install the required dependencies:
```bash
npm install firebase-admin
```

### TypeScript Errors

Make sure you have TypeScript installed:
```bash
npm install -D typescript tsx ts-node
```

## Integration with Application

After running this script, the employees page will display the calculated sick hours:
- Navigate to **Employees** page
- Check the "Sick Hours" column
- Values should now reflect actual accumulated hours from historical data

## Maintenance

### When to Re-run

You generally don't need to re-run this script because:
- New clock-outs automatically update `totalHoursWorked` and `sickHoursBalance`
- The automated system in the app keeps data current

Re-run only if:
- You suspect data corruption
- You need to recalculate for all employees
- You're migrating from an older system

## See Also

- `SICK_HOURS_AUTOMATION.md` - Technical documentation for the automated system
- `GUIA_HORAS_ENFERMEDAD_ES.md` - User guide in Spanish
- `src/app/(app)/time-tracking/page.tsx` - Automated calculation code
