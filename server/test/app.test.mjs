import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.mjs';
import { lessons, gradeAnswers } from '../src/content.mjs';

async function fixture(t,{filename=':memory:',clock={time:1800000000000}}={}) {
  const service=createApp({databasePath:filename,adminPassword:'test-password-2026',now:()=>clock.time});
  const server=service.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  async function request(route,{token,cookie,body,method,headers={}}={}) {
    const response=await fetch(base+route,{method:method||(body!==undefined?'POST':'GET'),headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  let closed=false;
  async function close(){if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));service.store.close();}
  t.after(close);
  async function join(name='Minh Thắng'){const value=await request('/join',{body:{name}});assert.equal(value.status,201);return value.body;}
  async function finish(token,lesson,{wrong=false}={}){
    assert.equal((await request(`/lessons/${lesson.id}/start`,{token,body:{}})).status,200);
    clock.time+=lesson.durationMs+1;
    const answers=Object.fromEntries(lesson.questions.map(q=>[q.id,wrong?q.choices.find(c=>c.id!==q.correct).id:q.correct]));
    const result=await request(`/lessons/${lesson.id}/submit`,{token,body:{answers}});
    assert.equal(result.status,200);return result;
  }
  return {...service,request,join,finish,clock,close};
}

test('content: four evidence-backed lessons, 16 questions and original thresholds',()=>{
  assert.equal(lessons.length,4);
  for(const lesson of lessons){assert.equal(lesson.questions.length,4);assert.equal(lesson.source.sha256.length,64);assert.deepEqual(lesson.questions.map(q=>q.category),['theory','theory','data','data']);assert.equal(lesson.questions[0].prompt,`${lesson.title} là gì?`);for(const q of lesson.questions){assert.deepEqual(q.choices.map(c=>c.id),['A','B','C','D']);assert.equal(q.choices.filter(c=>c.id===q.correct).length,1);assert.equal(new Set(q.choices.map(c=>c.text)).size,4);}}
  assert.equal(lessons[0].overall.requests,5);assert.equal(lessons[0].overall.checksPassed,10);
  assert.equal(lessons[1].phases[0].metrics.requests,7141);
  assert.ok(Math.abs(lessons[1].phases[0].metrics.rps-(7141/300))<.00001);
  assert.deepEqual(lessons.map(l=>[l.thresholdsPassed,l.thresholds.length]),[[2,2],[25,25],[199,275],[75,75]]);
  assert.equal(lessons[2].phases.find(p=>p.learningStatus==='fail').vus,600);
  assert.ok(Math.abs(lessons[3].phases[1].metrics.p95-10.475897)<.001);
});

test('single-answer grading rejects missing, invalid, extra or multiple selections',()=>{
  const lesson=lessons[0],answers=Object.fromEntries(lesson.questions.map(q=>[q.id,q.correct]));
  assert.equal(gradeAnswers(lesson,answers).score,4);
  assert.equal(gradeAnswers(lesson,{}),null);
  const partial={...answers};delete partial[lesson.questions[3].id];assert.equal(gradeAnswers(lesson,partial),null);
  const oneWrong={...answers,[lesson.questions[3].id]:lesson.questions[3].choices.find(c=>c.id!==lesson.questions[3].correct).id};
  const graded=gradeAnswers(lesson,oneWrong);assert.equal(graded.score,3);assert.equal(graded.total,4);assert.equal(graded.items[3].isCorrect,false);assert.ok(graded.items[3].explanation);
  assert.equal(gradeAnswers(lesson,{...answers,extra:'A'}),null);
  assert.equal(gradeAnswers(lesson,{...answers,[lesson.questions[0].id]:['A','B']}),null);
  assert.equal(gradeAnswers(lesson,{...answers,[lesson.questions[0].id]:'E'}),null);
});

test('join normalizes names, permits duplicates and requires private tokens',async t=>{
  const f=await fixture(t);const a=await f.join('  Minh   Thắng  '),b=await f.join('Minh Thắng');
  assert.equal(a.participant.name,'Minh Thắng');assert.notEqual(a.participant.id,b.participant.id);assert.notEqual(a.token,b.token);
  assert.equal((await f.request('/me')).status,401);assert.equal((await f.request('/admin/results',{token:a.token})).status,401);
  const me=await f.request('/me',{token:a.token});assert.equal(me.body.participant.id,a.participant.id);assert.equal(me.body.participant.token_hash,undefined);
  assert.equal((await f.request('/join',{body:{name:'A'}})).status,400);
});

test('server gates quiz by clock, locks later lessons and does not leak answer keys',async t=>{
  const f=await fixture(t),a=await f.join();
  const catalog=await f.request('/lessons');assert.equal(JSON.stringify(catalog.body).includes('"correct"'),false);
  assert.equal((await f.request('/lessons/stress/start',{token:a.token,body:{}})).status,403);
  const started=await f.request('/lessons/smoke/start',{token:a.token,body:{}});
  assert.equal(started.body.status,'running');assert.equal(started.body.questions.length,0);assert.equal(started.body.phases.length,0);
  assert.equal((await f.request('/lessons/smoke/submit',{token:a.token,body:{answers:{}}})).status,409);
  f.clock.time+=lessons[0].durationMs+1;
  const state=await f.request('/lessons/smoke/state',{token:a.token});assert.equal(state.body.status,'quiz');assert.equal(state.body.questions.length,4);
  assert.equal(JSON.stringify(state.body.questions).includes('"correct"'),false);
  assert.equal((await f.request('/lessons/smoke/submit',{token:a.token,body:{answers:{}}})).status,400);
});

test('completed measurement windows are revealed without inventing ramp metrics',async t=>{
  const f=await fixture(t),a=await f.join();await f.finish(a.token,lessons[0]);
  await f.request('/lessons/baseline/start',{token:a.token,body:{}});
  f.clock.time+=lessons[1].durationMs*.1;
  const ramp=await f.request('/lessons/baseline/state',{token:a.token});assert.equal(ramp.body.phases.length,0);
  f.clock.time+=lessons[1].durationMs*.77;
  const steady=await f.request('/lessons/baseline/state',{token:a.token});assert.equal(steady.body.phases.length,1);assert.equal(steady.body.phases[0].metrics.requests,7141);assert.equal(steady.body.result,null);
});

test('submissions are idempotent, wrong answers complete a lesson, ranking uses score then completion time',async t=>{
  const f=await fixture(t),a=await f.join('Người A'),b=await f.join('Người B');
  for(const lesson of lessons.slice(0,3)){await f.finish(a.token,lesson);await f.finish(b.token,lesson);}
  const result=await f.finish(b.token,lessons[3],{wrong:true});assert.equal(result.body.participant.rank,1);assert.equal(result.body.grading.score,0);
  const other=await f.finish(a.token,lessons[3]);assert.equal(other.body.participant.rank,1);assert.equal(other.body.participant.score,16);assert.equal(other.body.participant.maxScore,16);assert.ok(other.body.participant.progress.every(p=>p.total===4));
  const repeat=await f.request('/lessons/spike/submit',{token:b.token,body:{answers:{}}});assert.equal(repeat.status,200);assert.equal(repeat.body.participant.rank,2);assert.equal(repeat.body.submittedAt,result.body.submittedAt);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM quiz_submissions').get().n,8);
});

test('near-simultaneous final submissions receive distinct stable ranks',async t=>{
  const f=await fixture(t),a=await f.join('Người A'),b=await f.join('Người B');
  for(const lesson of lessons.slice(0,3)){await f.finish(a.token,lesson);await f.finish(b.token,lesson);}
  for(const who of [a,b])await f.request('/lessons/spike/start',{token:who.token,body:{}});
  f.clock.time+=lessons[3].durationMs+1;
  const answers=Object.fromEntries(lessons[3].questions.map(q=>[q.id,q.correct]));
  const results=await Promise.all([a,b].map(who=>f.request('/lessons/spike/submit',{token:who.token,body:{answers}})));
  assert.deepEqual(results.map(x=>x.body.participant.rank).sort(),[1,2]);
});

test('admin reset cascades data, invalidates old clients, keeps login and restarts ranking',async t=>{
  const f=await fixture(t),a=await f.join();await f.finish(a.token,lessons[0]);
  const login=await f.request('/admin/login',{body:{password:'test-password-2026'}});assert.equal(login.status,200);
  const cookie=login.cookie;
  const data=await f.request('/admin/results',{cookie});assert.equal(data.body.total,1);
  assert.equal((await f.request('/admin/reset',{cookie,body:{generation:99,confirmation:'RESET'}})).status,409);
  assert.equal((await f.request('/admin/reset',{cookie,body:{generation:1,confirmation:'RESET'}})).status,200);
  assert.equal((await f.request('/me',{token:a.token})).status,401);
  assert.equal((await f.request('/lessons/smoke/submit',{token:a.token,body:{answers:{}}})).status,401);
  assert.equal((await f.request('/admin/results',{cookie})).body.total,0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM lesson_attempts').get().n,0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM quiz_submissions').get().n,0);
  const b=await f.join('Sau reset');let last;for(const l of lessons)last=await f.finish(b.token,l);assert.equal(last.body.participant.rank,1);
});

test('database restart preserves participant token, attempts and completion order',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'performance-classroom-'));
  const filename=path.join(directory,'test.sqlite');
  const f=await fixture(t,{filename});const a=await f.join();for(const lesson of lessons)await f.finish(a.token,lesson);await f.close();
  const g=await fixture(t,{filename});
  const me=await g.request('/me',{token:a.token});assert.equal(me.body.participant.rank,1);assert.equal(me.body.participant.completed,4);
  const snapshot=await g.request('/lessons/spike/state',{token:a.token});assert.equal(snapshot.body.grading.score,4);
  await g.close();
  assert.equal(path.dirname(fs.realpathSync(directory)).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());
  assert.ok(path.basename(directory).startsWith('performance-classroom-'));
  fs.rmSync(directory,{recursive:true});
});

test('admin login, mutation origin and password limits are enforced',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/admin/login',{body:{password:'wrong'}})).status,401);
  assert.equal((await f.request('/join',{body:{name:'Người A'},headers:{Origin:'https://unrelated.example'}})).status,403);
  for(let i=0;i<7;i++)await f.request('/admin/login',{body:{password:'wrong'}});
  assert.equal((await f.request('/admin/login',{body:{password:'test-password-2026'}})).status,429);
});
