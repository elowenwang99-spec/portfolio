/* =========================================================
   王竞晗 · 个人作品集  —  交互脚本
   1) 经历区「信纸一张张铺开」（滚动进度驱动）
   2) 中英切换（记忆到 localStorage）
   3) 封面页隐藏导航
   4) 导航当前区块高亮
   5) 滚动进场动画
   6) 回到顶部
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORE_KEY = 'wjh-site-lang';

  /* ---------- 1. 开信：火漆 → 封口 → 五张信纸 ---------- */
  /*  --o 是整段进度（0 封着 / 1 全开），写到 .opener 上；
      --p 是每张信纸自己的进度，错开一点，让它们一张张出来。
      开过一次就锁定（.opener.is-open）：信纸保持展开，变成可点的目录；
      往回滚也不会重新封上。两个变量的 CSS 默认值都是 0，脚本挂了就是封信封。 */
  var opener = document.getElementById('cover');
  var letters = Array.prototype.slice.call(document.querySelectorAll('.letter'));
  var letterStack = document.querySelector('.letter-stack');
  var envelopeEl = document.querySelector('.envelope');
  var opened = false;
  var autoScrollId = null;

  function vhNow() { return window.innerHeight || document.documentElement.clientHeight || 800; }
  function yNow() { return window.scrollY || window.pageYOffset || 0; }

  function updateOpener() {
    if (!opener || opened) return;
    var total = opener.offsetHeight - vhNow();
    var o = total > 8 ? (-opener.getBoundingClientRect().top) / total : 1;
    if (o < 0) o = 0; else if (o > 1) o = 1;
    opener.style.setProperty('--o', o.toFixed(3));

    var n = letters.length;
    for (var i = 0; i < n; i++) {
      // 最上面那张（lt-1，排在最后）最先抽出来
      var delay = (n - 1 - i) * 0.06;
      var p = (o - delay) / 0.34;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      letters[i].style.setProperty('--p', p.toFixed(3));
    }
    if (o >= 1) unlockLetters();
  }

  /* 开信完成：五张信纸从装饰变成目录 */
  function unlockLetters() {
    if (opened || !opener) return;
    opened = true;
    opener.classList.add('is-open');
    if (letterStack) letterStack.removeAttribute('aria-hidden');
    letters.forEach(function (l) {
      l.removeAttribute('aria-hidden');
      l.removeAttribute('tabindex');
    });
  }

  function cancelAutoScroll() {
    if (autoScrollId) { cancelAnimationFrame(autoScrollId); autoScrollId = null; }
  }

  /* 点信封：把开信进度自动放完（和滚动驱动的是同一条动画，滚轮/触摸可随时接管） */
  function openEnvelope(ev) {
    if (!opener || opened) return; // 已拆封：让 <a href="#about"> 默认跳进正文
    if (ev) ev.preventDefault();
    var target = opener.getBoundingClientRect().top + yNow() + (opener.offsetHeight - vhNow());
    var instant = root.classList.contains('no-anim') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (instant || target - yNow() < 4) {
      window.scrollTo({ top: target, behavior: 'instant' });
      updateOpener();
      if (!opened) { // 保险：万一 updateOpener 没跑到解锁分支
        opener.style.setProperty('--o', '1');
        letters.forEach(function (l) { l.style.setProperty('--p', '1'); });
        unlockLetters();
      }
      return;
    }
    cancelAutoScroll();
    var startY = yNow(), dist = target - startY, t0 = null, DUR = 1700;
    var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var step = function (ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min((ts - t0) / DUR, 1);
      // html 上有 scroll-behavior:smooth，这里必须显式 instant，否则每次跳帧都会被平滑化
      window.scrollTo({ top: startY + dist * ease(k), behavior: 'instant' });
      autoScrollId = k < 1 ? requestAnimationFrame(step) : null;
    };
    autoScrollId = requestAnimationFrame(step);
  }

  ['wheel', 'touchstart', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, cancelAutoScroll, { passive: true });
  });
  if (envelopeEl) envelopeEl.addEventListener('click', openEnvelope);

  /* ?anim=0：截图模式，不滚动页面，直接呈现拆开后的样子 */
  if (opener && new URLSearchParams(location.search).get('anim') === '0') {
    opener.style.setProperty('--o', '1');
    letters.forEach(function (l) { l.style.setProperty('--p', '1'); });
    unlockLetters();
  }

  /* 信纸升起的空间，按当前窗口高度现算：
     舞台高度 - 信封高度 - 提示高度 - 上下留白。算不出就不写，走 CSS 里的默认值。 */
  function layoutOpener() {
    if (!opener || root.classList.contains('no-anim')) return;
    var stage = opener.querySelector('.opener-stage');
    var env = opener.querySelector('.envelope');
    var hint = opener.querySelector('.cover-hint');
    if (!stage || !env) return;
    var used = env.offsetHeight + 64 + (hint ? hint.offsetHeight + 24 : 0);
    var avail = stage.clientHeight - used;
    if (!isFinite(avail)) return;
    avail = Math.max(96, Math.min(230, avail));
    opener.style.setProperty('--rise', Math.round(avail) + 'px');
  }

  /* ---------- 2. 经历区：信纸一张张铺开 ---------- */
  /* 每张卡片的 --p 是 0→1 的进度：0 表示刚露出屏幕底部（还折着），
     1 表示完全铺开。CSS 里 --p 默认就是 1，所以就算这段脚本没跑起来，
     纸也是展开的，不会留下一片空白。 */
  var sheets = Array.prototype.slice.call(document.querySelectorAll('.tl-card.sheet'));

  function updateSheets() {
    if (!sheets.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    var span = Math.min(Math.max(vh * 0.58, 360), 620);
    for (var i = 0; i < sheets.length; i++) {
      var top = sheets[i].getBoundingClientRect().top;
      var p = (vh - top) / span;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;
      sheets[i].style.setProperty('--p', p.toFixed(3));
    }
  }

  /* ---------- 2. 中英切换 ---------- */
  var langBtns = Array.prototype.slice.call(document.querySelectorAll('[data-toggle-lang]'));

  function applyLang(lang) {
    var isEn = lang === 'en';
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', isEn ? 'en' : 'zh-CN');
    document.title = isEn ? 'Wang Jinghan · Portfolio' : '王竞晗 · 个人作品集';
    langBtns.forEach(function (b) {
      b.setAttribute('aria-label', isEn ? '切换到中文' : 'Switch to English');
    });
    // 换语言后文案长度会变，重新量一次
    updateSheets();
  }

  // 初始化：URL 参数 > 本地记忆 > 默认中文
  var urlLang = new URLSearchParams(location.search).get('lang');
  var saved;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { saved = null; }
  applyLang(urlLang === 'en' || urlLang === 'zh' ? urlLang : (saved === 'en' ? 'en' : 'zh'));

  langBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-lang') === 'zh' ? 'en' : 'zh';
      applyLang(next);
      try { localStorage.setItem(STORE_KEY, next); } catch (e) { /* ignore */ }
    });
  });

  /* ---------- 3. 封面页 & 导航 ---------- */
  var nav = document.getElementById('nav');
  var toTop = document.getElementById('toTop');
  var cover = document.getElementById('cover');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('is-stuck', y > 12);
    if (toTop) toTop.classList.toggle('is-on', y > 700);

    if (cover) {
      var bottom = cover.getBoundingClientRect().bottom;
      document.body.classList.toggle('on-cover', bottom > 130);
    }

    updateSheets();
    updateOpener();
  }
  function relayout() { layoutOpener(); updateOpener(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('load', function () { layoutOpener(); updateSheets(); updateOpener(); });
  layoutOpener();
  onScroll();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(relayout).catch(function () {});
  }

  /* ---------- 4. 当前区块高亮 ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- 5. 滚动进场 ---------- */
  // 调试用：?anim=0 直接全部展开，方便截图和导出
  var noAnim = new URLSearchParams(location.search).get('anim') === '0';
  if (noAnim) root.classList.add('no-anim');

  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (noAnim || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // 同一组里做一点错峰，看起来更松弛
        var sibs = Array.prototype.slice.call(el.parentElement.children);
        var idx = Math.min(sibs.indexOf(el), 5);
        el.style.transitionDelay = (idx * 70) + 'ms';
        el.classList.add('is-in');
        obs.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 6. 回到顶部 ---------- */
  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
