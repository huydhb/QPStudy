(function (root) {
  'use strict';

  const hasOwn = Object.prototype.hasOwnProperty;

  const shuffle = (items, random = Math.random) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  function validate(config, course) {
    if (!config || typeof config !== 'object' || !course || !['practice', 'exam', 'review'].includes(config.type)) {
      throw new Error('Cấu hình học phần không hợp lệ.');
    }
    const available = course.lessons.filter(l => l.count).map(l => l.number);
    if (
      !Array.isArray(config.lessons) ||
      !config.lessons.length ||
      new Set(config.lessons).size !== config.lessons.length ||
      config.lessons.some(n => !available.includes(n))
    ) {
      throw new Error('Hãy chọn ít nhất một bài có dữ liệu.');
    }
    if (config.type === 'practice' && config.lessons.length !== 1) {
      throw new Error('Luyện tập cần chọn một bài.');
    }
    if (!['retry', 'instant', 'end'].includes(config.mode)) {
      throw new Error('Chế độ không hợp lệ.');
    }
    if (config.type === 'exam' && config.mode !== 'end') {
      throw new Error('Kiểm tra chỉ chấm sau khi nộp.');
    }
    const max = course.questions.filter(q => config.lessons.includes(q.lesson)).length;
    if (!Number.isInteger(config.count) || config.count < 1 || config.count > max) {
      throw new Error(`Số câu phải từ 1 đến ${max}.`);
    }
    if (config.type === 'practice' && config.count !== max) {
      throw new Error(`Số câu luyện tập phải bằng ${max}.`);
    }
    if (config.minutes !== 0 && (!Number.isInteger(config.minutes) || config.minutes < 1 || config.minutes > 300)) {
      throw new Error('Thời gian phải từ 1 đến 300 phút.');
    }
  }

  function sample(course, lessons, count, random = Math.random) {
    const groups = shuffle(lessons, random).map(n =>
      shuffle(course.questions.filter(q => q.lesson === n), random)
    );
    const total = groups.reduce((n, g) => n + g.length, 0);
    if (!Number.isInteger(count) || count < 1 || count > total) {
      throw new Error('Số câu không hợp lệ.');
    }
    const selected = [];
    while (selected.length < count) {
      for (const group of groups) {
        if (group.length && selected.length < count) selected.push(group.pop());
      }
    }
    return shuffle(selected, random);
  }

  function createSession(config, course, now = Date.now(), questionIds) {
    validate(config, course);
    let questions;
    if (config.type === 'review' && questionIds === undefined) {
      throw new Error('Cần chọn các câu để ôn lại.');
    }
    if (questionIds !== undefined) {
      if (
        !Array.isArray(questionIds) ||
        !questionIds.length ||
        questionIds.length !== config.count ||
        new Set(questionIds).size !== questionIds.length
      ) {
        throw new Error('Danh sách câu không hợp lệ.');
      }
      const byId = new Map(course.questions.map(q => [q.id, q]));
      questions = questionIds.map(id => byId.get(id));
      if (questions.some(q => !q || !config.lessons.includes(q.lesson))) {
        throw new Error('Không tìm thấy câu hỏi.');
      }
    } else if (config.type === 'exam') {
      questions = sample(course, config.lessons, config.count);
    } else {
      questions = course.questions.filter(q => config.lessons.includes(q.lesson));
      if (config.shuffle) questions = shuffle(questions);
    }
    return {
      id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
      config: {...config, lessons: [...config.lessons]},
      questionIds: questions.map(q => q.id),
      answers: {},
      questionTimes: {},
      flagged: [],
      current: 0,
      startedAt: now,
      deadline: config.minutes ? now + config.minutes * 60000 : null,
      finishedAt: null
    };
  }

  function recordQuestionTime(session, questionId, deltaMs) {
    if (
      !session ||
      session.finishedAt !== null ||
      !Array.isArray(session.questionIds) ||
      !session.questionIds.includes(questionId) ||
      !Number.isFinite(deltaMs) ||
      deltaMs <= 0
    ) {
      return false;
    }
    if (!session.questionTimes || typeof session.questionTimes !== 'object' || Array.isArray(session.questionTimes)) {
      session.questionTimes = {};
    }
    const prev = Number.isFinite(session.questionTimes[questionId]) && session.questionTimes[questionId] >= 0
      ? session.questionTimes[questionId]
      : 0;
    session.questionTimes[questionId] = Math.round(prev + deltaMs);
    return true;
  }

  const expired = (session, now = Date.now()) => !!session.deadline && now >= session.deadline;

  function answer(session, question, letter, now = Date.now()) {
    if (
      !question ||
      session.finishedAt !== null ||
      expired(session, now) ||
      !session.questionIds.includes(question.id) ||
      !question.options.some(o => o.letter === letter)
    ) {
      return false;
    }
    const old = session.answers[question.id];
    if (old && (old.selected === letter || session.config.mode === 'instant' || (session.config.mode === 'retry' && old.correct))) {
      return false;
    }
    if (session.config.mode === 'retry' && old?.attempts.includes(letter)) {
      return false;
    }
    session.answers[question.id] = {
      selected: letter,
      first: old?.first || letter,
      attempts: [...(old?.attempts || []), letter],
      correct: letter === question.answer
    };
    return true;
  }

  function summarize(session, questions, now = Date.now()) {
    const byId = questions instanceof Map ? questions : new Map(questions.map(item => [item.id, item]));
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    let firstCorrect = 0;
    const lessons = {};
    for (const id of session.questionIds) {
      const q = byId.get(id);
      if (!q) continue;
      const a = session.answers[id];
      const status = !a ? 'blank' : a.selected === q.answer ? 'correct' : 'wrong';
      if (status === 'blank') blank++;
      else if (status === 'correct') correct++;
      else wrong++;
      if (a?.first === q.answer) firstCorrect++;
      lessons[q.lesson] ||= {total: 0, correct: 0, wrong: 0, blank: 0, firstCorrect: 0};
      lessons[q.lesson].total++;
      lessons[q.lesson][status]++;
      if (a?.first === q.answer) lessons[q.lesson].firstCorrect++;
    }
    const total = session.questionIds.length;
    const graded = session.config.mode === 'retry' ? firstCorrect : correct;
    const rawTimes = session.questionTimes && typeof session.questionTimes === 'object' ? session.questionTimes : {};
    const perQuestion = [];
    let totalMs = 0;
    let fastest = null;
    let slowest = null;
    let correctMsSum = 0;
    let correctTimedCount = 0;
    let wrongMsSum = 0;
    let wrongTimedCount = 0;

    session.questionIds.forEach((id, index) => {
      const q = byId.get(id);
      const a = session.answers[id];
      const status = !a ? 'blank' : (q && a.selected === q.answer) ? 'correct' : 'wrong';
      const ms = Number.isFinite(rawTimes[id]) && rawTimes[id] > 0 ? Math.round(rawTimes[id]) : 0;
      const seconds = +(ms / 1000).toFixed(1);
      const entry = {id, index, ms, seconds, status};
      perQuestion.push(entry);
      totalMs += ms;
      if (ms > 0) {
        if (!fastest || ms < fastest.ms) fastest = entry;
        if (!slowest || ms > slowest.ms) slowest = entry;
      }
      if (status === 'correct' && ms > 0) {
        correctMsSum += ms;
        correctTimedCount++;
      } else if (status === 'wrong' && ms > 0) {
        wrongMsSum += ms;
        wrongTimedCount++;
      }
    });

    const hasTrackedTimes = totalMs > 0;
    const totalSeconds = Math.round(totalMs / 1000);
    const activeElapsed = hasTrackedTimes
      ? totalSeconds
      : Math.max(0, Math.floor(((session.finishedAt ?? now) - session.startedAt) / 1000));

    return {
      total,
      correct,
      wrong,
      blank,
      firstCorrect,
      score: +(graded / total * 10).toFixed(1),
      percent: Math.round(graded / total * 100),
      elapsed: Math.max(0, Math.floor(((session.finishedAt ?? now) - session.startedAt) / 1000)),
      activeElapsed,
      timeStats: {
        hasTrackedTimes,
        totalMs,
        totalSeconds,
        averageSeconds: total ? +(totalMs / total / 1000).toFixed(1) : 0,
        fastest,
        slowest,
        correctAvgSeconds: correctTimedCount ? +(correctMsSum / correctTimedCount / 1000).toFixed(1) : null,
        wrongAvgSeconds: wrongTimedCount ? +(wrongMsSum / wrongTimedCount / 1000).toFixed(1) : null,
        perQuestion
      },
      lessons
    };
  }

  function finish(session, now = Date.now()) {
    if (session.finishedAt !== null) return false;
    session.finishedAt = session.deadline ? Math.min(now, session.deadline) : now;
    return true;
  }

  function storage(storageObject, onError) {
    const memory = {};
    const writeFailed = new Set();
    const memoryOr = (key, fallback) => (hasOwn.call(memory, key) ? memory[key] : fallback);
    return {
      get(key, fallback) {
        if (writeFailed.has(key)) return memoryOr(key, fallback);
        let raw;
        try {
          raw = storageObject.getItem(key);
        } catch (_) {
          onError();
          return memoryOr(key, fallback);
        }
        if (raw === null || raw === undefined || raw === '') return fallback;
        try {
          return JSON.parse(raw);
        } catch (_) {
          return fallback;
        }
      },
      set(key, value) {
        memory[key] = value;
        try {
          storageObject.setItem(key, JSON.stringify(value));
          writeFailed.delete(key);
        } catch (_) {
          writeFailed.add(key);
          onError();
        }
      }
    };
  }

  const api = {shuffle, validate, sample, createSession, recordQuestionTime, answer, summarize, expired, finish, storage};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QPCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
