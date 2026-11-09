import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/order/','/api/']},sitemap:(process.env.APP_ORIGIN||'http://localhost:3000')+'/sitemap.xml'};}
