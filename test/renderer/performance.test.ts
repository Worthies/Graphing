/**
 * Tests for performance utilities
 */

import { debounce, throttle, memoize, lazy } from '../../src/renderer/performance';

describe('performance', () => {
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset delay on subsequent calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced();
      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to function', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should support leading edge', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100, { leading: true });

      debounced();
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should execute immediately on first call', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not execute again within limit', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute again after limit', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      jest.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const fn = jest.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle different arguments', () => {
      const fn = jest.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(5)).toBe(10);
      expect(memoized(10)).toBe(20);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should evict oldest entry when cache is full', () => {
      const fn = jest.fn((x: number) => x);
      const memoized = memoize(fn, 2);

      memoized(1);
      memoized(2);
      memoized(3); // Should evict 1

      expect(memoized(1)).toBe(1); // Should recompute
      expect(fn).toHaveBeenCalledTimes(4); // 3 + 1 recomputation
    });
  });

  describe('lazy', () => {
    it('should initialize value on first access', () => {
      const factory = jest.fn(() => 42);
      const lazyValue = lazy(factory);

      expect(factory).not.toHaveBeenCalled();
      expect(lazyValue()).toBe(42);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should return same value on subsequent access', () => {
      const factory = jest.fn(() => ({ key: 'value' }));
      const lazyValue = lazy(factory);

      const first = lazyValue();
      const second = lazyValue();

      expect(first).toBe(second);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });
});
