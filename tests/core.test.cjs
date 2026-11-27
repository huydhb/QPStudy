const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../core.js');

const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../data/questions.js'), 'utf8'), context);
const [qp1, qp2] = JSON.parse(JSON.stringify(context.window.QP_DATA.courses));
const config = extra => ({
  course: 'qp1',
  type: 'practice',
  lessons: [2],
  count: 20,
  mode: 'retry',
  minutes: 0,
  shuffle: false,
  ...extra
});
const question = qp1.questions[0];
const wrong = question.options.find(o => o.letter !== question.answer).letter;
const altWrong = question.options.find(o => o.letter !== question.answer && o.letter !== wrong).letter;

test('340 source questions have unique stable ids, four options and an answer', () => {
  assert.equal(qp1.questions.length, 200);
  assert.equal(qp2.questions.length, 140);
  assert.equal(new Set([...qp1.questions, ...qp2.questions].map(q => q.id)).size, 340);
  for (const c of [qp1, qp2]) {
    assert.ok(c.subtitle && typeof c.note === 'string');
    for (const l of c.lessons) {
      assert.equal(c.questions.filter(q => q.lesson === l.number).length, l.count);
    }
  }
  for (const q of [...qp1.questions, ...qp2.questions]) {
    assert.deepEqual(q.options.map(o => o.letter), ['A', 'B', 'C', 'D']);
    assert.match(q.answer, /^[ABCD]$/);
  }
});

test('retry records first choice, rejects repeated wrong choices, locks when correct', () => {
  const s = C.createSession(config(), qp1, 1000);
  assert.equal(C.answer(s, question, wrong, 2000), true);
  assert.equal(C.answer(s, question, wrong, 2001), false);
  assert.equal(C.answer(s, question, question.answer, 2002), true);
  assert.equal(C.answer(s, question, wrong, 2003), false);
  C.finish(s, 3000);
  const summary = C.summarize(s, qp1.questions);
  assert.equal(summary.firstCorrect, 0);
  assert.equal(summary.correct, 1);
  assert.equal(summary.blank, 19);
  assert.equal(summary.score, 0);
});

test('instant locks first answer; end mode permits changing without duplicating same choice', () => {
  for (const mode of ['instant', 'end']) {
    const s = C.createSession(config({mode}), qp1, 1000);
    assert.equal(C.answer(s, question, wrong, 2000), true);
    assert.equal(C.answer(s, question, wrong, 2500), false);
    assert.equal(C.answer(s, question, question.answer, 3000), mode === 'end');
    if (mode === 'end') {
      assert.equal(C.answer(s, question, question.answer, 3100), false);
      assert.equal(C.answer(s, question, altWrong, 3200), true);
      assert.deepEqual(s.answers[question.id].attempts, [wrong, question.answer, altWrong]);
      assert.equal(C.answer(s, question, question.answer, 3300), true);
    }
    assert.equal(s.answers[question.id].first, wrong);
    assert.equal(C.summarize(s, qp1.questions, 4000).correct, mode === 'end' ? 1 : 0);
  }
});

test('answer rejects non-session questions, invalid option letters, and finished sessions', () => {
  const s = C.createSession(config({mode: 'end'}), qp1, 1000);
  const otherLessonQ = qp1.questions.find(q => q.lesson === 3);
  assert.equal(C.answer(s, otherLessonQ, 'A', 2000), false);
  assert.equal(C.answer(s, question, 'E', 2000), false);
  assert.equal(C.answer(s, null, 'A', 2000), false);
  assert.equal(C.finish(s, 3000), true);
  assert.equal(C.answer(s, question, question.answer, 3001), false);
});

