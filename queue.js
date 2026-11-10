/*!
 * 拆解台語羅馬字 — 臺語羅馬字聲母／韻母／聲調／變調互動教材
 * Copyright © 2026 臺中明道中學 詹宗龍. All rights reserved.
 * 版權所有。未經作者同意，請勿轉載、重製或修改。
 */
/* 題目抽取邏輯：確保「同一出題模式的題庫全部輪過一次後才會重複」 */
const TOTAL_QUESTIONS = 178;
const PATTERN_MODES = ['AA', 'AAA', 'AAB', 'ABA', 'ABB', 'ABC', 'AABB', 'AABC', 'ABAB', 'ABAC', 'ABCB', 'ABCC', 'ABCD'];
/* 特殊變調模式：依「教到什麼變調現象」分類，與上面的疊字型態各自獨立——
 * 屬於特殊變調的題目只出現在「特殊變調」練習，不會混進型態／基礎變調的題池 */
const SPECIAL_MODES = ['第9調', '--輕聲', 'á前'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 從 SLIDES 資料中取出每題右上角的疊字型態徽章文字（如 AAA、AABC），建立題號→型態對照表 */
function buildPatternMap() {
  const map = {};
  if (typeof SLIDES === 'undefined') return map;
  const patRe = /^[A-D]{2,5}$/;
  SLIDES.forEach(s => {
    let found = null;
    s.shapes.forEach(sh => {
      (sh.text || []).forEach(p => {
        const txt = p.runs.map(r => r.t).join('').trim();
        if (patRe.test(txt)) found = txt;
      });
    });
    map[s.i] = found;
  });
  return map;
}

let _patternMapCache = null;
function getPatternMap() {
  if (!_patternMapCache) _patternMapCache = buildPatternMap();
  return _patternMapCache;
}

/** 走訪一張投影片的所有文字（含表格儲存格），回傳去除前後空白的字串陣列 */
function slideTexts(s) {
  const out = [];
  s.shapes.forEach(sh => {
    (sh.text || []).forEach(p => out.push(p.runs.map(r => r.t).join('').trim()));
    (sh.rows || []).forEach(row => row.forEach(c => { if (c.text) out.push(c.text.trim()); }));
  });
  return out;
}

/** 判斷一張投影片是否屬於某個特殊變調類別 */
function matchesSpecial(s, mode) {
  const txt = slideTexts(s);
  if (mode === '第9調') {
    // 標籤寫「9維持」者即為第 9 調題（AAA 疊字首字變第 9 調後維持）
    return txt.some(t => t.indexOf('9維持') >= 0);
  }
  if (mode === '--輕聲') {
    // 標籤寫「--輕聲…」者即為輕聲題（第 2、65、176 張）
    return txt.some(t => t.indexOf('輕聲') >= 0);
  }
  if (mode === 'á前') {
    // 詞裡有「仔」(á) 就是 á 前變調的語境；另收標籤明寫「á前…」的特例題
    return txt.some(t => t === '仔' || t.indexOf('á前') >= 0);
  }
  return false;
}

let _specialMapCache = null;
function getSpecialMap() {
  if (_specialMapCache) return _specialMapCache;
  const map = {};
  SPECIAL_MODES.forEach(m => { map[m] = []; });
  if (typeof SLIDES !== 'undefined') {
    SLIDES.forEach(s => SPECIAL_MODES.forEach(m => { if (matchesSpecial(s, m)) map[m].push(s.i); }));
  }
  _specialMapCache = map;
  return map;
}

/** 該題屬於哪個特殊變調類別；不屬於任何類別回傳 null */
function specialOf(i) {
  const map = getSpecialMap();
  for (const m of SPECIAL_MODES) if (map[m].indexOf(i) >= 0) return m;
  return null;
}

/* 亂數練習不出的詞（仍保留在指定型態練習與投影片瀏覽中）。
 * 以投影片上的漢字比對，不寫死題號，投影片重新編號也不會失效 */
const RANDOM_EXCLUDE_WORDS = ['無臭無潲'];

let _randomExcludeCache = null;
function randomExcluded(i) {
  if (!_randomExcludeCache) {
    _randomExcludeCache = new Set();
    if (typeof SLIDES !== 'undefined') {
      SLIDES.forEach(s => {
        const txt = slideTexts(s);
        if (RANDOM_EXCLUDE_WORDS.some(w => Array.from(w).every(ch => txt.indexOf(ch) >= 0))) {
          _randomExcludeCache.add(s.i);
        }
      });
    }
  }
  return _randomExcludeCache.has(i);
}

/** 依練習種類（'basic' 基礎變調／'special' 特殊變調）與出題模式回傳題號池。
 *  basic：排除所有特殊變調題，mode 為 'random' 時是全部基礎題，否則為該疊字型態。
 *  special：mode 為 'random' 時是三類特殊變調的聯集，否則為該類別。 */
function poolFor(kind, mode) {
  const all = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);
  const random = !mode || mode === 'random';
  if (kind === 'special') {
    if (random) return all.filter(i => specialOf(i) && !randomExcluded(i));
    return SPECIAL_MODES.indexOf(mode) >= 0 ? getSpecialMap()[mode].slice() : [];
  }
  const basic = all.filter(i => !specialOf(i));
  if (random) return basic.filter(i => !randomExcluded(i));
  if (SPECIAL_MODES.indexOf(mode) >= 0) return [];
  const map = getPatternMap();
  return basic.filter(i => map[i] === mode);
}

