#!/usr/bin/env node

/**
 * Test script to verify the API routes are working
 * Run this after starting the dev server
 */

const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Next.js API Routes\n');
  
  const tests = [
    {
      name: 'GET /api/employees',
      method: 'GET',
      url: `${baseUrl}/api/employees`
    },
    {
      name: 'GET /api/tasks',
      method: 'GET',
      url: `${baseUrl}/api/tasks`
    },
    {
      name: 'GET /api/clients',
      method: 'GET',
      url: `${baseUrl}/api/clients`
    },
    {
      name: 'GET /api/time_entries',
      method: 'GET',
      url: `${baseUrl}/api/time_entries`
    },
    {
      name: 'GET /api/piecework',
      method: 'GET',
      url: `${baseUrl}/api/piecework`
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const response = await fetch(test.url, { method: test.method });
      if (response.ok) {
        const data = await response.json();
        console.log(`✓ ${test.name} - Status ${response.status} (${Array.isArray(data) ? data.length : 0} items)`);
        passed++;
      } else {
        console.log(`✗ ${test.name} - Status ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${test.name} - Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All API tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Make sure the dev server is running (npm run dev)');
  }
}

testAPI().catch(console.error);
