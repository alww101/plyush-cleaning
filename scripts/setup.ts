import {loadEnvConfig} from '@next/env';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
loadEnvConfig(process.cwd());
async function main(){
 if(!process.env.DATABASE_URL){process.env.LOCAL_DATABASE='1';const existing=await fs.readFile('.env.local','utf8').catch(()=> '');if(!existing.includes('LOCAL_DATABASE='))await fs.appendFile('.env.local','\nLOCAL_DATABASE=1\nAPP_ORIGIN=http://localhost:3000\n');}
 const {db,migrate}=await import('../src/lib/db');const {passwordHash}=await import('../src/lib/security');await migrate();const d=await db();const exists=await d.query('SELECT id FROM owner WHERE id=1');
 if(!exists.rows.length){const pw=process.env.OWNER_PASSWORD||randomBytes(18).toString('base64url');await d.query('INSERT INTO owner(id,password_hash) VALUES(1,$1)',[passwordHash(pw)]);await fs.mkdir('data',{recursive:true});await fs.writeFile('data/owner-access.txt',`Кабинет: /admin\nПароль: ${pw}\nСмените пароль в разделе «Доступ». Этот файл не включается в исходники.\n`,{mode:0o600});console.log('Owner created. Password is in data/owner-access.txt (not printed).');}
 console.log('Database ready.');process.exit(0);
}main().catch(e=>{console.error(e.message);process.exit(1);});
