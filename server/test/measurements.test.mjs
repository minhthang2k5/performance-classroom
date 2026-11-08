import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lessons } from '../src/content.mjs';
import { metricsFor, normalizeThresholds, phaseStatus } from '../src/measurements.mjs';

test('metric extraction distinguishes phase totals, endpoints and missing data', () => {
  const summary = { metrics: {
    'http_reqs{phase:hold_2000}': { count: 1000, rate: 1 },
    'http_reqs{endpoint:login,phase:hold_200}': { count: 2 },
    'http_reqs{phase:hold_200}': { count: 120, rate: 1 },
    'http_req_duration{phase:hold_200}': { med: 2, 'p(95)': 8 },
    'http_req_failed{phase:hold_200}': { value: 0 },
    'business_operations_failed{phase:hold_200}': { value: 0.02 }
  } };
  const phase = metricsFor(summary, { phase: 'hold_200' }, 120);
  assert.equal(phase.requests, 120); assert.equal(phase.rps, 1);
  assert.equal(phase.p95, 8); assert.equal(phase.p99, null);
  assert.equal(phase.businessErrorRate, 0.02);
  assert.equal(metricsFor(summary, { phase: 'hold_200', endpoint: 'login' }, 120).requests, 2);
  assert.equal(metricsFor(summary, { phase: 'absent' }, 120).rps, null);
});

test('threshold verdicts handle both k6 formats and isolate phase tags exactly', () => {
  const conditions = normalizeThresholds({ metrics: {
    'http_req_duration{phase:hold_200}': { thresholds: { 'p(95)<500': false } },
    'http_req_duration{phase:hold_2000}': { thresholds: { 'p(95)<500': true } },
    'business_operations_failed{phase:hold_400}': { thresholds: { 'rate<0.01': { ok: false } } },
    'checks{phase:hold_800}': { thresholds: { 'rate>=0.99': { ok: true } } }
  } });
  assert.equal(phaseStatus(conditions, 'hold_200'), 'pass');
  assert.equal(phaseStatus(conditions, 'hold_2000'), 'fail');
  assert.equal(phaseStatus(conditions, 'hold_400'), 'fail');
  assert.equal(phaseStatus(conditions, 'hold_800'), 'pass');
  assert.equal(phaseStatus(conditions, 'absent'), 'missing');
});

test('November profiles, representative windows and data questions match the new runs', () => {
  const [smoke, baseline, stress, spike] = lessons;
  assert.match(smoke.source.runId, /^smoke-20261106-/);
  assert.ok(Math.abs(smoke.overall.p95 - 20.6437776) < 1e-6);
  assert.equal(baseline.phases[0].metrics.requests, 7141);
  assert.equal(baseline.phases[0].seconds, 300);
  assert.equal(stress.originalSeconds, 1560);
  assert.deepEqual(stress.phases.filter(phase => phase.key.startsWith('hold_')).map(phase => [phase.vus, phase.seconds]),
    Array.from({ length: 10 }, (_, index) => [(index + 1) * 200, 120]));
  assert.equal(stress.representative, 'hold_600');
  assert.equal(stress.phases.find(phase => phase.key === 'hold_800').learningStatus, 'pass');
  assert.match(stress.questions[3].prompt, /600 VUs.*800 VUs/);
  assert.equal(spike.peakVus, 800); assert.equal(spike.representative, 'hold_800');
  assert.equal(spike.passed, true); assert.equal(spike.thresholdsPassed, 75);
  const peak = spike.phases.find(phase => phase.key === 'hold_800');
  assert.equal(spike.overall.skipped, 1); assert.equal(peak.metrics.skipped, null);
  assert.equal(peak.learningStatus, 'pass');
  assert.equal(peak.metrics.rps, 24796 / 60);
  assert.match(spike.questions[2].choices.find(choice => choice.id === spike.questions[2].correct).text, /Đạt cả hai điều kiện/);
  assert.match(spike.questions[3].prompt, /p99/);
});

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const sourcesPresent = lessons.every(lesson => fs.existsSync(path.join(repositoryRoot, lesson.source.path)));
test('imported measurements and all verdicts agree with the raw November summaries and timelines', { skip: !sourcesPresent }, () => {
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  for (const lesson of lessons) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, lesson.source.path));
    assert.equal(digest(bytes), lesson.source.sha256);
    const raw = JSON.parse(bytes);
    if (lesson.source.timelinePath) {
      const timelineBytes = fs.readFileSync(path.join(repositoryRoot, lesson.source.timelinePath));
      assert.equal(digest(timelineBytes), lesson.source.timelineSha256);
      assert.deepEqual(lesson.stages.map(stage => [stage.key, stage.seconds, stage.to]),
        JSON.parse(timelineBytes).profile.map(stage => [stage.phase, stage.seconds, stage.target]));
    }
    for (const phase of lesson.phases) {
      const suffix = lesson.id === 'smoke' ? '' : `{phase:${phase.key}}`;
      const duration = raw.metrics[`http_req_duration${suffix}`];
      const requests = raw.metrics[`http_reqs${suffix}`];
      assert.equal(phase.metrics.p95, duration['p(95)']);
      assert.equal(phase.metrics.p50, duration.med);
      assert.equal(phase.metrics.requests, requests.count);
      if (lesson.id !== 'smoke') assert.equal(phase.metrics.rps, requests.count / phase.seconds);
    }
    // Evaluate the numeric conditions independently of k6's serialized pass/fail flags.
    for (const threshold of lesson.thresholds) {
      const metric = raw.metrics[threshold.metric];
      const [, statistic, operator, limit] = threshold.expression.match(/^(p\(\d+\)|rate|count)(==|>=|<=|<|>)([\d.]+)$/);
      const value = statistic === 'rate' ? metric.rate ?? metric.value : metric[statistic];
      const target = Number(limit);
      assert.equal(typeof value, 'number', threshold.metric);
      const expected = operator === '<' ? value < target : operator === '>' ? value > target
        : operator === '>=' ? value >= target : operator === '<=' ? value <= target : value === target;
      assert.equal(threshold.passed, expected, `${lesson.id}: ${threshold.metric} ${threshold.expression}`);
    }
  }
});
