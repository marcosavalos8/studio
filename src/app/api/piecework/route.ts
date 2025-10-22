import { NextRequest, NextResponse } from 'next/server';
import { getCollection, addDocument, queryCollection } from '@/lib/db';
import type { Piecework } from '@/lib/types';

// GET /api/piecework - Get all piecework with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const taskId = searchParams.get('taskId');
    const orderByField = searchParams.get('orderBy') as keyof Piecework | null;
    
    let piecework: Piecework[];
    
    // Build filter function
    const filter = (entry: Piecework & { id: string }) => {
      if (employeeId && entry.employeeId !== employeeId) return false;
      if (taskId && entry.taskId !== taskId) return false;
      return true;
    };
    
    if (orderByField || employeeId || taskId) {
      piecework = await queryCollection<Piecework>(
        'piecework',
        filter,
        orderByField ? { field: orderByField, direction: 'asc' } : undefined
      );
    } else {
      piecework = await getCollection<Piecework>('piecework');
    }
    
    // Convert timestamp strings back to Date objects for consistency
    const processedPiecework = piecework.map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));
    
    return NextResponse.json(processedPiecework);
  } catch (error) {
    console.error('Error fetching piecework:', error);
    return NextResponse.json(
      { error: 'Failed to fetch piecework' },
      { status: 500 }
    );
  }
}

// POST /api/piecework - Create new piecework
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const piecework = await addDocument<Omit<Piecework, 'id'>>('piecework', body);
    
    return NextResponse.json(piecework, { status: 201 });
  } catch (error) {
    console.error('Error creating piecework:', error);
    return NextResponse.json(
      { error: 'Failed to create piecework' },
      { status: 500 }
    );
  }
}
