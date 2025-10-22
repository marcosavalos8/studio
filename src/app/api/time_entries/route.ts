import { NextRequest, NextResponse } from 'next/server';
import { getCollection, addDocument, queryCollection } from '@/lib/db';
import type { TimeEntry } from '@/lib/types';

// GET /api/time_entries - Get all time entries with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const taskId = searchParams.get('taskId');
    const orderByField = searchParams.get('orderBy') as keyof TimeEntry | null;
    
    let timeEntries: TimeEntry[];
    
    // Build filter function
    const filter = (entry: TimeEntry & { id: string }) => {
      if (employeeId && entry.employeeId !== employeeId) return false;
      if (taskId && entry.taskId !== taskId) return false;
      return true;
    };
    
    if (orderByField || employeeId || taskId) {
      timeEntries = await queryCollection<TimeEntry>(
        'time_entries',
        filter,
        orderByField ? { field: orderByField, direction: 'asc' } : undefined
      );
    } else {
      timeEntries = await getCollection<TimeEntry>('time_entries');
    }
    
    // Convert timestamp strings back to Date objects for consistency
    const processedEntries = timeEntries.map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
      endTime: entry.endTime ? new Date(entry.endTime) : null,
    }));
    
    return NextResponse.json(processedEntries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time entries' },
      { status: 500 }
    );
  }
}

// POST /api/time_entries - Create new time entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const timeEntry = await addDocument<Omit<TimeEntry, 'id'>>('time_entries', body);
    
    return NextResponse.json(timeEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return NextResponse.json(
      { error: 'Failed to create time entry' },
      { status: 500 }
    );
  }
}
