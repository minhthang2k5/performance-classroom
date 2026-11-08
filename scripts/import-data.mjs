import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildQuestions } from '../server/src/questions.mjs';
import { metricsFor, normalizeThresholds, phaseStatus } from '../server/src/measurements.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const repository = path.resolve(root, '../../Newver/eshop-sut');
const sourceRoot = path.join(repository, 'performance/k6/output');
const destination = path.join(root, 'server/content');
// Match the four original-backend runs in the November reports; tuned stress is a separate experiment.
const runs = {
  smoke: 'smoke-20261106-201703-cVgZoy', baseline: 'baseline-20261106-180216-cXQggA',
  stress: 'stress-20261106-185434-JpCHYG', spike: 'spike-20261106-182250-CyyDmN'
};
const descriptions = {
  smoke: { title: 'Smoke test', subtitle: 'Đúng trước, nhanh sau.', objective: 'Kiểm tra luồng API và các điều kiện cơ bản trước khi tạo tải lớn.', focus: 'Requests & checks', durationMs: 7500 },
  baseline: { title: 'Baseline test', subtitle: 'Thiết lập một mốc để so sánh.', objective: 'Quan sát hệ thống ở mức tải bình thường và đọc kết quả trong cửa sổ steady.', focus: 'Độ trễ & SLO', durationMs: 15000 },
  stress: { title: 'Stress test', subtitle: 'Tăng tải. Tìm dấu hiệu suy giảm.', objective: 'Theo dõi từng bậc tải, xác định giai đoạn đầu vi phạm và quan sát phục hồi.', focus: 'Giới hạn & phục hồi', durationMs: 40000 },
  spike: { title: 'Spike test', subtitle: 'Điều gì xảy ra khi tải tăng đột ngột?', objective: 'Đọc phản ứng ở đỉnh tải và kiểm tra hệ thống sau khi giảm về tải nền.', focus: 'Đỉnh tải & lỗi', durationMs: 15000 }
};
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = filename => path.relative(path.resolve(root, '../..'), filename).split(path.sep).join('/');
const durationLabel = seconds => `${Math.floor(seconds / 60)} phút${seconds % 60 ? ` ${seconds % 60} giây` : ''}`;

function stageLabel(id, stage) {
  if (stage.phase === 'ramp_up') return 'Tăng tải';
  if (stage.phase === 'ramp_down') return 'Giảm tải';
  if (stage.phase === 'steady') return 'Tải ổn định';
  if (stage.phase === 'burst') return 'Tăng đột ngột';
  if (stage.phase === 'unload') return `Giảm về ${stage.target} VUs`;
  if (stage.phase.startsWith('recovery_')) return `Phục hồi · ${stage.target} VUs`;
  if (stage.phase.startsWith('ramp_')) return `Tăng lên ${stage.target} VUs`;
  if (id === 'spike') return `${stage.target === 50 ? 'Tải nền' : 'Đỉnh tải'} · ${stage.target} VUs`;
  return `${stage.target} VUs`;
}

