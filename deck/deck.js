/* Презентация поверх сайта: шесть слайдов, листаются стрелками, клавишами (← → пробел, PageUp/PageDown —
   так работают пульты-кликеры), свайпом и точками внизу. F — во весь экран, Esc — закрыть.
   Открывает её кнопка «Презентация» в шапке (index.html), этот файл грузится только по нажатию.
   window.VoiceAiDeck.open() возвращает Promise, который выполняется при закрытии. */
(function(){
  if(window.VoiceAiDeck) return;

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function inn(i, html, tag, cls){ return "<" + (tag || "div") + ' class="dk-in' + (cls ? " " + cls : "") + '" style="--i:' + i + '">' + html + "</" + (tag || "div") + ">"; }

  var ICON = {
    air:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="10" rx="1.5"/><path d="M6 18h6M9 14v4"/><rect x="16.5" y="8" width="5" height="11" rx="1.2"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/></svg>',
    lock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor"/></svg>',
    mic:   '<svg class="dk-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>'
  };

  function logo(){ return '<span class="dk-logo">VOiCE<span class="ai">Ai</span></span>'; }
  function orb(inner){ return '<div class="dk-orb"><span class="ring"></span><span class="ring"></span><span class="ring"></span><span class="core"></span>' + inner + "</div>"; }
  function eq(n){ var s = ""; for(var i=0;i<n;i++){ s += '<i style="animation-delay:' + (-(i * 0.37) % 1.1).toFixed(2) + "s;animation-duration:" + (0.8 + (i * 7 % 5) / 10).toFixed(1) + 's"></i>'; } return '<div class="dk-eq">' + s + "</div>"; }
  function wave(n){ var s = ""; for(var i=0;i<n;i++){ s += '<i class="' + (i % 9 < 4 ? "" : "b") + '" style="animation-delay:' + (-(i * 0.21) % 1.3).toFixed(2) + 's"></i>'; } return '<div class="dk-wave dk-in" style="--i:6">' + s + "</div>"; }

  // слайд-ролик: играет со звуком, пока слайд открыт, и сам листает дальше, когда закончится
  function videoSlide(src){
    return '<section class="dk-slide dk-video"><video playsinline preload="auto" src="' + esc(src) + '"></video></section>';
  }

  function slides(tedo, opts){
    var out = [];

    // 1. Титул — в стиле логотипа
    var title = '<section class="dk-slide dk-center">' +
      (tedo ? '<div class="dk-tedo dk-in" style="--i:4">' + tedo + "</div>" : "") +
      inn(0, orb(logo() + '<span class="line"></span><span class="dk-freq">202.6 tedointernal.fm</span>' + eq(9))) +
      inn(2, "корпоративное радио «Технологий Доверия»", "div", "dk-tagline") +
      "</section>";
    out.push(title);
    /* Сценарий выступления (только режим редактора): заставка → ролик к выступлению → заставка, пока выходит
       спикер → промо-ролик → заставка → слайды. Всё в одном окне во весь экран, листается кликером. */
    if(opts.talk || opts.promo){
      if(opts.talk) out.push(videoSlide(opts.talk), title);
      if(opts.promo) out.push(videoSlide(opts.promo), title);
    }

    // 2. Корпоративное радио
    var feats = [
      ["air", "Эфир сегодня и «Для меня»", "Общий эфир для всех и личная подборка в одном плеере. Подборку ведёт сам сотрудник."],
      ["phone", "С ПК и телефона", "Слушать можно с компьютера и телефона, без входа и регистрации."],
      ["search", "Новости, поиск и архив", "Быстрый поиск по эфирам, новостям и материалам — ничего не потеряется."],
      ["lock", "Безопасность", "Доступы и ключи, контроль выпуска и данные, которые не выходят из компании."]
    ];
    out.push('<section class="dk-slide">' +
      inn(0, "Voice AI: корпоративное радио", "h2", "dk-h") +
      inn(1, '<img src="deck/site.jpg" alt="Главный экран радио">', "div", "dk-shot") +
      '<div class="dk-feat">' + feats.map(function(f, i){
        return inn(3 + i, '<div class="dk-ico">' + ICON[f[0]] + "</div><h3>" + esc(f[1]) + "</h3><p>" + esc(f[2]) + "</p>", "div", "dk-card");
      }).join("") + "</div></section>");

    // 3. Аудио: от записи до эфира
    var steps = [
      ["Аудио создают редакторы", "В нейросетях или прямо на платформе, в своей студии озвучки. На входе — аудио или видео."],
      ["Тедора разбирает запись", "Готовит новости и описание записи: название, теги, текст."],
      ["Выпускающий грузит всё сразу", "Аудио с карточкой и новости по дням — за один подход."],
      ["Платформа готовит звук сама", "Сжимает и переводит в MP3 прямо в браузере: речь 64–96 кбит/с, музыка 128."]
    ];
    out.push('<section class="dk-slide">' +
      inn(0, "Аудио: от записи до эфира", "h2", "dk-h") +
      inn(1, "Как запись попадает в эфир: из нейросетей редакторов или из своей студии на платформе", "p", "dk-sub") +
      '<div class="dk-steps"><div class="dk-flow"><i></i></div>' + steps.map(function(s, i){
        return inn(2 + i, '<div class="dk-num">' + (i + 1) + "</div><h3>" + esc(s[0]) + "</h3><p>" + esc(s[1]) + "</p>", "div", "dk-card");
      }).join("") + "</div>" +
      '<div class="dk-card dk-studio dk-in" style="--i:6"><div class="txt"><h3>Своя студия: генератор диалогов и голоса</h3>' +
        "<p>Кнопка «Озвучить текст»: реплики «Имя: текст», четыре голоса — Дмитрий, Денис, Руслан, Ирина — и темп. " +
        "Прослушать и сразу в фонотеку. Синтез работает внутри компании: текст не уходит во внешние сервисы.</p></div>" + wave(30) + "</div>" +
      "</section>");

    // 4. Что дальше
    var plan = [
      ["done", "сделано", "Корпоративный контур", "GitLab компании и свой стенд, обновления без простоя"],
      ["done", "сделано", "Несколько редакторов", "Личные ссылки вместо общих ключей, у каждого свои новости и статусы"],
      ["done", "сделано", "Сборщики новостей", "Почта и интернет раз в 3 часа; одна тема — одна карточка, повторов нет"],
      ["done", "сделано", "Студия озвучки", "Диалоги из текста своими голосами, сразу в фонотеку"],
      ["next", "следующий шаг", "ИИ-пересказ и «Новости часа»", "Текст для радио и сводка часа языковой моделью внутри контура"],
      ["", "в планах", "Статистика прослушиваний", "Что и сколько слушают, чтобы собирать эфир по фактам"],
      ["", "в планах", "Шаблоны выпусков", "Заготовки эфира для повторяющихся программ"],
      ["", "в планах", "Аудио отдельно от кода", "Записи — во внешнее хранилище, сайт легче и быстрее"],
      ["", "в планах", "Стенды QA и прод", "Проверка отдельно от рабочего сайта"],
      ["new", "новое · в планах", "Голосовое управление", "«Включи эфир», «дальше», «громче» — плеер слушается голоса", 1],
      ["new", "новое · в планах", "Новости вслух", "Любую новость на сайте можно послушать — нашими голосами"],
      ["new", "новое · в планах", "Голосовой ассистент", "Отвечает на вопросы слушателей по материалам платформы", 1]
    ];
    out.push('<section class="dk-slide">' +
      inn(0, "Что дальше?", "h2", "dk-h") +
      inn(1, "План развития продукта на текущий финансовый год", "p", "dk-sub") +
      '<div class="dk-plan">' + plan.map(function(p, i){
        var voice = p[0] === "new";
        return inn(2 + i, '<div class="dk-st ' + p[0] + '">' + esc(p[1]) + "</div><h3>" + (voice ? ICON.mic : "") + esc(p[2]) + "</h3><p>" + esc(p[3]) + "</p>",
                   "div", "dk-card" + (voice ? " is-voice" : ""));
      }).join("") + "</div></section>");

    // 5. Команда
    var team = [["paukov", "Валентин Пауков"], ["aleshkin", "Александр Алешкин"], ["samorodova", "Наталия Самородова"],
                ["fedulova", "Кристина Федулова"], ["iskhakova", "Лилия Исхакова"], ["movsisyan", "Седа Мовсисян"]];
    out.push('<section class="dk-slide">' +
      inn(0, "Команда", "h2", "dk-h") +
      '<div class="dk-team">' + team.map(function(t, i){
        var n = t[1].split(" ");
        return inn(1 + i, '<img src="deck/team/' + t[0] + '.jpg" alt="">' + "<b>" + esc(n[0]) + "<br>" + esc(n[1]) + "</b>", "div", "dk-card dk-person");
      }).join("") + "</div></section>");

    // 6. Финал — только логотип
    out.push('<section class="dk-slide dk-center dk-final">' + inn(0, orb(logo())) + "</section>");
    return out.join("");
  }

  function open(opts){
    opts = opts || {};
    return new Promise(function(done){
      var tedoEl = document.querySelector(".tedo-logo-svg");
      var ov = document.createElement("div");
      ov.className = "dk-ov";
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-modal", "true");
      ov.setAttribute("aria-label", "Презентация Voice Ai");
      ov.innerHTML =
        '<button type="button" class="dk-btn dk-close" aria-label="Закрыть презентацию" title="Закрыть (Esc)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<div class="dk-stage">' + slides(tedoEl ? tedoEl.outerHTML : "", opts) + "</div>" +
        '<div class="dk-bar">' +
          '<button type="button" class="dk-btn dk-prev" aria-label="Назад"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
          '<div class="dk-dots"></div>' +
          '<button type="button" class="dk-btn dk-next" aria-label="Дальше"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
          '<span class="dk-count"></span>' +
          '<button type="button" class="dk-btn dk-fs" aria-label="Во весь экран" title="Во весь экран (F)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>' +
        "</div>";
      document.body.appendChild(ov);
      var prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      var list = ov.querySelectorAll(".dk-slide"), dots = ov.querySelector(".dk-dots");
      var prevBtn = ov.querySelector(".dk-prev"), nextBtn = ov.querySelector(".dk-next"), count = ov.querySelector(".dk-count");
      var cur = -1;
      var vids = ov.querySelectorAll(".dk-video video");
      Array.prototype.forEach.call(vids, function(v){
        v.addEventListener("ended", function(){ if(v.parentNode === list[cur]) go(cur + 1); });
        v.addEventListener("click", function(){ if(v.paused) v.play()["catch"](function(){}); else v.pause(); });
      });
      function curVideo(){ return list[cur] && list[cur].querySelector("video"); }
      for(var i=0;i<list.length;i++){
        var d = document.createElement("button");
        d.type = "button"; d.setAttribute("aria-label", "Слайд " + (i + 1));
        d.addEventListener("click", go.bind(null, i));
        dots.appendChild(d);
      }
      function go(n){
        if(n < 0 || n >= list.length || n === cur) return;
        for(var k=0;k<list.length;k++){
          list[k].classList.toggle("is-cur", k === n);
          list[k].classList.toggle("is-prev", k < n);
          dots.children[k].classList.toggle("on", k === n);
        }
        // ролик на слайде: ушли — пауза, пришли — с начала и со звуком (листание — нажатие человека, браузер разрешает)
        for(var j=0;j<vids.length;j++){
          var v = vids[j];
          if(v.parentNode === list[n]){ try{ v.currentTime = 0; }catch(e){} v.muted = false; v.volume = 1; v.play()["catch"](function(){}); }
          else if(!v.paused) v.pause();
        }
        cur = n;
        prevBtn.disabled = n === 0;
        nextBtn.disabled = n === list.length - 1;
        count.textContent = (n + 1) + " / " + list.length;
      }
      function isFull(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
      function toggleFull(){
        if(isFull()){ (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        var r = ov.requestFullscreen || ov.webkitRequestFullscreen;
        if(r) try{ var p = r.call(ov); if(p && p["catch"]) p["catch"](function(){}); }catch(e){}
      }
      function onFull(){ ov.classList.toggle("is-full", isFull()); }
      function close(){
        Array.prototype.forEach.call(vids, function(v){ try{ v.pause(); }catch(e){} });
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("fullscreenchange", onFull);
        document.removeEventListener("webkitfullscreenchange", onFull);
        if(isFull()) try{ (document.exitFullscreen || document.webkitExitFullscreen).call(document); }catch(e){}
        ov.classList.remove("is-on");
        setTimeout(function(){ ov.remove(); document.body.style.overflow = prevOverflow; done(); }, 350);
      }
      function onKey(e){
        var k = e.key;
        var cv = curVideo();
        if(k === " " && cv){ if(cv.paused) cv.play()["catch"](function(){}); else cv.pause(); }   // на ролике пробел — пауза
        else if(k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter"){ go(cur + 1); }
        else if(k === "ArrowLeft" || k === "PageUp" || k === "Backspace"){ go(cur - 1); }
        else if(k === "Home"){ go(0); }
        else if(k === "End"){ go(list.length - 1); }
        else if(k === "f" || k === "F" || k === "а" || k === "А"){ toggleFull(); }
        else if(k === "Escape"){ if(!isFull()) close(); }
        else return;
        e.preventDefault(); e.stopPropagation();
      }
      prevBtn.addEventListener("click", function(){ go(cur - 1); });
      nextBtn.addEventListener("click", function(){ go(cur + 1); });
      ov.querySelector(".dk-fs").addEventListener("click", toggleFull);
      ov.querySelector(".dk-close").addEventListener("click", close);
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("fullscreenchange", onFull);
      document.addEventListener("webkitfullscreenchange", onFull);

      // свайп на телефоне и планшете
      var sx = null, sy = 0;
      ov.addEventListener("touchstart", function(e){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive: true});
      ov.addEventListener("touchend", function(e){
        if(sx === null) return;
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        sx = null;
        if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
      });
      // во весь экран панель прячется и показывается, когда двигают мышь
      var hideT = null;
      ov.addEventListener("mousemove", function(){
        ov.classList.add("show-bar"); clearTimeout(hideT);
        hideT = setTimeout(function(){ ov.classList.remove("show-bar"); }, 1800);
      });

      go(0);
      requestAnimationFrame(function(){ ov.classList.add("is-on"); });
      nextBtn.focus();
    });
  }

  window.VoiceAiDeck = {open: open};
})();
