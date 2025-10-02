import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

type ErrorEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

// We can't use the native EventEmitter type because it doesn't support typed events
// This is a workaround to get typed events with a generic EventEmitter.
declare interface TypedEventEmitter<T extends Record<string, (...args: any[]) => void>> {
  on<E extends keyof T>(event: E, listener: T[E]): this;
  off<E extends keyof T>(event: E, listener: T[E]): this;
  emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>): boolean;
}

class TypedEventEmitter<
  T extends Record<string, (...args: any[]) => void>,
> extends EventEmitter {}

export const errorEmitter = new TypedEventEmitter<ErrorEvents>();
