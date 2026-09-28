(function(){
'use strict';
var TABS = [['route','Маршрут'],['witcher','Ведьмак 3'],['started','Начатые'],['horror','Хорроры'],['action','Экшен'],['rpg','RPG'],['short','Короткие'],['coop','С другом'],['hard','Хардкор'],['all','Все'],['done','Пройдено'],['dropped','Дроп']];
var ACH = [
{id:'first', n:'Первая кровь', d:'Пройди первую игру', test:function(c){return c.done.length >= 1;}},
{id:'hseason', n:'Хоррор-сезон', d:'Пройди Resident Evil 4 и Silent Hill f', test:function(c){return hasDone(c,'re4') && hasDone(c,'shf');}},
{id:'nerves', n:'Крепкие нервы', d:'Пройди 4 хоррора', test:function(c){return c.done.filter(function(g){return g.c.indexOf('horror') > -1;}).length >= 4;}},
{id:'short', n:'Короткий метр', d:'Пройди 3 игры до 8 часов', test:function(c){return c.done.filter(isShort).length >= 3;}},
{id:'epic', n:'Марафонец', d:'Пройди игру на 40+ часов', test:function(c){return c.done.some(function(g){return g.h >= 40;});}},
{id:'unfinished', n:'Незаконченное дело', d:'Добей игру, начатую до пропуска', test:function(c){return c.done.some(function(g){return !!g.s;});}},
{id:'nodrop', n:'Без права на дроп', d:'5 пройденных игр и ни одного жетона на дропы', test:function(c){return c.done.length >= 5 && c.tokensSpent === 0;}},
{id:'perfect', n:'Перфекционист', d:'Выполни все челленджи одной игры', test:function(c){return c.done.some(function(g){var ch = (prog(g.id) || {}).ch || {}; return challengesOf(g).every(function(x){return ch[x.id];});});}},
{id:'sprinter', n:'Спринтер', d:'Получи спринт-бонус 3 раза', test:function(c){return c.done.filter(function(g){return ((prog(g.id).score || {}).sprint || 0) > 0;}).length >= 3;}},
{id:'coop', n:'С другом веселее', d:'Пройди игру в кооп-слоте', test:function(c){return c.done.some(function(g){return (prog(g.id) || {}).slot === 'coop';});}},
{id:'dwait', n:'Дота подождёт', d:'2 недели без Доты', test:function(c){return c.dotaWeeks >= 2;}},
{id:'storyfirst', n:'Сначала сюжет', d:'7 дней «час сюжетки перед каткой»', test:function(c){return c.dotaDays >= 7;}},
{id:'wolf', n:'Белый Волк', d:'Пройди Ведьмака 3 и оба дополнения', test:function(c){return hasDone(c,'w3') && hasDone(c,'w3hos') && hasDone(c,'w3baw');}}
];
var GIFT = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="2" y="7" width="12" height="7" rx="1.2" fill="currentColor"/><rect x="1" y="4" width="14" height="3.2" rx="1" fill="currentColor"/><rect x="7.1" y="4" width="1.8" height="10" fill="var(--surface)"/></svg>';
/* ---------- состояние ---------- */
var S = {progress:{}, custom:{}, dota:{days:[], weeks:[]}, rewards:null, ranks:{claimed:{}}, mode:'loading', loaded:false, readonly:false, tab:'route', q:'', panel:null, rewardEdit:false, trackScrolled:false};
var VIEWER = true;
var PLAYER = 'Никита', SNAP_AT = null;
if (VIEWER) {
var PD = (window.PASS_DATA && typeof window.PASS_DATA === 'object') ? window.PASS_DATA : null;
if (!PD) { try { PD = JSON.parse(document.getElementById('pass-data').textContent) || {}; } catch (e) { PD = {}; } }
S.progress = PD.progress || {}; S.custom = PD.custom || {};
S.dota = {days:(PD.dota && PD.dota.days) || [], weeks:(PD.dota && PD.dota.weeks) || []};
S.rewards = PD.rewards || null; S.ranks = {claimed:(PD.ranks && PD.ranks.claimed) || {}};
PLAYER = PD.player || PLAYER; SNAP_AT = PD.updatedAt || null;
S.mode = 'viewer'; S.loaded = true; S.readonly = true;
document.documentElement.classList.add('viewer');
document.getElementById('eyebrow').textContent = 'Игрок: ' + PLAYER + ' · Сезон 1 · старт 28 сентября 2026';
document.getElementById('lede').textContent = 'Свой батлпас на прохождение сюжетных игр: ' + PLAYER + ' меняет катки в Доте на игры из своей библиотеки Steam. Ранг, челленджи, сундуки и награды — всё здесь. Смотреть можно, нажимать нечего.';
}
var db = null;
var chains = {};
var reduceMotion = false;
try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
try { var savedTab = localStorage.getItem('story-pass-tab'); if (savedTab && TABS.some(function(t){return t[0] === savedTab;})) S.tab = savedTab; } catch (e) {}
/* ---------- утилиты ---------- */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
function nowISO(){ return new Date().toISOString(); }
function num(n){ return new Intl.NumberFormat('ru-RU').format(n); }
function hrs(h){ return String(h).replace('.', ','); }
function plural(n, one, few, many){ var a = Math.abs(n) % 10, b = Math.abs(n) % 100; if (a === 1 && b !== 11) return one; if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few; return many; }
function dayKey(d){ d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function weekKey(d){ d = d ? new Date(d) : new Date(); var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd); var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); var wk = Math.ceil(((t - y0) / 864e5 + 1) / 7); return t.getUTCFullYear() + '-W' + String(wk).padStart(2, '0'); }
var DF = new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'short'});
function fmtDate(v){ try { return DF.format(new Date(v)).replace('.', ''); } catch (e) { return ''; } }
function daysSince(iso){ return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function hasDone(c, id){ return c.done.some(function(g){ return g.id === id; }); }
function allGames(){
var custom = Object.keys(S.custom).map(function(id){ var g = S.custom[id] || {}; return {id:id, n:g.name || 'Без названия', h:Math.max(1, Number(g.hours) || 1), c:[CATS[g.cat] ? g.cat : 'story'], coop:!!g.coop, custom:true}; });
return GAMES.concat(custom);
}
function gameById(id){ var l = allGames(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function prog(id){ return S.progress[id] || null; }
function status(id){ var p = prog(id); return p && p.status ? p.status : 'queue'; }
function slotOf(id){ var p = prog(id); return p && p.slot === 'coop' ? 'coop' : 'main'; }
function base(g){ return Math.round(g.h * PTS_PER_HOUR); }
function challengesOf(g){ return (g.ch || []).concat(UNIVERSAL); }
function sprintDays(g){ return Math.max(7, Math.ceil(g.h / 2)); }
function sprintDaysFor(g, p){ return sprintDays(g) + CLOCK_DAYS * (Number(p && p.clocks) || 0); }
function boostedBase(g, p){ return Math.round(base(g) * (p && p.boost ? BOOST_MULT : 1)); }
function claimedMap(){ return (S.ranks && S.ranks.claimed) || {}; }
function chestParts(c){ var out = []; if (c.token) out.push({k:'token', t:'+' + c.token + ' ' + plural(c.token, 'жетон дропа', 'жетона дропа', 'жетонов дропа')}); if (c.clock) out.push({k:'clock', t:'Часы спринта' + (c.clock > 1 ? ' ×' + c.clock : '')}); if (c.boost) out.push({k:'boost', t:'Бустер ×1,5' + (c.boost > 1 ? ' · ' + c.boost + ' шт.' : '')}); return out; }
function chestChips(c){ return '<span class="items">' + chestParts(c).map(function(x){ return '<span class="item i-' + x.k + '">' + esc(x.t) + '</span>'; }).join('') + '</span>'; }
function chestPlain(c){ return chestParts(c).map(function(x){ return x.t.charAt(0) === '+' ? x.t : x.t.charAt(0).toLowerCase() + x.t.slice(1); }).join(', '); }
function isShort(g){ return g.h <= 8; }
function noteOf(g){ if (g.rel) return Date.now() < new Date(g.rel).getTime() ? 'Ремастер 29 сент, 13:00' : 'Ремастер вышел'; return g.note || ''; }
function locked(){ return !S.loaded || S.readonly; }
function derive(){
var games = allGames(), done = [], dropped = [], playing = [], tokensSpent = 0;
Object.keys(S.progress).forEach(function(id){ tokensSpent += Number((S.progress[id] || {}).tokensSpent) || 0; });
games.forEach(function(g){ var st = status(g.id); if (st === 'done') done.push(g); else if (st === 'dropped') dropped.push(g); else if (st === 'playing' || st === 'ready') playing.push(g); });
var gamePts = done.reduce(function(s, g){ return s + (((prog(g.id) || {}).score || {}).total || 0); }, 0);
var dotaDays = (S.dota.days || []).length, dotaWeeks = (S.dota.weeks || []).length;
var ctx = {done:done, dropped:dropped, playing:playing, tokensSpent:tokensSpent, dotaDays:dotaDays, dotaWeeks:dotaWeeks};
var achs = ACH.map(function(a){ var ok = false; try { ok = !!a.test(ctx); } catch (e) {} return {id:a.id, n:a.n, d:a.d, ok:ok}; });
var achPts = achs.filter(function(a){ return a.ok; }).length * ACH_BONUS;
var dotaPts = dotaDays * DOTA_DAY + dotaWeeks * DOTA_WEEK;
ctx.gamePts = gamePts; ctx.dotaPts = dotaPts; ctx.achPts = achPts; ctx.achs = achs;
ctx.total = gamePts + dotaPts + achPts;
var granted = {token:0, clock:0, boost:0}, cl = claimedMap();
RANKS.forEach(function(r){ if (r.chest && cl[r.id]) Object.keys(r.chest).forEach(function(k){ granted[k] += r.chest[k]; }); });
var usedClock = 0, usedBoost = 0;
Object.keys(S.progress).forEach(function(id){ var pp = S.progress[id] || {}; usedClock += Number(pp.clocks) || 0; if (pp.boost) usedBoost++; });
ctx.inv = {clock:Math.max(0, granted.clock - usedClock), boost:Math.max(0, granted.boost - usedBoost), bonusTokens:granted.token};
ctx.tokens = Math.max(0, START_TOKENS + Math.floor(done.length / 2) + granted.token - tokensSpent);
ctx.readyChests = RANKS.filter(function(r){ return r.chest && ctx.total >= r.p && !cl[r.id]; });
ctx.hoursDone = done.reduce(function(s, g){ return s + g.h; }, 0);
ctx.main = null; ctx.coop = null;
playing.forEach(function(g){ if (slotOf(g.id) === 'coop') { if (!ctx.coop) ctx.coop = g; } else if (!ctx.main) ctx.main = g; });
return ctx;
}
function rankOf(pts){ var idx = 0; RANKS.forEach(function(r, i){ if (pts >= r.p) idx = i; }); return {r:RANKS[idx], i:idx, next:RANKS[idx + 1] || null}; }
function rewardItems(){ return (S.rewards && Array.isArray(S.rewards.items)) ? S.rewards.items : []; }
function tagsHTML(g){
var out = g.c.map(function(c){ return '<span class="tag">' + esc(CATS[c] || c) + '</span>'; });
if (isShort(g)) out.push('<span class="tag">Короткая</span>');
if (g.coop) out.push('<span class="tag coop">С другом</span>');
return out.join('');
}
/* ---------- отрисовка ---------- */
function renderAll(){
var d = derive();
renderStatus(); renderRank(d); renderStats(d); renderTrack(d); renderSlots(d); renderTabs(); renderGames(d); renderDota(d);
if (!S.rewardEdit) renderRewards(d);
renderAch(d); renderLog(); renderBanner(d); renderRanks(d);
$('addSubmit').disabled = locked();
$('rewEditBtn').disabled = locked();
}
function renderStatus(){
var el = $('status'), msg = '';
if (S.mode === 'viewer') {
var ev = eventsList()[0];
msg = 'Витрина только для просмотра' + (SNAP_AT ? ' · обновлено ' + fmtDateTime(SNAP_AT) : '') + (ev ? ' · последнее: ' + ev.txt.charAt(0).toLowerCase() + ev.txt.slice(1) + (ev.pts ? ' (+' + num(ev.pts) + ')' : '') : '');
}
else if (S.mode === 'loading') msg = 'Загружаю прогресс…';
else if (S.mode === 'local') msg = 'Облачное хранилище в этом просмотре недоступно, поэтому прогресс сохраняется только в этом браузере.';
else if (S.readonly) msg = 'Режим просмотра: у тебя нет прав менять этот пропуск.';
el.hidden = !msg; el.textContent = msg;
}
var lastRankIdx = null;
function renderRank(d){
var R = rankOf(d.total), pct = R.next ? Math.min(100, Math.round((d.total - R.r.p) / (R.next.p - R.r.p) * 100)) : 100;
var el = $('rank');
el.innerHTML =
'<div class="rank-top"><span class="eyebrow">' + (VIEWER ? 'Ранг' : 'Твой ранг') + '</span><span class="mono pts">' + num(d.total) + ' <small>очк.</small></span></div>' +
'<div class="rank-name">' + esc(R.r.n) + '</div>' +
'<div class="bar" role="progressbar" aria-label="Прогресс до следующего ранга" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
'<div class="muted small">' + (R.next ? 'До ранга «' + esc(R.next.n) + '» ещё ' + num(R.next.p - d.total) + ' очк.' : (VIEWER ? 'Максимальный ранг. Титан.' : 'Максимальный ранг. Ты Титан.')) + '</div>' +
(R.next && R.next.chest ? '<div class="small muted">В сундуке: </div>' + chestChips(R.next.chest) : '');
if (lastRankIdx !== null && R.i > lastRankIdx && !reduceMotion) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
if (S.loaded) lastRankIdx = R.i;
}
function renderStats(d){
var routeTotal = GAMES.filter(function(g){ return g.r; }).length;
var routeDone = GAMES.filter(function(g){ return g.r && status(g.id) === 'done'; }).length;
var pips = '';
var shown = Math.max(d.tokens, 3);
for (var i = 0; i < shown; i++) pips += '<span class="pip' + (i < d.tokens ? '' : ' off') + '"></span>';
var toNext = 2 - (d.done.length % 2);
$('stats').innerHTML =
stat(num(d.total), 'Очки', 'игры ' + num(d.gamePts) + ' · Дота ' + num(d.dotaPts) + ' · ачивки ' + num(d.achPts)) +
stat(String(d.done.length), 'Пройдено игр', '≈' + num(d.hoursDone) + ' ч сюжета') +
'<div class="stat"><div class="pips" aria-label="Жетонов дропа: ' + d.tokens + '">' + pips + '</div><div class="l">Жетоны дропа: ' + d.tokens + '</div><div class="l">новый через ' + toNext + ' ' + plural(toNext, 'пройденную игру', 'пройденные игры', 'пройденных игр') + '</div></div>' +
stat(routeDone + '/' + routeTotal, 'Маршрут', d.dropped.length ? 'дропнуто: ' + d.dropped.length : 'без дропов');
}
function stat(v, l, sub){ return '<div class="stat"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + '</div><div class="l">' + esc(sub) + '</div></div>'; }
function renderTrack(d){
var nodes = [{p:0, kind:'start', t:'Старт', s:'Сезон 1'}];
var clm = claimedMap();
RANKS.slice(1).forEach(function(r){ nodes.push({p:r.p, kind:'rank', t:r.n, s:'Ранг · сундук', rid:r.id, opened:!!clm[r.id]}); });
rewardItems().forEach(function(x){ nodes.push({p:Math.max(0, Number(x.pts) || 0), kind:'reward', t:x.text, s:x.claimedAt ? 'Получено' : 'Награда', claimed:!!x.claimedAt}); });
nodes.sort(function(a, b){ return a.p - b.p || (a.kind === 'rank' ? -1 : 1); });
var COL = 132, fi = 0;
for (var i = 0; i < nodes.length; i++) if (d.total >= nodes[i].p) fi = i;
var frac = 0;
if (fi < nodes.length - 1) { var a = nodes[fi].p, b = nodes[fi + 1].p; frac = b > a ? Math.min(1, (d.total - a) / (b - a)) : 0; }
var fillW = (fi + frac) * COL;
var inner = $('track');
inner.style.setProperty('--cols', nodes.length);
inner.style.setProperty('--fillw', fillW + 'px');
var nextMarked = false;
inner.innerHTML = '<div class="rail"><span></span></div>' + nodes.map(function(n){
var reached = d.total >= n.p, cls = ['node', 'k-' + n.kind];
if (reached) cls.push('reached');
if (!reached && !nextMarked) { cls.push('next'); nextMarked = true; }
if (n.claimed) cls.push('claimed');
var sub = n.s;
if (n.kind === 'reward' && reached && !n.claimed) { sub = VIEWER ? 'Открыта' : 'Можно забрать'; cls.push('ready'); }
if (n.kind === 'rank' && reached) { if (n.opened) { sub = 'Сундук открыт'; cls.push('claimed'); } else { sub = VIEWER ? 'Сундук ждёт' : 'Открой сундук'; cls.push('ready'); } }
return '<div class="' + cls.join(' ') + '"><span class="mark">' + (n.kind === 'reward' ? GIFT : '') + '</span><span class="n-pts mono">' + num(n.p) + '</span><span class="n-title">' + esc(n.t) + '</span><span class="n-sub">' + esc(sub) + '</span></div>';
}).join('');
if (S.loaded && !S.trackScrolled) {
S.trackScrolled = true;
var sc = $('trackScroll');
sc.scrollLeft = Math.max(0, fillW + 74 - sc.clientWidth / 2);
}
}
function renderSlots(d){
$('slots').innerHTML = slotHTML(d.main, 'main', d) + slotHTML(d.coop, 'coop', d);
}
function slotHTML(g, slot, d){
var ro = locked() ? ' disabled' : '';
if (!g) {
if (slot === 'main') {
var next = GAMES.filter(function(x){ return x.r && status(x.id) === 'queue'; }).sort(function(a, b){ return a.r - b.r; })[0];
return '<article class="slot empty"><div class="slot-label">Основной слот</div><p class="slot-empty-t">' + (VIEWER ? 'Свободен: ' + esc(PLAYER) + ' выбирает следующую игру.' : 'Свободен. Бери следующую игру по маршруту или доверься рулетке.') + '</p>' +
(next ? '<div class="next-line"><span>Дальше по маршруту: <strong>' + esc(next.n) + '</strong> <span class="mono muted">≈' + next.h + ' ч</span></span><button class="btn btn-primary btn-small" type="button" data-act="start" data-id="' + next.id + '" data-slot="main"' + ro + '>Начать играть</button></div>' : '') +
'<div class="acts"><button class="btn" type="button" data-act="spin-go"' + ro + '>Крутить рулетку</button></div></article>';
}
return '<article class="slot empty"><div class="slot-label">Кооп-слот</div><p class="slot-empty-t">Игра с другом идёт параллельно и не занимает основной слот.</p><div class="acts"><button class="btn" type="button" data-act="tab" data-tab="coop">Показать кооп-игры</button></div></article>';
}
var p = prog(g.id) || {}, ch = p.ch || {};
if (p.status === 'ready') return readyHTML(g, slot);
var started = p.startedAt || nowISO();
var day = daysSince(started) + 1;
var sd = sprintDaysFor(g, p);
var deadline = new Date(new Date(started).getTime() + sd * 864e5);
var left = Math.ceil((deadline.getTime() - Date.now()) / 864e5);
var sprintOk = left >= 0;
var sprintPct = Math.min(100, Math.round((day - 1) / sd * 100));
var list = challengesOf(g);
var chPts = list.filter(function(x){ return ch[x.id]; }).reduce(function(s, x){ return s + x.p; }, 0);
var bb = boostedBase(g, p);
var est = bb + chPts + (sprintOk ? SPRINT_BONUS : 0);
var own = (g.ch || []).map(chRow).join('');
var uni = UNIVERSAL.map(chRow).join('');
function chRow(x){
return '<label class="ch"><input type="checkbox" id="ch-' + g.id + '-' + x.id + '" data-act="ch" data-id="' + g.id + '" data-ch="' + x.id + '"' + (ch[x.id] ? ' checked' : '') + ro + '><span>' + esc(x.t) + '</span><span class="mono plus">+' + x.p + '</span></label>';
}
var sprintRow = '<div class="ch auto"><span class="auto-mark' + (sprintOk ? ' on' : '') + '" aria-hidden="true"></span><span>' + (sprintOk ? 'Спринт: финал до ' + fmtDate(deadline) + ' — осталось ' + left + ' ' + plural(left, 'день', 'дня', 'дней') : 'Спринт упущен. Очки за игру остаются') + '</span><span class="mono plus">' + (sprintOk ? '+' + SPRINT_BONUS : '0') + '</span></div>';
var panel = '';
if (S.panel && S.panel.id === g.id) panel = S.panel.kind === 'finish' ? finishPanel(g, p, chPts, sprintOk) : dropPanel(g, d, day);
var itemsRow = '<div class="items-row"><span class="items-label">Предметы</span>' +
'<button class="btn btn-small" type="button" data-act="use-clock" data-id="' + g.id + '"' + (locked() || d.inv.clock < 1 ? ' disabled' : '') + ' title="+' + CLOCK_DAYS + ' дней к спринту">Часы спринта +' + CLOCK_DAYS + ' дн. <span class="mono">×' + d.inv.clock + '</span></button>' +
(p.boost ? '<span class="pill good">Бустер ×1,5 активен</span>' : '<button class="btn btn-small" type="button" data-act="use-boost" data-id="' + g.id + '"' + (locked() || d.inv.boost < 1 ? ' disabled' : '') + ' title="База этой игры ×1,5">Бустер ×1,5 <span class="mono">×' + d.inv.boost + '</span></button>') +
(d.inv.clock < 1 && d.inv.boost < 1 && !p.boost ? '<span class="small muted">Предметы выпадают из сундуков рангов.</span>' : '') + '</div>';
return '<article class="slot" aria-label="' + esc(g.n) + '">' +
'<div class="slot-top"><span class="pill ' + (slot === 'coop' ? 'coop' : 'play') + '">' + (slot === 'coop' ? 'С другом' : 'Играю') + ' · день ' + day + '</span><span class="mono muted small">старт ' + fmtDate(started) + '</span></div>' +
'<h3 class="slot-title">' + esc(g.n) + '</h3>' +
'<div class="meta">' + tagsHTML(g) + '<span class="mono">≈' + g.h + ' ч</span><span class="mono">база ' + bb + ' очк.' + (p.boost ? ' (бустер)' : '') + '</span>' + (p.clocks ? '<span class="mono">спринт +' + (CLOCK_DAYS * p.clocks) + ' дн.</span>' : '') + '</div>' +
'<div class="sprint' + (sprintOk ? '' : ' late') + '"><div class="bar thin" aria-hidden="true"><span style="width:' + sprintPct + '%"></span></div></div>' +
'<fieldset class="chs"><legend>Челленджи этой игры</legend>' + own + uni + sprintRow + '</fieldset>' +
itemsRow +
'<div class="slot-foot"><span class="mono est">На кону: ' + num(est) + ' очк.</span><div class="acts">' +
'<button class="btn btn-primary" type="button" data-act="finish" data-id="' + g.id + '"' + ro + '>Пройдено</button>' +
'<button class="btn btn-danger" type="button" data-act="drop" data-id="' + g.id + '"' + ro + '>Дропнуть</button></div></div>' +
panel + '</article>';
}
function readyHTML(g, slot){
var ro = locked() ? ' disabled' : '';
var sd = sprintDays(g), list = challengesOf(g);
var maxPts = base(g) + list.reduce(function(s, x){ return s + x.p; }, 0) + SPRINT_BONUS;
var rows = list.map(function(x){ return '<div class="ch auto"><span class="auto-mark" aria-hidden="true"></span><span>' + esc(x.t) + '</span><span class="mono plus">+' + x.p + '</span></div>'; }).join('') +
'<div class="ch auto"><span class="auto-mark" aria-hidden="true"></span><span>Спринт: титры за ' + sd + ' ' + plural(sd, 'день', 'дня', 'дней') + ' после старта</span><span class="mono plus">+' + SPRINT_BONUS + '</span></div>';
return '<article class="slot" aria-label="' + esc(g.n) + '">' +
'<div class="slot-top"><span class="pill wait">' + (slot === 'coop' ? 'Кооп-слот · ' : '') + 'Не начата</span>' + (noteOf(g) ? '<span class="tag note">' + esc(noteOf(g)) + '</span>' : '') + '</div>' +
'<h3 class="slot-title">' + esc(g.n) + '</h3>' +
'<div class="meta">' + tagsHTML(g) + '<span class="mono">≈' + g.h + ' ч</span><span class="mono">база ' + base(g) + ' очк.</span></div>' +
'<div class="start-box"><p><b>Спринт: ' + sd + ' ' + plural(sd, 'день', 'дня', 'дней') + '.</b> ' + (VIEWER ? 'Отсчёт пойдёт, когда ' + esc(PLAYER) + ' сядет играть.' : 'Отсчёт пойдёт с момента, когда нажмёшь «Начать играть». Жми, когда реально садишься играть.') + '</p>' +
'<button class="btn btn-primary btn-big" type="button" data-act="begin" data-id="' + g.id + '"' + ro + '>Начать играть</button></div>' +
'<fieldset class="chs"><legend>Челленджи этой игры</legend>' + rows + '</fieldset>' +
'<div class="slot-foot"><span class="mono est">Можно заработать до ' + num(maxPts) + ' очк.</span><div class="acts">' +
'<button class="btn btn-ghost" type="button" data-act="unslot" data-id="' + g.id + '"' + ro + '>Убрать из слота</button></div></div>' +
'</article>';
}
function scoreFor(g, p, finishedAt){
var ch = p.ch || {};
var chall = challengesOf(g).filter(function(x){ return ch[x.id]; }).reduce(function(s, x){ return s + x.p; }, 0);
var sd = sprintDaysFor(g, p);
var within = p.startedAt ? (new Date(finishedAt).getTime() - new Date(p.startedAt).getTime()) <= sd * 864e5 : false;
var b = boostedBase(g, p), sprint = within ? SPRINT_BONUS : 0;
return {base:b, boost:b - base(g), chall:chall, sprint:sprint, total:b + chall + sprint};
}
function finishPanel(g, p, chPts, sprintOk){
var b = boostedBase(g, p), total = b + chPts + (sprintOk ? SPRINT_BONUS : 0);
return '<div class="confirm"><p><strong>Дошёл до титров?</strong> Отметь выполненные челленджи выше, потом засчитай.</p>' +
'<dl class="breakdown"><div><dt>База: ' + g.h + ' ч × ' + PTS_PER_HOUR + (p.boost ? ' × 1,5 (бустер)' : '') + '</dt><dd>' + b + '</dd></div><div><dt>Челленджи</dt><dd>+' + chPts + '</dd></div><div><dt>Спринт</dt><dd>' + (sprintOk ? '+' + SPRINT_BONUS : '0') + '</dd></div><div class="tot"><dt>Итого</dt><dd>' + num(total) + '</dd></div></dl>' +
'<div class="acts"><button class="btn btn-primary" type="button" data-act="finish-ok" data-id="' + g.id + '">Засчитать +' + num(total) + '</button><button class="btn btn-ghost" type="button" data-act="cancel">Отмена</button></div></div>';
}
function dropPanel(g, d, day){
var noTok = d.tokens < 1;
return '<div class="confirm danger"><p><strong>Как дропаем ' + esc(g.n) + '?</strong></p>' +
'<button class="opt" type="button" data-act="drop-trial" data-id="' + g.id + '"><strong>Пробный дроп</strong>Наиграл меньше 2 часов. Бесплатно, но очков не будет.</button>' +
'<button class="opt" type="button" data-act="drop-token" data-id="' + g.id + '"' + (noTok ? ' disabled' : '') + '><strong>Дроп за жетон</strong>' + (noTok ? 'Жетонов не осталось. Каждые 2 пройденные игры дают новый.' : 'Сгорит 1 жетон из ' + d.tokens + '.') + '</button>' +
'<div class="acts"><button class="btn btn-ghost" type="button" data-act="cancel">Передумал, играю дальше</button></div></div>';
}
function inTab(g, t){
switch (t) {
case 'route': return !!g.r;
case 'witcher': return !!g.wr;
case 'started': return !!g.s;
case 'horror': case 'action': case 'rpg': case 'hard': return g.c.indexOf(t) > -1;
case 'short': return isShort(g);
case 'coop': return !!g.coop;
case 'done': return status(g.id) === 'done';
case 'dropped': return status(g.id) === 'dropped';
default: return true;
}
}
var ST_ORDER = {playing:0, ready:0, queue:1, done:2, dropped:3};
function filtered(){
var q = S.q.trim().toLowerCase();
var l = allGames().filter(function(g){ return inTab(g, S.tab) && (!q || g.n.toLowerCase().indexOf(q) > -1); });
if (S.tab === 'route') l.sort(function(a, b){ return a.r - b.r; });
else if (S.tab === 'witcher') l.sort(function(a, b){ return a.wr - b.wr; });
else l.sort(function(a, b){ return (ST_ORDER[status(a.id)] - ST_ORDER[status(b.id)]) || a.n.localeCompare(b.n); });
return l;
}
function renderTabs(){
var all = allGames();
$('tabs').innerHTML = TABS.map(function(t){
var c = all.filter(function(g){ return inTab(g, t[0]); }).length;
return '<button class="tab" type="button" role="tab" id="tab-' + t[0] + '" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + esc(t[1]) + '<span class="c">' + c + '</span></button>';
}).join('');
}
function renderGames(d){
d = d || derive();
var list = filtered();
var ul = $('games');
ul.classList.toggle('no-idx', S.tab !== 'route' && S.tab !== 'witcher');
$('libCount').textContent = list.length + ' ' + plural(list.length, 'игра', 'игры', 'игр');
var ro = locked();
ul.innerHTML = list.length ? list.map(function(g){ return rowHTML(g, d, ro); }).join('') : '<li class="empty-row">' + (S.tab === 'done' ? 'Пока ничего не пройдено. Первая игра даст ачивку «Первая кровь».' : S.tab === 'dropped' ? 'Дропов нет. Так держать.' : 'Ничего не нашлось.') + '</li>';
}
function rowHTML(g, d, ro){
var st = status(g.id), p = prog(g.id) || {}, right = '';
if (st === 'queue') {
right = '<button class="btn btn-small" type="button" data-act="start" data-id="' + g.id + '" data-slot="main"' + (ro || d.main ? ' disabled' : '') + (d.main ? ' title="Основной слот занят"' : '') + '>Начать играть</button>';
if (g.coop) right += '<button class="btn btn-small btn-coop" type="button" data-act="start" data-id="' + g.id + '" data-slot="coop" data-mode="ready"' + (ro || d.coop ? ' disabled' : '') + '>В кооп-слот</button>';
if (g.custom) right += '<button class="btn btn-small btn-ghost" type="button" data-act="rm" data-id="' + g.id + '"' + (ro ? ' disabled' : '') + '>Убрать</button>';
} else if (st === 'ready') {
right = '<span class="pill wait">В слоте, не начата</span>';
} else if (st === 'playing') {
right = '<span class="pill ' + (slotOf(g.id) === 'coop' ? 'coop' : 'play') + '">' + (slotOf(g.id) === 'coop' ? 'С другом' : 'Играю') + '</span>';
} else if (st === 'done') {
right = '<span class="pill good">Пройдено +' + num((p.score || {}).total || 0) + '</span>';
} else if (st === 'dropped') {
right = '<span class="pill bad">' + (p.dropKind === 'trial' ? 'Пробный дроп' : 'Дроп') + '</span><button class="btn btn-small btn-ghost" type="button" data-act="restore" data-id="' + g.id + '"' + (ro ? ' disabled' : '') + '>Вернуть</button>';
}
var extra = (g.s ? '<span class="tag steam">в Steam ' + hrs(g.s) + ' ч</span>' : '') + (noteOf(g) ? '<span class="tag note">' + esc(noteOf(g)) + '</span>' : '') + (g.custom ? '<span class="tag">Своя</span>' : '');
return '<li class="game st-' + st + '"><span class="g-idx mono">' + (S.tab === 'witcher' ? (g.wr ? String(g.wr).padStart(2, '0') : '') : (g.r ? String(g.r).padStart(2, '0') : '')) + '</span>' +
'<div class="g-main"><span class="g-name">' + esc(g.n) + '</span><span class="g-tags">' + tagsHTML(g) + extra + '</span></div>' +
'<div class="g-nums mono"><span>≈' + g.h + ' ч</span><span class="g-pts">' + base(g) + '</span></div>' +
'<div class="g-act">' + right + '</div></li>';
}
function renderDota(d){
var today = dayKey(), wk = weekKey(), days = S.dota.days || [], weeks = S.dota.weeks || [];
var doneToday = days.indexOf(today) > -1, doneWeek = weeks.indexOf(wk) > -1, ro = locked() ? ' disabled' : '';
var strip = '';
for (var i = 13; i >= 0; i--) { var dt = new Date(); dt.setDate(dt.getDate() - i); var k = dayKey(dt); strip += '<span class="' + (days.indexOf(k) > -1 ? 'on' : '') + (i === 0 ? ' today' : '') + '" title="' + fmtDate(dt) + '"></span>'; }
$('dota').innerHTML =
'<div class="dota-row"><div><div class="d-t">Час сюжетки перед каткой</div><div class="small muted">Сначала час сюжетной игры, потом Дота. +' + DOTA_DAY + ' за день.</div></div><button class="btn btn-small' + (doneToday ? ' btn-on' : '') + '" type="button" data-act="dota-day" aria-pressed="' + doneToday + '"' + ro + '>' + (doneToday ? 'Сегодня ✓' : 'Отметить сегодня') + '</button></div>' +
'<div class="strip" aria-label="Последние 14 дней">' + strip + '</div>' +
'<div class="small muted mono">' + d.dotaDays + ' ' + plural(d.dotaDays, 'день', 'дня', 'дней') + ' · +' + num(d.dotaDays * DOTA_DAY) + ' очк.</div>' +
'<hr>' +
'<div class="dota-row"><div><div class="d-t">Неделя без Доты</div><div class="small muted">Ни одной катки с понедельника по воскресенье. Отмечай в конце недели. +' + DOTA_WEEK + '.</div></div><button class="btn btn-small' + (doneWeek ? ' btn-on' : '') + '" type="button" data-act="dota-week" aria-pressed="' + doneWeek + '"' + ro + '>' + (doneWeek ? 'Эта неделя ✓' : 'Отметить неделю') + '</button></div>' +
'<div class="small muted mono">' + d.dotaWeeks + ' ' + plural(d.dotaWeeks, 'неделя', 'недели', 'недель') + ' · +' + num(d.dotaWeeks * DOTA_WEEK) + ' очк.</div>';
}
function renderRewards(d){
var items = rewardItems().slice().sort(function(a, b){ return a.pts - b.pts; });
var ro = locked() ? ' disabled' : '';
if (!items.length) {
if (VIEWER) { $('rewards').innerHTML = '<p class="muted small">Наград пока нет.</p>'; return; }
$('rewards').innerHTML = '<p class="muted small">Наград пока нет. Придумай, чем порадовать себя за очки, или начни с примеров и поменяй их под себя.</p><div class="acts"><button class="btn btn-small" type="button" data-act="rew-examples"' + ro + '>Заполнить примерами</button></div>';
return;
}
$('rewards').innerHTML = '<ul class="rew">' + items.map(function(x){
var ok = d.total >= x.pts, st = x.claimedAt ? 'claimed' : ok ? 'ready' : 'locked', right;
if (x.claimedAt) right = '<span class="pill good">Получено ' + fmtDate(x.claimedAt) + '</span>';
else if (ok && VIEWER) right = '<span class="pill wait">Открыта</span>';
else if (ok) right = '<button class="btn btn-small btn-primary" type="button" data-act="claim" data-id="' + esc(x.id) + '"' + ro + '>Забрать</button>';
else right = '<span class="mono muted small">ещё ' + num(x.pts - d.total) + '</span>';
return '<li class="rw ' + st + '"><span class="mono rw-pts">' + num(x.pts) + '</span><span class="rw-t">' + esc(x.text) + '</span><span>' + right + '</span></li>';
}).join('') + '</ul>';
}
function rewardRowHTML(x){
var id = esc(x.id);
return '<div class="re-row" data-rid="' + id + '" data-claimed="' + esc(x.claimedAt || '') + '"><input type="number" class="re-pts" id="re-pts-' + id + '" value="' + (Number(x.pts) || 0) + '" min="0" step="10" aria-label="Очки"><input class="re-text" id="re-text-' + id + '" value="' + esc(x.text || '') + '" maxlength="80" aria-label="Награда"><button class="btn btn-small btn-ghost" type="button" data-act="rew-del" aria-label="Удалить награду">✕</button></div>';
}
function openRewardEdit(){
S.rewardEdit = true;
var items = rewardItems().slice().sort(function(a, b){ return a.pts - b.pts; });
$('rewards').innerHTML = '<form class="rew-edit" id="rewForm"><div id="rewRows" class="rew-edit">' + items.map(rewardRowHTML).join('') + '</div>' +
'<div class="acts"><button class="btn btn-small" type="button" data-act="rew-add">Добавить награду</button></div>' +
'<div class="acts"><button class="btn btn-small btn-primary" type="submit">Сохранить</button><button class="btn btn-small btn-ghost" type="button" data-act="rew-cancel">Отмена</button></div></form>';
$('rewEditBtn').hidden = true;
}
function closeRewardEdit(){ S.rewardEdit = false; $('rewEditBtn').hidden = false; renderRewards(derive()); }
function renderAch(d){
$('ach').innerHTML = d.achs.map(function(a){
return '<div class="a' + (a.ok ? ' ok' : '') + '"><div class="an"><span>' + esc(a.n) + '</span><span class="mono">' + (a.ok ? '✓ +' + ACH_BONUS : '+' + ACH_BONUS) + '</span></div><div class="ad">' + esc(a.d) + '</div></div>';
}).join('');
}
var DFT = new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'});
function fmtDateTime(v){ try { return DFT.format(new Date(v)); } catch (e) { return ''; } }
function eventsList(){
var ev = [];
Object.keys(S.progress).forEach(function(id){
var p = S.progress[id] || {}, g = gameById(id); if (!g) return;
if (p.startedAt) ev.push({t:p.startedAt, txt:'Начал ' + g.n});
if (p.status === 'done' && p.finishedAt) ev.push({t:p.finishedAt, txt:'Прошёл ' + g.n, pts:(p.score || {}).total});
if (p.droppedAt) ev.push({t:p.droppedAt, txt:(p.dropKind === 'trial' ? 'Пробный дроп: ' : 'Дроп за жетон: ') + g.n, bad:true});
});
rewardItems().forEach(function(x){ if (x.claimedAt) ev.push({t:x.claimedAt, txt:'Забрал награду: ' + x.text}); });
var cm = claimedMap(); RANKS.forEach(function(r){ if (cm[r.id]) ev.push({t:cm[r.id], txt:'Открыл сундук ранга «' + r.n + '»'}); });
ev.sort(function(a, b){ return String(b.t).localeCompare(String(a.t)); });
return ev;
}
function renderLog(){
var ev = eventsList();
$('log').innerHTML = ev.length ? ev.slice(0, 12).map(function(e){
return '<li><span class="lt mono">' + fmtDate(e.t) + '</span><span class="' + (e.bad ? 'bad' : '') + '">' + esc(e.txt) + '</span><span class="lp mono">' + (e.pts ? '+' + num(e.pts) : '') + '</span></li>';
}).join('') : '<li class="muted">Здесь появятся старты, финалы и дропы.</li>';
}
var toastTimer = null;
function toast(msg){
var el = $('toast'); el.textContent = msg; el.hidden = false;
clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.hidden = true; }, 3800);
}
/* ---------- сохранение ---------- */
function saveLocal(){
try { localStorage.setItem('story-pass-v1', JSON.stringify({progress:S.progress, custom:S.custom, dota:S.dota, rewards:S.rewards, ranks:S.ranks})); } catch (e) {}
}
function loadLocal(){
try {
var raw = localStorage.getItem('story-pass-v1'); if (!raw) return;
var o = JSON.parse(raw) || {};
S.progress = o.progress || {}; S.custom = o.custom || {}; S.dota = o.dota || {days:[], weeks:[]}; S.rewards = o.rewards || null; S.ranks = o.ranks || {claimed:{}};
} catch (e) {}
}
function onWriteError(e){
var code = e && e.code;
if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') { S.readonly = true; renderAll(); toast('Не получилось сохранить: изменения здесь недоступны.'); }
else if (code === 'quota_exceeded') toast('Хранилище переполнено, изменение не сохранилось.');
else toast('Изменение не сохранилось. Попробуй ещё раз чуть позже.');
}
function persist(path, data){
if (S.mode !== 'db' || !db) { saveLocal(); return Promise.resolve(); }
var run = function(){
var ref = db.doc(path);
var op = function(){ return data === null ? ref.delete() : ref.set(data); };
return op().catch(function(e){
if (e && e.code === 'unavailable') return sleep(400 + Math.random() * 600).then(op).catch(onWriteError);
onWriteError(e);
});
};
var prev = chains[path] || Promise.resolve();
var next = prev.then(run, run);
chains[path] = next;
return next;
}
function setProgress(id, data){ S.progress[id] = data; renderAll(); return persist('progress/' + id, data); }
/* ---------- действия ---------- */
function startGame(id, slot, onlySlot){
if (locked()) return;
var g = gameById(id); if (!g) return;
var d = derive();
if (slot === 'coop' ? d.coop : d.main) { toast(slot === 'coop' ? 'Кооп-слот уже занят.' : 'Основной слот занят. Сначала пройди или дропни текущую игру.'); return; }
var p = clone(prog(id)) || {};
delete p.droppedAt; delete p.dropKind; delete p.finishedAt; delete p.score; delete p.startedAt;
p.slot = slot === 'coop' ? 'coop' : 'main'; p.ch = p.ch || {};
if (onlySlot) { p.status = 'ready'; }
else { p.status = 'playing'; p.startedAt = nowISO(); }
S.panel = null;
$('roulette').hidden = true; clearInterval(spinTimer);
setProgress(id, p);
var sd = sprintDays(g);
toast(onlySlot ? g.n + ' в слоте. Спринт на ' + sd + ' ' + plural(sd, 'день', 'дня', 'дней') + ' начнётся, когда нажмёшь «Начать играть».' : 'Поехали: ' + g.n + '. Спринт — ' + sd + ' ' + plural(sd, 'день', 'дня', 'дней') + ' с этой минуты.');
var slots = $('slots');
if (slots.scrollIntoView) slots.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block:'start'});
}
function beginGame(id){
if (locked()) return;
var g = gameById(id); if (!g || status(id) !== 'ready') return;
var p = clone(prog(id)) || {};
p.status = 'playing'; p.startedAt = nowISO(); p.ch = p.ch || {};
setProgress(id, p);
var sd = sprintDays(g);
toast('Поехали: ' + g.n + '. Спринт пошёл: ' + sd + ' ' + plural(sd, 'день', 'дня', 'дней') + ' до титров за +' + SPRINT_BONUS + '.');
}
function unslotGame(id){
if (locked()) return;
var g = gameById(id); if (!g || status(id) !== 'ready') return;
var p = clone(prog(id)) || {};
p.status = 'queue'; delete p.slot;
setProgress(id, p);
toast(g.n + ' вернулась в очередь. Жетон не тратится: игра ещё не начата.');
}
function toggleCh(id, chId, on){
if (locked()) return;
var p = clone(prog(id)) || {}; p.ch = p.ch || {};
if (on) p.ch[chId] = true; else delete p.ch[chId];
setProgress(id, p);
}
function finishGame(id){
if (locked()) return;
var g = gameById(id); if (!g) return;
var before = derive(), rankBefore = rankOf(before.total).i;
var p = clone(prog(id)) || {};
var at = nowISO();
p.status = 'done'; p.finishedAt = at; p.score = scoreFor(g, p, at);
S.panel = null;
setProgress(id, p);
var after = derive(), R = rankOf(after.total);
var gained = after.total - before.total;
var readyNew = rewardItems().filter(function(x){ return !x.claimedAt && after.total >= x.pts && before.total < x.pts; });
var msg = g.n + ' пройдена: +' + num(gained) + ' очк.';
if (R.i > rankBefore) msg += ' Новый ранг: ' + R.r.n + ' — открой сундук!';
if (readyNew.length) msg += ' Можно забрать награду: ' + readyNew[0].text + '.';
toast(msg);
}
function dropGame(id, kind){
if (locked()) return;
var g = gameById(id); if (!g) return;
var d = derive();
var p = clone(prog(id)) || {};
if (kind === 'token') { if (d.tokens < 1) { toast('Жетонов нет. Придётся пройти.'); return; } p.tokensSpent = (Number(p.tokensSpent) || 0) + 1; }
p.status = 'dropped'; p.droppedAt = nowISO(); p.dropKind = kind === 'token' ? 'token' : 'trial';
S.panel = null;
setProgress(id, p);
toast(kind === 'token' ? 'Дроп за жетон: ' + g.n + '. Жетонов осталось: ' + derive().tokens + '.' : 'Пробный дроп: ' + g.n + '. Жетоны целы.');
}
function restoreGame(id){
if (locked()) return;
var p = clone(prog(id)) || {};
p.status = 'queue'; delete p.slot;
setProgress(id, p);
toast('Игра вернулась в очередь. Потраченный жетон не возвращается.');
}
function toggleDotaDay(){
if (locked()) return;
var k = dayKey(), days = (S.dota.days || []).slice(), i = days.indexOf(k);
if (i > -1) days.splice(i, 1); else days.push(k);
S.dota = {days:days, weeks:(S.dota.weeks || []).slice()};
renderAll(); persist('meta/dota', clone(S.dota));
}
function toggleDotaWeek(){
if (locked()) return;
var k = weekKey(), weeks = (S.dota.weeks || []).slice(), i = weeks.indexOf(k);
if (i > -1) weeks.splice(i, 1); else weeks.push(k);
S.dota = {days:(S.dota.days || []).slice(), weeks:weeks};
renderAll(); persist('meta/dota', clone(S.dota));
if (i < 0) toast('Неделя без Доты засчитана: +' + DOTA_WEEK + '.');
}
function setRewards(items){ S.rewards = {items:items}; renderAll(); return persist('meta/rewards', clone(S.rewards)); }
function claimReward(rid){
if (locked()) return;
var items = clone(rewardItems()), x = null;
items.forEach(function(it){ if (it.id === rid) x = it; });
if (!x) return;
if (derive().total < x.pts) return;
x.claimedAt = nowISO();
setRewards(items);
toast('Награда твоя: ' + x.text + '. Заслужил.');
}
function openChest(rid){
if (locked()) return;
var r = RANKS.filter(function(x){ return x.id === rid; })[0];
if (!r || !r.chest) return;
if (derive().total < r.p || claimedMap()[rid]) return;
var c = clone(S.ranks) || {claimed:{}}; c.claimed = c.claimed || {};
c.claimed[rid] = nowISO();
S.ranks = c; renderAll(); persist('meta/ranks', clone(c));
toast('Сундук ранга «' + r.n + '» открыт: ' + chestPlain(r.chest) + '.');
}
function useClock(id){
if (locked()) return;
var g = gameById(id), p = clone(prog(id)) || {};
if (!g || p.status !== 'playing') return;
if (derive().inv.clock < 1) { toast('Часов спринта нет. Они выпадают из сундуков рангов.'); return; }
p.clocks = (Number(p.clocks) || 0) + 1;
setProgress(id, p);
toast('Часы спринта: +' + CLOCK_DAYS + ' дней к сроку ' + g.n + '.');
}
function useBoost(id){
if (locked()) return;
var g = gameById(id), p = clone(prog(id)) || {};
if (!g || p.status !== 'playing' || p.boost) return;
if (derive().inv.boost < 1) { toast('Бустеров нет. Они выпадают из сундуков рангов.'); return; }
p.boost = true;
setProgress(id, p);
toast('Бустер активен: база ' + g.n + ' теперь ' + boostedBase(g, p) + ' очк. вместо ' + base(g) + '.');
}
function renderBanner(d){
var el = $('chestBanner'), list = d.readyChests || [];
if (!list.length || !S.loaded) { el.hidden = true; el.innerHTML = ''; return; }
var r = list[0], more = list.length - 1;
el.hidden = false;
el.innerHTML = '<div class="cb-t">' + CHEST_SVG + '<div class="cb-body"><div class="cb-title">Ранг «' + esc(r.n) + '»: сундук ждёт</div>' + chestChips(r.chest) +
(more > 0 ? '<span class="small muted">И ещё ' + more + ' ' + plural(more, 'сундук', 'сундука', 'сундуков') + ' после этого.</span>' : '') + '</div></div>' +
'<button class="btn btn-primary" type="button" data-act="open-chest" data-id="' + r.id + '"' + (S.readonly ? ' disabled' : '') + '>Открыть сундук</button>';
}
function renderRanks(d){
var cm = claimedMap(), cur = rankOf(d.total).i, ro = locked() ? ' disabled' : '';
$('inv').innerHTML = '<span>В инвентаре:</span><span class="item i-clock">Часы спринта ×' + d.inv.clock + '</span><span class="item i-boost">Бустер ×1,5 · ' + d.inv.boost + ' шт.</span>' + (d.inv.bonusTokens ? '<span class="item i-token">Жетонов из сундуков: ' + d.inv.bonusTokens + '</span>' : '');
$('ranks').innerHTML = RANKS.slice(1).map(function(r){
var i = RANKS.indexOf(r), reached = d.total >= r.p, right, cls = [];
if (cm[r.id]) { right = '<span class="pill good">Открыт ' + fmtDate(cm[r.id]) + '</span>'; }
else if (reached && VIEWER) { right = '<span class="pill wait">Ждёт открытия</span>'; }
else if (reached) { right = '<button class="btn btn-small btn-primary" type="button" data-act="open-chest" data-id="' + r.id + '"' + ro + '>Открыть</button>'; }
else { right = '<span class="mono muted small">ещё ' + num(r.p - d.total) + '</span>'; cls.push('locked'); }
if (i === cur) cls.push('cur');
return '<li class="' + cls.join(' ') + '"><span class="rk-n">' + esc(r.n) + '<span class="mono">' + num(r.p) + '</span></span>' + right + chestChips(r.chest) + '</li>';
}).join('');
}
function newId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/* ---------- рулетка ---------- */
var spinTimer = null;
function spin(){
var box = $('roulette');
var tab = (S.tab === 'done' || S.tab === 'dropped') ? 'all' : S.tab;
var pool = allGames().filter(function(g){ return inTab(g, tab) && status(g.id) === 'queue'; });
box.hidden = false;
clearInterval(spinTimer);
if (!pool.length) { box.innerHTML = '<p>В этой подборке крутить нечего: всё уже начато, пройдено или дропнуто.</p><div class="acts"><button class="btn btn-ghost btn-small" type="button" data-act="spin-close">Закрыть</button></div>'; return; }
var pick = pool[Math.floor(Math.random() * pool.length)];
if (reduceMotion || pool.length === 1) { showPick(pick, tab); return; }
var n = 0;
spinTimer = setInterval(function(){
var g = pool[Math.floor(Math.random() * pool.length)];
box.innerHTML = '<span class="eyebrow">Крутится…</span><div class="spin-name">' + esc(g.n) + '</div>';
if (++n > 14) { clearInterval(spinTimer); showPick(pick, tab); }
}, 70);
}
function showPick(g, tab){
var d = derive(), ro = locked();
var tabName = (TABS.filter(function(t){ return t[0] === tab; })[0] || ['', 'Все'])[1];
$('roulette').innerHTML = '<span class="eyebrow">Рулетка · подборка «' + esc(tabName) + '»</span><div class="spin-name">' + esc(g.n) + '</div>' +
'<div class="meta">' + tagsHTML(g) + '<span class="mono">≈' + g.h + ' ч · ' + base(g) + ' очк.</span></div>' +
'<div class="acts"><button class="btn btn-primary" type="button" data-act="start" data-id="' + g.id + '" data-slot="main" data-mode="ready"' + (ro || d.main ? ' disabled' : '') + '>Взять в слот</button><button class="btn" type="button" data-act="spin">Крутить ещё</button><button class="btn btn-ghost" type="button" data-act="spin-close">Закрыть</button></div>' +
(d.main ? '<p class="small muted">Основной слот занят. Сначала пройди или дропни ' + esc(d.main.n) + '.</p>' : '');
}
/* ---------- события ---------- */
document.addEventListener('click', function(e){
var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
switch (act) {
case 'ch': return;
case 'start': startGame(id, b.getAttribute('data-slot'), b.getAttribute('data-mode') === 'ready'); break;
case 'begin': beginGame(id); break;
case 'unslot': unslotGame(id); break;
case 'finish': S.panel = {id:id, kind:'finish'}; renderSlots(derive()); break;
case 'drop': S.panel = {id:id, kind:'drop'}; renderSlots(derive()); break;
case 'cancel': S.panel = null; renderSlots(derive()); break;
case 'finish-ok': finishGame(id); break;
case 'drop-trial': dropGame(id, 'trial'); break;
case 'drop-token': dropGame(id, 'token'); break;
case 'restore': restoreGame(id); break;
case 'rm':
if (locked()) return;
delete S.custom[id]; renderAll(); persist('custom/' + id, null); toast('Игра убрана из списка.'); break;
case 'tab':
S.tab = b.getAttribute('data-tab');
try { localStorage.setItem('story-pass-tab', S.tab); } catch (err) {}
$('roulette').hidden = true; clearInterval(spinTimer);
renderTabs(); renderGames();
if (b.closest('#slots')) { var lib = $('lib'); if (lib.scrollIntoView) lib.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block:'start'}); }
break;
case 'spin': spin(); break;
case 'spin-go': { var lb = $('lib'); if (lb.scrollIntoView) lb.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block:'start'}); spin(); break; }
case 'spin-close': clearInterval(spinTimer); $('roulette').hidden = true; break;
case 'dota-day': toggleDotaDay(); break;
case 'dota-week': toggleDotaWeek(); break;
case 'claim': claimReward(id); break;
case 'open-chest': openChest(id); break;
case 'use-clock': useClock(id); break;
case 'use-boost': useBoost(id); break;
case 'rew-examples': if (!locked()) { setRewards(clone(EXAMPLE_REWARDS)); toast('Примеры наград добавлены. Нажми «Изменить», чтобы переписать под себя.'); } break;
case 'rew-edit': if (!locked()) openRewardEdit(); break;
case 'rew-cancel': closeRewardEdit(); break;
case 'rew-add': {
var wrap = document.createElement('div');
wrap.innerHTML = rewardRowHTML({id:newId('r'), pts:Math.max(100, Math.ceil((derive().total + 300) / 50) * 50), text:''});
var row = wrap.firstChild; $('rewRows').appendChild(row); row.querySelector('.re-text').focus(); break;
}
case 'rew-del': { var r = b.closest('.re-row'); if (r) r.remove(); break; }
}
});
document.addEventListener('change', function(e){
var t = e.target;
if (t.matches && t.matches('input[data-act="ch"]')) toggleCh(t.getAttribute('data-id'), t.getAttribute('data-ch'), t.checked);
});
document.addEventListener('submit', function(e){
if (e.target.id === 'rewForm') {
e.preventDefault();
var items = [];
e.target.querySelectorAll('.re-row').forEach(function(r){
var text = r.querySelector('.re-text').value.trim(); if (!text) return;
var it = {id:r.getAttribute('data-rid'), pts:Math.max(0, Math.round(Number(r.querySelector('.re-pts').value) || 0)), text:text.slice(0, 80)};
var c = r.getAttribute('data-claimed'); if (c) it.claimedAt = c;
items.push(it);
});
S.rewardEdit = false; $('rewEditBtn').hidden = false;
setRewards(items); toast('Награды сохранены.');
}
if (e.target.id === 'addForm') {
e.preventDefault();
if (locked()) return;
var name = $('addName').value.trim(), hours = Math.round(Number($('addHours').value) || 0);
if (!name || hours < 1) { toast('Укажи название и примерную длину сюжета в часах.'); return; }
var id = newId('c');
var data = {name:name.slice(0, 80), hours:Math.min(200, hours), cat:$('addCat').value, coop:$('addCoop').checked, addedAt:nowISO()};
S.custom[id] = data;
e.target.reset();
S.tab = 'all'; renderAll(); persist('custom/' + id, data);
toast('Добавлено: ' + data.name + '.');
}
});
$('q').addEventListener('input', function(e){ S.q = e.target.value; renderGames(); });
/* ---------- запуск ---------- */
renderAll();
function subscribe(){
var got = {progress:false, custom:false, dota:false, rewards:false, ranks:false};
function ready(k){ got[k] = true; if (!S.loaded && got.progress && got.custom && got.dota && got.rewards && got.ranks) { S.loaded = true; S.mode = 'db'; } renderAll(); }
function fail(e){ if (e && (e.code === 'revoked' || e.code === 'not_granted')) { S.readonly = true; } renderAll(); }
db.collection('progress').onSnapshot(function(snap){
var m = {}; snap.docs.forEach(function(doc){ if (doc.exists) m[doc.id] = clone(doc.data()); });
S.progress = m; ready('progress');
}, fail);
db.collection('custom').onSnapshot(function(snap){
var m = {}; snap.docs.forEach(function(doc){ if (doc.exists) m[doc.id] = clone(doc.data()); });
S.custom = m; ready('custom');
}, fail);
db.doc('meta/dota').onSnapshot(function(doc){
var v = doc.exists ? clone(doc.data()) : null;
S.dota = {days:(v && Array.isArray(v.days)) ? v.days : [], weeks:(v && Array.isArray(v.weeks)) ? v.weeks : []};
ready('dota');
}, fail);
db.doc('meta/rewards').onSnapshot(function(doc){
S.rewards = doc.exists ? clone(doc.data()) : null;
if (!S.rewardEdit) ready('rewards'); else got.rewards = true;
}, fail);
db.doc('meta/ranks').onSnapshot(function(doc){
var v = doc.exists ? clone(doc.data()) : null;
S.ranks = {claimed:(v && v.claimed && typeof v.claimed === 'object') ? v.claimed : {}};
ready('ranks');
}, fail);
}
(function boot(){
if (VIEWER) return;
var c = window.claude;
if (!c || typeof c.use !== 'function') { loadLocal(); S.mode = 'local'; S.loaded = true; renderAll(); return; }
c.use('db').then(function(ns){
if (!ns) { loadLocal(); S.mode = 'local'; S.loaded = true; renderAll(); return; }
db = ns; S.mode = 'loading'; S.loaded = false;
try { subscribe(); } catch (e) { loadLocal(); S.mode = 'local'; S.loaded = true; renderAll(); }
}, function(){ loadLocal(); S.mode = 'local'; S.loaded = true; renderAll(); });
})();
})();
