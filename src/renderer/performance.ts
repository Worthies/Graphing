/**
 * Performance optimization utilities for SVG Editor.
 */

interface WindowWithIdleCallback extends Window {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
}

declare const window: WindowWithIdleCallback;

/**
 * Request idle callback with fallback for browsers that don't support it
 */
export const requestIdleCallback =
  typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback.bind(window)
    : (callback: () => void, _options?: { timeout?: number }) => {
        return setTimeout(callback, 0) as unknown as number;
      };

/**
 * Cancel idle callback with fallback
 */
export const cancelIdleCallback =
  typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function'
    ? window.cancelIdleCallback.bind(window)
    : (id: number) => clearTimeout(id);

/**
 * Debounce function with leading/trailing options
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  const { leading = false, trailing = true } = options;

  return function (this: any, ...args: Parameters<T>) {
    const invokeLeading = leading && !timeout;
    lastArgs = args;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = window.setTimeout(() => {
      timeout = null;
      if (trailing && lastArgs) {
        func.apply(this, lastArgs);
      }
      lastArgs = null;
    }, wait) as unknown as number;

    if (invokeLeading) {
      func.apply(this, args);
    }
  };
}

/**
 * Throttle function - ensures function is called at most once in specified interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Batch DOM reads and writes to avoid layout thrashing
 */
export class DomBatcher {
  private reads: Array<() => void> = [];
  private writes: Array<() => void> = [];
  private scheduled = false;

  read(fn: () => void): void {
    this.reads.push(fn);
    this.schedule();
  }

  write(fn: () => void): void {
    this.writes.push(fn);
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;

    requestAnimationFrame(() => {
      // Execute all reads first
      const reads = this.reads.splice(0);
      reads.forEach(fn => fn());

      // Then execute all writes
      const writes = this.writes.splice(0);
      writes.forEach(fn => fn());

      this.scheduled = false;
    });
  }
}

/**
 * Memoize function results with LRU cache
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  maxSize: number = 100
): T {
  const cache = new Map<string, { args: Parameters<T>; result: ReturnType<T> }>();

  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      const entry = cache.get(key)!;
      // Move to end (most recently used)
      cache.delete(key);
      cache.set(key, entry);
      return entry.result;
    }

    const result = func.apply(this, args);

    // Evict oldest entry if cache is full
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, { args, result });
    return result;
  } as T;
}

/**
 * Lazy initializer - creates value only on first access
 */
export function lazy<T>(factory: () => T): () => T {
  let value: T | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      value = factory();
      initialized = true;
    }
    return value!;
  };
}

/**
 * Measure execution time of a function
 */
export function measureTime<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  if (duration > 16) { // More than one frame
    console.warn(`[SVG Editor] ${name} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

/**
 * Create a simple object pool for reusing objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;

  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize: number = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}
