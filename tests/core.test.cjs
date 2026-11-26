const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../core.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/questions.js'),'utf8'),context);
const [qp1,qp2] = JSON.parse(JSON.stringify(context.window.QP_DATA.courses));
const config = extra => ({course:'qp1',type:'practice',lessons:[2],count:20,mode:'retry',minutes:0,shuffle:false,...extra});
const question = qp1.questions[0];
const wrong = question.options.find(o=>o.letter!==question.answer).letter;

test('340 source questions have unique stable ids, four options and an answer',()=>{
  assert.equal(qp1.questions.length,200);assert.equal(qp2.questions.length,140);
  assert.equal(new Set([...qp1.questions,...qp2.questions].map(q=>q.id)).size,340);
  for(const c of [qp1,qp2])for(const l of c.lessons){assert.equal(c.questions.filter(q=>q.lesson===l.number).length,l.count);}
  for(const q of [...qp1.questions,...qp2.questions]){assert.deepEqual(q.options.map(o=>o.letter),['A','B','C','D']);assert.match(q.answer,/^[ABCD]$/);}
});
test('retry records first choice, rejects repeated wrong choices, locks when correct',()=>{
  const s=C.createSession(config(),qp1,1000);
  assert.equal(C.answer(s,question,wrong,2000),true);
  assert.equal(C.answer(s,question,wrong,2001),false);
  assert.equal(C.answer(s,question,question.answer,2002),true);
  assert.equal(C.answer(s,question,wrong,2003),false);
  C.finish(s,3000);
  const summary=C.summarize(s,qp1.questions);
  assert.equal(summary.firstCorrect,0);assert.equal(summary.correct,1);assert.equal(summary.blank,19);assert.equal(summary.score,0);
});
test('instant locks first answer; end mode permits changing without altering first choice',()=>{
  for(const mode of ['instant','end']){
    const s=C.createSession(config({mode}),qp1,1000);
    C.answer(s,question,wrong,2000);
    assert.equal(C.answer(s,question,question.answer,3000),mode==='end');
    assert.equal(s.answers[question.id].first,wrong);
    assert.equal(C.summarize(s,qp1.questions,4000).correct,mode==='end'?1:0);
  }
});
test('exam balances chosen lessons without duplicate questions at all boundaries',()=>{
  const lessons=qp1.lessons.filter(l=>l.count).map(l=>l.number);
  for(let repeat=0;repeat<15;repeat++)for(const count of [1,3,10,19,50,199,200]){
    const selected=C.sample(qp1,lessons,count);
    assert.equal(selected.length,count);assert.equal(new Set(selected.map(q=>q.id)).size,count);
    const sizes=lessons.map(n=>selected.filter(q=>q.lesson===n).length);
    assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
  }
});
test('invalid scope, modes, counts and times are rejected',()=>{
  for(const extra of [{lessons:[]},{lessons:[1]},{lessons:[2,2]},{count:21},{count:1.5},{minutes:-1},{minutes:301},{minutes:1.5},{mode:'invalid'},{type:'exam',mode:'instant'}])assert.throws(()=>C.validate(config(extra),qp1));
  assert.throws(()=>C.sample(qp1,[2],21));
});
test('deadline survives reload, blocks late answers and finishes exactly once',()=>{
  const s=C.createSession(config({minutes:1}),qp1,1000);
  const restored=JSON.parse(JSON.stringify(s));
  assert.equal(restored.deadline,61000);assert.equal(C.expired(restored,60999),false);assert.equal(C.expired(restored,61000),true);
  assert.equal(C.answer(restored,question,question.answer,61000),false);
  assert.equal(C.finish(restored,90000),true);assert.equal(C.finish(restored,91000),false);
  assert.equal(C.summarize(restored,qp1.questions).elapsed,60);
  assert.equal(C.summarize(restored,qp1.questions).blank,20);
});
test('exam scoring, per-lesson totals and review sessions',()=>{
  const s=C.createSession(config({type:'exam',lessons:[2,3],mode:'end',count:7}),qp1,1000);
  for(const id of s.questionIds.slice(0,3)){const q=qp1.questions.find(q=>q.id===id);C.answer(s,q,q.answer,2000);}
  C.finish(s,3000);const result=C.summarize(s,qp1.questions);assert.equal(result.score,4.3);assert.equal(result.blank,4);
  assert.equal(Object.values(result.lessons).reduce((n,l)=>n+l.total,0),7);
  const ids=s.questionIds.slice(3);
  const review=C.createSession(config({type:'review',lessons:[2,3],count:4}),qp1,5000,ids);
  assert.deepEqual(review.questionIds,ids);assert.equal(review.config.mode,'retry');
});
test('blocked storage works in memory and corrupt JSON falls back',()=>{
  let warnings=0;const store=C.storage({getItem(){throw Error();},setItem(){throw Error();}},()=>warnings++);
  store.set('key',{value:2});assert.deepEqual(store.get('key',null),{value:2});assert.ok(warnings>=2);
  assert.equal(C.storage({getItem(){return '{broken';}},()=>{}).get('x',7),7);
});
