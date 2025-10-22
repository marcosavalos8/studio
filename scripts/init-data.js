#!/usr/bin/env node

/**
 * Initialize the data directory with sample data
 * This helps test the migration without having to manually create data
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Sample data
const sampleData = {
  employees: [
    {
      id: 'emp_1',
      name: 'Juan Pérez',
      qrCode: 'emp_1',
      role: 'Worker',
      status: 'Active',
      sickHoursBalance: 0,
      totalHoursWorked: 0
    },
    {
      id: 'emp_2',
      name: 'María García',
      qrCode: 'emp_2',
      role: 'Supervisor',
      status: 'Active',
      sickHoursBalance: 0,
      totalHoursWorked: 0
    }
  ],
  clients: [
    {
      id: 'client_1',
      name: 'Green Valley Farms',
      billingAddress: '123 Farm Road, Yakima, WA 98901',
      paymentTerms: 'Net 30',
      email: 'billing@greenvalley.com',
      commissionRate: 15,
      minimumWage: 16.28,
      contractType: 'Standard'
    }
  ],
  tasks: [
    {
      id: 'task_1',
      name: 'Apple Picking',
      variety: 'Gala',
      ranch: 'North Ranch',
      block: 'Block A',
      clientId: 'client_1',
      clientRate: 18.50,
      clientRateType: 'hourly',
      status: 'Active'
    },
    {
      id: 'task_2',
      name: 'Cherry Sorting',
      variety: 'Bing',
      ranch: 'South Ranch',
      block: 'Block B',
      clientId: 'client_1',
      clientRate: 0.50,
      clientRateType: 'piece',
      piecePrice: 0.50,
      status: 'Active'
    }
  ],
  time_entries: [],
  piecework: []
};

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✓ Created data directory');
}

// Write sample data files
Object.entries(sampleData).forEach(([collection, data]) => {
  const filePath = path.join(dataDir, `${collection}.json`);
  
  if (fs.existsSync(filePath)) {
    console.log(`⚠ Skipping ${collection}.json (already exists)`);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✓ Created ${collection}.json with ${data.length} sample items`);
  }
});

console.log('\n✅ Data initialization complete!');
console.log('You can now start the development server with: npm run dev');
console.log('The API will be available at: http://localhost:3000/api');
