import { NextRequest, NextResponse } from 'next/server';
import { getCollection, addDocument, queryCollection } from '@/lib/db';
import type { Task } from '@/lib/types';

// GET /api/tasks - Get all tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderByField = searchParams.get('orderBy') as keyof Task | null;
    
    let tasks: Task[];
    
    if (orderByField) {
      tasks = await queryCollection<Task>(
        'tasks',
        undefined,
        { field: orderByField, direction: 'asc' }
      );
    } else {
      tasks = await getCollection<Task>('tasks');
    }
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = await addDocument<Omit<Task, 'id'>>('tasks', body);
    
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
