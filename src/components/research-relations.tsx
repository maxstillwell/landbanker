"use client";
import { useEffect, useState } from "react";
import type { Parcel } from "@/lib/types";
import { apiRequest } from "@/lib/field-queue";
import { timeoutFetch } from "@/lib/network";
export function ResearchRelations({ id, properties, editable }: { id: string; properties: Parcel[]; editable: boolean }) {
 const [manage,setManage]=useState(false);
 const [links,setLinks]=useState<string[]>([]), [observations,setObservations]=useState<{id:string;title:string}[]>([]), [error,setError]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError("");void timeoutFetch(`/api/research-areas/${id}/relations`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error("Relationships unavailable");return r.json();}).then(body=>{setLinks(body.property_ids);setObservations(body.observations);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[id]);
 async function toggle(property_id:string,checked:boolean){setBusy(true);setError("");try{await apiRequest(`/api/research-areas/${id}/relations`,{property_id},checked?"POST":"DELETE");setLinks(current=>checked?[...current,property_id]:current.filter(x=>x!==property_id));}catch{setError("Association could not be saved. Retry when connected.");}finally{setBusy(false);}}
 return <details><summary>Related Properties and Observations</summary>{error&&<p role="alert">{error}</p>}{editable&&<button onClick={()=>setManage(v=>!v)}>{manage?"Done managing associations":"Manage associations"}</button>}{properties.filter(p=>manage||links.includes(p.id)).map(p=><label key={p.id}><input type="checkbox" checked={links.includes(p.id)} disabled={!editable||busy||Boolean(error)} onChange={e=>void toggle(p.id,e.target.checked)} />{p.title}</label>)}{!properties.length&&<p>No saved Properties.</p>}<strong>Linked Observations</strong>{observations.map(o=><p key={o.id}>{o.title}</p>)}{!observations.length&&<p>No linked observations. Choose this Research Area when saving an Observation.</p>}</details>;
}
