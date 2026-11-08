import express from 'express';
import crypto from 'node:crypto';
import { lessons, lessonIds, lessonById, publicLesson, gradeAnswers, playback } from './content.mjs';
import { openStore } from './storage.mjs';
import { hashToken, randomToken, passwordVerifier } from './auth.mjs';

export function createApp({ databasePath, adminPassword, now = () => Date.now(), durationScale = 1, secureCookies = false }) {
  const store = openStore(databasePath), { db } = store;
  const verifyPassword = passwordVerifier(adminPassword);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req,res,next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    // Same-origin mutations, including Vite proxy; allow ordinary CLI/test clients with no Origin.
    const origin = req.get('origin');
    if (req.method !== 'GET' && origin) {
      try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Yêu cầu phải đến từ chính web này.' }); }
      catch { return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' }); }
    }
    next();
  });
  const buckets = new Map();
  function limit(key, max, windowMs) {
    const time = now();
    if (buckets.size > 1000) for (const [k,v] of buckets) if (time >= v.until) buckets.delete(k);
    let bucket = buckets.get(key);
    if (!bucket || time >= bucket.until) { bucket = { count: 0, until: time+windowMs }; buckets.set(key,bucket); }
    return ++bucket.count <= max;
  }
  function requireParticipant(req,res,next) {
    const token = req.get('authorization')?.match(/^Bearer ([\w-]{40,64})$/)?.[1];
    const participant = token && db.prepare('SELECT * FROM participants WHERE token_hash=?').get(hashToken(token));
    if (!participant || participant.generation !== store.generation()) return res.status(401).json({ code: 'SESSION_RESET', error: 'Phiên tham gia đã kết thúc hoặc được reset. Hãy nhập tên để bắt đầu lại.' });
    req.participant = participant; next();
  }
  function requireAdmin(req,res,next) {
    const token = req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('classroom_admin='))?.split('=')[1];
    if (!token || !/^[\w-]{40,64}$/.test(token) || !db.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token),now())) return res.status(401).json({ error: 'Vui lòng đăng nhập quản trị.' });
    req.adminToken = token; next();
  }
  function progressFor(p) {
    const rows = db.prepare(`SELECT a.*,q.score,q.submitted_at FROM lesson_attempts a LEFT JOIN quiz_submissions q ON q.attempt_id=a.id WHERE a.participant_id=?`).all(p.id);
    const progress = lessons.map(lesson => {
      const attempt = rows.find(a=>a.lesson_id===lesson.id);
      return { lessonId: lesson.id, status: attempt?.submitted_at != null ? 'completed' : attempt ? (now()-attempt.started_at >= attempt.duration_ms ? 'quiz' : 'running') : 'idle', score: attempt?.score ?? null, total: lesson.questions.length };
    });
    return { id:p.id, name:p.name, generation:p.generation, joinedAt:p.joined_at, completedAt:p.completed_at, rank:p.completion_order, progress, completed:progress.filter(x=>x.status==='completed').length, score:progress.reduce((n,x)=>n+(x.score||0),0), maxScore:progress.reduce((n,x)=>n+x.total,0) };
  }
  function allowedLesson(req,res,next) {
    const lesson = lessonById[req.params.id];
    if (!lesson) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    const done = db.prepare(`SELECT a.lesson_id FROM lesson_attempts a JOIN quiz_submissions q ON a.id=q.attempt_id WHERE a.participant_id=?`).all(req.participant.id).map(x=>x.lesson_id);
    if (!lessonIds.slice(0,lesson.order).every(id=>done.includes(id))) return res.status(403).json({ error: 'Hoàn thành bài trước để mở bài này.' });
    req.lesson = lesson; next();
  }
  function stateFor(lesson, attempt) {
    if (!attempt) return { status: 'idle', lesson:publicLesson(lesson), attempt:null };
    const submitted = db.prepare('SELECT * FROM quiz_submissions WHERE attempt_id=?').get(attempt.id);
    const snapshot = playback(lesson,attempt,now());
    return { lesson:publicLesson(lesson), attempt:{ id:attempt.id, startedAt:attempt.started_at, version:attempt.dataset_version }, status:submitted?'completed':snapshot.finished?'quiz':'running', ...snapshot, grading:submitted?gradeAnswers(lesson,JSON.parse(submitted.answers)):null, submittedAt:submitted?.submitted_at??null };
  }
  app.get('/api/health', (_req,res) => res.json({ ok:true, generation:store.generation() }));
  app.get('/api/lessons', (_req,res) => res.json({ lessons:lessons.map(publicLesson) }));
  app.post('/api/join', (req,res) => {
    if (!limit(`join:${req.ip}`,120,600000)) return res.status(429).json({ error:'Bạn đã tạo nhiều phiên. Vui lòng thử lại sau.' });
    const name = typeof req.body?.name === 'string' ? req.body.name.normalize('NFC').trim().replace(/\s+/g,' ') : '';
    if (name.length<2 || name.length>50 || /[\p{Cc}\p{Cf}]/u.test(name)) return res.status(400).json({ error:'Tên cần từ 2 đến 50 ký tự, không chứa ký tự điều khiển.' });
    const token = randomToken(), id=crypto.randomUUID();
    db.prepare('INSERT INTO participants(id,generation,name,token_hash,joined_at) VALUES(?,?,?,?,?)').run(id,store.generation(),name,hashToken(token),now());
    res.status(201).json({ token, participant:progressFor(db.prepare('SELECT * FROM participants WHERE id=?').get(id)) });
  });
  app.get('/api/me',requireParticipant,(req,res)=>res.json({participant:progressFor(req.participant)}));
  app.get('/api/lessons/:id/state',requireParticipant,allowedLesson,(req,res)=>{
    const attempt=db.prepare('SELECT * FROM lesson_attempts WHERE participant_id=? AND lesson_id=?').get(req.participant.id,req.lesson.id);
    res.json(stateFor(req.lesson,attempt));
  });
  app.post('/api/lessons/:id/start',requireParticipant,allowedLesson,(req,res)=>{
    const lesson=req.lesson;
    db.prepare('INSERT OR IGNORE INTO lesson_attempts(id,participant_id,lesson_id,dataset_version,started_at,duration_ms) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),req.participant.id,lesson.id,lesson.version,now(),Math.max(1,Math.round(lesson.durationMs*durationScale)));
    res.json(stateFor(lesson,db.prepare('SELECT * FROM lesson_attempts WHERE participant_id=? AND lesson_id=?').get(req.participant.id,lesson.id)));
  });
  app.post('/api/lessons/:id/submit',requireParticipant,allowedLesson,(req,res)=>{
    if (!limit(`submit:${req.participant.id}`,40,60000)) return res.status(429).json({error:'Bạn thao tác quá nhanh. Vui lòng đợi một chút.'});
    const lesson=req.lesson;
    const attempt=db.prepare('SELECT * FROM lesson_attempts WHERE participant_id=? AND lesson_id=?').get(req.participant.id,lesson.id);
    if (!attempt || now()-attempt.started_at<attempt.duration_ms) return res.status(409).json({error:'Hãy đợi bài test kết thúc trước khi nộp câu trả lời.'});
    const previous=db.prepare('SELECT * FROM quiz_submissions WHERE attempt_id=?').get(attempt.id);
    if (!previous) {
      const grading=gradeAnswers(lesson,req.body?.answers);
      if (!grading) return res.status(400).json({error:`Mỗi câu cần đúng một lựa chọn A, B, C hoặc D. Hãy trả lời đủ ${lesson.questions.length} câu.`});
      store.transaction(()=>{
        db.prepare('INSERT INTO quiz_submissions(attempt_id,answers,score,submitted_at) VALUES(?,?,?,?)').run(attempt.id,JSON.stringify(req.body.answers),grading.score,now());
        const total=db.prepare('SELECT COUNT(*) AS count FROM quiz_submissions q JOIN lesson_attempts a ON q.attempt_id=a.id WHERE a.participant_id=?').get(req.participant.id).count;
        const participant=db.prepare('SELECT * FROM participants WHERE id=?').get(req.participant.id);
        if (total===4 && participant.completion_order===null) {
          const rank=db.prepare('SELECT next_rank FROM demo_state WHERE id=1').get().next_rank;
          db.prepare('UPDATE participants SET completed_at=?,completion_order=? WHERE id=?').run(now(),rank,participant.id);
          db.prepare('UPDATE demo_state SET next_rank=next_rank+1 WHERE id=1').run();
        }
      });
    }
    res.json({...stateFor(lesson,attempt),participant:progressFor(db.prepare('SELECT * FROM participants WHERE id=?').get(req.participant.id))});
  });
  app.post('/api/admin/login',(req,res)=>{
    if (!limit(`login:${req.ip}`,8,600000)) return res.status(429).json({error:'Đã thử đăng nhập nhiều lần. Thử lại sau 10 phút.'});
    if (!verifyPassword(req.body?.password)) return res.status(401).json({error:'Mật khẩu quản trị chưa đúng.'});
    const token=randomToken();
    db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(now());
    db.prepare('INSERT INTO admin_sessions VALUES(?,?)').run(hashToken(token),now()+8*3600000);
    res.cookie('classroom_admin',token,{httpOnly:true,sameSite:'strict',secure:secureCookies,path:'/api/admin',maxAge:8*3600000});
    res.json({ok:true});
  });
  app.get('/api/admin/results',requireAdmin,(_req,res)=>{
    const participants=db.prepare('SELECT * FROM participants ORDER BY completion_order IS NULL,completion_order,joined_at,id').all().map(progressFor);
    res.json({generation:store.generation(),participants,total:participants.length,completed:participants.filter(p=>p.completedAt!=null).length});
  });
  app.post('/api/admin/logout',requireAdmin,(req,res)=>{
    db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hashToken(req.adminToken));
    res.clearCookie('classroom_admin',{path:'/api/admin',sameSite:'strict',secure:secureCookies,httpOnly:true});res.json({ok:true});
  });
  app.post('/api/admin/reset',requireAdmin,(req,res)=>{
    if (req.body?.confirmation!=='RESET' || req.body?.generation!==store.generation()) return res.status(409).json({error:'Xác nhận reset không hợp lệ hoặc phiên đã thay đổi. Hãy tải lại bảng kết quả.'});
    store.transaction(()=>{
      db.prepare('DELETE FROM participants').run();
      db.prepare('UPDATE demo_state SET generation=generation+1,next_rank=1 WHERE id=1').run();
    });
    res.json({ok:true,generation:store.generation()});
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'Không tìm thấy chức năng này.'}));
  app.use((error,_req,res,_next)=>{
    if (error.type==='entity.too.large') return res.status(413).json({error:'Dữ liệu gửi lên quá lớn.'});
    if (error instanceof SyntaxError && error.status===400) return res.status(400).json({error:'Dữ liệu JSON không hợp lệ.'});
    console.error(error);
    res.status(500).json({error:'Server chưa xử lý được yêu cầu. Vui lòng thử lại.'});
  });
  return {app,store};
}
