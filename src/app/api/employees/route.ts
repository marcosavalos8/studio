import { NextRequest, NextResponse } from 'next/server';
import { getCollection, addDocument, queryCollection } from '@/lib/db';
import type { Employee } from '@/lib/types';

// GET /api/employees - Get all employees
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderByField = searchParams.get('orderBy') as keyof Employee | null;
    
    let employees: Employee[];
    
    if (orderByField) {
      employees = await queryCollection<Employee>(
        'employees',
        undefined,
        { field: orderByField, direction: 'asc' }
      );
    } else {
      employees = await getCollection<Employee>('employees');
    }
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

// POST /api/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const employee = await addDocument<Omit<Employee, 'id'>>('employees', body);
    
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
