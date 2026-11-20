import { createSmokeState } from '../core/hello.js';

export function runHeadlessSmoke(): string {
  return JSON.stringify(createSmokeState());
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('headless.js')) {
  process.stdout.write(`${runHeadlessSmoke()}\n`);
}
