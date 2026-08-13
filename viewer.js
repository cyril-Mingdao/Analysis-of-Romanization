/* 通用簡報渲染引擎：讀取 data.js 內的 SLIDES 陣列，將每一題渲染成可點擊逐步顯示動畫的畫面 */

const PT2PX = 96 / 72;

function colorCss(c) {
  if (!c) return null;
  return c;
}

// 字級安全縮小係數：避免帶有上下延伸筆畫的字符（如台羅 j 的下勾、附標調號）
// 因字級過大、行高過鬆而超出方框範圍，被相鄰物件（如下方的變調表格）視覺遮蔽
const FONT_SAFETY = 0.78;

function applyTextBlock(el, textParas, defaultAlign, slideNumber) {
  if (!textParas || !textParas.length) return;
  el.innerHTML = '';
  textParas.forEach((p, pi) => {
    const line = document.createElement('div');
    line.className = 'txt';
    line.style.textAlign = ({ l: 'left', ctr: 'center', r: 'right' })[p.align] || defaultAlign || 'center';
    line.style.lineHeight = '1.05';
    p.runs.forEach(r => {
      const span = document.createElement('span');
      span.textContent = (r.field === 'slidenum' && slideNumber != null) ? String(slideNumber) : r.t;
      if (r.sz) span.style.fontSize = (r.sz * PT2PX * FONT_SAFETY) + 'px';
      if (r.c) span.style.color = colorCss(r.c);
      if (r.b) span.style.fontWeight = '700';
      span.style.lineHeight = '1';
      line.appendChild(span);
    });
    el.appendChild(line);
  });
}