/** 亂數模式下用來判斷「題型不得重複」的鍵：基礎看疊字型態，特殊看變調類別；指定模式時不需要 */
function typeKeyFn(kind, mode) {
  if (mode && mode !== 'random') return null;
  if (kind === 'special') return specialOf;
  const map = getPatternMap();
  return i => map[i];
}

function bagKey(kind, mode) {
  return 'taigi_romaji_bag_v3_' + kind + '_' + (mode || 'random');
}

function loadBag(kind, mode) {
  const pool = poolFor(kind, mode);
  try {
    const raw = localStorage.getItem(bagKey(kind, mode));
    if (raw) {
      const bag = JSON.parse(raw).filter(x => pool.includes(x));
      if (bag.length) return bag;
    }
  } catch (e) {}
  return shuffle(pool);
}

function saveBag(kind, mode, bag) {
  try { localStorage.setItem(bagKey(kind, mode), JSON.stringify(bag)); } catch (e) {}
}

/** 從尚未出現過的題袋中抽出 n 題（不重複）。亂數模式下同一次練習的題型不重複，
 *  題型全部用過一輪後才會再出現同一題型；袋空或袋中沒有可用題型時重新洗牌整組題池再續抽 */
function drawQuestions(n, kind, mode) {
  const pool = poolFor(kind, mode);
  if (!pool.length) return [];
  const keyOf = typeKeyFn(kind, mode);
  const ok = (x, cycle, used) => !cycle.has(x) && !(keyOf && used.has(keyOf(x)));
  let bag = loadBag(kind, mode);
  const picked = [];
  let cycle = new Set();   // 本輪已抽過的題（題數大於題池時，整池輪完才重複）
  let used = new Set();    // 本輪已用過的題型
  while (picked.length < n) {
    if (cycle.size >= pool.length) cycle = new Set();
    const left = pool.filter(x => !cycle.has(x));
    if (keyOf && left.every(x => used.has(keyOf(x)))) used = new Set();
    let idx = bag.findIndex(x => ok(x, cycle, used));
    if (idx < 0) {
      // 題袋裡沒有可用的題型了：把本輪還沒抽過的題洗牌補進袋尾
      bag = bag.concat(shuffle(left.filter(x => !bag.includes(x))));
      idx = bag.findIndex(x => ok(x, cycle, used));
    }
    const q = bag.splice(idx, 1)[0];
    picked.push(q);
    cycle.add(q);
    if (keyOf) used.add(keyOf(q));
  }
  saveBag(kind, mode, bag);
  return picked;
}

/** 「全部」：回傳題池的隨機排列（不影響題袋進度）。亂數模式下依題型輪流排，
 *  每一輪各題型最多一題，相鄰兩題不會是同一題型（題型只剩一種時除外） */
function drawAllQuestions(kind, mode) {
  const pool = poolFor(kind, mode);
  const keyOf = typeKeyFn(kind, mode);
  if (!keyOf) return shuffle(pool);
  const groups = {};
  pool.forEach(i => { const k = keyOf(i); (groups[k] = groups[k] || []).push(i); });
  Object.keys(groups).forEach(k => { groups[k] = shuffle(groups[k]); });
  const out = [];
  while (Object.keys(groups).length) {
    let keys = shuffle(Object.keys(groups));
    const last = out.length ? keyOf(out[out.length - 1]) : null;
    // 下一輪若只剩一種題型，這輪就不要把它排在最後，免得接著出現同一題型
    const carry = keys.filter(k => groups[k].length > 1);
    if (carry.length === 1 && keys.length > 1) {
      keys = keys.filter(k => k !== carry[0]);
      keys.splice(keys[0] === last ? 1 : 0, 0, carry[0]);
    }
    if (keys.length > 1 && keys[0] === last) [keys[0], keys[1]] = [keys[1], keys[0]];
    keys.forEach(k => {
      out.push(groups[k].shift());
      if (!groups[k].length) delete groups[k];
    });
  }
  return out;
}

/** 目前題袋剩餘題數（尚未在本輪出現過的題目數） */
function remainingInBag(kind, mode) {
  return loadBag(kind, mode).length;
}
