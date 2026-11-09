'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Moon,Sun,ArrowUpRight,Sparkles} from 'lucide-react';
export function Brand({name='Плюш'}:{name?:string}){return <Link href="/" className="brand" aria-label={name+' — главная'}><span className="brand-mark"><Sparkles size={23} strokeWidth={1.8}/></span>{name}<span className="brand-dot">®</span></Link>;}
export function ThemeToggle(){const [dark,setDark]=useState(false);useEffect(()=>{setDark(document.documentElement.dataset.theme==='dark');},[]);function toggle(){const v=!dark;setDark(v);document.documentElement.dataset.theme=v?'dark':'light';localStorage.setItem('plyush-theme',v?'dark':'light');}return <button className="icon-button" onClick={toggle} aria-label={dark?'Светлая тема':'Тёмная тема'}>{dark?<Sun size={20}/>:<Moon size={20}/>}</button>;}
export function Header({name}:{name?:string}){return <header className="site-header"><Brand name={name}/><nav><a href="/#services">Услуги и цены</a><a href="/#how">Как это работает</a><a href="/#contacts">Контакты</a></nav><div className="header-actions"><ThemeToggle/><a href="/#calculator" className="header-cta">Рассчитать стоимость <ArrowUpRight size={16}/></a></div></header>;}
export function RegisterSW(){useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);return null;}
