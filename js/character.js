/* Improved storybook slider, preserves all seven original HTML cards and descriptions. */
(() => {
  'use strict';
  const deck = document.querySelector('#character-section');
  if (!deck) return;
  const cards = [...deck.querySelectorAll('.glass-card')];
  if (!cards.length) return;
  let currentIndex = 0;
  const controls = document.createElement('div');
  controls.className = 'character-controls';
  controls.innerHTML = '<button type="button" class="character-arrow character-prev" aria-label="Previous character">‹</button><span class="character-count" aria-live="polite"></span><div class="character-dots" aria-label="Select a character"></div><button type="button" class="character-arrow character-next" aria-label="Next character">›</button>';
  deck.insertAdjacentElement('afterend', controls);
  const dots = controls.querySelector('.character-dots');
  const count = controls.querySelector('.character-count');
  cards.forEach((card, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';dot.className='character-dot';
    dot.setAttribute('aria-label', 'Show character '+(index+1)+': '+(card.querySelector('h2')?.textContent||''));
    dot.addEventListener('click', () => showCard(index));
    dots.append(dot);
    const img = card.querySelector('img');
    if (img) {
      img.loading = index === 0 ? 'eager' : 'lazy';
      img.addEventListener('error', () => {
        const backup = document.createElement('div');backup.className='char-fallback';
        backup.setAttribute('role', 'img');backup.setAttribute('aria-label', img.alt || 'Character');
        backup.textContent = '✦';img.replaceWith(backup);
      }, {once:true});
      if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
    }
  });
  function showCard(index) {
    currentIndex = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      const shown = i === currentIndex;
      card.classList.toggle('active', shown);
      card.hidden = !shown;
      card.setAttribute('aria-hidden', String(!shown));
      card.setAttribute('tabindex', shown ? '0' : '-1');
    });
    [...dots.children].forEach((dot,i)=>dot.setAttribute('aria-current', String(i===currentIndex)));
    count.textContent = `${currentIndex + 1} / ${cards.length}`;
  }
  controls.querySelector('.character-prev').addEventListener('click',()=>showCard(currentIndex-1));
  controls.querySelector('.character-next').addEventListener('click',()=>showCard(currentIndex+1));
  deck.tabIndex = 0;
  deck.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();showCard(currentIndex+(event.key==='ArrowRight'?1:-1));
    }
  });
  let startX = null;
  deck.addEventListener('touchstart',e=>{startX=e.changedTouches[0]?.screenX??null;},{passive:true});
  deck.addEventListener('touchend',e=>{
    if(startX===null)return;
    const distance=(e.changedTouches[0]?.screenX??startX)-startX;startX=null;
    if(Math.abs(distance)>60)showCard(currentIndex+(distance<0?1:-1));
  },{passive:true});
  showCard(0);
})();
