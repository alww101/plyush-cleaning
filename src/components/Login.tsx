'use client';
import {useState} from 'react';
import {Brand} from './Shell';
import {api,send} from '@/lib/client';
import {Field,ErrorText} from './Configurator';
export default function Login(){const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);return <main className="login-page"><form className="login-box" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('login',send('POST',{password}));location.assign('/admin');}catch(e){setError((e as Error).message);setBusy(false);}}}><Brand/><h1>Кабинет владельца</h1><p>Заявки, тарифы и всё, что делает сервис вашим.</p><Field label="Пароль"><input type="password" autoComplete="current-password" value={password} required maxLength={200} onChange={e=>setPassword(e.target.value)}/></Field><ErrorText text={error}/><button className="primary full" disabled={busy}>{busy?'Входим…':'Войти'}</button><a className="secondary full" href="/">На сайт</a></form></main>;}
