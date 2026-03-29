# Performance Report

Date: 2026-03-29

## Scope

This report compares route-level direct-load JS payload against the previous pre-optimization single-bundle baseline.

- Baseline build payload (single main chunk): 596.43 KB
- Current core app shell payload: 183.62 KB
- Measurement method:
  - Build with manifest: `vite build --manifest`
  - Analyze manifest import graph with `scripts/perf-report.mjs`

## Route Payload and Gain

| Route Page | Current Payload (KB) | Gain vs Baseline (KB) | Gain (%) |
|---|---:|---:|---:|
| ArchivePage | 191.53 | 404.90 | 67.89% |
| ReviewPage | 191.77 | 404.66 | 67.85% |
| DuplicatesPage | 192.72 | 403.71 | 67.69% |
| SettingsPage | 193.76 | 402.67 | 67.51% |
| DashboardPage | 195.80 | 400.63 | 67.17% |
| InboxPage | 196.70 | 399.73 | 67.02% |
| SessionDetailPage | 557.73 | 38.70 | 6.49% |

## Interpretation

- Most routes now load about 191-197 KB instead of 596 KB, which is roughly a 67% reduction.
- `SessionDetailPage` remains heavy because it pulls chart-related code paths (`recharts` chunk).
- The biggest next win is chart isolation (load charts only where truly needed or switch to lighter chart primitives for detail view).

## Re-run

Use:

```bash
npm run perf:report
```
