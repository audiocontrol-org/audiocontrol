import { describe, it, expect } from 'vitest';
import { isValidMoveTarget } from '../../src/library-fs.js';

describe('isValidMoveTarget', () => {
  it('rejects moving into itself', () => {
    expect(isValidMoveTarget(['a'], 'b', ['a', 'b'])).toBe(false);
  });

  it('rejects moving into a descendant', () => {
    expect(isValidMoveTarget(['a'], 'b', ['a', 'b', 'c'])).toBe(false);
  });

  it('rejects no-op move (same parent)', () => {
    expect(isValidMoveTarget(['a', 'b'], 'item', ['a', 'b'])).toBe(false);
  });

  it('allows moving to a sibling directory', () => {
    expect(isValidMoveTarget(['a'], 'item', ['b'])).toBe(true);
  });

  it('allows moving to root from a subdirectory', () => {
    expect(isValidMoveTarget(['a', 'b'], 'item', [])).toBe(true);
  });

  it('allows moving from root into a subdirectory', () => {
    expect(isValidMoveTarget([], 'item', ['folder'])).toBe(true);
  });

  it('allows moving to a different subtree', () => {
    expect(isValidMoveTarget(['a', 'b'], 'item', ['c', 'd'])).toBe(true);
  });

  it('rejects when target path starts with source but is a deeper descendant', () => {
    expect(isValidMoveTarget([], 'projects', ['projects', 'sub', 'deep'])).toBe(false);
  });

  it('allows when source name is a prefix of target but not a path match', () => {
    // e.g., source "foo" at root, target is ["foobar"] — not a descendant
    expect(isValidMoveTarget([], 'foo', ['foobar'])).toBe(true);
  });
});
