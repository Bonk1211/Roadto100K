import type { ModelHealthViewModel, RecentLabel } from './types.js';

export function getModelHealthViewModel(): ModelHealthViewModel {
  return {
    modelVersion: 'iforest-v3-demo.4',
    previousVersion: 'iforest-v3-demo.3',
    lastTrainedAt: '2026-04-25T02:00:00+08:00',
    nextRetrainAt: '2026-04-27T02:00:00+08:00',
    labelsSinceRetrain: 37,
    accuracyDelta: 4.2,
    queueCoverage: 92,
    nextWindow: '02:00 MYT',
    loop: {
      agentLabels: 24,
      userLabels: 13,
      mergedLabels: 37,
      retrainsThisWeek: 6,
    },
    labelSplit: {
      fraud: 68,
      falsePositive: 32,
      agentShare: 65,
      userShare: 35,
    },
    sinks: [
      {
        name: 'AWS S3',
        region: 'ap-southeast-1',
        status: 'healthy',
        lastWriteAt: '2026-04-26T13:58:12+08:00',
        writes24h: 142,
      },
      {
        name: 'Alibaba OSS',
        region: 'ap-southeast-3',
        status: 'healthy',
        lastWriteAt: '2026-04-26T13:58:12+08:00',
        writes24h: 142,
      },
      {
        name: 'Kinesis stream',
        region: 'ap-southeast-1',
        status: 'healthy',
        lastWriteAt: '2026-04-26T13:58:09+08:00',
        writes24h: 284,
      },
    ],
    recentLabels: buildRecentLabels(),
    retrainHistory: [
      { version: 'iforest-v3-demo.4', ranAt: '2026-04-25T02:00:14+08:00', labelCount: 41, accuracyDelta: 4.2, durationMs: 142_000 },
      { version: 'iforest-v3-demo.3', ranAt: '2026-04-24T02:00:11+08:00', labelCount: 35, accuracyDelta: 3.1, durationMs: 138_000 },
      { version: 'iforest-v3-demo.2', ranAt: '2026-04-23T02:00:09+08:00', labelCount: 28, accuracyDelta: 2.5, durationMs: 145_000 },
    ],
  };
}

function buildRecentLabels(): RecentLabel[] {
  const base = Date.parse('2026-04-26T14:02:31+08:00');
  const rows: Array<Omit<RecentLabel, 'id' | 'ts'> & { offsetSec: number }> = [
    { offsetSec: 0,    source: 'agent', actor: 'Aisha',   action: 'block',   label: 'fraud',           txnId: 'TXN-9F31A2' },
    { offsetSec: 47,   source: 'user',  actor: 'u_88431', action: 'proceed', label: 'false_positive',  txnId: 'TXN-9F2EB7' },
    { offsetSec: 122,  source: 'agent', actor: 'Aisha',   action: 'clear',   label: 'false_positive',  txnId: 'TXN-9F2D04' },
    { offsetSec: 198,  source: 'user',  actor: 'u_71902', action: 'cancel',  label: 'fraud',           txnId: 'TXN-9F2A18' },
    { offsetSec: 284,  source: 'agent', actor: 'Bilal',   action: 'warn',    label: 'fraud',           txnId: 'TXN-9F285C' },
    { offsetSec: 359,  source: 'user',  actor: 'u_50112', action: 'report',  label: 'fraud',           txnId: 'TXN-9F26F0' },
    { offsetSec: 442,  source: 'agent', actor: 'Aisha',   action: 'block',   label: 'fraud',           txnId: 'TXN-9F2519' },
    { offsetSec: 533,  source: 'agent', actor: 'Bilal',   action: 'clear',   label: 'false_positive',  txnId: 'TXN-9F23BB' },
  ];
  return rows.map((r, i) => ({
    id: `lbl_${i}`,
    ts: new Date(base - r.offsetSec * 1000).toISOString(),
    source: r.source,
    actor: r.actor,
    action: r.action,
    label: r.label,
    txnId: r.txnId,
  }));
}
