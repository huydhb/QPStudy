(() => {
  'use strict';
  const C = window.QPCore, courses = window.QP_DATA.courses;
  const $ = selector => document.querySelector(selector);
  const main = $('#main'), dialog = $('#dialog');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const paths = {
    book: '<path d="M12 7c-3-3-7-3-10-2v14c4-1 7 0 10 2m0-14c3-3 7-3 10-2v14c-4-1-7 0-10 2V7Z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 22V3m0 0c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
    trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-5 1h10"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    chart: '<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
    shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>'
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
  const modes = {retry: 'Chọn đến khi đúng', instant: 'Hiện kết quả ngay', end: 'Kết quả cuối bài'};
  const warnStorage = () => { $('#storage-warning').hidden = false; };
  let nativeStorage;
  try { nativeStorage = window.localStorage; } catch (_) { warnStorage(); }
  const store = C.storage(nativeStorage || {getItem() {throw Error();}, setItem() {throw Error();}}, warnStorage);
  const saved = store.get('qp-settings-v1', {});
  let settings = saved && typeof saved === 'object' ? saved : {};
  let courseId = courses.some(c => c.id === settings.course) ? settings.course : 'qp1';
  let history = store.get('qp-history-v1', []);
  if (!Array.isArray(history)) history = [];
  // Stored sessions are validated before they can enter the rendering or scoring flow.
  function validSession(s) {
    try {
      const course = courses.find(c => c.id === s.config.course);
      C.validate(s.config, course);
      if (typeof s.id !== 'string' || !Array.isArray(s.questionIds) || !s.questionIds.length || new Set(s.questionIds).size !== s.questionIds.length || s.questionIds.some(id => !course.questions.some(q => q.id === id && s.config.lessons.includes(q.lesson)))) return false;
      if (!Number.isFinite(s.startedAt) || (s.deadline !== null && (!Number.isFinite(s.deadline) || s.deadline < s.startedAt)) || (s.finishedAt !== null && !Number.isFinite(s.finishedAt)) || !Number.isInteger(s.current) || s.current < 0 || s.current >= s.questionIds.length || !Array.isArray(s.flagged) || !s.answers || typeof s.answers !== 'object') return false;
      for (const [id, a] of Object.entries(s.answers)) {
        const q = course.questions.find(q => q.id === id);
        if (!s.questionIds.includes(id) || !q || !a || !['A','B','C','D'].includes(a.selected) || !['A','B','C','D'].includes(a.first) || !Array.isArray(a.attempts) || !a.attempts.length || a.attempts.some(x => !['A','B','C','D'].includes(x)) || a.correct !== (a.selected === q.answer)) return false;
      }
      return true;
    } catch (_) { return false; }
  }
  history = history.filter(s => validSession(s) && s.finishedAt !== null).slice(0, 50);
  let active = store.get('qp-active-v1', null);
  if (!validSession(active) || active.finishedAt !== null) active = null;
  let view = 'home', currentResult = null, reviewFilter = 'all', gridOpen = false;
  const course = () => courses.find(c => c.id === courseId);
  const sessionCourse = s => courses.find(c => c.id === s.config.course);
  const persist = () => store.set('qp-active-v1', active);
  const announce = text => { $('#live-status').textContent = text; };
  const time = seconds => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
  const date = timestamp => new Date(timestamp).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
  const lessonTitle = (c, n) => c.lessons.find(l => l.number === n)?.title || `Bài ${n}`;
  function setView(next) {
    view = next;
    document.body.classList.toggle('is-quiz', next === 'quiz');
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === (next === 'history' ? 'history' : 'home')));
    render();
    main.focus({preventScroll:true});
    window.scrollTo({top:0, behavior:'instant'});
  }
  function render() {
    if (view === 'home') renderHome();
    else if (view === 'quiz') renderQuiz();
    else if (view === 'result') renderResult();
    else renderHistory();
  }
  function lessonProgress(c, number) {
    const ids = new Set(c.questions.filter(q => q.lesson === number).map(q => q.id));
    const seen = new Set();
    for (const s of [...history, ...(active ? [active] : [])]) {
      if (s.config.course !== c.id || (s.finishedAt === null && s.config.mode === 'end')) continue;
      for (const id of Object.keys(s.answers)) if (ids.has(id) && s.answers[id].correct) seen.add(id);
    }
    return seen.size;
  }
  function renderHome() {
    const c = course();
    const answered = new Set(history.flatMap(s => Object.keys(s.answers))).size;
    main.innerHTML = `
      <section class="hero">
        <div class="hero-copy"><span class="eyebrow"><span class="small-line"></span> KHÔNG NGỪNG TIẾN BỘ</span><h1>Ôn chắc kiến thức.<br><span>Tự tin mỗi bài thi.</span></h1><p>Chia nhỏ từng bài, luyện theo cách của bạn.<br>340 câu hỏi QP1 & QP2 sẵn sàng để chinh phục.</p><div class="hero-tags"><span>${icon('check')} Đúng nguồn giáo trình</span><span>${icon('check')} Không cần kết nối mạng</span></div></div>
        <div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><div class="art-float art-check">${icon('check')}</div><div class="art-card"><div class="art-card-top">MỖI NGÀY MỘT CHÚT <span>01</span></div><div class="art-book">${icon('book')}</div><strong>Sẵn sàng tiến bộ?</strong><div class="art-progress"><span></span></div><div class="art-card-bottom">Học hiểu. Nhớ lâu. <span>+1 bước</span></div></div><div class="art-float art-spark">${icon('spark')}</div><div class="art-note">${icon('trophy')} Bạn làm được!</div></div>
      </section>
      <section class="overview" aria-label="Tổng quan học tập"><div>${icon('book')}<span><strong>340</strong><small>Câu hỏi có đáp án</small></span></div><div>${icon('grid')}<span><strong>17</strong><small>Bài có câu hỏi</small></span></div><div>${icon('target')}<span><strong>${answered}</strong><small>Câu đã luyện & nộp</small></span></div><div>${icon('chart')}<span><strong>${history.length}</strong><small>Lượt đã hoàn thành</small></span></div></section>
      ${active ? `<section class="resume-banner"><span class="resume-icon">${icon('clock')}</span><div><strong>Bạn có một bài đang làm</strong><p>${escape(active.config.course.toUpperCase())} · ${Object.keys(active.answers).length}/${active.questionIds.length} câu đã chọn${active.deadline ? ' · Đồng hồ vẫn đang chạy' : ''}</p></div><button class="button primary" data-action="resume">Tiếp tục làm bài ${icon('arrow')}</button></section>` : ''}
      <section class="learning-section"><div class="section-heading"><div><span class="eyebrow">GÓC HỌC TẬP CỦA BẠN</span><h2>Hôm nay, mình ôn gì?</h2></div><span class="subtle">Chọn học phần để bắt đầu</span></div>
      <div class="course-cards">${courses.map((item, i) => `<button class="course-card ${item.id === courseId ? 'selected' : ''}" data-course="${item.id}" aria-pressed="${item.id === courseId}"><span class="course-symbol ${i ? 'orange' : ''}">${icon(i ? 'shield' : 'book')}</span><span class="course-info"><span class="eyebrow">HỌC PHẦN ${i + 1}</span><strong>${i ? 'Công tác quốc phòng & an ninh' : 'Đường lối quốc phòng & an ninh'}</strong><small>${item.questions.length} câu hỏi <span>·</span> ${item.lessons.filter(l => l.count).length} bài có dữ liệu</small></span><span class="course-radio">${item.id === courseId ? icon('check') : ''}</span></button>`).join('')}</div>
      <div class="study-layout"><div class="lesson-panel"><div class="panel-heading"><h3>${icon('book')} Luyện tập theo bài</h3><span class="pill">${c.name}</span></div>${c.id === 'qp1' ? '<p class="source-note">Bộ giáo trình QP1 bắt đầu từ bài 2. Bài 1 chưa có câu hỏi trong tài liệu nguồn.</p>' : ''}<div class="lesson-list">${c.lessons.map(l => {
        const progress = lessonProgress(c, l.number);
        return `<button class="lesson-row" data-lesson="${l.number}" ${!l.count ? 'disabled' : ''}><span class="lesson-number">${String(l.number).padStart(2, '0')}</span><span class="lesson-info"><strong>${escape(l.title)}</strong><span>${l.count ? `${l.count} câu hỏi <span class="mini-progress"><i style="width:${progress/l.count*100}%"></i></span> ${progress}/${l.count} đã đúng` : 'Chưa có dữ liệu'}</span></span>${l.count ? icon('arrow') : '<span class="pill muted">Chưa có</span>'}</button>`;
      }).join('')}</div></div><aside class="exam-panel"><span class="exam-illustration">${icon('target')}</span><span class="eyebrow">SẴN SÀNG THỬ SỨC?</span><h3>Kiểm tra<br>kiến thức của bạn</h3><p>Tạo đề ngẫu nhiên từ các bài đã chọn. Một bước chuẩn bị cho bài thi thật.</p><ul><li>${icon('check')} Chia đều câu giữa các bài</li><li>${icon('check')} Tùy chỉnh số câu & thời gian</li><li>${icon('check')} Xem kết quả sau khi nộp</li></ul><button class="button accent full" data-action="exam">Tạo đề kiểm tra ${icon('arrow')}</button><span class="exam-hint">Mặc định 50 câu · 30 phút</span><div class="study-tip">${icon('spark')}<p><strong>Mẹo nhỏ mỗi ngày</strong>Hãy bắt đầu với một bài, rồi luyện lại những câu bạn chưa chắc.</p></div></aside></div></section>`;
  }
  let dialogReturnFocus = null;
  function openDialog(html) {
    if (!dialog.open) dialogReturnFocus = document.activeElement;
    $('#dialog-content').innerHTML = html;
    dialog.showModal();
  }
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(e => e.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first?.focus();
    }
  });
  dialog.addEventListener('close', () => {
    if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus({preventScroll:true});
    else ($('.question-text') || main).focus({preventScroll:true});
  });
  const dialogHeader = (eyebrow, title) => `<div class="dialog-heading"><div><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Đóng hộp thoại">${icon('close')}</button></div>`;
  function configure(type, lesson) {
    const c = course(), old = settings[type]?.course === courseId ? settings[type] : {};
    const oldMinutes = Number.isInteger(old.minutes) && old.minutes >= 0 && old.minutes <= 300 ? old.minutes : type === 'exam' ? 30 : 0;
    openDialog(`${dialogHeader(c.name + ' · ' + (type === 'exam' ? 'THỬ SỨC' : `BÀI ${lesson}`), type === 'exam' ? 'Tạo đề kiểm tra' : 'Chọn cách luyện tập')}
      <form id="setup-form" data-type="${type}" data-lesson="${lesson || ''}">
      ${type === 'practice' ? `<p class="dialog-description">${escape(lessonTitle(c, lesson))}</p><fieldset class="mode-options"><legend>Chế độ trả lời</legend>${Object.entries(modes).map(([key, label]) => `<label class="mode-option"><input type="radio" name="mode" value="${key}" ${(old.mode || 'retry') === key ? 'checked' : ''}><span><strong>${label}</strong><small>${key === 'retry' ? 'Chưa đúng? Thử lại cho đến khi nhớ.' : key === 'instant' ? 'Chọn một lần, xem ngay đáp án đúng.' : 'Tự làm hết bài rồi đối chiếu kết quả.'}</small></span></label>`).join('')}</fieldset><label class="check-label"><input type="checkbox" name="shuffle" ${old.shuffle ? 'checked' : ''}> Đảo thứ tự câu hỏi</label>` : `<fieldset><legend>Phạm vi kiểm tra</legend><label class="check-label select-all"><input type="checkbox" id="all-lessons" checked> Chọn tất cả bài có dữ liệu</label><div class="lesson-checks">${c.lessons.filter(l => l.count).map(l => `<label title="${escape(l.title)}"><input type="checkbox" name="lessons" value="${l.number}" checked> Bài ${l.number}</label>`).join('')}</div></fieldset><label class="field-label" for="question-count">Số câu hỏi</label><input id="question-count" name="count" type="number" min="1" max="${c.questions.length}" step="1" value="${Math.min(Number.isInteger(old.count) && old.count > 0 ? old.count : 50, c.questions.length)}" required aria-describedby="pool-hint setup-error"><p id="pool-hint" class="field-hint">Ngân hàng đã chọn: ${c.questions.length} câu. Câu hỏi được chia đều giữa các bài.</p>`}
      <div class="time-fields"><div><label class="field-label" for="time-limit">Giới hạn thời gian</label><select id="time-limit" name="timed"><option value="no" ${!oldMinutes ? 'selected' : ''}>Không giới hạn</option><option value="yes" ${oldMinutes ? 'selected' : ''}>Đặt thời gian</option></select></div><div id="minutes-field" ${!oldMinutes ? 'hidden' : ''}><label class="field-label" for="minutes">Số phút</label><input id="minutes" name="minutes" type="number" min="1" max="300" step="1" value="${oldMinutes || 30}" ${oldMinutes ? 'required' : 'disabled'} aria-describedby="setup-error"></div></div>
      <p id="setup-error" class="form-error" role="alert"></p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-dialog">Để sau</button><button class="button primary" type="submit">Bắt đầu ${icon('arrow')}</button></div></form>`);
    if (type === 'exam' && Array.isArray(old.lessons)) {
      const fields = [...dialog.querySelectorAll('[name="lessons"]')];
      const selected = fields.filter(input => old.lessons.includes(+input.value));
      if (selected.length) {
        fields.forEach(input => { input.checked = selected.includes(input); });
        fields[0].dispatchEvent(new Event('change', {bubbles:true}));
      }
    }
  }
  function begin(config, ids) {
    const start = () => {
      active = C.createSession(config, courses.find(c => c.id === config.course), Date.now(), ids);
      persist(); dialog.close(); gridOpen = false; setView('quiz');
    };
    if (active) {
      openDialog(`${dialogHeader('BÀI ĐANG LÀM', 'Bắt đầu lượt mới?')}<p>Phiên đang làm sẽ được thay thế. Lịch sử các bài đã nộp vẫn được giữ.</p><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">Giữ phiên cũ</button><button id="replace-session" class="button primary">Bắt đầu lượt mới</button></div>`);
      $('#replace-session').onclick = start;
    } else start();
  }
  function renderQuiz() {
    if (!active) { setView('home'); return; }
    if (C.expired(active)) { submit(true); return; }
    const s = active, c = sessionCourse(s), q = c.questions.find(q => q.id === s.questionIds[s.current]);
    const a = s.answers[q.id], reveal = s.config.mode === 'instant' && a || s.config.mode === 'retry' && a?.correct;
    const done = Object.keys(s.answers).length;
    const flagged = s.flagged.includes(q.id);
    main.innerHTML = `<div class="quiz-top"><button class="text-button" data-action="home">${icon('back')} Góc học tập</button><span class="pill">${c.name} · ${s.config.type === 'exam' ? 'Kiểm tra' : modes[s.config.mode]}</span><span class="timer ${s.deadline && s.deadline - Date.now() <= 60000 ? 'urgent' : ''}">${icon('clock')}<span id="timer-value" role="timer" aria-label="Thời gian làm bài">${s.deadline ? time(Math.ceil((s.deadline-Date.now())/1000)) : time(Math.floor((Date.now()-s.startedAt)/1000))}</span></span></div>
    <div class="quiz-progress-heading"><span>${done}/${s.questionIds.length} câu đã chọn</span><span>${Math.round(done/s.questionIds.length*100)}%</span></div><div class="progress-track"><span style="width:${done/s.questionIds.length*100}%"></span></div>
    <div class="quiz-layout"><section class="question-panel"><div class="question-meta"><span class="eyebrow">CÂU ${s.current + 1} <span class="subtle">/ ${s.questionIds.length}</span></span><button class="text-button ${flagged ? 'flag-active' : ''}" data-action="flag" aria-pressed="${flagged}">${icon('flag')} ${flagged ? 'Đã đánh dấu' : 'Xem lại'}</button></div><span class="question-source">${c.name} · Bài ${q.lesson} · Câu ${q.sourceNumber} trong tài liệu</span><h1 class="question-text" tabindex="-1">${escape(q.text)}</h1><div class="answer-options" role="group" aria-label="Chọn đáp án">${q.options.map(o => {
      const selected = a?.selected === o.letter;
      const tried = s.config.mode === 'retry' && a?.attempts.includes(o.letter);
      const right = reveal && o.letter === q.answer;
      const wrong = (reveal && selected && !a.correct) || (tried && o.letter !== q.answer);
      const locked = reveal || tried;
      return `<button class="answer-option ${selected ? 'chosen' : ''} ${right ? 'right' : ''} ${wrong ? 'wrong' : ''}" data-answer="${o.letter}" aria-pressed="${!!selected}" ${locked ? 'disabled' : ''}><span class="answer-letter">${o.letter}</span><span>${escape(o.text)}</span>${right ? `<span class="answer-state">${icon('check')} Đúng</span>` : wrong ? `<span class="answer-state">${icon('close')} Chưa đúng</span>` : ''}</button>`;
    }).join('')}</div>${a && s.config.mode !== 'end' ? `<div class="answer-feedback ${a.correct ? 'success' : 'error'}" role="status">${a.correct ? `${icon('check')} Chính xác! ${s.config.mode === 'retry' && a.attempts.length > 1 ? `Bạn đã chọn ${a.attempts.length} lần.` : 'Tiếp tục phát huy nhé.'}` : s.config.mode === 'retry' ? 'Chưa chính xác. Hãy thử một đáp án khác.' : `Đáp án đúng là ${q.answer}. Hãy ghi nhớ để lần sau làm tốt hơn.`}</div>` : ''}
      <div class="question-navigation"><button class="button secondary" data-action="previous" ${s.current === 0 ? 'disabled' : ''}>${icon('back')} Câu trước</button><span>${s.current+1} / ${s.questionIds.length}</span>${s.current < s.questionIds.length-1 ? `<button class="button primary" data-action="next">Câu tiếp ${icon('arrow')}</button>` : '<button class="button primary" data-action="finish">Nộp bài '+icon('check')+'</button>'}</div></section>
      <aside class="question-sidebar"><button class="grid-toggle" data-action="toggle-grid" aria-expanded="${gridOpen}" aria-controls="question-map">${icon('grid')} Bảng câu hỏi <span>${done}/${s.questionIds.length}</span></button><div id="question-map" class="question-map ${gridOpen ? 'open' : ''}"><h2>Bảng câu hỏi</h2><div class="question-grid">${s.questionIds.map((id, i) => {
        const ans = s.answers[id], visible = s.config.mode !== 'end';
        const state = ans ? visible ? ans.correct ? 'correct' : 'incorrect' : 'answered' : '';
        return `<button data-index="${i}" class="grid-cell ${state} ${i === s.current ? 'current' : ''} ${s.flagged.includes(id) ? 'flagged' : ''}" aria-label="Câu ${i+1}${ans ? ', đã chọn' : ', chưa chọn'}${visible && ans ? ans.correct ? ', đúng' : ', sai' : ''}${s.flagged.includes(id) ? ', đánh dấu xem lại' : ''}" ${i === s.current ? 'aria-current="step"' : ''}>${i+1}${s.flagged.includes(id) ? '<span class="flag-dot"></span>' : ''}</button>`;
      }).join('')}</div><div class="grid-legend"><span><i class="legend-dot answered"></i>Đã chọn</span><span><i class="legend-dot"></i>Chưa chọn</span><span><i class="legend-dot flagged"></i>Xem lại</span></div>${s.config.mode === 'retry' ? `<p class="sidebar-note">${Object.values(s.answers).filter(a=>a.correct).length} câu đã hoàn thành.<br>Điểm tính theo lần chọn đầu tiên.</p>` : '<p class="sidebar-note">Bạn có thể đánh dấu câu cần xem lại trước khi nộp.</p>'}<button class="button accent full" data-action="finish">Nộp bài ${icon('check')}</button><span class="save-note">Tiến độ tự lưu trên trình duyệt</span></div></aside></div>`;
  }
  function navigate(index) {
    active.current = Math.max(0, Math.min(active.questionIds.length-1, index)); persist(); renderQuiz();
    $('.question-text')?.focus({preventScroll:true});
    window.scrollTo({top:0, behavior:'instant'});
  }
  function confirmSubmit() {
    const blank = active.questionIds.length - Object.keys(active.answers).length;
    const unfinished = active.config.mode === 'retry' ? Object.values(active.answers).filter(a=>!a.correct).length : 0;
    openDialog(`${dialogHeader('HOÀN THÀNH LƯỢT HỌC', 'Bạn muốn nộp bài?')}<p>${blank ? `Bạn còn <strong>${blank} câu chưa trả lời</strong>. ` : 'Bạn đã chọn đáp án cho tất cả câu hỏi. '}${unfinished ? `Có ${unfinished} câu đã thử nhưng chưa đúng. ` : ''}Sau khi nộp, bạn có thể xem kết quả và luyện lại.</p><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">Tiếp tục làm</button><button class="button primary" data-action="submit">Nộp và xem kết quả</button></div>`);
  }
  function submit(auto = false) {
    if (!active || !C.finish(active)) return;
    const result = active;
    result.autoSubmitted = auto;
    history = [result, ...history.filter(s=>s.id !== result.id)].slice(0,50);
    store.set('qp-history-v1', history);
    active = null; persist();
    dialog.close(); currentResult = result; reviewFilter = 'all'; setView('result');
    if (auto) announce('Đã hết thời gian. Bài làm đã được tự động nộp.');
  }
  function renderResult() {
    const s = currentResult;
    if (!s) return setView('history');
    const c = sessionCourse(s), stats = C.summarize(s, c.questions);
    const retry = s.config.mode === 'retry';
    const failed = s.questionIds.filter(id => !s.answers[id]?.correct);
    const firstWrong = s.questionIds.filter(id => s.answers[id]?.first !== c.questions.find(q=>q.id===id).answer);
    const reviewIds = s.questionIds.filter(id => reviewFilter === 'all' || (reviewFilter === 'wrong' ? s.answers[id] && !s.answers[id].correct : reviewFilter === 'blank' ? !s.answers[id] : firstWrong.includes(id)));
    main.innerHTML = `<button class="text-button page-back" data-action="home">${icon('back')} Về góc học tập</button><section class="result-hero"><div class="result-emblem">${icon('trophy')}</div><span class="eyebrow">MỖI LƯỢT HỌC LÀ MỘT BƯỚC TIẾN</span><h1>${stats.percent >= 80 ? 'Bạn đang làm rất tốt!' : 'Thêm một bước vững vàng.'}</h1><p>${c.name} · ${s.config.type === 'exam' ? 'Kiểm tra' : modes[s.config.mode]} · ${date(s.finishedAt)}</p>${s.autoSubmitted ? '<p class="timeout-note">Hết thời gian — Bài đã được tự động nộp.</p>' : ''}<div class="score-display">${retry ? stats.percent+'<small>%</small>' : stats.score.toFixed(1)+'<small>/10</small>'}</div><span>${retry ? 'Tỷ lệ đúng ngay lần đầu' : 'Điểm bài làm'}</span><div class="result-stats"><span><strong>${stats.correct}</strong>${retry ? 'Đã làm đúng' : 'Câu đúng'}</span><span><strong>${stats.wrong}</strong>Chưa đúng</span><span><strong>${stats.blank}</strong>Bỏ trống</span><span><strong>${time(stats.elapsed)}</strong>Thời gian</span></div>${retry ? `<p class="subtle">${stats.firstCorrect}/${stats.total} câu đúng lần đầu · ${stats.correct}/${stats.total} câu hoàn thành</p>` : ''}<div class="result-actions"><button class="button primary" data-action="retry-wrong" ${failed.length ? '' : 'disabled'}>Luyện câu sai & bỏ trống (${failed.length})</button>${retry && firstWrong.length ? `<button class="button secondary" data-action="retry-first">Ôn câu chưa đúng lần đầu (${firstWrong.length})</button>` : ''}<button class="button secondary" data-action="again">Làm lượt mới ${icon('arrow')}</button></div></section>
    <section class="breakdown panel"><h2>${icon('chart')} Kết quả theo bài</h2><div class="breakdown-list">${Object.entries(stats.lessons).map(([n, l])=>`<div><span><strong>Bài ${n}</strong><small>${escape(lessonTitle(c, +n))}</small></span><span class="breakdown-count">${retry ? l.firstCorrect : l.correct}/${l.total} ${retry ? 'đúng lần đầu' : 'đúng'}</span><div class="progress-track"><span style="width:${(retry ? l.firstCorrect : l.correct)/l.total*100}%"></span></div></div>`).join('')}</div></section>
    <section class="review-section"><div class="section-heading"><h2>Đối chiếu đáp án</h2><label class="review-filter">Hiển thị <select id="review-filter"><option value="all">Tất cả câu</option><option value="wrong">Câu sai</option><option value="blank">Câu bỏ trống</option>${retry ? '<option value="first">Chưa đúng lần đầu</option>' : ''}</select></label></div><div class="review-list">${reviewIds.length ? reviewIds.map(id=>{
      const q = c.questions.find(q=>q.id===id), a = s.answers[id];
      return `<article class="review-card"><div class="review-meta"><span>Câu ${s.questionIds.indexOf(id)+1} · Bài ${q.lesson} · Câu nguồn ${q.sourceNumber}</span><span class="pill ${!a ? 'muted' : a.correct ? 'positive' : 'negative'}">${!a ? 'Bỏ trống' : a.correct ? 'Đúng' : 'Sai'}</span></div><h3>${escape(q.text)}</h3><div class="review-options">${q.options.map(o=>`<div class="${o.letter===q.answer ? 'right' : a?.selected===o.letter ? 'wrong' : ''}"><strong>${o.letter}.</strong> ${escape(o.text)} ${o.letter===q.answer ? '<b> — Đáp án đúng</b>' : ''}${a?.selected===o.letter ? '<span> (Bạn chọn)</span>' : ''}</div>`).join('')}</div>${retry && a ? `<p class="field-hint">Lần đầu: ${a.first} · Số lần chọn: ${a.attempts.length}</p>` : ''}</article>`;
    }).join('') : '<div class="empty-state">Không có câu nào trong nhóm này.</div>'}</div></section>`;
    $('#review-filter').value = reviewFilter;
  }
  function renderHistory() {
    main.innerHTML = `<section class="history-heading"><span class="eyebrow">NHÌN LẠI ĐỂ TIẾN XA</span><h1>Lịch sử làm bài</h1><p>Lưu tối đa 50 lượt gần nhất trên trình duyệt này.</p></section><div class="history-list">${history.length ? history.map(s=>{
      const stats = C.summarize(s,sessionCourse(s).questions);
      return `<button class="history-card" data-result="${escape(s.id)}"><span class="history-icon">${icon(s.config.type==='exam'?'trophy':'book')}</span><span><strong>${s.config.course.toUpperCase()} · ${s.config.type==='exam'?'Kiểm tra':modes[s.config.mode]}</strong><small>${date(s.finishedAt)} · ${stats.total} câu · ${time(stats.elapsed)}</small></span><span class="history-score">${s.config.mode==='retry'?stats.percent+'%':stats.score.toFixed(1)+'/10'}<small>${s.config.mode==='retry'?'Đúng lần đầu':'Điểm bài làm'}</small></span>${icon('arrow')}</button>`;
    }).join('') : `<div class="empty-state">${icon('book')}<h2>Hành trình của bạn bắt đầu ở đây</h2><p>Hoàn thành bài luyện tập đầu tiên để lưu kết quả.</p><button class="button primary" data-action="home">Bắt đầu ôn tập ${icon('arrow')}</button></div>`}</div>`;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (view === 'quiz' && active && C.expired(active)) { submit(true); return; }
    if (button.dataset.nav) return setView(button.dataset.nav);
    if (button.dataset.course) {courseId=button.dataset.course; settings.course=courseId; store.set('qp-settings-v1',settings); return renderHome();}
    if (button.dataset.lesson) return configure('practice',+button.dataset.lesson);
    if (button.dataset.answer && active) {
      const q = sessionCourse(active).questions.find(q=>q.id===active.questionIds[active.current]);
      if (C.answer(active,q,button.dataset.answer)) {
        persist(); renderQuiz();
        if (active.config.mode === 'end') announce(`Đã chọn đáp án ${button.dataset.answer}.`);
        else announce(active.answers[q.id].correct ? 'Chính xác.' : active.config.mode==='retry' ? 'Chưa đúng, hãy thử lại.' : `Chưa đúng. Đáp án đúng là ${q.answer}.`);
        const next = main.querySelector(`.answer-option[data-answer="${button.dataset.answer}"]`);
        if (next && !next.disabled) next.focus({preventScroll:true});
        else $('.question-text')?.focus({preventScroll:true});
      }
      return;
    }
    if (button.dataset.index !== undefined && active) return navigate(+button.dataset.index);
    if (button.dataset.result) {currentResult=history.find(s=>s.id===button.dataset.result);reviewFilter='all';return setView('result');}
    switch (button.dataset.action) {
      case 'home': return setView('home');
      case 'close-dialog': return dialog.close();
      case 'exam': return configure('exam');
      case 'resume': return setView('quiz');
      case 'next': return navigate(active.current+1);
      case 'previous': return navigate(active.current-1);
      case 'flag': { const id=active.questionIds[active.current];active.flagged=active.flagged.includes(id)?active.flagged.filter(x=>x!==id):[...active.flagged,id];persist();renderQuiz(); $('[data-action="flag"]').focus();return; }
      case 'toggle-grid': gridOpen=!gridOpen;renderQuiz();$('[data-action="toggle-grid"]').focus();return;
      case 'finish': return confirmSubmit();
      case 'submit': return submit();
      case 'again': return begin({...currentResult.config},currentResult.config.type==='review'?currentResult.questionIds:undefined);
      case 'retry-first':
      case 'retry-wrong': {
        const s=currentResult,c=sessionCourse(s), first=button.dataset.action==='retry-first';
        const ids=s.questionIds.filter(id=>first ? s.answers[id]?.first!==c.questions.find(q=>q.id===id).answer : !s.answers[id]?.correct);
        const lessons=[...new Set(ids.map(id=>c.questions.find(q=>q.id===id).lesson))];
        const config={...s.config,type:'review',mode:'retry',lessons,count:ids.length,minutes:0,shuffle:false};
        return begin(config,ids);
      }
    }
  });
  document.addEventListener('change', event => {
    if (event.target.id==='review-filter') {reviewFilter=event.target.value;renderResult();$('#review-filter').focus();return;}
    const form=$('#setup-form'); if(!form)return;
    if (event.target.id==='time-limit') {const timed=event.target.value==='yes';$('#minutes-field').hidden=!timed;$('#minutes').disabled=!timed;$('#minutes').required=timed;}
    if (event.target.id==='all-lessons') form.querySelectorAll('[name="lessons"]').forEach(input=>{input.checked=event.target.checked;});
    if (event.target.name==='lessons'||event.target.id==='all-lessons') {
      const selected=[...form.querySelectorAll('[name="lessons"]:checked')].map(e=>+e.value);
      const available=course().questions.filter(q=>selected.includes(q.lesson)).length;
      const all=$('#all-lessons');all.checked=selected.length===course().lessons.filter(l=>l.count).length;all.indeterminate=selected.length>0&&!all.checked;
      $('#question-count').max=available;
      if (!available) $('#question-count').value='';
      else if (!$('#question-count').value || +$('#question-count').value>available) $('#question-count').value=Math.min(+$('#question-count').value || 50,available);
      $('#pool-hint').textContent=`Ngân hàng đã chọn: ${available} câu. Câu hỏi được chia đều giữa các bài.`;
    }
  });
  document.addEventListener('submit', event=>{
    if(event.target.id!=='setup-form')return;
    event.preventDefault();
    const form=event.target, data=new FormData(form), type=form.dataset.type;
    const config={course:courseId,type,lessons:type==='practice'?[+form.dataset.lesson]:data.getAll('lessons').map(Number),mode:type==='exam'?'end':data.get('mode'),count:type==='exam'?Number(data.get('count')):20,minutes:data.get('timed')==='yes'?Number(data.get('minutes')):0,shuffle:data.has('shuffle')};
    try {C.validate(config,course());settings[type]=config;store.set('qp-settings-v1',settings);begin(config);}
    catch(error){$('#setup-error').textContent=error.message;}
  });
  $('.brand').addEventListener('click',event=>{event.preventDefault();setView('home');});
  function tick() {
    if (!active) return;
    if (C.expired(active)) return submit(true);
    const timer=$('#timer-value');
    if(timer){timer.textContent=active.deadline?time(Math.ceil((active.deadline-Date.now())/1000)):time(Math.floor((Date.now()-active.startedAt)/1000));timer.parentElement.classList.toggle('urgent',!!active.deadline&&active.deadline-Date.now()<=60000);}
  }
  document.addEventListener('visibilitychange',tick);
  window.addEventListener('pageshow',tick);
  setInterval(tick,1000);
  if (active && C.expired(active)) submit(true); else render();
})();
