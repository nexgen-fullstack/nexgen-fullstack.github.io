/* ==========================================================================
   NEXGEN — Oleh Ivanytskyi · interactions
   Vanilla JS + WebGL. Content works without JS; everything here is enhancement.
   ========================================================================== */
(() => {
  'use strict';
  window.__nx = true;

  const doc = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let T = {};
  try { T = JSON.parse(($('#i18n') || {}).textContent || '{}'); } catch (e) { /* keep defaults */ }

  // assets/ folder, resolved from this script's own URL so /pt/ and /ua/ pages work too
  const ASSETS = (() => {
    try { return new URL('../', document.currentScript.src).href; } catch (e) { return 'assets/'; }
  })();

  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[nexgen]', name, e); } };

  /* ---------- frame loop, scroll state & measuring ---------- */
  const S = { y: window.scrollY, vy: 0, vh: window.innerHeight, vw: window.innerWidth };
  const frames = [];
  const layouts = [];
  const measures = [];
  const onFrame = fn => frames.push(fn);
  const onLayout = fn => { layouts.push(fn); fn(); };
  const onMeasure = fn => { measures.push(fn); fn(); };
  const docTop = el => el.getBoundingClientRect().top + window.scrollY;
  const measure = () => {
    S.vh = window.innerHeight; S.vw = window.innerWidth;
    layouts.forEach(f => safe('layout', f));
    measures.forEach(f => safe('measure', f));
  };

  let lenis = null;
  if (!reduce && fine && window.Lenis) {
    safe('lenis', () => { lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true }); });
  }

  const loop = now => {
    if (lenis) lenis.raf(now);
    const y = window.scrollY;
    S.vy = y - S.y; S.y = y;
    for (let i = 0; i < frames.length; i++) frames[i](now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  let rT;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      // mobile browsers fire resize when the address bar hides — skip heavy work if width is unchanged
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - S.vh) < 120) { S.vh = window.innerHeight; return; }
      lastW = window.innerWidth;
      measure();
    }, 160);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);

  const lock = on => {
    if (lenis) on ? lenis.stop() : lenis.start();
    doc.classList.toggle('is-locked', on);
  };

  /* ---------- text splitting ---------- */
  function split(el, mode) {
    if (el.classList.contains('is-split')) return;
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let i = 0;
    const build = (node, into) => {
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { into.append(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'wd';
            (mode === 'words' ? [part] : Array.from(part)).forEach(c => {
              const m = document.createElement('span');
              const s = document.createElement('span');
              m.className = 'sw';
              s.className = mode === 'words' ? 'si' : 'si ch';
              s.style.setProperty('--i', i++);
              s.textContent = c;
              m.append(s); w.append(m);
            });
            into.append(w);
          });
        } else if (n.nodeType === 1) {
          const c = n.cloneNode(false);
          into.append(c); build(n, c);
        }
      });
    };
    const box = document.createElement('span');
    box.setAttribute('aria-hidden', 'true');
    build(el, box);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = label;
    el.replaceChildren(sr, box);
    el.classList.add('is-split');
  }

  function splitPlain(el) {
    const out = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'wd';
            Array.from(part).forEach(c => {
              const s = document.createElement('span');
              s.className = 'c'; s.textContent = c;
              w.append(s); out.push(s);
            });
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return out;
  }

  /* fit a single-line word to its container width */
  function fit(el, box) {
    el.style.fontSize = '100px';
    const w = el.getBoundingClientRect().width;
    const target = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
    if (w > 0 && target > 0) el.style.fontSize = (100 * target / w).toFixed(2) + 'px';
  }

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

  safe('split', () => {
    $$('[data-split]').forEach(el => { split(el, el.dataset.split); io.observe(el); });
    $$('[data-reveal]').forEach(el => io.observe(el));
    // long words (PT/UA) must never push giant headings past the screen edge
    const giants = $$('.h-giant, .contact__title');
    onLayout(() => giants.forEach(el => {
      el.style.fontSize = '';
      const over = el.scrollWidth - el.clientWidth;
      if (over > 1) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * el.clientWidth / el.scrollWidth * 0.98).toFixed(1) + 'px';
    }));
  });

  /* ---------- intro / loader ---------- */
  function ready() { doc.classList.add('is-ready'); }
  safe('intro', () => {
    const loader = $('.loader');
    let seen = false;
    try { seen = sessionStorage.getItem('nx-intro') === '1'; } catch (e) { /* private mode */ }
    if (!loader || reduce || seen) {
      if (loader) loader.remove();
      requestAnimationFrame(() => requestAnimationFrame(ready));
      return;
    }
    try { sessionStorage.setItem('nx-intro', '1'); } catch (e) { /* ignore */ }
    lock(true);
    if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
    const num = $('.loader__count span', loader);
    const bar = $('.loader__bar i', loader);
    const t0 = performance.now();
    const dur = 1250;
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; });
    const step = now => {
      let p = clamp((now - t0) / dur, 0, 1);
      if (!loaded && now - t0 < 2800) p = Math.min(p, 0.92);
      const e = 1 - Math.pow(1 - p, 3);
      num.textContent = Math.round(e * 100);
      bar.style.transform = 'scaleX(' + e.toFixed(3) + ')';
      if (p < 1) { requestAnimationFrame(step); return; }
      setTimeout(() => {
        loader.classList.add('is-done');
        lock(false);
        setTimeout(ready, 280);
        setTimeout(() => loader.remove(), 1200);
      }, 160);
    };
    requestAnimationFrame(step);
  });

  /* ---------- navigation ---------- */
  const nav = $('.nav');
  const burger = $('.burger');
  const menu = $('#menu');
  let menuOpen = false;

  function setMenu(open) {
    if (!menu || !burger) return;
    menuOpen = open;
    doc.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? (T.menu_close || 'Close menu') : (T.menu_open || 'Open menu'));
    menu.inert = !open;
    menu.setAttribute('aria-hidden', String(!open));
    lock(open);
    if (open) nav.classList.remove('is-hidden');
  }

  safe('nav', () => {
    if (burger) burger.addEventListener('click', () => setMenu(!menuOpen));
    document.addEventListener('click', e => {
      const l = e.target.closest('.lang a[hreflang]');
      if (l) { try { localStorage.setItem('nx-lang', l.getAttribute('hreflang')); } catch (er) { /* private mode */ } }
    });
    const dd = $('.lang-dd');
    if (dd) {
      document.addEventListener('click', e => { if (dd.open && !dd.contains(e.target)) dd.open = false; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && dd.open) { dd.open = false; $('summary', dd).focus(); } });
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
    window.addEventListener('resize', () => { if (menuOpen && window.innerWidth > 1080) setMenu(false); });

    // smooth anchor scrolling
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = id === '#top' ? doc : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.5 });
      else if (id === '#top') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      if (target !== doc) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });

    const links = $$('.nav__links a[data-nav]');
    const secs = links.map(a => document.getElementById(a.dataset.nav)).filter(Boolean);
    const fab = $('.fab');
    const contact = $('#contact');
    const progress = $('.progress i');
    let tops = [];
    let docH = 1;
    let contactTop = Infinity;
    onMeasure(() => {
      tops = secs.map(docTop);
      docH = Math.max(1, document.documentElement.scrollHeight - S.vh);
      contactTop = contact ? docTop(contact) : Infinity;
    });
    let lastY = S.y;
    let active = '';
    onFrame(() => {
      const y = S.y;
      nav.classList.toggle('is-scrolled', y > 24);
      if (Math.abs(y - lastY) > 8) {
        nav.classList.toggle('is-hidden', !menuOpen && y > lastY && y > S.vh * 0.7);
        lastY = y;
      }
      if (progress) progress.style.transform = 'scaleX(' + clamp(y / docH, 0, 1).toFixed(4) + ')';
      let cur = '';
      for (let i = 0; i < tops.length; i++) if (y + S.vh * 0.4 >= tops[i]) cur = secs[i].id;
      if (cur !== active) {
        active = cur;
        links.forEach(a => a.classList.toggle('is-active', a.dataset.nav === cur));
      }
      if (fab) fab.classList.toggle('is-on', !menuOpen && y > S.vh * 0.9 && y + S.vh * 0.6 < contactTop);
    });
  });

  /* ---------- clocks (Madeira time) ---------- */
  safe('clock', () => {
    const fmt = new Intl.DateTimeFormat(T.locale || 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Madeira' });
    const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, timeZone: 'Atlantic/Madeira' });
    const digital = $$('[data-clock]');
    const hands = $('.place__clock');
    const tick = () => {
      const now = new Date();
      digital.forEach(el => { el.textContent = fmt.format(now); });
      if (hands) {
        const p = {};
        parts.formatToParts(now).forEach(x => { p[x.type] = +x.value; });
        const h = (p.hour % 12) + p.minute / 60;
        $('.hh', hands).style.transform = 'rotate(' + (h * 30) + 'deg)';
        $('.mm', hands).style.transform = 'rotate(' + (p.minute * 6 + p.second * 0.1) + 'deg)';
        $('.ss', hands).style.transform = 'rotate(' + (p.second * 6) + 'deg)';
      }
    };
    tick();
    setInterval(tick, 1000);
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  });

  /* ==========================================================================
     HERO
     ========================================================================== */
  safe('hero', () => {
    const hero = $('.hero');
    const giant = $('.hero__giant');
    const title = $('.hero__title');
    const bottom = $('.hero__bottom');
    const globeWrap = $('.hero__globe');
    if (!hero || !giant) return;
    split(giant, 'chars');
    onLayout(() => fit(giant, hero));

    // rotating word
    const rot = $('.rotator__word');
    const words = T.rot || [];
    if (rot && words.length > 1 && !reduce) {
      let k = 0;
      setInterval(() => {
        if (document.hidden || S.y > S.vh) return;
        rot.classList.add('is-out');
        setTimeout(() => {
          k = (k + 1) % words.length;
          rot.textContent = words[k];
          rot.classList.remove('is-out');
          rot.classList.add('is-in');
          void rot.offsetWidth;
          rot.classList.remove('is-in');
        }, 480);
      }, 2700);
    }

    // scroll parallax for hero layers
    if (!reduce) {
      onFrame(() => {
        if (S.y > S.vh * 1.3) return;
        const p = clamp(S.y / S.vh, 0, 1);
        title.style.transform = 'translate3d(0,' + (S.y * 0.42).toFixed(1) + 'px,0)';
        title.style.opacity = (1 - p * 1.1).toFixed(3);
        bottom.style.opacity = (1 - p * 1.6).toFixed(3);
        if (globeWrap) globeWrap.style.transform = 'translate3d(0,' + (S.y * 0.22).toFixed(1) + 'px,0) scale(' + (1 + p * 0.35).toFixed(3) + ')';
      });
    }
  });

  /* ---------- WebGL holographic globe: Madeira → the world ---------- */
  safe('globe', () => {
    const wrap = $('.hero__globe');
    const cv = $('#globe');
    const fx = $('#globe-fx');
    const hero = $('.hero');
    if (!wrap || !cv || !fx || !hero) return;
    const mag = $('.globe-mag', wrap);
    const fallback = () => wrap.classList.add('is-fallback');

    let gl = null;
    try {
      gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    const ctx = fx.getContext('2d');
    if (!gl || !ctx) { fallback(); return; }

    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const prec = hp && hp.precision > 0 ? 'highp' : 'mediump';
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    // orthographic globe: land as a dot grid from a land mask, back hemisphere seen through the glassy body
    const FS = 'precision ' + prec + ` float;
uniform vec2 uR;uniform float uT;uniform vec2 uRot;uniform float uRad;uniform float uStep;uniform float uHov;uniform float uLandA;
uniform vec3 uPin;uniform sampler2D uLand;
const float PI=3.14159265,TAU=6.28318531;
vec3 toGeo(vec3 p){
  float cp=cos(uRot.y),sp=sin(uRot.y);
  vec3 q=vec3(p.x,p.y*cp+p.z*sp,-p.y*sp+p.z*cp);
  float cl=cos(uRot.x),sl=sin(uRot.x);
  return vec3(q.x*cl+q.z*sl,q.y,-q.x*sl+q.z*cl);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 dots(vec3 g,float aa){
  float lat=asin(clamp(g.y,-1.,1.)),lng=atan(g.x,g.z);
  float row=floor((lat+PI*.5)/uStep);
  float latC=(row+.5)*uStep-PI*.5;
  float n=max(floor(TAU*cos(latC)/uStep),1.);
  float cell=floor((lng+PI)/TAU*n);
  float lngC=(cell+.5)/n*TAU-PI;
  float dist=length(vec2(lat-latC,(lng-lngC)*cos(lat)));
  float land=texture2D(uLand,vec2((lngC+PI)/TAU,(PI*.5-latC)/PI)).r;
  float r=uStep*.34;
  return vec2((1.-smoothstep(r-aa,r+aa,dist))*step(.5,land),hash(vec2(row,cell)));
}
float grid(vec3 g,float aa){
  float lat=asin(clamp(g.y,-1.,1.)),lng=atan(g.x,g.z);
  float s=PI/12.;
  float a=abs(fract(lat/s+.5)-.5)*s,b=abs(fract(lng/s+.5)-.5)*s*cos(lat);
  return 1.-smoothstep(0.,aa*1.3,min(a,b));
}
void main(){
  float mr=min(uR.x,uR.y);
  vec2 uv=(gl_FragCoord.xy-.5*uR)/(.5*mr);
  float d=length(uv)/uRad;
  float px=1./(.5*mr*uRad);
  vec3 O=vec3(1.,.48,.1),P=vec3(1.,.18,.5),V=vec3(.55,.36,1.);
  float hal=exp(-max(d-1.,0.)*7.5)*.42*(1.+uHov*.35);
  vec4 outC=vec4(mix(P,V,smoothstep(-.7,.7,uv.y-uv.x*.4))*hal,hal);
  if(d<1.){
    vec2 s=uv/uRad;
    float z=sqrt(max(1.-d*d,0.));
    vec3 pf=vec3(s,z);
    vec3 gf=toGeo(pf),gb=toGeo(vec3(s,-z));
    float aa=px/max(z,.22);
    vec2 df=dots(gf,aa),db=dots(gb,aa*1.4);
    vec3 L=normalize(vec3(-.5,.55,.68));
    float lam=clamp(dot(pf,L),0.,1.);
    float fr=pow(1.-z,2.);
    float a=.6+.3*fr;
    vec3 col=mix(vec3(.03,.018,.07),vec3(.09,.04,.17),lam)*a;
    col+=vec3(.72,.62,1.)*grid(gf,aa)*.06*(1.-df.x);
    col+=V*db.x*.17*uLandA;
    vec3 dc=mix(V,P,smoothstep(-1.,.1,s.x+s.y*.3));
    dc=mix(dc,O,smoothstep(.15,.95,s.x*.6+s.y*.6));
    float br=(.3+.95*lam)*(.76+.24*sin(uT*1.7+df.y*60.))*(1.+uHov*.3)*uLandA;
    col+=dc*df.x*br*1.15;
    a=max(a,df.x*min(br,1.));
    col+=mix(P,V,smoothstep(-.6,.6,s.y-s.x*.4))*fr*.8;
    a=min(1.,a+fr*.3);
    col+=vec3(pow(clamp(dot(reflect(vec3(0.,0.,-1.),pf),L),0.,1.),18.)*.26);
    float ang=acos(clamp(dot(gf,uPin),-1.,1.));
    float rip=0.;
    for(int k=0;k<3;k++){
      float ph=fract(uT*(.3+uHov*.2)+float(k)/3.);
      rip+=(1.-smoothstep(0.,aa*2.2,abs(ang-ph*.3)))*(1.-ph)*(1.-ph);
    }
    col+=mix(O,vec3(1.,.85,.75),.35)*rip;
    float core=1.-smoothstep(.007,.007+aa*1.6,ang);
    col+=vec3(core)+P*exp(-ang*50.)*.6;
    a=max(a,core);
    outC=mix(outC,vec4(col,clamp(a,0.,1.)),1.-smoothstep(1.-px*1.5,1.,d));
  }
  gl_FragColor=outC;
}`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { fallback(); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['uR', 'uT', 'uRot', 'uRad', 'uStep', 'uHov', 'uLandA', 'uPin', 'uLand'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
    gl.clearColor(0, 0, 0, 0);

    // land mask (equirectangular, Natural Earth) — the globe glows without it, continents fade in on load
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uLand, 0);
    let landT = 0;
    const land = new Image();
    land.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, land);
      landT = performance.now();
      dirty = true;
    };
    land.src = ASSETS + 'img/land.png';

    const D2R = Math.PI / 180;
    const geo = (lat, lng) => [Math.cos(lat * D2R) * Math.sin(lng * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.cos(lng * D2R)];
    const HOME = [32.65, -16.91];
    const HV = geo(HOME[0], HOME[1]);
    gl.uniform3f(U.uPin, HV[0], HV[1], HV[2]);
    // clients & AWS regions the arcs fly to (no cities and no routes in Russia; East Asia is reached via the Middle East)
    const VIA = [28, 60];
    const CITIES = [
      ['Lisbon', 38.72, -9.14], ['Porto', 41.15, -8.61, '', 0, 1], ['Madrid', 40.42, -3.7], ['Barcelona', 41.39, 2.17], ['Paris', 48.86, 2.35], ['London', 51.51, -0.13],
      ['Dublin', 53.35, -6.26, 'AWS eu-west-1'], ['Amsterdam', 52.37, 4.9], ['Berlin', 52.52, 13.4], ['Frankfurt', 50.11, 8.68, 'AWS eu-central-1'],
      ['Zurich', 47.37, 8.54], ['Vienna', 48.21, 16.37], ['Rome', 41.9, 12.5], ['Milan', 45.46, 9.19], ['Warsaw', 52.23, 21.01],
      ['Kyiv', 50.45, 30.52, '', 0, 1], ['Ivano-Frankivsk', 48.92, 24.71, '', 0, 1], ['Stockholm', 59.33, 18.07], ['Oslo', 59.91, 10.75], ['Copenhagen', 55.68, 12.57], ['Helsinki', 60.17, 24.94],
      ['Athens', 37.98, 23.73],
      ['New York', 40.71, -74.01], ['Washington', 38.95, -77.45, 'AWS us-east-1'], ['Miami', 25.76, -80.19], ['Chicago', 41.88, -87.63],
      ['Toronto', 43.65, -79.38], ['Montreal', 45.5, -73.57], ['Vancouver', 49.28, -123.12], ['Calgary', 51.05, -114.07],
      ['Seattle', 47.61, -122.33, 'AWS HQ'], ['Portland', 45.52, -122.68, 'AWS us-west-2 · Oregon'], ['San Francisco', 37.77, -122.42, '', 0, 1], ['San Jose', 37.34, -121.89, '', 0, 1],
      ['Los Angeles', 34.05, -118.24], ['Las Vegas', 36.17, -115.14], ['Austin', 30.27, -97.74], ['Mexico City', 19.43, -99.13],
      ['São Paulo', -23.55, -46.63, 'AWS sa-east-1'], ['Rio de Janeiro', -22.91, -43.17], ['Buenos Aires', -34.6, -58.38],
      ['Santiago', -33.45, -70.67], ['Bogotá', 4.71, -74.07],
      ['Casablanca', 33.57, -7.59], ['Lagos', 6.52, 3.38], ['Nairobi', -1.29, 36.82], ['Cairo', 30.04, 31.24],
      ['Cape Town', -33.92, 18.42], ['Johannesburg', -26.2, 28.05],
      ['Dubai', 25.2, 55.27], ['Mumbai', 19.08, 72.88, 'AWS ap-south-1'], ['Bangalore', 12.97, 77.59], ['Singapore', 1.35, 103.82, 'AWS ap-southeast-1'],
      ['Bangkok', 13.76, 100.5], ['Hong Kong', 22.32, 114.17, '', 1], ['Shanghai', 31.23, 121.47, '', 1], ['Beijing', 39.9, 116.41, '', 1],
      ['Seoul', 37.57, 126.98, '', 1], ['Tokyo', 35.68, 139.69, 'AWS ap-northeast-1', 1], ['Taipei', 25.03, 121.57, '', 1],
      ['Sydney', -33.87, 151.21, 'AWS ap-southeast-2'], ['Melbourne', -37.81, 144.96], ['Brisbane', -27.47, 153.03], ['Perth', -31.95, 115.86],
      ['Auckland', -36.85, 174.76]
    ].map(c => {
      const b = geo(c[1], c[2]);
      const dot = (u, v) => clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1);
      const legs = c[4] ? [[HV, geo(VIA[0], VIA[1])], [geo(VIA[0], VIA[1]), b]] : [[HV, b]];
      const ang = legs.map(l => Math.acos(dot(l[0], l[1])));
      const om = ang.reduce((s, x) => s + x, 0);
      const alt = Math.min(0.3, 0.05 + om * 0.26);
      const pts = [];
      const N = Math.round(30 + om * 18);
      for (let i = 0; i <= N; i++) {
        let d = i / N * om;
        let k = 0;
        while (k < legs.length - 1 && d > ang[k]) { d -= ang[k]; k++; }
        const [p0, p1] = legs[k];
        const so = Math.sin(ang[k]) || 1;
        const s1 = Math.sin(ang[k] - d) / so;
        const s2 = Math.sin(d) / so;
        const h = 1 + alt * Math.sin(Math.PI * i / N);
        pts.push([(p0[0] * s1 + p1[0] * s2) * h, (p0[1] * s1 + p1[1] * s2) * h, (p0[2] * s1 + p1[2] * s2) * h]);
      }
      return { name: c[0].toUpperCase(), tag: c[3] || '', prio: c[5] || 0, b, pts, dur: 1500 + om * 1500, on: false };
    });

    let q = Math.min(window.devicePixelRatio || 1, fine ? 1.5 : 1.25);
    const fq = Math.min(window.devicePixelRatio || 1, 2);
    let size = 0;
    let rad = 0.66;
    let cx = 0;
    let cyDoc = 0;
    let dirty = true;
    let zoom = 1;
    let zoomT = 1;
    const resize = () => {
      size = wrap.clientWidth;
      rad = S.vw <= 760 ? 0.74 : 0.66;
      const px = Math.max(96, Math.round(size * q));
      if (cv.width !== px) { cv.width = cv.height = px; gl.viewport(0, 0, px, px); }
      const fp = Math.round(size * fq);
      if (fx.width !== fp) { fx.width = fx.height = fp; }
      const hr = hero.getBoundingClientRect();
      cx = hr.left + wrap.offsetLeft;
      cyDoc = hr.top + window.scrollY + wrap.offsetTop;
      dirty = true;
    };
    onMeasure(resize);

    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); visible = false; fallback(); });

    // where the globe is on screen right now (follows the hero parallax and pinch zoom)
    const view = () => {
      const p = reduce ? 0 : clamp(S.y / S.vh, 0, 1);
      const k = reduce ? 1 : 1 + p * 0.35;
      return { x: cx + g.x * k, y: cyDoc - S.y + (reduce ? 0 : S.y * 0.22) + g.y * k, r: rad * zoom * size / 2 * k };
    };

    // pointer: tilt toward the cursor, magnetic pull, drag to spin, more traffic on hover; touch: spin & pinch-zoom
    const m = { x: 0, y: 0, tx: 0, ty: 0 };
    const g = { x: 0, y: 0, tx: 0, ty: 0 };
    const cur = $('.cursor');
    const curLabel = cur && $('.cursor__label', cur);
    let hovT = 0;
    let hov = 0;
    let labelOn = false;
    let drag = null;
    let dYaw = 0;
    let dPitch = 0;
    let vYaw = 0;
    let vPitch = 0;
    let lastTouch = 0;
    const setLabel = on => {
      if (!cur || on === labelOn) return;
      labelOn = on;
      cur.classList.toggle('is-label', on);
      if (on) curLabel.textContent = T.drag || 'Drag';
    };
    const turn = (dx, dy) => {
      const k = 57.3 / Math.max(60, view().r);
      vYaw = -dx * k;
      vPitch = dy * k;
      dYaw += vYaw;
      dPitch = clamp(dPitch + vPitch, -85, 85);
      lastTouch = performance.now();
    };
    const point = (x, y) => {
      const v = view();
      const dx = x - v.x;
      const dy = y - v.y;
      m.tx = clamp(dx / (size * 0.7), -1, 1);
      m.ty = clamp(-dy / (size * 0.7), -1, 1);
      const inside = Math.hypot(dx, dy) < v.r * 1.04;
      const near = Math.abs(dx) < size / 2 + 150 && Math.abs(dy) < size / 2 + 150;
      g.tx = near && !drag ? dx / 7 : 0;
      g.ty = near && !drag ? dy / 7 : 0;
      hovT = inside || drag ? 1 : 0;
      setLabel(inside || !!drag);
    };
    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') point(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener('mouseleave', () => { g.tx = g.ty = 0; hovT = 0; setLabel(false); });
    if (!reduce) {
      wrap.addEventListener('pointerdown', e => {
        const v = view();
        if (e.pointerType !== 'mouse' || Math.hypot(e.clientX - v.x, e.clientY - v.y) > v.r * 1.04) return;
        e.preventDefault();
        drag = { x: e.clientX, y: e.clientY };
        vYaw = vPitch = 0;
        wrap.setPointerCapture(e.pointerId);
        wrap.classList.add('is-drag');
      });
      wrap.addEventListener('pointermove', e => {
        if (!drag || e.pointerType !== 'mouse') return;
        turn(e.clientX - drag.x, e.clientY - drag.y);
        drag.x = e.clientX; drag.y = e.clientY;
      });
      const end = () => { if (!drag) return; drag = null; wrap.classList.remove('is-drag'); lastTouch = performance.now(); };
      wrap.addEventListener('pointerup', end);
      wrap.addEventListener('pointercancel', end);

      // fingers: one spins the globe in any direction, two pinch to zoom, double tap resets
      let tg = null;
      let lastTap = 0;
      const pts = e => Array.from(e.touches).map(t => [t.clientX, t.clientY]);
      const gap = p => Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
      wrap.addEventListener('touchstart', e => {
        const p = pts(e);
        if (!tg) {
          const v = view();
          if (Math.hypot(p[0][0] - v.x, p[0][1] - v.y) > v.r * 1.06) return;
          tg = {};
          const now = performance.now();
          if (p.length === 1 && now - lastTap < 320) { zoomT = 1; dPitch = 0; }
          lastTap = now;
        }
        e.preventDefault();
        tg.p = p;
        if (p.length > 1) { tg.d0 = gap(p); tg.z0 = zoomT; }
        vYaw = vPitch = 0;
        hovT = 1;
      }, { passive: false });
      wrap.addEventListener('touchmove', e => {
        if (!tg) return;
        e.preventDefault();
        const p = pts(e);
        if (p.length > 1 && tg.p.length > 1) {
          zoomT = clamp(tg.z0 * gap(p) / (tg.d0 || 1), 0.75, 3.2);
          const mx = (p[0][0] + p[1][0] - tg.p[0][0] - tg.p[1][0]) / 2;
          const my = (p[0][1] + p[1][1] - tg.p[0][1] - tg.p[1][1]) / 2;
          turn(mx, my);
        } else if (p.length === 1 && tg.p.length === 1) {
          turn(p[0][0] - tg.p[0][0], p[0][1] - tg.p[0][1]);
        }
        tg.p = p;
      }, { passive: false });
      const tend = e => {
        if (!tg) return;
        const p = pts(e);
        if (!p.length) { tg = null; hovT = 0; lastTouch = performance.now(); return; }
        tg.p = p;
        if (p.length > 1) { tg.d0 = gap(p); tg.z0 = zoomT; }
      };
      wrap.addEventListener('touchend', tend);
      wrap.addEventListener('touchcancel', tend);
    }

    /* ---------- overlay: flight arcs, landing pings, labels ---------- */
    const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const live = [];
    let nextSpawn = 0;
    let yaw = 0;
    let pitch = 0;
    const rot = p => {
      const cl = Math.cos(yaw), sl = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = p[0] * cl - p[2] * sl;
      const z1 = p[0] * sl + p[2] * cl;
      return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
    };
    const seen = v => v[2] > 0 || v[0] * v[0] + v[1] * v[1] > 1;
    const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const at = (pts, f) => {
      const i = Math.min(pts.length - 2, Math.floor(f));
      return lerp3(pts[i], pts[i + 1], f - i);
    };
    const FONT = '700 11px "JetBrains Mono", ui-monospace, monospace';
    const box = (x, y, lines, right) => {
      ctx.font = FONT;
      const w = Math.round(Math.max(...lines.map(l => ctx.measureText(l.t).width)) + 18);
      const h = lines.length * 15 + 9;
      return { x: Math.round(right ? x : x - w), y: Math.round(y - h / 2), w, h };
    };
    const hit = (a, b) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;
    const pill = (r, lines, a, hot) => {
      ctx.font = FONT;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,8,12,.86)';
      ctx.strokeStyle = hot ? 'rgba(255,122,26,.85)' : 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w, r.h, 7); else ctx.rect(r.x + 0.5, r.y + 0.5, r.w, r.h);
      ctx.fill(); ctx.stroke();
      lines.forEach((l, i) => { ctx.fillStyle = l.c; ctx.fillText(l.t, r.x + 9, r.y + 16 + i * 15); });
      ctx.globalAlpha = 1;
    };

    const drawFx = now => {
      const W = fx.width / fq;
      const C = W / 2;
      const R = rad * zoom * C;
      ctx.setTransform(fq, 0, 0, fq, 0, 0);
      ctx.clearRect(0, 0, W, W);
      const scr = v => [C + v[0] * R, C - v[1] * R];

      // spawn new flights to cities on the visible side (more while hovered / touched)
      const want = reduce ? 0 : (hov > 0.5 ? 9 : 5);
      if (!reduce && live.length < want && now > nextSpawn) {
        const free = CITIES.filter(c => !c.on && rot(c.b)[2] > 0.15);
        const c = free[Math.floor(Math.random() * free.length)];
        if (c) { c.on = true; live.push({ c, t0: now }); nextSpawn = now + (hov > 0.5 ? 200 : 420); }
      }

      // city markers
      const front = [];
      CITIES.forEach(c => {
        const v = rot(c.b);
        if (v[2] <= 0.04) return;
        const s = scr(v);
        if (s[0] < -20 || s[1] < -20 || s[0] > W + 20 || s[1] > W + 20) return;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + v[2] * 0.55).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(s[0], s[1], 1.9, 0, 6.283); ctx.fill();
        if (v[2] > 0.3) front.push([s[0], s[1], c, v[2]]);
      });

      ctx.globalCompositeOperation = 'lighter';
      const hot = new Set();
      const flights = reduce ? CITIES.filter(c => rot(c.b)[2] > 0.3).slice(0, 6).map(c => ({ c, t0: -1 })) : live;
      for (let j = flights.length - 1; j >= 0; j--) {
        const F = flights[j];
        const u = F.t0 < 0 ? 0.6 : (now - F.t0) / F.c.dur;
        if (u > 1.5) { F.c.on = false; live.splice(j, 1); continue; }
        const head = F.t0 < 0 ? 1 : ease(clamp(u / 0.55, 0, 1));
        const tail = F.t0 < 0 ? 0 : ease(clamp((u - 0.42) / 0.6, 0, 1));
        const pts = F.c.pts;
        const n = pts.length - 1;
        if (head > tail) {
          const a = tail * n;
          const b = head * n;
          const seq = [at(pts, a)];
          for (let i = Math.ceil(a); i < b; i++) seq.push(pts[i]);
          seq.push(at(pts, b));
          const sv = seq.map(rot);
          const ss = sv.map(scr);
          const s0 = ss[0];
          const s1 = ss[ss.length - 1];
          const grad = ctx.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);
          grad.addColorStop(0, 'rgba(139,92,255,0)');
          grad.addColorStop(0.55, 'rgba(255,46,126,.75)');
          grad.addColorStop(1, 'rgba(255,214,170,1)');
          [[4, 0.28], [1.6, 1]].forEach(([lw, al]) => {
            ctx.globalAlpha = al;
            ctx.lineWidth = lw;
            ctx.strokeStyle = grad;
            ctx.lineCap = 'round';
            ctx.beginPath();
            let pen = false;
            for (let i = 0; i < ss.length; i++) {
              if (!seen(sv[i])) { pen = false; continue; }
              if (pen) ctx.lineTo(ss[i][0], ss[i][1]); else { ctx.moveTo(ss[i][0], ss[i][1]); pen = true; }
            }
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          if (head < 1 && seen(sv[sv.length - 1])) {
            const hg = ctx.createRadialGradient(s1[0], s1[1], 0, s1[0], s1[1], 9);
            hg.addColorStop(0, 'rgba(255,255,255,1)');
            hg.addColorStop(0.3, 'rgba(255,46,126,.6)');
            hg.addColorStop(1, 'rgba(255,46,126,0)');
            ctx.fillStyle = hg;
            ctx.beginPath(); ctx.arc(s1[0], s1[1], 9, 0, 6.283); ctx.fill();
          }
        }
        // landing ping at the destination
        const dv = rot(F.c.b);
        if (u > 0.5 && dv[2] > 0.05) {
          const ds = scr(dv);
          const r = clamp((u - 0.55) / 0.7, 0, 1);
          if (F.t0 >= 0 && r > 0 && r < 1) {
            ctx.strokeStyle = 'rgba(255,122,26,' + (1 - r).toFixed(2) + ')';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(ds[0], ds[1], (3 + r * 16) * Math.max(dv[2], 0.25), 3 + r * 16, Math.atan2(-dv[1], dv[0]), 0, 6.283);
            ctx.stroke();
          }
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ds[0], ds[1], 2.6, 0, 6.283); ctx.fill();
          if (F.t0 >= 0 && u < 1.45) hot.add(F.c);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // Madeira marker — its label goes first, city labels never cover it
      const taken = [];
      const hv = rot(HV);
      let home = null;
      if (hv[2] > 0.1 && W > 220) {
        const hs = scr(hv);
        const a = clamp((hv[2] - 0.1) * 4, 0, 1);
        const lines = [{ t: 'MADEIRA', c: '#fff' }, { t: '32.65°N  16.91°W', c: '#b8b8c6' }];
        if (hov > 0.5) lines.push({ t: 'AWS · GEO · FULL-STACK', c: '#ffb27a' });
        const lx = hs[0] - R * 0.16;
        const ly = hs[1] + R * 0.2;
        const r = box(lx, ly + (lines.length - 2) * 7, lines, false);
        taken.push(r);
        home = () => {
          ctx.globalAlpha = a * 0.6;
          ctx.strokeStyle = '#ededf2';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(hs[0] - 3, hs[1] + 3); ctx.lineTo(lx, r.y); ctx.stroke();
          ctx.globalAlpha = 1;
          pill(r, lines, a, true);
        };
      }
      // city names: the ones a flight is landing on first, then the cities closest to the viewer
      if (W > 240) {
        let shown = 0;
        const max = W > 520 ? 18 : 10;
        // featured cities (Ukraine, Bay Area) fan their labels out on leader lines so a whole cluster stays readable
        front.sort((p, q2) => (q2[2].prio - p[2].prio) || (hot.has(q2[2]) - hot.has(p[2])) || (q2[3] - p[3])).forEach(f => {
          const c = f[2];
          if (shown >= max && !c.prio) return;
          const isHot = hot.has(c);
          const right = f[0] >= C;
          const lines = [{ t: c.name, c: '#fff' }];
          if (c.tag && (isHot || f[3] > 0.6)) lines.push({ t: c.tag, c: '#ffb27a' });
          const sd = right ? 1 : -1;
          const cands = c.prio
            ? [[sd, 0], [sd, -1], [sd, 1], [sd, -2], [sd, 2], [sd, -3], [sd, 3], [-sd, 0], [-sd, -1], [-sd, 1], [-sd, -2], [-sd, 2]]
            : [[sd, 0], [-sd, 0]];
          let r = null;
          let row = 0;
          for (const [dx, dy] of cands) {
            const q3 = box(f[0] + dx * (8 + (dy ? 22 : 0)), f[1] - 4 - (lines.length - 1) * 7 + dy * 27, lines, dx > 0);
            if (q3.x < 2 || q3.x + q3.w > W - 2 || q3.y < 2 || q3.y + q3.h > W - 2) continue;
            if (taken.some(t2 => hit(t2, q3))) continue;
            r = q3; row = dy;
            break;
          }
          if (!r) return;
          taken.push(r);
          shown++;
          const al = isHot ? 1 : clamp((f[3] - 0.3) * 2.2, 0, c.prio ? 0.95 : 0.82);
          if (row) {
            ctx.globalAlpha = al * 0.7;
            ctx.strokeStyle = '#ededf2';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(f[0], f[1]);
            ctx.lineTo(r.x + (r.x > f[0] ? 0 : r.w), r.y + r.h / 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          pill(r, lines, isHot ? 1 : clamp((f[3] - 0.3) * 2.2, 0, 0.82), isHot);
        });
      }
      if (home) home();
    };

    const t0 = performance.now();
    let last = 0;
    let acc = 0;
    let n = 0;
    let shown = false;
    let spin = 0;
    onFrame(now => {
      if (!visible || document.hidden) { last = 0; return; }
      if (reduce && !dirty) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      if (last && now - t0 > 2000) {
        acc += now - last; n++;
        if (n === 40) {
          if (acc / n > 26 && q > 0.55) { q *= 0.78; resize(); }
          acc = 0; n = 0;
        }
      }
      last = now;
      const t = (now - t0) / 1000;
      m.x += (m.tx - m.x) * 0.05; m.y += (m.ty - m.y) * 0.05;
      g.x += (g.tx - g.x) * 0.09; g.y += (g.ty - g.y) * 0.09;
      hov += (hovT - hov) * 0.08;
      zoom += (zoomT - zoom) * 0.22;
      const busy = drag || hovT > 0.5;
      if (!drag) {
        dYaw += vYaw; vYaw *= 0.94;
        dPitch = clamp(dPitch + vPitch, -85, 85); vPitch *= 0.9;
        if (now - lastTouch > 4000) dPitch *= 0.985;
      }
      // the Earth turns eastward; it slows down while someone is playing with it
      if (!reduce) spin += dt * (busy ? 1.2 : 4.5);
      if (!reduce) mag.style.transform = 'translate3d(' + Math.round(g.x) + 'px,' + Math.round(g.y) + 'px,0)';
      yaw = (HOME[1] - spin - m.x * 20 + dYaw) * D2R;
      pitch = clamp(20 - m.y * 12 + dPitch, -85, 85) * D2R;
      const landA = landT ? (reduce ? 1 : clamp((now - landT) / 900, 0, 1)) : 0;
      gl.uniform2f(U.uR, cv.width, cv.height);
      gl.uniform1f(U.uT, reduce ? 2.4 : t);
      gl.uniform2f(U.uRot, yaw, pitch);
      gl.uniform1f(U.uRad, rad * zoom);
      gl.uniform1f(U.uStep, clamp(5.6 / (rad * zoom * size / 2), 0.009, 0.05));
      gl.uniform1f(U.uHov, hov);
      gl.uniform1f(U.uLandA, landA);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawFx(now);
      dirty = false;
      if (!shown && doc.classList.contains('is-ready')) { shown = true; setTimeout(() => mag.classList.add('is-live'), 2400); }
    });
  });

  /* ==========================================================================
     REEL — concept sites (full pages), scroll-driven in two directions
     ========================================================================== */
  const SERIF = "Georgia,'Times New Roman',serif";
  const DISP = 'var(--fd)';
  const SANS = 'var(--fb)';
  const SITES = [
    { id: 'atlantico', n: 'Atlântico', u: 'atlantico.pt', l: 'split', bg: '#0c1a2b', fg: '#f4efe6', ac: '#ff6b4a', bt: '#0c1a2b', ff: SERIF,
      nav: ['Menu', 'Terrace', 'Wine list', 'Contact'], cta: 'Book a table',
      kick: 'Seafood · Funchal waterfront', h: 'Fresh from the Atlantic',
      p: 'Catch of the day grilled over charcoal, Madeira wines and the sunset from our terrace.', b1: 'Book a table', b2: 'See the menu',
      stats: [['4.8★', 'Google rating'], ['Since 2009', 'family-run'], ['120', 'seats with sea view']],
      sec: 'From our kitchen', cards: [['Grilled sea bream', 'Sweet potato, salsa verde', '€24'], ['Seared scallops', 'Black rice, citrus butter', '€19'], ['Black scabbard fish', 'The Madeira classic', '€22']],
      about: ['A table by the ocean', 'Our terrace sits right on the Funchal promenade — come for lunch, stay for the sunset.', ['Open daily 12:00 – 23:00', 'Private events up to 60 guests', 'Vegetarian & gluten-free menu']],
      band: ['Tonight’s catch is waiting', 'Reserve now'] },
    { id: 'levada', n: 'Levada Trails', u: 'levadatrails.com', l: 'full', bg: '#0f1f17', fg: '#eaf5e9', ac: '#9be15d', bt: '#0f1f17', ff: DISP,
      nav: ['Tours', 'Guides', 'Reviews', 'FAQ'], cta: 'Book a tour',
      kick: 'Guided hikes · Madeira', h: 'Walk above the clouds',
      p: 'Small-group hikes along levadas, laurel forests and the island’s highest peaks — hotel pick-up included.', b1: 'Book a tour', b2: 'View trails',
      stats: [['18', 'signature trails'], ['8', 'hikers per group, max'], ['4.9★', 'TripAdvisor']],
      sec: 'Most loved trails', cards: [['Levada do Rei', 'Easy · 3 h', '€45'], ['25 Fontes waterfalls', 'Moderate · 4 h', '€49'], ['Ponta de São Lourenço', 'Easy · 3 h', '€39']],
      about: ['Local guides, real stories', 'Born on the island and certified in mountain first aid — your guide knows every plant and every shortcut.', ['Hotel pick-up in Funchal', 'Snacks & rain poncho included', 'Free cancellation 24 h before']],
      band: ['Sunrise at Pico do Arieiro', 'Reserve a spot'] },
    { id: 'bloom', n: 'Bloom', u: 'bloom-funchal.pt', l: 'shop', bg: '#fff0f3', fg: '#3b0a1e', ac: '#e0125f', bt: '#fff', ff: SERIF,
      nav: ['Bouquets', 'Plants', 'Weddings', 'Gifts'], cta: 'Cart · 2',
      kick: 'Florist · same-day delivery', h: 'Flowers, delivered today',
      p: 'Hand-tied bouquets from local growers. Order by 2 pm — delivered across Funchal the same day.', b1: 'Shop bouquets', b2: 'Weddings',
      stats: [['2 h', 'delivery window'], ['Local', 'Madeira growers'], ['4.9★', '1 300 reviews']],
      sec: 'Bestsellers', cards: [['Sunny Days', 'Sunflowers & olive', '€32'], ['White Garden', 'Roses & hydrangea', '€38'], ['Peach Blush', 'Garden roses', '€35']],
      about: ['Fresh every morning', 'We collect flowers from island growers at dawn, so your bouquet lasts longer.', ['Free card message', 'Plastic-free packaging', 'Subscriptions from €25 a week']],
      band: ['Surprise someone today', 'Send flowers'] },
    { id: 'volt', n: 'VOLT GYM', u: 'voltgym.pt', l: 'full', bg: '#0a0a0a', fg: '#f5f5f5', ac: '#d4ff3a', bt: '#0a0a0a', ff: DISP,
      nav: ['Classes', 'Coaches', 'Prices', 'Timetable'], cta: 'Join now',
      kick: 'Strength · Boxing · HIIT — Funchal', h: 'Stronger every day',
      p: 'Coach-led classes, an open strength floor and a recovery zone. Open daily 6:00 – 23:00.', b1: 'Start free trial', b2: 'Timetable',
      stats: [['1 200+', 'members'], ['35', 'classes a week'], ['6–23', 'open every day']],
      sec: 'Classes this week', cards: [['Boxing', 'Mon · Wed · Fri — 55 min', 'Book'], ['TRX & Core', 'Tue · Thu — 45 min', 'Book'], ['Barbell Club', 'Every day — 60 min', 'Book']],
      about: ['Everything you need. Nothing you don’t.', 'Free weights up to 50 kg, six squat racks, assault bikes and a sauna to finish.', ['First week free', 'No joining fee', 'Personal plans from €39 / month']],
      band: ['Your first class is on us', 'Book a trial'] },
    { id: 'cloudops', n: 'CloudOps', u: 'ops.nexgen.dev', l: 'dash', bg: '#06120d', fg: '#d9ffe9', ac: '#3ddc84', bt: '#06120d', ff: DISP,
      menu: ['Overview', 'Services', 'Alerts', 'Costs', 'Deploys', 'Settings'],
      kpis: [['Uptime', '99.98%', '+0.02%'], ['p95 latency', '42 ms', '−8 ms'], ['AWS bill', '€1 284', '−31%']],
      bars: [38, 52, 45, 61, 58, 72, 66, 80, 74, 88, 70, 92, 84, 96],
      rows: [['api-gateway', 'eu-west-1', 'Healthy', '12 ms'], ['lambda-orders', 'eu-west-1', 'Healthy', '38 ms'], ['ecs-workers', 'eu-central-1', 'Scaling', '64 ms'], ['rds-main', 'eu-central-1', '2 alerts', '9 ms'], ['s3-cold-storage', 'eu-west-1', 'Healthy', '—']] },
    { id: 'vinha', n: 'Casa da Vinha', u: 'casadavinha.pt', l: 'split', bg: '#1f0b10', fg: '#f7e7c6', ac: '#c9a24b', bt: '#1f0b10', ff: SERIF,
      nav: ['Wines', 'Tastings', 'Visit', 'Shop'], cta: 'Book a tasting',
      kick: 'Madeira wine lodge · Funchal', h: 'Aged by the ocean',
      p: 'Walk through our historic cellar and taste rare Madeira — from dry Sercial to rich Malvasia.', b1: 'Book a tasting', b2: 'Shop wines',
      stats: [['10–50', 'years in cask'], ['4', 'noble grapes'], ['Daily', 'guided tours']],
      sec: 'Experiences', cards: [['Classic tasting', '4 wines · 45 min', '€18'], ['Vintage flight', '3 rare vintages', '€35'], ['Cellar tour', 'Barrels & history', '€12']],
      about: ['The canteiro way', 'Our wines rest in oak casks under the warm lodge roof — slowly, the island way, unchanged for generations.', ['Tours in PT · EN · DE', 'Shipping across the EU', 'Private tastings for groups']],
      band: ['Taste a century of Madeira', 'Reserve'] },
    { id: 'funchal', n: 'Funchal Living', u: 'funchalliving.pt', l: 'split', bg: '#efe9df', fg: '#1b1b1b', ac: '#1b1b1b', bt: '#efe9df', ff: SERIF,
      nav: ['Buy', 'Rent', 'Sell', 'About'], cta: 'View homes',
      kick: 'Real estate · Madeira', h: 'Homes with ocean views',
      p: 'Hand-picked villas and apartments in Funchal, Calheta and Ponta do Sol.', b1: 'View homes', b2: 'Sell with us',
      search: ['Funchal', 'Villa', '€450k – 900k', 'Search'],
      stats: [['240+', 'listings'], ['15 yrs', 'on the island'], ['3', 'local offices']],
      sec: 'Featured properties', cards: [['Villa Calheta', '4 bed · pool · 280 m²', '€1 250 000'], ['Sea-view apartment', '2 bed · Funchal', '€420 000'], ['Penthouse Lido', '3 bed · terrace', '€690 000']],
      about: ['Your home on the island', 'From the first viewing to the notary — we handle paperwork, translations and the NIF for international buyers.', ['Virtual tours', 'Residency advice', 'After-sale property care']],
      band: ['Find your view', 'Book a viewing'] },
    { id: 'reef', n: 'Blue Reef Dive', u: 'bluereefdive.pt', l: 'full', bg: '#03222e', fg: '#e6fbff', ac: '#22d3ee', bt: '#03222e', ff: DISP,
      nav: ['Courses', 'Dive sites', 'Prices', 'Team'], cta: 'Dive now',
      kick: 'PADI dive centre · Garajau reserve', h: 'Dive into the blue',
      p: 'Try-dives, PADI courses and boat dives in some of the clearest water in the Atlantic.', b1: 'Book a dive', b2: 'Courses',
      stats: [['24 °C', 'summer water'], ['30 m', 'visibility'], ['5★', 'PADI centre']],
      sec: 'Start here', cards: [['Meet the turtles', 'Boat dive · 2 h', '€55'], ['Discover Scuba', 'No experience needed', '€80'], ['Snorkel trip', 'Families welcome', '€35']],
      about: ['Small groups, big encounters', 'Four divers per instructor at most — rays, groupers and turtles are regulars at Garajau.', ['All equipment included', 'Free hotel transfer', 'Photos of your dive']],
      band: ['Your first breath underwater', 'Book now'] },
    { id: 'smile', n: 'Smile Clinic', u: 'smileclinic.pt', l: 'split', bg: '#f4fbfb', fg: '#0f3d3e', ac: '#0f9e8f', bt: '#fff', ff: SANS,
      nav: ['Treatments', 'Team', 'Prices', 'Contacts'], cta: 'Book a visit',
      kick: 'Dental clinic · Funchal', h: 'Your smile, our care',
      p: 'Gentle, modern dentistry in Portuguese, English and German — appointments the same week.', b1: 'Book a visit', b2: 'Treatments',
      stats: [['12', 'specialists'], ['Same week', 'appointments'], ['4.9★', 'patient rating']],
      sec: 'Treatments', cards: [['Check-up & hygiene', '45 min', 'from €60'], ['Clear aligners', 'Free 3D scan', 'from €1 900'], ['Teeth whitening', 'One visit', '€250']],
      about: ['Calm, bright and modern', 'Digital X-rays, 3D scanning and a team that explains every step before we start.', ['Insurance accepted', 'Emergency slots every day', 'Kids’ corner']],
      band: ['Smile with confidence', 'Book online'] },
    { id: 'surf', n: 'SURF MONIZ', u: 'surfmoniz.com', l: 'full', bg: '#ffd23f', fg: '#0b1d3a', ac: '#0b1d3a', bt: '#ffd23f', ff: DISP,
      nav: ['Lessons', 'Rentals', 'Camps', 'Spots'], cta: 'Book a lesson',
      kick: 'Surf school · Porto Moniz', h: 'Catch your wave',
      p: 'Beginner lessons, board rental and surf camps on the wild north coast of Madeira.', b1: 'Book a lesson', b2: 'Rentals',
      stats: [['8+', 'years old to start'], ['2 h', 'per lesson'], ['All', 'gear included']],
      sec: 'Choose your session', cards: [['First wave', 'Beginner · 2 h', '€40'], ['Group lesson', 'Up to 6 people', '€35'], ['Board rental', 'Half day', '€20']],
      about: ['Learn with locals', 'Certified instructors read the swell every morning and pick the safest spot of the day.', ['Transport from Funchal', 'Video coaching', 'Weekly surf camps']],
      band: ['The ocean is calling', 'Book now'] },
    { id: 'nomad', n: 'Nomad Hub', u: 'nomadhub.work', l: 'split', bg: '#141414', fg: '#fff4e8', ac: '#ff7a1a', bt: '#141414', ff: SANS,
      nav: ['Spaces', 'Pricing', 'Community', 'Events'], cta: 'Day pass',
      kick: 'Coworking · Funchal & Ponta do Sol', h: 'Work by the ocean',
      p: 'Fast fibre, ergonomic desks and a community of remote workers from 40+ countries.', b1: 'Get a day pass', b2: 'Pricing',
      stats: [['1 Gbps', 'fibre'], ['24/7', 'access'], ['40+', 'nationalities']],
      sec: 'Plans', cards: [['Day pass', 'Hot desk + coffee', '€15 / day'], ['Weekly', 'Any desk, any hub', '€79 / week'], ['Monthly', 'Fixed desk + locker', '€249 / month']],
      about: ['More than a desk', 'Weekly sunset meetups, skill-shares and hikes — the fastest way to feel at home on the island.', ['Phone booths & meeting rooms', 'Standing desks', 'Your first day is free']],
      band: ['Your desk with a view', 'Join the hub'] },
    { id: 'charter', n: 'Sea Charter', u: 'seacharter.pt', l: 'full', bg: '#f2f7ff', fg: '#0a2342', ac: '#0a6cff', bt: '#fff', ff: DISP,
      nav: ['Trips', 'Private charter', 'Fleet', 'FAQ'], cta: 'Book a trip',
      kick: 'Dolphin & whale watching · Funchal', h: 'Sail with dolphins',
      p: 'Three-hour catamaran trips with a marine biologist on board — sightings all year round.', b1: 'Book a trip', b2: 'Private charter',
      stats: [['95%', 'sighting rate'], ['3 h', 'on the water'], ['28', 'species seen']],
      sec: 'Trips', cards: [['Dolphin watching', '3 h · catamaran', '€55'], ['Sunset sail', '2 h · drinks included', '€45'], ['Private charter', 'Up to 12 guests', 'from €480']],
      about: ['Respectful encounters', 'We follow the Madeira code for marine life — no chasing, quiet engines, small groups.', ['Free retry if no sightings', 'Snorkel stop in summer', 'Kids under 12 half price']],
      band: ['Meet the locals of the Atlantic', 'Reserve seats'] },
    { id: 'quinta', n: 'Quinta Azul', u: 'quintaazul.pt', l: 'split', bg: '#f6f1e7', fg: '#1e2a5a', ac: '#2557d6', bt: '#fff', ff: SERIF,
      nav: ['Rooms', 'Spa', 'Dining', 'Contact'], cta: 'Book now',
      kick: 'Boutique hotel · Funchal', h: 'Your quiet place in Madeira',
      p: 'Sea-view suites, a heated pool and breakfast in a subtropical garden — five minutes from the old town.', b1: 'Book now', b2: 'Rooms',
      stats: [['24', 'suites'], ['9.4', 'on Booking'], ['5 min', 'to the old town']],
      sec: 'Stay with us', cards: [['Garden suite', 'King bed · terrace', '€180 / night'], ['Pool & terrace', 'Open 8:00 – 20:00', 'Free']],
      band: ['Best rate when you book direct', 'Check dates'] }
  ];
  // every concept lives under the NEXGEN name in the address bar
  const SLUG = { atlantico: 'atlantico', levada: 'levada-trails', bloom: 'bloom', volt: 'volt-gym', cloudops: 'cloudops', vinha: 'casa-da-vinha',
    funchal: 'funchal-living', reef: 'blue-reef-dive', smile: 'smile-clinic', surf: 'surf-moniz', nomad: 'nomad-hub', charter: 'sea-charter', quinta: 'quinta-azul' };
  const slug = s => SLUG[s.id] || s.id;
  // the three "Instant Demo Sites" phones: the same projects, generated in 7 languages
  const byId = id => SITES.find(s => s.id === id);
  const PLANG = ['pt', 'en', 'de', 'es', 'it', 'fr', 'ua'];
  const ALLS = { en: 'See all →', pt: 'Ver tudo →', de: 'Alle →', es: 'Ver todo →', it: 'Vedi tutto →', fr: 'Tout voir →', ua: 'Усі →' };
  const PVALS = { atlantico: ['4.8★', '2009', '120'], quinta: ['24', '9.4', '5 min'], levada: ['18', '8', '4.9★'] };
  // [kicker, headline, text, button 1, button 2, stat labels, section, "see all", cards [title, detail, price], band [title, button]]
  const PTXT = {
    atlantico: {
      en: ['Seafood · Funchal', 'Fresh from the Atlantic', 'Catch of the day grilled over charcoal and the sunset from our terrace.', 'Book a table', 'Menu', ['Google rating', 'family-run since', 'sea-view seats'], 'From our kitchen', 'See all →', [['Grilled sea bream', 'Sweet potato, salsa verde', '€24'], ['Seared scallops', 'Black rice, citrus butter', '€19']], ['Tonight’s catch is waiting', 'Reserve']],
      pt: ['Marisqueira · Funchal', 'Sabores do Atlântico', 'Peixe do dia grelhado na brasa e o pôr do sol na nossa esplanada.', 'Reservar mesa', 'Menu', ['avaliação Google', 'familiar desde', 'lugares com vista mar'], 'Da nossa cozinha', 'Ver tudo →', [['Dourada grelhada', 'Batata-doce, molho verde', '€24'], ['Vieiras seladas', 'Arroz negro, manteiga cítrica', '€19']], ['O peixe de hoje espera por si', 'Reservar']],
      de: ['Fischrestaurant · Funchal', 'Frisch aus dem Atlantik', 'Fang des Tages vom Holzkohlegrill und Sonnenuntergang auf der Terrasse.', 'Tisch reservieren', 'Speisekarte', ['Google-Bewertung', 'Familienbetrieb seit', 'Plätze mit Meerblick'], 'Aus unserer Küche', 'Alle →', [['Gegrillte Dorade', 'Süßkartoffel, Salsa verde', '€24'], ['Jakobsmuscheln', 'Schwarzer Reis, Zitrusbutter', '€19']], ['Der Fang des Tages wartet', 'Reservieren']],
      es: ['Marisquería · Funchal', 'Fresco del Atlántico', 'Pescado del día a la brasa y la puesta de sol desde nuestra terraza.', 'Reservar mesa', 'Carta', ['valoración Google', 'familiar desde', 'plazas con vista al mar'], 'De nuestra cocina', 'Ver todo →', [['Dorada a la brasa', 'Boniato, salsa verde', '€24'], ['Vieiras a la plancha', 'Arroz negro, mantequilla cítrica', '€19']], ['La pesca de hoy te espera', 'Reservar']],
      it: ['Ristorante di pesce · Funchal', 'Fresco dall’Atlantico', 'Pescato del giorno alla brace e il tramonto dalla nostra terrazza.', 'Prenota un tavolo', 'Menù', ['voto Google', 'gestione familiare dal', 'posti vista mare'], 'Dalla nostra cucina', 'Vedi tutto →', [['Orata alla griglia', 'Patata dolce, salsa verde', '€24'], ['Capesante scottate', 'Riso nero, burro agli agrumi', '€19']], ['Il pescato di stasera ti aspetta', 'Prenota']],
      fr: ['Fruits de mer · Funchal', 'Fraîcheur de l’Atlantique', 'La pêche du jour grillée au feu de bois et le coucher de soleil depuis la terrasse.', 'Réserver une table', 'La carte', ['note Google', 'familial depuis', 'places vue mer'], 'De notre cuisine', 'Tout voir →', [['Dorade grillée', 'Patate douce, sauce verte', '24 €'], ['Saint-Jacques snackées', 'Riz noir, beurre d’agrumes', '19 €']], ['La pêche du soir vous attend', 'Réserver']],
      ua: ['Морепродукти · Фуншал', 'Свіже з Атлантики', 'Улов дня на вугіллі та захід сонця з нашої тераси.', 'Забронювати стіл', 'Меню', ['рейтинг Google', 'сімейний ресторан з', 'місць з видом на море'], 'З нашої кухні', 'Усі →', [['Дорадо на грилі', 'Батат, зелений соус', '€24'], ['Обсмажені гребінці', 'Чорний рис, цитрусове масло', '€19']], ['Сьогоднішній улов чекає на вас', 'Забронювати']]
    },
    quinta: {
      en: ['Boutique hotel · Funchal', 'Your quiet place in Madeira', 'Sea-view suites, a heated pool and breakfast in a subtropical garden.', 'Book now', 'Rooms', ['suites', 'on Booking', 'to the old town'], 'Stay with us', 'See all →', [['Garden suite', 'King bed · terrace', '€180 / night'], ['Pool & terrace', 'Open 8:00 – 20:00', 'Free']], ['Best rate when you book direct', 'Check dates']],
      pt: ['Hotel boutique · Funchal', 'O seu refúgio na Madeira', 'Suítes com vista mar, piscina aquecida e pequeno-almoço num jardim subtropical.', 'Reservar', 'Quartos', ['suítes', 'no Booking', 'do centro histórico'], 'Fique connosco', 'Ver tudo →', [['Suíte jardim', 'Cama king · terraço', '€180 / noite'], ['Piscina e terraço', 'Aberta 8:00 – 20:00', 'Grátis']], ['Melhor preço ao reservar direto', 'Ver datas']],
      de: ['Boutique-Hotel · Funchal', 'Ihr ruhiger Ort auf Madeira', 'Suiten mit Meerblick, beheizter Pool und Frühstück im subtropischen Garten.', 'Jetzt buchen', 'Zimmer', ['Suiten', 'bei Booking', 'zur Altstadt'], 'Bleiben Sie bei uns', 'Alle →', [['Garten-Suite', 'Kingsize-Bett · Terrasse', '€180 / Nacht'], ['Pool & Terrasse', 'Geöffnet 8–20 Uhr', 'Gratis']], ['Bestpreis bei Direktbuchung', 'Termine prüfen']],
      es: ['Hotel boutique · Funchal', 'Tu rincón tranquilo en Madeira', 'Suites con vistas al mar, piscina climatizada y desayuno en un jardín subtropical.', 'Reservar', 'Habitaciones', ['suites', 'en Booking', 'del casco antiguo'], 'Alójate con nosotros', 'Ver todo →', [['Suite jardín', 'Cama king · terraza', '€180 / noche'], ['Piscina y terraza', 'Abierta 8:00 – 20:00', 'Gratis']], ['Mejor precio reservando directo', 'Ver fechas']],
      it: ['Boutique hotel · Funchal', 'Il tuo angolo di pace a Madeira', 'Suite vista mare, piscina riscaldata e colazione in un giardino subtropicale.', 'Prenota ora', 'Camere', ['suite', 'su Booking', 'dal centro storico'], 'Soggiorna da noi', 'Vedi tutto →', [['Suite giardino', 'Letto king · terrazza', '€180 / notte'], ['Piscina e terrazza', 'Aperta 8:00 – 20:00', 'Gratis']], ['Miglior prezzo prenotando diretto', 'Verifica date']],
      fr: ['Hôtel boutique · Funchal', 'Votre havre de paix à Madère', 'Suites vue mer, piscine chauffée et petit-déjeuner dans un jardin subtropical.', 'Réserver', 'Chambres', ['suites', 'sur Booking', 'de la vieille ville'], 'Séjournez chez nous', 'Tout voir →', [['Suite jardin', 'Lit king · terrasse', '180 € / nuit'], ['Piscine & terrasse', 'Ouverte 8h – 20h', 'Offert']], ['Meilleur prix en direct', 'Voir les dates']],
      ua: ['Бутік-готель · Фуншал', 'Ваш тихий куточок на Мадейрі', 'Люкси з видом на море, підігрівний басейн і сніданок у субтропічному саду.', 'Забронювати', 'Номери', ['люксів', 'на Booking', 'до старого міста'], 'Зупиніться в нас', 'Усі →', [['Люкс із садом', 'Ліжко king · тераса', '€180 / ніч'], ['Басейн і тераса', 'Відкрито 8:00 – 20:00', 'Безкоштовно']], ['Найкраща ціна при прямому бронюванні', 'Обрати дати']]
    },
    levada: {
      en: ['Guided hikes · Madeira', 'Walk above the clouds', 'Small-group hikes along levadas and laurel forests — hotel pick-up included.', 'Book a tour', 'Trails', ['trails', 'per group, max', 'TripAdvisor'], 'Most loved trails', 'See all →', [['Levada do Rei', 'Easy · 3 h', '€45'], ['25 Fontes', 'Moderate · 4 h', '€49']], ['Sunrise at Pico do Arieiro', 'Reserve']],
      pt: ['Caminhadas guiadas · Madeira', 'Caminhe acima das nuvens', 'Grupos pequenos, levadas e floresta Laurissilva — transporte do hotel incluído.', 'Reservar passeio', 'Percursos', ['percursos', 'por grupo, máx.', 'TripAdvisor'], 'Percursos favoritos', 'Ver tudo →', [['Levada do Rei', 'Fácil · 3 h', '€45'], ['25 Fontes', 'Moderado · 4 h', '€49']], ['Nascer do sol no Pico do Arieiro', 'Reservar']],
      de: ['Geführte Wanderungen · Madeira', 'Über den Wolken wandern', 'Kleine Gruppen, Levadas und Lorbeerwälder — Abholung vom Hotel inklusive.', 'Tour buchen', 'Touren', ['Touren', 'pro Gruppe, max.', 'TripAdvisor'], 'Beliebteste Touren', 'Alle →', [['Levada do Rei', 'Leicht · 3 Std.', '€45'], ['25 Fontes', 'Mittel · 4 Std.', '€49']], ['Sonnenaufgang am Pico do Arieiro', 'Platz sichern']],
      es: ['Senderismo guiado · Madeira', 'Camina sobre las nubes', 'Grupos reducidos, levadas y bosques de laurisilva — recogida en el hotel incluida.', 'Reservar ruta', 'Rutas', ['rutas', 'por grupo, máx.', 'TripAdvisor'], 'Rutas favoritas', 'Ver todo →', [['Levada do Rei', 'Fácil · 3 h', '€45'], ['25 Fontes', 'Moderada · 4 h', '€49']], ['Amanecer en el Pico do Arieiro', 'Reservar']],
      it: ['Escursioni guidate · Madeira', 'Cammina sopra le nuvole', 'Piccoli gruppi, levadas e foreste di lauro — trasferimento dall’hotel incluso.', 'Prenota il tour', 'Sentieri', ['sentieri', 'per gruppo, max', 'TripAdvisor'], 'I sentieri più amati', 'Vedi tutto →', [['Levada do Rei', 'Facile · 3 h', '€45'], ['25 Fontes', 'Media · 4 h', '€49']], ['Alba al Pico do Arieiro', 'Prenota']],
      fr: ['Randonnées guidées · Madère', 'Marchez au-dessus des nuages', 'Petits groupes, levadas et forêts de lauriers — prise en charge à l’hôtel incluse.', 'Réserver', 'Sentiers', ['sentiers', 'par groupe, max', 'TripAdvisor'], 'Les sentiers préférés', 'Tout voir →', [['Levada do Rei', 'Facile · 3 h', '45 €'], ['25 Fontes', 'Moyen · 4 h', '49 €']], ['Lever du soleil au Pico do Arieiro', 'Réserver']],
      ua: ['Піші тури · Мадейра', 'Прогулянка над хмарами', 'Маленькі групи, левади й лаврові ліси — трансфер із готелю включено.', 'Забронювати тур', 'Маршрути', ['маршрутів', 'у групі, макс.', 'TripAdvisor'], 'Улюблені маршрути', 'Усі →', [['Левада-ду-Рей', 'Легкий · 3 год', '€45'], ['25 джерел', 'Середній · 4 год', '€49']], ['Світанок на Піку-ду-Арієйру', 'Забронювати']]
    }
  };
  // the other portfolio sites on the phones, in every language (EN comes straight from SITES)
  // [kicker, headline, text, button 1, button 2, stats [[value, label]], section, cards [title, detail, price], band]
  Object.assign(PTXT, {
    bloom: {
      pt: ['Florista · entrega no próprio dia', 'Flores entregues hoje', 'Ramos feitos à mão com flores de produtores locais. Encomende até às 14h — entrega no Funchal no mesmo dia.', 'Ver ramos', 'Casamentos', [['2 h', 'janela de entrega'], ['Local', 'produtores da Madeira'], ['4.9★', '1 300 avaliações']], 'Mais vendidos', [['Dias de Sol', 'Girassóis e oliveira', '€32'], ['Jardim Branco', 'Rosas e hortênsias', '€38']], ['Surpreenda alguém hoje', 'Enviar flores']],
      de: ['Florist · Lieferung am selben Tag', 'Blumen, noch heute geliefert', 'Handgebundene Sträuße von lokalen Gärtnern. Bis 14 Uhr bestellt — am selben Tag in Funchal geliefert.', 'Sträuße ansehen', 'Hochzeiten', [['2 Std.', 'Lieferfenster'], ['Lokal', 'Gärtner aus Madeira'], ['4.9★', '1 300 Bewertungen']], 'Bestseller', [['Sonnentage', 'Sonnenblumen & Olive', '€32'], ['Weißer Garten', 'Rosen & Hortensien', '€38']], ['Überraschen Sie heute jemanden', 'Blumen senden']],
      es: ['Floristería · entrega en el día', 'Flores, entregadas hoy', 'Ramos hechos a mano con flores de productores locales. Pide antes de las 14 h y llegan a Funchal el mismo día.', 'Ver ramos', 'Bodas', [['2 h', 'franja de entrega'], ['Local', 'productores de Madeira'], ['4.9★', '1 300 reseñas']], 'Más vendidos', [['Días de sol', 'Girasoles y olivo', '€32'], ['Jardín blanco', 'Rosas e hortensias', '€38']], ['Sorprende hoy a alguien', 'Enviar flores']],
      it: ['Fiorista · consegna in giornata', 'Fiori consegnati oggi', 'Bouquet fatti a mano con fiori di coltivatori locali. Ordina entro le 14 — consegna a Funchal in giornata.', 'Scopri i bouquet', 'Matrimoni', [['2 h', 'fascia di consegna'], ['Locali', 'coltivatori di Madeira'], ['4.9★', '1 300 recensioni']], 'I più venduti', [['Giorni di sole', 'Girasoli e ulivo', '€32'], ['Giardino bianco', 'Rose e ortensie', '€38']], ['Sorprendi qualcuno oggi', 'Invia fiori']],
      fr: ['Fleuriste · livraison le jour même', 'Des fleurs livrées aujourd’hui', 'Bouquets faits main avec des fleurs de producteurs locaux. Commandez avant 14 h — livrés à Funchal le jour même.', 'Voir les bouquets', 'Mariages', [['2 h', 'créneau de livraison'], ['Local', 'producteurs de Madère'], ['4.9★', '1 300 avis']], 'Meilleures ventes', [['Jours de soleil', 'Tournesols et olivier', '32 €'], ['Jardin blanc', 'Roses et hortensias', '38 €']], ['Faites une surprise aujourd’hui', 'Envoyer des fleurs']],
      ua: ['Квіти · доставка в день замовлення', 'Квіти з доставкою сьогодні', 'Букети ручної роботи від місцевих фермерів. Замовте до 14:00 — доставимо по Фуншалу того ж дня.', 'Обрати букет', 'Весілля', [['2 год', 'вікно доставки'], ['Місцеві', 'фермери Мадейри'], ['4.9★', '1 300 відгуків']], 'Хіти продажів', [['Сонячні дні', 'Соняшники й оливка', '€32'], ['Білий сад', 'Троянди й гортензії', '€38']], ['Здивуйте когось сьогодні', 'Надіслати квіти']]
    },
    volt: {
      pt: ['Força · Boxe · HIIT — Funchal', 'Mais forte todos os dias', 'Aulas com treinador, zona de musculação e área de recuperação. Aberto todos os dias das 6:00 às 23:00.', 'Treino grátis', 'Horário', [['1 200+', 'membros'], ['35', 'aulas por semana'], ['6–23', 'aberto todos os dias']], 'Aulas desta semana', [['Boxe', 'Seg · Qua · Sex — 55 min', 'Reservar'], ['TRX e Core', 'Ter · Qui — 45 min', 'Reservar']], ['A primeira aula é por nossa conta', 'Marcar treino']],
      de: ['Kraft · Boxen · HIIT — Funchal', 'Jeden Tag stärker', 'Kurse mit Coach, offene Kraftfläche und Recovery-Zone. Täglich von 6 bis 23 Uhr geöffnet.', 'Gratis testen', 'Kursplan', [['1 200+', 'Mitglieder'], ['35', 'Kurse pro Woche'], ['6–23', 'täglich geöffnet']], 'Kurse diese Woche', [['Boxen', 'Mo · Mi · Fr — 55 Min.', 'Buchen'], ['TRX & Core', 'Di · Do — 45 Min.', 'Buchen']], ['Ihre erste Stunde geht auf uns', 'Probetraining']],
      es: ['Fuerza · Boxeo · HIIT — Funchal', 'Más fuerte cada día', 'Clases con entrenador, zona de fuerza y área de recuperación. Abierto todos los días de 6:00 a 23:00.', 'Prueba gratis', 'Horario', [['1 200+', 'socios'], ['35', 'clases a la semana'], ['6–23', 'abierto a diario']], 'Clases de esta semana', [['Boxeo', 'Lun · Mié · Vie — 55 min', 'Reservar'], ['TRX y Core', 'Mar · Jue — 45 min', 'Reservar']], ['Tu primera clase es gratis', 'Reservar prueba']],
      it: ['Forza · Boxe · HIIT — Funchal', 'Più forte ogni giorno', 'Corsi con coach, area pesi e zona recupero. Aperto tutti i giorni dalle 6:00 alle 23:00.', 'Prova gratis', 'Orari', [['1 200+', 'iscritti'], ['35', 'corsi a settimana'], ['6–23', 'aperto ogni giorno']], 'Corsi della settimana', [['Boxe', 'Lun · Mer · Ven — 55 min', 'Prenota'], ['TRX e Core', 'Mar · Gio — 45 min', 'Prenota']], ['La prima lezione la offriamo noi', 'Prenota una prova']],
      fr: ['Force · Boxe · HIIT — Funchal', 'Plus fort chaque jour', 'Cours avec coach, plateau de musculation et espace récupération. Ouvert tous les jours de 6 h à 23 h.', 'Essai gratuit', 'Planning', [['1 200+', 'membres'], ['35', 'cours par semaine'], ['6–23', 'ouvert tous les jours']], 'Cours de la semaine', [['Boxe', 'Lun · Mer · Ven — 55 min', 'Réserver'], ['TRX & gainage', 'Mar · Jeu — 45 min', 'Réserver']], ['Votre premier cours est offert', 'Réserver un essai']],
      ua: ['Сила · Бокс · HIIT — Фуншал', 'Сильніші щодня', 'Тренування з тренером, зона вільних ваг і відновлення. Працюємо щодня з 6:00 до 23:00.', 'Безкоштовне тренування', 'Розклад', [['1 200+', 'учасників'], ['35', 'занять на тиждень'], ['6–23', 'щодня']], 'Заняття цього тижня', [['Бокс', 'Пн · Ср · Пт — 55 хв', 'Записатися'], ['TRX і кор', 'Вт · Чт — 45 хв', 'Записатися']], ['Перше заняття — від нас', 'Записатися']]
    },
    vinha: {
      pt: ['Adega de vinho Madeira · Funchal', 'Envelhecido junto ao mar', 'Visite a nossa adega histórica e prove Madeiras raros — do Sercial seco à Malvasia doce.', 'Marcar prova', 'Loja de vinhos', [['10–50', 'anos em casco'], ['4', 'castas nobres'], ['Diárias', 'visitas guiadas']], 'Experiências', [['Prova clássica', '4 vinhos · 45 min', '€18'], ['Prova vintage', '3 colheitas raras', '€35']], ['Prove um século de Madeira', 'Reservar']],
      de: ['Madeira-Weinkellerei · Funchal', 'Gereift am Ozean', 'Besuchen Sie unseren historischen Keller und probieren Sie seltenen Madeira — vom trockenen Sercial bis zur süßen Malvasia.', 'Verkostung buchen', 'Weinshop', [['10–50', 'Jahre im Fass'], ['4', 'edle Rebsorten'], ['Täglich', 'Führungen']], 'Erlebnisse', [['Klassische Probe', '4 Weine · 45 Min.', '€18'], ['Jahrgangsprobe', '3 seltene Jahrgänge', '€35']], ['Ein Jahrhundert Madeira probieren', 'Reservieren']],
      es: ['Bodega de vino de Madeira · Funchal', 'Envejecido junto al océano', 'Recorre nuestra bodega histórica y cata Madeiras únicos — del seco Sercial a la dulce Malvasía.', 'Reservar cata', 'Tienda', [['10–50', 'años en barrica'], ['4', 'uvas nobles'], ['A diario', 'visitas guiadas']], 'Experiencias', [['Cata clásica', '4 vinos · 45 min', '€18'], ['Cata de añadas', '3 añadas raras', '€35']], ['Prueba un siglo de Madeira', 'Reservar']],
      it: ['Cantina di vino Madeira · Funchal', 'Invecchiato accanto all’oceano', 'Visita la nostra cantina storica e assaggia Madeira rari — dal secco Sercial alla dolce Malvasia.', 'Prenota una degustazione', 'Shop vini', [['10–50', 'anni in botte'], ['4', 'vitigni nobili'], ['Ogni giorno', 'visite guidate']], 'Esperienze', [['Degustazione classica', '4 vini · 45 min', '€18'], ['Annate rare', '3 annate speciali', '€35']], ['Assaggia un secolo di Madeira', 'Prenota']],
      fr: ['Chai de vin de Madère · Funchal', 'Vieilli face à l’océan', 'Visitez notre chai historique et dégustez des Madère rares — du Sercial sec à la Malvasia douce.', 'Réserver une dégustation', 'Boutique', [['10–50', 'ans en fût'], ['4', 'cépages nobles'], ['Tous les jours', 'visites guidées']], 'Expériences', [['Dégustation classique', '4 vins · 45 min', '18 €'], ['Millésimes', '3 millésimes rares', '35 €']], ['Un siècle de Madère à déguster', 'Réserver']],
      ua: ['Винний льох мадери · Фуншал', 'Витримане біля океану', 'Прогуляйтеся історичним льохом і скуштуйте рідкісну мадеру — від сухого серсіалу до солодкої мальвазії.', 'Записатися на дегустацію', 'Магазин вин', [['10–50', 'років у бочці'], ['4', 'шляхетні сорти'], ['Щодня', 'екскурсії']], 'Враження', [['Класична дегустація', '4 вина · 45 хв', '€18'], ['Вінтажна дегустація', '3 рідкісні роки', '€35']], ['Скуштуйте століття мадери', 'Забронювати']]
    },
    funchal: {
      pt: ['Imobiliária · Madeira', 'Casas com vista para o mar', 'Moradias e apartamentos selecionados no Funchal, Calheta e Ponta do Sol.', 'Ver imóveis', 'Vender connosco', [['240+', 'imóveis'], ['15 anos', 'na ilha'], ['3', 'escritórios']], 'Imóveis em destaque', [['Moradia Calheta', 'T4 · piscina · 280 m²', '€1 250 000'], ['Apartamento vista mar', 'T2 · Funchal', '€420 000']], ['Encontre a sua vista', 'Marcar visita']],
      de: ['Immobilien · Madeira', 'Häuser mit Meerblick', 'Ausgewählte Villen und Wohnungen in Funchal, Calheta und Ponta do Sol.', 'Objekte ansehen', 'Verkaufen', [['240+', 'Angebote'], ['15 J.', 'auf der Insel'], ['3', 'Büros vor Ort']], 'Top-Immobilien', [['Villa Calheta', '4 Zi. · Pool · 280 m²', '€1 250 000'], ['Wohnung mit Meerblick', '2 Zi. · Funchal', '€420 000']], ['Finden Sie Ihren Ausblick', 'Besichtigung buchen']],
      es: ['Inmobiliaria · Madeira', 'Casas con vistas al mar', 'Villas y apartamentos seleccionados en Funchal, Calheta y Ponta do Sol.', 'Ver viviendas', 'Vende con nosotros', [['240+', 'inmuebles'], ['15 años', 'en la isla'], ['3', 'oficinas']], 'Inmuebles destacados', [['Villa Calheta', '4 hab. · piscina · 280 m²', '€1 250 000'], ['Piso con vista al mar', '2 hab. · Funchal', '€420 000']], ['Encuentra tu vista', 'Reservar visita']],
      it: ['Immobiliare · Madeira', 'Case vista oceano', 'Ville e appartamenti selezionati a Funchal, Calheta e Ponta do Sol.', 'Vedi gli immobili', 'Vendi con noi', [['240+', 'immobili'], ['15 anni', 'sull’isola'], ['3', 'agenzie']], 'Immobili in evidenza', [['Villa Calheta', '4 camere · piscina · 280 m²', '€1 250 000'], ['Appartamento vista mare', '2 camere · Funchal', '€420 000']], ['Trova la tua vista', 'Prenota una visita']],
      fr: ['Immobilier · Madère', 'Maisons vue sur l’océan', 'Villas et appartements sélectionnés à Funchal, Calheta et Ponta do Sol.', 'Voir les biens', 'Vendre avec nous', [['240+', 'annonces'], ['15 ans', 'sur l’île'], ['3', 'agences']], 'Biens à la une', [['Villa Calheta', '4 ch. · piscine · 280 m²', '1 250 000 €'], ['Appartement vue mer', '2 ch. · Funchal', '420 000 €']], ['Trouvez votre vue', 'Réserver une visite']],
      ua: ['Нерухомість · Мадейра', 'Будинки з видом на океан', 'Добірні вілли й апартаменти у Фуншалі, Калєті та Понта-ду-Сол.', 'Дивитися об’єкти', 'Продати з нами', [['240+', 'об’єктів'], ['15 років', 'на острові'], ['3', 'офіси']], 'Рекомендовані об’єкти', [['Вілла Калєта', '4 спальні · басейн · 280 м²', '€1 250 000'], ['Апартаменти з видом на море', '2 спальні · Фуншал', '€420 000']], ['Знайдіть свій краєвид', 'Записатися на перегляд']]
    },
    reef: {
      pt: ['Centro de mergulho PADI · Garajau', 'Mergulhe no azul', 'Batismos, cursos PADI e mergulhos de barco numa das águas mais limpas do Atlântico.', 'Reservar mergulho', 'Cursos', [['24 °C', 'água no verão'], ['30 m', 'visibilidade'], ['5★', 'centro PADI']], 'Comece aqui', [['Tartarugas', 'Mergulho de barco · 2 h', '€55'], ['Batismo de mergulho', 'Sem experiência', '€80']], ['A sua primeira respiração debaixo de água', 'Reservar']],
      de: ['PADI-Tauchzentrum · Garajau', 'Ab ins Blaue', 'Schnuppertauchen, PADI-Kurse und Bootstauchgänge in einem der klarsten Gewässer des Atlantiks.', 'Tauchgang buchen', 'Kurse', [['24 °C', 'Wasser im Sommer'], ['30 m', 'Sichtweite'], ['5★', 'PADI-Zentrum']], 'Hier starten', [['Schildkröten treffen', 'Bootstauchgang · 2 Std.', '€55'], ['Discover Scuba', 'Keine Erfahrung nötig', '€80']], ['Ihr erster Atemzug unter Wasser', 'Jetzt buchen']],
      es: ['Centro de buceo PADI · Garajau', 'Sumérgete en el azul', 'Bautismos, cursos PADI e inmersiones en barco en una de las aguas más claras del Atlántico.', 'Reservar inmersión', 'Cursos', [['24 °C', 'agua en verano'], ['30 m', 'visibilidad'], ['5★', 'centro PADI']], 'Empieza aquí', [['Con las tortugas', 'Inmersión en barco · 2 h', '€55'], ['Bautismo de buceo', 'Sin experiencia', '€80']], ['Tu primera respiración bajo el agua', 'Reservar']],
      it: ['Diving center PADI · Garajau', 'Tuffati nel blu', 'Battesimi, corsi PADI e immersioni in barca in una delle acque più limpide dell’Atlantico.', 'Prenota un’immersione', 'Corsi', [['24 °C', 'acqua d’estate'], ['30 m', 'visibilità'], ['5★', 'centro PADI']], 'Inizia da qui', [['Tra le tartarughe', 'Immersione in barca · 2 h', '€55'], ['Battesimo del mare', 'Nessuna esperienza', '€80']], ['Il tuo primo respiro sott’acqua', 'Prenota']],
      fr: ['Centre de plongée PADI · Garajau', 'Plongez dans le bleu', 'Baptêmes, formations PADI et plongées en bateau dans l’une des eaux les plus claires de l’Atlantique.', 'Réserver une plongée', 'Formations', [['24 °C', 'eau en été'], ['30 m', 'visibilité'], ['5★', 'centre PADI']], 'Pour commencer', [['Avec les tortues', 'Plongée bateau · 2 h', '55 €'], ['Baptême de plongée', 'Sans expérience', '80 €']], ['Votre première respiration sous l’eau', 'Réserver']],
      ua: ['Дайв-центр PADI · Гаражау', 'Пориньте в синяву', 'Пробні занурення, курси PADI та занурення з човна в одній з найчистіших вод Атлантики.', 'Забронювати занурення', 'Курси', [['24 °C', 'вода влітку'], ['30 м', 'видимість'], ['5★', 'центр PADI']], 'Почніть тут', [['Зустріч із черепахами', 'З човна · 2 год', '€55'], ['Пробне занурення', 'Без досвіду', '€80']], ['Ваш перший вдих під водою', 'Забронювати']]
    },
    smile: {
      pt: ['Clínica dentária · Funchal', 'O seu sorriso, o nosso cuidado', 'Medicina dentária moderna e suave em português, inglês e alemão — consultas na mesma semana.', 'Marcar consulta', 'Tratamentos', [['12', 'especialistas'], ['Na semana', 'consultas'], ['4.9★', 'avaliação']], 'Tratamentos', [['Consulta e higiene', '45 min', 'desde €60'], ['Alinhadores invisíveis', 'Scan 3D grátis', 'desde €1 900']], ['Sorria com confiança', 'Marcar online']],
      de: ['Zahnklinik · Funchal', 'Ihr Lächeln, unsere Sorge', 'Sanfte, moderne Zahnmedizin auf Portugiesisch, Englisch und Deutsch — Termine noch in derselben Woche.', 'Termin buchen', 'Behandlungen', [['12', 'Fachärzte'], ['Gleiche Woche', 'Termine'], ['4.9★', 'Patientenbewertung']], 'Behandlungen', [['Kontrolle & Prophylaxe', '45 Min.', 'ab €60'], ['Unsichtbare Aligner', 'Gratis 3D-Scan', 'ab €1 900']], ['Lächeln Sie mit Selbstvertrauen', 'Online buchen']],
      es: ['Clínica dental · Funchal', 'Tu sonrisa, nuestro cuidado', 'Odontología moderna y delicada en portugués, inglés y alemán — citas en la misma semana.', 'Pedir cita', 'Tratamientos', [['12', 'especialistas'], ['En la semana', 'citas'], ['4.9★', 'valoración']], 'Tratamientos', [['Revisión e higiene', '45 min', 'desde €60'], ['Alineadores invisibles', 'Escáner 3D gratis', 'desde €1 900']], ['Sonríe con confianza', 'Pedir cita online']],
      it: ['Studio dentistico · Funchal', 'Il tuo sorriso, la nostra cura', 'Odontoiatria moderna e delicata in portoghese, inglese e tedesco — appuntamenti in settimana.', 'Prenota una visita', 'Trattamenti', [['12', 'specialisti'], ['In settimana', 'appuntamenti'], ['4.9★', 'voto dei pazienti']], 'Trattamenti', [['Controllo e igiene', '45 min', 'da €60'], ['Allineatori invisibili', 'Scansione 3D gratuita', 'da €1 900']], ['Sorridi con sicurezza', 'Prenota online']],
      fr: ['Cabinet dentaire · Funchal', 'Votre sourire, notre soin', 'Une dentisterie douce et moderne en portugais, anglais et allemand — rendez-vous dans la semaine.', 'Prendre rendez-vous', 'Soins', [['12', 'spécialistes'], ['Sous 7 jours', 'rendez-vous'], ['4.9★', 'avis patients']], 'Soins', [['Contrôle & détartrage', '45 min', 'dès 60 €'], ['Aligneurs invisibles', 'Scan 3D offert', 'dès 1 900 €']], ['Souriez en toute confiance', 'Réserver en ligne']],
      ua: ['Стоматологія · Фуншал', 'Ваша усмішка — наша турбота', 'Делікатна сучасна стоматологія португальською, англійською та німецькою — запис того ж тижня.', 'Записатися', 'Послуги', [['12', 'лікарів'], ['Цього тижня', 'запис'], ['4.9★', 'оцінка пацієнтів']], 'Послуги', [['Огляд і гігієна', '45 хв', 'від €60'], ['Прозорі елайнери', '3D-скан безкоштовно', 'від €1 900']], ['Усміхайтеся впевнено', 'Записатися онлайн']]
    },
    surf: {
      pt: ['Escola de surf · Porto Moniz', 'Apanhe a sua onda', 'Aulas para iniciantes, aluguer de pranchas e surf camps na costa norte da Madeira.', 'Marcar aula', 'Aluguer', [['8+', 'anos para começar'], ['2 h', 'por aula'], ['Todo', 'o material incluído']], 'Escolha a sua sessão', [['Primeira onda', 'Iniciante · 2 h', '€40'], ['Aula de grupo', 'Até 6 pessoas', '€35']], ['O oceano está a chamar', 'Reservar']],
      de: ['Surfschule · Porto Moniz', 'Erwisch deine Welle', 'Anfängerkurse, Boardverleih und Surfcamps an der wilden Nordküste Madeiras.', 'Kurs buchen', 'Verleih', [['8+', 'Jahre zum Start'], ['2 Std.', 'pro Kurs'], ['Alles', 'Material inklusive']], 'Wähle deine Session', [['Erste Welle', 'Anfänger · 2 Std.', '€40'], ['Gruppenkurs', 'Bis 6 Personen', '€35']], ['Der Ozean ruft', 'Jetzt buchen']],
      es: ['Escuela de surf · Porto Moniz', 'Atrapa tu ola', 'Clases para principiantes, alquiler de tablas y surf camps en la salvaje costa norte de Madeira.', 'Reservar clase', 'Alquiler', [['8+', 'años para empezar'], ['2 h', 'por clase'], ['Todo', 'el material incluido']], 'Elige tu sesión', [['Primera ola', 'Principiante · 2 h', '€40'], ['Clase en grupo', 'Hasta 6 personas', '€35']], ['El océano te llama', 'Reservar']],
      it: ['Scuola di surf · Porto Moniz', 'Prendi la tua onda', 'Lezioni per principianti, noleggio tavole e surf camp sulla selvaggia costa nord di Madeira.', 'Prenota una lezione', 'Noleggio', [['8+', 'anni per iniziare'], ['2 h', 'a lezione'], ['Tutta', 'l’attrezzatura inclusa']], 'Scegli la tua sessione', [['Prima onda', 'Principianti · 2 h', '€40'], ['Lezione di gruppo', 'Fino a 6 persone', '€35']], ['L’oceano ti chiama', 'Prenota']],
      fr: ['École de surf · Porto Moniz', 'Attrapez votre vague', 'Cours débutants, location de planches et surf camps sur la côte nord sauvage de Madère.', 'Réserver un cours', 'Location', [['8+', 'ans pour débuter'], ['2 h', 'par cours'], ['Tout', 'le matériel inclus']], 'Choisissez votre session', [['Première vague', 'Débutant · 2 h', '40 €'], ['Cours collectif', 'Jusqu’à 6 personnes', '35 €']], ['L’océan vous appelle', 'Réserver']],
      ua: ['Школа серфінгу · Порту-Моніш', 'Злови свою хвилю', 'Уроки для початківців, прокат дошок і серф-табори на дикому північному узбережжі Мадейри.', 'Записатися на урок', 'Прокат', [['8+', 'років для старту'], ['2 год', 'урок'], ['Усе', 'спорядження включено']], 'Оберіть заняття', [['Перша хвиля', 'Новачки · 2 год', '€40'], ['Групове заняття', 'До 6 людей', '€35']], ['Океан кличе', 'Забронювати']]
    },
    nomad: {
      pt: ['Coworking · Funchal e Ponta do Sol', 'Trabalhe junto ao mar', 'Fibra rápida, secretárias ergonómicas e uma comunidade de nómadas digitais de mais de 40 países.', 'Passe diário', 'Preços', [['1 Gbps', 'fibra'], ['24/7', 'acesso'], ['40+', 'nacionalidades']], 'Planos', [['Passe diário', 'Secretária + café', '€15 / dia'], ['Semanal', 'Qualquer secretária', '€79 / semana']], ['A sua secretária com vista', 'Juntar-se']],
      de: ['Coworking · Funchal & Ponta do Sol', 'Arbeiten am Meer', 'Schnelles Glasfaser-Internet, ergonomische Tische und eine Community aus über 40 Ländern.', 'Tagespass holen', 'Preise', [['1 Gbit/s', 'Glasfaser'], ['24/7', 'Zugang'], ['40+', 'Nationalitäten']], 'Tarife', [['Tagespass', 'Flex-Desk + Kaffee', '€15 / Tag'], ['Wochenpass', 'Jeder Tisch, jeder Hub', '€79 / Woche']], ['Ihr Schreibtisch mit Aussicht', 'Mitglied werden']],
      es: ['Coworking · Funchal y Ponta do Sol', 'Trabaja junto al océano', 'Fibra rápida, mesas ergonómicas y una comunidad de nómadas digitales de más de 40 países.', 'Pase de día', 'Precios', [['1 Gbps', 'fibra'], ['24/7', 'acceso'], ['40+', 'nacionalidades']], 'Planes', [['Pase de día', 'Mesa flexible + café', '€15 / día'], ['Semanal', 'Cualquier mesa', '€79 / semana']], ['Tu mesa con vistas', 'Únete']],
      it: ['Coworking · Funchal e Ponta do Sol', 'Lavora vicino all’oceano', 'Fibra veloce, scrivanie ergonomiche e una community di nomadi digitali da oltre 40 paesi.', 'Pass giornaliero', 'Prezzi', [['1 Gbps', 'fibra'], ['24/7', 'accesso'], ['40+', 'nazionalità']], 'Piani', [['Pass giornaliero', 'Postazione + caffè', '€15 / giorno'], ['Settimanale', 'Qualsiasi postazione', '€79 / settimana']], ['La tua scrivania vista mare', 'Unisciti']],
      fr: ['Coworking · Funchal & Ponta do Sol', 'Travailler face à l’océan', 'Fibre rapide, bureaux ergonomiques et une communauté de télétravailleurs de plus de 40 pays.', 'Pass journée', 'Tarifs', [['1 Gb/s', 'fibre'], ['24/7', 'accès'], ['40+', 'nationalités']], 'Formules', [['Pass journée', 'Poste libre + café', '15 € / jour'], ['Semaine', 'Tous les postes', '79 € / semaine']], ['Votre bureau avec vue', 'Nous rejoindre']],
      ua: ['Коворкінг · Фуншал і Понта-ду-Сол', 'Працюйте біля океану', 'Швидкий оптоволоконний інтернет, ергономічні столи й спільнота віддалених працівників із 40+ країн.', 'Денний пропуск', 'Ціни', [['1 Гбіт/с', 'інтернет'], ['24/7', 'доступ'], ['40+', 'національностей']], 'Тарифи', [['Денний пропуск', 'Вільне місце + кава', '€15 / день'], ['Тиждень', 'Будь-яке місце', '€79 / тиждень']], ['Ваш стіл із краєвидом', 'Приєднатися']]
    },
    charter: {
      pt: ['Golfinhos e baleias · Funchal', 'Navegue com golfinhos', 'Passeios de catamarã de três horas com um biólogo marinho a bordo — avistamentos todo o ano.', 'Reservar passeio', 'Charter privado', [['95%', 'avistamentos'], ['3 h', 'no mar'], ['28', 'espécies']], 'Passeios', [['Golfinhos', '3 h · catamarã', '€55'], ['Pôr do sol à vela', '2 h · bebidas incluídas', '€45']], ['Conheça os habitantes do Atlântico', 'Reservar lugares']],
      de: ['Delfine & Wale · Funchal', 'Segeln mit Delfinen', 'Dreistündige Katamaranfahrten mit Meeresbiologen an Bord — Sichtungen das ganze Jahr.', 'Tour buchen', 'Privatcharter', [['95%', 'Sichtungsquote'], ['3 Std.', 'auf dem Wasser'], ['28', 'Arten gesichtet']], 'Touren', [['Delfinbeobachtung', '3 Std. · Katamaran', '€55'], ['Sonnenuntergangstörn', '2 Std. · inkl. Getränke', '€45']], ['Treffen Sie die Bewohner des Atlantiks', 'Plätze reservieren']],
      es: ['Delfines y ballenas · Funchal', 'Navega con delfines', 'Salidas de tres horas en catamarán con un biólogo marino a bordo — avistamientos todo el año.', 'Reservar salida', 'Chárter privado', [['95%', 'de avistamientos'], ['3 h', 'en el mar'], ['28', 'especies vistas']], 'Salidas', [['Avistamiento de delfines', '3 h · catamarán', '€55'], ['Velero al atardecer', '2 h · bebidas incluidas', '€45']], ['Conoce a los vecinos del Atlántico', 'Reservar plazas']],
      it: ['Delfini e balene · Funchal', 'Naviga con i delfini', 'Uscite di tre ore in catamarano con un biologo marino a bordo — avvistamenti tutto l’anno.', 'Prenota l’uscita', 'Charter privato', [['95%', 'avvistamenti'], ['3 h', 'in mare'], ['28', 'specie avvistate']], 'Uscite', [['Delfini', '3 h · catamarano', '€55'], ['Vela al tramonto', '2 h · drink inclusi', '€45']], ['Incontra gli abitanti dell’Atlantico', 'Prenota i posti']],
      fr: ['Dauphins & baleines · Funchal', 'Naviguez avec les dauphins', 'Sorties de trois heures en catamaran avec un biologiste marin à bord — observations toute l’année.', 'Réserver une sortie', 'Charter privé', [['95%', 'd’observations'], ['3 h', 'en mer'], ['28', 'espèces vues']], 'Sorties', [['Dauphins', '3 h · catamaran', '55 €'], ['Voile au coucher du soleil', '2 h · boissons incluses', '45 €']], ['Rencontrez les habitants de l’Atlantique', 'Réserver']],
      ua: ['Дельфіни й кити · Фуншал', 'Під вітрилом з дельфінами', 'Тригодинні прогулянки катамараном з морським біологом на борту — зустрічі цілий рік.', 'Забронювати прогулянку', 'Приватний чартер', [['95%', 'зустрічей'], ['3 год', 'у морі'], ['28', 'видів']], 'Прогулянки', [['Дельфіни', '3 год · катамаран', '€55'], ['Захід сонця під вітрилом', '2 год · напої включено', '€45']], ['Познайомтеся з мешканцями Атлантики', 'Забронювати місця']]
    }
  });
  const phoneSite = (id, lang) => {
    const base = byId(id);
    const t = (PTXT[id] && PTXT[id][lang]) || [base.kick, base.h, base.p, base.b1, base.b2, base.stats, base.sec, base.cards.slice(0, 2), base.band];
    const old = t.length === 10;  // [.., labels, sec, all, cards, band]
    return Object.assign({}, base, {
      nav: [], cta: t[3], kick: t[0], h: t[1], p: t[2], b1: t[3], b2: t[4],
      stats: old ? PVALS[id].map((v, i) => [v, t[5][i]]) : t[5],
      sec: t[6], all: old ? t[7] : ALLS[lang], cards: old ? t[8] : t[7], band: old ? t[9] : t[8], about: null, search: null
    });
  };
  const PSITES = SITES.filter(s => s.l !== 'dash').map(s => s.id);
  let openSite = null;

  const IMG = ASSETS + 'img/work/';
  const IW = { hero: 1600, about: 1200, card: 900, prod: 720 };
  const SZ = {
    tile: { full: '440px', half: '220px', card: '150px' },
    modal: { full: 'min(1180px, 94vw)', half: '(max-width: 760px) 94vw, 560px', card: '(max-width: 760px) 94vw, 380px' },
    phone: { full: '220px', half: '220px', card: '220px' }
  };
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pic = (s, slot, kind, sizes, eager) => {
    const b = IMG + s.id + '-' + slot;
    const w = IW[kind];
    return '<img src="' + b + '-sm.webp" srcset="' + b + '-sm.webp ' + (w / 2) + 'w, ' + b + '.webp ' + w + 'w" sizes="' + sizes + '" alt=""' +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
  };

  function sitePage(s, mode) {
    const z = SZ[mode];
    const eager = mode === 'modal';
    if (s.l === 'dash') {
      const max = Math.max(...s.bars);
      return '<div class="ts-page sp-app"><aside><b>' + esc(s.n) + '</b>' + s.menu.map((m, i) => '<a' + (i ? '' : ' class="on"') + '>' + esc(m) + '</a>').join('') + '<small>eu-west-1 · live</small></aside>' +
        '<div class="sp-app__main"><div class="sp-app__top"><h4>Overview</h4><span><i></i>All systems normal</span></div>' +
        '<div class="sp-kpis">' + s.kpis.map(k => '<div><span>' + esc(k[0]) + '</span><b>' + esc(k[1]) + '</b><em>' + esc(k[2]) + '</em></div>').join('') + '</div>' +
        '<div class="sp-chart"><div class="sp-chart__h"><b>Requests / min</b><span>last 14 days</span></div><div class="sp-chart__bars">' +
        s.bars.map(v => '<i style="--h:' + Math.round(v / max * 100) + '%"></i>').join('') + '</div></div>' +
        '<table class="sp-table"><thead><tr><th>Service</th><th>Region</th><th>Status</th><th>p95</th></tr></thead><tbody>' +
        s.rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td><span class="st st--' + (r[2] === 'Healthy' ? 'ok' : r[2] === 'Scaling' ? 'mid' : 'bad') + '">' + esc(r[2]) + '</span></td><td>' + esc(r[3]) + '</td></tr>').join('') +
        '</tbody></table></div></div>';
    }
    const shop = s.l === 'shop';
    const full = s.l === 'full';
    const btns = '<div class="sp-actions"><em class="sp-btn">' + esc(s.b1) + '</em><em class="sp-btn sp-btn--ghost">' + esc(s.b2) + '</em></div>';
    const search = s.search ? '<div class="sp-search">' + s.search.slice(0, 3).map(x => '<span>' + esc(x) + '</span>').join('') + '<em class="sp-btn">' + esc(s.search[3]) + '</em></div>' : '';
    const copy = '<div class="sp-copy"><small class="sp-kick">' + esc(s.kick) + '</small><h4>' + esc(s.h) + '</h4><p>' + esc(s.p) + '</p>' + (search || btns) + '</div>';
    const hero = full
      ? '<section class="sp-hero sp-hero--full">' + pic(s, 'hero', 'hero', z.full, eager) + copy + '</section>'
      : '<section class="sp-hero sp-hero--split">' + copy + '<figure class="sp-media">' + pic(s, 'hero', 'hero', z.half, eager) + '</figure></section>';
    const cards = '<section class="sp-sec"><div class="sp-sec__h"><h5>' + esc(s.sec) + '</h5><span>' + esc(s.all || (shop ? 'View all →' : 'See all →')) + '</span></div><div class="sp-cards' + (shop ? ' sp-cards--prod' : '') + (s.cards.length === 2 ? ' sp-cards--2' : '') + '">' +
      s.cards.map((c, i) => '<article>' + pic(s, (shop ? 'p' : 'c') + (i + 1), shop ? 'prod' : 'card', z.card) + '<div><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span><em>' + esc(c[2]) + '</em></div></article>').join('') +
      '</div></section>';
    const about = s.about ? '<section class="sp-about">' + pic(s, 'about', 'about', z.half) + '<div><h5>' + esc(s.about[0]) + '</h5><p>' + esc(s.about[1]) + '</p><ul>' +
      s.about[2].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></section>' : '';
    return '<div class="ts-page">' +
      '<header class="sp-nav"><b class="sp-logo">' + esc(s.n) + '</b><nav>' + s.nav.map(x => '<a>' + esc(x) + '</a>').join('') + '</nav><em class="sp-btn">' + esc(s.cta) + '</em><i class="sp-burger"></i></header>' +
      hero +
      '<ul class="sp-stats">' + s.stats.map(x => '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>').join('') + '</ul>' +
      cards + about +
      '<section class="sp-band"><h5>' + esc(s.band[0]) + '</h5><em class="sp-btn">' + esc(s.band[1]) + '</em></section>' +
      '<footer class="sp-foot"><b>' + esc(s.n) + '</b><span>© 2026</span><span>Website by NEXGEN</span></footer>' +
      '</div>';
  }
  const siteVars = s => '--bg:' + s.bg + ';--fg:' + s.fg + ';--ac:' + s.ac + ';--bt:' + (s.bt || '#fff') + ';--ff:' + (s.ff || 'var(--fd)');
  function tile(s, k) {
    return '<div class="site" data-k="' + k + '" data-cursor="' + esc(T.view || 'View') + '" style="' + siteVars(s) + '">' +
      '<div class="ts-bar"><i></i><i></i><i></i><span><b>nexgen</b>/' + esc(slug(s)) + '</span></div><div class="ts-view">' + sitePage(s, 'tile') + '</div></div>';
  }

  safe('phones', () => {
    const els = $$('[data-demo]');
    if (!els.length) return;
    const draw = el => {
      const lang = PLANG[+el.dataset.lang % PLANG.length];
      const id = PSITES[+el.dataset.site % PSITES.length];
      const tag = el.parentNode.querySelector('.ph__tag');
      if (tag) tag.textContent = lang.toUpperCase();
      const s = phoneSite(id, lang);
      el.innerHTML = '<div class="site site--phone" lang="' + (lang === 'ua' ? 'uk' : lang) + '" style="' + siteVars(s) + '"><div class="ts-view">' + sitePage(s, 'phone') + '</div></div>';
    };
    els.forEach((el, i) => {
      el.dataset.site = i;
      draw(el);
      // tap a phone to open that site full-screen
      const ph = el.parentNode;
      ph.dataset.cursor = T.view || 'View';
      ph.addEventListener('click', () => { if (openSite) openSite(SITES.findIndex(s => s.id === PSITES[+el.dataset.site % PSITES.length])); });
    });
    if (reduce) return;
    // each flip brings the next portfolio site in the next language: three different sites, three different languages on screen
    let on = false;
    let k = 0;
    let next = Math.max(...els.map(el => +el.dataset.lang)) + 1;
    let nextSite = els.length;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(els[0].closest('.vis') || els[0]);
    setInterval(() => {
      if (!on || document.hidden) return;
      const el = els[k % els.length];
      k++;
      const used = els.filter(x => x !== el).map(x => +x.dataset.lang % PLANG.length);
      while (used.includes(next % PLANG.length)) next++;
      const lang = next % PLANG.length;
      next++;
      const site = nextSite % PSITES.length;
      nextSite++;
      el.parentNode.classList.add('is-flip');
      setTimeout(() => {
        el.dataset.lang = lang;
        el.dataset.site = site;
        draw(el);
        el.parentNode.classList.remove('is-flip');
      }, 380);
    }, 2600);
  });

  safe('reel', () => {
    const sec = $('.reel');
    const rows = $$('.reel__row');
    if (!sec || rows.length < 2) return;
    const half = Math.ceil(SITES.length / 2);
    const sets = [[0, half], [half, SITES.length]];
    rows.forEach((row, i) => {
      const h = SITES.slice(sets[i][0], sets[i][1]).map((s, j) => tile(s, sets[i][0] + j)).join('');
      row.innerHTML = h + h + h;
    });
    const setW = [0, 0];
    let top = 0;
    let h = 0;
    onMeasure(() => {
      rows.forEach((row, i) => { setW[i] = row.scrollWidth / 3; });
      top = docTop(sec); h = sec.offsetHeight;
    });
    // pause the drift while a page is being looked at
    let hold = false;
    const box = $('.reel__rows');
    if (fine) {
      box.addEventListener('pointerover', e => { hold = !!e.target.closest('.site'); });
      box.addEventListener('pointerleave', () => { hold = false; });
    }
    let drift = 0;
    let speed = 0.35;
    let skew = 0;
    const mod = (a, b) => ((a % b) + b) % b;
    onFrame(() => {
      if (S.y + S.vh < top - 100 || S.y > top + h + 100) return;
      speed += ((hold ? 0 : 0.35) - speed) * 0.06;
      if (!reduce) drift += speed;
      skew += (clamp(-S.vy * 0.12, -7, 7) - skew) * 0.12;
      const off = (S.y - top + S.vh) * 0.3 + drift;
      const x0 = -setW[0] + mod(off, setW[0] || 1);
      const x1 = -mod(off, setW[1] || 1);
      const sk = reduce ? '' : ' skewX(' + skew.toFixed(2) + 'deg)';
      rows[0].style.transform = 'translate3d(' + x0.toFixed(1) + 'px,0,0)' + sk;
      rows[1].style.transform = 'translate3d(' + x1.toFixed(1) + 'px,0,0)' + sk;
    });
  });

  /* ---------- site viewer: open any concept as a full, scrollable page ---------- */
  safe('viewer', () => {
    const box = $('.reel__rows');
    if (!box) return;
    const v = document.createElement('div');
    v.className = 'sv';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-modal', 'true');
    v.setAttribute('aria-hidden', 'true');
    v.inert = true;
    v.innerHTML =
      '<div class="sv__back" data-close></div>' +
      '<div class="sv__box">' +
      '<div class="sv__win"><div class="sv__bar"><i></i><i></i><i></i><span class="sv__url"></span><small class="sv__tag mono">' + esc(T.concept || 'Concept') + '</small>' +
      '<button class="sv__x" type="button" data-close aria-label="' + esc(T.close || 'Close') + '"><span></span><span></span></button></div>' +
      '<div class="sv__scroll" data-lenis-prevent tabindex="0"></div></div>' +
      '<div class="sv__foot"><div class="sv__nav"><button type="button" class="sv__arr" data-step="-1" aria-label="' + esc(T.prev || 'Previous') + '">←</button>' +
      '<span class="sv__count mono"></span><button type="button" class="sv__arr" data-step="1" aria-label="' + esc(T.next || 'Next') + '">→</button></div>' +
      '<a class="btn btn--grad btn--sm" href="#contact" data-close><span class="btn__in">' + esc(T.want || 'Want a site like this?') + '<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span></a></div>' +
      '</div>';
    document.body.append(v);
    const scroller = $('.sv__scroll', v);
    const url = $('.sv__url', v);
    const count = $('.sv__count', v);
    let cur = -1;
    let back = null;
    const show = k => {
      cur = (k + SITES.length) % SITES.length;
      const s = SITES[cur];
      url.innerHTML = '<b>nexgen</b>/' + esc(slug(s));
      count.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(SITES.length).padStart(2, '0');
      v.setAttribute('aria-label', s.n);
      scroller.innerHTML = '<div class="site site--full" style="' + siteVars(s) + '">' + sitePage(s, 'modal') + '</div>';
      scroller.style.background = s.bg;
      scroller.scrollTop = 0;
    };
    // the opened site is a step in browser history: the phone's Back button (or browser Back) returns to the portfolio
    const base = () => location.pathname + location.search;
    const hashOf = k => '#view-' + SITES[(k + SITES.length) % SITES.length].id;
    let after = null;
    let yOpen = 0;
    const openUI = k => {
      back = document.activeElement;
      yOpen = window.scrollY;
      scroller.dataset.dir = '';
      show(k);
      v.inert = false;
      v.setAttribute('aria-hidden', 'false');
      v.classList.add('is-open');
      doc.classList.add('sv-open');
      lock(true);
      setTimeout(() => scroller.focus({ preventScroll: true }), 60);
    };
    const closeUI = () => {
      if (!v.classList.contains('is-open')) return;
      v.classList.remove('is-open');
      doc.classList.remove('sv-open');
      v.setAttribute('aria-hidden', 'true');
      v.inert = true;
      lock(false);
      // stay exactly where the visitor was in the portfolio
      if (lenis) lenis.scrollTo(yOpen, { immediate: true, force: true }); else window.scrollTo(0, yOpen);
      requestAnimationFrame(() => { if (Math.abs(window.scrollY - yOpen) > 2) window.scrollTo(0, yOpen); });
      if (back && back.focus) back.focus({ preventScroll: true });
    };
    openSite = k => open(k);
    const open = k => {
      openUI(k);
      try { history.pushState({ sv: cur }, '', base() + hashOf(cur)); } catch (e) { /* file:// or sandbox */ }
    };
    const close = then => {
      if (!v.classList.contains('is-open')) return;
      after = then || null;
      if (history.state && history.state.sv != null) { history.back(); return; }
      closeUI();
      if (after) { after(); after = null; }
    };
    const step = d => {
      scroller.dataset.dir = d > 0 ? 'next' : 'prev';
      show(cur + d);
      try { history.replaceState({ sv: cur }, '', base() + hashOf(cur)); } catch (e) { /* ignore */ }
    };
    // swipe left / right on the opened site flips to the next / previous one (vertical scrolling stays native)
    let sw = null;
    scroller.addEventListener('touchstart', e => {
      const t = e.touches[0];
      sw = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: performance.now() } : null;
    }, { passive: true });
    scroller.addEventListener('touchend', e => {
      if (!sw) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sw.x;
      const dy = t.clientY - sw.y;
      const fast = performance.now() - sw.t < 700;
      sw = null;
      if (fast && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    window.addEventListener('popstate', e => {
      const st = e.state;
      if (st && st.sv != null) { if (v.classList.contains('is-open')) show(st.sv); else openUI(st.sv); return; }
      closeUI();
      if (after) { const fn = after; after = null; setTimeout(fn, 40); }
    });
    // a shared link like /#view-volt opens that site straight away; Back then lands on the portfolio
    const deep = SITES.findIndex(s => location.hash === '#view-' + s.id);
    if (deep >= 0) {
      try { history.replaceState(null, '', base()); } catch (e) { /* ignore */ }
      setTimeout(() => open(deep), 300);
    }
    box.addEventListener('click', e => {
      const t = e.target.closest('.site[data-k]');
      if (t) open(+t.dataset.k);
    });
    v.addEventListener('click', e => {
      const cta = e.target.closest('a[href="#contact"]');
      if (cta) {
        e.preventDefault();
        e.stopPropagation();
        const target = $('#contact');
        close(() => {
          if (lenis) lenis.scrollTo(target, { duration: 1.5 });
          else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        });
        return;
      }
      if (e.target.closest('[data-close]')) close();
      const st = e.target.closest('[data-step]');
      if (st) step(+st.dataset.step);
    });
    document.addEventListener('keydown', e => {
      if (!v.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Tab') {
        const f = $$('button, a[href], [tabindex="0"]', v);
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  });

  /* ==========================================================================
     ABOUT — scroll-lit text, counters, floating shapes
     ========================================================================== */
  safe('about', () => {
    const p = $('[data-chars]');
    if (p && !reduce) {
      const chars = splitPlain(p);
      const N = chars.length;
      const last = new Float32Array(N).fill(-1);
      let top = 0;
      let h = 0;
      onMeasure(() => { top = docTop(p); h = p.offsetHeight; });
      onFrame(() => {
        if (S.y + S.vh < top - 50 || S.y > top + h + 50) return;
        // offset ['start 0.8', 'end 0.2']
        const prog = clamp((S.y - (top - S.vh * 0.8)) / (h + S.vh * 0.6), 0, 1);
        const W = Math.max(8, N * 0.12);
        const head = prog * (N + W);
        for (let i = 0; i < N; i++) {
          const o = 0.16 + 0.84 * clamp((head - i) / W, 0, 1);
          if (Math.abs(o - last[i]) > 0.01) { chars[i].style.opacity = o.toFixed(3); last[i] = o; }
        }
      });
    }

    // counters
    const nums = $$('[data-count]');
    const cio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const el = e.target;
      const end = +el.dataset.count;
      if (reduce) { el.textContent = end; return; }
      const t0 = performance.now();
      const d = 1900;
      const step = now => {
        const k = clamp((now - t0) / d, 0, 1);
        el.textContent = k >= 1 ? end : Math.round(end * (1 - Math.pow(2, -10 * k)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.6 });
    nums.forEach(el => { if (!reduce) el.textContent = '0'; cio.observe(el); });

    // floating shapes parallax
    const shapes = $$('.shape[data-depth]');
    const sec = $('.about');
    if (shapes.length && sec && !reduce) {
      let top = 0;
      onMeasure(() => { top = docTop(sec); });
      onFrame(() => {
        const rel = S.y + S.vh - top;
        if (rel < -200 || rel > sec.offsetHeight + S.vh * 2) return;
        shapes.forEach(s => {
          const d = +s.dataset.depth;
          s.style.translate = '0 ' + (rel * d * -0.35).toFixed(1) + 'px';
        });
      });
    }
  });

  /* ---------- services: touch devices highlight the row in focus ---------- */
  /* ---------- services: on touch a tap highlights the row; the arrow opens the brief with that service ticked ---------- */
  safe('services', () => {
    const items = $$('.svc__item');
    const chips = $$('#brief input[name="need"]');
    items.forEach(it => {
      const link = $('.svc__link', it);
      const arrow = $('.svc__arrow', it);
      if (!link) return;
      link.addEventListener('click', e => {
        if (!fine && e.detail > 0 && arrow) {
          const r = arrow.getBoundingClientRect();
          const pad = 16;
          const onArrow = e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
          if (!onArrow) {
            e.preventDefault();
            e.stopPropagation();
            items.forEach(x => x.classList.toggle('is-on', x === it));
            return;
          }
        }
        (link.dataset.chips || '').split(',').filter(Boolean).forEach(k => { if (chips[+k]) chips[+k].checked = true; });
      });
    });
  });

  /* ==========================================================================
     WORK — sticky stacking cards
     ========================================================================== */
  safe('stack', () => {
    const stack = $('.stack');
    if (!stack || reduce) return;
    const cards = $$('.card', stack);
    const N = cards.length;
    let top = 0;
    let h = 0;
    onMeasure(() => { top = docTop(stack); h = stack.offsetHeight; });
    onFrame(() => {
      const range = h - S.vh;
      const y = S.y - top;
      if (range <= 0 || y < -S.vh || y > h) return;
      const p = clamp(y / range, 0, 1);
      for (let i = 0; i < N - 1; i++) {
        const start = i / (N - 1);
        const local = clamp((p - start) / (1 - start), 0, 1);
        const target = 1 - (N - 1 - i) * 0.045;
        cards[i].style.transform = 'scale(' + (1 - local * (1 - target)).toFixed(4) + ')';
        cards[i].style.setProperty('--shade', (local * 0.55).toFixed(3));
      }
    });
  });

  /* live terminal + throughput sparkline */
  safe('stream', () => {
    const body = $('[data-stream]');
    if (!body) return;
    const rate = $('[data-rate]');
    const line = $('[data-spark]');
    const area = $('[data-spark-area]');
    let on = false;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(body);
    const vals = Array.from({ length: 42 }, (_, i) => 9600 + Math.sin(i / 3) * 260 + Math.random() * 160);
    const shards = ['shard-01', 'shard-02', 'shard-03', 'shard-04'];
    const pad = n => String(n).padStart(2, '0');
    const draw = () => {
      const min = 8800;
      const max = 10600;
      const pts = vals.map((v, i) => [(i / (vals.length - 1)) * 300, 58 - ((v - min) / (max - min)) * 54]);
      const d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
      if (line) line.setAttribute('d', d);
      if (area) area.setAttribute('d', d + ' L300 60 L0 60 Z');
    };
    const push = () => {
      const now = new Date();
      const ts = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + '.' + String(now.getMilliseconds()).padStart(3, '0');
      const sh = shards[Math.floor(Math.random() * shards.length)];
      const batch = 256 * (1 + Math.floor(Math.random() * 4));
      const ms = (1.4 + Math.random() * 3.2).toFixed(1);
      const el = document.createElement('div');
      el.innerHTML = '<span class="t">' + ts + '</span> <span class="k">' + sh + '</span> ▸ batch ' + batch + ' <span class="ok">✓</span> ' + ms + 'ms → <span class="s">s3://cold/' + now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + Math.random().toString(16).slice(2, 8) + '.parquet</span>';
      body.append(el);
      while (body.children.length > 16) body.firstChild.remove();
      const nv = clamp(vals[vals.length - 1] + (Math.random() - 0.48) * 380, 8900, 10500);
      vals.push(nv); vals.shift();
      if (rate) rate.textContent = Math.round(nv).toLocaleString('en-US').replace(',', ' ');
      draw();
    };
    for (let i = 0; i < 9; i++) push();
    if (!reduce) setInterval(() => { if (on && !document.hidden) push(); }, 520);
  });

  /* ==========================================================================
     PROCESS — horizontal scroll on desktop, timeline on mobile
     ========================================================================== */
  safe('process', () => {
    const sec = $('.process');
    const track = $('.process__track');
    const bar = $('.process__bar');
    if (!sec || !track) return;
    const mq = matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
    let horiz = false;
    let dist = 0;
    let top = 0;
    let tTop = 0;
    let tH = 1;
    onLayout(() => {
      horiz = mq.matches;
      if (horiz) {
        track.style.transform = '';
        dist = Math.max(0, track.scrollWidth - window.innerWidth);
        sec.style.height = (dist + window.innerHeight) + 'px';
      } else {
        sec.style.height = '';
        track.style.transform = '';
      }
    });
    onMeasure(() => { top = docTop(sec); tTop = docTop(track); tH = Math.max(1, track.offsetHeight); });
    onFrame(() => {
      if (horiz) {
        const y = S.y - top;
        if (y < -S.vh || y > dist + S.vh) return;
        const p = clamp(y / (dist || 1), 0, 1);
        track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
        if (bar) bar.style.setProperty('--p', p.toFixed(4));
      } else {
        const p = clamp((S.y + S.vh * 0.7 - tTop) / tH, 0, 1);
        track.style.setProperty('--p', p.toFixed(4));
      }
    });
  });

  /* ==========================================================================
     WHY — bento interactions
     ========================================================================== */
  safe('bento', () => {
    const bento = $('.bento');
    if (!bento) return;
    const tiles = $$('.tile', bento);
    if (fine) {
      bento.addEventListener('pointermove', e => {
        tiles.forEach(t => {
          const r = t.getBoundingClientRect();
          t.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
          t.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
        });
      });
    }

    // AI answer typing
    const bub = $('.bub--a');
    const ans = bub && $('.ans', bub);
    if (ans && !reduce) {
      const html = ans.innerHTML;
      const text = ans.textContent;
      let busy = false;
      let seen = false;
      const run = () => {
        if (busy) return;
        busy = true;
        ans.textContent = '';
        bub.classList.add('is-typing');
        setTimeout(() => {
          bub.classList.remove('is-typing');
          ans.classList.add('caret');
          let i = 0;
          const iv = setInterval(() => {
            i += 2;
            ans.textContent = text.slice(0, i);
            if (i >= text.length) {
              clearInterval(iv);
              ans.innerHTML = html;
              ans.classList.remove('caret');
              setTimeout(() => { busy = false; }, 7000);
            }
          }, 28);
        }, 1300);
      };
      let vis = false;
      new IntersectionObserver(([e]) => {
        vis = e.isIntersecting;
        if (vis && !seen) { seen = true; run(); }
      }, { threshold: 0.5 }).observe(bub);
      setInterval(() => { if (vis && !document.hidden) run(); }, 9000);
    }

    // greetings
    const hello = $('.hello');
    if (hello && !reduce) {
      const words = (hello.dataset.words || '').split('|');
      const flags = $$('.flags span');
      let k = 0;
      let vis = false;
      new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(hello);
      setInterval(() => {
        if (!vis || document.hidden) return;
        const cur = $('span', hello);
        cur.classList.add('is-out');
        k = (k + 1) % words.length;
        setTimeout(() => {
          cur.textContent = words[k];
          cur.classList.remove('is-out');
          cur.classList.add('is-in');
          void cur.offsetWidth;
          cur.classList.remove('is-in');
          flags.forEach((f, i) => f.classList.toggle('is-on', i === k));
        }, 420);
      }, 1700);
    }
  });

  /* ---------- FAQ smooth accordion ---------- */
  safe('faq', () => {
    $$('details.qa').forEach(d => {
      const sum = $('summary', d);
      const body = $('.qa__a', d);
      sum.addEventListener('click', e => {
        if (reduce || !body.animate) return;
        e.preventDefault();
        if (d.open) {
          d.classList.add('is-closing');
          const a = body.animate([{ height: body.offsetHeight + 'px' }, { height: '0px' }], { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
          a.onfinish = () => { d.open = false; d.classList.remove('is-closing'); a.cancel(); };
        } else {
          d.open = true;
          body.animate([{ height: '0px', opacity: 0 }, { height: body.offsetHeight + 'px', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      });
    });
  });

  /* ---------- contact brief → WhatsApp / Telegram ---------- */
  safe('brief', () => {
    const f = $('#brief');
    if (!f) return;
    const toast = $('.toast');
    const wa = f.dataset.wa;
    const tg = f.dataset.tg;
    const compose = () => {
      const who = (f.elements.namedItem('who').value || '').trim();
      const msg = (f.elements.namedItem('msg').value || '').trim();
      const needs = $$('input[name="need"]:checked', f).map(i => i.value);
      let s = T.hi || 'Hi Oleh! ';
      if (who) s += (T.me || 'My name is {name}. ').replace('{name}', who);
      if (needs.length) s += (T.need || "I'm interested in: {list}. ").replace('{list}', needs.join(', '));
      if (msg) s += msg;
      else if (!needs.length) s += T.def || "I'd like to discuss a project.";
      return s.trim();
    };
    const say = text => {
      if (!toast) return;
      toast.textContent = text;
      toast.classList.add('is-on');
      clearTimeout(say.t);
      say.t = setTimeout(() => toast.classList.remove('is-on'), 3200);
    };
    f.addEventListener('submit', e => {
      e.preventDefault();
      window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(compose()), '_blank', 'noopener');
    });
    const tgBtn = $('[data-tg]', f);
    if (tgBtn) {
      tgBtn.addEventListener('click', () => {
        const text = compose();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => say(T.copied || 'Copied'), () => {});
        window.open('https://t.me/' + tg, '_blank', 'noopener');
      });
    }
  });

  /* ---------- footer giant word ---------- */
  safe('footer', () => {
    const box = $('.footer__giant');
    const word = box && $('span', box);
    if (!word) return;
    onLayout(() => fit(word, box));
    let top = 0;
    let h = 1;
    onMeasure(() => { top = docTop(word); h = Math.max(1, word.offsetHeight); });
    onFrame(() => {
      const rel = S.y + S.vh - top;
      if (rel < -50) return;
      const p = clamp(rel / (h * 1.05), 0, 1);
      word.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
    });
  });

  /* ==========================================================================
     POINTER polish — cursor, magnetic buttons, tilt, ripples
     ========================================================================== */
  safe('cursor', () => {
    if (!fine) return;
    const c = $('.cursor');
    if (!c) return;
    const dot = $('.cursor__dot', c);
    const ring = $('.cursor__ring', c);
    const label = $('.cursor__label', c);
    doc.classList.add('has-cursor');
    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      c.classList.add('is-on');
    }, { passive: true });
    document.addEventListener('mouseleave', () => c.classList.remove('is-on'));
    window.addEventListener('pointerdown', () => c.classList.add('is-down'));
    window.addEventListener('pointerup', () => c.classList.remove('is-down'));
    document.addEventListener('pointerover', e => {
      const t = e.target;
      const lab = t.closest('[data-cursor]');
      const txt = t.closest('input, textarea');
      const link = t.closest('a, button, summary, label, .chip');
      c.classList.toggle('is-label', !!lab);
      c.classList.toggle('is-text', !!txt && !lab);
      c.classList.toggle('is-link', !!link && !lab && !txt);
      if (lab) label.textContent = lab.dataset.cursor;
    });
    onFrame(() => {
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    });
  });

  safe('magnetic', () => {
    if (!fine || reduce) return;
    $$('.magnetic').forEach(el => {
      const inner = $('.btn__in', el);
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate3d(' + (dx * 0.28).toFixed(1) + 'px,' + (dy * 0.38).toFixed(1) + 'px,0)';
        if (inner) inner.style.transform = 'translate3d(' + (dx * 0.12).toFixed(1) + 'px,' + (dy * 0.16).toFixed(1) + 'px,0)';
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
        if (inner) inner.style.transform = '';
      });
    });
  });

  safe('tilt', () => {
    if (!fine || reduce) return;
    $$('[data-tilt]').forEach(el => {
      const inner = el.firstElementChild;
      if (!inner) return;
      el.style.perspective = '1200px';
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transform = 'rotateY(' + (px * 7).toFixed(2) + 'deg) rotateX(' + (-py * 7).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    });
  });

  safe('ripple', () => {
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest('.btn, .fab, .chip span');
      if (!b || reduce) return;
      const r = b.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
      b.style.overflow = 'hidden';
      b.append(s);
      setTimeout(() => s.remove(), 750);
    }, { passive: true });
  });

  measure();
})();
