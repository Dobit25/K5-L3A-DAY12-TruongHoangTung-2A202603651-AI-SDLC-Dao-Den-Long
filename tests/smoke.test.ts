import { describe, expect, it } from 'vitest';
import { createSmokeState } from '../src/core/hello.js';
import { runHeadlessSmoke } from '../src/cli/headless.js';

describe('CP0 environment smoke', () => {
  it('initializes pure core state without browser dependencies', () => {
    const state = createSmokeState();
    expect(state.status).toBe('ready');
    expect(state.tick).toBe(0);
  });

  it('produces deterministic headless smoke output', () => {
    expect(runHeadlessSmoke()).toBe(runHeadlessSmoke());
  });
});
