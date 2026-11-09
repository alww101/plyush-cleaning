import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {z} from 'zod';
import {db,getSettings,type Queryable} from '@/lib/db';
import {admin,hash,HttpError,jsonBody,originCheck,passwordHash,rate,token,verifyPassword} from '@/lib/security';
import {calculate,mergeItems,orderSchema,settingsSchema,type OrderInput,type Settings} from '@/lib/domain';
export const runtime='nodejs';export const dynamic='force-dynamic';
type OrderRow={id:string;number:string;token:string;draft_hash:string;request_hash:string;status:string;input:OrderInput;quote:ReturnType<typeof calculate>;settings_snapshot:Settings;final_price:number|null;agreed_at:string|null;private_note:string;history:{at:string;text:string}[];game_claim:unknown;created_at:string;updated_at:string};
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'}});
const uuid=z.uuid();
async function getOrder(q:Queryable,id:string,publicToken=false){const r=await q.query<OrderRow>(`SELECT * FROM orders WHERE ${publicToken?'token':'id'}=$1`,[id]);if(!r.rows[0])throw new HttpError(404,'Заявка не найдена');return r.rows[0];}
function publicOrder(o:OrderRow){return {number:o.number,status:o.status,items:o.quote.lines,quote:o.quote,finalPrice:o.final_price,agreedAt:o.agreed_at,wishDate:o.input.date,wishTime:o.input.time,createdAt:o.created_at,updatedAt:o.updated_at,history:o.history,game:o.settings_snapshot.game,bonus:o.game_claim};}
async function handler(req:NextRequest,context:{params:Promise<{path:string[]}>}){try{
 const path=(await context.params).path;const route=path.join('/');const method=req.method;
 if(method!=='GET')originCheck(req);
 if(route==='settings'&&method==='GET')return response(await getSettings());
 if(route==='login'&&method==='POST'){
  await rate(req,'login',8);const body=z.object({password:z.string().min(1).max(200)}).parse(await jsonBody(req));const r=await(await db()).query<{password_hash:string}>('SELECT password_hash FROM owner WHERE id=1');
  if(!r.rows[0]||!verifyPassword(body.password,r.rows[0].password_hash))throw new HttpError(401,'Неверный пароль');
  const session=token();await(await db()).query('INSERT INTO sessions(token_hash,expires_at) VALUES($1,now()+interval \'7 days\')',[hash(session)]);const res=response({ok:true});res.cookies.set('plyush_session',session,{httpOnly:true,secure:new URL(req.url).protocol==='https:',sameSite:'strict',path:'/',maxAge:604800});return res;
 }
 if(route==='orders'&&method==='POST'){
  await rate(req,'orders',30);const body=orderSchema.parse(await jsonBody(req));const payloadHash=hash(JSON.stringify(body));const d=await db();
  const settings=await getSettings();const result=await d.tx(async q=>{
   // Unique key is the final arbiter, including concurrent requests on separate servers.
   const items=mergeItems(body.items);const quote=calculate(items,settings,body.outside);const id=randomUUID(),secret=token();
   const inserted=await q.query<OrderRow>(`INSERT INTO orders(id,token,idempotency_key,draft_hash,request_hash,input,quote,settings_snapshot,history) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb) ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`,[id,secret,body.idempotencyKey,hash(body.draftToken),payloadHash,JSON.stringify({...body,items,draftToken:undefined,idempotencyKey:undefined}),JSON.stringify(quote),JSON.stringify(settings),JSON.stringify([{at:new Date().toISOString(),text:'Заявка получена'}])]);
   if(!inserted.rows.length){const existing=await q.query<OrderRow>('SELECT * FROM orders WHERE idempotency_key=$1',[body.idempotencyKey]);const o=existing.rows[0];if(o.draft_hash!==hash(body.draftToken)||o.request_hash!==payloadHash)throw new HttpError(409,'Данные изменились после отправки. Проверьте прежнюю заявку или создайте новую');return {token:o.token,number:o.number,replayed:true};}
   for(const photo of body.photos){const updated=await q.query('UPDATE photos SET order_id=$1 WHERE id=$2 AND draft_hash=$3 AND order_id IS NULL AND created_at>now()-interval \'24 hours\' RETURNING id',[id,photo,hash(body.draftToken)]);if(!updated.rows.length)throw new HttpError(400,'Фото устарело или недоступно. Загрузите его снова',{photos:'Загрузите фото снова'});}
   return {token:secret,number:inserted.rows[0].number,replayed:false};
  });return response(result,201);
 }
 if(path[0]==='order'&&path[1]&&method==='GET'){
  if(!/^[a-f0-9]{64}$/.test(path[1]))throw new HttpError(404,'Заявка не найдена');await rate(req,'public-read',600);return response(publicOrder(await getOrder(await db(),path[1],true)));
 }
 if(path[0]==='bonus'&&path[1]&&method==='POST'){
  await rate(req,'bonus',30);if(!/^[a-f0-9]{64}$/.test(path[1]))throw new HttpError(404,'Заявка не найдена');
  const result=await(await db()).tx(async q=>{const r=await q.query<OrderRow>('SELECT * FROM orders WHERE token=$1 FOR UPDATE',[path[1]]);const o=r.rows[0];if(!o)throw new HttpError(404,'Заявка не найдена');if(o.game_claim)return o.game_claim;const g=o.settings_snapshot.game;if(g.mode!=='bonus')throw new HttpError(400,'Бонус выключен');const claim={code:'PLUSH-'+token().slice(0,10).toUpperCase(),amount:g.amount,minimum:g.minimum,expiresAt:new Date(Date.now()+g.days*86400000).toISOString(),manual:true};await q.query('UPDATE orders SET game_claim=$1::jsonb WHERE id=$2',[JSON.stringify(claim),o.id]);return claim;});return response(result);
 }
 if(route==='photos'&&method==='POST'){
  await rate(req,'photos',30);if(Number(req.headers.get('content-length')||0)>8*1024*1024+20000)throw new HttpError(413,'Фото должно быть не больше 8 МБ');
  const draft=req.headers.get('x-draft-token')||'';if(!/^[a-f0-9]{64}$/.test(draft))throw new HttpError(400,'Обновите черновик');const form=await req.formData();const file=form.get('file');if(!(file instanceof File)||file.size>8*1024*1024||file.size===0)throw new HttpError(400,'Выберите JPEG, PNG или WebP до 8 МБ');
  const bytes=Buffer.from(await file.arrayBuffer());let output:Buffer;try{const input=sharp(bytes,{limitInputPixels:24000000,failOn:'error'});const meta=await input.metadata();if(!['jpeg','png','webp'].includes(meta.format||'')||(meta.pages??1)>1)throw new Error();output=await input.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();}catch{throw new HttpError(400,'Не удалось прочитать фото. Нужен обычный JPEG, PNG или WebP до 24 Мп');}
  const id=randomUUID();await(await db()).tx(async q=>{await q.query("DELETE FROM photos WHERE order_id IS NULL AND created_at<now()-interval '24 hours'");await q.query('SELECT id FROM settings WHERE id=1 FOR UPDATE');const count=await q.query<{count:string}>('SELECT count(*) FROM photos WHERE draft_hash=$1 AND order_id IS NULL',[hash(draft)]);if(Number(count.rows[0].count)>=3)throw new HttpError(400,'Можно прикрепить до трёх фото');await q.query('INSERT INTO photos(id,draft_hash,content,mime) VALUES($1,$2,$3,$4)',[id,hash(draft),output,'image/webp']);});return response({id},201);
 }
 if(path[0]==='photos'&&path[1]){
  uuid.parse(path[1]);const d=await db();const row=(await d.query<{id:string;draft_hash:string;order_id:string|null;content:Buffer;mime:string}>('SELECT * FROM photos WHERE id=$1',[path[1]])).rows[0];if(!row)throw new HttpError(404,'Фото не найдено');
  const draft=req.headers.get('x-draft-token');const draftAllowed=!row.order_id&&draft&&hash(draft)===row.draft_hash;
  if(!draftAllowed)await admin();
  if(method==='GET')return new NextResponse(new Uint8Array(row.content),{headers:{'Content-Type':row.mime,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
  if(method==='DELETE'){if(row.order_id)throw new HttpError(400,'Фото удаляется вместе с заявкой');await d.query('DELETE FROM photos WHERE id=$1',[row.id]);return response({ok:true});}
 }
 if(path[0]==='admin'){
  await admin();const d=await db();
  if(route==='admin/session')return response({ok:true});
  if(route==='admin/logout'&&method==='POST'){const t=req.cookies.get('plyush_session')?.value;if(t)await d.query('DELETE FROM sessions WHERE token_hash=$1',[hash(t)]);const res=response({ok:true});res.cookies.delete('plyush_session');return res;}
  if(route==='admin/password'&&method==='POST'){
   await rate(req,'password',8);const b=z.object({current:z.string().max(200),password:z.string().min(12,'Пароль: минимум 12 символов').max(200)}).parse(await jsonBody(req));await d.tx(async q=>{const r=await q.query<{password_hash:string}>('SELECT password_hash FROM owner WHERE id=1 FOR UPDATE');if(!verifyPassword(b.current,r.rows[0].password_hash))throw new HttpError(400,'Текущий пароль неверен');await q.query('UPDATE owner SET password_hash=$1 WHERE id=1',[passwordHash(b.password)]);await q.query('DELETE FROM sessions');});const res=response({ok:true});res.cookies.delete('plyush_session');return res;
  }
  if(route==='admin/settings'&&method==='PUT'){const s=settingsSchema.parse(await jsonBody(req));await d.query('UPDATE settings SET value=$1::jsonb WHERE id=1',[JSON.stringify(s)]);return response(s);}
  if(route==='admin/orders'&&method==='GET'){
   const search=(req.nextUrl.searchParams.get('q')||'').slice(0,100),status=req.nextUrl.searchParams.get('status')||'';const r=await d.query(`SELECT id,number,status,input->>'name' AS name,input->>'phone' AS phone,input->>'address' AS address,quote,final_price,agreed_at,created_at FROM orders WHERE ($1='' OR input->>'name' ILIKE '%'||$1||'%' OR input->>'phone' ILIKE '%'||$1||'%' OR number::text=$1) AND ($2='' OR status=$2) ORDER BY created_at DESC LIMIT 200`,[search,status]);return response(r.rows);
  }
  if(path[1]==='orders'&&path[2]){
   uuid.parse(path[2]);if(method==='GET'){const o=await getOrder(d,path[2]);const photos=await d.query<{id:string}>('SELECT id FROM photos WHERE order_id=$1',[o.id]);return response({...o,token:undefined,draft_hash:undefined,request_hash:undefined,photos:photos.rows});}
   if(method==='PATCH'){
    const b=z.object({status:z.enum(['new','agreed','completed','cancelled']),finalPrice:z.number().int().min(0).max(1000000).nullable(),agreedAt:z.string().datetime({offset:true}).nullable(),note:z.string().max(4000)}).refine(b=>!['agreed','completed'].includes(b.status)||(b.finalPrice!==null&&b.agreedAt!==null),'Для согласованной или завершённой заявки нужны итоговая цена и время').parse(await jsonBody(req));
    await d.tx(async q=>{await q.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[path[2]]);const o=await getOrder(q,path[2]);const labels={new:'Новая',agreed:'Согласована',completed:'Завершена',cancelled:'Отменена'};const event={at:new Date().toISOString(),text:`Обновлено владельцем: ${labels[b.status]}${b.finalPrice!==null?' · '+b.finalPrice+' ₽':''}`};const history=[...o.history,event];await q.query('UPDATE orders SET status=$1,final_price=$2,agreed_at=$3,private_note=$4,history=$5::jsonb,updated_at=now() WHERE id=$6',[b.status,b.finalPrice,b.agreedAt,b.note,JSON.stringify(history),o.id]);});return response({ok:true});
   }
   if(method==='DELETE'){const b=z.object({confirm:z.literal('DELETE')}).parse(await jsonBody(req));if(b.confirm)await d.query('DELETE FROM orders WHERE id=$1',[path[2]]);return response({ok:true});}
  }
 }
 throw new HttpError(404,'Не найдено');
}catch(e){
 if(e instanceof z.ZodError){const fields:Record<string,string>={};for(const issue of e.issues)fields[String(issue.path[0]||'form')]=issue.message;return response({error:'Проверьте поля',fields},400);}
 if(e instanceof HttpError)return response({error:e.message,fields:e.fields},e.status);
 console.error('Request failed',e instanceof Error?e.name:'unknown');return response({error:'Не удалось выполнить запрос. Сохранённый черновик остаётся у вас. Попробуйте ещё раз.'},500);
}}
export {handler as GET,handler as POST,handler as PUT,handler as PATCH,handler as DELETE};
