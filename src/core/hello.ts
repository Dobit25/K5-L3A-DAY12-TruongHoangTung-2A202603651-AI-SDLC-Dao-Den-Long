export interface SmokeState {
  tick: number;
  status: 'ready';
  title: string;
}

export function createSmokeState(): SmokeState {
  return {
    tick: 0,
    status: 'ready',
    title: 'Đảo Đèn Lồng',
  };
}
