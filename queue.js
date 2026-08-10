/* 題目抽取邏輯：確保「同一出題模式的題庫全部輪過一次後才會重複」 */
const TOTAL_QUESTIONS = 179;
const PATTERN_MODES = ['AA', 'AAA', 'AAB', 'ABA', 'ABB', 'AABB', 'AABC', 'ABAC', 'ABCB', 'ABCC', 'ABCD'];

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

/** 依出題模式回傳可用的題號池；mode 為 falsy 或 'random' 時回傳全部 55 題 */
function poolForMode(mode) {
  const all = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);
  if (!mode || mode === 'random') return all;
  const map = getPatternMap();
  return all.filter(i => map[i] === mode);
}

function bagKey(mode) {
  return 'taigi_romaji_bag_v2_' + (mode || 'random');
}

function loadBag(mode) {
  const pool = poolForMode(mode);
  try {
    const raw = localStorage.getItem(bagKey(mode));
    if (raw) {
      const bag = JSON.parse(raw).filter(x => pool.includes(x));
      if (bag.length) return bag;
    }
  } catch (e) {}
  return shuffle(pool);
}

function saveBag(mode, bag) {
  localStorage.setItem(bagKey(mode), JSON.stringify(bag));
}

/** 從尚未出現過的題袋中抽出 n 題（不重複），袋空時重新洗牌整組題池再續抽 */
function drawQuestions(n, mode) {
  const pool = poolForMode(mode);
  if (!pool.length) return [];
  let bag = loadBag(mode);
  const picked = [];
  while (picked.length < n) {
    if (bag.length === 0) {
      let fresh = shuffle(pool);
      const last = picked[picked.length - 1];
      if (last !== undefined && fresh[0] === last && fresh.length > 1) {
        [fresh[0], fresh[1]] = [fresh[1], fresh[0]];
      }
      bag = fresh;
    }
    picked.push(bag.shift());
  }
  saveBag(mode, bag);
  return picked;
}

/** 「全部」模式：直接回傳該出題模式題池的隨機排列（不影響題袋進度） */
function drawAllQuestions(mode) {
  return shuffle(poolForMode(mode));
}

/** 目前題袋剩餘題數（尚未在本輪出現過的題目數） */
function remainingInBag(mode) {
  return loadBag(mode).length;
}
