import type { ModelHealthViewModel } from './types.js';

export function getModelHealthViewModel(): ModelHealthViewModel {
  return {
    modelVersion: 'iforest-v3-demo.4',
    lastTrainedAt: '2026-04-25T02:00:00+08:00',
    labelsSinceRetrain: 37,
    accuracyDelta: 4.2,
    queueCoverage: 92,
    nextWindow: '02:00 MYT',
  };
}
