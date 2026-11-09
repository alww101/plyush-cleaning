import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
await mkdir('public/icons',{recursive:true});
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="120" fill="#8b7bd8"/><path d="M148 352V166h216v186h-53V218H201v134Z" fill="#fff"/><circle cx="256" cy="378" r="11" fill="#fff"/></svg>');
await Promise.all([192,512].map(n=>sharp(svg).resize(n,n).png().toFile('public/icons/icon-'+n+'.png')));
