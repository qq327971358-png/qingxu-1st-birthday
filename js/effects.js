/* 交互特效：3D tilt / 彩带 / 烟花 / 摇一摇 */
(function () {
  'use strict';

  var canvas = document.getElementById('fx-canvas');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  var pieces = [];
  var rafId = null;
  var lastTime = 0;
  var COLORS = ['#ffd6e2', '#ffe3d0', '#fff6f2', '#f6b6c9', '#e9a3bb', '#ffd0a8', '#f3c4d4', '#ffeaf2'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', function () {
    clearTimeout(resize._t);
    resize._t = setTimeout(resize, 180);
  });
  resize();

  function addPiece(o) {
    pieces.push({
      x: o.x, y: o.y,
      vx: o.vx, vy: o.vy,
      g: o.g === undefined ? 0.14 : o.g,
      drag: o.drag === undefined ? 0.995 : o.drag,
      w: o.w || 6, h: o.h || 4, r: o.r || 2.5,
      maxR: o.maxR || 60,
      rot: o.rot || 0, vr: o.vr || 0,
      color: o.color || pick(COLORS),
      shape: o.shape || 'rect',
      life: 1,
      ttl: o.ttl || 110,
      add: !!o.add
    });
  }

  function loop(now) {
    if (!lastTime) lastTime = now;
    var dt = Math.min(now - lastTime, 48) / 16.67;
    lastTime = now;

    ctx.clearRect(0, 0, W, H);

    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rot += p.vr * dt;
      p.life -= dt / p.ttl;

      if (p.life <= 0 || p.y > H + 80) {
        pieces.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 3 * p.life);
        ctx.beginPath();
        ctx.arc(0, 0, p.maxR * (1 - p.life) + 6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        // 拖尾光条，营造烟花爆裂感
        if (p.add) {
          var tx = -p.vx * 2.4;
          var ty = -p.vy * 2.4;
          if (tx * tx + ty * ty > 4) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(1, p.r * 0.9);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(0, 0);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (pieces.length) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function ensureLoop() {
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(loop);
    }
  }

  function confetti(count) {
    var n = count || (W < 420 ? 120 : 170);
    var i;
    // 左右两侧礼炮
    for (i = 0; i < n * 0.42; i++) {
      var left = i % 2 === 0;
      var ang = left ? rand(-Math.PI * 0.72, -Math.PI * 0.42) : rand(-Math.PI * 0.58, -Math.PI * 0.28);
      var sp = rand(9, 17);
      addPiece({
        x: left ? -8 : W + 8,
        y: H + 10,
        vx: Math.cos(ang) * sp * (left ? 1 : 1),
        vy: Math.sin(ang) * sp,
        w: rand(5, 10), h: rand(3, 6),
        vr: rand(-0.3, 0.3),
        ttl: rand(80, 150),
        g: 0.16
      });
    }
    // 顶部飘落
    for (i = 0; i < n * 0.35; i++) {
      addPiece({
        x: rand(0, W),
        y: rand(-H * 0.4, -10),
        vx: rand(-0.6, 0.6),
        vy: rand(1.2, 3.4),
        w: rand(4, 9), h: rand(3, 6),
        rot: rand(0, 6), vr: rand(-0.15, 0.15),
        ttl: rand(140, 220),
        g: 0.03
      });
    }
    ensureLoop();
  }

  function firework(x, y, hue) {
    var color = hue || pick(COLORS);
    var count = W < 420 ? 58 : 76;
    for (var i = 0; i < count; i++) {
      var ang = (i / count) * Math.PI * 2 + rand(-0.06, 0.06);
      var sp = rand(1.6, 7.2);
      addPiece({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: rand(1.5, 3.2),
        shape: 'dot',
        color: i % 5 === 0 ? '#fffaf0' : color,
        g: 0.05,
        drag: 0.984,
        ttl: rand(70, 115),
        add: true
      });
    }
    for (var j = 0; j < 10; j++) {
      addPiece({
        x: x, y: y,
        vx: rand(-0.7, 0.7),
        vy: rand(-0.7, 0.7),
        r: rand(7, 14),
        shape: 'dot',
        color: '#fff3f6',
        g: 0,
        drag: 0.9,
        ttl: 26,
        add: true
      });
    }
    addPiece({
      x: x, y: y, vx: 0, vy: 0, rot: 0, vr: 0,
      shape: 'ring', color: '#ffe6f0', maxR: rand(46, 72),
      g: 0, drag: 1, ttl: 26, add: true
    });
    ensureLoop();
  }

  function celebrate() {
    confetti();
    firework(W * 0.26, H * 0.3, '#ffd0e0');
    setTimeout(function () { firework(W * 0.72, H * 0.24, '#ffe3cf'); }, 380);
    setTimeout(function () { firework(W * 0.52, H * 0.35, '#f3b3c9'); }, 760);
  }

  function sparkle(x, y) {
    for (var i = 0; i < 22; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = rand(0.6, 2.2);
      addPiece({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: rand(1.5, 3.2),
        shape: 'dot',
        color: '#ffe0ea',
        g: 0.02,
        drag: 0.97,
        ttl: rand(40, 70),
        add: true
      });
    }
    ensureLoop();
  }

  /* ---------- 3D tilt ---------- */
  function setupTilt(el) {
    var max = el.classList.contains('cover-photo-card') ? 10 : 6;
    var raf = null, px = 0.5, py = 0.5, active = false;

    function apply() {
      raf = null;
      if (!active) return;
      var rx = (0.5 - py) * 2 * max;
      var ry = (px - 0.5) * 2 * max;
      el.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    }
    function move(cx, cy) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = Math.max(0, Math.min(1, (cx - r.left) / r.width));
      py = Math.max(0, Math.min(1, (cy - r.top) / r.height));
      active = true;
      el.style.transition = 'none';
      if (!raf) raf = requestAnimationFrame(apply);
    }
    function reset() {
      active = false;
      el.style.transition = '';
      el.style.transform = '';
    }

    el.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', reset);
    el.addEventListener('touchend', reset);
    el.addEventListener('touchcancel', reset);
    el.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    }, { passive: true });
  }

  function initTilt() {
    var els = document.querySelectorAll('[data-tilt]');
    for (var i = 0; i < els.length; i++) setupTilt(els[i]);
  }

  /* ---------- 摇一摇 ---------- */
  var shakeCallback = null;
  var shakeArmed = false;
  var lastShake = 0;

  function onMotion(e) {
    if (!shakeArmed || !shakeCallback) return;
    var a = e.accelerationIncludingGravity;
    if (!a) return;
    var power = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
    if (power > 32 && Date.now() - lastShake > 2200) {
      lastShake = Date.now();
      shakeCallback();
    }
  }

  function enableShake(cb) {
    shakeCallback = cb;
    if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(function (state) {
        if (state === 'granted') {
          shakeArmed = true;
          window.addEventListener('devicemotion', onMotion);
        }
      }).catch(function () {});
    } else if (window.DeviceMotionEvent) {
      shakeArmed = true;
      window.addEventListener('devicemotion', onMotion);
    }
  }

  window.FX = {
    initTilt: initTilt,
    confetti: confetti,
    firework: firework,
    celebrate: celebrate,
    sparkle: sparkle,
    enableShake: enableShake
  };
})();
