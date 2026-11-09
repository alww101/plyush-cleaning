import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import fs from 'node:fs/promises';
import { defaults, type Settings } from './domain';

export interface Queryable { query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}> }
type Database=Queryable & {tx<T>(fn:(q:Queryable)=>Promise<T>):Promise<T>};
const g=globalThis as typeof globalThis & {plyushDB?:Promise<Database>};
export const schema=`
CREATE TABLE IF NOT EXISTS settings(id integer PRIMARY KEY CHECK(id=1), value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS owner(id integer PRIMARY KEY CHECK(id=1), password_hash text NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id uuid PRIMARY KEY, number bigserial UNIQUE, token text NOT NULL UNIQUE, idempotency_key uuid UNIQUE NOT NULL, draft_hash text NOT NULL, request_hash text NOT NULL, status text NOT NULL DEFAULT 'new', input jsonb NOT NULL, quote jsonb NOT NULL, settings_snapshot jsonb NOT NULL, final_price integer, agreed_at timestamptz, private_note text NOT NULL DEFAULT '', history jsonb NOT NULL, game_claim jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS photos(id uuid PRIMARY KEY, draft_hash text NOT NULL, order_id uuid REFERENCES orders(id) ON DELETE CASCADE, content bytea NOT NULL, mime text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits(key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS photos_order ON photos(order_id);
CREATE INDEX IF NOT EXISTS photos_draft ON photos(draft_hash);
`;
async function open():Promise<Database>{
 if(process.env.DATABASE_URL){
   const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});
   const db:Database={query:async<T>(s:string,p?:unknown[])=>({rows:(await pool.query(s,p)).rows as T[]}),tx:async(fn)=>{const c=await pool.connect();try{await c.query('BEGIN');const v=await fn(c);await c.query('COMMIT');return v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
   return db;
 }
 if(process.env.LOCAL_DATABASE!=='1')throw new Error('DATABASE_URL is required. For local preview run npm run setup.');
 const dir=path.resolve(process.env.DATA_DIR||'data');await fs.mkdir(dir,{recursive:true});
 const pg=new PGlite(path.join(dir,'postgres'));await pg.waitReady;
 return {query:(s,p)=>pg.query(s,p),tx:(fn)=>pg.transaction(tx=>fn(tx as Queryable))};
}
export const db=()=>g.plyushDB??=(open());
export async function migrate(){const d=await db();for(const statement of schema.split(';').filter(s=>s.trim()))await d.query(statement);await d.query('INSERT INTO settings(id,value) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(defaults)]);}
export async function getSettings():Promise<Settings>{const r=await(await db()).query<{value:Settings}>('SELECT value FROM settings WHERE id=1');return r.rows[0]?.value??defaults;}
