/* Режим редактора на GitHub Pages.
   Страница умеет писать файлы только через API GitLab (клиент makeGH в index.html).
   Здесь эти запросы перехватываются и переводятся в API GitHub: файлы читаются и
   пишутся в этот репозиторий, в ветку main, личным токеном GitHub выпускающего.
   Токен хранится только в этом браузере (localStorage), как и раньше.
   Всё, что требует сервера (приёмник новостей, редакторы, источники, озвучка), здесь скрыто. */
(function(){
  var STORE = "https://store.invalid/api/v4";
  var REPO = "valentinpaukov-ops/Voice_Ai", BRANCH = "main";
  var GH_API = "https://api.github.com/repos/" + REPO;

  var css = "#ncAccess,#ncSources,#inboxBadge,#inboxPanel,#ttsToggle,#ttsBody," +
            ".nc-field:has(#ghOwner),.nc-field:has(#ghRepo),.nc-field:has(#ghBranch){display:none!important;}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var realFetch = window.fetch.bind(window);

  function enc(path){ return String(path).split("/").map(encodeURIComponent).join("/"); }
  function json(status, obj, extra){
    var h = {"Content-Type": "application/json"};
    if(extra) for(var k in extra) h[k] = extra[k];
    return new Response(obj == null ? null : JSON.stringify(obj), {status: status, headers: h});
  }
  function tokenOf(init){
    var h = (init && init.headers) || {};
    if(typeof h.get === "function") return h.get("PRIVATE-TOKEN") || "";
    return h["PRIVATE-TOKEN"] || "";
  }
  function gh(method, url, tok, body){
    var h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"};
    if(tok) h["Authorization"] = "Bearer " + tok;
    if(body) h["Content-Type"] = "application/json";
    return realFetch(url, {method: method, headers: h, cache: "no-store", body: body ? JSON.stringify(body) : undefined});
  }
  function readJson(res){ return res.json()["catch"](function(){ return null; }); }
  // ответ GitHub с ошибкой → такой же, какой дал бы GitLab (клиент разбирает статус и текст)
  function fail(res, data){
    var m = (data && data.message) || "";
    if(res.status === 422 && /sha/i.test(m)) return json(400, {message: "A file with this name already exists"});
    if(res.status === 409) return json(409, {message: "changed since"});
    if(res.status === 403 && /rate limit/i.test(m)) return json(429, {message: "GitHub временно ограничил запросы, повторите через минуту"});
    return json(res.status === 422 ? 400 : res.status, {message: m});
  }
  // метаданные файла: sha версии файла (служит вместо id последнего коммита в GitLab)
  function meta(path, tok){
    return gh("GET", GH_API + "/contents/" + enc(path) + "?ref=" + BRANCH, tok).then(function(res){
      return readJson(res).then(function(d){ return {res: res, data: d}; });
    });
  }

  function handle(url, init){
    var method = ((init && init.method) || "GET").toUpperCase();
    var tok = tokenOf(init);
    var u = new URL(url);
    var p = u.pathname.replace(/^\/api\/v4/, "");
    var m;

    if(p === "/personal_access_tokens/self") return Promise.resolve(json(404, {message: "404 Not Found"}));

    // сам проект: проверка токена и права записи
    if(/^\/projects\/[^\/]+$/.test(p)){
      return gh("GET", GH_API, tok).then(function(res){
        return readJson(res).then(function(d){
          if(!res.ok) return fail(res, d);
          var perm = (d && d.permissions) || {};
          var level = perm.admin ? 40 : (perm.push ? 30 : 10);
          return json(200, {empty_repo: false, permissions: {project_access: {access_level: level}}});
        });
      });
    }

    // содержимое папки
    if(/^\/projects\/[^\/]+\/repository\/tree$/.test(p)){
      var dir = u.searchParams.get("path") || "";
      return meta(dir, tok).then(function(r){
        if(!r.res.ok) return fail(r.res, r.data);
        var list = Array.isArray(r.data) ? r.data : [];
        return json(200, list.map(function(f){
          return {name: f.name, path: f.path, type: f.type === "dir" ? "tree" : "blob"};
        }));
      });
    }

    m = p.match(/^\/projects\/[^\/]+\/repository\/files\/(.+)$/);
    if(m){
      var path = decodeURIComponent(m[1]);
      var body = null;
      try{ body = init && init.body ? JSON.parse(init.body) : null; }catch(e){}

      if(method === "GET" || method === "HEAD"){
        return meta(path, tok).then(function(r){
          if(!r.res.ok) return fail(r.res, r.data);
          var d = r.data || {};
          if(method === "HEAD") return json(200, null, {"X-Gitlab-Last-Commit-Id": d.sha});
          if(d.content && d.encoding === "base64") return json(200, {content: d.content, last_commit_id: d.sha});
          // файл больше 1 МБ: содержимое отдаётся отдельно, по sha
          return gh("GET", GH_API + "/git/blobs/" + d.sha, tok).then(function(res){
            return readJson(res).then(function(b){
              if(!res.ok) return fail(res, b);
              return json(200, {content: b.content, last_commit_id: d.sha});
            });
          });
        });
      }

      if(method === "POST" || method === "PUT"){
        var put = {message: body.commit_message, content: body.content, branch: BRANCH};
        if(body.last_commit_id) put.sha = body.last_commit_id;
        return gh("PUT", GH_API + "/contents/" + enc(path), tok, put).then(function(res){
          return readJson(res).then(function(d){
            if(!res.ok) return fail(res, d);
            return json(method === "POST" ? 201 : 200, {file_path: path, branch: BRANCH});
          });
        });
      }

      if(method === "DELETE"){
        return meta(path, tok).then(function(r){
          if(!r.res.ok) return fail(r.res, r.data);
          return gh("DELETE", GH_API + "/contents/" + enc(path), tok,
                    {message: (body && body.commit_message) || "Удаление " + path, sha: r.data.sha, branch: BRANCH})
            .then(function(res){
              return readJson(res).then(function(d){ return res.ok ? json(204, null) : fail(res, d); });
            });
        });
      }
    }
    return Promise.resolve(json(404, {message: "404 Not Found"}));
  }

  window.fetch = function(input, init){
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if(url.indexOf(STORE) === 0) return handle(url, init);
    return realFetch(input, init);
  };
})();
