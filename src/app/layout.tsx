import type {Metadata,Viewport} from 'next';
import './globals.css';
import {RegisterSW} from '@/components/Shell';
export const metadata:Metadata={title:{default:'Плюш — химчистка мягкой мебели на дому',template:'%s · Плюш'},description:'Рассчитайте стоимость чистки дивана, кресла, матраса или стульев. Заявка без предоплаты, согласование цены и выезда с мастером.',manifest:'/manifest.webmanifest',icons:{icon:'/icons/icon-192.png',apple:'/icons/icon-192.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:[{media:'(prefers-color-scheme: light)',color:'#fafaf7'},{media:'(prefers-color-scheme: dark)',color:'#191b22'}]};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem('plyush-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}`}}/><script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async /></head><body>{children}<RegisterSW/></body></html>;}
