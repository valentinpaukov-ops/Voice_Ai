/* ============================================================================
   Voice Ai — виджет корпоративного радио для встраивания на другие сайты.

   Ставится одной строкой:
     <script src="https://valentinpaukov-ops.github.io/Voice_Ai/widget.js" async></script>

   Адрес радио виджет определяет сам — по тому, откуда его загрузили. Ничего
   настраивать не нужно, но при желании можно: data-position="left",
   data-title="Своё название", data-site="https://…/" на теге script.

   Живёт в Shadow DOM: стили чужого сайта до виджета не достают, а его
   собственные не текут наружу. Это важно — виджет ставят на портал, который
   мы не контролируем, и сломать там вёрстку нельзя.
   ========================================================================= */
(function () {
  "use strict";

  /* На портале страницы бывают внутри рамок — во вложенном окне виджет не
     нужен, иначе он размножится. */
  if (window.top !== window) return;

  var me = document.currentScript;
  if (!me) {
    // async-загрузка в старых браузерах не даёт currentScript — ищем себя сами
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (/widget\.js(\?|$)/.test(all[i].src)) { me = all[i]; break; }
    }
  }
  if (!me || window.__voiceAiWidget) return;   // второй раз не ставимся
  window.__voiceAiWidget = true;

  var SITE = me.getAttribute("data-site") ||
             me.src.replace(/[^/]*$/, "");      // каталог, откуда пришёл скрипт
  if (SITE.charAt(SITE.length - 1) !== "/") SITE += "/";
  var SIDE  = me.getAttribute("data-position") === "left" ? "left" : "right";
  var TITLE = me.getAttribute("data-title") || "Voice Ai";
  /* Отступы от края — как у соседних виджетов на портале. Если в углу уже
     кто-то сидит, наш сдвигается, и они не перекрывают друг друга. */
  function num(name, def) {
    var v = parseInt(me.getAttribute(name), 10);
    return isFinite(v) ? v : def;
  }
  var OFF_SIDE = num("data-offset-" + SIDE, num("data-offset-right", 22));
  var OFF_BOT  = num("data-offset-bottom", 22);

  var MANIFEST = SITE + "audio/manifest.json";
  var MANIFEST_JS = SITE + "audio/manifest.js";

  /* ----------------------------- мелкие помощники ----------------------- */
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + ":" + two(m) + ":" + two(s) : two(m) + ":" + two(s);
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  }
  var MONTHS = ["января","февраля","марта","апреля","мая","июня",
                "июля","августа","сентября","октября","ноября","декабря"];
  function humanDay(day) {
    var p = String(day).split("-");
    return p.length === 3 ? parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] : "";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /* Кириллица и пробелы в именах кодируются по кускам пути — иначе сервер
     такой файл не находит. Пути разные: у записи в манифесте лежит голое имя
     файла, и живёт он в папке audio; у обложки путь уже полный, от корня. */
  function enc(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }
  function audioUrl(file) {
    if (!file) return "";
    return /^https?:\/\//i.test(file) ? file : SITE + "audio/" + enc(file);
  }
  function assetUrl(path) {
    if (!path) return "";
    return /^https?:\/\//i.test(path) ? path : SITE + enc(path);
  }
  function hueOf(text) {
    var h = 0, s = String(text || "Voice Ai");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function letterOf(text) {
    var t = String(text || "").replace(/^[^\wА-Яа-яЁё]+/, "");
    return (t.charAt(0) || "V").toUpperCase();
  }

  /* --------------------------------- вёрстка ---------------------------- */
  var host = document.createElement("div");
  host.id = "voice-ai-widget";
  host.setAttribute("data-voice-ai-widget", "");
  host.style.cssText = "position:fixed;z-index:2147483000;bottom:0;" + SIDE + ":0;width:0;height:0;";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var CSS = [
    ":host,*{box-sizing:border-box;}",
    ".wrap{",
    "  position:fixed;bottom:" + OFF_BOT + "px;" + SIDE + ":" + OFF_SIDE + "px;",
    "  font:14px/1.5 'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;",
    "  color:#f3f1ec;",
    "}",
    /* круглая кнопка */
    ".fab{",
    "  width:60px;height:60px;border-radius:50%;cursor:pointer;border:none;padding:0;",
    "  display:flex;align-items:center;justify-content:center;position:relative;",
    "  background:#131319;color:#f3f1ec;",
    "  box-shadow:0 10px 30px -8px rgba(0,0,0,.55),0 0 0 1px rgba(244,167,48,.35);",
    "  transition:transform .18s ease,box-shadow .18s ease;",
    "}",
    ".fab:hover{transform:translateY(-2px);box-shadow:0 14px 34px -8px rgba(0,0,0,.6),0 0 0 1px rgba(244,167,48,.75);}",
    ".fab b{font:800 17px/1 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;",
    "  letter-spacing:.03em;transform:translateY(-3px);}",
    ".fab b i{font-style:normal;color:#f4a730;margin-left:.12em;}",
    ".fab .eq{position:absolute;bottom:13px;display:flex;gap:2px;align-items:flex-end;height:9px;}",
    ".fab .eq span{width:2px;background:#f4a730;border-radius:1px;animation:eq .9s ease-in-out infinite;}",
    ".fab .eq span:nth-child(2){animation-delay:.15s}.fab .eq span:nth-child(3){animation-delay:.3s}",
    "@keyframes eq{0%,100%{height:3px}50%{height:9px}}",
    /* панель */
    ".panel{",
    "  position:absolute;bottom:74px;" + SIDE + ":0;width:340px;max-width:calc(100vw - 32px);",
    "  background:#1c1a24;border:1px solid #3a3747;border-radius:16px;overflow:hidden;",
    "  box-shadow:0 26px 60px -20px rgba(0,0,0,.75);",
    "  opacity:0;transform:translateY(10px) scale(.98);pointer-events:none;",
    "  transition:opacity .18s ease,transform .18s ease;",
    "}",
    ".panel.on{opacity:1;transform:none;pointer-events:auto;}",
    ".panel.moved{position:fixed;left:0;top:0;bottom:auto;right:auto;}",
    /* шапка — она же ручка для перетаскивания */
    ".head{display:flex;align-items:center;gap:10px;padding:12px 13px;border-bottom:1px solid #3a3747;",
    "  cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;}",
    ".head.drag{cursor:grabbing;}",
    ".head .grip{color:#585566;letter-spacing:-2px;font-size:15px;line-height:1;}",
    ".head .nm{font:800 17px/1 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;",
    "  text-transform:uppercase;letter-spacing:.02em;}",
    ".head .nm i{font-style:normal;color:#f4a730;margin-left:.3em;}",
    ".head .live{margin-left:auto;font:600 10px/1 'IBM Plex Mono',ui-monospace,monospace;",
    "  letter-spacing:.1em;text-transform:uppercase;color:#a19cae;}",
    ".x{background:none;border:none;color:#a19cae;cursor:pointer;font-size:19px;line-height:1;padding:2px 4px;}",
    ".x:hover{color:#f3f1ec;}",
    /* что играет */
    ".now{display:flex;gap:13px;padding:15px 14px 10px;}",
    ".art{width:74px;height:74px;border-radius:50%;flex:none;overflow:hidden;position:relative;",
    "  display:flex;align-items:center;justify-content:center;",
    "  background:linear-gradient(140deg,hsl(var(--h,35) 55% 42%),hsl(var(--h,35) 45% 24%));}",
    ".art img{width:100%;height:100%;object-fit:cover;display:block;}",
    ".art span{font:800 30px/1 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;color:rgba(255,255,255,.92);}",
    ".art:after{content:'';position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(244,167,48,.45);}",
    ".meta{min-width:0;flex:1;}",
    ".tag{display:inline-block;font:600 9px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.1em;",
    "  text-transform:uppercase;color:#f4a730;margin-bottom:5px;}",
    ".t{font-weight:600;margin:0 0 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".s{font-size:12px;color:#a19cae;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".d{font-size:12px;color:#a19cae;margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;",
    "  -webkit-box-orient:vertical;overflow:hidden;}",
    /* перемотка */
    ".seek{padding:2px 14px 0;}",
    ".seek .bar{height:16px;display:flex;align-items:center;cursor:pointer;touch-action:none;}",
    ".seek .bar i{display:block;height:4px;width:100%;border-radius:2px;background:#292734;position:relative;}",
    ".seek .bar i u{position:absolute;inset:0;width:0;background:#f4a730;border-radius:2px;display:block;}",
    ".seek .bar i u:after{content:'';position:absolute;right:-5px;top:50%;width:10px;height:10px;",
    "  margin-top:-5px;border-radius:50%;background:#f4a730;opacity:0;transition:opacity .15s;}",
    ".seek .bar:hover i u:after{opacity:1;}",
    ".time{display:flex;justify-content:space-between;font:11px/1 'IBM Plex Mono',ui-monospace,monospace;",
    "  color:#a19cae;margin-top:3px;}",
    /* кнопки и громкость */
    ".ctrl{display:flex;align-items:center;gap:12px;padding:10px 14px 4px;}",
    ".ctrl .sp{flex:1;}",
    ".ctrl button{background:#292734;border:1px solid #3a3747;color:#f3f1ec;cursor:pointer;",
    "  width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;",
    "  font-size:12px;line-height:1;padding:0;flex:none;}",
    ".ctrl button:hover{border-color:#f4a730;}",
    ".ctrl .play{width:46px;height:46px;background:#f4a730;border-color:#f4a730;color:#231400;font-size:15px;}",
    ".ctrl .play:hover{background:#ffc158;}",
    ".vol{display:flex;align-items:center;gap:7px;flex:none;}",
    ".vol button{width:26px;height:26px;font-size:12px;background:none;border:none;color:#a19cae;}",
    ".vol button:hover{color:#f4a730;}",
    ".vol input{-webkit-appearance:none;appearance:none;width:66px;height:4px;border-radius:2px;",
    "  background:#292734;outline:none;cursor:pointer;}",
    ".vol input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;",
    "  background:#f4a730;cursor:pointer;}",
    ".vol input::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#f4a730;}",
    /* просмотр эфира: одна строка вместо длинного списка */
    ".peek{display:flex;align-items:center;gap:8px;padding:11px 10px;margin-top:8px;",
    "  border-top:1px solid #3a3747;}",
    ".peek button.nav{background:none;border:1px solid #3a3747;color:#a19cae;cursor:pointer;",
    "  width:28px;height:28px;border-radius:8px;flex:none;font-size:11px;line-height:1;padding:0;}",
    ".peek button.nav:hover{border-color:#f4a730;color:#f4a730;}",
    ".peek .mid{flex:1;min-width:0;background:none;border:none;color:inherit;cursor:pointer;",
    "  text-align:left;font:inherit;padding:0 2px;}",
    ".peek .mid b{display:block;font:600 9px/1 'IBM Plex Mono',ui-monospace,monospace;",
    "  letter-spacing:.1em;text-transform:uppercase;color:#f4a730;margin-bottom:4px;}",
    ".peek .mid span{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".peek .mid:hover span{color:#f4a730;}",
    ".foot{padding:11px 14px;border-top:1px solid #3a3747;}",
    ".foot a{display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;",
    "  background:#292734;border:1px solid #3a3747;border-radius:10px;padding:9px;",
    "  color:#f3f1ec;font-size:13px;font-weight:600;}",
    ".foot a:hover{border-color:#f4a730;color:#f4a730;}",
    ".msg{padding:20px 16px;text-align:center;color:#a19cae;font-size:13px;}",
    "@media (max-width:420px){",
    "  .panel{width:calc(100vw - 32px);}",
    "  .vol input{width:48px;}",
    "}"
  ].join("\n");

  var style = document.createElement("style");
  style.textContent = CSS;

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.innerHTML =
    '<div class="panel" id="panel" role="dialog" aria-label="' + esc(TITLE) + '">' +
      '<div class="head" id="head">' +
        '<span class="grip" aria-hidden="true">⣿</span>' +
        '<span class="nm">VOICE<i>AI</i></span>' +
        '<span class="live" id="live"></span>' +
        '<button class="x" id="close" aria-label="Закрыть">×</button>' +
      '</div>' +
      '<div id="body"><div class="msg">Загружаю эфир…</div></div>' +
      '<div class="foot"><a id="open" href="' + esc(SITE) + '" target="_blank" rel="noopener">' +
        'Открыть Voice Ai →</a></div>' +
    '</div>' +
    '<button class="fab" id="fab" aria-label="' + esc(TITLE) + ' — слушать эфир">' +
      '<b>V<i>AI</i></b>' +
      '<span class="eq" id="eq" hidden><span></span><span></span><span></span></span>' +
    '</button>';

  root.appendChild(style);
  root.appendChild(wrap);

  /* Вешаем на корень страницы, а не внутрь body: на порталах body часто
     лежит в контейнере с обрезкой и своими слоями, и виджет там прячется. */
  function lift() {
    var parent = document.documentElement;
    if (host.parentElement !== parent) parent.appendChild(host);
  }
  lift();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lift, { once: true });
  }

  var $ = function (id) { return root.getElementById ? root.getElementById(id) : document.getElementById(id); };
  var panel = $("panel"), fab = $("fab"), body = $("body"), eq = $("eq"), live = $("live");

  /* ------------------------- память между заходами ---------------------- */
  function remember(key, val) {
    try { localStorage.setItem("voiceAiWidget." + key, val); } catch (e) {}
  }
  function recall(key) {
    try { return localStorage.getItem("voiceAiWidget." + key); } catch (e) { return null; }
  }

  /* --------------------------------- данные ----------------------------- */
  var audio = new Audio();
  audio.preload = "none";
  var savedVol = parseFloat(recall("volume"));
  audio.volume = isFinite(savedVol) ? Math.min(1, Math.max(0, savedVol)) : 0.8;

  var queue = [], idx = -1, peek = 0, day = "", opened = false, started = false;

  function pickDay(air, tracks) {
    var t = todayStr();
    var days = Object.keys(air || {}).filter(function (d) {
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && (air[d] || []).length;
    }).sort();
    if (air && air[t] && air[t].length) return t;
    var past = days.filter(function (d) { return d <= t; });
    if (past.length) return past[past.length - 1];
    var withDate = tracks.filter(function (x) { return x.date && x.date <= t; })
                         .map(function (x) { return x.date; }).sort();
    return withDate.length ? withDate[withDate.length - 1] : "";
  }

  /* Виджет живёт на чужом домене, а браузер разрешает читать чужой JSON
     только если сервер прямо это позволил. Заголовки нам неподконтрольны,
     поэтому есть запасной путь: тот же манифест отдельным файлом-скриптом —
     скрипты с чужого домена грузятся без разрешений. */
  function loadViaScript() {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement("script");
      sc.src = MANIFEST_JS + "?t=" + Date.now();
      sc.async = true;
      sc.onload = function () {
        sc.parentNode && sc.parentNode.removeChild(sc);
        if (window.__voiceAiManifest) resolve(window.__voiceAiManifest);
        else reject(new Error("пустой манифест"));
      };
      sc.onerror = function () {
        sc.parentNode && sc.parentNode.removeChild(sc);
        reject(new Error("манифест не загрузился"));
      };
      (document.head || document.documentElement).appendChild(sc);
    });
  }

  function load() {
    fetch(MANIFEST, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("нет манифеста"); return r.json(); })
      ["catch"](loadViaScript)
      .then(function (data) {
        /* Несогласованное и заготовки в виджет не пускаем — он показывает
           ровно то же, что видит обычный слушатель на сайте. */
        var tracks = (data.tracks || []).filter(function (t) {
          return t && t.file && !t.pending && !t.placeholder;
        });
        var byFile = {};
        tracks.forEach(function (t) { byFile[t.file] = t; });

        day = pickDay(data.air, tracks);
        var air = (data.air && data.air[day]) || null;
        queue = air
          ? air.map(function (f) { return byFile[f]; }).filter(Boolean)
          : tracks.filter(function (t) { return t.date === day; });
        if (!queue.length) queue = tracks.slice(-8);

        idx = queue.length ? 0 : -1;
        peek = queue.length > 1 ? 1 : 0;
        render();
      })
      ["catch"](function () {
        body.innerHTML = '<div class="msg">Эфир сейчас не загрузился.<br>' +
                         'Откройте Voice Ai — там он точно есть.</div>';
      });
  }

  function artHtml(t) {
    if (t && t.cover) {
      return '<span class="art"><img src="' + esc(assetUrl(t.cover)) + '" alt=""></span>';
    }
    return '<span class="art" style="--h:' + hueOf(t && t.title) + '">' +
           '<span>' + esc(letterOf(t && t.title)) + '</span></span>';
  }

  function volIcon() { return audio.muted || !audio.volume ? "🔇" : (audio.volume < 0.5 ? "🔈" : "🔊"); }

  function render() {
    if (idx < 0) {
      body.innerHTML = '<div class="msg">В этот день эфира не было.</div>';
      return;
    }
    var t = queue[idx];
    live.textContent = day === todayStr() ? "эфир сегодня" : (day ? "эфир от " + humanDay(day) : "");
    body.innerHTML =
      '<div class="now">' + artHtml(t) +
        '<div class="meta">' +
          (t.tag ? '<span class="tag">' + esc(t.tag) + '</span>' : "") +
          '<p class="t">' + esc(t.title || t.file) + '</p>' +
          '<div class="s">' + esc(t.host || "Voice Ai") + '</div>' +
          (t.desc ? '<div class="d">' + esc(t.desc) + '</div>' : "") +
        '</div>' +
      '</div>' +
      '<div class="seek">' +
        '<div class="bar" id="bar" role="slider" aria-label="Перемотка"><i><u id="fill"></u></i></div>' +
        '<div class="time"><span id="tm">00:00</span><span id="tr">—:—</span></div>' +
      '</div>' +
      '<div class="ctrl">' +
        '<button id="prev" title="Предыдущая запись" aria-label="Предыдущая">◀</button>' +
        '<button class="play" id="play" aria-label="Слушать">▶</button>' +
        '<button id="next" title="Следующая запись" aria-label="Следующая">▶</button>' +
        '<span class="sp"></span>' +
        '<span class="vol">' +
          '<button id="mute" title="Звук" aria-label="Звук">' + volIcon() + '</button>' +
          '<input type="range" id="vol" min="0" max="100" step="1" aria-label="Громкость" ' +
                 'value="' + Math.round((audio.muted ? 0 : audio.volume) * 100) + '">' +
        '</span>' +
      '</div>' +
      (queue.length > 1 ? peekHtml() : "");

    $("play").addEventListener("click", toggle);
    $("prev").addEventListener("click", function () { step(-1); });
    $("next").addEventListener("click", function () { step(1); });
    $("mute").addEventListener("click", function () {
      audio.muted = !audio.muted;
      $("mute").textContent = volIcon();
      $("vol").value = Math.round((audio.muted ? 0 : audio.volume) * 100);
    });
    $("vol").addEventListener("input", function () {
      audio.volume = (+this.value) / 100;
      audio.muted = audio.volume === 0;
      $("mute").textContent = volIcon();
      remember("volume", String(audio.volume));
    });
    bindSeek();
    bindPeek();
    syncPlay();
    paint();
  }

  /* Вместо длинного списка с прокруткой — одна строка «далее» со стрелками:
     ими листают выпуск вперёд и назад, а нажатие на название включает эту
     запись. Панель от этого не растёт, сколько бы записей ни было в эфире. */
  function peekHtml() {
    var t = queue[peek] || queue[0];
    var label = peek === (idx + 1) % queue.length ? "далее" :
                (peek === idx ? "сейчас играет" : "в этом эфире · " + (peek + 1) + " из " + queue.length);
    return '<div class="peek">' +
        '<button class="nav" id="up" title="Предыдущая в списке" aria-label="Выше">▲</button>' +
        '<button class="mid" id="jump" title="Включить эту запись">' +
          '<b>' + esc(label) + '</b>' +
          '<span>' + esc(t.title || t.file) + '</span>' +
        '</button>' +
        '<button class="nav" id="down" title="Следующая в списке" aria-label="Ниже">▼</button>' +
      '</div>';
  }
  function bindPeek() {
    var up = $("up"), down = $("down"), jump = $("jump");
    if (!up) return;
    up.addEventListener("click", function () { movePeek(-1); });
    down.addEventListener("click", function () { movePeek(1); });
    jump.addEventListener("click", function () { select(peek, true); });
  }
  function movePeek(d) {
    peek = (peek + d + queue.length) % queue.length;
    var box = $("body").querySelector(".peek");
    if (box) { box.outerHTML = peekHtml(); bindPeek(); }
  }

  /* ------------------------------- перемотка ---------------------------- */
  function duration() {
    return isFinite(audio.duration) && audio.duration > 0
      ? audio.duration : ((queue[idx] && queue[idx].duration) || 0);
  }
  function bindSeek() {
    var bar = $("bar");
    if (!bar) return;
    var dragging = false;
    function at(e) {
      var r = bar.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return Math.min(1, Math.max(0, x / (r.width || 1)));
    }
    function seekTo(e) {
      var d = duration();
      if (!d) return;
      if (!audio.src) audio.src = audioUrl(queue[idx].file);
      audio.currentTime = at(e) * d;
      paint();
    }
    bar.addEventListener("mousedown", function (e) { dragging = true; seekTo(e); e.preventDefault(); });
    document.addEventListener("mousemove", function (e) { if (dragging) seekTo(e); });
    document.addEventListener("mouseup", function () { dragging = false; });
    bar.addEventListener("touchstart", function (e) { dragging = true; seekTo(e); }, { passive: true });
    bar.addEventListener("touchmove", function (e) { if (dragging) seekTo(e); }, { passive: true });
    bar.addEventListener("touchend", function () { dragging = false; });
  }
  function paint() {
    var tm = $("tm"), tr = $("tr"), fill = $("fill");
    if (!tm || !fill) return;
    var d = duration();
    tm.textContent = fmt(audio.currentTime);
    if (tr) tr.textContent = d ? fmt(d) : "—:—";
    fill.style.width = (d ? Math.min(100, audio.currentTime / d * 100) : 0) + "%";
  }

  /* ------------------------------ воспроизведение ------------------------ */
  function select(i, play) {
    if (i < 0 || i >= queue.length) return;
    idx = i;
    peek = queue.length > 1 ? (i + 1) % queue.length : 0;
    audio.src = audioUrl(queue[i].file);
    render();
    if (play) { started = true; var p = audio.play(); if (p && p["catch"]) p["catch"](function () {}); }
  }
  function step(d) {
    if (!queue.length) return;
    select((idx + d + queue.length) % queue.length, !audio.paused || started);
  }
  function toggle() {
    if (!audio.src) audio.src = audioUrl(queue[idx].file);
    if (audio.paused) {
      started = true;
      var p = audio.play(); if (p && p["catch"]) p["catch"](function () {});
    } else { audio.pause(); }
  }
  function syncPlay() {
    var b = $("play");
    if (b) b.textContent = audio.paused ? "▶" : "❚❚";
    if (eq) eq.hidden = audio.paused;
  }

  audio.addEventListener("play", syncPlay);
  audio.addEventListener("pause", syncPlay);
  audio.addEventListener("ended", function () { step(1); });
  audio.addEventListener("timeupdate", paint);
  audio.addEventListener("loadedmetadata", paint);

  /* Одна нечитаемая запись не должна останавливать эфир — переходим к
     следующей. Но если не открывается вообще ничего, перебор превращается в
     бесконечный круг: считаем неудачи подряд и, пройдя очередь, замолкаем. */
  var fails = 0;
  audio.addEventListener("playing", function () { fails = 0; });
  audio.addEventListener("error", function () {
    if (!audio.src) return;
    if (queue.length > 1 && fails < queue.length - 1) { fails++; step(1); return; }
    fails = 0;
    started = false;
    audio.removeAttribute("src");
    var b = $("play"); if (b) b.textContent = "▶";
    if (eq) eq.hidden = true;
    var tm = $("tm"); if (tm) tm.textContent = "записи не читаются";
  });

  /* ---- переход на сайт: эфир должен продолжиться, а не начаться заново --- */
  $("open").addEventListener("click", function () {
    var t = queue[idx];
    var url = SITE;
    if (t && t.file) {
      url += "?play=" + encodeURIComponent(t.file) +
             "&at=" + Math.floor(audio.currentTime || 0) + "#air";
    }
    this.href = url;
    audio.pause();       // чтобы две вкладки не играли хором
  });

  /* ------------------------- перетаскивание панели ---------------------- */
  (function draggable() {
    var head = $("head"), sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    function point(e) {
      return e.touches && e.touches[0] ? e.touches[0] : e;
    }
    function down(e) {
      if (e.target.closest && e.target.closest("#close")) return;
      var r = panel.getBoundingClientRect();
      panel.classList.add("moved");
      panel.style.left = r.left + "px";
      panel.style.top = r.top + "px";
      var p = point(e);
      sx = p.clientX; sy = p.clientY; ox = r.left; oy = r.top; on = true;
      head.classList.add("drag");
      if (e.cancelable) e.preventDefault();
    }
    function move(e) {
      if (!on) return;
      var p = point(e);
      var w = panel.offsetWidth, h = panel.offsetHeight;
      var x = Math.min(window.innerWidth - w - 4, Math.max(4, ox + p.clientX - sx));
      var y = Math.min(window.innerHeight - h - 4, Math.max(4, oy + p.clientY - sy));
      panel.style.left = x + "px";
      panel.style.top = y + "px";
    }
    function up() {
      if (!on) return;
      on = false;
      head.classList.remove("drag");
      remember("pos", panel.style.left + "|" + panel.style.top);
    }
    head.addEventListener("mousedown", down);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    head.addEventListener("touchstart", down, { passive: false });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);

    // вернуть на место, где человек оставил панель в прошлый раз
    var saved = recall("pos");
    if (saved && /^\d+px\|\d+px$/.test(saved)) {
      var p = saved.split("|");
      panel.classList.add("moved");
      panel.style.left = p[0];
      panel.style.top = p[1];
    }
    // окно уменьшили — не даём панели уехать за край
    window.addEventListener("resize", function () {
      if (!panel.classList.contains("moved")) return;
      var w = panel.offsetWidth, h = panel.offsetHeight;
      panel.style.left = Math.min(parseInt(panel.style.left, 10) || 0,
                                  Math.max(4, window.innerWidth - w - 4)) + "px";
      panel.style.top = Math.min(parseInt(panel.style.top, 10) || 0,
                                 Math.max(4, window.innerHeight - h - 4)) + "px";
    });
  })();

  /* ------------------------------- открытие ----------------------------- */
  function open(on) {
    opened = on;
    panel.classList.toggle("on", on);
    if (on && !queue.length) load();
  }
  fab.addEventListener("click", function () { open(!opened); });
  $("close").addEventListener("click", function () { open(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && opened) open(false); });
  document.addEventListener("click", function (e) {
    if (!opened) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    open(false);
  });

  load();
})();
