/* 主逻辑：翻页 / 倒计时 / 照片墙 / 交互 */
(function () {
  'use strict';

  var BANQUET = new Date(2027, 0, 9, 18, 0, 0); // 2027-01-09 18:00 晚宴
  var ADDRESS = '浙江省温州市瓯海区南白象街道瓯越大道1900号三垟湿地保护区内(西侧)';

  var pagesEl = document.getElementById('pages');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var dotsWrap = document.getElementById('pageDots');
  var bgItems = document.querySelectorAll('.bg-item');

  var current = 0;
  var bgZ = 1;
  var endedSeen = false;
  var shakeInited = false;

  function $(id) { return document.getElementById(id); }

  /* ---------- 视口高度修正 ---------- */
  function setVH() {
    var h = window.innerHeight;
    document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
  }
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', function () {
    setTimeout(setVH, 220);
  });

  /* ---------- 页面导航 ---------- */
  sections.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', '第 ' + (i + 1) + ' 页');
    b.addEventListener('click', function () { goto(i); });
    dotsWrap.appendChild(b);
  });
  var dots = dotsWrap.querySelectorAll('button');

  function pageHeight() {
    return pagesEl.clientHeight || window.innerHeight;
  }

  function goto(i) {
    if (i < 0 || i >= sections.length) return false;
    pagesEl.scrollTo({ top: i * pageHeight(), behavior: 'smooth' });
    return true;
  }

  function fadeOutBg(el) {
    if (el.__bgTimer) clearTimeout(el.__bgTimer);
    el.__bgTimer = setTimeout(function () {
      el.__bgTimer = null;
      if (bgItems[current] === el) return;
      el.classList.remove('active');
    }, 1250);
  }

  function setActive(i) {
    current = i;
    sections.forEach(function (s, j) {
      if (j === i) s.classList.add('is-active');
      else s.classList.remove('is-active');
    });
    for (var k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('active', k === i);
    }

    var theme = sections[i].getAttribute('data-theme') || 'dark';
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-page', String(i));

    bgZ += 1;
    bgItems[i].style.zIndex = String(bgZ);
    for (var m = 0; m < bgItems.length; m++) {
      if (m === i) {
        bgItems[m].classList.add('active');
      } else if (bgItems[m].classList.contains('active')) {
        // 旧背景先保持不透明，等新背景淡入完成后再淡出，避免中途透出深色底
        fadeOutBg(bgItems[m]);
      }
    }
    if (window.BGFX) window.BGFX.setTheme(theme);

    if (i === sections.length - 1 && !endedSeen) {
      endedSeen = true;
      setTimeout(function () {
        if (window.FX) window.FX.sparkle(window.innerWidth / 2, window.innerHeight * 0.4);
      }, 1000);
    }
  }

  var scrollTicking = false;
  pagesEl.addEventListener('scroll', function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      var h = pageHeight();
      var i = Math.round(pagesEl.scrollTop / h);
      if (i < 0) i = 0;
      if (i >= sections.length) i = sections.length - 1;
      if (i !== current) setActive(i);
    });
  }, { passive: true });

  /* ---------- 桌面滚轮翻页 ---------- */
  var wheelLock = 0;
  pagesEl.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) < 6) return;
    var now = Date.now();
    if (now < wheelLock) {
      e.preventDefault();
      return;
    }
    var dir = e.deltaY > 0 ? 1 : -1;
    var next = current + dir;
    if (next < 0 || next >= sections.length) return;
    e.preventDefault();
    wheelLock = now + 780;
    goto(next);
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { goto(current + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { goto(current - 1); }
  });

  /* ---------- 开启按钮 ---------- */
  var openBtn = $('openBtn');
  if (openBtn) {
    openBtn.addEventListener('click', function () {
      if (window.Player) window.Player.play();
      if (window.BGFX) window.BGFX.burst(window.innerWidth / 2, window.innerHeight * 0.42, 30);
      setTimeout(function () { goto(1); }, 280);
    });
  }

  /* ---------- 倒计时 ---------- */
  var coverDays = $('coverDays');
  var cdD = $('cdD'), cdH = $('cdH'), cdM = $('cdM'), cdS = $('cdS');
  var cdLabel = document.querySelector('.cd-label');

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function setNum(el, text) {
    if (!el) return;
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('pop');
    // 触发重排以重启动画
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(function () { el.classList.remove('pop'); }, 280);
  }

  function calendarDaysLeft() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(2027, 0, 9);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  function tick() {
    var diff = BANQUET.getTime() - Date.now();
    if (diff <= 0) {
      if (coverDays) coverDays.textContent = '0';
      if (cdD) { cdD.textContent = '00'; cdH.textContent = '00'; cdM.textContent = '00'; cdS.textContent = '00'; }
      if (cdLabel) cdLabel.textContent = '喜宴进行中';
      return;
    }
    var day = Math.floor(diff / 86400000);
    var hour = Math.floor((diff % 86400000) / 3600000);
    var min = Math.floor((diff % 3600000) / 60000);
    var sec = Math.floor((diff % 60000) / 1000);

    if (coverDays) coverDays.textContent = String(Math.max(0, calendarDaysLeft()));
    if (cdD) {
      setNum(cdD, String(day));
      setNum(cdH, pad2(hour));
      setNum(cdM, pad2(min));
      setNum(cdS, pad2(sec));
    }
  }
  tick();
  setTimeout(function () {
    tick();
    setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));

  /* ---------- 照片墙 ---------- */
  var gallery = $('gallery');
  var galleryDots = $('galleryDots');
  var placeholders = [
    { label: '满月' }, { label: '百天' }, { label: '半岁' },
    { label: '九个月' }, { label: '十一个月' }, { label: '周岁' }
  ];
  var LEAF_SVG = '<svg viewBox="0 0 64 40" fill="none" stroke="rgba(168,84,112,.6)" stroke-width="1.5" stroke-linejoin="round"><path d="M8 30 5 11l13 8L32 5l14 14 13-8-3 19z"/><path d="M10 35h44" stroke-linecap="round" opacity=".55"/><circle cx="5" cy="11" r="2.3" fill="rgba(168,84,112,.6)" stroke="none"/><circle cx="32" cy="5" r="2.3" fill="rgba(168,84,112,.6)" stroke="none"/><circle cx="59" cy="11" r="2.3" fill="rgba(168,84,112,.6)" stroke="none"/></svg>';

  function makeCard(item) {
    var card = document.createElement('div');
    card.className = 'gallery-card';
    if (item.src) {
      var img = document.createElement('img');
      img.className = 'gallery-photo';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '王清许 ' + (item.label || '');
      img.src = 'assets/img/' + item.src + '?v=2';
      card.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'gallery-photo ph-photo';
      ph.innerHTML = LEAF_SVG;
      card.appendChild(ph);
    }
    var label = document.createElement('p');
    label.className = 'gallery-label';
    label.textContent = item.label || '';
    card.appendChild(label);
    return card;
  }

  function renderGallery(items) {
    gallery.innerHTML = '';
    galleryDots.innerHTML = '';
    items.forEach(function (item) {
      gallery.appendChild(makeCard(item));
      var dot = document.createElement('i');
      galleryDots.appendChild(dot);
    });
    if (!items.length) return;

    Array.prototype.forEach.call(gallery.children, function (card, idx) {
      card.addEventListener('click', function () {
        var target = card.offsetLeft - (gallery.clientWidth - card.offsetWidth) / 2;
        gallery.scrollTo({ left: target, behavior: 'smooth' });
      });
    });
    updateGallery();
  }

  function updateGallery() {
    var cards = gallery.children;
    if (!cards.length) return;
    var gRect = gallery.getBoundingClientRect();
    var center = gRect.left + gRect.width / 2;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      var d = Math.abs(r.left + r.width / 2 - center);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    for (var j = 0; j < cards.length; j++) {
      cards[j].classList.toggle('is-current', j === best);
    }
    var ds = galleryDots.children;
    for (var k = 0; k < ds.length; k++) {
      ds[k].classList.toggle('active', k === best);
    }
  }

  var galTicking = false;
  gallery.addEventListener('scroll', function () {
    if (galTicking) return;
    galTicking = true;
    requestAnimationFrame(function () {
      galTicking = false;
      updateGallery();
    });
  }, { passive: true });

  window.addEventListener('resize', function () {
    setTimeout(updateGallery, 260);
  });

  function loadGallery() {
    if (window.fetch) {
      fetch('assets/img/manifest.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var photos = (data && data.photos) || [];
          renderGallery(photos.length ? photos : placeholders);
        })
        .catch(function () { renderGallery(placeholders); });
    } else {
      renderGallery(placeholders);
    }
  }
  loadGallery();

  /* ---------- 提示气泡 ---------- */
  var toastEl = $('toast');
  var toastTimer = null;
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, ms || 2200);
  }

  /* ---------- 复制地址 ---------- */
  function legacyCopy(text, ok, fail) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var success = document.execCommand('copy');
      document.body.removeChild(ta);
      if (success) ok(); else fail();
    } catch (e) {
      fail();
    }
  }

  function copyText(text, ok, fail) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok).catch(function () {
        legacyCopy(text, ok, fail);
      });
    } else {
      legacyCopy(text, ok, fail);
    }
  }

  var copyBtn = $('copyAddr');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      copyText(ADDRESS, function () {
        toast('地址已复制，可粘贴到地图或发给亲友');
      }, function () {
        toast('复制失败，请长按页面上的地址文字选择复制', 3200);
      });
    });
  }

  /* ---------- 烟花彩蛋 ---------- */
  var fireworkBtn = $('fireworkBtn');
  if (fireworkBtn) {
    fireworkBtn.addEventListener('click', function () {
      if (window.FX) {
        window.FX.celebrate();
        if (!shakeInited) {
          shakeInited = true;
          window.FX.enableShake(function () {
            window.FX.celebrate();
            toast('烟花为你们绽放 ✨');
          });
        }
      }
    });
  }

  // 结尾页连点三下触发
  var endPage = sections[sections.length - 1];
  var taps = 0;
  var tapTimer = null;
  endPage.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && (t.closest('button') || t.closest('a'))) return;
    taps += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 1200);
    if (taps >= 3 && window.FX) {
      taps = 0;
      window.FX.celebrate();
      toast('愿岁岁平安，喜乐相伴 🎂');
    }
  });

  /* ---------- 初始化 ---------- */
  if (window.FX) window.FX.initTilt();

  // 双 rAF 保证首屏入场动画能触发
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var hashMatch = /^#p([1-9])$/.exec(window.location.hash || '');
      if (hashMatch) {
        var idx = Math.min(parseInt(hashMatch[1], 10) - 1, sections.length - 1);
        pagesEl.scrollTop = idx * pageHeight();
        setActive(idx);
      } else {
        setActive(0);
      }
    });
  });

})();
