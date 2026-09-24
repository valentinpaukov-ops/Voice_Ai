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
    ".fab b i{margin-left:.12em;}",
    ".fab b i{font-style:normal;color:#f4a730;}",
    /* волны, когда играет */
    ".fab .eq{position:absolute;bottom:13px;display:flex;gap:2px;align-items:flex-end;height:9px;}",
    ".fab .eq span{width:2px;background:#f4a730;border-radius:1px;animation:eq .9s ease-in-out infinite;}",
    ".fab .eq span:nth-child(2){animation-delay:.15s}.fab .eq span:nth-child(3){animation-delay:.3s}",
    "@keyframes eq{0%,100%{height:3px}50%{height:9px}}",
    ".fab .dot{position:absolute;top:6px;" + SIDE + ":6px;width:9px;height:9px;border-radius:50%;background:#ff6b5e;}",
    /* панель */
    ".panel{",
    "  position:absolute;bottom:74px;" + SIDE + ":0;width:330px;max-width:calc(100vw - 32px);",
    "  background:#1c1a24;border:1px solid #3a3747;border-radius:16px;overflow:hidden;",
    "  box-shadow:0 26px 60px -20px rgba(0,0,0,.75);",
    "  opacity:0;transform:translateY(10px) scale(.98);pointer-events:none;",
    "  transition:opacity .18s ease,transform .18s ease;",
    "}",
    ".panel.on{opacity:1;transform:none;pointer-events:auto;}",
    ".head{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid #3a3747;}",
    ".head .nm{font:800 17px/1 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;",
    "  text-transform:uppercase;letter-spacing:.02em;}",
    ".head .nm i{font-style:normal;color:#f4a730;margin-left:.3em;}",
    ".head .live{margin-left:auto;font:600 10px/1 'IBM Plex Mono',ui-monospace,monospace;",
    "  letter-spacing:.1em;text-transform:uppercase;color:#a19cae;}",
    ".x{background:none;border:none;color:#a19cae;cursor:pointer;font-size:19px;line-height:1;padding:2px 4px;}",
    ".x:hover{color:#f3f1ec;}",
    ".now{display:flex;gap:13px;padding:15px 14px 12px;}",
    ".art{width:74px;height:74px;border-radius:50%;flex:none;overflow:hidden;position:relative;",
    "  display:flex;align-items:center;justify-content:center;",
    "  background:linear-gradient(140deg,hsl(var(--h,35) 55% 42%),hsl(var(--h,35) 45% 24%));}",
    ".art img{width:100%;height:100%;object-fit:cover;display:block;}",
    ".art span{font:800 30px/1 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;color:rgba(255,255,255,.92);}",
    ".art:after{content:'';position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(244,167,48,.45);}",
    ".tag{display:inline-block;font:600 9px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.1em;",
    "  text-transform:uppercase;color:#f4a730;margin-bottom:5px;}",
    ".d{font-size:12px;color:#a19cae;margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;",
    "  -webkit-box-orient:vertical;overflow:hidden;}",
    ".nx{display:flex;gap:7px;align-items:center;padding:9px 14px 0;font-size:12px;color:#a19cae;",
    "  overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}",
    ".nx b{color:#f4a730;font:600 9px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.1em;",
    "  text-transform:uppercase;flex:none;}",
    ".meta{min-width:0;flex:1;}",
    ".t{font-weight:600;margin:0 0 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".s{font-size:12px;color:#a19cae;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".time{font:11px/1 'IBM Plex Mono',ui-monospace,monospace;color:#a19cae;margin-top:8px;}",
    ".bar{height:4px;border-radius:2px;background:#292734;margin:0 14px;overflow:hidden;}",
    ".bar i{display:block;height:100%;width:0;background:#f4a730;border-radius:2px;}",
    ".ctrl{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 14px 6px;}",
    ".ctrl button{background:#292734;border:1px solid #3a3747;color:#f3f1ec;cursor:pointer;",
    "  width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;",
    "  font-size:13px;line-height:1;padding:0;}",
    ".ctrl button:hover{border-color:#f4a730;}",
    ".ctrl .play{width:46px;height:46px;background:#f4a730;border-color:#f4a730;color:#231400;font-size:16px;}",
    ".ctrl .play:hover{background:#ffc158;}",
    ".list{max-height:190px;overflow-y:auto;border-top:1px solid #3a3747;margin-top:8px;}",
    ".row{display:flex;gap:9px;align-items:center;padding:9px 14px;cursor:pointer;border:none;",
    "  background:none;color:inherit;width:100%;text-align:left;font:inherit;}",
    ".row:hover{background:#231f2e;}",
    ".row.on{background:#231f2e;}",
    ".row .n{font:11px/1 'IBM Plex Mono',ui-monospace,monospace;color:#a19cae;width:16px;flex:none;}",
    ".row.on .n{color:#f4a730;}",
    ".row .rt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}",
    ".row .rd{font:11px/1 'IBM Plex Mono',ui-monospace,monospace;color:#a19cae;flex:none;}",
    ".foot{padding:11px 14px;border-top:1px solid #3a3747;}",
    ".foot a{display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;",
    "  background:#292734;border:1px solid #3a3747;border-radius:10px;padding:9px;",
    "  color:#f3f1ec;font-size:13px;font-weight:600;}",
    ".foot a:hover{border-color:#f4a730;color:#f4a730;}",
    ".msg{padding:20px 16px;text-align:center;color:#a19cae;font-size:13px;}",
    "@media (max-width:420px){",
    "  .panel{width:calc(100vw - 32px);}",
    "  .list{max-height:150px;}",
    "}"
  ].join("\n");

  var style = document.createElement("style");
  style.textContent = CSS;

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.innerHTML =
    '<div class="panel" id="panel" role="dialog" aria-label="' + esc(TITLE) + '">' +
      '<div class="head">' +
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

  /* --------------------------------- данные ----------------------------- */
  var audio = new Audio();
  audio.preload = "none";
  var queue = [], idx = -1, day = "", opened = false;

  function pickDay(air, tracks) {
    var t = todayStr();
    var days = Object.keys(air || {}).filter(function (d) {
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && (air[d] || []).length;
    }).sort();
    if (air && air[t] && air[t].length) return t;
    var past = days.filter(function (d) { return d <= t; });
    if (past.length) return past[past.length - 1];
    // эфира нет вовсе — берём последний день, за который есть записи
    var withDate = tracks.filter(function (x) { return x.date && x.date <= t; })
                         .map(function (x) { return x.date; }).sort();
    return withDate.length ? withDate[withDate.length - 1] : "";
  }

  /* Виджет живёт на чужом домене, а браузер разрешает читать чужой JSON
     только если сервер прямо это позволил. Заголовки нам неподконтрольны,
     поэтому есть запасной путь: тот же манифест, выложенный отдельным
     файлом-скриптом. Скрипты с чужого домена грузятся без разрешений, и
     виджет работает даже там, где fetch запрещён. */
  function loadViaScript() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = MANIFEST_JS + "?t=" + Date.now();
      s.async = true;
      s.onload = function () {
        s.parentNode && s.parentNode.removeChild(s);
        if (window.__voiceAiManifest) resolve(window.__voiceAiManifest);
        else reject(new Error("пустой манифест"));
      };
      s.onerror = function () {
        s.parentNode && s.parentNode.removeChild(s);
        reject(new Error("манифест не загрузился"));
      };
      (document.head || document.documentElement).appendChild(s);
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
        render();
      })
      ["catch"](function () {
        // радио недостижимо — виджет остаётся ссылкой, а не пустой коробкой
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
          '<div class="time" id="tm">00:00</div>' +
        '</div>' +
      '</div>' +
      '<div class="bar"><i id="fill"></i></div>' +
      '<div class="ctrl">' +
        '<button id="prev" aria-label="Предыдущая запись" title="Предыдущая">◀</button>' +
        '<button class="play" id="play" aria-label="Слушать">▶</button>' +
        '<button id="next" aria-label="Следующая запись" title="Следующая">▶</button>' +
      '</div>' +
      (queue.length > 1
        ? '<div class="nx"><b>далее</b> ' +
          esc(queue[(idx + 1) % queue.length].title || "") + '</div>'
        : "") +
      '<div class="list" id="list">' +
        queue.map(function (x, i) {
          return '<button class="row' + (i === idx ? " on" : "") + '" data-i="' + i + '">' +
                   '<span class="n">' + (i + 1 < 10 ? "0" : "") + (i + 1) + '</span>' +
                   '<span class="rt">' + esc(x.title || x.file) + '</span>' +
                   '<span class="rd">' + (x.duration ? fmt(x.duration) : "—:—") + '</span>' +
                 '</button>';
        }).join("") +
      '</div>';

    $("play").addEventListener("click", toggle);
    $("prev").addEventListener("click", function () { step(-1); });
    $("next").addEventListener("click", function () { step(1); });
    $("list").addEventListener("click", function (e) {
      var row = e.target.closest ? e.target.closest(".row") : null;
      if (row) select(+row.getAttribute("data-i"), true);
    });
    syncPlay();
  }

  function select(i, play) {
    if (i < 0 || i >= queue.length) return;
    idx = i;
    audio.src = audioUrl(queue[i].file);
    render();
    if (play) { var p = audio.play(); if (p && p["catch"]) p["catch"](function () {}); }
  }
  function step(d) {
    if (!queue.length) return;
    select((idx + d + queue.length) % queue.length, !audio.paused || started);
  }
  var started = false;
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
  audio.addEventListener("timeupdate", function () {
    var tm = $("tm"), fill = $("fill");
    if (!tm || !fill) return;
    var dur = isFinite(audio.duration) && audio.duration > 0
      ? audio.duration : (queue[idx] && queue[idx].duration) || 0;
    tm.textContent = fmt(audio.currentTime) + (dur ? " / " + fmt(dur) : "");
    fill.style.width = (dur ? Math.min(100, audio.currentTime / dur * 100) : 0) + "%";
  });
  /* Одна нечитаемая запись не должна останавливать эфир — переходим к
     следующей. Но если не открывается вообще ничего, перебор превращается в
     бесконечный круг с запросами каждую секунду: считаем неудачи подряд и,
     пройдя очередь целиком, честно останавливаемся. */
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
    var tm = $("tm");
    if (tm) tm.textContent = "записи не читаются";
  });

  /* ------------------------------- открытие ----------------------------- */
  function open(on) {
    opened = on;
    panel.classList.toggle("on", on);
    if (on && !queue.length) load();
  }
  fab.addEventListener("click", function () { open(!opened); });
  $("close").addEventListener("click", function () { open(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && opened) open(false); });
  // клик мимо виджета закрывает панель — привычное поведение для таких окон
  document.addEventListener("click", function (e) {
    if (!opened) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    open(false);
  });

  load();   // данные тянем сразу, чтобы панель открывалась уже заполненной
})();
