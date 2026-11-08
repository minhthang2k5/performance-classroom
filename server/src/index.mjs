import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { localAdminPassword } from './auth.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const data=path.join(root,'server/data');
const adminPassword=localAdminPassword(data,process.env.ADMIN_PASSWORD);
const {app,store}=createApp({databasePath:path.resolve(root,process.env.DATABASE_PATH||'server/data/classroom.sqlite'),adminPassword,secureCookies:process.env.COOKIE_SECURE==='true'});
const dist=path.join(root,'frontend/dist');
if(fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
}
const server=app.listen(Number(process.env.PORT||4001),process.env.HOST||'127.0.0.1',()=>{
  console.log(`Performance Lab API: http://localhost:${process.env.PORT||4001}`);
  console.log('Mật khẩu admin: chạy npm run admin:password trong thư mục ứng dụng.');
});
server.on('error',error=>{console.error(error.message);store.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
