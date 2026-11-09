import Configurator from '@/components/Configurator';
import {getSettings} from '@/lib/db';
export const dynamic='force-dynamic';
export async function generateMetadata(){const s=await getSettings();return {title:s.company.name+' — химчистка мебели на дому в '+s.company.city,description:`Чистка диванов от ${s.prices.sofa.two} ₽. ${s.company.area}. Рассчитайте стоимость и оставьте заявку без предоплаты.`};}
export default async function Home(){return <Configurator settings={await getSettings()}/>;}