test('exam balances chosen lessons without duplicate questions at all boundaries', () => {
  const lessons = qp1.lessons.filter(l => l.count).map(l => l.number);
  for (let repeat = 0; repeat < 15; repeat++) {
    for (const count of [1, 3, 10, 19, 50, 199, 200]) {
      const selected = C.sample(qp1, lessons, count);
      assert.equal(selected.length, count);
      assert.equal(new Set(selected.map(q => q.id)).size, count);
      const sizes = lessons.map(n => selected.filter(q => q.lesson === n).length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    }
  }
});

test('invalid scope, modes, counts, times, and review questionIds contracts are rejected', () => {
  for (const extra of [
    null,
    {type: 'practice', lessons: [2, 3], count: 40},
    {lessons: []},
    {lessons: [1]},
    {lessons: [2, 2]},
    {count: 0},
    {count: -1},
    {type: 'exam', mode: 'end', count: 0},
    {type: 'exam', mode: 'end', count: -1},
    {count: 5},
    {count: 21},
    {count: 1.5},
    {minutes: -1},
    {minutes: 301},
    {minutes: 1.5},
    {minutes: NaN},
    {mode: 'invalid'},
    {type: 'exam', mode: 'instant'}
  ]) {
    assert.throws(() => C.validate(extra === null ? null : config(extra), qp1));
  }
  assert.throws(() => C.sample(qp1, [2], 21));
  assert.throws(() => C.sample(qp1, [2], 0));
  assert.throws(() => C.createSession(config({type: 'review', count: 2}), qp1, 1000));
  assert.throws(() => C.createSession(config({type: 'review', count: 2}), qp1, 1000, 'not-an-array'));
  assert.throws(() => C.createSession(config({type: 'review', count: 2}), qp1, 1000, [question.id, question.id]));
  assert.throws(() => C.createSession(config({type: 'review', count: 2}), qp1, 1000, [question.id]));
});

test('practice shuffle preserves question set and changes order across questions', () => {
  const unshuffled = C.createSession(config({shuffle: false}), qp1, 1000);
  const shuffled = C.createSession(config({shuffle: true}), qp1, 1000);
  assert.deepEqual([...shuffled.questionIds].sort(), [...unshuffled.questionIds].sort());
  assert.notDeepEqual(shuffled.questionIds, unshuffled.questionIds);
});

test('deadline survives reload, blocks late answers and finishes exactly once', () => {
  const s = C.createSession(config({minutes: 1}), qp1, 1000);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(restored.deadline, 61000);
  assert.equal(C.expired(restored, 60999), false);
  assert.equal(C.expired(restored, 61000), true);
  assert.equal(C.answer(restored, question, question.answer, 61000), false);
  assert.equal(C.finish(restored, 90000), true);
  assert.equal(C.finish(restored, 91000), false);
  assert.equal(C.summarize(restored, qp1.questions).elapsed, 60);
  assert.equal(C.summarize(restored, qp1.questions).blank, 20);
});

test('exam scoring, per-lesson totals and review sessions', () => {
  const s = C.createSession(config({type: 'exam', lessons: [2, 3], mode: 'end', count: 7}), qp1, 1000);
  for (const id of s.questionIds.slice(0, 3)) {
    const q = qp1.questions.find(item => item.id === id);
    C.answer(s, q, q.answer, 2000);
  }
  C.finish(s, 3000);
  const result = C.summarize(s, qp1.questions);
  assert.equal(result.score, 4.3);
  assert.equal(result.blank, 4);
  assert.equal(Object.values(result.lessons).reduce((n, l) => n + l.total, 0), 7);
  const ids = s.questionIds.slice(3);
  const review = C.createSession(config({type: 'review', lessons: [2, 3], count: 4}), qp1, 5000, ids);
  assert.deepEqual(review.questionIds, ids);
  assert.equal(review.config.mode, 'retry');
});

test('blocked storage works in memory, corrupt JSON falls back silently, write failure prefers memory', () => {
  let warnings = 0;
  const blocked = C.storage({
    getItem() { throw Error(); },
    setItem() { throw Error(); }
  }, () => warnings++);
  blocked.set('key', {value: 2});
  assert.deepEqual(blocked.get('key', null), {value: 2});
  assert.equal(blocked.get('missing', 'fallback'), 'fallback');
  assert.ok(warnings >= 2);
  blocked.set('nullable', null);
  assert.equal(blocked.get('nullable', 'fallback'), null);

  let jsonWarnings = 0;
  const corrupt = C.storage({getItem() { return '{broken'; }}, () => jsonWarnings++);
  assert.equal(corrupt.get('x', 7), 7);
  assert.equal(jsonWarnings, 0);

  const backing = {k: JSON.stringify({old: true})};
  let quotaWarnings = 0;
  const quota = C.storage({
    getItem(k) { return backing[k] ?? null; },
    setItem() { throw Error('QuotaExceededError'); }
  }, () => quotaWarnings++);
  quota.set('k', {fresh: true});
  assert.deepEqual(quota.get('k', null), {fresh: true});
  assert.equal(quotaWarnings, 1);
});

test('recordQuestionTime tracks active per-question ms and summarize builds speed analytics', () => {
  const s = C.createSession(config({type: 'exam', lessons: [2], mode: 'end', count: 3}), qp1, 1000);
  const [q0, q1, q2] = s.questionIds.map(id => qp1.questions.find(q => q.id === id));
  const wrongOpt = q1.options.find(o => o.letter !== q1.answer).letter;

  assert.equal(C.recordQuestionTime(s, q0.id, 3500), true);
  assert.equal(C.recordQuestionTime(s, q0.id, 1500), true);
  assert.equal(C.recordQuestionTime(s, q1.id, 12000), true);
  assert.equal(C.recordQuestionTime(s, 'nonexistent', 1000), false);
  assert.equal(C.recordQuestionTime(s, q0.id, -500), false);
  assert.equal(C.recordQuestionTime(s, q0.id, 0), false);

  C.answer(s, q0, q0.answer, 5000);
  C.answer(s, q1, wrongOpt, 18000);
  C.finish(s, 30000);
  assert.equal(C.recordQuestionTime(s, q2.id, 2000), false);

  const summary = C.summarize(s, qp1.questions);
  assert.equal(summary.activeElapsed, 17);
  assert.equal(summary.timeStats.hasTrackedTimes, true);
  assert.equal(summary.timeStats.totalMs, 17000);
  assert.equal(summary.timeStats.totalSeconds, 17);
  assert.equal(summary.timeStats.fastest.id, q0.id);
  assert.equal(summary.timeStats.fastest.seconds, 5);
  assert.equal(summary.timeStats.slowest.id, q1.id);
  assert.equal(summary.timeStats.slowest.seconds, 12);
  assert.equal(summary.timeStats.correctAvgSeconds, 5);
  assert.equal(summary.timeStats.wrongAvgSeconds, 12);
  assert.equal(summary.timeStats.perQuestion.length, 3);
  assert.equal(summary.timeStats.perQuestion[2].status, 'blank');
  assert.equal(summary.timeStats.perQuestion[2].seconds, 0);
});
