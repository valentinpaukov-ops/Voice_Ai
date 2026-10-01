/**
 * Ретранслятор новостей Voice Ai (Google Apps Script).
 *
 * Зачем он нужен. Редакторам не нужны ни GitHub, ни токены: они открывают страницу news-sender.html,
 * вводят код доступа и жмут «Отправить на проверку». Страница шлёт новости сюда, а этот скрипт сам кладёт
 * их в папку inbox/ репозитория. Токен GitHub хранится только в настройках скрипта (у вас) и в страницу
 * не попадает.
 *
 * Что скрипт НЕ может: он пишет только файлы inbox/news-<партия>-<номер>.json. Ни сайт, ни аудио, ни
 * news.json он не трогает, а выпустить новость в эфир может только выпускающий на платформе.
 *
 * Настройки (Проект → Настройки проекта → Свойства скрипта):
 *   GITHUB_TOKEN   токен GitHub (fine-grained, репозиторий Voice_Ai, Contents: Read and write)
 *   EDITORS        JSON: код доступа → имя, например {"A7K4Q9":"Анна Волкова","M2X8P5":"Иван Петров"}
 *   GITHUB_OWNER   (необязательно) по умолчанию valentinpaukov-ops
 *   GITHUB_REPO    (необязательно) по умолчанию Voice_Ai
 *   GITHUB_BRANCH  (необязательно) по умолчанию main
 */

var LIMITS = {maxBody: 150000, maxNews: 40, perDay: 300};

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// проверка из браузера: открыть адрес скрипта, должно появиться {"ok":true,...}
function doGet() {
  return out({ok: true, service: 'voiceai-news-relay'});
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function str(v, max) {
  if (typeof v !== 'string') return null;
  v = v.replace(/\s+/g, ' ').trim();
  return v.length > max ? null : v;
}

/* Проверка одной новости. Берём только известные поля и только допустимых видов: всё остальное отбрасывается. */
function cleanNews(n, idx) {
  if (!n || typeof n !== 'object') return {error: 'новость №' + (idx + 1) + ': не объект'};
  var o = {}, e = 'новость №' + (idx + 1) + ': ';
  o.title = str(n.title, 200);
  if (!o.title) return {error: e + 'нет заголовка или он длиннее 200 знаков'};
  o.text = (typeof n.text === 'string') ? n.text.replace(/\s+/g, ' ').trim() : '';
  if (o.text.length > 1500) return {error: e + 'описание длиннее 1500 знаков'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.date || ''))) return {error: e + 'дата должна быть ГГГГ-ММ-ДД'};
  if (!/^\d{2}:\d{2}$/.test(String(n.time || ''))) return {error: e + 'время должно быть ЧЧ:ММ'};
  o.date = n.date; o.time = n.time;
  o.author = str(n.author == null ? '' : n.author, 100);
  if (o.author === null) return {error: e + 'автор длиннее 100 знаков'};
  o.tags = [];
  if (n.tags != null) {
    if (!Array.isArray(n.tags) || n.tags.length > 8) return {error: e + 'тегов должно быть не больше 8'};
    for (var i = 0; i < n.tags.length; i++) {
      var t = str(n.tags[i], 40);
      if (!t) return {error: e + 'тег пустой или длиннее 40 знаков'};
      o.tags.push(t);
    }
  }
  if (n.sourceName) { o.sourceName = str(n.sourceName, 150); if (!o.sourceName) return {error: e + 'название источника слишком длинное'}; }
  if (n.sourceUrl) {
    var u = String(n.sourceUrl).trim();
    if (!/^https?:\/\/[^\s]+$/.test(u) || u.length > 600) return {error: e + 'ссылка должна начинаться с http:// или https://'};
    o.sourceUrl = u;
  }
  if (n.important === true) o.important = true;
  if (Array.isArray(n.fp) && n.fp.length) {
    if (n.fp.length > 240) return {error: e + 'слишком длинный отпечаток'};
    var fp = [];
    for (var k = 0; k < n.fp.length; k++) {
      if (typeof n.fp[k] !== 'string' || !/^[0-9a-z]{1,8}$/.test(n.fp[k])) return {error: e + 'отпечаток в неверном виде'};
      fp.push(n.fp[k]);
    }
    o.fp = fp;
  }
  if (n.replaces) {
    if (typeof n.replaces !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(n.replaces)) return {error: e + 'неверный номер заменяемой новости'};
    o.replaces = n.replaces;
    var rt = str(n.replacesTitle == null ? '' : n.replacesTitle, 200);
    if (rt) o.replacesTitle = rt;
  }
  var num = parseInt(n.n, 10);
  o.n = (num >= 1 && num <= 99) ? num : (idx + 1);
  return {item: o};
}

