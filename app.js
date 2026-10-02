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
/* ---------- Ведьмачий журнал: каталог ---------- */
var W3_CAP = 150, W3_BOARD_BONUS = 5, W3_CHEST_AT = 0.75;
var W3_ACTS = [null, 'Белый Сад и Велен', 'Новиград и Скеллиге', 'Финал', 'Каменные сердца', 'Кровь и вино'];
var W3_COLS = [
{id:'hunt', n:'Заказы', chest:{clock:1}},
{id:'forge', n:'Кузница', chest:{boost:1}},
{id:'alch', n:'Алхимия', chest:{token:1}},
{id:'gwent', n:'Гвинт', chest:{boost:1}},
{id:'story', n:'Истории', chest:{clock:1}},
{id:'skill', n:'Прокачка', chest:{token:1}},
{id:'explore', n:'Исследование', chest:{clock:1}},
{id:'photo', n:'Альбом и образ', chest:{token:1}},
{id:'replay', n:'Второй раз', chest:{boost:1}},
{id:'char', n:'Характер'},
{id:'secret', n:'Секреты'}
];
var W3_PATHS = {
hunter:{n:'Охотник', d:'заказы и алхимия ×1,5', cols:['hunt','alch']},
gambler:{n:'Картёжник', d:'гвинт и истории ×1,5', cols:['gwent','story']},
master:{n:'Мастер', d:'кузница и прокачка ×1,5', cols:['forge','skill']}
};
var W3_CHARS = {
book:{n:'Книжный Геральт', d:'Сдержанный, ироничный, держит нейтралитет'},
kind:{n:'Добряк', d:'Помогает всем и берёт мало'},
merc:{n:'Наёмник', d:'Ведьмак — это работа, а работа стоит денег'}
};
var W3_RAR = {common:'Обычный', rare:'Редкий', epic:'Эпический', legend:'Легендарный'};
/* c — коллекция, p — очки, n — сколько раз можно, a — с какого акта открыто, k — характер, h — подсказка секрета */
var W3T = [
{id:'h_prep', c:'hunt', t:'Подготовка к заказу: прочитал о чудовище, взял масло, выпил зелье, бил знаком или бомбой по слабости', p:10, n:10},
{id:'h_noon', c:'hunt', t:'Полуденница у колодца: дождаться полудня медитацией и выманить её', p:15},
{id:'h_night', c:'hunt', t:'Ночная работа: промотать медитацией до ночи и прийти к призраку вовремя', p:15},
{id:'h_cycle', c:'hunt', t:'Полный цикл охотника: прочитал → убил по заказу → забрал трофей → сварил отвар из его мутагена', p:30, n:3},
{id:'h_guess', c:'hunt', t:'Что за тварь? Назвать вид чудовища по рассказу заказчика до встречи с ним', p:10, n:5},
{id:'h_trophy', c:'hunt', t:'Трофейная стенка: собрать 5 разных трофеев заказов, один повесить на Плотву', p:20},
{id:'h_nest', c:'hunt', t:'Гнездовед: уничтожить гнездо чудовищ бомбой', p:5, n:5},
{id:'h_velen3', c:'hunt', t:'3 заказа с досок Велена', p:10},
{id:'h_velen6', c:'hunt', t:'6 заказов в Велене', p:10},
{id:'h_novi3', c:'hunt', t:'3 заказа в Новиграде и окрестностях', p:10, a:2},
{id:'h_skel3', c:'hunt', t:'3 заказа на Скеллиге', p:10, a:2},
{id:'f_school', c:'forge', t:'Выбрать школу снаряжения: Кот, Грифон или Медведь', p:5},
{id:'f_set', c:'forge', t:'Надеть полный сет одной школы: доспех, перчатки, штаны, сапоги и оба меча', p:40},
{id:'f_own', c:'forge', t:'Своё железо: к концу акта всё надетое скрафчено или найдено тобой', p:25},
{id:'f_runes', c:'forge', t:'Руна в каждом гнезде основного меча', p:10},
{id:'f_schem', c:'forge', t:'Школа в деле: нашёл схему и в ту же неделю скрафтил и надел', p:10, n:3},
{id:'f_roach', c:'forge', t:'Снаряжение для Плотвы: седло, седельные сумки и шоры', p:15},
{id:'f_relic', c:'forge', t:'Первая реликвия: найти оранжевый предмет и прочитать его историю', p:5},
{id:'f_upset', c:'forge', t:'Скрафтить улучшенную версию своего сета', p:30, a:2},
{id:'f_master', c:'forge', t:'Выковать меч у мастера-кузнеца', p:20, a:2},
{id:'f_relic5', c:'forge', t:'Оружейная: собрать 5 реликвий', p:20, a:2},
{id:'f_second', c:'forge', t:'Второй сет: полный сет другой школы и 3 сессии в нём', p:30, a:2},
{id:'f_manti', c:'forge', t:'Скрафтить предмет школы Мантикоры', p:20, a:5},
{id:'a_kit', c:'alch', t:'Базовая аптечка: Ласточка, Гром, Кошка и Пурга', p:10},
{id:'a_spirit', c:'alch', t:'Спирт в кармане: держать крепкий алкоголь, чтобы медитация пополняла зелья', p:5},
{id:'a_oils', c:'alch', t:'5 разных масел под разные типы чудовищ', p:15},
{id:'a_decoc', c:'alch', t:'Первый отвар из мутагена чудовища перед трудным боем', p:15},
{id:'a_bomb', c:'alch', t:'Бомба по слабости: убить чудовище бомбой, к которой оно уязвимо', p:10, n:3},
{id:'a_supply', c:'alch', t:'Снабженец: сварил масло под заказ и в тот же вечер закрыл заказ', p:15, n:3},
{id:'a_honey', c:'alch', t:'Белый мёд после «коктейля» из зелий', p:10},
{id:'a_enh', c:'alch', t:'Улучшенные версии трёх зелий', p:20, a:2},
{id:'g_first', c:'gwent', t:'Первая партия в гвинт с трактирщиком Белого Сада', p:5},
{id:'g_five', c:'gwent', t:'Обыграть 5 разных соперников в Велене', p:20},
{id:'g_buy', c:'gwent', t:'Купить карты у 3 разных торговцев или трактирщиков', p:10},
{id:'g_spies', c:'gwent', t:'Шпионская сеть: выиграть, сыграв 2 карты-шпиона', p:5},
{id:'g_pass', c:'gwent', t:'Отдал первый раунд и выиграл матч 2:1', p:10},
{id:'g_weather', c:'gwent', t:'Погодный маг: погодная карта решила раунд в твою пользу', p:5},
{id:'g_clean', c:'gwent', t:'Всухую 2:0 у сильного соперника', p:10},
{id:'g_unique', c:'gwent', t:'Выиграть 5 уникальных карт', p:20},
{id:'g_leader', c:'gwent', t:'5 побед подряд с одной картой лидера', p:10},
{id:'g_four', c:'gwent', t:'Победы всеми четырьмя фракциями: Север, Нильфгаард, Скоя’таэли, Чудовища', p:20},
{id:'g_oldpals', c:'gwent', t:'Обыграть старых друзей Геральта', p:20, a:2},
{id:'g_skel', c:'gwent', t:'Выиграть турнир по гвинту на Скеллиге', p:30, a:2},
{id:'g_skdeck', c:'gwent', t:'Победа колодой Скеллиге', p:10, a:5},
{id:'g_tous', c:'gwent', t:'Выиграть турнир по гвинту в Туссенте', p:20, a:5},
{id:'s_baron', c:'story', t:'Линия Кровавого Барона целиком, ничего не читая о последствиях', p:30},
{id:'s_keira', c:'story', t:'Квест Кейры Мец на острове Фьяк', p:15},
{id:'s_whodunit', c:'story', t:'Кто это сделал? Записать догадку до развязки расследования — и угадать', p:10, n:5},
{id:'s_fists', c:'story', t:'Выиграть все кулачные бои в Велене', p:15},
{id:'s_races', c:'story', t:'Выиграть 3 скачки на Плотве', p:15},
{id:'s_honest', c:'story', t:'Честный выбор: все важные решения акта с первого раза, без перезагрузок', p:30, n:3},
{id:'s_city', c:'story', t:'Горожанин: обойти пешком все районы Новиграда и в каждом взять квест или объявление', p:20, a:2},
{id:'s_oxen', c:'story', t:'Академия: побочный квест в Оксенфурте', p:10, a:2},
{id:'s_isles', c:'story', t:'Побывать на всех шести больших островах Скеллиге', p:25, a:2},
{id:'s_sirens', c:'story', t:'Морской волк: отбиться от сирен, не сходя с лодки', p:10, a:2},
{id:'s_undvik', c:'story', t:'Пройти «Владыку Ундвика»', p:15, a:2},
{id:'s_wish', c:'story', t:'Квест с Йеннифэр и джинном', p:15, a:2},
{id:'s_allies', c:'story', t:'Собрать союзников: все задания «Братья по оружию»', p:40, a:2},
{id:'s_champ', c:'story', t:'Чемпион кулачных боёв во всех регионах', p:30, a:2},
{id:'s_heist', c:'story', t:'Каменные сердца: ограбление с командой, которую выбрал сам', p:20, a:4},
{id:'s_runes', c:'story', t:'Каменные сердца: нанести рунное слово у мастера рун', p:20, a:4},
{id:'s_mut', c:'story', t:'Кровь и вино: активировать 3 мутации', p:30, a:5},
{id:'k_pop1', c:'skill', t:'Место силы в Белом Саду', p:5},
{id:'k_popv', c:'skill', t:'Все места силы Велена', p:15},
{id:'k_popfight', c:'skill', t:'Место силы в деле: сразу после него выиграть бой усиленным знаком', p:10, n:3},
{id:'k_rank3', c:'skill', t:'Довести любой навык до 3-го ранга', p:10},
{id:'k_alt', c:'skill', t:'Открыть альтернативный режим у двух знаков и выиграть ими по бою', p:15},
{id:'k_axii', c:'skill', t:'Язык Аксия: 3 раза решить разговор знаком вместо денег или драки', p:15},
{id:'k_five', c:'skill', t:'Все пять знаков в одном бою', p:10},
{id:'k_water', c:'skill', t:'Утопец под водой из арбалета', p:5},
{id:'k_pops', c:'skill', t:'Места силы Скеллиге — за каждые 3 найденных', p:5, n:5, a:2},
{id:'k_three', c:'skill', t:'Навык 3-го ранга в бою, в знаках и в алхимии', p:20, a:2},
{id:'k_style', c:'skill', t:'Твой стиль: выбрать основную ветку и записать в дневник почему', p:10, a:2},
{id:'e_village', c:'explore', t:'Вернуть жизнь: зачистить заброшенное поселение, чтобы туда вернулись люди', p:10, n:5},
{id:'e_guard', c:'explore', t:'Сокровище под охраной: узнать сторожа по бестиарию и забрать клад', p:10, n:3},
{id:'e_hunt', c:'explore', t:'Охота за сокровищами по найденной записке или карте', p:10, n:3},
{id:'e_best15', c:'explore', t:'Бестиарий: 15 записей', p:10},
{id:'e_best30', c:'explore', t:'Бестиарий: 30 записей', p:15},
{id:'e_best50', c:'explore', t:'Бестиарий: 50 записей', p:20, a:2},
{id:'e_velen', c:'explore', t:'Хозяин Велена: жизнь во всех заброшенных поселениях Велена', p:25, a:2},
{id:'p_cover', c:'photo', t:'Обложка акта: постановочный кадр — поза, свет, погода', p:15, n:5},
{id:'p_monster', c:'photo', t:'Портрет чудовища: кадр с поверженным заказным чудовищем', p:5, n:4},
{id:'p_fp', c:'photo', t:'Глазами ведьмака: кадр от первого лица в любимом месте', p:5},
{id:'p_before', c:'photo', t:'Живая деревня: кадр поселения до и после зачистки', p:5, n:3},
{id:'p_look', c:'photo', t:'Образ акта: собрать свой вид через трансмог у мастера', p:10, n:3, a:2},
{id:'p_strong', c:'photo', t:'Сильный и красивый: лучшая броня с видом любимого сета', p:10, a:2},
{id:'p_empty', c:'photo', t:'Пустой Новиград: кадр со скрытыми NPC', p:5, a:2},
{id:'p_storm', c:'photo', t:'Шторм на Скеллиге: постановочный кадр', p:5, a:2},
{id:'p_poster', c:'photo', t:'Постер: лучший кадр игры, выбранный вместе с друзьями', p:20, a:3},
{id:'r_diff', c:'replay', t:'Другой выбор: в крупном квесте поступить иначе, чем в первый раз, и досмотреть последствия', p:15, n:3},
{id:'r_missed', c:'replay', t:'Что я пропустил: 3 побочки за акт, которых не помнишь', p:10, n:5},
{id:'r_memory', c:'replay', t:'Я помню, чем кончится: записать догадку перед большим квестом и сверить', p:5, n:5},
{id:'r_school', c:'replay', t:'Другая школа: сет, который в первый раз не носил', p:10},
{id:'r_stream', c:'replay', t:'Кинопоказ: сюжетная сессия на стриме другу в Discord', p:10},
{id:'r_vote', c:'replay', t:'Зал решает: один выбор в диалоге отдать голосованию зрителей', p:10},
{id:'r_friend', c:'replay', t:'Решение за друга: важный выбор сделать так, как сказал друг', p:10, n:3},
{id:'r_region', c:'replay', t:'Незнакомый регион: цепочка побочек там, где в первый раз бежал по сюжету', p:20, a:2},
{id:'c_neutral', c:'char', k:'book', t:'Не вмешиваться в конфликт, мимо которого можно пройти', p:5, n:3},
{id:'c_sarcasm', c:'char', k:'book', t:'Выбрать саркастичную реплику там, где она есть', p:5, n:5},
{id:'c_free', c:'char', k:'kind', t:'Отказаться от платы, если заказчику нечем платить', p:10, n:3},
{id:'c_help', c:'char', k:'kind', t:'Помочь человеку на дороге, даже если награды нет', p:5, n:5},
{id:'c_haggle', c:'char', k:'merc', t:'Поторговаться за заказ и не разозлить заказчика', p:5, n:5},
{id:'c_rich', c:'char', k:'merc', t:'Накопить 10 000 крон', p:15},
{id:'x_hmm', c:'secret', h:'«Хм…»', t:'Насчитать 10 ведьмачьих «Хм…» за одну сессию', p:5},
{id:'x_roach', c:'secret', h:'«Плотва, ты как туда залезла?»', t:'Скриншот Плотвы в самом нелепом месте', p:5},
{id:'x_barber', c:'secret', h:'«Новый образ»', t:'Сменить Геральту причёску или бороду у цирюльника', p:5},
{id:'x_peace', c:'secret', h:'«Миром»', t:'Закончить заказ или квест без боя', p:10},
{id:'x_swim', c:'secret', h:'«Пловец»', t:'Доплыть вплавь, хотя рядом была лодка', p:5},
{id:'x_bard', c:'secret', h:'«Слушатель»', t:'Дослушать выступление барда в трактире до конца', p:5}
];
/* легендарные контракты: выпадают на доску с шансом 1%, вне недельного лимита */
var W3L = [
{id:'L_hunt', c:'legend', t:'Неделя охотника: 3 заказа и отвар из мутагена каждого чудовища', p:60},
{id:'L_cards', c:'legend', t:'Вечер картёжника: 5 побед в гвинт подряд за одну сессию', p:60},
{id:'L_region', c:'legend', t:'Хозяин региона: заказ, гвинт, кулачный бой и скачки за одну сессию', p:60}
];
var VESEMIR = [
'Вот так и работают ведьмаки. Без спешки, с головой.',
'Доска объявлений сама себя не прочитает.',
'Ты ведьмак или картёжник? Хотя… хорошая партия.',
'Отдохни. Чудовища подождут, они никуда не денутся.',
'Масло на клинок — и половина дела сделана.',
'Неплохо. Для ученика.',
'Главное — вернуться на тропу.',
'Бестиарий читают до боя, а не после.'
];
var GIFT = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="2" y="7" width="12" height="7" rx="1.2" fill="currentColor"/><rect x="1" y="4" width="14" height="3.2" rx="1" fill="currentColor"/><rect x="7.1" y="4" width="1.8" height="10" fill="var(--surface)"/></svg>';
/* ---------- состояние ---------- */
var S = {progress:{}, custom:{}, dota:{days:[], weeks:[]}, rewards:null, ranks:{claimed:{}}, mode:'loading', loaded:false, readonly:false, tab:'route', q:'', panel:null, rewardEdit:false, trackScrolled:false, w3:null, w3col:'hunt', w3confirm:false};
var VIEWER = true;
var PLAYER = 'Никита', SNAP_AT = null;
if (VIEWER) {
var PD = (window.PASS_DATA && typeof window.PASS_DATA === 'object') ? window.PASS_DATA : null;
if (!PD) { try { PD = JSON.parse(document.getElementById('pass-data').textContent) || {}; } catch (e) { PD = {}; } }
S.progress = PD.progress || {}; S.custom = PD.custom || {};
S.dota = {days:(PD.dota && PD.dota.days) || [], weeks:(PD.dota && PD.dota.weeks) || []};
S.rewards = PD.rewards || null; S.ranks = {claimed:(PD.ranks && PD.ranks.claimed) || {}};
S.w3 = (PD.witcher && typeof PD.witcher === 'object') ? PD.witcher : null;
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
var custom = Object.keys(S.custom).map(function(id){ var g = S.custom[id] || {}; return {id:id, n:g.name || 'Без названия', h:Math.max(1, Number(g.hours) || 1), c:[CATS[g.cat] ? g.cat : 'story'], coop:!!g.coop, custom:true, note:typeof g.note === 'string' ? g.note.slice(0, 60) : '', ch:Array.isArray(g.ch) ? g.ch.filter(function(x){ return x && typeof x.id === 'string' && typeof x.t === 'string'; }).map(function(x){ return {id:x.id, t:String(x.t).slice(0, 160), p:Math.max(0, Math.min(100, Number(x.p) || 0)), auto:!!x.auto}; }) : undefined}; });
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
var w3d = w3Derive(); ctx.w3 = w3d; ctx.w3Pts = w3d.pts;
ctx.total = gamePts + dotaPts + achPts + w3d.pts;
var granted = {token:0, clock:0, boost:0}, cl = claimedMap();
RANKS.forEach(function(r){ if (r.chest && cl[r.id]) Object.keys(r.chest).forEach(function(k){ granted[k] += r.chest[k]; }); });
Object.keys(w3d.granted).forEach(function(k){ granted[k] += w3d.granted[k]; });
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
renderStatus(); renderRank(d); renderStats(d); renderTrack(d); renderSlots(d); renderWitcher(d); renderTabs(); renderGames(d); renderDota(d);
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
stat(num(d.total), 'Очки', 'игры ' + num(d.gamePts) + ' · Ведьмак ' + num(d.w3Pts) + ' · Дота ' + num(d.dotaPts) + ' · ачивки ' + num(d.achPts)) +
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
return '<label class="ch"><input type="checkbox" id="ch-' + g.id + '-' + x.id + '" data-act="ch" data-id="' + g.id + '" data-ch="' + x.id + '"' + (ch[x.id] ? ' checked' : '') + ro + '><span>' + esc(x.t) + (x.auto ? ' <span class="tag steam">из сейва</span>' : '') + '</span><span class="mono plus">+' + x.p + '</span></label>';
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
var wd = w3().actsDone || {}; Object.keys(wd).forEach(function(a){ if (W3_ACTS[a]) ev.push({t:wd[a], txt:'Ведьмак 3: пройден акт ' + a + ' «' + W3_ACTS[a] + '»'}); });
var wt = w3().tasks || {}; W3L.forEach(function(l){ var e0 = (wt[l.id] || [])[0]; if (e0) ev.push({t:e0.t, txt:'Легендарный контракт: ' + l.t.split(':')[0], pts:e0.p}); });
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
try { localStorage.setItem('story-pass-v1', JSON.stringify({progress:S.progress, custom:S.custom, dota:S.dota, rewards:S.rewards, ranks:S.ranks, witcher:S.w3})); } catch (e) {}
}
function loadLocal(){
try {
var raw = localStorage.getItem('story-pass-v1'); if (!raw) return;
var o = JSON.parse(raw) || {};
S.progress = o.progress || {}; S.custom = o.custom || {}; S.dota = o.dota || {days:[], weeks:[]}; S.rewards = o.rewards || null; S.ranks = o.ranks || {claimed:{}}; S.w3 = o.witcher || null;
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
/* ---------- Ведьмачий журнал: логика ---------- */
function w3(){ return S.w3 || {}; }
function w3Act(){ return Math.min(5, Math.max(1, Number(w3().act) || 1)); }
function w3Log(id){ var t = (w3().tasks || {})[id]; return Array.isArray(t) ? t : []; }
function w3Count(id){ return w3Log(id).length; }
function w3Task(id){ var l = W3T.concat(W3L); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function w3Max(t){ return t.n || 1; }
function w3Unlocked(t){ return t.c === 'legend' || (t.a || 1) <= w3Act(); }
function w3Visible(t){ return t.c !== 'char' || t.k === w3().char; }
function w3PathOf(act){ var p = (w3().path || {})[act || w3Act()]; return W3_PATHS[p] ? p : null; }
function w3Mult(t){ var p = w3PathOf(); return p && W3_PATHS[p].cols.indexOf(t.c) > -1 ? BOOST_MULT : 1; }
function w3Rarity(t){ if (t.c === 'legend') return 'legend'; return t.p >= 25 ? 'epic' : t.p >= 15 ? 'rare' : 'common'; }
function w3ColName(id){ var c = W3_COLS.filter(function(x){ return x.id === id; })[0]; return c ? c.n : 'Легенда'; }
function w3Derive(){
var tasks = w3().tasks || {}, weeks = {}, raw = 0, legend = 0;
Object.keys(tasks).forEach(function(id){
(Array.isArray(tasks[id]) ? tasks[id] : []).forEach(function(e){
var pts = Math.max(0, Number(e && e.p) || 0); raw += pts;
if (e.x) { legend += pts; return; }
var wk = weekKey(e.t); weeks[wk] = (weeks[wk] || 0) + pts;
});
});
var counted = legend, glory = 0;
Object.keys(weeks).forEach(function(k){ counted += Math.min(W3_CAP, weeks[k]); glory += Math.max(0, weeks[k] - W3_CAP); });
var granted = {token:0, clock:0, boost:0};
var cols = W3_COLS.map(function(c){
var list = W3T.filter(function(t){ return t.c === c.id && w3Visible(t); });
var tot = 0, got = 0;
list.forEach(function(t){ var m = w3Max(t); tot += t.p * m; got += t.p * Math.min(m, w3Count(t.id)); });
var pct = tot ? got / tot : 0;
var ok = !!c.chest && pct >= W3_CHEST_AT;
if (ok) Object.keys(c.chest).forEach(function(k){ granted[k] += c.chest[k]; });
return {c:c, list:list, pct:pct, done:list.filter(function(t){ return w3Count(t.id) >= w3Max(t); }).length, chestOk:ok};
});
return {pts:counted, raw:raw, glory:glory, week:weeks[weekKey()] || 0, cols:cols, granted:granted};
}
function w3Clone(){
var o = clone(S.w3) || {};
o.tasks = (o.tasks && typeof o.tasks === 'object') ? o.tasks : {};
o.path = (o.path && typeof o.path === 'object') ? o.path : {};
o.board = (o.board && typeof o.board === 'object') ? o.board : {};
o.board.cards = Array.isArray(o.board.cards) ? o.board.cards : [];
o.diary = Array.isArray(o.diary) ? o.diary : [];
o.actsDone = (o.actsDone && typeof o.actsDone === 'object') ? o.actsDone : {};
o.act = w3Act();
return o;
}
function w3CardOk(c){ var t = c && w3Task(c.id); return !!t && w3Visible(t) && w3Unlocked(t) && w3Count(t.id) < w3Max(t); }
function w3Draw(o, excl){
var on = o.board.cards.map(function(c){ return c.id; }).concat(excl || []);
if (Math.random() < 0.01) {
var L = W3L.filter(function(l){ return w3Count(l.id) < 1 && on.indexOf(l.id) < 0; });
if (L.length) return L[Math.floor(Math.random() * L.length)].id;
}
var pool = W3T.filter(function(t){ return t.c !== 'secret' && w3Visible(t) && w3Unlocked(t) && w3Count(t.id) < w3Max(t) && on.indexOf(t.id) < 0; });
if (!pool.length) return null;
var pct = {}; w3Derive().cols.forEach(function(c){ pct[c.c.id] = c.pct; });
var w = pool.map(function(t){ return 1 + 2 * (1 - (pct[t.c] || 0)); });
var sum = w.reduce(function(s, x){ return s + x; }, 0), r = Math.random() * sum;
for (var i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i].id; }
return pool[pool.length - 1].id;
}
function w3Fill(o, excl){
o.board.cards = o.board.cards.filter(w3CardOk);
var guard = 0;
while (o.board.cards.length < 3 && guard++ < 12) { var id = w3Draw(o, excl); if (!id) break; o.board.cards.push({id:id, at:nowISO()}); }
}
function w3Save(o){ S.w3 = o; renderAll(); return persist('meta/witcher', clone(o)); }
function vesemir(){ return Math.random() < 0.4 ? ' Весемир: «' + VESEMIR[Math.floor(Math.random() * VESEMIR.length)] + '»' : ''; }
function w3Complete(id, fromBoard){
if (locked()) return;
var t = w3Task(id); if (!t || !w3Unlocked(t) || !w3Visible(t)) return;
if (w3Count(id) >= w3Max(t)) return;
var d0 = derive(), c0 = {};
d0.w3.cols.forEach(function(c){ c0[c.c.id] = c.chestOk; });
var o = w3Clone();
var pts = Math.round(t.p * (t.c === 'legend' ? 1 : w3Mult(t))) + (fromBoard ? W3_BOARD_BONUS : 0);
var e = {t:nowISO(), p:pts, a:w3Act()};
if (fromBoard) e.b = 1;
if (t.c === 'legend') e.x = 1;
o.tasks[id] = (Array.isArray(o.tasks[id]) ? o.tasks[id] : []).concat([e]);
S.w3 = o;
o.board.cards = o.board.cards.filter(function(c){ return c.id !== id; });
if (fromBoard || o.board.cards.length) w3Fill(o);
w3Save(o);
var d1 = derive(), gained = d1.total - d0.total;
var msg = (t.c === 'secret' ? 'Секрет открыт: ' : 'Готово: ') + t.t.split(':')[0] + '. +' + num(gained) + ' очк.';
if (gained < pts) msg += ' Лимит недели: ' + (pts - gained) + ' ушло в славу.';
var nc = d1.w3.cols.filter(function(c){ return c.chestOk && !c0[c.c.id]; })[0];
if (nc) msg += ' Коллекция «' + nc.c.n + '» на 75%: ' + chestPlain(nc.c.chest) + '!';
toast(msg + vesemir());
}
function w3Undo(id){
if (locked()) return;
var o = w3Clone(), l = o.tasks[id];
if (!Array.isArray(l) || !l.length) return;
l.pop(); if (!l.length) delete o.tasks[id];
w3Save(o); toast('Отметка снята.');
}
function w3Reroll(id){
if (locked()) return;
var o = w3Clone();
if (o.board.rr === dayKey()) { toast('Сорвать без выполнения можно одно объявление в день.'); return; }
S.w3 = o;
o.board.cards = o.board.cards.filter(function(c){ return c.id !== id; });
o.board.rr = dayKey();
w3Fill(o, [id]);
w3Save(o); toast('Объявление сорвано, на доске новое.');
}
function w3Refill(){ if (locked()) return; var o = w3Clone(); S.w3 = o; w3Fill(o); w3Save(o); }
function w3SetChar(k){
if (locked() || !W3_CHARS[k]) return;
var o = w3Clone(); o.char = k; S.w3 = o; w3Fill(o); w3Save(o);
toast('Характер на это прохождение: ' + W3_CHARS[k].n + '.');
}
function w3SetPath(k){
if (locked() || !W3_PATHS[k]) return;
var o = w3Clone(); o.path[o.act] = k; w3Save(o);
toast('Путь акта ' + o.act + ': ' + W3_PATHS[k].n + ' — ' + W3_PATHS[k].d + '.');
}
function w3NextAct(){
if (locked()) return;
var o = w3Clone(); if (o.act >= 5) return;
o.actsDone[o.act] = nowISO(); o.act = o.act + 1;
S.w3 = o; S.w3confirm = false; w3Fill(o); w3Save(o);
toast('Акт пройден. Дальше: ' + W3_ACTS[o.act] + '. Новые задания открыты.' + vesemir());
}
function w3AddDiary(text){
if (locked()) return;
text = String(text || '').trim().slice(0, 240); if (!text) return;
var o = w3Clone(); o.diary = [{t:nowISO(), a:o.act, x:text}].concat(o.diary).slice(0, 300);
w3Save(o); toast('Записано в дневник.');
}
function w3DelDiary(at){
if (locked()) return;
var o = w3Clone(); o.diary = o.diary.filter(function(e){ return e.t !== at; }); w3Save(o);
}
/* ---------- Ведьмачий журнал: отрисовка ---------- */
function w3TaskRow(t, w){
var cnt = w3Count(t.id), max = w3Max(t), full = cnt >= max, open = w3Unlocked(t), ro = locked() ? ' disabled' : '';
var mult = w3Mult(t), pts = Math.round(t.p * mult);
var secretHidden = t.c === 'secret' && cnt === 0;
var txt = secretHidden ? '??? ' + t.h : t.t;
var cls = ['w3-task', 'r-' + w3Rarity(t)];
if (full) cls.push('full'); if (!open) cls.push('lock');
var right;
if (!open) right = '<span class="small muted">🔒 акт ' + t.a + '</span>';
else if (VIEWER) right = full ? '<span class="pill good">✓</span>' : (cnt ? '<span class="mono small">' + cnt + '/' + max + '</span>' : '');
else right = (cnt ? '<button class="btn btn-small btn-ghost" type="button" data-act="w3-undo" data-id="' + t.id + '" title="Снять последнюю отметку"' + ro + '>−</button>' : '') +
(full ? '<span class="pill good">✓</span>' : '<button class="btn btn-small" type="button" data-act="w3-done" data-id="' + t.id + '"' + ro + '>Выполнил</button>');
return '<li class="' + cls.join(' ') + '"><span class="w3-t">' + esc(txt) + (max > 1 ? ' <span class="mono muted small">' + cnt + '/' + max + '</span>' : '') + '</span>' +
'<span class="mono plus">+' + pts + (mult > 1 ? ' <span class="small">×1,5</span>' : '') + '</span><span class="w3-r">' + right + '</span></li>';
}
function renderWitcher(d){
var sec = $('w3'); if (!sec) return;
var st = w3(), w = d.w3, act = w3Act(), ro = locked() ? ' disabled' : '';
var path = w3PathOf(), ch = W3_CHARS[st.char] ? st.char : null;
$('w3Sub').textContent = 'Акт ' + act + ' · ' + W3_ACTS[act];
/* верх: характер, путь, лимит */
var charHTML = VIEWER ? (ch ? '<span class="pill coop">' + esc(W3_CHARS[ch].n) + '</span><span class="small muted">' + esc(W3_CHARS[ch].d) + '</span>' : '<span class="small muted">Характер ещё не выбран</span>') :
Object.keys(W3_CHARS).map(function(k){ return '<button class="seg' + (ch === k ? ' on' : '') + '" type="button" data-act="w3-char" data-id="' + k + '" aria-pressed="' + (ch === k) + '" title="' + esc(W3_CHARS[k].d) + '"' + ro + '>' + esc(W3_CHARS[k].n) + '</button>'; }).join('');
var pathHTML = VIEWER ? (path ? '<span class="pill play">' + esc(W3_PATHS[path].n) + '</span><span class="small muted">' + esc(W3_PATHS[path].d) + '</span>' : '<span class="small muted">Путь акта не выбран</span>') :
Object.keys(W3_PATHS).map(function(k){ return '<button class="seg' + (path === k ? ' on' : '') + '" type="button" data-act="w3-path" data-id="' + k + '" aria-pressed="' + (path === k) + '" title="' + esc(W3_PATHS[k].d) + '"' + ro + '>' + esc(W3_PATHS[k].n) + '</button>'; }).join('');
var wk = Math.min(W3_CAP, w.week), wpct = Math.round(wk / W3_CAP * 100);
var top = '<div class="w3-top card">' +
'<div class="w3-kv"><span class="items-label">Характер</span><div class="segs">' + charHTML + '</div></div>' +
'<div class="w3-kv"><span class="items-label">Путь акта</span><div class="segs">' + pathHTML + '</div></div>' +
'<div class="w3-nums">' +
'<div><div class="v mono">' + num(w.pts) + '</div><div class="l">очков из журнала</div></div>' +
'<div class="w3-week"><div class="l">Эта неделя: <span class="mono">' + wk + '/' + W3_CAP + '</span></div><div class="bar thin"><span style="width:' + wpct + '%"></span></div></div>' +
'<div><div class="v mono">' + num(w.glory) + '</div><div class="l">слава сверх лимита</div></div>' +
'</div></div>';
/* доска */
var cards = (st.board && Array.isArray(st.board.cards) ? st.board.cards : []).filter(w3CardOk);
var rrUsed = st.board && st.board.rr === dayKey();
var board = cards.map(function(c){
var t = w3Task(c.id), r = w3Rarity(t), mult = t.c === 'legend' ? 1 : w3Mult(t);
return '<article class="w3-card r-' + r + '"><div class="w3-card-top"><span class="w3-rar">' + W3_RAR[r] + '</span><span class="small muted">' + esc(w3ColName(t.c)) + '</span></div>' +
'<p class="w3-card-t">' + esc(t.t) + '</p>' +
'<div class="w3-card-foot"><span class="mono plus">+' + Math.round(t.p * mult) + (VIEWER ? '' : ' +' + W3_BOARD_BONUS) + '</span>' +
(VIEWER ? '' : '<span class="acts"><button class="btn btn-small btn-ghost" type="button" data-act="w3-reroll" data-id="' + t.id + '"' + (ro || (rrUsed ? ' disabled' : '')) + ' title="' + (rrUsed ? 'Сегодня уже срывал' : 'Сорвать без выполнения — раз в день') + '">↻</button><button class="btn btn-small btn-primary" type="button" data-act="w3-board" data-id="' + t.id + '"' + ro + '>Выполнил</button></span>') +
'</div></article>';
}).join('');
if (cards.length < 3 && !VIEWER) board += '<div class="w3-card empty"><p class="small muted">' + (cards.length ? 'Место на доске свободно.' : 'Доска пустая. Повесь объявления — появятся 3 задания на вечер.') + '</p><button class="btn btn-small btn-primary" type="button" data-act="w3-fill"' + ro + '>Повесить объявления</button></div>';
if (!cards.length && VIEWER) board = '<p class="small muted">Доска пока пустая.</p>';
/* коллекции */
var sel = S.w3col || 'hunt';
var colBtns = w.cols.filter(function(c){ return c.c.id !== 'char' || ch; }).map(function(c){
var pct = Math.round(c.pct * 100), isSecret = c.c.id === 'secret';
var sub = isSecret ? c.done + ' из ' + c.list.length + ' найдено' : (c.chestOk ? 'Сундук получен' : c.c.chest ? 'сундук на 75%' : pct + '%');
return '<button class="w3-col' + (sel === c.c.id ? ' on' : '') + (c.chestOk ? ' ok' : '') + '" type="button" data-act="wcol" data-id="' + c.c.id + '" aria-pressed="' + (sel === c.c.id) + '">' +
'<span class="w3-col-n">' + esc(c.c.id === 'char' && ch ? W3_CHARS[ch].n : c.c.n) + '</span>' +
(isSecret ? '' : '<span class="bar thin"><span style="width:' + pct + '%"></span></span>') +
'<span class="small muted">' + esc(sub) + (c.c.chest && !c.chestOk ? ' · ' + pct + '%' : '') + '</span></button>';
}).join('');
var selCol = w.cols.filter(function(c){ return c.c.id === sel; })[0] || w.cols[0];
var list = selCol.list.slice().sort(function(a, b){ return (w3Unlocked(b) - w3Unlocked(a)) || ((a.a || 1) - (b.a || 1)); });
var colHead = selCol.c.chest ? '<p class="small muted">Сундук коллекции на 75%: ' + chestPlain(selCol.c.chest) + '.' + (path && W3_PATHS[path].cols.indexOf(selCol.c.id) > -1 ? ' Путь «' + W3_PATHS[path].n + '»: очки ×1,5.' : '') + '</p>' :
selCol.c.id === 'secret' ? '<p class="small muted">Видна только подсказка. Выполнил — отметь, и секрет откроется.</p>' : '<p class="small muted">Задания выбранного характера.</p>';
if (selCol.c.id === 'char' && !ch) colHead = '<p class="small muted">Сначала выбери характер Геральта.</p>';
var tasksHTML = '<ul class="w3-tasks">' + list.map(function(t){ return w3TaskRow(t, w); }).join('') + '</ul>';
/* акт */
var actBox = '';
if (!VIEWER && act < 5) {
actBox = S.w3confirm ?
'<div class="confirm"><p><strong>Акт ' + act + ' «' + esc(W3_ACTS[act]) + '» пройден?</strong> Откроются задания следующего акта, итоги попадут на витрину.</p><div class="acts"><button class="btn btn-primary btn-small" type="button" data-act="w3-act-ok"' + ro + '>Да, дальше</button><button class="btn btn-ghost btn-small" type="button" data-act="w3-act-no">Отмена</button></div></div>' :
'<div class="acts"><button class="btn btn-small" type="button" data-act="w3-act"' + ro + '>Акт ' + act + ' пройден</button><span class="small muted">Дальше: ' + esc(W3_ACTS[act + 1]) + '</span></div>';
}
var sums = w3ActSummaries();
var sumHTML = sums.length ? '<div class="w3-acts">' + sums.map(function(s){
return '<article class="w3-actcard"><span class="eyebrow">Акт ' + s.act + ' завершён · ' + fmtDate(s.end) + '</span><div class="w3-act-n">' + esc(W3_ACTS[s.act]) + '</div>' +
'<div class="small">' + s.tasks + ' ' + plural(s.tasks, 'задание', 'задания', 'заданий') + ' · +' + num(s.pts) + ' очк.' + (s.path ? ' · путь: ' + esc(W3_PATHS[s.path].n) : '') + '</div>' +
(s.quote ? '<div class="small muted">«' + esc(s.quote) + '»</div>' : '') + '</article>';
}).join('') + '</div>' : '';
/* дневник */
var diary = Array.isArray(st.diary) ? st.diary : [];
var form = VIEWER ? '' : '<form class="w3-diary-form" id="w3DiaryForm"><label class="sr" for="w3DiaryIn">Запись в дневник</label><input id="w3DiaryIn" maxlength="240" autocomplete="off" placeholder="Цитата вечера, догадка, что запомнилось…"' + ro + '><button class="btn btn-small btn-primary" type="submit"' + ro + '>Записать</button></form>';
var dList = diary.length ? '<ol class="w3-diary">' + diary.slice(0, VIEWER ? 8 : 6).map(function(e){
return '<li><span class="lt mono">' + fmtDate(e.t) + ' · акт ' + (e.a || 1) + '</span><span>' + esc(e.x) + '</span>' + (VIEWER ? '' : '<button class="btn btn-small btn-ghost" type="button" data-act="w3-del" data-id="' + esc(e.t) + '" aria-label="Удалить запись"' + ro + '>✕</button>') + '</li>';
}).join('') + '</ol>' : '<p class="small muted">' + (VIEWER ? 'Записей пока нет.' : 'Пиши одну строку после сессии: реплику вечера, догадку перед квестом, что запомнилось. Это увидят друзья на витрине.') + '</p>';
$('w3Body').innerHTML = top +
'<div class="w3-block"><div class="sec-head"><h3 class="w3-h">Доска объявлений</h3><span class="small muted">' + (VIEWER ? 'Задания на ближайшие вечера' : '3 задания на вечер · с доски +' + W3_BOARD_BONUS + ' · сорвать без выполнения — раз в день') + '</span></div><div class="w3-board">' + board + '</div></div>' +
'<div class="w3-block"><div class="sec-head"><h3 class="w3-h">Коллекции</h3><span class="small muted">Задания открываются по актам</span></div><div class="w3-cols">' + colBtns + '</div>' +
'<div class="w3-list card">' + colHead + tasksHTML + '</div></div>' +
'<div class="w3-block"><div class="sec-head"><h3 class="w3-h">Дневник ведьмака</h3></div>' + form + dList + '</div>' +
(actBox || sumHTML ? '<div class="w3-block">' + actBox + sumHTML + '</div>' : '');
}
function w3ActSummaries(){
var st = w3(), done = st.actsDone || {}, out = [];
var all = [];
Object.keys(st.tasks || {}).forEach(function(id){ (st.tasks[id] || []).forEach(function(e){ all.push(e); }); });
var diary = Array.isArray(st.diary) ? st.diary : [];
for (var a = 1; a <= 5; a++) {
if (!done[a]) continue;
var es = all.filter(function(e){ return (e.a || 1) === a; });
var q = diary.filter(function(e){ return (e.a || 1) === a; });
out.push({act:a, end:done[a], tasks:es.length, pts:es.reduce(function(s, e){ return s + (Number(e.p) || 0); }, 0), path:W3_PATHS[(st.path || {})[a]] ? st.path[a] : null, quote:q.length ? q[0].x : ''});
}
return out.reverse();
}
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
case 'wcol': S.w3col = id; renderWitcher(derive()); break;
case 'w3-done': w3Complete(id, false); break;
case 'w3-board': w3Complete(id, true); break;
case 'w3-undo': w3Undo(id); break;
case 'w3-reroll': w3Reroll(id); break;
case 'w3-fill': w3Refill(); break;
case 'w3-char': w3SetChar(id); break;
case 'w3-path': w3SetPath(id); break;
case 'w3-act': S.w3confirm = true; renderWitcher(derive()); break;
case 'w3-act-no': S.w3confirm = false; renderWitcher(derive()); break;
case 'w3-act-ok': w3NextAct(); break;
case 'w3-del': w3DelDiary(id); break;
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
if (e.target.id === 'w3DiaryForm') {
e.preventDefault();
var inp = $('w3DiaryIn'); w3AddDiary(inp.value); 
return;
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
var got = {progress:false, custom:false, dota:false, rewards:false, ranks:false, witcher:false};
function ready(k){ got[k] = true; if (!S.loaded && got.progress && got.custom && got.dota && got.rewards && got.ranks && got.witcher) { S.loaded = true; S.mode = 'db'; } renderAll(); }
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
db.doc('meta/witcher').onSnapshot(function(doc){
S.w3 = doc.exists ? clone(doc.data()) : null;
ready('witcher');
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
