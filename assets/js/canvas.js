(function(){
  const wrap = document.querySelector('.content--canvas');
  if(!wrap) return;
  const c = document.createElement('canvas');
  wrap.appendChild(c);
  const ctx = c.getContext('2d', {alpha:true, desynchronized:true});
  let dpr = Math.min(window.devicePixelRatio||1, 2);
  let w=0, h=0;

  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CFG = {
    grid: 56,
    pipes: prefersReduced ? 0 : 10,
    speed: 180,
    turnProb: 0.35,
    maxSegments: 16,
    thickness: [1.2, 2.2],
    glow: 6,
    colors: ['#7701fe','#e70d84'],
    alpha: 0.55
  };

  function resize(){
    const cw = wrap.clientWidth || window.innerWidth;
    const ch = wrap.clientHeight || window.innerHeight;
    w = cw; h = ch;
    c.width = Math.max(1, Math.round(cw*dpr));
    c.height= Math.max(1, Math.round(ch*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  new ResizeObserver(resize).observe(wrap); resize();

  if (CFG.pipes === 0) return; // respect reduced motion

  const DIRS = {E:[1,0], W:[-1,0], N:[0,-1], S:[0,1]};
  const ORTHO = {E:['N','S'], W:['N','S'], N:['E','W'], S:['E','W']};
  const ALL = Object.keys(DIRS);
  const rand = (a,b)=> a + Math.random()*(b-a);
  const pick = arr => arr[(Math.random()*arr.length)|0];

  class Pipe{
    constructor(){ this.reset(true); }
    reset(random=true){
      const g=CFG.grid; const cols=Math.max(1,Math.floor(w/g)); const rows=Math.max(1,Math.floor(h/g));
      const cx = random ? (Math.random()*cols|0) : (cols/2|0);
      const cy = random ? (Math.random()*rows|0) : (rows/2|0);
      this.dir = pick(ALL);
      this.head = {x: cx*g+g/2, y: cy*g+g/2};
      this.points = [{...this.head}];
      this.target = this.nextTarget(this.dir);
      this.thickness = rand(CFG.thickness[0], CFG.thickness[1]);
      this.colorA = CFG.colors[0];
      this.colorB = CFG.colors[1];
    }
    nextTarget(dir){
      const g=CFG.grid; const [dx,dy]=DIRS[dir];
      let nx=this.head.x + dx*g, ny=this.head.y + dy*g;
      if (nx < 0) nx = w - g/2; if (nx > w) nx = g/2;
      if (ny < 0) ny = h - g/2; if (ny > h) ny = g/2;
      return {x:nx,y:ny};
    }
    maybeTurn(){
      const cands = ORTHO[this.dir];
      const bias=[]; const x=this.head.x, y=this.head.y;
      if (x < w*0.2) bias.push('E'); if (x > w*0.8) bias.push('W');
      if (y < h*0.2) bias.push('S'); if (y > h*0.8) bias.push('N');
      let dir=this.dir;
      if (Math.random() < CFG.turnProb) dir = pick(cands);
      else if (bias.length){ const b=pick(bias); if (cands.includes(b)) dir=b; }
      this.dir = dir;
    }
    advance(dist){
      while(dist>0){
        const dx=this.target.x-this.head.x, dy=this.target.y-this.head.y;
        const rem=Math.hypot(dx,dy);
        if (rem <= dist){
          this.head.x=this.target.x; this.head.y=this.target.y;
          this.points.push({...this.head});
          if (this.points.length > CFG.maxSegments) this.points.shift();
          this.maybeTurn();
          this.target=this.nextTarget(this.dir);
          dist -= rem;
        } else {
          const t=dist/rem; this.head.x+=dx*t; this.head.y+=dy*t; dist=0;
        }
      }
    }
    draw(ctx){
      if (this.points.length<1) return;
      ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.shadowBlur=CFG.glow; ctx.globalCompositeOperation='lighter';
      const tail=this.points[0], head=this.head;
      const g=ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      g.addColorStop(0,this.colorB); g.addColorStop(1,this.colorA);
      ctx.strokeStyle=g; ctx.lineWidth=this.thickness;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y);
      for(let i=1;i<this.points.length;i++) ctx.lineTo(this.points[i].x,this.points[i].y);
      ctx.lineTo(head.x, head.y); ctx.globalAlpha = (CFG.alpha!==undefined?CFG.alpha:1); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.shadowBlur=0; ctx.globalCompositeOperation='source-over';
    }
  }

  let pipes = Array.from({length:CFG.pipes}, ()=> new Pipe());
  let last = performance.now();
  let running = true;

  function frame(now){
    if (!running) { requestAnimationFrame(frame); return; }
    const dt = Math.min(100, now-last)/1000; last = now;
    ctx.globalCompositeOperation='destination-out';
    const fade = Math.min(0.14, 0.06 + dt*0.25);
    ctx.fillStyle=`rgba(0,0,0,${fade})`;
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';

    const dist = CFG.speed * dt;
    for(const p of pipes){ p.advance(dist); p.draw(ctx); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange',()=>{ running = (document.visibilityState==='visible'); });
})();

