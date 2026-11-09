import OrderStatus from '@/components/OrderStatus';
export const metadata={title:'Ваша заявка',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Order({params}:{params:Promise<{token:string}>}){return <OrderStatus token={(await params).token}/>;}
