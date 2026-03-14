import { describe, it, expect, vi } from 'vitest';
import { loadJson, saveJson, STORAGE_KEYS } from './storage';

describe('loadJson', () => {
  it('returns fallback when key is absent', () => {
    expect(loadJson('missing-key', 42)).toBe(42);
  });

  it('parses stored value correctly', () => {
    localStorage.setItem('test-key', JSON.stringify({ a: 1 }));
    expect(loadJson('test-key', {})).toEqual({ a: 1 });
  });

  it('returns fallback on malformed JSON', () => {
    localStorage.setItem('bad-key', 'not-json{');
    expect(loadJson('bad-key', 'default')).toBe('default');
  });

  it('round-trips nested objects', () => {
    const obj = { nested: { arr: [1, 2, 3], str: 'hello' } };
    saveJson('nested-key', obj);
    expect(loadJson('nested-key', null)).toEqual(obj);
  });

  it('returns fallback for array when key is absent', () => {
    expect(loadJson('absent-arr', [] as number[])).toEqual([]);
  });
});

describe('saveJson then loadJson', () => {
  it('reads back the same data', () => {
    const data = { x: true, y: [1, 'two'] };
    saveJson('roundtrip', data);
    expect(loadJson('roundtrip', null)).toEqual(data);
  });

  it('overwrites previously stored value', () => {
    saveJson('overwrite-key', { v: 1 });
    saveJson('overwrite-key', { v: 2 });
    expect(loadJson('overwrite-key', null)).toEqual({ v: 2 });
  });
});

describe('STORAGE_KEYS', () => {
  it('all values are unique non-empty strings', () => {
    const values = Object.values(STORAGE_KEYS);
    expect(values.every((v) => typeof v === 'string' && v.length > 0)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('loadJson edge cases', () => {
  it('stored null returns null (not fallback)', () => {
    localStorage.setItem('null-key', JSON.stringify(null));
    expect(loadJson('null-key', 'fallback')).toBeNull();
  });
});

describe('saveJson error handling', () => {
  it('swallows QuotaExceededError without throwing', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      const err = new DOMException('QuotaExceededError', 'QuotaExceededError');
      throw err;
    });
    expect(() => saveJson('any-key', { data: 'x' })).not.toThrow();
    vi.restoreAllMocks();
  });
});
