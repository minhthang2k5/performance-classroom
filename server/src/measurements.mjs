const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function metricIdentity(key) {
  const [name, suffix] = key.split('{');
  const tags = Object.fromEntries((suffix?.replace(/}$/, '') || '').split(',').filter(Boolean).map(tag => tag.split(':')));
  return { name, tags };
}

export function findMetric(metrics, name, tags = {}) {
  return Object.entries(metrics).find(([key]) => {
    const identity = metricIdentity(key);
    return identity.name === name && Object.keys(identity.tags).length === Object.keys(tags).length &&
      Object.entries(tags).every(([tag, value]) => identity.tags[tag] === value);
  })?.[1];
}

export function metricsFor(summary, tags = {}, seconds = null) {
  const read = name => { const metric = findMetric(summary.metrics, name, tags); return metric?.values || metric || {}; };
  const duration = read('http_req_duration'), requests = read('http_reqs'), checks = read('checks');
  const failed = read('http_req_failed'), business = read('business_operations_failed');
  const count = finite(requests.count);
  return {
    requests: count, rps: seconds == null ? finite(requests.rate) : count == null ? null : finite(count / seconds),
    p50: finite(duration.med), p95: finite(duration['p(95)']), p99: finite(duration['p(99)']),
    errorRate: finite(failed.rate ?? failed.value), checksRate: finite(checks.rate ?? checks.value),
    checksPassed: finite(checks.passes), checksFailed: finite(checks.fails),
    skipped: finite(read('business_requests_skipped').count),
    businessErrorRate: finite(business.rate ?? business.value)
  };
}

export function normalizeThresholds(summary) {
  return Object.entries(summary.metrics).flatMap(([metric, value]) => Object.entries(value.thresholds || {}).map(([expression, result]) => ({
    metric, expression,
    // Legacy k6 summaries flag violations; newer summaries expose an explicit ok flag.
    passed: typeof result === 'boolean' ? !result : typeof result?.ok === 'boolean' ? result.ok : null
  })));
}

export function phaseStatus(thresholds, phase = null) {
  const conditions = phase == null ? thresholds : thresholds.filter(condition => metricIdentity(condition.metric).tags.phase === phase);
  if (!conditions.length || conditions.some(condition => condition.passed == null)) return 'missing';
  return conditions.every(condition => condition.passed) ? 'pass' : 'fail';
}
