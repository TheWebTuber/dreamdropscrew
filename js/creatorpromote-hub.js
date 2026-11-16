/** Shared, dependency-free ESM client. Import locally or from the Hub. */
export const LIVE_MAX_AGE_MS = 45 * 60 * 1000;
const clone = value => JSON.parse(JSON.stringify(value));
const validTime = (value, now, maxAge) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= now && now - Date.parse(value) <= maxAge;
export function validateFeed(data, slug) {
  if (!data || data.version !== 1 || data.slug !== slug || !/^[a-z0-9][a-z0-9-]{0,55}$/.test(slug) ||
      !data.channel || typeof data.channel.id !== 'string' || !data.channel.id || !Number.isFinite(Date.parse(data.updatedAt)) ||
      !['uploads','replays','latestVideos','latestLivestreams','latestReplays','collabs'].every(k => Array.isArray(data[k]) && data[k].every(v => v && /^[A-Za-z0-9_-]{11}$/.test(v.id)))) {
    throw Error('Invalid CreatorPromote feed');
  }
  return data;
}
/** Pure view: never changes cached observations or invents an end time. */
export function safeFeed(data, now = Date.now(), maxAge = LIVE_MAX_AGE_MS) {
  const result = clone(data);
  const limit = Math.min(LIVE_MAX_AGE_MS, Math.max(0, Number(maxAge) || 0));
  const checked = data.liveStatus?.checkedAt || data.sections?.videos?.updatedAt || data.updatedAt;
  const expires = data.liveStatus?.expiresAt;
  const fresh = validTime(checked, now, limit) && validTime(data.updatedAt, now, Infinity) &&
    (!expires || (Number.isFinite(Date.parse(expires)) && now < Date.parse(expires))) &&
    data.sections?.videos?.status !== 'cached' && data.sections?.videos?.status !== 'unavailable';
  if (!fresh) {
    result.live = null; result.liveChecked = false;
    result.liveStatus = {...result.liveStatus, status:'unknown',video:null,checkedAt:checked, note:'Live observation is stale or unavailable; check YouTube.'};
  }
  // Each section can be older than the channel-level timestamp.
  for (const key of ['uploads','replays','latestVideos','latestLivestreams','latestReplays','catalog','collabs','legacyCollabs']) {
    const section = ['collabs','legacyCollabs'].includes(key) ? 'collabs' : 'videos';
    const meta = data.sections?.[section];
    const sectionFresh = fresh && (!meta || (meta.status === 'fresh' && validTime(meta.updatedAt,now,limit)));
    if (!sectionFresh) for (const item of result[key] || []) {
      item.live = false; if ('isLive' in item) item.isLive = false;
      if (item.snippet?.liveBroadcastContent === 'live') item.snippet.liveBroadcastContent = 'none';
      item.liveStatus = 'unknown';
    }
  }
  for (const source of Object.values(result.collabSources || {})) {
    if (source.status !== 'fresh' || !validTime(source.updatedAt, now, limit)) {
      for (const item of source.items || []) { item.live=false; item.liveStatus='unknown'; }
    }
  }
  result.freshness = {liveFresh:fresh, observedAt:checked, evaluatedAt:new Date(now).toISOString()};
  return result;
}
export function createHubClient({baseUrl='https://api.creatorpromote.com', fetcher=globalThis.fetch,
  storage, now=Date.now, cacheMs=5*60*1000, timeoutMs=12000, maxLiveAgeMs=LIVE_MAX_AGE_MS}={}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Hub URL must be HTTPS');
  if (storage === undefined) { try { storage=globalThis.localStorage; } catch { storage=null; } }
  const ttl = Math.min(15*60*1000,Math.max(0,Number(cacheMs)||0));
  const pending=new Map(), memory=new Map();
  const key=s=>'creatorpromote:hub:v1:'+base.href+':'+s;
  function saved(slug) {
    if (memory.has(slug)) return memory.get(slug);
    try { const entry=JSON.parse(storage?.getItem(key(slug))||'null');
      if(entry && Number.isFinite(entry.fetchedAt)) {validateFeed(entry.data,slug);memory.set(slug,entry);return entry;}
    } catch {} return null;
  }
  const view=(entry,source)=>({data:safeFeed(entry.data,now(),maxLiveAgeMs),source,fetchedAt:entry.fetchedAt});
  async function get(slug,{force=false}={}) {
    if(!/^[a-z0-9][a-z0-9-]{0,55}$/.test(slug)) throw Error('Invalid creator slug');
    if(pending.has(slug)) return pending.get(slug);
    const cached=saved(slug);
    if(!force && cached && now()>=cached.fetchedAt && now()-cached.fetchedAt<ttl) return view(cached,'cache');
    const task=(async()=>{
      const controller=new AbortController();let timer;
      try {
        const request=(async()=>{const response=await fetcher(base.href.replace(/\/$/,'')+'/data/'+slug+'.json',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-cache'});
          if(!response.ok)throw Error('Hub HTTP '+response.status);
          return validateFeed(await response.json(),slug);})();
        const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Hub request timed out'));},timeoutMs);});
        const data=await Promise.race([request,deadline]);
        if(Date.parse(data.updatedAt)>now())throw Error('Feed timestamp is in the future');
        if(cached && Date.parse(data.updatedAt)<Date.parse(cached.data.updatedAt))return view(cached,'fallback');
        const entry={data,fetchedAt:now()};memory.set(slug,entry);
        try {storage?.setItem(key(slug),JSON.stringify(entry));} catch {}
        return view(entry,'network');
      } catch {
        if(cached)return view(cached,'fallback');
        throw Error('CreatorPromote feed unavailable');
      } finally {clearTimeout(timer);}
    })();pending.set(slug,task);
    try{return await task;}finally{pending.delete(slug);}
  }
  /** Expires visible LIVE independently of requests; unsubscribe on page teardown. */
  function subscribe(slug,onData,onError=()=>{}) {
    let stopped=false,expiry,last;
    const emit=value=>{
      if(stopped)return;
      last={...value,data:safeFeed(value.data,now(),maxLiveAgeMs)};
      clearTimeout(expiry);onData(last);
      const checked=Date.parse(last.data.freshness.observedAt);
      const deadline=Math.min(checked+Math.min(maxLiveAgeMs,LIVE_MAX_AGE_MS),Date.parse(last.data.liveStatus?.expiresAt)||Infinity);
      if(last.data.freshness.liveFresh && Number.isFinite(deadline))expiry=setTimeout(()=>emit(last),Math.max(1,deadline-now()+1));
    };
    const tick=()=>{if(stopped)return;if(last)emit(last);get(slug).then(emit).catch(error=>{if(!stopped)onError(error);});};
    tick();const timer=setInterval(tick,30000);
    globalThis.document?.addEventListener('visibilitychange',tick);
    return ()=>{stopped=true;clearInterval(timer);clearTimeout(expiry);globalThis.document?.removeEventListener('visibilitychange',tick);};
  }
  return {get,subscribe};
}
