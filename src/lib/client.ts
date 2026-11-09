export class ApiError extends Error{constructor(message:string,public status:number,public fields:Record<string,string>={}){super(message);}}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{let res:Response;try{res=await fetch('/api/'+path,{...options,headers:{...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers},cache:'no-store'});}catch{throw new ApiError('Нет связи с сервером. Проверьте интернет и повторите попытку.',0);}
 const body=await res.json().catch(()=>({error:'Сервер временно недоступен'}));if(!res.ok)throw new ApiError(body.error||'Не удалось выполнить запрос',res.status,body.fields);return body;}
export const send=(method:string,data?:unknown):RequestInit=>({method,body:data===undefined?undefined:JSON.stringify(data)});
export function newToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
