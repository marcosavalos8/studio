import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateDocument, deleteDocument } from '@/lib/db';
import type { Piecework } from '@/lib/types';

// GET /api/piecework/[id] - Get single piecework
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const piecework = await getDocument<Piecework>('piecework', params.id);
    
    if (!piecework) {
      return NextResponse.json(
        { error: 'Piecework not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(piecework);
  } catch (error) {
    console.error('Error fetching piecework:', error);
    return NextResponse.json(
      { error: 'Failed to fetch piecework' },
      { status: 500 }
    );
  }
}

// PATCH /api/piecework/[id] - Update piecework
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const piecework = await updateDocument<Piecework>('piecework', params.id, body);
    
    return NextResponse.json(piecework);
  } catch (error) {
    console.error('Error updating piecework:', error);
    return NextResponse.json(
      { error: 'Failed to update piecework' },
      { status: 500 }
    );
  }
}

// DELETE /api/piecework/[id] - Delete piecework
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteDocument('piecework', params.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting piecework:', error);
    return NextResponse.json(
      { error: 'Failed to delete piecework' },
      { status: 500 }
    );
  }
}
