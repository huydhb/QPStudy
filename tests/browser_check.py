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


def start_practice(page, mode='retry'):
    page.locator('[data-lesson="2"]').click()
    page.locator(f'input[name="mode"][value="{mode}"]').check()
    page.locator('#setup-form button[type="submit"]').click()


def source(page):
    return page.evaluate("() => { const s=JSON.parse(localStorage.getItem('qp-active-v1')); return window.QP_DATA.courses.find(c=>c.id===s.config.course).questions.find(q=>q.id===s.questionIds[s.current]); }")


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
    page.set_viewport_size({'width':375,'height':900})
    page.screenshot(path=str(ARTIFACTS/'home-mobile.png'), full_page=True)
    page.set_viewport_size({'width':1440,'height':1000})

    start_practice(page)
    q = source(page)
    wrong = next(o['letter'] for o in q['options'] if o['letter'] != q['answer'])
    page.locator(f'[data-answer="{wrong}"]').click()
    assert page.locator(f'[data-answer="{wrong}"]').is_disabled()
    assert page.locator('.answer-option.right').count() == 0
    page.locator(f'[data-answer="{q["answer"]}"]').click()
    assert page.locator('.answer-option.right').count() == 1
    assert page.locator('.answer-option:enabled').count() == 0
    page.locator('[data-action="flag"]').click()
    page.locator('[data-action="next"]').click()
    saved = page.evaluate("localStorage.getItem('qp-active-v1')")
    page.reload()
    page.locator('[data-action="resume"]').click()
    assert page.evaluate("localStorage.getItem('qp-active-v1')") == saved
    assert page.locator('.question-meta .eyebrow').inner_text().startswith('CÂU 2')
    for width in [375,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':950})
        check(page,'document.documentElement.scrollWidth <= innerWidth',f'Quiz overflow {width}')
    page.screenshot(path=str(ARTIFACTS/'quiz-desktop.png'),full_page=True)
    page.set_viewport_size({'width':375,'height':900})
    page.locator('[data-action="toggle-grid"]').click()
    assert page.locator('#question-map').is_visible()
    page.screenshot(path=str(ARTIFACTS/'quiz-mobile.png'),full_page=True)
    page.locator('[data-action="toggle-grid"]').click()
    page.set_viewport_size({'width':1440,'height':1000})
    page.locator('[data-action="finish"]').first.click()
    assert '19 câu chưa trả lời' in page.locator('#dialog').inner_text()
    page.locator('[data-action="submit"]').click()
    assert '0%' in page.locator('.score-display').inner_text()
    page.locator('[data-action="retry-first"]').click()
    assert len(json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['questionIds']) == 20

    # Independent fresh sessions exercise other answer policies.
    for mode in ['instant','end']:
        page.evaluate('localStorage.clear()')
        page.reload()
        start_practice(page,mode)
        q = source(page)
        wrong = next(o['letter'] for o in q['options'] if o['letter']!=q['answer'])
        page.locator(f'[data-answer="{wrong}"]').click()
        if mode=='instant':
            assert page.locator('.answer-option:enabled').count()==0
            assert page.locator('.answer-option.right').count()==1
        else:
            assert page.locator('.answer-option.right,.answer-option.wrong').count()==0
            assert page.locator('.grid-cell.correct,.grid-cell.incorrect').count()==0
            page.locator(f'[data-answer="{q["answer"]}"]').click()
            assert json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['answers'][q['id']]['selected']==q['answer']
        page.locator('[data-action="finish"]').first.click()
        page.locator('[data-action="submit"]').click()
        page.locator('[data-action="retry-wrong"]').click()
        s=json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))
        assert len(s['questionIds'])==(20 if mode=='instant' else 19)
        assert s['config']['type']=='review'

    page.evaluate('localStorage.clear()');page.reload()
    page.locator('[data-action="exam"]').click()
    assert page.locator('#question-count').input_value()=='50'
    page.locator('#all-lessons').uncheck()
    page.locator('[name="lessons"][value="2"]').check()
    assert page.locator('#question-count').get_attribute('max')=='20'
    page.locator('[name="lessons"][value="3"]').check()
    page.locator('#question-count').fill('7')
    page.locator('#minutes').fill('1')
    page.locator('#setup-form button[type="submit"]').click()
    s=json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))
    assert len(s['questionIds'])==7 and s['config']['mode']=='end'
    page.evaluate("() => {const s=JSON.parse(localStorage.getItem('qp-active-v1'));s.startedAt=Date.now()-61000;s.deadline=Date.now()-1000;localStorage.setItem('qp-active-v1',JSON.stringify(s));}")
    page.reload()
    assert page.locator('.timeout-note').is_visible()
    assert len(json.loads(page.evaluate("localStorage.getItem('qp-history-v1')")))==1
    assert page.evaluate("JSON.parse(localStorage.getItem('qp-active-v1'))") is None
    for width in [375,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':950})
        check(page,'document.documentElement.scrollWidth <= innerWidth',f'Result overflow {width}')
    page.screenshot(path=str(ARTIFACTS/'result-desktop.png'),full_page=True)
    page.locator('[data-nav="history"]').click()
    assert page.locator('.history-card').count()==1
    page.reload()
    assert len(json.loads(page.evaluate("localStorage.getItem('qp-history-v1')")))==1
    page.locator('[data-action="exam"]').click()
    assert page.locator('[name="lessons"]:checked').count()==2
    assert page.locator('#question-count').input_value()=='7'
    assert page.locator('#minutes').input_value()=='1'
    page.keyboard.press('Escape')
    # QP2 selectable and practice contains exactly 20 source questions.
    page.locator('[data-course="qp2"]').click()
    assert page.locator('button[data-lesson]').count()==7
    start_practice(page,'end')
    assert json.loads(page.evaluate("localStorage.getItem('qp-active-v1')"))['config']['course']=='qp2'
    # Modal keyboard focus remains in the dialog.
    page.locator('[data-action="finish"]').first.click()
    for _ in range(12):
        page.keyboard.press('Tab')
        check(page,"document.querySelector('dialog').contains(document.activeElement)",'Focus escaped dialog')
    page.keyboard.press('Escape')
    assert not page.locator('#dialog').is_visible()
    assert errors == [], errors

    blocked = browser.new_context()
    blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
    bpage=blocked.new_page();bpage.goto(url)
    assert bpage.locator('#storage-warning').is_visible()
    start_practice(bpage)
    assert bpage.locator('.question-panel').is_visible()
    blocked.close()

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(WEB)))
    Thread(target=server.serve_forever,daemon=True).start()
    http_page=context.new_page()
    responses=[]
    http_page.on('response',lambda response: responses.append(response.status))
    http_page.goto(f'http://127.0.0.1:{server.server_port}/')
    http_page.locator('[data-action="exam"]').wait_for()
    assert all(status==200 for status in responses),responses
    server.shutdown();server.server_close()
    browser.close()
    print('PASS: file + HTTP, 3 modes, reload, deadline, result, review, QP2, storage blocked, focus, 4 viewports; no browser errors.')
