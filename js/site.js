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
      showEmpty('No recent public livestreams are available. Browse the channel on YouTube for more.');
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
  const config = window.DDC_YOUTUBE_CONFIG;
  const adapterUrl = new URL('./hub-feed.mjs', document.currentScript.src).href;
  let lastSignature = '';
  let hasFeed = false;
  import(adapterUrl).then(({watchCreatorFeed}) => {
    watchCreatorFeed(config, ({data, source}) => {
      const videos = [...data.latestLivestreams].sort((a,b) => Number(b.live)-Number(a.live) ||
        Date.parse(b.startedAt || b.publishedAt || 0)-Date.parse(a.startedAt || a.publishedAt || 0));
      const saved = source === 'fallback' || data.sections?.videos?.status === 'cached';
      const signature = JSON.stringify([videos, data.sections?.videos, data.updatedAt, saved]);
      if (signature === lastSignature) return;
      lastSignature = signature;
      hasFeed = videos.length > 0;
      showVideos(videos, data.sections?.videos?.updatedAt || data.updatedAt);
      if (saved) status.textContent += ' · Showing saved results';
      if (data.sections?.videos?.status === 'unavailable') {
        showEmpty('The livestream feed is temporarily unavailable. Visit YouTube to see the latest streams.');
      }
    }, () => {
      if (hasFeed) status.textContent = 'Showing saved livestreams · Refresh temporarily unavailable';
      else showEmpty('The livestream feed could not load. Please try again later or visit YouTube.');
    });
  }).catch(() => showEmpty('The livestream feed could not load. Please try again later or visit YouTube.'));
})();
