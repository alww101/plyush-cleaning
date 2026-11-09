import { z } from 'zod';
export const catalog = {
  sofa: {name:'Диван',variants:{two:'2 места',three:'3 места',corner:'Угловой'},phrase:'А можно снова как новенький?'},
  armchair:{name:'Кресло',variants:{regular:'Обычное',recliner:'Реклайнер'},phrase:'Моё любимое место — дома.'},
  mattress:{name:'Матрас',variants:{single:'Односпальный',double:'Двуспальный'},phrase:'За чистые сны.'},
  chair:{name:'Стул',variants:{seat:'Сиденье',back:'Сиденье и спинка'},phrase:'Маленький, но тоже хочу заботы.'},
  other:{name:'Другое',variants:{custom:'По фото'},phrase:'Расскажите, что нужно почистить.'}
} as const;
export type Category = keyof typeof catalog;
export const itemSchema = z.object({category:z.enum(['sofa','armchair','mattress','chair','other']),variant:z.string(),quantity:z.number().int().min(1).max(20),heavy:z.boolean(),secondSide:z.boolean(),description:z.string().trim().max(600).default('')}).strict().superRefine((i,c)=>{
  if(!(i.variant in catalog[i.category].variants)) c.addIssue({code:'custom',path:['variant'],message:'Выберите вариант мебели'});
  if(i.secondSide && i.category!=='mattress') c.addIssue({code:'custom',path:['secondSide'],message:'Вторая сторона доступна только для матраса'});
  if(i.category==='other' && i.description.length<5)c.addIssue({code:'custom',path:['description'],message:'Опишите предмет: минимум 5 символов'});
});
export type Item=z.infer<typeof itemSchema>;
const pricesSchema=z.object({two:z.number().int().min(1).max(100000),three:z.number().int().min(1).max(100000),corner:z.number().int().min(1).max(100000)});
const price=z.number().int().min(1).max(100000);
export const settingsSchema=z.object({
 company:z.object({name:z.string().trim().min(2).max(60),city:z.string().trim().min(2).max(80),area:z.string().max(180),phone:z.string().max(30).refine(v=>!v||/^\+?[\d ()-]{10,25}$/.test(v),'Некорректный телефон'),email:z.union([z.email(),z.literal('')]),telegram:z.string().max(80).refine(v=>!v||/^https:\/\/t\.me\/[a-zA-Z0-9_]{5,}$/.test(v),'Укажите https://t.me/username'),accent:z.string().regex(/^#[0-9a-fA-F]{6}$/),legalName:z.string().max(200),legalAddress:z.string().max(400),retentionDays:z.number().int().min(30).max(1095)}),
 prices:z.object({sofa:pricesSchema,armchair:z.object({regular:price,recliner:price}),mattress:z.object({single:price,double:price}),chair:z.object({seat:price,back:price})}),
 minimum:z.number().int().min(0).max(100000),heavyPercent:z.number().int().min(0).max(200),secondSidePercent:z.number().int().min(0).max(100),outsideFee:z.number().int().min(0).max(20000),
 game:z.object({mode:z.enum(['off','fun','bonus']),amount:z.number().int().min(0).max(10000),days:z.number().int().min(1).max(365),minimum:z.number().int().min(0).max(100000)}),
 characters:z.object({faces:z.boolean(),speech:z.boolean(),personality:z.enum(['gentle','cheerful','quiet'])})
});
export type Settings=z.infer<typeof settingsSchema>;
export const defaults:Settings={company:{name:'Плюш',city:'Москва',area:'Москва и ближайшее Подмосковье',phone:'',email:'',telegram:'',accent:'#8b7bd8',legalName:'',legalAddress:'',retentionDays:180},prices:{sofa:{two:2400,three:3200,corner:4200},armchair:{regular:1400,recliner:1800},mattress:{single:1800,double:2600},chair:{seat:350,back:550}},minimum:2500,heavyPercent:25,secondSidePercent:50,outsideFee:700,game:{mode:'fun',amount:500,days:30,minimum:3000},characters:{faces:true,speech:true,personality:'gentle'}};
export function itemLabel(item:Item){return `${catalog[item.category].name} · ${(catalog[item.category].variants as Record<string,string>)[item.variant]}`;}
export function modelKey(item:Pick<Item,'category'|'variant'>){
  if(item.category==='sofa') return item.variant==='three'?'sofa_three':item.variant==='corner'?'sofa_corner':'sofa';
  if(item.category==='armchair'&&item.variant==='recliner') return 'recliner';
  if(item.category==='mattress') return item.variant==='single'?'mattress_single':'mattress_double';
  if(item.category==='chair') return item.variant==='seat'?'chair_seat':'chair_back';
  return item.category;
}
export function signature(i:Item){return JSON.stringify([i.category,i.variant,i.heavy,i.secondSide,i.description.trim()]);}
export function mergeItems(items:Item[]){const out:Item[]=[];for(const item of items){const found=out.find(i=>signature(i)===signature(item));if(found)found.quantity+=item.quantity;else out.push({...item});}return out;}
export function calculate(items:Item[],s:Settings,outside=false){
 const lines=items.map(i=>{if(i.category==='other')return {...i,label:itemLabel(i),unit:null,total:null};const base=(s.prices[i.category] as Record<string,number>)[i.variant];const unit=Math.round(base*(1+(i.secondSide?s.secondSidePercent:0)/100)*(1+(i.heavy?s.heavyPercent:0)/100));return {...i,label:itemLabel(i),unit,total:unit*i.quantity};});
 const subtotal=lines.reduce((n,l)=>n+(l.total??0),0);const known=lines.some(i=>i.total!==null);const manual=lines.some(i=>i.total===null);const cleaning=known?Math.max(subtotal,s.minimum):null;const minimumTopUp=known?Math.max(0,s.minimum-subtotal):0;const travel=outside?s.outsideFee:0;
 return {lines,subtotal,minimumTopUp,cleaning,travel,total:cleaning===null?null:cleaning+travel,manual,minimum:s.minimum,formulaVersion:'sequential-unit-ruble-v1'};
}
export type Quote=ReturnType<typeof calculate>;
export const money=(n:number)=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
export const statusNames={new:'Новая',agreed:'Согласована',completed:'Завершена',cancelled:'Отменена'} as const;
export const orderSchema=z.object({idempotencyKey:z.uuid(),draftToken:z.string().regex(/^[a-f0-9]{64}$/),items:z.array(itemSchema).min(1).max(30),name:z.string().trim().min(2,'Укажите имя').max(100),phone:z.string().trim().regex(/^\+?[\d ()-]{10,25}$/,'Укажите телефон').refine(v=>{const n=v.replace(/\D/g,'');return n.length>=10&&n.length<=15;},'Проверьте номер телефона'),address:z.string().trim().min(5,'Укажите адрес').max(400),outside:z.boolean(),date:z.string().max(10),time:z.string().max(5),comment:z.string().trim().max(1500),consent:z.literal(true,{error:'Нужно согласие на обработку данных'}),photos:z.array(z.uuid()).max(3)}).strict().superRefine((o,c)=>{
 if(o.time&&!o.date)c.addIssue({code:'custom',path:['date'],message:'Для времени выберите дату'});
 if(o.date){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||isNaN(Date.parse(o.date))||new Date(o.date).toISOString().slice(0,10)!==o.date||o.date<today)c.addIssue({code:'custom',path:['date'],message:'Выберите сегодняшнюю или будущую дату'});}
 if(o.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(o.time))c.addIssue({code:'custom',path:['time'],message:'Некорректное время'});
 if(o.items.some(i=>i.category==='other')&&!o.photos.length)c.addIssue({code:'custom',path:['photos'],message:'Для «Другое» нужно хотя бы одно фото'});
 if(new Set(o.photos).size!==o.photos.length)c.addIssue({code:'custom',path:['photos'],message:'Повтор фото'});
 if(mergeItems(o.items).some(i=>i.quantity>20))c.addIssue({code:'custom',path:['items'],message:'Не более 20 одинаковых предметов'});
});
export type OrderInput=z.infer<typeof orderSchema>;
