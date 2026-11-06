/* 装備バリエーション 16 枚を全枚ずつ目視確認するコンタクトシート */
const fs = require('fs');
const { createCanvas, loadImage } = require('/tmp/ocftest/node_modules/@napi-rs/canvas');
const rep = JSON.parse(fs.readFileSync('tools/image_decode_report.json', 'utf8'));
(async () => {
  for (const kind of ['goblin', 'skeleton', 'greater']) {
    const list = rep.filter(r => r.kind === kind).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
    const cols = 4, cw = 205, ch = 210, lh = 24;
    const rows = Math.ceil(list.length / cols);
    const cv = createCanvas(cw*cols, (ch+lh)*rows);
    const cx = cv.getContext('2d');
    cx.fillStyle = '#20232c'; cx.fillRect(0,0,cv.width,cv.height);
    for (let i=0;i<list.length;i++) {
      const r = list[i], x=(i%cols)*cw, y=Math.floor(i/cols)*(ch+lh);
      const img = await loadImage(r.file);
      const sc = Math.min((cw-8)/img.width,(ch-8)/img.height);
      const w=img.width*sc,h=img.height*sc;
      cx.fillStyle='#000'; cx.fillRect(x+2,y+2,cw-4,ch-4);
      cx.drawImage(img,x+(cw-w)/2,y+(ch-h)/2,w,h);
      cx.fillStyle='#f0f0f0';cx.font='10px sans-serif';
      cx.fillText(r.name.slice(0,28),x+4,y+ch+16);
    }
    const out=`tools/variants_${kind}.png`;
    fs.writeFileSync(out,cv.toBuffer('image/png'));
    console.log(out,list.length,'files');
  }
})();
