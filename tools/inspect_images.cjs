/* 全 Drive PNG を実際にデコードし、寸法・アルファ・画素統計を記録して
   目視確認用のコンタクトシートを作る（画像の改変は一切しない）。 */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('/tmp/ocftest/node_modules/@napi-rs/canvas');

const recs = JSON.parse(fs.readFileSync('tools/stage_all.json', 'utf8'))
  .filter(r => r.ok && r.file.endsWith('.png'));
const inv = JSON.parse(fs.readFileSync('tools/drive_inventory.json', 'utf8'));
const byId = Object.fromEntries(inv.map(x => [x.id, x]));

const report = [];
(async () => {
  for (const r of recs) {
    const meta = byId[r.id] || {};
    try {
      const img = await loadImage(r.file);
      const c = createCanvas(img.width, img.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;
      let transparent = 0, opaque = 0, colorful = 0, lum = 0, n = 0;
      // 全画素を走査（1枚あたり最大 約230万画素）
      for (let i = 0; i < d.length; i += 4 * 17) {
        const a = d[i + 3], R = d[i], G = d[i + 1], B = d[i + 2];
        n++;
        if (a < 16) transparent++;
        if (a > 240) opaque++;
        if (Math.max(R, G, B) - Math.min(R, G, B) > 24 && a > 40) colorful++;
        lum += (R + G + B) / 3;
      }
      report.push({ ...r, kind: meta.kind, folder: meta.folder, folder_id: meta.folder_id,
        decoded: true, w: img.width, h: img.height,
        transparentRatio: +(transparent / n).toFixed(3), opaqueRatio: +(opaque / n).toFixed(3),
        colorfulRatio: +(colorful / n).toFixed(3), meanLum: Math.round(lum / n) });
    } catch (err) {
      report.push({ ...r, kind: meta.kind, folder: meta.folder, decoded: false, reason: String(err) });
    }
  }
  fs.writeFileSync('tools/image_decode_report.json', JSON.stringify(report, null, 1));

  // コンタクトシート：kind ごとに 1 シート、4 カラーを横並び（最大 8 kind/シート）
  const groups = {};
  for (const r of report) (groups[r.kind] ||= []).push(r);
  const kinds = Object.keys(groups).sort();
  const sheets = [];
  const cellW = 190, cellH = 200, cols = 4, labelH = 22;
  for (let s = 0; s < Math.ceil(kinds.length / 7); s++) {
    const slice = kinds.slice(s * 7, s * 7 + 7);
    const rows = slice.length;
    const cv = createCanvas(cellW * cols, (cellH + labelH) * rows);
    const cx = cv.getContext('2d');
    cx.fillStyle = '#20232c'; cx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < rows; y++) {
      const kind = slice[y];
      const list = groups[kind].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      // 同名・同 kind の 4 カラー（装備バリエーションが多い種は先頭4枚＋残りは別シート）
      const picks = list.slice(0, cols);
      for (let x = 0; x < cols; x++) {
        const rec = picks[x];
        if (!rec) continue;
        const img = await loadImage(rec.file);
        const scale = Math.min((cellW - 8) / img.width, (cellH - 8) / img.height);
        const w = img.width * scale, h = img.height * scale;
        cx.fillStyle = '#000'; cx.fillRect(x * cellW + 2, y * (cellH + labelH) + 2, cellW - 4, cellH - 4);
        cx.drawImage(img, x * cellW + (cellW - w) / 2, y * (cellH + labelH) + (cellH - h) / 2, w, h);
        cx.fillStyle = '#f0f0f0'; cx.font = '11px sans-serif';
        cx.fillText(`${kind} / ${rec.name.slice(0, 22)}`, x * cellW + 4, y * (cellH + labelH) + cellH + 15);
      }
    }
    const out = `tools/contact_${s + 1}.png`;
    fs.writeFileSync(out, cv.toBuffer('image/png'));
    sheets.push({ file: out, kinds: slice });
  }
  fs.writeFileSync('tools/contact_sheets.json', JSON.stringify(sheets, null, 1));
  console.log('decoded', report.filter(r => r.decoded).length, '/', report.length);
  console.log('failed', report.filter(r => !r.decoded));
  console.log('sheets', sheets.map(x => x.file));
  console.log('kinds', kinds.join(','));
  console.log('transparent ratio range', Math.min(...report.map(r => r.transparentRatio)), Math.max(...report.map(r => r.transparentRatio)));
})();
