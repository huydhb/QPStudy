(() => {
  'use strict';

  const C = window.QPCore;
  const courses = window.QP_DATA.courses;
  const $ = selector => document.querySelector(selector);
  const main = $('#main');
  const dialog = $('#dialog');

  const questionMaps = new Map(
    courses.map(c => [c.id, new Map(c.questions.map(q => [q.id, q]))])
  );
  const questionById = (c, id) => questionMaps.get(c.id)?.get(id);
  const totalQuestions = courses.reduce((sum, c) => sum + c.questions.length, 0);
  const totalActiveLessons = courses.reduce((sum, c) => sum + c.lessons.filter(l => l.count).length, 0);

  const escape = value => String(value).replace(/[&<>"']/g, c => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]
  ));

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
    shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
    play: '<polygon points="7 4 20 12 7 20 7 4"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    starFill: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
  };

  const icon = (name, cls = '') => (
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`
  );

  const modes = {
    retry: 'Chọn đến khi đúng',
    instant: 'Hiện kết quả ngay',
    end: 'Kết quả cuối bài'
  };

  const warnStorage = () => {
    $('#storage-warning').hidden = false;
  };

  let nativeStorage;
  try {
    nativeStorage = window.localStorage;
  } catch (_) {
    warnStorage();
  }
  const store = C.storage(
    nativeStorage || {getItem() { throw Error(); }, setItem() { throw Error(); }},
    warnStorage
  );

  const saved = store.get('qp-settings-v1', {});
  const settings = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  let courseId = courses.some(c => c.id === settings.course) ? settings.course : courses[0].id;
  let history = store.get('qp-history-v1', []);
  if (!Array.isArray(history)) history = [];
  const savedProfile = store.get('qp-profile-v1', null);
  let profile = savedProfile && typeof savedProfile === 'object' && !Array.isArray(savedProfile)
    ? {
        name: typeof savedProfile.name === 'string' ? savedProfile.name.trim().slice(0, 40) : '',
        dailyTarget: [10, 20, 40, 60].includes(savedProfile.dailyTarget) ? savedProfile.dailyTarget : 20
      }
    : {name: '', dailyTarget: 20};
  let profileSavedNotice = '';

  // Stored sessions are validated before entering rendering or scoring flows.
  function validSession(s) {
    try {
      if (!s || typeof s !== 'object' || !s.config || typeof s.config !== 'object') return false;
      const c = courses.find(item => item.id === s.config.course);
      C.validate(s.config, c);
      if (
        typeof s.id !== 'string' ||
        !Array.isArray(s.questionIds) ||
        !s.questionIds.length ||
        s.questionIds.length !== s.config.count ||
        new Set(s.questionIds).size !== s.questionIds.length
      ) {
        return false;
      }
      const qMap = questionMaps.get(c.id);
      const allowedLessons = new Set(s.config.lessons);
      const idSet = new Set(s.questionIds);
      if (s.questionIds.some(id => {
        const q = qMap.get(id);
        return !q || !allowedLessons.has(q.lesson);
      })) {
        return false;
      }
      if (
        !Number.isFinite(s.startedAt) ||
        (s.deadline !== null && (!Number.isFinite(s.deadline) || s.deadline < s.startedAt)) ||
        (s.finishedAt !== null && !Number.isFinite(s.finishedAt)) ||
        !Number.isInteger(s.current) ||
        s.current < 0 ||
        s.current >= s.questionIds.length ||
        !Array.isArray(s.flagged) ||
        s.flagged.some(id => typeof id !== 'string' || !idSet.has(id)) ||
        !s.answers ||
        typeof s.answers !== 'object' ||
        Array.isArray(s.answers)
      ) {
        return false;
      }
      for (const [id, a] of Object.entries(s.answers)) {
        const q = qMap.get(id);
        if (
          !idSet.has(id) ||
          !q ||
          !a ||
          typeof a !== 'object' ||
          !['A', 'B', 'C', 'D'].includes(a.selected) ||
          !['A', 'B', 'C', 'D'].includes(a.first) ||
          !Array.isArray(a.attempts) ||
          !a.attempts.length ||
          a.attempts.some(x => !['A', 'B', 'C', 'D'].includes(x)) ||
          a.correct !== (a.selected === q.answer)
        ) {
          return false;
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  history = history.filter(s => validSession(s) && s.finishedAt !== null).slice(0, 50);
  let active = store.get('qp-active-v1', null);
  if (!validSession(active) || active.finishedAt !== null) active = null;

  let view = 'home';
  let currentResult = null;
  let reviewFilter = 'all';
  let gridOpen = false;
  let menuOpen = false;

  const menuToggle = $('#menu-toggle');
  const primaryNav = $('#primary-nav');

  function setMenu(open, returnFocus = false) {
    menuOpen = !!open;
    if (primaryNav) primaryNav.classList.toggle('open', menuOpen);
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', String(menuOpen));
      menuToggle.setAttribute('aria-label', menuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng');
      menuToggle.innerHTML = menuOpen ? icon('close') : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      if (!menuOpen && returnFocus) menuToggle.focus({preventScroll: true});
    }
  }

  function scrollToSection(id) {
    const go = () => {
      const target = document.getElementById(id) || $('.learning-section');
      if (!target) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'start'});
    };
    if (view !== 'home') {
      setView('home');
      requestAnimationFrame(go);
    } else {
      go();
    }
  }

  const course = () => courses.find(c => c.id === courseId);
  const sessionCourse = s => courses.find(c => c.id === s.config.course);
  const persist = () => store.set('qp-active-v1', active);
  const announce = text => { $('#live-status').textContent = text; };

  const time = seconds => {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60).toString().padStart(2, '0');
    const secs = Math.floor(clamped % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const date = timestamp => new Date(timestamp).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const lessonTitle = (c, n) => c.lessons.find(l => l.number === n)?.title || `Bài ${n}`;

  function scopeLabel(s) {
    if (s.config.type === 'practice') return `Bài ${s.config.lessons[0]} · ${modes[s.config.mode]}`;
    if (s.config.type === 'exam') return `Kiểm tra (${s.config.lessons.length} bài)`;
    return `Ôn lại (${s.config.lessons.length} bài)`;
  }

  function setView(next) {
    view = next;
    setMenu(false);
    document.body.classList.toggle('is-home', next === 'home');
    document.body.classList.toggle('is-quiz', next === 'quiz');
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === (next === 'history' ? 'history' : 'home'));
    });
    render();
    main.focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'instant'});
  }

  function render() {
    document.body.classList.toggle('is-home', view === 'home');
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
      for (const id of Object.keys(s.answers)) {
        if (ids.has(id) && s.answers[id].correct) seen.add(id);
      }
    }
    return seen.size;
  }

  function courseMastery(c) {
    const total = c.questions.length;
    const correct = c.lessons.reduce((sum, l) => sum + (l.count ? lessonProgress(c, l.number) : 0), 0);
    return {
      correct,
      total,
      percent: total ? Math.round(correct / total * 100) : 0
    };
  }

  function nextLessonForCourse(c) {
    const activeLessons = c.lessons.filter(l => l.count > 0);
    return activeLessons.find(l => lessonProgress(c, l.number) < l.count) || activeLessons[0] || {number: 1, count: 0, title: ''};
  }

  function renderHome() {
    const c = course();
    const answered = new Set(history.flatMap(s => Object.keys(s.answers))).size;
    const courseLabels = courses.map(item => escape(item.name)).join(' &amp; ');
    const mastery = courseMastery(c);
    const nextLesson = nextLessonForCourse(c);
    const activeCourse = active ? sessionCourse(active) : null;
    const activeDone = active ? Object.keys(active.answers).length : 0;
    const activeTotal = active ? active.questionIds.length : 0;
    const activePct = activeTotal ? Math.round(activeDone / activeTotal * 100) : 0;
    const progressPct = active ? activePct : mastery.percent;

    const qp1 = courses[0];
    const qp2 = courses[1] || courses[0];
    const qp1Mastery = courseMastery(qp1);
    const qp2Mastery = courseMastery(qp2);
    const qp1Active = qp1.lessons.filter(l => l.count).length;
    const qp2Active = qp2.lessons.filter(l => l.count).length;

    main.innerHTML = `
      <section class="band band-cream hero-band">
        <div class="section-inner hero">
          <div class="hero-copy">
            <span class="clay-pill mint"><span class="status-dot" aria-hidden="true"></span> ${totalQuestions} câu hỏi giáo trình · Học offline</span>
            <h1>Ôn chắc kiến thức.<br><span class="hero-accent">Tự tin</span> mỗi bài thi!</h1>
            <p class="hero-lead">${profile.name ? `Chào <strong>${escape(profile.name)}</strong>! ` : ''}Chia nhỏ từng bài ${courseLabels}, luyện theo nhịp riêng của bạn (mục tiêu ${profile.dailyTarget} câu/ngày) và làm đề kiểm tra tự động ngay trên trình duyệt.</p>
            <div class="hero-cta-row">
              <button type="button" class="button primary hero-btn" data-scroll="courses">Bắt đầu học miễn phí ${icon('arrow')}</button>
              <button type="button" class="button secondary hero-btn" data-action="open-exam">Tạo đề kiểm tra</button>
            </div>
            <div class="hero-stats" aria-label="Tổng quan nền tảng">
              <div><strong>${totalQuestions}</strong><small>Câu hỏi có đáp án</small></div>
              <div><strong>${totalActiveLessons}</strong><small>Bài có câu hỏi</small></div>
              <div><strong>${answered}</strong><small>Câu đã luyện &amp; nộp</small></div>
            </div>
          </div>
          <div class="hero-progress-wrap">
            <div class="clay-float float-target peach" aria-hidden="true">${icon('target')}</div>
            <div class="clay-float float-book purple" aria-hidden="true">${icon('layers')}</div>
            <div class="clay-float float-star mint" aria-hidden="true">${icon('starFill')}</div>
            <div class="clay-card progress-card">
              <div class="progress-card-head">
                <span class="clay-icon md sky" aria-hidden="true">${icon('play')}</span>
                <div>
                  <strong>${active ? `${escape(activeCourse.name)} · Đang làm dở` : `${escape(c.name)} — ${escape(c.subtitle)}`}</strong>
                  <small>${active ? `${activeDone}/${activeTotal} câu đã chọn${active.deadline ? ' · Đồng hồ đang chạy' : ''}` : `Tiếp theo: Bài ${String(nextLesson.number).padStart(2, '0')} · ${mastery.correct}/${mastery.total} câu vững`}</small>
                </div>
              </div>
              <div class="progress-meta">
                <span>${active ? 'Tiến độ lượt đang làm' : 'Tiến độ nắm vững'}</span>
                <strong>${progressPct}%</strong>
              </div>
              <div class="clay-progress-track" aria-hidden="true"><span class="clay-progress-fill" style="width:${progressPct}%"></span></div>
              ${active
                ? `<button type="button" class="button primary full" data-action="resume">Tiếp tục làm bài ${icon('arrow')}</button>`
                : `<button type="button" class="button primary full" data-quick-lesson="${nextLesson.number}">Luyện ngay Bài ${String(nextLesson.number).padStart(2, '0')} ${icon('arrow')}</button>`}
            </div>
          </div>
        </div>
      </section>
      <section id="courses" class="band band-white courses-band">
        <div class="section-inner">
          <div class="section-head-center">
            <span class="clay-pill sky">Học phần &amp; Lộ trình ôn tập</span>
            <h2>Khám phá các học phần nổi bật</h2>
            <p class="section-subtitle">Chọn học phần để luyện theo từng bài hoặc tạo đề kiểm tra tổng hợp sát cấu trúc giáo trình.</p>
          </div>
          ${active ? `
            <div class="resume-banner clay-card">
              <span class="clay-icon md peach" aria-hidden="true">${icon('clock')}</span>
              <div>
                <strong>Bạn có một bài đang làm dở</strong>
                <p>${escape(active.config.course.toUpperCase())} · ${activeDone}/${activeTotal} câu đã chọn${active.deadline ? ' · Đồng hồ vẫn đang chạy' : ''}</p>
              </div>
              <button type="button" class="button primary" data-action="resume-session">Tiếp tục làm bài ${icon('arrow')}</button>
            </div>
          ` : ''}
          <div class="featured-courses-grid">
            <button type="button" class="clay-card clay-interactive featured-course-card ${qp1.id === courseId ? 'selected' : ''}" data-course="${escape(qp1.id)}" aria-pressed="${qp1.id === courseId}">
              <span class="clay-icon lg peach" aria-hidden="true">${icon('book')}</span>
              <span class="fc-body">
                <span class="fc-top">
                  <span class="fc-title-group">
                    <strong>Học phần 1 · ${escape(qp1.subtitle || 'Đường lối QP&AN')}</strong>
                    <small>Giáo trình MILI2701 · ${qp1.id === courseId ? 'Đang hiển thị bài bên dưới' : 'Bấm để mở danh sách bài'}</small>
                  </span>
                  <span class="rating-pill">${icon('starFill')} ${qp1Mastery.percent}%</span>
                </span>
                <span class="fc-meta">
                  <span>${icon('book')} ${qp1Active} bài</span>
                  <span>${icon('clock')} 20 câu/bài</span>
                  <span>${icon('users')} ${qp1.questions.length} câu</span>
                </span>
              </span>
            </button>
            <button type="button" class="clay-card clay-interactive featured-course-card ${qp2.id === courseId ? 'selected' : ''}" data-course="${escape(qp2.id)}" aria-pressed="${qp2.id === courseId}">
              <span class="clay-icon lg sky" aria-hidden="true">${icon('shield')}</span>
              <span class="fc-body">
                <span class="fc-top">
                  <span class="fc-title-group">
                    <strong>Học phần 2 · ${escape(qp2.subtitle || 'Công tác QP&AN')}</strong>
                    <small>Giáo trình MILI2702 · ${qp2.id === courseId ? 'Đang hiển thị bài bên dưới' : 'Bấm để mở danh sách bài'}</small>
                  </span>
                  <span class="rating-pill">${icon('starFill')} ${qp2Mastery.percent}%</span>
                </span>
                <span class="fc-meta">
                  <span>${icon('book')} ${qp2Active} bài</span>
                  <span>${icon('clock')} 20 câu/bài</span>
                  <span>${icon('users')} ${qp2.questions.length} câu</span>
                </span>
              </span>
            </button>
            <button type="button" class="clay-card clay-interactive featured-course-card" data-action="open-exam">
              <span class="clay-icon lg purple" aria-hidden="true">${icon('target')}</span>
              <span class="fc-body">
                <span class="fc-top">
                  <span class="fc-title-group">
                    <strong>Đề kiểm tra tổng hợp</strong>
                    <small>Trộn đều câu giữa nhiều bài · Tự nộp khi hết giờ</small>
                  </span>
                  <span class="rating-pill">${icon('starFill')} Thi thử</span>
                </span>
                <span class="fc-meta">
                  <span>${icon('layers')} Tùy chọn bài</span>
                  <span>${icon('clock')} 30 phút</span>
                  <span>${icon('check')} 50 câu</span>
                </span>
              </span>
            </button>
            <button type="button" class="clay-card clay-interactive featured-course-card" data-action="go-history">
              <span class="clay-icon lg mint" aria-hidden="true">${icon('chart')}</span>
              <span class="fc-body">
                <span class="fc-top">
                  <span class="fc-title-group">
                    <strong>Lịch sử &amp; Ôn lại câu sai</strong>
                    <small>Xem lại đáp án chi tiết và luyện riêng câu chưa đúng</small>
                  </span>
                  <span class="rating-pill">${icon('starFill')} ${history.length} lượt</span>
                </span>
                <span class="fc-meta">
                  <span>${icon('award')} Lưu 50 lượt</span>
                  <span>${icon('target')} Chi tiết A–D</span>
                  <span>${icon('spark')} Ôn nhanh</span>
                </span>
              </span>
            </button>
          </div>
          <div class="study-layout">
            <div class="lesson-panel clay-card">
              <div class="panel-heading">
                <h3>${icon('book')} Luyện tập theo bài</h3>
                <span class="clay-pill sky pill-compact">${escape(c.name)}</span>
              </div>
              ${c.note ? `<p class="source-note">${escape(c.note)}</p>` : ''}
              <div class="lesson-list">
                ${c.lessons.map(l => {
                  const progress = lessonProgress(c, l.number);
                  return `
                    <button type="button" class="lesson-row" data-lesson="${l.number}" ${!l.count ? 'disabled' : ''}>
                      <span class="lesson-number">${String(l.number).padStart(2, '0')}</span>
                      <span class="lesson-info">
                        <strong>${escape(l.title)}</strong>
                        <span>${l.count ? `${l.count} câu hỏi <span class="mini-progress"><i style="width:${progress / l.count * 100}%"></i></span> ${progress}/${l.count} đã đúng` : 'Chưa có dữ liệu'}</span>
                      </span>
                      ${l.count ? icon('arrow') : '<span class="pill muted">Chưa có</span>'}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
            <aside class="exam-panel clay-card">
              <span class="clay-icon lg peach exam-illustration" aria-hidden="true">${icon('target')}</span>
              <span class="eyebrow">SẴN SÀNG THỬ SỨC?</span>
              <h3>Kiểm tra kiến thức của bạn</h3>
              <p>Tạo đề ngẫu nhiên từ các bài đã chọn. Một bước chuẩn bị cho bài thi thật.</p>
              <ul>
                <li>${icon('check')} Chia đều câu giữa các bài</li>
                <li>${icon('check')} Tùy chỉnh số câu &amp; thời gian</li>
                <li>${icon('check')} Xem kết quả sau khi nộp</li>
              </ul>
              <button type="button" class="button primary full" data-action="exam">Tạo đề kiểm tra ${icon('arrow')}</button>
              <span class="exam-hint">Mặc định 50 câu · 30 phút</span>
              <div class="study-tip">
                ${icon('spark')}
                <p><strong>Mẹo nhỏ mỗi ngày</strong>Hãy bắt đầu với một bài, rồi luyện lại những câu bạn chưa chắc.</p>
              </div>
            </aside>
          </div>
          <div class="courses-footer-cta">
            <button type="button" class="button secondary" data-action="go-history">Xem tất cả lượt đã làm ${icon('arrow')}</button>
          </div>
        </div>
      </section>
      <section id="benefits" class="band band-cream benefits-band">
        <div class="section-inner">
          <div class="section-head-center">
            <span class="clay-pill peach">Vì sao chọn QP Study?</span>
            <h2>Mọi thứ bạn cần để ôn thi vững vàng</h2>
          </div>
          <div class="benefits-grid">
            <article class="soft-clay benefit-card">
              <span class="clay-icon xl peach" aria-hidden="true">${icon('clock')}</span>
              <h3>Học theo nhịp của bạn</h3>
              <p>Linh hoạt 3 chế độ trả lời: chọn đến khi đúng, hiện đáp án ngay hoặc tự làm rồi chấm cuối bài.</p>
            </article>
            <article class="soft-clay benefit-card">
              <span class="clay-icon xl sky" aria-hidden="true">${icon('book')}</span>
              <h3>Chuẩn 340 câu giáo trình</h3>
              <p>Tổng hợp đủ 200 câu QP1 và 140 câu QP2 từ tài liệu gốc, giữ nguyên số bài và câu nguồn để đối chiếu.</p>
            </article>
            <article class="soft-clay benefit-card">
              <span class="clay-icon xl purple" aria-hidden="true">${icon('award')}</span>
              <h3>Đề thi thử cân bằng</h3>
              <p>Tự động chia đều câu hỏi giữa các bài bạn chọn, có đồng hồ đếm ngược và tự nộp khi hết giờ.</p>
            </article>
            <article class="soft-clay benefit-card">
              <span class="clay-icon xl mint" aria-hidden="true">${icon('users')}</span>
              <h3>Ôn câu sai &amp; học offline</h3>
              <p>Lưu 50 lượt gần nhất ngay trên trình duyệt, lọc câu chưa đúng để luyện lại mọi lúc không cần mạng.</p>
            </article>
          </div>
        </div>
      </section>
      <section id="testimonials" class="band band-white testimonials-band">
        <div class="section-inner">
          <div class="section-head-center">
            <span class="clay-pill mint">Góc chia sẻ học viên</span>
            <h2>Sinh viên nói gì về QP Study</h2>
          </div>
          <div class="testimonials-grid">
            <article class="clay-card testimonial-card">
              <div class="star-row" role="img" aria-label="Đánh giá 5 trên 5 sao">${Array.from({length: 5}, () => icon('starFill')).join('')}</div>
              <p class="testimonial-quote">&ldquo;Mình thích nhất chế độ chọn đến khi đúng. Làm hết một lượt bài là nhớ luôn đáp án chuẩn giáo trình mà không bị ngợp.&rdquo;</p>
              <div class="testimonial-author">
                <span class="clay-icon md peach" aria-hidden="true">M</span>
                <div><strong>Minh Anh</strong><small>Sinh viên Sư phạm Tin học</small></div>
              </div>
            </article>
            <article class="clay-card testimonial-card">
              <div class="star-row" role="img" aria-label="Đánh giá 5 trên 5 sao">${Array.from({length: 5}, () => icon('starFill')).join('')}</div>
              <p class="testimonial-quote">&ldquo;Phần tạo đề kiểm tra 50 câu trong 30 phút rất giống thi thật. Nộp xong lọc riêng câu sai để ôn lại chỉ mất vài phút mỗi tối.&rdquo;</p>
              <div class="testimonial-author">
                <span class="clay-icon md sky" aria-hidden="true">H</span>
                <div><strong>Hoàng Nam</strong><small>Sinh viên Sư phạm Toán học</small></div>
              </div>
            </article>
            <article class="clay-card testimonial-card">
              <div class="star-row" role="img" aria-label="Đánh giá 5 trên 5 sao">${Array.from({length: 5}, () => icon('starFill')).join('')}</div>
              <p class="testimonial-quote">&ldquo;Mở thẳng trên điện thoại không cần Wi-Fi vẫn chạy mượt, lỡ thoát ra quay lại vẫn giữ nguyên đồng hồ và các câu đã chọn.&rdquo;</p>
              <div class="testimonial-author">
                <span class="clay-icon md purple" aria-hidden="true">T</span>
                <div><strong>Thảo Vy</strong><small>Sinh viên Ngữ văn</small></div>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section id="signup" class="band band-sky signup-band">
        <div class="section-inner">
          <div class="clay-card cta-card">
            <h2>Sẵn sàng bắt đầu ôn tập hôm nay?</h2>
            <p class="cta-subtitle">Đặt mục tiêu học mỗi ngày trên trình duyệt hoặc vào thẳng phòng luyện tập — miễn phí hoàn toàn, không cần tài khoản.</p>
            <form id="goal-form" class="goal-form">
              <label class="goal-field">
                <span>Tên của bạn (tùy chọn)</span>
                <input id="goal-name" name="name" type="text" maxlength="40" placeholder="Ví dụ: Bảo Huy" value="${escape(profile.name)}">
              </label>
              <label class="goal-field">
                <span>Mục tiêu mỗi ngày</span>
                <select id="goal-target" name="dailyTarget">
                  ${[10, 20, 40, 60].map(n => `<option value="${n}" ${profile.dailyTarget === n ? 'selected' : ''}>${n} câu / ngày</option>`).join('')}
                </select>
              </label>
              <button type="submit" id="goal-save-btn" class="button secondary goal-submit">Lưu mục tiêu</button>
            </form>
            <p id="goal-status" class="goal-status" role="status" aria-live="polite" ${profileSavedNotice ? '' : 'hidden'}>${escape(profileSavedNotice)}</p>
            <div class="cta-actions">
              <button type="button" class="button primary hero-btn" data-scroll="courses">Bắt đầu học miễn phí ${icon('arrow')}</button>
              <button type="button" class="button secondary hero-btn" data-action="open-exam">Tạo đề kiểm tra</button>
            </div>
            <div class="cta-trust">
              <span>${icon('check')} Không cần thẻ hay đăng ký tài khoản</span>
              <span>${icon('check')} Lưu tiến độ an toàn trên thiết bị</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  let dialogReturnFocus = null;

  function openDialog(html, focusSelector) {
    const wasOpen = dialog.open;
    if (!wasOpen) dialogReturnFocus = document.activeElement;
    $('#dialog-content').innerHTML = html;
    if (!wasOpen) dialog.showModal();
    if (focusSelector) $(focusSelector)?.focus({preventScroll: true});
    else if (wasOpen) {
      dialog.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus({preventScroll: true});
    }
  }

  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [
      ...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')
    ].filter(e => e.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const inside = focusable.includes(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener('close', () => {
    const activeEl = document.activeElement;
    if (activeEl && activeEl !== document.body && !dialog.contains(activeEl)) return;
    if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus({preventScroll: true});
    else ($('.question-text') || main).focus({preventScroll: true});
  });

  const dialogHeader = (eyebrow, title) => `
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">${escape(eyebrow)}</span>
        <h2 id="dialog-title">${escape(title)}</h2>
      </div>
      <button type="button" class="icon-button" data-action="close-dialog" aria-label="Đóng hộp thoại">${icon('close')}</button>
    </div>
  `;

  function configure(type, lesson) {
    const c = course();
    const old = settings[type]?.course === courseId ? settings[type] : {};
    const oldMinutes = Number.isInteger(old.minutes) && old.minutes >= 0 && old.minutes <= 300
      ? old.minutes
      : type === 'exam' ? 30 : 0;
    const selectedMode = modes[old.mode] ? old.mode : 'retry';
    const defaultCount = Math.min(Number.isInteger(old.count) && old.count > 0 ? old.count : 50, c.questions.length);

    openDialog(`
      ${dialogHeader(`${c.name} · ${type === 'exam' ? 'THỬ SỨC' : `BÀI ${lesson}`}`, type === 'exam' ? 'Tạo đề kiểm tra' : 'Chọn cách luyện tập')}
      <form id="setup-form" data-type="${type}" data-lesson="${lesson || ''}" novalidate>
        ${type === 'practice' ? `
          <p class="dialog-description">${escape(lessonTitle(c, lesson))}</p>
          <fieldset class="mode-options">
            <legend>Chế độ trả lời</legend>
            ${Object.entries(modes).map(([key, label]) => `
              <label class="mode-option">
                <input type="radio" name="mode" value="${key}" ${selectedMode === key ? 'checked' : ''}>
                <span>
                  <strong>${escape(label)}</strong>
                  <small>${key === 'retry' ? 'Chưa đúng? Thử lại cho đến khi nhớ.' : key === 'instant' ? 'Chọn một lần, xem ngay đáp án đúng.' : 'Tự làm hết bài rồi đối chiếu kết quả.'}</small>
                </span>
              </label>
            `).join('')}
          </fieldset>
          <label class="check-label"><input type="checkbox" name="shuffle" ${old.shuffle ? 'checked' : ''}> Đảo thứ tự câu hỏi</label>
        ` : `
          <fieldset>
            <legend>Phạm vi kiểm tra</legend>
            <label class="check-label select-all"><input type="checkbox" id="all-lessons" checked> Chọn tất cả bài có dữ liệu</label>
            <div class="lesson-checks">
              ${c.lessons.filter(l => l.count).map(l => `
                <label title="${escape(l.title)}"><input type="checkbox" name="lessons" value="${l.number}" checked> Bài ${l.number}</label>
              `).join('')}
            </div>
          </fieldset>
          <label class="field-label" for="question-count">Số câu hỏi</label>
          <input id="question-count" name="count" type="number" min="1" max="${c.questions.length}" step="1" value="${defaultCount}" required aria-describedby="pool-hint setup-error">
          <p id="pool-hint" class="field-hint">Ngân hàng đã chọn: ${c.questions.length} câu. Câu hỏi được chia đều giữa các bài.</p>
        `}
        <div class="time-fields">
          <div>
            <label class="field-label" for="time-limit">Giới hạn thời gian</label>
            <select id="time-limit" name="timed">
              <option value="no" ${!oldMinutes ? 'selected' : ''}>Không giới hạn</option>
              <option value="yes" ${oldMinutes ? 'selected' : ''}>Đặt thời gian</option>
            </select>
          </div>
          <div id="minutes-field" ${!oldMinutes ? 'hidden' : ''}>
            <label class="field-label" for="minutes">Số phút</label>
            <input id="minutes" name="minutes" type="number" min="1" max="300" step="1" value="${oldMinutes || 30}" ${oldMinutes ? 'required' : 'disabled'} aria-describedby="setup-error">
          </div>
        </div>
        <p id="setup-error" class="form-error" role="alert"></p>
        <div class="dialog-actions">
          <button class="button secondary" type="button" data-action="close-dialog">Để sau</button>
          <button class="button primary" type="submit">Bắt đầu ${icon('arrow')}</button>
        </div>
      </form>
    `);

    if (type === 'exam' && Array.isArray(old.lessons)) {
      const fields = [...dialog.querySelectorAll('[name="lessons"]')];
      const selected = fields.filter(input => old.lessons.includes(+input.value));
      if (selected.length) {
        fields.forEach(input => { input.checked = selected.includes(input); });
        fields[0].dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
  }

  function begin(config, ids, onConfirm) {
    const start = () => {
      onConfirm?.();
      active = C.createSession(config, courses.find(c => c.id === config.course), Date.now(), ids);
      persist();
      dialog.close();
      gridOpen = false;
      setView('quiz');
    };
    if (active) {
      openDialog(`
        ${dialogHeader('BÀI ĐANG LÀM', 'Bắt đầu lượt mới?')}
        <p>Phiên đang làm sẽ được thay thế. Lịch sử các bài đã nộp vẫn được giữ.</p>
        <div class="dialog-actions">
          <button type="button" class="button secondary" data-action="close-dialog">Giữ phiên cũ</button>
          <button type="button" id="replace-session" class="button primary">Bắt đầu lượt mới</button>
        </div>
      `, '.dialog-actions [data-action="close-dialog"]');
      $('#replace-session').onclick = start;
    } else {
      start();
    }
  }

  function renderQuiz() {
    if (!active) { setView('home'); return; }
    if (C.expired(active)) { submit(true); return; }

    const prevGrid = $('.question-grid');
    const prevScroll = prevGrid && prevGrid.clientHeight > 0 ? prevGrid.scrollTop : null;

    const s = active;
    const c = sessionCourse(s);
    const q = questionById(c, s.questionIds[s.current]);
    const a = s.answers[q.id];
    const reveal = (s.config.mode === 'instant' && a) || (s.config.mode === 'retry' && a?.correct);
    const done = Object.keys(s.answers).length;
    const flagged = s.flagged.includes(q.id);
    const flaggedSet = new Set(s.flagged);
    const legendHtml = s.config.mode === 'end'
      ? '<span><i class="legend-dot answered"></i>Đã chọn</span><span><i class="legend-dot"></i>Chưa chọn</span><span><i class="legend-dot flagged"></i>Xem lại</span>'
      : '<span><i class="legend-dot correct"></i>Đúng</span><span><i class="legend-dot incorrect"></i>Sai</span><span><i class="legend-dot"></i>Chưa chọn</span><span><i class="legend-dot flagged"></i>Xem lại</span>';

    main.innerHTML = `
      <div class="quiz-top">
        <button type="button" class="text-button" data-action="home">${icon('back')} Góc học tập</button>
        <span class="pill">${escape(c.name)} · ${s.config.type === 'exam' ? 'Kiểm tra' : escape(modes[s.config.mode])}</span>
        <span class="timer ${s.deadline && s.deadline - Date.now() <= 60000 ? 'urgent' : ''}">
          ${icon('clock')}
          <span id="timer-value" role="timer" aria-label="Thời gian làm bài">${s.deadline ? time(Math.ceil((s.deadline - Date.now()) / 1000)) : time(Math.floor((Date.now() - s.startedAt) / 1000))}</span>
        </span>
      </div>
      <div class="quiz-progress-heading">
        <span>${done}/${s.questionIds.length} câu đã chọn</span>
        <span>${Math.round(done / s.questionIds.length * 100)}%</span>
      </div>
      <div class="progress-track"><span style="width:${done / s.questionIds.length * 100}%"></span></div>
      <div class="quiz-layout">
        <section class="question-panel">
          <div class="question-meta">
            <span class="eyebrow">CÂU ${s.current + 1} <span class="subtle">/ ${s.questionIds.length}</span></span>
            <button type="button" class="text-button ${flagged ? 'flag-active' : ''}" data-action="flag" aria-pressed="${flagged}">${icon('flag')} ${flagged ? 'Đã đánh dấu' : 'Xem lại'}</button>
          </div>
          <span class="question-source">${escape(c.name)} · Bài ${q.lesson} · Câu ${q.sourceNumber} trong tài liệu</span>
          <h1 class="question-text" tabindex="-1">${escape(q.text)}</h1>
          <div class="answer-options" role="group" aria-label="Chọn đáp án">
            ${q.options.map(o => {
              const selected = a?.selected === o.letter;
              const tried = s.config.mode === 'retry' && a?.attempts.includes(o.letter);
              const right = reveal && o.letter === q.answer;
              const wrong = (reveal && selected && !a.correct) || (tried && o.letter !== q.answer);
              const locked = reveal || tried;
              return `
                <button type="button" class="answer-option ${selected ? 'chosen' : ''} ${right ? 'right' : ''} ${wrong ? 'wrong' : ''}" data-answer="${escape(o.letter)}" aria-pressed="${!!selected}" ${locked ? 'disabled' : ''}>
                  <span class="answer-letter">${escape(o.letter)}</span>
                  <span>${escape(o.text)}</span>
                  ${right ? `<span class="answer-state">${icon('check')} Đúng</span>` : wrong ? `<span class="answer-state">${icon('close')} Chưa đúng</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
          ${a && s.config.mode !== 'end' ? `
            <div class="answer-feedback ${a.correct ? 'success' : 'error'}" role="status">
              ${a.correct
                ? `${icon('check')} Chính xác! ${s.config.mode === 'retry' && a.attempts.length > 1 ? `Bạn đã chọn ${a.attempts.length} lần.` : 'Tiếp tục phát huy nhé.'}`
                : s.config.mode === 'retry'
                  ? 'Chưa chính xác. Hãy thử một đáp án khác.'
                  : `Đáp án đúng là ${escape(q.answer)}. Hãy ghi nhớ để lần sau làm tốt hơn.`}
            </div>
          ` : ''}
          <div class="question-navigation">
            <button type="button" class="button secondary" data-action="previous" ${s.current === 0 ? 'disabled' : ''}>${icon('back')} Câu trước</button>
            <span>${s.current + 1} / ${s.questionIds.length}</span>
            ${s.current < s.questionIds.length - 1
              ? `<button type="button" class="button primary" data-action="next">Câu tiếp ${icon('arrow')}</button>`
              : `<button type="button" class="button primary" data-action="finish">Nộp bài ${icon('check')}</button>`}
          </div>
        </section>
        <aside class="question-sidebar">
          <button type="button" class="grid-toggle" data-action="toggle-grid" aria-expanded="${gridOpen}" aria-controls="question-map">${icon('grid')} Bảng câu hỏi <span>${done}/${s.questionIds.length}</span></button>
          <div id="question-map" class="question-map ${gridOpen ? 'open' : ''}">
            <h2>Bảng câu hỏi</h2>
            <div class="question-grid">
              ${s.questionIds.map((id, i) => {
                const ans = s.answers[id];
                const visible = s.config.mode !== 'end';
                const state = ans ? (visible ? (ans.correct ? 'correct' : 'incorrect') : 'answered') : '';
                const isFlagged = flaggedSet.has(id);
                return `<button type="button" data-index="${i}" class="grid-cell ${state} ${i === s.current ? 'current' : ''} ${isFlagged ? 'flagged' : ''}" aria-label="Câu ${i + 1}${ans ? ', đã chọn' : ', chưa chọn'}${visible && ans ? (ans.correct ? ', đúng' : ', sai') : ''}${isFlagged ? ', đánh dấu xem lại' : ''}" ${i === s.current ? 'aria-current="step"' : ''}>${i + 1}${isFlagged ? '<span class="flag-dot"></span>' : ''}</button>`;
              }).join('')}
            </div>
            <div class="grid-legend">${legendHtml}</div>
            ${s.config.mode === 'retry'
              ? `<p class="sidebar-note">${Object.values(s.answers).filter(item => item.correct).length} câu đã hoàn thành.<br>Điểm tính theo lần chọn đầu tiên.</p>`
              : '<p class="sidebar-note">Bạn có thể đánh dấu câu cần xem lại trước khi nộp.</p>'}
            <button type="button" class="button accent full" data-action="finish">Nộp bài ${icon('check')}</button>
            <span class="save-note">Tiến độ tự lưu trên trình duyệt</span>
          </div>
        </aside>
      </div>
    `;

    const nextGrid = $('.question-grid');
    if (nextGrid && nextGrid.clientHeight > 0) {
      if (prevScroll !== null) nextGrid.scrollTop = prevScroll;
      const currentCell = nextGrid.querySelector('.grid-cell.current');
      if (currentCell) {
        const gRect = nextGrid.getBoundingClientRect();
        const cRect = currentCell.getBoundingClientRect();
        if (cRect.top < gRect.top) nextGrid.scrollTop += cRect.top - gRect.top - 4;
        else if (cRect.bottom > gRect.bottom) nextGrid.scrollTop += cRect.bottom - gRect.bottom + 4;
      }
    }
  }

  function navigate(index) {
    active.current = Math.max(0, Math.min(active.questionIds.length - 1, index));
    persist();
    renderQuiz();
    $('.question-text')?.focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'instant'});
  }

  function confirmSubmit() {
    const blank = active.questionIds.length - Object.keys(active.answers).length;
    const unfinished = active.config.mode === 'retry'
      ? Object.values(active.answers).filter(a => !a.correct).length
      : 0;
    openDialog(`
      ${dialogHeader('HOÀN THÀNH LƯỢT HỌC', 'Bạn muốn nộp bài?')}
      <p>${blank ? `Bạn còn <strong>${blank} câu chưa trả lời</strong>. ` : 'Bạn đã chọn đáp án cho tất cả câu hỏi. '}${unfinished ? `Có ${unfinished} câu đã thử nhưng chưa đúng. ` : ''}Sau khi nộp, bạn có thể xem kết quả và luyện lại.</p>
      <div class="dialog-actions">
        <button type="button" class="button secondary" data-action="close-dialog">Tiếp tục làm</button>
        <button type="button" class="button primary" data-action="submit">Nộp và xem kết quả</button>
      </div>
    `);
  }

  function submit(auto = false) {
    if (!active || !C.finish(active)) return;
    const result = active;
    result.autoSubmitted = auto;
    history = [result, ...history.filter(s => s.id !== result.id)].slice(0, 50);
    store.set('qp-history-v1', history);
    active = null;
    persist();
    dialog.close();
    currentResult = result;
    reviewFilter = 'all';
    setView('result');
    if (auto) announce('Đã hết thời gian. Bài làm đã được tự động nộp.');
  }

  function renderResult() {
    const s = currentResult;
    if (!s) { setView('history'); return; }
    const c = sessionCourse(s);
    const qMap = questionMaps.get(c.id);
    const stats = C.summarize(s, qMap);
    const retry = s.config.mode === 'retry';
    const failed = s.questionIds.filter(id => !s.answers[id]?.correct);
    const firstWrong = s.questionIds.filter(id => s.answers[id]?.first !== qMap.get(id).answer);
    const firstWrongSet = new Set(firstWrong);
    const orderMap = new Map(s.questionIds.map((id, idx) => [id, idx + 1]));
    const reviewIds = s.questionIds.filter(id => {
      if (reviewFilter === 'all') return true;
      if (reviewFilter === 'wrong') return Boolean(s.answers[id] && !s.answers[id].correct);
      if (reviewFilter === 'blank') return !s.answers[id];
      return firstWrongSet.has(id);
    });

    main.innerHTML = `
      <button type="button" class="text-button page-back" data-action="home">${icon('back')} Về góc học tập</button>
      <section class="result-hero">
        <div class="result-emblem">${icon('trophy')}</div>
        <span class="eyebrow">MỖI LƯỢT HỌC LÀ MỘT BƯỚC TIẾN</span>
        <h1>${stats.percent >= 80 ? 'Bạn đang làm rất tốt!' : 'Thêm một bước vững vàng.'}</h1>
        <p>${escape(c.name)} · ${s.config.type === 'exam' ? 'Kiểm tra' : escape(modes[s.config.mode])} · ${escape(date(s.finishedAt))}</p>
        ${s.autoSubmitted ? '<p class="timeout-note">Hết thời gian — Bài đã được tự động nộp.</p>' : ''}
        <div class="score-display">${retry ? `${stats.percent}<small>%</small>` : `${stats.score.toFixed(1)}<small>/10</small>`}</div>
        <span>${retry ? 'Tỷ lệ đúng ngay lần đầu' : 'Điểm bài làm'}</span>
        <div class="result-stats">
          <span><strong>${stats.correct}</strong>${retry ? 'Đã làm đúng' : 'Câu đúng'}</span>
          <span><strong>${stats.wrong}</strong>Chưa đúng</span>
          <span><strong>${stats.blank}</strong>Bỏ trống</span>
          <span><strong>${time(stats.elapsed)}</strong>Thời gian</span>
        </div>
        ${retry ? `<p class="subtle">${stats.firstCorrect}/${stats.total} câu đúng lần đầu · ${stats.correct}/${stats.total} câu hoàn thành</p>` : ''}
        <div class="result-actions">
          <button type="button" class="button primary" data-action="retry-wrong" ${failed.length ? '' : 'disabled'}>Luyện câu sai &amp; bỏ trống (${failed.length})</button>
          ${retry && firstWrong.length ? `<button type="button" class="button secondary" data-action="retry-first">Ôn câu chưa đúng lần đầu (${firstWrong.length})</button>` : ''}
          <button type="button" class="button secondary" data-action="again">Làm lượt mới ${icon('arrow')}</button>
        </div>
      </section>
      <section class="breakdown panel">
        <h2>${icon('chart')} Kết quả theo bài</h2>
        <div class="breakdown-list">
          ${Object.entries(stats.lessons).map(([n, l]) => `
            <div>
              <span><strong>Bài ${n}</strong><small>${escape(lessonTitle(c, +n))}</small></span>
              <span class="breakdown-count">${retry ? l.firstCorrect : l.correct}/${l.total} ${retry ? 'đúng lần đầu' : 'đúng'}</span>
              <div class="progress-track"><span style="width:${(retry ? l.firstCorrect : l.correct) / l.total * 100}%"></span></div>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="review-section">
        <div class="section-heading">
          <h2>Đối chiếu đáp án</h2>
          <label class="review-filter">
            Hiển thị
            <select id="review-filter">
              <option value="all">Tất cả câu</option>
              <option value="wrong">Câu sai</option>
              <option value="blank">Câu bỏ trống</option>
              ${retry ? '<option value="first">Chưa đúng lần đầu</option>' : ''}
            </select>
          </label>
        </div>
        <div class="review-list">
          ${reviewIds.length ? reviewIds.map(id => {
            const q = qMap.get(id);
            const a = s.answers[id];
            return `
              <article class="review-card">
                <div class="review-meta">
                  <span>Câu ${orderMap.get(id)} · Bài ${q.lesson} · Câu nguồn ${q.sourceNumber}</span>
                  <span class="pill ${!a ? 'muted' : a.correct ? 'positive' : 'negative'}">${!a ? 'Bỏ trống' : a.correct ? 'Đúng' : 'Sai'}</span>
                </div>
                <h3>${escape(q.text)}</h3>
                <div class="review-options">
                  ${q.options.map(o => `
                    <div class="${o.letter === q.answer ? 'right' : a?.selected === o.letter ? 'wrong' : ''}">
                      <strong>${escape(o.letter)}.</strong> ${escape(o.text)}
                      ${o.letter === q.answer ? '<b> — Đáp án đúng</b>' : ''}
                      ${a?.selected === o.letter ? '<span> (Bạn chọn)</span>' : ''}
                    </div>
                  `).join('')}
                </div>
                ${retry && a ? `<p class="field-hint">Lần đầu: ${escape(a.first)} · Số lần chọn: ${a.attempts.length}</p>` : ''}
              </article>
            `;
          }).join('') : '<div class="empty-state">Không có câu nào trong nhóm này.</div>'}
        </div>
      </section>
    `;
    $('#review-filter').value = reviewFilter;
  }

  function renderHistory() {
    main.innerHTML = `
      <section class="history-heading">
        <span class="eyebrow">NHÌN LẠI ĐỂ TIẾN XA</span>
        <h1>Lịch sử làm bài</h1>
        <p>Lưu tối đa 50 lượt gần nhất trên trình duyệt này.</p>
      </section>
      <div class="history-list">
        ${history.length ? history.map(s => {
          const c = sessionCourse(s);
          const stats = C.summarize(s, questionMaps.get(c.id));
          return `
            <button type="button" class="history-card" data-result="${escape(s.id)}">
              <span class="history-icon">${icon(s.config.type === 'exam' ? 'trophy' : 'book')}</span>
              <span>
                <strong>${escape(c.name)} · ${escape(scopeLabel(s))}</strong>
                <small>${escape(date(s.finishedAt))} · ${stats.total} câu · ${time(stats.elapsed)}</small>
              </span>
              <span class="history-score">
                ${s.config.mode === 'retry' ? `${stats.percent}%` : `${stats.score.toFixed(1)}/10`}
                <small>${s.config.mode === 'retry' ? 'Đúng lần đầu' : 'Điểm bài làm'}</small>
              </span>
              ${icon('arrow')}
            </button>
          `;
        }).join('') : `
          <div class="empty-state">
            ${icon('book')}
            <h2>Hành trình của bạn bắt đầu ở đây</h2>
            <p>Hoàn thành bài luyện tập đầu tiên để lưu kết quả.</p>
            <button type="button" class="button primary" data-action="home">Bắt đầu ôn tập ${icon('arrow')}</button>
          </div>
        `}
      </div>
    `;
  }

  document.addEventListener('click', event => {
    if (menuOpen && !event.target.closest('.site-header')) {
      setMenu(false);
    }
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.id === 'menu-toggle') {
      setMenu(!menuOpen);
      return;
    }
    if (menuOpen && primaryNav?.contains(button)) {
      setMenu(false);
    }
    if (view === 'quiz' && active && C.expired(active)) { submit(true); return; }
    if (button.dataset.nav) return setView(button.dataset.nav);

    if (button.dataset.scroll) {
      scrollToSection(button.dataset.scroll);
      return;
    }

    if (button.dataset.selectCourse) {
      const nextCourse = button.dataset.selectCourse;
      if (!courses.some(c => c.id === nextCourse)) return;
      courseId = nextCourse;
      settings.course = courseId;
      store.set('qp-settings-v1', settings);
      setView('home');
      requestAnimationFrame(() => scrollToSection('courses'));
      return;
    }

    if (button.dataset.course) {
      if (!courses.some(c => c.id === button.dataset.course)) return;
      courseId = button.dataset.course;
      settings.course = courseId;
      store.set('qp-settings-v1', settings);
      renderHome();
      main.querySelector(`[data-course="${CSS.escape(courseId)}"]`)?.focus({preventScroll: true});
      return;
    }

    if (button.dataset.lesson) return configure('practice', +button.dataset.lesson);
    if (button.dataset.quickLesson) return configure('practice', +button.dataset.quickLesson);

    if (button.dataset.answer && active) {
      const q = questionById(sessionCourse(active), active.questionIds[active.current]);
      if (C.answer(active, q, button.dataset.answer)) {
        persist();
        renderQuiz();
        if (active.config.mode === 'end') {
          announce(`Đã chọn đáp án ${button.dataset.answer}.`);
        } else {
          announce(
            active.answers[q.id].correct
              ? 'Chính xác.'
              : active.config.mode === 'retry'
                ? 'Chưa đúng, hãy thử lại.'
                : `Chưa đúng. Đáp án đúng là ${q.answer}.`
          );
        }
        const next = main.querySelector(`.answer-option[data-answer="${CSS.escape(button.dataset.answer)}"]`);
        if (next && !next.disabled) next.focus({preventScroll: true});
        else $('.question-text')?.focus({preventScroll: true});
      }
      return;
    }

    if (button.dataset.index !== undefined && active) return navigate(+button.dataset.index);

    if (button.dataset.result) {
      currentResult = history.find(s => s.id === button.dataset.result);
      reviewFilter = 'all';
      return setView('result');
    }

    switch (button.dataset.action) {
      case 'home': return setView('home');
      case 'go-history': return setView('history');
      case 'close-dialog': return dialog.close();
      case 'exam':
      case 'open-exam':
        return configure('exam');
      case 'start-learning':
        if (active) return setView('quiz');
        scrollToSection('courses');
        return;
      case 'resume':
      case 'resume-session':
        return setView('quiz');
      case 'next': return navigate(active.current + 1);
      case 'previous': return navigate(active.current - 1);
      case 'flag': {
        const id = active.questionIds[active.current];
        active.flagged = active.flagged.includes(id)
          ? active.flagged.filter(x => x !== id)
          : [...active.flagged, id];
        persist();
        renderQuiz();
        $('[data-action="flag"]')?.focus({preventScroll: true});
        return;
      }
      case 'toggle-grid':
        gridOpen = !gridOpen;
        renderQuiz();
        $('[data-action="toggle-grid"]')?.focus({preventScroll: true});
        return;
      case 'finish': return confirmSubmit();
      case 'submit': return submit();
      case 'again':
        return begin(
          {...currentResult.config},
          currentResult.config.type === 'review' ? currentResult.questionIds : undefined
        );
      case 'retry-first':
      case 'retry-wrong': {
        const s = currentResult;
        const c = sessionCourse(s);
        const qMap = questionMaps.get(c.id);
        const first = button.dataset.action === 'retry-first';
        const ids = s.questionIds.filter(id => (
          first ? s.answers[id]?.first !== qMap.get(id).answer : !s.answers[id]?.correct
        ));
        const lessons = [...new Set(ids.map(id => qMap.get(id).lesson))];
        const config = {
          ...s.config,
          type: 'review',
          mode: 'retry',
          lessons,
          count: ids.length,
          minutes: 0,
          shuffle: false
        };
        return begin(config, ids);
      }
    }
  });

  function syncSetupForm(event) {
    if (event.target.id === 'review-filter') {
      reviewFilter = event.target.value;
      renderResult();
      $('#review-filter')?.focus({preventScroll: true});
      return;
    }
    const form = $('#setup-form');
    if (!form) return;
    const err = $('#setup-error');
    if (err) err.textContent = '';

    if (event.target.id === 'time-limit') {
      const timed = event.target.value === 'yes';
      $('#minutes-field').hidden = !timed;
      $('#minutes').disabled = !timed;
      $('#minutes').required = timed;
    }
    if (event.target.id === 'all-lessons') {
      form.querySelectorAll('[name="lessons"]').forEach(input => {
        input.checked = event.target.checked;
      });
    }
    if (event.target.name === 'lessons' || event.target.id === 'all-lessons') {
      const selected = [...form.querySelectorAll('[name="lessons"]:checked')].map(e => +e.value);
      const available = course().questions.filter(q => selected.includes(q.lesson)).length;
      const all = $('#all-lessons');
      all.checked = selected.length === course().lessons.filter(l => l.count).length;
      all.indeterminate = selected.length > 0 && !all.checked;
      $('#question-count').max = available;
      if (!available) {
        $('#question-count').value = '';
      } else if (!$('#question-count').value || +$('#question-count').value > available) {
        $('#question-count').value = Math.min(+$('#question-count').value || 50, available);
      }
      $('#pool-hint').textContent = `Ngân hàng đã chọn: ${available} câu. Câu hỏi được chia đều giữa các bài.`;
    }
  }

  document.addEventListener('change', syncSetupForm);
  document.addEventListener('input', event => {
    const form = $('#setup-form');
    if (form && form.contains(event.target)) {
      const err = $('#setup-error');
      if (err) err.textContent = '';
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'goal-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      const rawName = String(data.get('name') ?? '').trim().slice(0, 40);
      const rawTarget = Number(data.get('dailyTarget'));
      profile = {
        name: rawName,
        dailyTarget: [10, 20, 40, 60].includes(rawTarget) ? rawTarget : 20
      };
      store.set('qp-profile-v1', profile);
      profileSavedNotice = profile.name
        ? `Đã lưu mục tiêu cho ${profile.name}: ${profile.dailyTarget} câu/ngày.`
        : `Đã lưu mục tiêu ôn tập: ${profile.dailyTarget} câu/ngày.`;
      renderHome();
      $('#goal-save-btn')?.focus({preventScroll: true});
      return;
    }
    if (event.target.id !== 'setup-form') return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const type = form.dataset.type;
    const c = course();
    const lessonNum = +form.dataset.lesson;
    const lessonCount = c.lessons.find(l => l.number === lessonNum)?.count || 0;
    const rawCount = String(data.get('count') ?? '').trim();
    const rawMinutes = String(data.get('minutes') ?? '').trim();

    const config = {
      course: courseId,
      type,
      lessons: type === 'practice' ? [lessonNum] : data.getAll('lessons').map(Number),
      mode: type === 'exam' ? 'end' : data.get('mode'),
      count: type === 'exam' ? (rawCount === '' ? NaN : Number(rawCount)) : lessonCount,
      minutes: data.get('timed') === 'yes' ? (rawMinutes === '' ? NaN : Number(rawMinutes)) : 0,
      shuffle: data.has('shuffle')
    };

    try {
      C.validate(config, c);
      begin(config, undefined, () => {
        settings[type] = config;
        store.set('qp-settings-v1', settings);
      });
    } catch (error) {
      const err = $('#setup-error');
      if (err) err.textContent = error.message;
    }
  });

  $('.brand').addEventListener('click', event => {
    event.preventDefault();
    setView('home');
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuOpen && !dialog.open) {
      event.preventDefault();
      setMenu(false, true);
    }
  });

  function tick() {
    if (!active) return;
    if (C.expired(active)) return submit(true);
    const timer = $('#timer-value');
    if (timer) {
      timer.textContent = active.deadline
        ? time(Math.ceil((active.deadline - Date.now()) / 1000))
        : time(Math.floor((Date.now() - active.startedAt) / 1000));
      timer.parentElement.classList.toggle('urgent', !!active.deadline && active.deadline - Date.now() <= 60000);
    }
  }

  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  setInterval(tick, 1000);

  if (active && C.expired(active)) submit(true);
  else render();
})();
