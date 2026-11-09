import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{return ['','/privacy','/attribution'].map(p=>({url:(process.env.APP_ORIGIN||'http://localhost:3000')+p,changeFrequency:'monthly',priority:p?0.2:1}));}
