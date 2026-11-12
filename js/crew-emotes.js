/* Dream Drops Crew — combined emote gallery. No API keys, no third-party libraries. */
(() => {
 'use strict';
 const SOURCES = [
   {id:'crystal', name:'Crystal', gallery:'https://crystalsdreamdrops.creatorpromote.com/emotes'},
   {id:'sal',name:'Sal',gallery:'https://salahare.creatorpromote.com/emotes.html'},
   {id:'blackjack',name:'Blackjack',gallery:'https://blackjacksetzer.creatorpromote.com/emotes'},
   {id:'daddy',name:'Daddy Depresso',gallery:'https://daddydepresso.creatorpromote.com/emotes.html'},
   {id:'pmog',name:'PMOG',gallery:'https://pmog.creatorpromote.com/'}
 ];
 const root=document.getElementById('crew-emote-grid');
 if (!root) return;
 const search=document.getElementById('emote-search');
 const type=document.getElementById('emote-type');
 const order=document.getElementById('emote-order');
 const status=document.getElementById('emote-status');
 const counter=document.getElementById('emote-counter');
 const empty=document.getElementById('emote-empty');
 const emptyTitle=document.getElementById('emote-empty-title');
 const emptyDesc=document.getElementById('emote-empty-desc');
 const clear=document.getElementById('emote-clear');
 const chips=[...document.querySelectorAll('[data-owner]')];
 const state={entries:[], owner:'all', search:'',type:'all',order:'az',loaded:false,updated:null,failed:false};
 const fileExt=/\.(gif|apng|webp|png|jpe?g|avif)(?:\?.*)?$/i;
 const animated=/\.(gif|apng)(?:\?.*)?$/i;
 const members=new Map(SOURCES.map(m=>[m.id,m]));
 const titleOf=url=>{
   let s='';try{s=decodeURIComponent(new URL(url).pathname.split('/').pop()||'')}catch{return 'Emote'}
   return s.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90)||'Emote';
 };
 const validImage=url=>{
   try{const u=new URL(url,location.href);return u.protocol==='https:'&&fileExt.test(u.pathname) &&
      (u.hostname==='creatorpromote.com'||u.hostname.endsWith('.creatorpromote.com'));}catch{return false}
 };
 function normalize(v){
   if(!v||typeof v!=='object'||!members.has(v.member)||typeof v.url!=='string'||!validImage(v.url))return null;
   const member=members.get(v.member);
   return { member:v.member, creator:member.name, url:new URL(v.url,location.href).href, name:typeof v.name==='string'&&v.name.trim()?v.name.trim().slice(0,95):titleOf(v.url),animated:animated.test(new URL(v.url,location.href).pathname) };
 }
 function getFiltered(){
   const q=state.search.toLocaleLowerCase().trim();
   const data=state.entries.filter(e=> (state.owner==='all'||e.member===state.owner) &&
     (state.type==='all'||(state.type==='animated'?e.animated:!e.animated)) &&
     (!q||`${e.name} ${e.creator}`.toLocaleLowerCase().includes(q)));
   data.sort((a,b)=> state.order==='creator' ? a.creator.localeCompare(b.creator)||a.name.localeCompare(b.name,undefined,{numeric:true})
     :state.order==='za' ? b.name.localeCompare(a.name,undefined,{numeric:true})
     :a.name.localeCompare(b.name,undefined,{numeric:true}));
   return data;
 }
 async function copyValue(text){
   if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return;}
   const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.left='-10000px';document.body.appendChild(field);field.select();
   const success=document.execCommand('copy');field.remove();if(!success)throw new Error('Copy denied');
 }
 function makeCard(v){
   const card=document.createElement('article');card.className='crew-emote-card';
   const preview=document.createElement('div');preview.className='crew-emote-image';
   const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.src=v.url;img.alt=v.name+' by '+v.creator;
   img.addEventListener('error',()=>{img.hidden=true;let s=document.createElement('span');s.className='broken';s.textContent='✧';s.title='Preview not available';preview.append(s);});
   const tag=document.createElement('span');tag.className='format-tag';tag.textContent=v.animated?'GIF':'IMAGE';preview.append(img,tag);
   const body=document.createElement('div');body.className='crew-emote-body';
   const title=document.createElement('h3');title.textContent=v.name;
   const by=document.createElement('span');by.className='emote-by';by.textContent='by '+v.creator;
   const actions=document.createElement('div');actions.className='emote-card-actions';
   const copy=document.createElement('button');copy.type='button';copy.textContent='Copy link';copy.setAttribute('aria-label','Copy direct link to '+v.name);
   copy.addEventListener('click',async()=>{try{await copyValue(v.url);copy.textContent='✓ Copied';status.textContent='Copied '+v.name+'!';setTimeout(()=>{if(copy.isConnected)copy.textContent='Copy link';},2200)}catch{status.textContent='Your browser blocked copying. Open the image and copy its address instead.'}});
   const link=document.createElement('a');link.href=v.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='↗';link.setAttribute('aria-label','Open '+v.name+' image in a new tab');
   actions.append(copy,link);body.append(title,by,actions);card.append(preview,body);return card;
 }
 function render(){
   const filtered=getFiltered();
   root.replaceChildren(...filtered.map(makeCard));root.setAttribute('aria-busy','false');
   counter.textContent=state.entries.length===1?'1 emote':`${state.entries.length} emotes`;
   for(const id of ['all',...SOURCES.map(e=>e.id)]){
     const count=document.getElementById('count-'+id);if(count)count.textContent=id==='all'?state.entries.length:state.entries.filter(e=>e.member===id).length;
   }
   const filtering=state.owner!=='all'||state.type!=='all'||state.search.trim()!=='';
   clear.hidden=!filtering;
   if(!state.loaded){status.textContent='Reading the shared catalog…';return}
   if(!state.failed)status.textContent=`Showing ${filtered.length} of ${state.entries.length} emotes${state.updated?' · Catalog updated '+new Date(state.updated).toLocaleDateString():''}.`;
   empty.hidden=filtered.length>0;
   if(!state.entries.length){emptyTitle.textContent='The shelf is waiting for its first emotes.';emptyDesc.textContent='The shared catalog has not been filled yet. Visit the member galleries below, or run the included refresh script to index their public emote lists.';}
   else if(!filtered.length){emptyTitle.textContent='No reactions matched.';emptyDesc.textContent='Try another name or choose Everyone to explore all creators.'}
 }
 function resetFilters(){state.owner='all';state.search='';state.type='all';search.value='';type.value='all';chips.forEach(chip=>{const active=chip.dataset.owner==='all';chip.classList.toggle('is-active',active);chip.setAttribute('aria-pressed',String(active));});render();}
 chips.forEach(chip=>chip.addEventListener('click',()=>{state.owner=chip.dataset.owner;chips.forEach(b=>{const active=b===chip;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});render();document.getElementById('gallery').scrollIntoView({behavior:'smooth',block:'start'}); }));
 search.addEventListener('input',()=>{state.search=search.value;render()});type.addEventListener('change',()=>{state.type=type.value;render()});order.addEventListener('change',()=>{state.order=order.value;render()});clear.addEventListener('click',resetFilters);
 async function load(){
   try{
     const r=await fetch('data/crew-emotes.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
     const json=await r.json();if(!json||!Array.isArray(json.items))throw new Error('Invalid manifest');
     const seen=new Set();state.entries=json.items.map(normalize).filter(e=>{if(!e)return false;const k=e.member+'|'+e.url;if(seen.has(k))return false;seen.add(k);return true});state.updated=json.updated||null;
   }catch(err){state.failed=true;console.warn('Could not load crew emote catalog:',err);status.textContent='Could not load data/crew-emotes.json. Use Live Server or a web host and check that file is uploaded.'}
   state.loaded=true;render();
 }
 load();
})();