fs.mkdirSync(destination, { recursive: true });
// Validate all lessons before replacing a bank to avoid partial imports.
const prepared = Object.entries(runs).map(([id, runId], order) => {
  const filename = path.join(sourceRoot, runId, 'summary.json');
  const bytes = fs.readFileSync(filename), raw = JSON.parse(bytes);
  const thresholds = normalizeThresholds(raw);
  const timelinePath = path.join(sourceRoot, runId, 'measurement-timeline.json');
  const timelineBytes = id === 'smoke' ? null : fs.readFileSync(timelinePath);
  const timeline = timelineBytes && JSON.parse(timelineBytes);
  if (timeline?.interrupted) throw new Error(`Interrupted source run: ${runId}`);
  let profile;
  if (id === 'smoke') {
    const smokeSeconds = (raw.metrics.iteration_duration.values || raw.metrics.iteration_duration).avg / 1000;
    if (!(smokeSeconds > 0)) throw new Error(`Missing smoke duration: ${runId}`);
    profile = ['Đăng nhập', 'Tìm kiếm', 'Chi tiết sản phẩm', 'Giỏ hàng', 'Thanh toán'].map((label, index) => ({ key: `step_${index + 1}`, label, seconds: smokeSeconds / 5, from: 1, to: 1 }));
  } else {
    let previous = timeline.profile[0].phase.startsWith('hold_') ? timeline.profile[0].target : 0;
    profile = timeline.profile.map(stage => {
      const item = { key: stage.phase, label: stageLabel(id, stage), seconds: stage.seconds, from: previous, to: stage.target };
      previous = stage.target;
      if (!(stage.seconds >= 0) || !(stage.target >= 0)) throw new Error(`Invalid timeline stage: ${runId}/${stage.phase}`);
      return item;
    });
  }
  let originalSeconds = 0;
  const stages = profile.map(stage => { const start = originalSeconds; originalSeconds += stage.seconds; return { ...stage, start, end: originalSeconds }; });
  const peakVus = Math.max(...stages.map(stage => stage.to));
  const phases = id === 'smoke'
    ? [{ key: 'overall', label: 'Toàn bài Smoke', end: originalSeconds, seconds: originalSeconds, vus: 1, metrics: metricsFor(raw), learningStatus: phaseStatus(thresholds) }]
    : stages.filter(stage => stage.key === 'steady' || /^(hold_|recovery_)/.test(stage.key)).map(stage => ({
      key: stage.key, label: stage.label, end: stage.end, seconds: stage.seconds, vus: stage.to,
      metrics: metricsFor(raw, { phase: stage.key }, stage.seconds),
      endpoints: ['search', 'detail', 'cart', 'checkout', 'login'].map(endpoint => ({ endpoint, ...metricsFor(raw, { phase: stage.key, endpoint }, stage.seconds) })),
      learningStatus: phaseStatus(thresholds, stage.key)
    }));
  for (const phase of phases) {
    if (phase.metrics.requests == null || phase.metrics.p95 == null || phase.learningStatus === 'missing') throw new Error(`Incomplete measurement window: ${runId}/${phase.key}`);
  }
  const representative = id === 'smoke' ? 'overall' : id === 'baseline' ? 'steady'
    : id === 'stress' ? (phases.find(phase => phase.learningStatus === 'fail') || phases.find(phase => phase.vus === peakVus)).key
    : phases.find(phase => phase.vus === peakVus).key;
  const holds = stages.filter(stage => stage.key.startsWith('hold_'));
  const originalLabel = id === 'smoke' ? '1 VU · 1 iteration'
    : id === 'baseline' ? `${peakVus} VUs · ${durationLabel(originalSeconds)}`
    : id === 'stress' ? `${holds[0].to}–${peakVus} VUs · ${durationLabel(originalSeconds)}`
    : `${holds[0].to} → ${peakVus} → ${stages.at(-1).to} VUs · ${durationLabel(originalSeconds)}`;
  const source = { runId, path: relative(filename), sha256: digest(bytes), variant: 'original' };
  if (timelineBytes) Object.assign(source, { timelinePath: relative(timelinePath), timelineSha256: digest(timelineBytes) });
  const content = {
    id, ...descriptions[id], order, version: `v3-${digest(Buffer.concat([bytes, timelineBytes || Buffer.alloc(0)])).slice(0, 12)}`,
    source, originalLabel, peakVus, originalSeconds, stages, phases, representative,
    overall: metricsFor(raw), thresholds, passed: thresholds.length > 0 && thresholds.every(condition => condition.passed === true),
    thresholdsPassed: thresholds.filter(condition => condition.passed === true).length,
    smokeChecks: id === 'smoke' ? Object.values(raw.root_group.groups).map(group => ({
      label: group.name, passed: Object.values(group.checks).reduce((sum, check) => sum + check.passes, 0),
      failed: Object.values(group.checks).reduce((sum, check) => sum + check.fails, 0)
    })) : [], questions: []
  };
  content.questions = buildQuestions(content);
  if (content.questions.length !== 4) throw new Error(`Expected four questions: ${id}`);
  for (const question of content.questions) {
    if (question.choices.length !== 4 || new Set(question.choices.map(choice => choice.text)).size !== 4 || !question.choices.some(choice => choice.id === question.correct)) throw new Error(`Invalid question: ${question.id}`);
  }
  return content;
});

for (const content of prepared) {
  fs.writeFileSync(path.join(destination, `${content.id}.json`), JSON.stringify(content, null, 2) + '\n');
  console.log(`${content.id}: ${content.source.runId}; ${content.originalLabel}; ${content.thresholdsPassed}/${content.thresholds.length} thresholds; ${content.questions.length} câu hỏi`);
}
