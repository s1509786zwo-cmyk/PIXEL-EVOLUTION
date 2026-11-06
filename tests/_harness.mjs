/* テスト共通ハーネス：ブラウザ相当の DOM / Canvas / localStorage を用意する。
   jsdom は /tmp/ocftest/node_modules か、通常の node_modules から読み込む。 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch (e) {
  try {
    const req = createRequire('/tmp/ocftest/package.json');
    ({ JSDOM } = req('jsdom'));
  } catch (e2) {
    throw new Error('jsdom が見つかりません（npm i jsdom が必要です）: ' + e2.message);
  }
}

export { ROOT };
export const fileURL = (rel) => 'file://' + ROOT + '/' + rel;
export const wait = (ms) => new Promise(r => setTimeout(r, ms));

export function setup() {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8')
    .replace(/<script type="module"[\s\S]*?<\/script>/, '');
  const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  const noop = () => {};

  class ID {
    constructor(a, x, y) { this.data = a instanceof Uint8ClampedArray ? a : new Uint8ClampedArray(x * y * 4); this.width = x; this.height = y; }
  }
  const pat = (W, H) => {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const c = ((x - W / 2) / (W * .3)) ** 2 + ((y - H * .45) / (H * .4)) ** 2 < 1 ? [70, 90, 160] : [200, 202, 208];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    return d;
  };
  w.HTMLCanvasElement.prototype.getContext = function () {
    const c = { canvas: this, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' };
    for (const m of ['clearRect','fillRect','strokeRect','beginPath','moveTo','lineTo','stroke','fillText',
      'setTransform','drawImage','putImageData','save','restore','fill','arc','translate','scale','rotate']) c[m] = noop;
    c.getImageData = (x, y, W, H) => ({ data: pat(W, H), width: W, height: H });
    c.createImageData = (W, H) => new ID(new Uint8ClampedArray(W * H * 4), W, H);
    c.measureText = () => ({ width: 10 });
    return c;
  };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ left:0, top:0, width:320, height:250, right:320, bottom:250 });

  // 実ブラウザで PNG が読み込めた状態を模す（アプリ側の「読み込んだふり」ではない）
  Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { get() { return true; }, configurable:true });
  Object.defineProperty(w.HTMLImageElement.prototype, 'naturalWidth', { get() { return 800; }, configurable:true });
  Object.defineProperty(w.HTMLImageElement.prototype, 'naturalHeight', { get() { return 900; }, configurable:true });

  class Img { constructor() { this.width = 800; this.height = 800; this.onload = null; }
    set src(v) { this._v = v; setTimeout(() => this.onload && this.onload(), 0); }
    get src() { return this._v; } }
  class FR { readAsDataURL() { this.result = 'data:image/png;base64,AAAA'; setTimeout(() => this.onload && this.onload(), 0); } }

  Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable:true });
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable:true });
  Object.assign(globalThis, {
    window: w, document: w.document, localStorage: w.localStorage,
    Image: Img, ImageData: ID, FileReader: FR,
    Blob: w.Blob, URL: w.URL, HTMLElement: w.HTMLElement,
    HTMLImageElement: w.HTMLImageElement,
  });
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = noop;
  w.HTMLAnchorElement.prototype.click = noop;
  w.scrollTo = noop;
  w.confirm = () => true;
  globalThis.confirm = () => true;
  w.Image = Img; w.ImageData = ID; w.FileReader = FR;
  w.devicePixelRatio = 1;
  return { dom, w, document: w.document, localStorage: w.localStorage };
}

export function assert(cond, label) {
  if (!cond) throw new Error('ASSERT: ' + label);
  console.log('  OK  ' + label);
}
