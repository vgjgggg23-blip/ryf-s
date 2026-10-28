/* نجوم متحركة تتفاعل مع الماوس + إضاءة البطاقات + ظهور تدريجي */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- النجوم ---------- */
  var cv = document.getElementById('fx');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, stars = [], shoots = [], sparks = [], trail = [];
    var mouse = { x: -9999, y: -9999, on: false };
    var par = { x: 0, y: 0, tx: 0, ty: 0 };
    var A = [109, 124, 255], B = [243, 185, 74];
    var last = 0, nextShoot = 1200, running = true;

    function rgb(v, fb) {
      v = (v || '').trim();
      var m = /^#([0-9a-f]{6})$/i.exec(v);
      return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : fb;
    }
    function readColors() {
      var cs = getComputedStyle(root);
      A = rgb(cs.getPropertyValue('--accent'), A);
      B = rgb(cs.getPropertyValue('--gold'), B);
    }
    var c = function (col, a) { return 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')'; };

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.max(60, Math.min(240, Math.round((W * H) / 7500)));
      stars = [];
      for (var i = 0; i < n; i++) {
        var z = 0.25 + Math.random() * 0.75;
        var k = Math.random();
        stars.push({
          x: Math.random() * W, y: Math.random() * H, z: z,
          r: 0.5 + z * 1.1 * (Math.random() < 0.08 ? 1.6 : 1),
          ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.8,
          vy: 0.004 + z * 0.012,
          col: [255, 255, 255],
          ox: 0, oy: 0, vx: 0, vv: 0,
        });
      }
    }

    function shoot() {
      var fromLeft = Math.random() < 0.5;
      var ang = (fromLeft ? 20 : 160) * Math.PI / 180 + (Math.random() - 0.5) * 0.3;
      var sp = 0.7 + Math.random() * 0.6;
      shoots.push({
        x: Math.random() * W * 0.8 + W * 0.1, y: -20 + Math.random() * H * 0.4,
        dx: Math.cos(ang) * sp, dy: Math.sin(ang) * sp, life: 1, col: Math.random() < 0.5 ? A : B,
      });
    }

    function burst(x, y) {
      return; /* شرارات النقر معطّلة */
      for (var i = 0; i < 18; i++) {
        var a = Math.random() * 6.28, s = 0.05 + Math.random() * 0.25;
        sparks.push({ x: x, y: y, dx: Math.cos(a) * s, dy: Math.sin(a) * s, life: 1, col: Math.random() < 0.5 ? A : B });
      }
    }

    function frame(t) {
      if (!running) return;
      var dt = Math.min(48, t - last || 16); last = t;
      ctx.clearRect(0, 0, W, H);
      par.x += (par.tx - par.x) * 0.05; par.y += (par.ty - par.y) * 0.05;
      ctx.globalCompositeOperation = 'lighter';

      /* وهج حول المؤشر */
      if (false && mouse.on) {
        var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 230);
        g.addColorStop(0, c(A, 0.22)); g.addColorStop(0.5, c(B, 0.06)); g.addColorStop(1, c(A, 0));
        ctx.fillStyle = g; ctx.fillRect(mouse.x - 230, mouse.y - 230, 460, 460);
      }

      var R = 170, near = [];
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!reduce) {
          s.y += s.vy * dt; if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
        }
        var px = s.x + s.ox + par.x * s.z * 40, py = s.y + s.oy + par.y * s.z * 40;
        var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.sp + s.ph);
        var a = tw * (0.5 + s.z * 0.5), r = s.r;

        if (mouse.on) {
          var dx = px - mouse.x, dy = py - mouse.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) {
            var f = (1 - d / R);
            s.vx += (dx / (d || 1)) * f * 0.9; s.vv += (dy / (d || 1)) * f * 0.9;
            a = Math.min(1, a + f * 0.8); r += f * 1.6;
            near.push({ x: px, y: py, f: f, col: s.col });
          }
        }
        s.vx += -s.ox * 0.035; s.vv += -s.oy * 0.035;
        s.vx *= 0.9; s.vv *= 0.9; s.ox += s.vx; s.oy += s.vv;

        if (false) { /* بدون توهج: نقاط بيضاء فقط */
          ctx.fillStyle = c(s.col, a * 0.22);
          ctx.beginPath(); ctx.arc(px, py, r * 4.2, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = c(s.col, a);
        ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill();
      }

      /* خطوط النيون: المؤشر ↔ النجوم القريبة، والنجوم القريبة ببعضها */
      if (false && near.length) { /* خطوط الشبكة حول الماوس معطّلة */
        ctx.lineWidth = 1;
        for (var j = 0; j < near.length; j++) {
          var p = near[j];
          ctx.strokeStyle = c(A, p.f * 0.7);
          ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          for (var k = j + 1; k < near.length; k++) {
            var q = near[k], ddx = p.x - q.x, ddy = p.y - q.y, dd = ddx * ddx + ddy * ddy;
            if (dd < 90 * 90) {
              ctx.strokeStyle = c(B, Math.min(p.f, q.f) * (1 - Math.sqrt(dd) / 90) * 0.8);
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            }
          }
        }
      }

      /* ذيل المؤشر */
      for (var m = trail.length - 1; m >= 0; m--) {
        var tr = trail[m]; tr.life -= dt * 0.0017;
        if (tr.life <= 0) { trail.splice(m, 1); continue; }
        ctx.fillStyle = c(tr.col, tr.life * 0.7);
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 1 + tr.life * 2.6, 0, 6.283); ctx.fill();
      }

      /* شهب */
      if (!reduce) {
        nextShoot -= dt;
        if (nextShoot <= 0) { nextShoot = 1e12; /* الشهب معطّلة */ }
      }
      for (var n = shoots.length - 1; n >= 0; n--) {
        var sh = shoots[n];
        sh.x += sh.dx * dt; sh.y += sh.dy * dt; sh.life -= dt * 0.0006;
        if (sh.life <= 0 || sh.x < -200 || sh.x > W + 200 || sh.y > H + 50) { shoots.splice(n, 1); continue; }
        var tx = sh.x - sh.dx * 150, ty = sh.y - sh.dy * 150;
        var lg = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
        lg.addColorStop(0, c(sh.col, sh.life)); lg.addColorStop(1, c(sh.col, 0));
        ctx.strokeStyle = lg; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = c([255, 255, 255], sh.life);
        ctx.beginPath(); ctx.arc(sh.x, sh.y, 2, 0, 6.283); ctx.fill();
      }

      /* شرارات النقر */
      for (var o = sparks.length - 1; o >= 0; o--) {
        var sp = sparks[o];
        sp.x += sp.dx * dt; sp.y += sp.dy * dt; sp.life -= dt * 0.0015;
        if (sp.life <= 0) { sparks.splice(o, 1); continue; }
        ctx.fillStyle = c(sp.col, sp.life);
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 1 + sp.life * 2, 0, 6.283); ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }

    function move(x, y) {
      mouse.x = x; mouse.y = y; mouse.on = true;
      par.tx = (x / W - 0.5) * -1; par.ty = (y / H - 0.5) * -1;
      /* أثر الماوس معطّل */
    }
    window.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('pointerdown', function (e) { move(e.clientX, e.clientY); burst(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') mouse.on = false; }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.on = false; });
    window.addEventListener('resize', build);
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) { last = performance.now(); requestAnimationFrame(frame); }
    });

    readColors(); build();
    requestAnimationFrame(frame);
  }

  /* ---------- إضاءة البطاقات تتبع الماوس ---------- */
  var SEL = '.hcard,.store,.tile,.person,.srv,.review,.box,.acct,.summary,.mv > div';
  var raf = 0, ev = null;
  document.addEventListener('pointermove', function (e) {
    ev = e;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var el = ev.target.closest && ev.target.closest(SEL);
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      el.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    });
  }, { passive: true });
  document.addEventListener('pointerout', function (e) {
    var el = e.target.closest && e.target.closest(SEL);
    if (el && !el.contains(e.relatedTarget)) { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); }
  });

  /* ---------- ظهور تدريجي ---------- */
  if (!reduce && 'IntersectionObserver' in window && !/^\/admin/.test(location.pathname)) {
    var items = document.querySelectorAll('main .tile,main .person,main .srv,main .review,main .acct,main .box,main .store,main .mv > div,main .sec-head');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        setTimeout(function () {
          el.classList.add('in');
          setTimeout(function () { el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; }, 900);
        }, +el.dataset.d || 0);
      });
    }, { threshold: 0.08 });
    items.forEach(function (el, i) { el.classList.add('rv'); el.dataset.d = (i % 6) * 70; io.observe(el); });
  }
})();
