import smoke from '../content/smoke.json' with { type: 'json' };
import baseline from '../content/baseline.json' with { type: 'json' };
import stress from '../content/stress.json' with { type: 'json' };
import spike from '../content/spike.json' with { type: 'json' };
import { buildQuestions } from './questions.mjs';
export const lessonIds = ['smoke', 'baseline', 'stress', 'spike'];
export const lessons = [smoke, baseline, stress, spike].map(lesson => ({ ...lesson, questions: buildQuestions(lesson) }));
export const lessonById = Object.fromEntries(lessons.map(lesson => [lesson.id, lesson]));
export function publicLesson(lesson) {
  const { id, title, subtitle, objective, focus, durationMs, originalLabel, originalSeconds, peakVus, order, stages, source, version } = lesson;
  return { id, title, subtitle, objective, focus, durationMs, originalLabel, originalSeconds, peakVus, order, stages, source, version, questionCount: lesson.questions.length };
}
export function publicQuestions(lesson) {
  return lesson.questions.map(({ correct, explanation, ...question }) => question);
}
export function gradeAnswers(lesson, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length !== lesson.questions.length) return null;
  if (lesson.questions.some(q => typeof answers[q.id] !== 'string' || !q.choices.some(c => c.id === answers[q.id]))) return null;
  const items = lesson.questions.map(q => ({ ...q, selected: answers[q.id], isCorrect: answers[q.id] === q.correct }));
  return { score: items.filter(q => q.isCorrect).length, total: items.length, items };
}
// Playback reveals only completed measurement windows. It never invents samples.
export function playback(lesson, attempt, now) {
  const elapsedMs = Math.max(0, Math.min(attempt.duration_ms, now - attempt.started_at));
  const progress = elapsedMs / attempt.duration_ms;
  const originalTime = progress * lesson.originalSeconds;
  const finished = progress >= 1;
  const stage = lesson.stages.find(s => originalTime >= s.start && originalTime < s.end) || lesson.stages.at(-1);
  const revealed = lesson.phases.filter(p => finished || p.end <= originalTime);
  const targetVus = finished ? stage.to : Math.round(stage.from + (stage.to-stage.from) * Math.min(1, (originalTime-stage.start)/Math.max(stage.seconds, .001)));
  return {
    progress, elapsedMs, durationMs: attempt.duration_ms, originalTime, targetVus,
    finished, stage: stage.label, phases: revealed,
    questions: finished ? publicQuestions(lesson) : [],
    result: finished ? {
      passed: lesson.passed, thresholdsPassed: lesson.thresholdsPassed, thresholdCount: lesson.thresholds.length,
      thresholds: lesson.thresholds, overall: lesson.overall, representative: lesson.representative, smokeChecks: lesson.smokeChecks
    } : null
  };
}
