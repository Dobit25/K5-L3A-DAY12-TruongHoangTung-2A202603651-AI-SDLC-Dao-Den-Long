import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/engine.js';

describe('Phase 1 core isolation smoke', () => {
  it('initializes Night 1 pure core state without browser/DOM dependencies', () => {
    const engine = new GameEngine(42, 1);
    const snap = engine.getSnapshot();
    expect(snap.tick).toBe(0);
    expect(snap.state).toBe('playing');
    expect(snap.lanterns).toHaveLength(5);
  });

  it('produces identical initial snapshots for the same seed', () => {
    const a = new GameEngine(42, 1).getSnapshot();
    const b = new GameEngine(42, 1).getSnapshot();
    expect(a).toEqual(b);
  });
});
