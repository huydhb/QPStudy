"""Browser acceptance checks. Requires Python playwright + installed Chromium."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json
from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parents[1]
ARTIFACTS = WEB / 'tests' / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)


def check(page, condition, message):
    assert page.evaluate(condition), message


def start_practice(page, mode='retry', lesson=2):
    page.locator(f'[data-lesson="{lesson}"]').click()
    page.locator(f'input[name="mode"][value="{mode}"]').check()
    page.locator('#setup-form button[type="submit"]').click()


def source(page):
    return page.evaluate(
        "() => { const s=JSON.parse(localStorage.getItem('qp-active-v1')); "
        "return window.QP_DATA.courses.find(c=>c.id===s.config.course).questions.find(q=>q.id===s.questionIds[s.current]); }"
    )


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--disable-gpu'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    url = (WEB / 'index.html').as_uri()
    page.goto(url)
    page.locator('h1').wait_for()
    assert page.locator('[data-lesson="1"]').is_disabled()
    page.screenshot(path=str(ARTIFACTS / 'home-desktop.png'), full_page=True)
    for width in [375, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 950})
        check(page, 'document.documentElement.scrollWidth <= innerWidth', f'Home overflow at {width}')
    page.set_viewport_size({'width': 375, 'height': 900})
    assert page.locator('.exam-panel h3').inner_text() == 'Kiểm tra kiến thức của bạn'
    page.screenshot(path=str(ARTIFACTS / 'home-mobile.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})

    # Practice retry mode + reload + replace confirmation
    start_practice(page)
    q = source(page)
    wrong = next(o['letter'] for o in q['options'] if o['letter'] != q['answer'])
    page.locator(f'[data-answer="{wrong}"]').click()
    assert page.locator(f'[data-answer="{wrong}"]').is_disabled()
    assert page.locator('.answer-option.right').count() == 0
    assert 'Đúng' in page.locator('.grid-legend').inner_text()
    page.locator(f'[data-answer="{q["answer"]}"]').click()
    assert page.locator('.answer-option.right').count() == 1
    assert page.locator('.answer-option:enabled').count() == 0
    page.locator('[data-action="flag"]').click()
    page.locator('[data-action="next"]').click()

    # Going home keeps active session; opening another lesson and cancelling preserves session & settings
    page.locator('[data-action="home"]').click()
    saved = page.evaluate("localStorage.getItem('qp-active-v1')")
    saved_settings = page.evaluate("localStorage.getItem('qp-settings-v1')")
    page.locator('[data-lesson="3"]').click()
    page.locator('input[name="mode"][value="instant"]').check()
    page.locator('#setup-form button[type="submit"]').click()
    assert page.locator('#replace-session').is_visible()
    check(page, "document.querySelector('#dialog').contains(document.activeElement)", 'Focus escaped confirm dialog')
    page.locator('.dialog-actions [data-action="close-dialog"]').click()
    assert page.evaluate("localStorage.getItem('qp-active-v1')") == saved
    assert page.evaluate("localStorage.getItem('qp-settings-v1')") == saved_settings

    # Confirming replace-session replaces active session cleanly
    page.locator('[data-lesson="3"]').click()
    page.locator('input[name="mode"][value="instant"]').check()
    page.locator('#setup-form button[type="submit"]').click()
    page.locator('#replace-session').click()
    replaced = json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))
    assert replaced['config']['lessons'] == [3] and replaced['config']['mode'] == 'instant'

    # Restore first active session snapshot to continue verifying resume + review flow
    page.evaluate("(s) => localStorage.setItem('qp-active-v1', s)", saved)
    page.reload()
    page.locator('[data-action="resume"]').click()
    assert page.evaluate("localStorage.getItem('qp-active-v1')") == saved
    assert page.locator('.question-meta .eyebrow').inner_text().startswith('CÂU 2')
    for width in [375, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 950})
        check(page, 'document.documentElement.scrollWidth <= innerWidth', f'Quiz overflow {width}')
    page.screenshot(path=str(ARTIFACTS / 'quiz-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 375, 'height': 900})
    page.locator('[data-action="toggle-grid"]').click()
    assert page.locator('#question-map').is_visible()
    page.screenshot(path=str(ARTIFACTS / 'quiz-mobile.png'), full_page=True)
    page.locator('[data-action="toggle-grid"]').click()
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.locator('[data-action="finish"]').first.click()
    assert '19 câu chưa trả lời' in page.locator('#dialog').inner_text()
    page.locator('[data-action="submit"]').click()
    assert '0%' in page.locator('.score-display').inner_text()

    # Check result filters
    page.locator('#review-filter').select_option('blank')
    assert page.locator('.review-card').count() == 19
    page.locator('#review-filter').select_option('wrong')
    assert page.locator('.review-card').count() == 0
    page.locator('#review-filter').select_option('first')
    assert page.locator('.review-card').count() == 20
    page.locator('#review-filter').select_option('all')
    assert page.locator('.review-card').count() == 20

    page.locator('[data-action="retry-first"]').click()
    assert len(json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['questionIds']) == 20

    # Independent fresh sessions exercise other answer policies
    for mode in ['instant', 'end']:
        page.evaluate('localStorage.clear()')
        page.reload()
        start_practice(page, mode)
        q = source(page)
        wrong = next(o['letter'] for o in q['options'] if o['letter'] != q['answer'])
        page.locator(f'[data-answer="{wrong}"]').click()
        if mode == 'instant':
            assert page.locator('.answer-option:enabled').count() == 0
            assert page.locator('.answer-option.right').count() == 1
        else:
            assert 'Đã chọn' in page.locator('.grid-legend').inner_text()
            assert page.locator('.answer-option.right,.answer-option.wrong').count() == 0
            assert page.locator('.grid-cell.correct,.grid-cell.incorrect').count() == 0
            # Clicking the same option again in end mode must not append duplicate attempts
            page.locator(f'[data-answer="{wrong}"]').click()
            assert json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['answers'][q['id']]['attempts'] == [wrong]
            page.locator(f'[data-answer="{q["answer"]}"]').click()
            assert json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['answers'][q['id']]['selected'] == q['answer']
        page.locator('[data-action="finish"]').first.click()
        page.locator('[data-action="submit"]').click()
        page.locator('[data-action="retry-wrong"]').click()
        s = json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))
        assert len(s['questionIds']) == (20 if mode == 'instant' else 19)
        assert s['config']['type'] == 'review'

    # Exam validation (0 lessons & empty minutes), sidebar scroll preservation, deadline auto-submit
    page.evaluate('localStorage.clear()')
    page.reload()
    page.locator('[data-action="exam"]').click()
    assert page.locator('#question-count').input_value() == '50'
    page.locator('#all-lessons').uncheck()
    page.locator('#setup-form button[type="submit"]').click()
    assert 'Hãy chọn ít nhất một bài có dữ liệu.' in page.locator('#setup-error').inner_text()
    page.locator('[name="lessons"][value="2"]').check()
    assert page.locator('#question-count').get_attribute('max') == '20'
    page.locator('#minutes').fill('')
    page.locator('#setup-form button[type="submit"]').click()
    assert 'Thời gian phải từ 1 đến 300 phút.' in page.locator('#setup-error').inner_text()
    page.locator('#minutes').fill('1')
    assert page.locator('#setup-error').inner_text() == ''
    page.locator('#all-lessons').check()
    page.locator('#question-count').fill('50')
    page.locator('#setup-form button[type="submit"]').click()
    page.evaluate("() => { const g=document.querySelector('.question-grid'); g.scrollTop=g.scrollHeight; }")
    scroll_before = page.evaluate("document.querySelector('.question-grid').scrollTop")
    assert scroll_before > 0
    page.locator('[data-index="44"]').click()
    assert page.evaluate("document.querySelector('.question-grid').scrollTop") == scroll_before

    page.evaluate('localStorage.clear()')
    page.reload()
    page.locator('[data-action="exam"]').click()
    page.locator('#all-lessons').uncheck()
    page.locator('[name="lessons"][value="2"]').check()
    page.locator('[name="lessons"][value="3"]').check()
    page.locator('#question-count').fill('7')
    page.locator('#minutes').fill('1')
    page.locator('#setup-form button[type="submit"]').click()
    s = json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))
    assert len(s['questionIds']) == 7 and s['config']['mode'] == 'end'
    page.evaluate(
        "() => { const s=JSON.parse(localStorage.getItem('qp-active-v1')); "
        "s.startedAt=Date.now()-61000; s.deadline=Date.now()-1000; localStorage.setItem('qp-active-v1',JSON.stringify(s)); }"
    )
    page.reload()
    assert page.locator('.timeout-note').is_visible()
    assert len(json.loads(page.evaluate("localStorage.getItem('qp-history-v1')"))) == 1
    assert page.evaluate("JSON.parse(localStorage.getItem('qp-active-v1'))") is None
    for width in [375, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 950})
        check(page, 'document.documentElement.scrollWidth <= innerWidth', f'Result overflow {width}')
    page.screenshot(path=str(ARTIFACTS / 'result-desktop.png'), full_page=True)
    page.locator('[data-nav="history"]').click()
    assert page.locator('.history-card').count() == 1
    assert 'Kiểm tra (2 bài)' in page.locator('.history-card').inner_text()
    page.reload()
    assert len(json.loads(page.evaluate("localStorage.getItem('qp-history-v1')"))) == 1
    page.locator('[data-action="exam"]').click()
    assert page.locator('[name="lessons"]:checked').count() == 2
    assert page.locator('#question-count').input_value() == '7'
    assert page.locator('#minutes').input_value() == '1'
    page.keyboard.press('Escape')

    # QP2 selectable via keyboard Enter keeping focus on card; practice contains 20 source questions
    page.locator('[data-course="qp2"]').focus()
    page.keyboard.press('Enter')
    check(page, "document.activeElement?.dataset?.course === 'qp2'", 'Focus lost after switching course')
    assert page.locator('button[data-lesson]').count() == 7
    start_practice(page, 'end')
    assert json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['config']['course'] == 'qp2'

    # Modal keyboard focus remains in the dialog
    page.locator('[data-action="finish"]').first.click()
    for _ in range(12):
        page.keyboard.press('Tab')
        check(page, "document.querySelector('dialog').contains(document.activeElement)", 'Focus escaped dialog')
    page.keyboard.press('Escape')
    assert not page.locator('#dialog').is_visible()

    # Corrupt JSON in localStorage must NOT show blocked-storage warning
    page.evaluate("() => { localStorage.clear(); localStorage.setItem('qp-settings-v1', '{broken'); }")
    page.reload()
    assert not page.locator('#storage-warning').is_visible()
    assert errors == [], errors

    blocked = browser.new_context()
    blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
    bpage = blocked.new_page()
    berrors = []
    bpage.on('pageerror', lambda e: berrors.append(str(e)))
    bpage.goto(url)
    assert bpage.locator('#storage-warning').is_visible()
    bpage.locator('#goal-name').fill('Sinh viên')
    bpage.locator('#goal-save-btn').click()
    assert bpage.locator('#goal-status').is_visible()
    assert berrors == [], berrors
    start_practice(bpage)
    assert bpage.locator('.question-panel').is_visible()
    blocked.close()

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(WEB)))
    Thread(target=server.serve_forever, daemon=True).start()
    http_page = context.new_page()
    responses = []
    http_errors = []
    http_page.on('response', lambda response: responses.append(response.status))
    http_page.on('pageerror', lambda e: http_errors.append(str(e)))
    http_page.goto(f'http://127.0.0.1:{server.server_port}/')
    http_page.locator('[data-action="exam"]').wait_for()
    assert all(status == 200 for status in responses), responses

    # Verify offline Baloo 2 & Nunito fonts loaded cleanly
    loaded_fonts = http_page.evaluate(
        "async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family); }"
    )
    assert any('Baloo 2' in f for f in loaded_fonts), loaded_fonts
    assert any('Nunito' in f for f in loaded_fonts), loaded_fonts

    # Verify Claymorphism landing page sections
    assert http_page.locator('.progress-card').is_visible()
    assert http_page.locator('#courses .featured-course-card').count() == 4
    assert http_page.locator('#benefits .benefit-card').count() == 4
    assert http_page.locator('#testimonials .testimonial-card').count() == 3
    assert http_page.locator('#signup #goal-form').is_visible()
    assert http_page.locator('.site-footer-band').is_visible()

    # Verify mobile hamburger menu toggle & Escape focus return at 375px
    http_page.set_viewport_size({'width': 375, 'height': 844})
    http_page.locator('#menu-toggle').click()
    assert http_page.locator('#primary-nav.open').is_visible()
    check(http_page, 'document.documentElement.scrollWidth <= innerWidth', 'Mobile nav overflow at 375')
    http_page.keyboard.press('Escape')
    assert http_page.locator('#primary-nav.open').count() == 0
    check(http_page, "document.activeElement?.id === 'menu-toggle'", 'Focus did not return to menu toggle')

    # Verify local goal form persistence
    http_page.set_viewport_size({'width': 1440, 'height': 950})
    http_page.locator('#goal-name').fill('Bảo Huy')
    http_page.locator('#goal-target').select_option('40')
    http_page.locator('#goal-save-btn').click()
    assert http_page.locator('#goal-status').is_visible()
    assert 'Bảo Huy' in http_page.locator('#goal-status').inner_text()
    http_page.reload()
    assert http_page.locator('#goal-name').input_value() == 'Bảo Huy'
    assert http_page.locator('#goal-target').input_value() == '40'

    # Verify auto-advance UX (retry mode) and visibility-gated timer + time analytics
    http_page.evaluate('localStorage.clear()')
    http_page.reload()
    start_practice(http_page, 'retry')
    q1 = source(http_page)
    wrong1 = next(o['letter'] for o in q1['options'] if o['letter'] != q1['answer'])
    http_page.locator(f'[data-answer="{wrong1}"]').click()
    http_page.wait_for_timeout(1000)
    assert http_page.locator('.question-meta .eyebrow').inner_text().startswith('CÂU 1')

    http_page.locator(f'[data-answer="{q1["answer"]}"]').click()
    assert http_page.locator('[data-action="cancel-auto"]').is_visible()
    http_page.wait_for_function(
        "() => document.querySelector('.question-meta .eyebrow')?.innerText.startsWith('CÂU 2')",
        timeout=3000,
    )

    # Toggling auto-advance OFF keeps user on current question after correct answer
    http_page.locator('[data-action="toggle-auto-advance"]').click()
    assert http_page.locator('[data-action="toggle-auto-advance"]').get_attribute('aria-pressed') == 'false'
    q2 = source(http_page)
    http_page.locator(f'[data-answer="{q2["answer"]}"]').click()
    http_page.wait_for_timeout(1000)
    assert http_page.locator('.question-meta .eyebrow').inner_text().startswith('CÂU 2')

    # Clicking "Ở lại" cancels pending auto-advance cleanly
    http_page.locator('[data-action="toggle-auto-advance"]').click()
    http_page.locator('[data-action="next"]').click()
    q3 = source(http_page)
    http_page.locator(f'[data-answer="{q3["answer"]}"]').click()
    http_page.locator('[data-action="cancel-auto"]').click()
    http_page.wait_for_timeout(1000)
    assert http_page.locator('.question-meta .eyebrow').inner_text().startswith('CÂU 3')

    # Visibility-gated timer pauses immediately on leaving quiz or opening dialog
    http_page.locator('[data-action="next"]').click()
    http_page.wait_for_timeout(1200)
    http_page.locator('[data-action="home"]').click()
    paused_times = json.loads(http_page.evaluate("localStorage.getItem('qp-active-v1')"))['questionTimes']
    paused_total = sum(paused_times.values())
    assert paused_total >= 900, paused_times
    http_page.wait_for_timeout(1200)
    http_page.locator('[data-nav="history"]').click()
    http_page.wait_for_timeout(600)
    after_away_times = json.loads(http_page.evaluate("localStorage.getItem('qp-active-v1')"))['questionTimes']
    assert after_away_times == paused_times, (paused_times, after_away_times)

    http_page.locator('[data-nav="home"]').first.click()
    http_page.locator('[data-action="resume-session"]').click()
    http_page.locator('[data-action="finish"]').first.click()
    http_page.wait_for_timeout(1100)
    http_page.locator('[data-action="submit"]').click()
    last_result = json.loads(http_page.evaluate("localStorage.getItem('qp-history-v1')"))[0]
    submitted_total = sum(last_result.get('questionTimes', {}).values())
    assert submitted_total - paused_total < 900, (paused_total, submitted_total)

    assert http_page.locator('.time-analytics').is_visible()
    assert 'undefined' not in http_page.locator('.time-analytics').inner_text()
    assert http_page.locator('.analytics-kpi').count() == 4
    assert http_page.locator('.time-bar-row').count() == 20
    assert http_page.locator('.review-card .time-pill').count() == 20
    http_page.screenshot(path=str(ARTIFACTS / 'result-desktop.png'), full_page=True)
    http_page.locator('[data-jump-review="review-q-1"]').click()
    assert http_errors == [], http_errors

    server.shutdown()
    server.server_close()
    browser.close()
    print('PASS: file + HTTP, 3 modes, reload, replace-dialog, validation, scroll, focus, filter, QP2, storage, 4 viewports, fonts, landing sections, mobile nav, goal form, auto-advance, paused question timing; no browser errors.')
