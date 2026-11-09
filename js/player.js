/* 背景音乐控制：微信内需用户手势后播放 */
(function () {
  'use strict';

  var audio = document.getElementById('bgm');
  var btn = document.getElementById('musicBtn');
  if (!audio || !btn) return;

  var available = true;
  var loaded = false;
  var playing = false;

  audio.volume = 0.7;
  audio.addEventListener('error', function () {
    available = false;
    btn.classList.remove('show', 'playing');
  });

  function play() {
    if (!available) return;
    btn.classList.add('show');
    try {
      if (!loaded) {
        audio.load();
        loaded = true;
      }
      var p = audio.play();
      if (p && p.then) {
        p.then(function () {
          playing = true;
          btn.classList.add('playing');
        }).catch(function () {
          playing = false;
          btn.classList.remove('playing');
        });
      } else {
        playing = true;
        btn.classList.add('playing');
      }
    } catch (e) {}
  }

  function pause() {
    try { audio.pause(); } catch (e) {}
    playing = false;
    btn.classList.remove('playing');
  }

  function toggle() {
    if (playing) pause(); else play();
  }

  btn.addEventListener('click', function () {
    toggle();
  });

  // 老版本微信内核：桥接就绪后尝试续播（仍可能被静音策略拦截，失败静默）
  document.addEventListener('WeixinJSBridgeReady', function () {
    if (playing && audio.paused) {
      try {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
  }, false);

  window.Player = {
    play: play,
    pause: pause,
    toggle: toggle,
    isPlaying: function () { return playing; }
  };
})();
