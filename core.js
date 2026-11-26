(function (root) {
  'use strict';
  const shuffle = (items, random = Math.random) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  function validate(config, course) {
    if (!course || !['practice', 'exam', 'review'].includes(config.type)) throw new Error('Cấu hình học phần không hợp lệ.');
    const available = course.lessons.filter(l => l.count).map(l => l.number);
    if (!Array.isArray(config.lessons) || !config.lessons.length || new Set(config.lessons).size !== config.lessons.length || config.lessons.some(n => !available.includes(n))) throw new Error('Hãy chọn ít nhất một bài có dữ liệu.');
    if (config.type === 'practice' && config.lessons.length !== 1) throw new Error('Luyện tập cần chọn một bài.');
    if (!['retry', 'instant', 'end'].includes(config.mode)) throw new Error('Chế độ không hợp lệ.');
    if (config.type === 'exam' && config.mode !== 'end') throw new Error('Kiểm tra chỉ chấm sau khi nộp.');
    const max = course.questions.filter(q => config.lessons.includes(q.lesson)).length;
    if (!Number.isInteger(config.count) || config.count < 1 || config.count > max) throw new Error(`Số câu phải từ 1 đến ${max}.`);
    if (config.minutes !== 0 && (!Number.isInteger(config.minutes) || config.minutes < 1 || config.minutes > 300)) throw new Error('Thời gian phải từ 1 đến 300 phút.');
  }
  function sample(course, lessons, count, random = Math.random) {
    const groups = shuffle(lessons, random).map(n => shuffle(course.questions.filter(q => q.lesson === n), random));
    if (!Number.isInteger(count) || count < 1 || count > groups.reduce((n, g) => n + g.length, 0)) throw new Error('Số câu không hợp lệ.');
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
    if (config.type === 'review' && !questionIds) throw new Error('Cần chọn các câu để ôn lại.');
    if (questionIds) {
      if (!questionIds.length || new Set(questionIds).size !== questionIds.length) throw new Error('Danh sách câu không hợp lệ.');
      questions = questionIds.map(id => course.questions.find(q => q.id === id));
      if (questions.some(q => !q || !config.lessons.includes(q.lesson))) throw new Error('Không tìm thấy câu hỏi.');
    } else if (config.type === 'exam') questions = sample(course, config.lessons, config.count);
    else {
      questions = course.questions.filter(q => config.lessons.includes(q.lesson));
      if (config.shuffle) questions = shuffle(questions);
    }
    return {id: `${now}-${Math.random().toString(36).slice(2, 9)}`, config: {...config}, questionIds: questions.map(q => q.id), answers: {}, flagged: [], current: 0, startedAt: now, deadline: config.minutes ? now + config.minutes * 60000 : null, finishedAt: null};
  }
  const expired = (session, now = Date.now()) => !!session.deadline && now >= session.deadline;
  function answer(session, question, letter, now = Date.now()) {
    if (session.finishedAt !== null || expired(session, now) || !session.questionIds.includes(question.id) || !question.options.some(o => o.letter === letter)) return false;
    const old = session.answers[question.id];
    if (old && (session.config.mode === 'instant' || (session.config.mode === 'retry' && old.correct))) return false;
    if (session.config.mode === 'retry' && old?.attempts.includes(letter)) return false;
    session.answers[question.id] = {selected: letter, first: old?.first || letter, attempts: [...(old?.attempts || []), letter], correct: letter === question.answer};
    return true;
  }
  function summarize(session, questions, now = Date.now()) {
    let correct = 0, wrong = 0, blank = 0, firstCorrect = 0;
    const lessons = {};
    for (const id of session.questionIds) {
      const q = questions.find(item => item.id === id);
      const a = session.answers[id];
      const status = !a ? 'blank' : a.selected === q.answer ? 'correct' : 'wrong';
      if (status === 'blank') blank++; else if (status === 'correct') correct++; else wrong++;
      if (a?.first === q.answer) firstCorrect++;
      lessons[q.lesson] ||= {total: 0, correct: 0, wrong: 0, blank: 0, firstCorrect: 0};
      lessons[q.lesson].total++;
      lessons[q.lesson][status]++;
      if (a?.first === q.answer) lessons[q.lesson].firstCorrect++;
    }
    const total = session.questionIds.length;
    const graded = session.config.mode === 'retry' ? firstCorrect : correct;
    return {total, correct, wrong, blank, firstCorrect, score: +(graded / total * 10).toFixed(1), percent: Math.round(graded / total * 100), elapsed: Math.max(0, Math.floor(((session.finishedAt ?? now) - session.startedAt) / 1000)), lessons};
  }
  function finish(session, now = Date.now()) {
    if (session.finishedAt !== null) return false;
    session.finishedAt = session.deadline ? Math.min(now, session.deadline) : now;
    return true;
  }
  function storage(storageObject, onError) {
    let memory = {};
    return {
      get(key, fallback) { try { const value = storageObject.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { onError(); return memory[key] ?? fallback; } },
      set(key, value) { memory[key] = value; try { storageObject.setItem(key, JSON.stringify(value)); } catch (_) { onError(); } }
    };
  }
  const api = {shuffle, validate, sample, createSession, answer, summarize, expired, finish, storage};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QPCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
