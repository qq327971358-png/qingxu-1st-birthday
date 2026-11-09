/* 背景粒子：萤火虫 / 光尘 / 花瓣
   预渲染光晕 sprite，避免移动端 shadowBlur 卡顿 */
(function () {
  'use strict';

  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var W = 0, H = 0, DPR = 1;
  var fireflies = [];
  var petals = [];
  var sparks = [];
  var theme = 'dark';
  var lastTime = 0;
  var rafId = null;
  var running = false;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeSprite(r, g, b) {
    var size = 64;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    var grd = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grd.addColorStop(0.22, 'rgba(' + r + ',' + g + ',' + b + ',.5)');
    grd.addColorStop(0.55, 'rgba(' + r + ',' + g + ',' + b + ',.12)');
    grd.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = grd;
    x.fillRect(0, 0, size, size);
    return c;
  }

  var spriteDark = makeSprite(255, 214, 226);
  var spriteLight = makeSprite(212, 160, 176);

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function build() {
    var count = Math.max(26, Math.min(54, Math.round(W / 9)));
    fireflies = [];
    for (var i = 0; i < count; i++) {
      fireflies.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(1.1, 2.5),
        vx: rand(-0.12, 0.12),
        vy: rand(-0.16, 0.06),
        sway: rand(0.0004, 0.0012),
        phase: Math.random() * Math.PI * 2,
        blink: rand(0.0012, 0.0028),
        alpha: rand(0.35, 0.9)
      });
    }
    petals = [];
    var pc = W < 420 ? 9 : 13;
    for (var j = 0; j < pc; j++) {
      petals.push({
        x: Math.random() * W,
        y: Math.random() * H,
        w: rand(4, 9),
        h: rand(2, 4),
        vy: rand(0.14, 0.42),
        sway: rand(0.0006, 0.0016),
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI,
        vr: rand(-0.004, 0.004),
        alpha: rand(0.2, 0.5)
      });
    }
  }

  function drawSprite(sprite, x, y, size, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  }

  function frame(now) {
    if (!lastTime) lastTime = now;
    var dt = Math.min(now - lastTime, 48) / 16.67;
    lastTime = now;

    ctx.clearRect(0, 0, W, H);

    var light = theme === 'light';
    var sprite = light ? spriteLight : spriteDark;
    var t = now;

    for (var i = 0; i < fireflies.length; i++) {
      var p = fireflies[i];
      p.x += (p.vx + Math.sin(t * p.sway + p.phase) * 0.16) * dt;
      p.y += p.vy * dt;
      if (p.y < -24) { p.y = H + 24; p.x = Math.random() * W; }
      if (p.y > H + 24) { p.y = -24; }
      if (p.x < -24) p.x = W + 24;
      if (p.x > W + 24) p.x = -24;

      var blink = 0.45 + 0.55 * Math.sin(t * p.blink + p.phase * 1.7);
      var a = p.alpha * blink * (light ? 0.55 : 0.95);
      drawSprite(sprite, p.x, p.y, p.r * 9, a);
    }

    for (var k = 0; k < petals.length; k++) {
      var q = petals[k];
      q.y += q.vy * dt;
      q.x += Math.sin(t * q.sway + q.phase) * 0.5 * dt;
      q.rot += q.vr * dt;
      if (q.y > H + 12) { q.y = -12; q.x = Math.random() * W; }
      if (q.x < -12) q.x = W + 12;
      if (q.x > W + 12) q.x = -12;

      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.globalAlpha = q.alpha * (light ? 0.9 : 0.7);
      ctx.fillStyle = light ? '#f7c9d8' : '#ffd9e4';
      ctx.beginPath();
      ctx.ellipse(0, 0, q.w, q.h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 0.012 * dt;
      sp.vx *= 0.985;
      sp.vy *= 0.985;
      sp.life -= 0.012 * dt;
      if (sp.life <= 0) { sparks.splice(s, 1); continue; }
      drawSprite(sp.light ? spriteLight : spriteDark, sp.x, sp.y, sp.size * sp.life, sp.life * 0.9);
    }

    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    var light = theme === 'light';
    var sprite = light ? spriteLight : spriteDark;
    for (var i = 0; i < fireflies.length; i++) {
      var p = fireflies[i];
      drawSprite(sprite, p.x, p.y, p.r * 8, p.alpha * (light ? 0.45 : 0.7));
    }
    ctx.globalAlpha = 1;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      if (reduceMotion) drawStatic();
    }, 180);
  });

  window.BGFX = {
    setTheme: function (t) {
      theme = t === 'light' ? 'light' : 'dark';
      if (reduceMotion) drawStatic();
    },
    burst: function (x, y, n) {
      var count = n || 26;
      var lx = x || W / 2;
      var ly = y || H * 0.45;
      for (var i = 0; i < count; i++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = rand(0.8, 3.6);
        sparks.push({
          x: lx, y: ly,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 0.6,
          size: rand(10, 26),
          life: 1,
          light: theme === 'light'
        });
      }
    }
  };

  resize();
  if (reduceMotion) drawStatic(); else start();
})();
