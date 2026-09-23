/* 題目抽取邏輯：確保「同一出題模式的題庫全部輪過一次後才會重複」 */
const TOTAL_QUESTIONS = 179;
const PATTERN_MODES = ['AA', 'AAA', 'AAB', 'ABA', 'ABB', 'AABB', 'AABC', 'ABAC', 'ABCB', 'ABCC', 'ABCD'];
/* 特殊變調模式：依「教到什麼變調現象」而非疊字型態分類，與上面的型態類別並存
 * （同一題可以同時屬於 AABC 與 --輕聲），所以各自獨立過濾、互不排除 */
const SPECIAL_MODES = ['--輕聲', 'á前'];

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
  if (mode === '--輕聲') {
    // 標籤寫「--輕聲…」者即為輕聲題（第 2、65、177 張）
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

/** 依出題模式回傳可用的題號池；mode 為 falsy 或 'random' 時回傳全部 179 題 */
function poolForMode(mode) {
  const all = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);
  if (!mode || mode === 'random') return all;
  if (SPECIAL_MODES.indexOf(mode) >= 0) return getSpecialMap()[mode].slice();
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
