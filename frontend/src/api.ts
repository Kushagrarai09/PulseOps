import { io } from "socket.io-client";
const API_URL=import.meta.env.VITE_API_URL||"http://localhost:4000";
export const socket=io(import.meta.env.VITE_SOCKET_URL||API_URL,{autoConnect:true});
export async function api<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await fetch(`${API_URL}/api${path}`,{...options,headers:{"Content-Type":"application/json",...(options?.headers||{})}});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`Request failed (${response.status})`);}
  return response.json();
}
export type Device={id:string;name:string;location:string;device_type:string;status:string;last_seen:string|null;thresholds:{temperature:number;pressure:number;vibration:number};latest_telemetry?:Telemetry|null};
export type Telemetry={id:number;device_id:string;temperature:number;pressure:number;vibration:number;voltage:number;current:number;machine_status:string;recorded_at:string};
export type Alert={id:number;device_id:string;device_name:string;severity:string;metric:string;message:string;value:number;status:string;created_at:string};
