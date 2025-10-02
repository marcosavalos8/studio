import type { Employee, Client, Task } from '@/lib/types';
import { getFirestore } from "firebase/firestore";
import { addDoc, collection } from "firebase/firestore";


export const employees: Employee[] = [
  { id: 'emp-01', name: 'Maria Garcia', qrCode: 'qr-maria-garcia', role: 'Worker' },
  { id: 'emp-02', name: 'Jose Rodriguez', qrCode: 'qr-jose-rodriguez', role: 'Worker' },
  { id: 'emp-03', name: 'John Smith', qrCode: 'qr-john-smith', role: 'Supervisor' },
  { id: 'emp-04', name: 'Ana Hernandez', qrCode: 'qr-ana-hernandez', role: 'Worker' },
  { id: 'emp-05', name: 'David Wilson', qrCode: 'qr-david-wilson', role: 'Worker' },
  { id: 'emp-06', name: 'Sofia Martinez', qrCode: 'qr-sofia-martinez', role: 'Worker' },
];

export const clients: Client[] = [
  { id: 'cli-01', name: 'Green Valley Farms', billingAddress: '123 Farm Rd, Yakima, WA', paymentTerms: 'Net 30' },
  { id: 'cli-02', name: 'Sunrise Orchards', billingAddress: '456 Orchard Ln, Wenatchee, WA', paymentTerms: 'Net 15' },
  { id: 'cli-03', name: 'Columbia Basin Produce', billingAddress: '789 Produce Ave, Pasco, WA', paymentTerms: 'Net 45' },
];

export const tasks: Task[] = [
  { id: 'task-01', name: 'Apple Picking', client: 'Green Valley Farms', clientRate: 20, clientRateType: 'piece', employeePayType: 'piecework', employeeRate: 0.5, status: 'Active' },
  { id: 'task-02', name: 'Cherry Sorting', client: 'Sunrise Orchards', clientRate: 25, clientRateType: 'hourly', employeePayType: 'hourly', employeeRate: 18, status: 'Active' },
  { id: 'task-03', name: 'Vineyard Pruning', client: 'Green Valley Farms', clientRate: 22, clientRateType: 'hourly', employeePayType: 'hourly', employeeRate: 19, status: 'Inactive' },
  { id: 'task-04', name: 'Packing Boxes', client: 'Columbia Basin Produce', clientRate: 0.8, clientRateType: 'piece', employeePayType: 'piecework', employeeRate: 0.2, status: 'Active' },
  { id: 'task-05', name: 'Harvesting Asparagus', client: 'Columbia Basin Produce', clientRate: 1.2, clientRateType: 'piece', employeePayType: 'piecework', employeeRate: 0.3, status: 'Completed' },
];

// NOTE: This is an example of how you might seed data.
// This function is not called anywhere and is for demonstration purposes.
async function seedDatabase() {
    const db = getFirestore();
    try {
        for (const employee of employees) {
            await addDoc(collection(db, "employees"), employee);
        }
        for (const client of clients) {
            await addDoc(collection(db, "clients"), client);
        }
        for (const task of tasks) {
            await addDoc(collection(db, "tasks"), task);
        }
        console.log("Database seeded successfully!");
    } catch (error) {
        console.error("Error seeding database: ", error);
    }
}
