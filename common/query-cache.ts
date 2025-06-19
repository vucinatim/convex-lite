/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WrappedApiFunction } from "convex/_lib/server";

// --- Generic Type Helpers ---
// These are defined here because they are essential for the `localStore` object.
export type ArgsType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<infer A, any> ? A : never;
export type RetType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<any, infer R> ? R : never;

// --- Client-Side Cache for Queries ---

class QueryCache {
  private cache = new Map<string, any>();
  private subscribers = new Map<string, Set<() => void>>();

  /**
   * Gets a value from the cache.
   * @param key The cache key.
   * @returns The cached value or undefined.
   */
  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  /**
   * Sets a value in the cache and notifies all subscribers for that key.
   * @param key The cache key.
   * @param value The new value to set.
   */
  set<T>(key: string, value: T) {
    this.cache.set(key, value);
    this.subscribers.get(key)?.forEach((callback) => callback());
  }

  /**
   * Allows a component to subscribe to changes for a specific key.
   * @param key The cache key to subscribe to.
   * @param callback The function to call when the key's value changes.
   * @returns An unsubscribe function.
   */
  subscribe = (key: string, callback: () => void) => {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  };
}

// Export a singleton instance of the cache.
export const queryCache = new QueryCache();

/**
 * A helper to create a stable, unique key for the cache from a query and its parameters.
 * @param queryKeyString The string identifier of the query (e.g., "tasks:getTasks").
 * @param params The parameters passed to the query.
 * @returns A unique string cache key.
 */
export function getQueryCacheKey(queryKeyString: string, params: any): string {
  return JSON.stringify([queryKeyString, params || null]);
}

// --- The LocalStore for Optimistic Updates ---

/**
 * THE FIX - Step 1: Define the type of the local store first as an interface.
 * This breaks the circular type reference.
 */
export interface LocalStore {
  getQuery<T extends WrappedApiFunction<any, any>>(
    queryFunc: T,
    args: ArgsType<T>
  ): RetType<T> | undefined;
  setQuery<T extends WrappedApiFunction<any, any>>(
    queryFunc: T,
    args: ArgsType<T>,
    value: RetType<T>
  ): void;
}

/**
 * The `localStore` object is passed to the optimistic update function,
 * allowing it to synchronously read from and write to the client-side cache.
 */
export const localStore: LocalStore = {
  getQuery<T extends WrappedApiFunction<any, any>>(
    queryFunc: T,
    args: ArgsType<T>
  ): RetType<T> | undefined {
    const key = getQueryCacheKey(queryFunc as unknown as string, args);
    return queryCache.get(key);
  },
  setQuery<T extends WrappedApiFunction<any, any>>(
    queryFunc: T,
    args: ArgsType<T>,
    value: RetType<T>
  ) {
    const key = getQueryCacheKey(queryFunc as unknown as string, args);
    queryCache.set(key, value);
  },
};

/**
 * The type definition for the optimistic update function provided by the user.
 * THE FIX - Step 2: It now references the `LocalStore` interface, not `typeof localStore`.
 */
export type OptimisticUpdate<T extends WrappedApiFunction<any, any>> = (
  localStore: LocalStore,
  args: ArgsType<T>
) => void;
