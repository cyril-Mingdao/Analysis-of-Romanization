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

// 母片圖片以 object-fit:fill 撐滿整個 1280x720 畫布後，圖片內容位置與原始 EMU 座標系統
// 仍有些微落差（匯出圖片時邊界與原始投影片不完全一致）。以多組箭頭（對角線、水平、
// 垂直共 4 處）分別取「與線段垂直方向」上真正有效的量測值重新校正求得平移量。
const MASTER_ALIGN_DX = -2.3;
const MASTER_ALIGN_DY = -9;
function alignToMaster(x, y) {
  return [x + MASTER_ALIGN_DX, y + MASTER_ALIGN_DY];
}

function buildConnector(sh, isMaster) {
  // 以旋轉線段呈現，正確支援水平／垂直／斜向（如 5→7 的右上到左下）箭頭
  const el = document.createElement('div');
  el.className = 'shape-el conn-line';
  const color = (sh.line && sh.line.color) || '#FF0000';
  // 樣式（線寬、箭頭符號大小）與母片黑色箭頭一致，題目箭頭不再另外加粗
  const rawWidthPx = ((sh.line && sh.line.width) || 2) * PT2PX;
  const lw = Math.max(rawWidthPx, 2);

  let x1 = sh.x, y1 = sh.y, x2 = sh.x + sh.w, y2 = sh.y + sh.h;
  if (sh.flipH) { const t = x1; x1 = x2; x2 = t; }
  if (sh.flipV) { const t = y1; y1 = y2; y2 = t; }
  if (!isMaster) {
    // 對齊母片圖片內容的座標校正
    [x1, y1] = alignToMaster(x1, y1);
    [x2, y2] = alignToMaster(x2, y2);
    // 題目箭頭縮短五分之一（兩端各內縮 1/10，維持置中）
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    x1 = mx + (x1 - mx) * 0.8; y1 = my + (y1 - my) * 0.8;
    x2 = mx + (x2 - mx) * 0.8; y2 = my + (y2 - my) * 0.8;
  }
  const dx = x2 - x1, dy = y2 - y1;
  const length = Math.max(Math.hypot(dx, dy), lw);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  el.style.left = x1 + 'px';
  el.style.top = (y1 - lw / 2) + 'px';
  el.style.width = length + 'px';
  el.style.height = lw + 'px';
  el.style.background = color;
  el.style.transformOrigin = '0 50%';
  el.style.transform = `rotate(${angle}deg)`;

  const headEnd = sh.line && sh.line.headEnd;
  const tailEnd = sh.line && sh.line.tailEnd;
  const hasHead = headEnd && headEnd !== 'none';
  const hasTail = tailEnd && tailEnd !== 'none';
  // 箭頭符號比例依附件 arrow.png 實測校正：箭頭長度約為線寬 2.69 倍、
  // 箭頭最大寬度約為線寬 2.92 倍（實測像素：線寬13px、箭頭長35px、箭頭寬38px）；
  // 題目箭頭另加一點點寬容度，避免因對齊誤差或形狀差異在邊緣露出母片黑色箭頭
  const marginRatio = isMaster ? 1 : 1.12;
  const headLen = lw * 2.69 * marginRatio;
  const headHalfWidth = lw * 1.46 * marginRatio;

  function addArrow(atStart) {
    const tri = document.createElement('div');
    tri.className = 'conn-arrow';
    tri.style.position = 'absolute';
    tri.style.top = '50%';
    tri.style.transform = 'translateY(-50%)';
    tri.style.borderTop = headHalfWidth + 'px solid transparent';
    tri.style.borderBottom = headHalfWidth + 'px solid transparent';
    if (atStart) {
      tri.style.left = -headLen + 'px';
      tri.style.borderRight = headLen + 'px solid ' + color;
    } else {
      tri.style.right = -headLen + 'px';
      tri.style.borderLeft = headLen + 'px solid ' + color;
    }
    el.appendChild(tri);
  }
  if (hasHead) addArrow(true);
  if (hasTail) addArrow(false);
  return el;
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

function buildShapeEl(sh, slideNumber, isMaster, allShapes) {
  if (sh.kind === 'table') return buildTable(sh);
  if (sh.prst === 'borderCallout1') return buildCallout(allShapes ? fitCalloutToCells(sh, allShapes) : sh);
  if (sh.kind === 'cxn') return buildConnector(sh, isMaster);
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
    bg.src = 'master-bg.png';
    bg.className = 'master-bg';
    bg.draggable = false;
    this.canvas.appendChild(bg);
    const animatedIds = new Set();
    this.data.steps.forEach(group => group.forEach(e => animatedIds.add(e.id)));
    this.data.shapes.forEach(sh => {
      const el = buildShapeEl(sh, undefined, false, this.data.shapes);
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
