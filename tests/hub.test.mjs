import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createCreatorFeed} from '../js/hub-feed.mjs';
import {safeFeed} from '../js/creatorpromote-hub.js';

const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/published.json', import.meta.url)));
const scope = {window:{}, Object};
vm.runInNewContext(await fs.readFile(new URL('../js/youtube-config.js',import.meta.url),'utf8'), scope);
const config = Object.values(scope.window)[0];
const now = Date.parse(fixture.updatedAt);
const storage = () => {const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
const response = data => ({ok:true,json:async()=>structuredClone(data)});

test('published feed matches pinned creator and requests only its Hub endpoint', async () => {
  const urls=[];
  const client=createCreatorFeed(config,{now:()=>now,storage:null,fetcher:async url=>{urls.push(url);return response(fixture);}});
  const {data,source}=await client.get();
  assert.equal(source,'network'); assert.equal(data.channel.id,config.channelId);
  assert.deepEqual(urls,['https://api.creatorpromote.com/data/'+config.slug+'.json']);
  assert.equal(data.latestLivestreams.length,fixture.latestLivestreams.length);
  assert.deepEqual(data.channel.statistics,fixture.channel.statistics);
});
test('old published schema remains usable without optional new fields',async()=>{
  const old=structuredClone(fixture);
  for(const key of ['catalog','sections','liveStatus','playlists','collabSources'])delete old[key];
  const {data}=await createCreatorFeed(config,{now:()=>now,storage:null,fetcher:async()=>response(old)}).get();
  assert.equal(data.latestLivestreams.length,old.latestLivestreams.length);
});
test('outage keeps successful data in memory and across reloads',async()=>{
  let offline=false;const saved=storage();
  const options={now:()=>now,storage:saved,fetcher:async()=>{if(offline)throw Error('offline');return response(fixture);}};
  const client=createCreatorFeed(config,options);await client.get();offline=true;
  const value=await client.get({force:true});assert.equal(value.source,'fallback');
  assert.equal(value.data.latestLivestreams.length,fixture.latestLivestreams.length);
  assert.equal((await createCreatorFeed(config,options).get({force:true})).source,'fallback');
});
test('wrong channel and malformed responses never replace a successful cache',async()=>{
  let data=fixture;const client=createCreatorFeed(config,{now:()=>now,storage:storage(),fetcher:async()=>response(data)});
  await client.get();data={...fixture,channel:{id:'UC0000000000000000000000'}};
  assert.equal((await client.get({force:true})).source,'fallback');
  data={error:'bad'};assert.equal((await client.get({force:true})).source,'fallback');
  await assert.rejects(createCreatorFeed(config,{now:()=>now,storage:null,fetcher:async()=>response(data)}).get());
});
test('cold HTTP failure rejects without exposing upstream details',async()=>{
  const client=createCreatorFeed(config,{storage:null,fetcher:async()=>({ok:false,status:503})});
  await assert.rejects(client.get(),{message:'CreatorPromote feed unavailable'});
});
test('fresh LIVE expires; cached video sections cannot claim LIVE',()=>{
  const feed=structuredClone(fixture);const timestamp=new Date(now).toISOString();
  feed.updatedAt=timestamp;feed.sections={videos:{status:'fresh',updatedAt:timestamp}};
  feed.liveStatus={checkedAt:timestamp,expiresAt:new Date(now+2700000).toISOString(),status:'live'};
  feed.latestLivestreams=[{id:'abcdefghijk',title:'Test live stream',live:true}];
  assert.equal(safeFeed(feed,now).latestLivestreams[0].live,true);
  assert.equal(safeFeed(feed,now+2700001).latestLivestreams[0].live,false);
  assert.equal(feed.latestLivestreams[0].live,true);
  feed.sections.videos.status='cached';
  assert.equal(safeFeed(feed,now).latestLivestreams[0].live,false);
});
test('empty and incomplete sections preserve channel data and available sections',async()=>{
  const feed={...fixture,latestLivestreams:[],sections:{videos:{status:'unavailable'}}};
  const {data}=await createCreatorFeed(config,{now:()=>now,storage:null,fetcher:async()=>response(feed)}).get();
  assert.deepEqual(data.latestLivestreams,[]);assert.deepEqual(data.channel,fixture.channel);
  assert.equal(data.collabs.length,fixture.collabs.length);
});

test('manual outage preserves fallback notice and page lifecycle resumes observation',async()=>{
  const {watchCreatorFeed}=await import('../js/hub-feed.mjs');
  const names=['fetch','localStorage','addEventListener','removeEventListener'];
  const descriptors=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const events=new Map();let offline=false,seen=[],watcher;
  const data=structuredClone(fixture);data.updatedAt=new Date().toISOString();
  globalThis.fetch=async()=>{if(offline)throw Error('offline');return response(data);};
  Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});
  globalThis.addEventListener=(type,fn)=>{events.set(type,fn);};
  globalThis.removeEventListener=type=>events.delete(type);
  const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
  try {
    watcher=watchCreatorFeed(config,value=>seen.push(value),()=>{});await settle();
    assert.equal(seen.at(-1).source,'network');offline=true;
    await watcher.refresh();await settle();assert.equal(seen.at(-1).source,'fallback');
    events.get('pagehide')();const count=seen.length;events.get('pageshow')();await settle();
    assert.ok(seen.length>count);assert.equal(seen.at(-1).source,'fallback');
  } finally {
    watcher?.dispose();
    for(const [name,descriptor] of descriptors)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
});

