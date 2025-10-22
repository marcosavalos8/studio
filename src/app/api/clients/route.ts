import { NextRequest, NextResponse } from 'next/server';
import { getCollection, addDocument, queryCollection } from '@/lib/db';
import type { Client } from '@/lib/types';

// GET /api/clients - Get all clients
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderByField = searchParams.get('orderBy') as keyof Client | null;
    
    let clients: Client[];
    
    if (orderByField) {
      clients = await queryCollection<Client>(
        'clients',
        undefined,
        { field: orderByField, direction: 'asc' }
      );
    } else {
      clients = await getCollection<Client>('clients');
    }
    
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await addDocument<Omit<Client, 'id'>>('clients', body);
    
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
