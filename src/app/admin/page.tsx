import {admin} from '@/lib/security';
import {getSettings} from '@/lib/db';
import {redirect} from 'next/navigation';
import Admin from '@/components/Admin';
export const dynamic='force-dynamic';
export const metadata={title:'Кабинет владельца',robots:{index:false,follow:false}};
export default async function Page(){try{await admin();}catch{redirect('/login');}return <Admin initialSettings={await getSettings()}/>;}
