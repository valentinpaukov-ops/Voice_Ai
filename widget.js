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

  /* Минимальный кодировщик QR: байтовый режим, уровень коррекции L,
     версии 1–10 (до 271 байта). Больше нам и не нужно: ссылка на запись
     с секундой укладывается в сотню символов.
     Таблицы здесь только две — сколько данных влезает в версию и где стоят
     выравнивающие квадраты. Всё остальное считается, а не берётся из памяти:
     и служебные биты формата, и биты версии — это обычный полиномиальный
     остаток, его надёжнее вычислить, чем выписать. */
  function qrMatrix(text) {
    /* ---------- байты ---------- */
    var data = [];
    var str = unescape(encodeURIComponent(String(text)));
    for (var i = 0; i < str.length; i++) data.push(str.charCodeAt(i) & 255);

    /* ---------- выбор версии ---------- */
    var CAP = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];   // байт при уровне L
    var ECC = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];          // проверочных на блок
    var BLK = [                                                  // [сколько блоков, данных в блоке]
      [[1, 19]], [[1, 34]], [[1, 55]], [[1, 80]], [[1, 108]],
      [[2, 68]], [[2, 78]], [[2, 97]], [[2, 116]], [[2, 68], [2, 69]]
    ];
    var ver = 0;
    for (var v = 0; v < CAP.length; v++) if (data.length <= CAP[v]) { ver = v + 1; break; }
    if (!ver) return null;
    var size = 17 + ver * 4;
    var ecPerBlock = ECC[ver - 1];
    var groups = BLK[ver - 1];
    var totalData = 0;
    groups.forEach(function (g) { totalData += g[0] * g[1]; });

    /* ---------- поток бит ---------- */
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);                                   // байтовый режим
    push(data.length, ver < 10 ? 8 : 16);
    data.forEach(function (b) { push(b, 8); });
    for (var i = 0; i < 4 && bits.length < totalData * 8; i++) bits.push(0);   // терминатор
    while (bits.length % 8) bits.push(0);
    var codewords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
      codewords.push(b);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while (codewords.length < totalData) codewords.push(pad[pi++ % 2]);

    /* ---------- Рид—Соломон ---------- */
    var EXP = new Array(512), LOG = new Array(256);
    (function () {
      var x = 1;
      for (var i = 0; i < 255; i++) {
        EXP[i] = x; LOG[x] = i;
        x <<= 1; if (x & 256) x ^= 0x11D;
      }
      for (var i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    })();
    function mul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }
    function rsGen(n) {
      var poly = [1];
      for (var i = 0; i < n; i++) {
        var next = poly.concat([0]);
        for (var j = 0; j < poly.length; j++) next[j + 1] ^= mul(poly[j], EXP[i]);
        poly = next;
      }
      return poly;
    }
    function rsEnc(block, n) {
      var gen = rsGen(n);
      var res = block.concat(new Array(n).fill(0));
      for (var i = 0; i < block.length; i++) {
        var factor = res[i];
        if (!factor) continue;
        for (var j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], factor);
      }
      return res.slice(block.length);
    }

    /* ---------- блоки и перемешивание ---------- */
    var dataBlocks = [], ecBlocks = [], at = 0;
    groups.forEach(function (g) {
      for (var n = 0; n < g[0]; n++) {
        var chunk = codewords.slice(at, at + g[1]); at += g[1];
        dataBlocks.push(chunk);
        ecBlocks.push(rsEnc(chunk, ecPerBlock));
      }
    });
    var out = [], maxLen = 0;
    dataBlocks.forEach(function (b) { maxLen = Math.max(maxLen, b.length); });
    for (var i = 0; i < maxLen; i++)
      for (var b = 0; b < dataBlocks.length; b++)
        if (i < dataBlocks[b].length) out.push(dataBlocks[b][i]);
    for (var i = 0; i < ecPerBlock; i++)
      for (var b = 0; b < ecBlocks.length; b++) out.push(ecBlocks[b][i]);

    var finalBits = [];
    out.forEach(function (b) { for (var i = 7; i >= 0; i--) finalBits.push((b >> i) & 1); });
    var tailBits = (ver >= 2 && ver <= 6) ? 7 : 0;   // добивка до конца области данных
    for (var i = 0; i < tailBits; i++) finalBits.push(0);

    /* ---------- сетка ---------- */
    var m = [], reserved = [];
    for (var r = 0; r < size; r++) {
      m.push(new Array(size).fill(0));
      reserved.push(new Array(size).fill(false));
    }
    function set(r, c, val) { m[r][c] = val ? 1 : 0; reserved[r][c] = true; }
    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var on = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
                 (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
                 (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
        set(rr, cc, on);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (var i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

    var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                 [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]][ver - 1];
    var lastAl = ALIGN[ALIGN.length - 1];
    for (var a = 0; a < ALIGN.length; a++) for (var b = 0; b < ALIGN.length; b++) {
      var ar = ALIGN[a], ac = ALIGN[b];
      /* Пропускаем только три угла, где стоят большие поисковые квадраты.
         Остальные рисуем всегда — в том числе поверх линии синхронизации:
         там выравнивающий квадрат главнее. Раньше проверка была «занято ли
         место», и квадраты на этой линии терялись, из-за чего версии от
         седьмой и выше переставали читаться. */
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === lastAl) ||
          (ar === lastAl && ac === 6)) continue;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++)
        set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    set(size - 8, 8, 1);                                   // обязательный тёмный модуль

    // места под служебные биты формата
    for (var i = 0; i < 9; i++) {
      if (!reserved[8][i]) reserved[8][i] = true;
      if (!reserved[i][8]) reserved[i][8] = true;
    }
    for (var i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
    if (ver >= 7) for (var i = 0; i < 6; i++) for (var j = 0; j < 3; j++) {
      reserved[size - 11 + j][i] = true; reserved[i][size - 11 + j] = true;
    }

    /* ---------- укладка данных змейкой ---------- */
    var bi = 0, up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                                // столбец синхрополосы пропускаем
      for (var n = 0; n < size; n++) {
        var row = up ? size - 1 - n : n;
        for (var c = 0; c < 2; c++) {
          var cc = col - c;
          if (reserved[row][cc]) continue;
          m[row][cc] = bi < finalBits.length ? finalBits[bi++] : 0;
        }
      }
      up = !up;
    }

    /* ---------- маски и выбор лучшей ---------- */
    function maskBit(k, r, c) {
      switch (k) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return (r * c) % 2 + (r * c) % 3 === 0;
        case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
        default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
      }
    }
    function penalty(g) {
      var p = 0, i, j, run, dark = 0;
      for (i = 0; i < size; i++) {
        run = 1;
        for (j = 1; j < size; j++) {
          if (g[i][j] === g[i][j - 1]) { run++; } else { if (run >= 5) p += run - 2; run = 1; }
        }
        if (run >= 5) p += run - 2;
        run = 1;
        for (j = 1; j < size; j++) {
          if (g[j][i] === g[j - 1][i]) { run++; } else { if (run >= 5) p += run - 2; run = 1; }
        }
        if (run >= 5) p += run - 2;
      }
      for (i = 0; i < size - 1; i++) for (j = 0; j < size - 1; j++)
        if (g[i][j] === g[i][j + 1] && g[i][j] === g[i + 1][j] && g[i][j] === g[i + 1][j + 1]) p += 3;
      var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      function look(line) {
        var c = 0;
        for (var k = 0; k + 11 <= size; k++) {
          var ok = true, ok2 = true;
          for (var t = 0; t < 11; t++) {
            if (line[k + t] !== pat[t]) ok = false;
            if (line[k + t] !== pat[10 - t]) ok2 = false;
          }
          if (ok || ok2) c++;
        }
        return c * 40;
      }
      for (i = 0; i < size; i++) {
        p += look(g[i]);
        var colArr = [];
        for (j = 0; j < size; j++) colArr.push(g[j][i]);
        p += look(colArr);
      }
      for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (g[i][j]) dark++;
      p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
      return p;
    }

    /* биты формата и версии считаем полиномиальным остатком — так надёжнее,
       чем держать в коде таблицы, в которых легко ошибиться */
    /* Служебные биты — обычный остаток от деления на образующий многочлен.
       Считаем, а не держим таблицей: в таблице из восьми пятнадцатибитных
       строк ошибиться проще, чем в четырёх строках кода. */
    function blen(x) { return x === 0 ? 0 : x.toString(2).length; }
    function polyRem(dataShifted, gen) {
      var v = dataShifted, g = blen(gen);
      while (blen(v) >= g) v ^= gen << (blen(v) - g);
      return v;
    }
    function formatBits(mask) {
      var v = (0x01 << 3) | mask;                       // уровень L = 01, затем маска
      return (((v << 10) | polyRem(v << 10, 0x537)) ^ 0x5412);
    }
    function versionBits(version) {
      return (version << 12) | polyRem(version << 12, 0x1F25);
    }

    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      var g = m.map(function (row) { return row.slice(); });
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++)
        if (!reserved[r][c] && maskBit(mask, r, c)) g[r][c] ^= 1;
      // служебные биты влияют на штраф, поэтому вписываем их до оценки
      var f = formatBits(mask);
      for (var i = 0; i < 15; i++) {
        var bit = (f >> i) & 1;
        // первая копия: вертикальная полоса у левого верхнего квадрата
        if (i < 6) g[i][8] = bit;
        else if (i === 6) g[7][8] = bit;
        else if (i === 7) g[8][8] = bit;
        else if (i === 8) g[8][7] = bit;
        else g[8][14 - i] = bit;
        // вторая копия: у правого верхнего и левого нижнего
        if (i < 8) g[8][size - 1 - i] = bit;
        else g[size - 15 + i][8] = bit;
      }
      g[size - 8][8] = 1;
      if (ver >= 7) {
        var vb = versionBits(ver);
        for (var i = 0; i < 18; i++) {
          var bit = (vb >> i) & 1;
          g[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
          g[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
        }
      }
      var sc = penalty(g);
      if (sc < bestScore) { bestScore = sc; best = g; bestMask = mask; }
    }
    return best;
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
    ".foot{padding:11px 14px;border-top:1px solid #3a3747;display:flex;gap:9px;}",
    ".foot a{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;",
    "  text-decoration:none;background:#292734;border:1px solid #3a3747;border-radius:10px;",
    "  padding:9px;color:#f3f1ec;font-size:13px;font-weight:600;white-space:nowrap;",
    "  overflow:hidden;text-overflow:ellipsis;}",
    ".foot a:hover{border-color:#f4a730;color:#f4a730;}",
    ".foot .qrbtn{flex:none;width:42px;background:#292734;border:1px solid #3a3747;",
    "  border-radius:10px;color:#f3f1ec;cursor:pointer;display:flex;align-items:center;",
    "  justify-content:center;padding:0;}",
    ".foot .qrbtn:hover{border-color:#f4a730;color:#f4a730;}",
    ".foot .qrbtn svg{width:18px;height:18px;}",
    /* окно с кодом поверх панели */
    ".qrview{position:absolute;inset:0;background:#1c1a24;z-index:5;display:flex;",
    "  flex-direction:column;align-items:center;justify-content:center;gap:11px;padding:18px;}",
    ".qrview canvas{background:#fff;border-radius:10px;display:block;}",
    ".qrview .cap{font-size:12px;color:#a19cae;text-align:center;line-height:1.45;",
    "  max-width:100%;overflow:hidden;text-overflow:ellipsis;}",
    ".qrview .back{background:#292734;border:1px solid #3a3747;border-radius:9px;",
    "  color:#f3f1ec;cursor:pointer;padding:7px 15px;font:inherit;font-size:13px;}",
    ".qrview .back:hover{border-color:#f4a730;color:#f4a730;}",
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
      '<div class="foot">' +
        '<a id="open" href="' + esc(SITE) + '" target="_blank" rel="noopener">Открыть Voice Ai →</a>' +
        '<button class="qrbtn" id="qrbtn" title="Продолжить на телефоне" aria-label="Продолжить на телефоне">' +
          '<svg viewBox="0 0 24 24" fill="currentColor">' +
          '<path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3z"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
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

  /* ---- код для телефона: та же ссылка, только картинкой ---------------- */
  function resumeUrl() {
    var t = queue[idx];
    if (!t || !t.file) return SITE;
    return SITE + "?play=" + encodeURIComponent(t.file) +
           "&at=" + Math.floor(audio.currentTime || 0) + "#air";
  }
  function showQr() {
    var t = queue[idx];
    if (!t) return;
    var url = resumeUrl();
    var m = qrMatrix(url);
    var box = document.createElement("div");
    box.className = "qrview";
    if (!m) {
      box.innerHTML = '<div class="cap">Ссылка слишком длинная для кода.</div>';
    } else {
      var n = m.length, quiet = 4;
      var box2 = Math.max(3, Math.floor(230 / (n + quiet * 2)));
      var side = (n + quiet * 2) * box2;
      var cv = document.createElement("canvas");
      cv.width = side; cv.height = side;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, side, side);
      ctx.fillStyle = "#15141c";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
        if (m[r][c]) ctx.fillRect((c + quiet) * box2, (r + quiet) * box2, box2, box2);
      box.appendChild(cv);
      var cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = "Наведите камеру телефона — откроется «" +
        (t.title || "запись") + "» с " + fmt(audio.currentTime || 0) + ".";
      box.appendChild(cap);
    }
    var back = document.createElement("button");
    back.className = "back";
    back.textContent = "Назад";
    back.addEventListener("click", function () { box.parentNode && box.parentNode.removeChild(box); });
    box.appendChild(back);
    panel.appendChild(box);
  }

  /* ---- переход на сайт: эфир должен продолжиться, а не начаться заново --- */
  $("open").addEventListener("click", function () {
    this.href = resumeUrl();
    audio.pause();       // чтобы две вкладки не играли хором
  });
  $("qrbtn").addEventListener("click", showQr);

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
