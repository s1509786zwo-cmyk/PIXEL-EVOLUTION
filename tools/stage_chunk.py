# -*- coding: utf-8 -*-
"""google_drive/ に保存されたファイルを Drive ID をファイル名にして恒久保存する。"""
import json, os, sys, shutil, hashlib, struct

CHUNKS = json.load(open('tools/download_chunks.json', encoding='utf-8'))
DEST = 'assets/enemies/source'
os.makedirs(DEST, exist_ok=True)

def png_info(path):
    with open(path, 'rb') as f:
        d = f.read(33)
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    w, h = struct.unpack('>II', d[16:24])
    return {'w': w, 'h': h, 'bitdepth': d[24], 'colortype': d[25]}

def main(label):
    ch = next(c for c in CHUNKS if c['label'] == label)
    out = []
    for name, fid in ch['map'].items():
        src = os.path.join('google_drive', name)
        if not os.path.exists(src):
            out.append({'id': fid, 'name': name, 'ok': False, 'reason': '保存先にファイルがありません'})
            continue
        data = open(src, 'rb').read()
        ext = '.zip' if name.endswith('.zip') else '.png'
        dst = os.path.join(DEST, fid + ext)
        shutil.move(src, dst)
        info = png_info(dst) if ext == '.png' else None
        rec = {'id': fid, 'name': name, 'ok': True, 'size': len(data),
               'sha256': hashlib.sha256(data).hexdigest(), 'file': dst}
        if ext == '.png':
            rec['png'] = info
            rec['ok'] = bool(info)
            if not info: rec['reason'] = 'PNG ヘッダを読み取れません'
        out.append(rec)
    with open(f'tools/stage_{label}.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    bad = [x for x in out if not x['ok']]
    print(label, 'staged', len(out) - len(bad), '/', len(out), 'bad', bad)

if __name__ == '__main__':
    main(sys.argv[1])
