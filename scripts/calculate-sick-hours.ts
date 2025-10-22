/**
 * Utility script to calculate and update sick hours for employees based on historical time entries
 * 
 * This script:
 * 1. Fetches all employees
 * 2. Fetches all time entries for each employee
 * 3. Calculates total hours worked from all completed time entries
 * 4. Calculates sick hours balance (1 hour per 40 hours worked)
 * 5. Updates employee records with calculated values
 * 
 * Usage:
 * - This can be run as a one-time migration to populate existing employee data
 * - Or periodically to ensure data integrity
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin (you'll need to set up service account credentials)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface TimeEntry {
  id: string;
  employeeId: string;
  timestamp: Timestamp | Date;
  endTime?: Timestamp | Date | null;
  isBreak: boolean;
  isSickLeave?: boolean;
  useSickHoursForPayment?: boolean;
}

interface Employee {
  id: string;
  name: string;
  totalHoursWorked?: number;
  sickHoursBalance?: number;
}

async function calculateEmployeeSickHours() {
  console.log('Starting sick hours calculation for all employees...\n');

  try {
    // Fetch all employees
    const employeesSnapshot = await db.collection('employees').get();
    const employees: Employee[] = employeesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Employee, 'id'>
    }));

    console.log(`Found ${employees.length} employees\n`);

    // Process each employee
    for (const employee of employees) {
      console.log(`Processing employee: ${employee.name} (${employee.id})`);

      // Fetch all time entries for this employee
      const timeEntriesSnapshot = await db.collection('time_entries')
        .where('employeeId', '==', employee.id)
        .get();

      let totalHoursWorked = 0;
      let totalHoursUsedSickHours = 0;
      let completedEntries = 0;

      // Calculate total hours from all completed time entries
      timeEntriesSnapshot.forEach(doc => {
        const entry = doc.data() as TimeEntry;
        
        // Skip if entry is not completed (no endTime)
        if (!entry.endTime) {
          return;
        }

        // Skip if it's a break or sick leave (these don't count toward hours worked)
        if (entry.isBreak || entry.isSickLeave) {
          return;
        }

        // Convert timestamps to dates
        const startTime = entry.timestamp instanceof Timestamp 
          ? entry.timestamp.toDate() 
          : new Date(entry.timestamp);
        const endTime = entry.endTime instanceof Timestamp 
          ? entry.endTime.toDate() 
          : new Date(entry.endTime);

        // Calculate hours worked in this entry
        const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursWorked > 0) {
          totalHoursWorked += hoursWorked;
          completedEntries++;

          // Track hours where sick hours were used for payment
          if (entry.useSickHoursForPayment) {
            totalHoursUsedSickHours += hoursWorked;
          }
        }
      });

      // Calculate sick hours balance
      // 1 sick hour earned per 40 hours worked
      const sickHoursAccrued = totalHoursWorked / 40;
      
      // Deduct hours that were used for sick hours payment
      const sickHoursBalance = sickHoursAccrued - totalHoursUsedSickHours;

      console.log(`  - Total hours worked: ${totalHoursWorked.toFixed(2)} hrs (${completedEntries} entries)`);
      console.log(`  - Sick hours accrued: ${sickHoursAccrued.toFixed(2)} hrs`);
      console.log(`  - Sick hours used: ${totalHoursUsedSickHours.toFixed(2)} hrs`);
      console.log(`  - Final sick hours balance: ${sickHoursBalance.toFixed(2)} hrs`);

      // Update employee record
      await db.collection('employees').doc(employee.id).update({
        totalHoursWorked: totalHoursWorked,
        sickHoursBalance: sickHoursBalance,
      });

      console.log(`  ✓ Updated employee record\n`);
    }

    console.log('✅ Sick hours calculation completed successfully!');
  } catch (error) {
    console.error('❌ Error calculating sick hours:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  calculateEmployeeSickHours()
    .then(() => {
      console.log('\nScript completed. You can now close this process.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

export { calculateEmployeeSickHours };
