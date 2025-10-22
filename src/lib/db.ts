/**
 * Simple file-based database layer to replace Firebase Firestore
 * Stores data in JSON files and provides CRUD operations
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Initialize default data files
async function initializeCollection(collectionName: string, defaultData: any[] = []) {
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
  }
}

// Read collection
export async function getCollection<T>(collectionName: string): Promise<T[]> {
  await ensureDataDir();
  await initializeCollection(collectionName);
  
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

// Get single document
export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const items = await getCollection<T & { id: string }>(collectionName);
  return items.find(item => item.id === id) || null;
}

// Add document
export async function addDocument<T>(collectionName: string, data: T & { id?: string }): Promise<T & { id: string }> {
  await ensureDataDir();
  const items = await getCollection<T & { id: string }>(collectionName);
  
  const id = data.id || generateId();
  const newItem = { ...data, id };
  items.push(newItem);
  
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2));
  
  return newItem;
}

// Update document
export async function updateDocument<T>(
  collectionName: string,
  id: string,
  data: Partial<T>
): Promise<T & { id: string }> {
  const items = await getCollection<T & { id: string }>(collectionName);
  const index = items.findIndex(item => item.id === id);
  
  if (index === -1) {
    throw new Error(`Document with id ${id} not found`);
  }
  
  items[index] = { ...items[index], ...data };
  
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2));
  
  return items[index];
}

// Delete document
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  const items = await getCollection<{ id: string }>(collectionName);
  const filtered = items.filter(item => item.id !== id);
  
  if (filtered.length === items.length) {
    throw new Error(`Document with id ${id} not found`);
  }
  
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  await fs.writeFile(filePath, JSON.stringify(filtered, null, 2));
}

// Query collection with filters
export async function queryCollection<T>(
  collectionName: string,
  filter?: (item: T & { id: string }) => boolean,
  orderBy?: { field: keyof T; direction?: 'asc' | 'desc' }
): Promise<(T & { id: string })[]> {
  let items = await getCollection<T & { id: string }>(collectionName);
  
  // Apply filter
  if (filter) {
    items = items.filter(filter);
  }
  
  // Apply ordering
  if (orderBy) {
    items.sort((a, b) => {
      const aVal = a[orderBy.field];
      const bVal = b[orderBy.field];
      const direction = orderBy.direction === 'desc' ? -1 : 1;
      
      if (aVal < bVal) return -1 * direction;
      if (aVal > bVal) return 1 * direction;
      return 0;
    });
  }
  
  return items;
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize all collections on startup
export async function initializeDatabase() {
  await ensureDataDir();
  await initializeCollection('employees', []);
  await initializeCollection('tasks', []);
  await initializeCollection('clients', []);
  await initializeCollection('time_entries', []);
  await initializeCollection('piecework', []);
}