function githubPut(props, path, text, message) {
  var owner = props.getProperty('GITHUB_OWNER') || 'valentinpaukov-ops';
  var repo = props.getProperty('GITHUB_REPO') || 'Voice_Ai';
  var branch = props.getProperty('GITHUB_BRANCH') || 'main';
  var token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('не задан GITHUB_TOKEN');
  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  var headers = {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
  var sha;
  var got = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(branch), {headers: headers, muteHttpExceptions: true});
  if (got.getResponseCode() === 200) sha = JSON.parse(got.getContentText()).sha;       // файл уже есть: повторная отправка перезапишет его, а не создаст второй
  var body = {message: message, branch: branch, content: Utilities.base64Encode(text, Utilities.Charset.UTF_8)};
  if (sha) body.sha = sha;
  var res = UrlFetchApp.fetch(url, {method: 'put', contentType: 'application/json', headers: headers, payload: JSON.stringify(body), muteHttpExceptions: true});
  var code = res.getResponseCode();
  if (code !== 200 && code !== 201) throw new Error('GitHub ответил ' + code);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var props = PropertiesService.getScriptProperties();
    var raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return out({ok: false, error: 'empty'});
    if (raw.length > LIMITS.maxBody) return out({ok: false, error: 'too_big'});
    var body;
    try { body = JSON.parse(raw); } catch (err) { return out({ok: false, error: 'bad_json'}); }

    // кто это: имя берётся из таблицы кодов, а не из присланного, поэтому подписи нельзя подделать
    var editors = {};
    try { editors = JSON.parse(props.getProperty('EDITORS') || '{}'); } catch (err) {}
    var key = String((body && body.key) || '').trim();
    var who = Object.prototype.hasOwnProperty.call(editors, key) && key ? editors[key] : '';
    if (!who) {
      Utilities.sleep(1500);                                   // подбор кода становится медленным
      return out({ok: false, error: 'bad_key'});
    }

    var list = body.news;
    if (!Array.isArray(list) || !list.length) return out({ok: false, error: 'no_news'});
    if (list.length > LIMITS.maxNews) return out({ok: false, error: 'too_many'});
    var batch = String(body.batch || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40);
    if (!batch) batch = 'b' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 12);

    var items = [];
    for (var i = 0; i < list.length; i++) {
      var c = cleanNews(list[i], i);
      if (c.error) return out({ok: false, error: 'invalid', detail: c.error});
      items.push(c.item);
    }

    var dayKey = 'count_' + today();
    var used = parseInt(props.getProperty(dayKey) || '0', 10);
    if (used + items.length > LIMITS.perDay) return out({ok: false, error: 'daily_limit'});

    var created = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j], nn = ('0' + it.n).slice(-2);
      var file = {kind: 'news', title: it.title, text: it.text, date: it.date, time: it.time, author: it.author, tags: it.tags,
                  agent: who, created: new Date().toISOString().replace(/\.\d+Z$/, 'Z')};
      ['sourceName', 'sourceUrl', 'important', 'fp', 'replaces', 'replacesTitle'].forEach(function (k) { if (it[k] != null) file[k] = it[k]; });
      var path = 'inbox/news-' + batch + '-' + nn + '.json';           // путь всегда такой: наружу из inbox/ выйти нельзя
      githubPut(props, path, JSON.stringify(file, null, 2) + '\n', 'Новость на проверку (' + who + '): ' + it.title.slice(0, 80));
      created.push(path);
    }
    props.setProperty(dayKey, String(used + items.length));
    return out({ok: true, who: who, created: created});
  } catch (err) {
    return out({ok: false, error: 'server', detail: String(err && err.message || err)});
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