function buildTable(sh) {
  const wrap = document.createElement('div');
  wrap.className = 'shape-el';
  wrap.style.left = sh.x + 'px';
  wrap.style.top = sh.y + 'px';
  wrap.style.width = sh.w + 'px';
  wrap.style.height = sh.h + 'px';
  const table = document.createElement('table');
  table.className = 'pptx-table';
  const totalH = sh.rowH.reduce((a, b) => a + b, 0) || 1;
  sh.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    const hpct = (sh.rowH[ri] / totalH) * 100;
    tr.style.height = hpct + '%';
    row.forEach(cell => {
      const td = document.createElement('td');
      if (cell.span && cell.span > 1) td.colSpan = cell.span;
      if (cell.rowSpan && cell.rowSpan > 1) td.rowSpan = cell.rowSpan;
      if (cell.fill) td.style.background = colorCss(cell.fill);
      if (cell.text) {
        td.textContent = cell.text;
        if (cell.sz) td.style.fontSize = (cell.sz * PT2PX * FONT_SAFETY) + 'px';
        if (cell.c) td.style.color = colorCss(cell.c);
        td.style.lineHeight = '1.05';
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  wrap.appendChild(table);
  return wrap;
}

/** 找出方框原生範圍內、中心點落在方框寬度內的答案格（聲母＋韻母），
 *  回傳這些格子的聯集範圍，讓方框剛好吻合底下的空白格 */
function hasText(sh) {
  return !!(sh.text && sh.text.some(p => p.runs.some(r => r.t && r.t.trim())));
}

function fitCalloutToCells(sh, allShapes) {
  const cells = allShapes.filter(s => (
    s !== sh && s.kind === 'sp' && s.prst === 'rect' && hasText(s) &&
    (s.x + s.w / 2) >= sh.x && (s.x + s.w / 2) <= sh.x + sh.w &&
    s.y < sh.y + sh.h && s.y + s.h > sh.y
  ));
  if (!cells.length) return sh;
  const minX = Math.min(...cells.map(c => c.x));
  const maxX = Math.max(...cells.map(c => c.x + c.w));
  const minY = Math.min(...cells.map(c => c.y));
  const maxY = Math.max(...cells.map(c => c.y + c.h));
  return Object.assign({}, sh, { x: minX, y: minY, w: maxX - minX, h: maxY - minY });
}

function buildCallout(sh) {
  // borderCallout1：方框只括住「聲母＋韻母」兩格，緊鄰右側才是「聲調」格，
  // 故引線需從方框右緣水平向右伸出，指向聲調數字
  const el = document.createElement('div');
  el.className = 'shape-el callout-box';
  el.style.left = sh.x + 'px';
  el.style.top = sh.y + 'px';
  el.style.width = sh.w + 'px';
  el.style.height = sh.h + 'px';
  const color = (sh.line && sh.line.color) || '#0000FF';
  const width = (sh.line && sh.line.width) ? sh.line.width : 3;
  el.style.borderWidth = width + 'px';
  el.style.borderColor = color;

  const pointerLen = Math.max(sh.h * 0.9, 24);
  const pointerY = sh.h / 2;
  const line = document.createElement('div');
  line.style.position = 'absolute';
  line.style.left = sh.w + 'px';
  line.style.top = pointerY + 'px';
  line.style.width = pointerLen + 'px';
  line.style.height = width + 'px';
  line.style.background = color;
  line.style.transform = 'translateY(-50%)';
  el.appendChild(line);

  const arrow = document.createElement('div');
  arrow.style.position = 'absolute';
  arrow.style.left = (sh.w + pointerLen) + 'px';
  arrow.style.top = pointerY + 'px';
  arrow.style.transform = 'translateY(-50%)';
  arrow.style.width = '0';
  arrow.style.height = '0';
  arrow.style.borderTop = '9px solid transparent';
  arrow.style.borderBottom = '9px solid transparent';
  arrow.style.borderLeft = '12px solid ' + color;
  el.appendChild(arrow);

  return el;
}

/* ===== 母片黑色箭頭的實測幾何（1280x720 投影片座標） =====
 * 直接對 master-bg.png 做「箭頭多邊形擬合」求得（以 anti-alias 灰階當覆蓋率、
 * 4 倍超取樣，對 8 支黑色箭頭最小化殘差，殘差 RMS ≈ 0.03，等同亞像素精度）：
 *   線身粗細 ≈ 7.4px、箭頭長 ≈ 22.2px、箭頭半寬 ≈ 11.2px。
 * 原始 pptx 的紅色連接線座標在各投影片之間有 ±2px 抖動，且與母片圖片之間存在
 * 約 0.98 倍的縮放差，單靠平移永遠對不準；故改為「吸附」到下列實測座標再繪製。
 * tail = 線段起點，tip = 箭頭尖端；heads 記錄母片在哪一端有黑色箭頭符號。 */
const MASTER_ARROW_GEOM = { shaft: 7.40, headLen: 22.20, headHalfWidth: 11.20 };
/* v17 換用 pic3.png 當母片。pic3 的內容相對舊 master-bg 有極小的仿射差
 * （x' = 1.002019x − 0.017、y' = 1.000936y − 0.572，殘差 < 0.02px），
 * 最右側「8 ↕ 4」那支箭頭若沿用舊座標會偏約 1.2px、紅色遮罩蓋不滿。
 * 下列座標即為套用該仿射後、對齊 pic3 的實測值。*/
const MASTER_ARROWS = [
  { tail: [387.69, 418.79], tip: [234.35, 418.65], heads: 'tip'  }, // 2 → 1
  { tail: [598.75, 419.08], tip: [445.44, 419.41], heads: 'tip'  }, // 4 → 2
  { tail: [235.94, 541.55], tip: [389.19, 541.33], heads: 'tip'  }, // 7 → 3
  { tail: [598.72, 542.75], tip: [445.41, 542.65], heads: 'tip'  }, // 8 → 3
  { tail: [210.93, 443.16], tip: [210.83, 511.07], heads: 'tip'  }, // 1 → 7
  { tail: [414.23, 508.45], tip: [414.45, 440.79], heads: 'tip'  }, // 3 → 2
  { tail: [627.54, 518.56], tip: [627.59, 450.68], heads: 'both' }, // 8 ↕ 4（母片為雙箭頭）
  { tail: [284.06, 474.53], tip: [240.65, 517.72], heads: 'tip'  }, // 5 ↘ 7
];
/* 紅色遮罩相對黑色箭頭的等距外擴量（px）。黑色邊緣本身帶約 1px 的 anti-alias 灰邊，
 * 外擴 0.5px 足以蓋掉灰邊、實際可見的紅色溢出僅約半個 px。
 * MASK_BASE_OVER 則是三角形底邊往線身方向多疊 0.7px（沿用同一條斜邊延伸，不改變外形），
 * 專門補掉「箭頭底邊」那一列 anti-alias 灰線；經全域像素比對後殘留黑墨為 0。 */
const MASK_MARGIN = 0.5;
const MASK_BASE_OVER = 0.7;
/* 母片有、但本題不該出現的箭頭符號，用底色抹掉。抹白區壓在白底上，外擴多一點不必付出
 * 任何視覺代價；外擴 1.5px 後該處最亮到 255/255（0.5px 時還會殘一條 248/255 的細邊）。 */
const MASK_ERASE_COLOR = '#FFFFFF';
const MASK_ERASE_MARGIN = 1.5;

/** 找出這條紅線對應的母片黑色箭頭（方向、長度、位置都相近才算數） */
function matchMasterArrow(x1, y1, x2, y2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!len) return null;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  let best = null, bestDist = Infinity;
  MASTER_ARROWS.forEach(m => {
    const dx = m.tip[0] - m.tail[0], dy = m.tip[1] - m.tail[1];
    const mlen = Math.hypot(dx, dy);
    const dot = ux * (dx / mlen) + uy * (dy / mlen);
    // 來源資料常以 flipH／flipV 反轉端點，方向相反也算同一支箭頭
    if (Math.abs(dot) < 0.966) return;                  // 夾角需 < 15°
    const ratio = len / mlen;
    if (ratio < 0.7 || ratio > 1.45) return;
    const d = Math.hypot(mx - (m.tail[0] + m.tip[0]) / 2, my - (m.tail[1] + m.tip[1]) / 2);
    if (d > 40 || d >= bestDist) return;
    bestDist = d; best = { master: m, aligned: dot > 0 };
  });
  return best;
}

/** 依實測幾何畫箭頭。tail→tip 為線段方向；opts 指定兩端各要不要畫箭頭符號，
 *  以及要不要用底色抹掉母片原本畫在該端的黑色箭頭符號。
 *  線身與箭頭沿輪廓等距外擴 MASK_MARGIN：尖端沿軸向延伸 δ/sinθ、半寬增加 δ/cosθ，
 *  外擴後夾角不變，確保完整遮蔽母片黑色箭頭又不會明顯溢出。 */
function buildArrow(tail, tip, opts) {
  const g = MASTER_ARROW_GEOM;
  const [tx, ty] = tail, [px, py] = tip;
  const len = Math.hypot(px - tx, py - ty);
  const angle = Math.atan2(py - ty, px - tx) * 180 / Math.PI;
  const theta = Math.atan2(g.headHalfWidth, g.headLen);
  /** 依外擴量算出三角形要畫多長多寬。底邊往回延伸 baseOver 並等比例放大半寬，
   *  等於把同兩條斜邊往回延長，外形（夾角）完全不變 */
  function triGeom(margin, baseOver) {
    const grow = margin / Math.sin(theta);               // 尖端沿軸向的外擴量
    const halfW = g.headHalfWidth + margin / Math.cos(theta);
    const headLen = g.headLen + grow;
    const triLen = headLen + baseOver;
    return { len: triLen, halfW: halfW * triLen / headLen, baseAt: g.headLen + baseOver };
  }
  const T = triGeom(MASK_MARGIN, MASK_BASE_OVER);
  const E = triGeom(MASK_ERASE_MARGIN, MASK_BASE_OVER + MASK_ERASE_MARGIN);
  const thick = g.shaft + MASK_MARGIN * 2;

  const el = document.createElement('div');
  el.className = 'shape-el conn-line';
  el.style.left = tx + 'px';
  el.style.top = ty + 'px';
  el.style.width = '0';
  el.style.height = '0';
  el.style.transformOrigin = '0 0';
  el.style.transform = `rotate(${angle}deg)`;

  // 三角形以 clip-path 而非 CSS border 繪製：border-width 會被瀏覽器四捨五入到
  // 整數像素，半寬與長度各會掉掉零點幾 px，剛好吃掉預留的遮蔽餘裕
  function addTriangle(atStart, fill, t) {
    const tri = document.createElement('div');
    tri.className = 'conn-arrow';
    tri.style.position = 'absolute';
    tri.style.top = (-t.halfW) + 'px';
    tri.style.left = (atStart ? t.baseAt - t.len : len - t.baseAt) + 'px';
    tri.style.width = t.len + 'px';
    tri.style.height = (t.halfW * 2) + 'px';
    tri.style.background = fill;
    tri.style.clipPath = atStart
      ? 'polygon(100% 0, 0 50%, 100% 100%)'   // 尖端朝線段起點
      : 'polygon(0 0, 100% 50%, 0 100%)';     // 尖端朝線段終點
    el.appendChild(tri);
  }

  // 先抹掉不該出現的母片箭頭符號，線身與紅色箭頭再蓋上去
  if (opts.eraseTail) addTriangle(true, MASK_ERASE_COLOR, E);
  if (opts.eraseTip) addTriangle(false, MASK_ERASE_COLOR, E);

  // 線身：有畫箭頭的一端在「箭頭底邊」處收住，避免線身從三角形斜邊旁邊凸出去；
  // 被抹掉箭頭的一端則延伸到原本的尖端位置，維持線段原有長度並收成平頭
  const shaftStart = opts.headAtTail ? T.baseAt : -MASK_MARGIN;
  const shaftEnd = opts.headAtTip ? len - T.baseAt : len + MASK_MARGIN;
  const shaft = document.createElement('div');
  shaft.style.position = 'absolute';
  shaft.style.left = shaftStart + 'px';
  shaft.style.top = (-thick / 2) + 'px';
  shaft.style.width = Math.max(shaftEnd - shaftStart, 0) + 'px';
  shaft.style.height = thick + 'px';
  shaft.style.background = opts.color;
  el.appendChild(shaft);

  if (opts.headAtTail) addTriangle(true, opts.color, T);
  if (opts.headAtTip) addTriangle(false, opts.color, T);
  return el;
}

function buildConnector(sh) {
  const color = (sh.line && sh.line.color) || '#FF0000';
  let x1 = sh.x, y1 = sh.y, x2 = sh.x + sh.w, y2 = sh.y + sh.h;
  if (sh.flipH) { const t = x1; x1 = x2; x2 = t; }
  if (sh.flipV) { const t = y1; y1 = y2; y2 = t; }
  const headEnd = sh.line && sh.line.headEnd;
  const tailEnd = sh.line && sh.line.tailEnd;
  let atStart = !!(headEnd && headEnd !== 'none');   // 箭頭符號在 (x1,y1)
  let atEnd = !!(tailEnd && tailEnd !== 'none');     // 箭頭符號在 (x2,y2)

  const hit = matchMasterArrow(x1, y1, x2, y2);
  if (!hit) {
    // 目前 179 張投影片的 312 條連接線全部吸附得上，這裡只是保險：
    // 對不上母片的線就照它自己的座標畫
    return buildArrow([x1, y1], [x2, y2], { headAtTail: atStart, headAtTip: atEnd, color });
  }
  const m = hit.master;
  // 把「原始線段的哪一端有箭頭」換算成「母片線段的哪一端有箭頭」
  let headAtTip = hit.aligned ? atEnd : atStart;
  let headAtTail = hit.aligned ? atStart : atEnd;
  // 母片沒畫箭頭的那一端不畫（否則會凸出黑色箭頭之外）；
  // 若換算後兩端都不畫（來源資料偶有端點反置），就退回母片的箭頭配置
  const masterTip = true;                            // 母片一律在 tip 端有箭頭
  const masterTail = m.heads === 'both';
  headAtTip = headAtTip && masterTip;
  headAtTail = headAtTail && masterTail;
  if (!headAtTip && !headAtTail) { headAtTip = masterTip; headAtTail = masterTail; }
  return buildArrow(m.tail, m.tip, {
    headAtTail, headAtTip, color,
    // 母片有、但本題不需要的箭頭符號用底色抹掉，才不會露出黑色又保住單向語意
    eraseTail: masterTail && !headAtTail,
    eraseTip: masterTip && !headAtTip,
  });
}

function buildGenericShape(sh, slideNumber) {
  const el = document.createElement('div');
  el.className = 'shape-el';
  el.style.left = sh.x + 'px';
  el.style.top = sh.y + 'px';
  el.style.width = sh.w + 'px';
  el.style.height = sh.h + 'px';
  if (sh.fill) el.style.background = colorCss(sh.fill);
  if (sh.line && sh.line.color) {
    el.style.border = (sh.line.width || 1) + 'px solid ' + sh.line.color;
  }
  if (sh.prst === 'roundRect') {
    let radiusFrac = 0.16;
    if (sh.adj && sh.adj.adj !== undefined) radiusFrac = sh.adj.adj / 100000;
    const minSide = Math.min(sh.w, sh.h);
    el.style.borderRadius = Math.max(minSide * radiusFrac, 4) + 'px';
    if (!sh.fill) el.style.background = '#FFFFFF';
  }
  if (sh.prst === 'ellipse') {
    el.style.borderRadius = '50%';
  }
  if (sh.rot) el.style.transform = 'rotate(' + sh.rot + 'deg)';
  applyTextBlock(el, sh.text, 'center', slideNumber);
  if (!sh.text) el.style.pointerEvents = 'none';
  return el;
}

function buildShapeEl(sh, slideNumber, allShapes) {
  if (sh.kind === 'table') return buildTable(sh);
  if (sh.prst === 'borderCallout1') return buildCallout(allShapes ? fitCalloutToCells(sh, allShapes) : sh);
  if (sh.kind === 'cxn') return buildConnector(sh);
  return buildGenericShape(sh, slideNumber);
}

function animClassFor(filter) {
  if (!filter) return 'anim-fade';
  if (filter.indexOf('wipe(left)') >= 0) return 'anim-wipeLeft';
  if (filter.indexOf('wipe(right)') >= 0) return 'anim-wipeRight';
  if (filter.indexOf('wipe(up)') >= 0) return 'anim-wipeUp';
  if (filter.indexOf('wipe(down)') >= 0) return 'anim-wipeDown';
  return 'anim-fade';
}

class SlidePlayer {
  constructor(canvasEl, slideData) {
    this.canvas = canvasEl;
    this.data = slideData;
    this.stepIndex = 0;
    this.elById = new Map();
    this.timers = [];
    this._render();
  }

  _render() {
    this.canvas.innerHTML = '';
    this.elById.clear();
    // 母片內容以原始圖片呈現於最底層（避免向量重建造成物件變形），
    // 題目物件在上層時會如原簡報設計般重疊、遮擋母片內容
    const bg = document.createElement('img');
    bg.src = 'pic3.png';
    bg.className = 'master-bg';
    bg.draggable = false;
    this.canvas.appendChild(bg);
    const animatedIds = new Set();
    this.data.steps.forEach(group => group.forEach(e => animatedIds.add(e.id)));
    this.data.shapes.forEach(sh => {
      const el = buildShapeEl(sh, undefined, this.data.shapes);
      el.dataset.spid = sh.id;
      if (animatedIds.has(sh.id)) {
        el.classList.add('reveal-hidden');
      }
      this.canvas.appendChild(el);
      this.elById.set(sh.id, el);
    });
  }

  clearTimers() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }

  get totalSteps() { return this.data.steps.length; }
  get isDone() { return this.stepIndex >= this.totalSteps; }

  revealStep() {
    if (this.isDone) return false;
    const group = this.data.steps[this.stepIndex];
    group.forEach(effect => {
      const el = this.elById.get(effect.id);
      if (!el) return;
      const t = setTimeout(() => {
        el.classList.remove('reveal-hidden');
        // 箭頭（連接線）一律用淡入呈現：clip-path 式的擦除動畫會連同旋轉後的
        // 箭頭符號一起被裁切掉，導致箭頭消失且無法確實覆蓋母片的黑色箭頭
        const cls = el.classList.contains('conn-line') ? 'anim-fade' : animClassFor(effect.filter);
        el.classList.add(cls);
      }, effect.delay || 0);
      this.timers.push(t);
    });
    this.stepIndex++;
    return true;
  }

  revealAll() {
    this.clearTimers();
    while (!this.isDone) this.revealStep();
    // ensure instant (no residual animation delay stacking issues visually fine)
  }

  undoStep() {
    if (this.stepIndex <= 0) return false;
    this.clearTimers();
    this.stepIndex--;
    const group = this.data.steps[this.stepIndex];
    group.forEach(effect => {
      const el = this.elById.get(effect.id);
      if (!el) return;
      el.classList.remove('anim-wipeLeft', 'anim-wipeRight', 'anim-wipeUp', 'anim-wipeDown', 'anim-fade');
      el.classList.add('reveal-hidden');
    });
    return true;
  }

  reset() {
    this.clearTimers();
    this.stepIndex = 0;
    this._render();
  }
}
