import type { Employee, Client, Task } from '@/lib/types';
import { getFirestore } from "firebase/firestore";
import { addDoc, collection } from "firebase/firestore";


export const employees: Omit<Employee, 'id'>[] = [
  { name: 'Maria Garcia', qrCode: 'qr-maria-garcia', role: 'Worker', status: 'Active' },
  { name: 'Jose Rodriguez', qrCode: 'qr-jose-rodriguez', role: 'Worker', status: 'Active' },
  { name: 'John Smith', qrCode: 'qr-john-smith', role: 'Supervisor', status: 'Active' },
  { name: 'Ana Hernandez', qrCode: 'qr-ana-hernandez', role: 'Worker', status: 'Inactive' },
  { name: 'David Wilson', qrCode: 'qr-david-wilson', role: 'Worker', status: 'Active' },
  { name: 'Sofia Martinez', qrCode: 'qr-sofia-martinez', role: 'Worker', status: 'Inactive' },
];

export const clients: Omit<Client, 'id'>[] = [
  { name: 'Green Valley Farms', billingAddress: '123 Farm Rd, Yakima, WA', paymentTerms: 'Net 30' },
  { name: 'Sunrise Orchards', billingAddress: '456 Orchard Ln, Wenatchee, WA', paymentTerms: 'Net 15' },
  { name: 'Columbia Basin Produce', billingAddress: '789 Produce Ave, Pasco, WA', paymentTerms: 'Net 45' },
];

// This is a simplified representation to link tasks to clients by name for seeding.
// In a real app, you'd use the generated IDs.
const tasksWithClientNames: Omit<Task, 'id' | 'clientId'> & { clientName: string }[] = [
    { name: 'Apple Picking', variety: 'Gala', clientName: 'Green Valley Farms', clientRate: 20, clientRateType: 'piece', employeePayType: 'piecework', employeeRate: 0.5, status: 'Active' },
    { name: 'Cherry Sorting', clientName: 'Sunrise Orchards', clientRate: 25, clientRateType: 'hourly', employeePayType: 'hourly', employeeRate: 18, status: 'Active' },
    { name: 'Vineyard Pruning', clientName: 'Green Valley Farms', clientRate: 22, clientRateType: 'hourly', employeePayType: 'hourly', employeeRate: 19, status: 'Inactive' },
    { name: 'Packing Boxes', variety: 'Mixed', clientName: 'Columbia Basin Produce', clientRate: 0.8, clientRateType: 'piece', employeePayType: 'piecework', employeeRate: 0.2, status: 'Active' },
    { name: 'Harvesting Asparagus', clientName: 'Columbia Basin Produce', clientRate: 1.2, clientRateType: 'piece', employeePayType: 'piecework', employeeRate: 0.3, status: 'Completed' },
];


// NOTE: This is an example of how you might seed data.
// This function is not called anywhere and is for demonstration purposes.
async function seedDatabase() {
    const db = getFirestore();
    try {
        const employeeRefs = await Promise.all(employees.map(employee => addDoc(collection(db, "employees"), employee)));
        
        const clientRefs = await Promise.all(clients.map(async (client) => {
            const docRef = await addDoc(collection(db, "clients"), client);
            return { ...client, id: docRef.id };
        }));

        const clientMap = new Map(clientRefs.map(c => [c.name, c.id]));

        for (const task of tasksWithClientNames) {
            const clientId = clientMap.get(task.clientName);
            if (clientId) {
                const taskData: Omit<Task, 'id'> = {
                    name: task.name,
                    variety: task.variety,
                    clientId: clientId,
                    clientRate: task.clientRate,
                    clientRateType: task.clientRateType,
                    employeePayType: task.employeePayType,
                    employeeRate: task.employeeRate,
                    status: task.status,
                };
                await addDoc(collection(db, "tasks"), taskData);
            }
        }
        
        console.log("Database seeded successfully!");
    } catch (error) {
        console.error("Error seeding database: ", error);
    }
}
