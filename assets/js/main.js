// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Title utility to reflect live state
const ORIGINAL_TITLE = document.title;
function setLiveTitle(isLive){ document.title = isLive ? '🔴 LIVE — Winzi' : ORIGINAL_TITLE; }

(function setupEmbeds(){
  const twitchBtn = document.getElementById('tab-twitch');
  const kickBtn   = document.getElementById('tab-kick');
  const twitchPanel = document.getElementById('panel-twitch');
  const kickPanel   = document.getElementById('panel-kick');
  const offlineBox  = document.getElementById('offline-box');
  const embedErrorBox = document.getElementById('embed-error');
  const btnTwitch = document.getElementById('btn-twitch');
  const btnKick   = document.getElementById('btn-kick');
  const heroCard  = document.getElementById('hero-card');
  const twitchHost = document.getElementById('twitch-host');
  const liveIndicator = document.getElementById('live-indicator');

  let state = {
    twitchLive:false, kickLive:false,
    current:'twitch',
    userInteracted:false,
    heroInView:true,
    kickSavedSrc:""
  };

  let twitchPlayer = null;
  let twitchRO = null;
  let es = null;
  let pollingTimer = null;

  // Helpers
  const getKickEl = () => document.getElementById('kick-player');
  const buildKickEl = () => {
    const el = document.createElement('iframe');
    el.id = 'kick-player';
    el.className = 'player';
    el.title = 'Kick Player';
    el.allowFullscreen = true;
    el.setAttribute('allow','autoplay; fullscreen; picture-in-picture');
    el.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
    el.setAttribute('loading','lazy');
    el.setAttribute('fetchpriority','high');
    return el;
  };

  function canEmbedTwitch(){
    const proto = location.protocol, host = location.hostname;
    if (proto === 'https:') return true;
    if (proto === 'http:' && (host === 'localhost' || host === '127.0.0.1')) return true;
    return false;
  }
  function twitchParents(){
    const meta = document.querySelector('meta[name="twitch-parents"]')?.content || '';
    const p = meta.split(',').map(s=>s.trim()).filter(Boolean);
    const h = location.hostname; if (h && !p.includes(h)) p.push(h);
    ['localhost','127.0.0.1'].forEach(d=>{ if(!p.includes(d)) p.push(d); });
    return p;
  }
  function initTwitch(muted){
    if (!canEmbedTwitch()) return;
    if (!window.Twitch || !window.Twitch.Player) return;
    if (twitchPlayer) { try { twitchPlayer.setMuted(!!muted); } catch(e){} return; }

    const make = () => {
      const w = twitchHost.clientWidth || 1280;
      const h = Math.round(w * 9/16);
      twitchPlayer = new Twitch.Player('twitch-host', {
        channel: 'winzilp',
        parent: twitchParents(),
        autoplay: true,
        muted: !!muted,
        width: w,
        height: h
      });
      twitchPlayer.addEventListener(Twitch.Player.READY, ()=>{
        twitchHost.classList.add('show');
        setTimeout(()=> window.dispatchEvent(new Event('resize')), 50);
      });
      if ('ResizeObserver' in window && !twitchRO){
        twitchRO = new ResizeObserver(()=> window.dispatchEvent(new Event('resize')));
        twitchRO.observe(twitchHost);
      }
    };
    requestAnimationFrame(()=> requestAnimationFrame(make));
  }
  function playTwitch(withAudio){
    if (!twitchPlayer) { initTwitch(!withAudio); }
    try {
      if (twitchPlayer){
        twitchPlayer.setMuted(!withAudio);
        twitchPlayer.play();
        setTimeout(()=> window.dispatchEvent(new Event('resize')), 0);
      }
    } catch(e){}
  }
  function pauseTwitch(){ try { twitchPlayer && twitchPlayer.pause(); } catch(e){} }

  function kickURL(muted){
    const u = new URL('https://player.kick.com/winzi');
    u.searchParams.set('autoplay','true');
    u.searchParams.set('muted', String(!!muted));
    u.searchParams.set('playsinline','1');
    return u.toString();
  }
  function resumeKick(withAudio){
    let el = getKickEl();
    if (!el){ el = buildKickEl(); kickPanel.appendChild(el); }
    const want = state.kickSavedSrc || kickURL(!withAudio ? true : false);
    if (el.src !== want) el.src = want;
    requestAnimationFrame(()=> el.classList.add('show'));
  }
  function pauseKick(){
    const el = getKickEl();
    if (!el) return;
    if (el.src && !el.src.startsWith('about:')) state.kickSavedSrc = el.src;
    try { el.src = 'about:blank'; } catch(e){}
    setTimeout(()=>{
      if (el.isConnected) el.remove();
      if (!getKickEl()) kickPanel.appendChild(buildKickEl()); // placeholder keeps layout
    },0);
  }

  let rafId=null;
  function scheduleRender(){ if (rafId) return; rafId = requestAnimationFrame(()=>{ rafId=null; render(); }); }

  function setTabsA11y(){
    const isT = state.current === 'twitch';
    twitchBtn.tabIndex = (twitchBtn.disabled? -1 : (isT? 0 : -1));
    kickBtn.tabIndex   = (kickBtn.disabled? -1 : (!isT? 0 : -1));
  }

  function render(){
    const tOff = !state.twitchLive, kOff = !state.kickLive;

    twitchBtn.classList.toggle('online', !tOff);
    kickBtn.classList.toggle('online', !kOff);
    twitchBtn.classList.toggle('offline', tOff);
    kickBtn.classList.toggle('offline', kOff);
    twitchBtn.disabled = tOff; twitchBtn.setAttribute('aria-disabled', String(tOff));
    kickBtn.disabled   = kOff;   kickBtn.setAttribute('aria-disabled', String(kOff));

    btnTwitch.classList.toggle('live', state.twitchLive);
    btnKick.classList.toggle('live', state.kickLive);

    const showT = (state.current === 'twitch' && state.twitchLive && state.heroInView);
    const showK = (state.current === 'kick'   && state.kickLive   && state.heroInView);

    twitchPanel.hidden = !showT;
    kickPanel.hidden   = !showK;

    const allowAudio = state.userInteracted && document.visibilityState==='visible' && state.heroInView;

    if (showT && canEmbedTwitch()) { initTwitch(!allowAudio); playTwitch(allowAudio); } else { pauseTwitch(); }
    if (showK) { resumeKick(allowAudio); } else { pauseKick(); }

    const noOneLive = !state.twitchLive && !state.kickLive;
    offlineBox.classList.toggle('hidden', !noOneLive);

    const showEmbedError = showT && !canEmbedTwitch();
    embedErrorBox.classList.toggle('show', showEmbedError);

    twitchBtn.setAttribute('aria-selected', String(state.current === 'twitch' && state.twitchLive));
    kickBtn.setAttribute('aria-selected', String(state.current === 'kick' && state.kickLive));

    if (showT) twitchHost.classList.add('show'); else twitchHost.classList.remove('show');
    const kEl = getKickEl(); if (kEl) { if (showK) kEl.classList.add('show'); else kEl.classList.remove('show'); }

    if (state.current === 'twitch'){
      const el = getKickEl();
      if (el && el.src && !el.src.startsWith('about:')) pauseKick();
    }
    if (twitchRO && !showT){ try{ twitchRO.disconnect(); twitchRO=null; }catch(e){} }

    // Live indicator + Title
    const isLive = (state.twitchLive || state.kickLive);
    setLiveTitle(isLive);
    if (liveIndicator){
      liveIndicator.hidden = !isLive;
      liveIndicator.setAttribute('data-on', String(isLive));
    }

    setTabsA11y();
  }

  function show(which){
    if (which === 'twitch' && !state.twitchLive) return;
    if (which === 'kick'   && !state.kickLive)   return;
    state.current = which; scheduleRender();
  }

  // Mouse / Touch
  twitchBtn.addEventListener('click', ()=>{ state.userInteracted = true; show('twitch'); }, {passive:true});
  kickBtn.addEventListener('click',  ()=>{ state.userInteracted = true; show('kick');  }, {passive:true});
  heroCard.addEventListener('pointerdown', ()=>{ state.userInteracted = true; }, {passive:true});

  // Keyboard navigation for tabs
  function onTabKeydown(e){
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
      e.preventDefault();
      if (e.currentTarget === twitchBtn && !kickBtn.disabled && state.kickLive){ kickBtn.focus(); show('kick'); return; }
      if (e.currentTarget === kickBtn && !twitchBtn.disabled && state.twitchLive){ twitchBtn.focus(); show('twitch'); return; }
    }
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); (e.currentTarget === twitchBtn ? show('twitch') : show('kick')); }
  }
  twitchBtn.addEventListener('keydown', onTabKeydown);
  kickBtn.addEventListener('keydown', onTabKeydown);

  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState !== 'visible'){ pauseTwitch(); pauseKick(); stopSSE(); }
    else { maybeStartLive(); }
    scheduleRender();
  });

  const io = new IntersectionObserver((entries)=>{
    const e = entries[0];
    state.heroInView = e && e.isIntersecting && e.intersectionRatio >= 0.5;
    if (!state.heroInView){ pauseTwitch(); pauseKick(); stopSSE(); }
    else { maybeStartLive(); }
    scheduleRender();
  }, { threshold:[0,0.5,1], rootMargin:"0px" });
  io.observe(heroCard);

  render();

  const STATUS_ENDPOINT = document.querySelector('meta[name="status-endpoint"]')?.content || '';
  const STATUS_SSE      = document.querySelector('meta[name="status-sse"]')?.content || '';

  function applyLive(t,k){
    const prev = {t:state.twitchLive,k:state.kickLive,cur:state.current};
    state.twitchLive = !!t; state.kickLive = !!k;
    if (state.twitchLive && canEmbedTwitch()) state.current = 'twitch';
    else if (state.kickLive) state.current = 'kick';
    else state.current = 'twitch';
    if (prev.t!==state.twitchLive || prev.k!==state.kickLive || prev.cur!==state.current) scheduleRender();
  }

  function supportsSSE(){ return typeof window.EventSource !== 'undefined'; }

  function startSSE(){
    if (es || !supportsSSE() || !STATUS_SSE) return;
    es = new EventSource(STATUS_SSE);
    es.addEventListener('message', ev => { try{ const d=JSON.parse(ev.data); applyLive(!!d.twitch, !!d.kick); }catch{} });
    es.addEventListener('error', ()=>{ stopSSE(); startPolling(true); });
  }
  function stopSSE(){ if (es){ try{ es.close(); }catch{} es=null; } }

  function startPolling(immediate=false){
    clearTimeout(pollingTimer);
    const TTL_VISIBLE = 10000, TTL_HIDDEN = 45000;
    let etag='', last={t:false,k:false};
    const fetchStatus = async ()=>{
      try{
        const h = etag ? {'If-None-Match': etag} : {};
        const res = await fetch(STATUS_ENDPOINT, {headers:h, cache:'no-store'});
        if (res.status === 304) return last;
        if (!res.ok) return null;
        etag = res.headers.get('ETag') || '';
        const j = await res.json();
        last = {t:!!j.twitch,k:!!j.kick};
        return last;
      }catch{return null}
    };
    const tick = async ()=>{
      clearTimeout(pollingTimer);
      const r = await fetchStatus();
      if (r) applyLive(r.t, r.k);
      const busy = (state.twitchLive || state.kickLive);
      const base = (document.visibilityState==='visible'?TTL_VISIBLE:TTL_HIDDEN);
      const next = Math.max(6000, base * (busy?0.6:1.2));
      pollingTimer = setTimeout(tick, next);
    };
    if (immediate) tick(); else pollingTimer = setTimeout(tick, 1);
  }
  function stopPolling(){ clearTimeout(pollingTimer); pollingTimer=null; }

  function maybeStartLive(){
    const liveParam = new URLSearchParams(location.search).get('live');
    if (liveParam) {
      const map = {twitch:[true,false],kick:[false,true],both:[true,true],none:[false,false]};
      if (map[liveParam]) { applyLive(map[liveParam][0], map[liveParam][1]); return; }
    }
    if (!STATUS_ENDPOINT && !STATUS_SSE) return;

    const visible = document.visibilityState==='visible' && state.heroInView;
    if (visible){
      stopPolling();
      if (STATUS_SSE) startSSE(); else startPolling(true);
    } else {
      stopSSE();
      startPolling(false);
    }
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => maybeStartLive(), { timeout: 800 });
  } else {
    setTimeout(maybeStartLive, 500);
  }
})();

