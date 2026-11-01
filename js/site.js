/* Dream Drops Crew UI upgrades — no framework required. */
(() => {
  'use strict';
  const root = document.documentElement;
  const themes = [ ['storybook','Storybook'], ['sunlit','Sunlit'], ['moonlit','Moonlit'] ];
  const themeButton = document.getElementById('palette-toggle');
  const themeLabel = document.getElementById('palette-label');
  function setTheme(name) {
    const theme = themes.find(x => x[0] === name) || themes[0];
    root.dataset.theme = theme[0];
    if (themeLabel) themeLabel.textContent = theme[1];
    if (themeButton) themeButton.title = `Colour palette: ${theme[1]}. Click to change.`;
    try { localStorage.setItem('ddc-palette', theme[0]); } catch (_) {}
  }
  let saved = 'storybook';
  try { saved = localStorage.getItem('ddc-palette') || 'storybook'; } catch (_) {}
  setTheme(saved);
  themeButton?.addEventListener('click', () => {
    const index = themes.findIndex(x => x[0] === root.dataset.theme);
    setTheme(themes[(index + 1) % themes.length][0]);
  });
  const menuButton = document.getElementById('mobile-menu');
  const menu = document.getElementById('nav-links');
  menuButton?.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');menuButton?.setAttribute('aria-expanded','false');
  }));
  document.getElementById('year').textContent = String(new Date().getFullYear());

  // If the original js/index.js isn't present, keep the welcome slider functional.
  // If it IS present, let its own prevSlide/nextSlide and video galleries run unchanged.
  if (typeof window.nextSlide !== 'function' || typeof window.prevSlide !== 'function') {
    const slides = [
      {title:'Welcome!',desc:'Welcome to the Dream Drops Crew Website'},
      {title:'A forest full of stories',desc:'Meet the colourful characters and the adventures that bring them together.'},
      {title:'More laughs ahead',desc:'Catch the games, art, streams, and unexpected moments we share.'}
    ];
    let active = 0;
    const info = document.getElementById('info-slide');
    function update(direction) {
      active=(active+direction+slides.length)%slides.length;
      if (!info) return;
      const h = info.querySelector('h2,h3') || document.createElement('h3');
      const p = info.querySelector('p') || document.createElement('p');
      h.textContent=slides[active].title;p.textContent=slides[active].desc;
      if (!h.parentNode)info.append(h);if (!p.parentNode)info.append(p);
    }
    if(typeof window.nextSlide!=='function')window.nextSlide=()=>update(1);
    if(typeof window.prevSlide!=='function')window.prevSlide=()=>update(-1);
  }

  const grid = document.getElementById('livestream-grid');
  const status = document.getElementById('livestream-status');
  if (!grid || !status) return;
  const channel = 'https://www.youtube.com/@DreamDropsCrew/streams';
  function showEmpty(message) {
    status.textContent = 'See what the crew has been up to';
    grid.replaceChildren();
    const block = document.createElement('div');block.className='stream-empty';
    const symbol = document.createElement('div');symbol.className='empty-star';symbol.textContent='✧';symbol.setAttribute('aria-hidden','true');
    const h = document.createElement('h3');h.textContent='Our next adventures await';
    const p = document.createElement('p');p.textContent=message;
    const a = document.createElement('a');a.className='btn btn-primary';a.href=channel;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Visit our YouTube livestreams ↗';
    block.append(symbol,h,p,a);grid.append(block);
  }
  function stringDate(iso) {
    if (!iso) return 'Livestream';
    const d = new Date(iso);
    if(Number.isNaN(d.getTime()))return 'Livestream';
    return new Intl.DateTimeFormat('en', {year:'numeric',month:'short',day:'numeric'}).format(d);
  }
  const youtubeId = /^[a-zA-Z0-9_-]{11}$/;
  function showVideos(videos, updatedAt) {
    const good = videos.filter(v => v && youtubeId.test(v.id || '')).slice(0,6);
    if (!good.length) {
      showEmpty('The latest livestreams will appear here as soon as the YouTube API key is configured.');
      return;
    }
    grid.replaceChildren();
    good.forEach((video) => {
      const link = document.createElement('a');link.className='stream-card';link.href='https://www.youtube.com/watch?v='+encodeURIComponent(video.id);
      link.target='_blank';link.rel='noopener noreferrer';
      const preview=document.createElement('div');preview.className='stream-thumb';
      const img=document.createElement('img');img.src='https://i.ytimg.com/vi/'+encodeURIComponent(video.id)+'/hqdefault.jpg';
      img.alt='Thumbnail for '+(video.title||'Livestream');img.loading='lazy';
      const play=document.createElement('span');play.className='stream-play';play.textContent='▶';play.setAttribute('aria-hidden','true');
      preview.append(img,play);
      if(video.live===true){const badge=document.createElement('span');badge.className='stream-live';badge.textContent='● LIVE';preview.append(badge)}
      const body=document.createElement('div');body.className='stream-body';
      const title=document.createElement('h3');title.textContent=video.title||'Crew livestream';
      const meta=document.createElement('div');meta.className='stream-meta';
      const date=document.createElement('span');date.textContent=video.live?'Streaming now':stringDate(video.startedAt || video.publishedAt);
      const watch=document.createElement('span');watch.textContent='Watch ↗';
      meta.append(date,watch);body.append(title,meta);link.append(preview,body);grid.append(link);
    });
    status.textContent = `${good.length} recent public livestream${good.length===1?'':'s'}${updatedAt ? ' · Feed updated '+stringDate(updatedAt) : ''}`;
  }
  // Direct YouTube Data API v3 method - for a static site with NO .github workflow.
  // All API requests come from the visitor's browser. The key must be restricted
  // to the site's HTTP referrers AND the YouTube Data API to limit abuse.
  const config = window.DDC_YOUTUBE_CONFIG || {};
  const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
  const handle = typeof config.channelHandle === 'string' && config.channelHandle.trim()
    ? config.channelHandle.trim() : '@DreamDropsCrew';
  const configured = apiKey && !apiKey.includes('PASTE_YOUR_');
  const cacheKey = 'ddc-yt-livestreams-v3-' + handle;
  const cacheMs = 60 * 60 * 1000; // Each visitor refreshes at most hourly while browsing.
  const maxPages = 8; // Scan up to 400 public uploads if streams aren't frequent.

  function getCache() {
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (c && typeof c.fetchedAt === 'number' && Array.isArray(c.videos)) return c;
    } catch (_) {}
    return null;
  }
  function putCache(videos) {
    const cache = {fetchedAt: Date.now(), videos};
    try {localStorage.setItem(cacheKey, JSON.stringify(cache));} catch (_) {}
    return cache;
  }
  async function youtubeRequest(resource, parameters) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    Object.entries({...parameters, key:apiKey}).forEach(([name,value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name,String(value));
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try { response = await fetch(url.toString(), {signal:controller.signal}); }
    finally { clearTimeout(timeout); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const detail = data.error?.message || `HTTP ${response.status}`;
      throw new Error(`YouTube API: ${detail}`);
    }
    return data;
  }

  // 1 quota unit: resolve the channel handle to its official uploads playlist.
  // Checking the uploads playlist rather than search.list is much cheaper
  // and avoids treating ordinary uploads or scheduled events as livestreams.
  async function loadLatestLivestreams() {
    const channels = await youtubeRequest('channels', {part:'contentDetails', forHandle:handle});
    const playlistId = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) throw new Error('The public uploads playlist was not found for '+handle);
    const streams = [];
    const seen = new Set();
    let nextPageToken = '';
    for (let i = 0; i < maxPages && streams.length < 6; i++) {
      // 1 quota unit/page: scan 50 uploaded video IDs per page.
      const playlist = await youtubeRequest('playlistItems', {
        part:'contentDetails', playlistId, maxResults:50, pageToken:nextPageToken
      });
      const ids = (playlist.items || []).map(v => v.contentDetails?.videoId)
        .filter(id => youtubeId.test(id || '') && !seen.has(id));
      ids.forEach(id => seen.add(id));
      if (ids.length) {
        // 1 quota unit/batch: check the actual liveStreamingDetails for each video.
        const details = await youtubeRequest('videos', {
          part:'snippet,liveStreamingDetails', id:ids.join(',')
        });
        for (const video of details.items || []) {
          const live = video.liveStreamingDetails;
          // Excludes ordinary uploaded videos AND upcoming, not-yet-started streams.
          if (!live?.actualStartTime || !youtubeId.test(video.id || '')) continue;
          streams.push({
            id:video.id,
            title:video.snippet?.title || 'Dream Drops Crew livestream',
            publishedAt:video.snippet?.publishedAt || '',
            startedAt:live.actualStartTime,
            live:!live.actualEndTime && video.snippet?.liveBroadcastContent === 'live'
          });
        }
      }
      nextPageToken = playlist.nextPageToken || '';
      if (!nextPageToken) break;
    }
    streams.sort((a,b) => (Number(b.live)-Number(a.live)) ||
      (Date.parse(b.startedAt || b.publishedAt) - Date.parse(a.startedAt || a.publishedAt)));
    return streams.slice(0,6);
  }

  let refreshBusy = false;
  async function refreshStreamFeed() {
    if (refreshBusy) return;
    const saved = getCache();
    // Cache prevents repeated API calls whenever the visitor switches pages.
    if (saved && Date.now()-saved.fetchedAt < cacheMs) {
      showVideos(saved.videos, new Date(saved.fetchedAt).toISOString());
      return;
    }
    if (!configured) {
      if(saved?.videos.length) showVideos(saved.videos,new Date(saved.fetchedAt).toISOString());
      else showEmpty('Connect your YouTube Data API key in js/youtube-config.js to display the latest livestreams here.');
      return;
    }
    refreshBusy = true;
    if(!saved) status.textContent = 'Checking YouTube for recent livestreams…';
    try {
      const videos=await loadLatestLivestreams();
      const fresh=putCache(videos);
      showVideos(fresh.videos,new Date(fresh.fetchedAt).toISOString());
      if (!videos.length) showEmpty('No public completed or currently live streams were found in the channel’s most recent uploads. Browse YouTube directly to see everything.');
    } catch(error) {
      console.warn('Dream Drops Crew livestream feed error:',error);
      if(saved?.videos.length) {
        showVideos(saved.videos,new Date(saved.fetchedAt).toISOString());
        status.textContent += ' · Showing saved results (YouTube is temporarily unavailable)';
      } else {
        showEmpty('The live feed could not load. Check your domain-restricted API key, quota, and internet connection, or visit YouTube directly.');
      }
    } finally {refreshBusy=false;}
  }
  refreshStreamFeed();
  // Automatically check again while the page stays open; hidden tabs skip requests.
  setInterval(() => {if(!document.hidden) refreshStreamFeed();}, cacheMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshStreamFeed();
  });
})();
