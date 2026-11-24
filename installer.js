/* Hynhi installer: esptool-js over Web Serial, faster than the generic installer.
   - Update mode keeps settings and skips every part that is already identical on the chip (MD5 check),
     so a normal update only writes the app.
   - Full install erases the chip first.
   - High baud for USB-UART bridges (falls back automatically), compressed writes, live steps/speed/ETA. */
import { ESPLoader, Transport } from 'https://unpkg.com/esptool-js@0.5.7/bundle.js';

const $ = id => document.getElementById(id);
const root = $('installer');
if (!root) throw new Error('no installer');

const STEPS = [
  ['port', 'Chọn cổng USB'],
  ['chip', 'Nhận diện chip'],
  ['download', 'Tải firmware'],
  ['compare', 'So sánh phần đã có'],
  ['erase', 'Xoá bộ nhớ'],
  ['write', 'Ghi firmware'],
  ['reboot', 'Khởi động lại'],
];
const cache = new Map();  // url -> Uint8Array, so a retry does not download again

/* ---------- UI ---------- */
const panel = $('fl-panel');
const stepList = $('fl-steps');
const bar = $('fl-bar');
const barText = $('fl-bar-text');
const stat = $('fl-stat');
const logBox = $('fl-log');
const msg = $('fl-msg');
const go = $('fl-go');
const modeInputs = [...document.querySelectorAll('input[name="fl-mode"]')];
const baudSel = $('fl-baud');

stepList.innerHTML = STEPS.map(([id, label]) => `<li data-step="${id}"><i></i><span>${label}</span><small></small></li>`).join('');
function step(id, state, note = '') {
  const li = stepList.querySelector(`[data-step="${id}"]`);
  if (!li) return;
  li.dataset.state = state;  // wait | run | done | skip | fail
  li.querySelector('small').textContent = note;
}
function resetSteps(mode) {
  STEPS.forEach(([id]) => step(id, 'wait'));
  if (mode === 'update') step('erase', 'skip', 'giữ cài đặt');
  else step('compare', 'skip', 'cài mới');
}
function progress(pct, text) {
  bar.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
  bar.parentElement.setAttribute('aria-valuenow', String(Math.round(pct)));
  barText.textContent = text;
}
function say(text, tone = '') { msg.textContent = text; msg.dataset.tone = tone; }
const log = line => { logBox.textContent += line + '\n'; logBox.scrollTop = logBox.scrollHeight; };
const terminal = { clean() {}, writeLine: log, write: t => { logBox.textContent += t; } };
const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
const fmtTime = s => !isFinite(s) || s < 0 ? '' : s >= 60 ? Math.floor(s / 60) + ' phút ' + Math.round(s % 60) + ' giây' : Math.round(s) + ' giây';

/* ---------- MD5 (Web Crypto has none); used only to skip parts that are already on the chip ---------- */
function md5(bytes) {
  const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const len = bytes.length, padLen = ((len + 8) >> 6) + 1 << 6;
  const buf = new Uint8Array(padLen); buf.set(bytes); buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, (len * 8) >>> 0, true); dv.setUint32(padLen - 4, Math.floor(len / 2 ** 29), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      const s = S[(i >> 4) * 4 + (i & 3)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => [0, 8, 16, 24].map(sh => ((v >>> sh) & 255).toString(16).padStart(2, '0')).join('')).join('');
}
function bstr(u8) {  // esptool-js 0.5 takes binary strings
  let s = '';
  for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return s;
}
function pad4(u8) {
  if (u8.length % 4 === 0) return u8;
  const out = new Uint8Array(u8.length + 4 - u8.length % 4).fill(0xff); out.set(u8); return out;
}

/* ---------- download with progress ---------- */
async function fetchPart(url, onBytes) {
  if (cache.has(url)) { onBytes(cache.get(url).length); return cache.get(url); }
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error('Không tải được ' + url.split('/').pop() + ' (HTTP ' + r.status + ')');
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !total) { const b = new Uint8Array(await r.arrayBuffer()); onBytes(b.length); cache.set(url, b); return b; }
  const out = new Uint8Array(total); let got = 0;
  const reader = r.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; out.set(value, got); got += value.length; onBytes(got); }
  const b = got === total ? out : out.slice(0, got);
  cache.set(url, b);
  return b;
}

function friendly(e) {
  const t = String(e && e.message || e);
  if (/No port selected|cancel/i.test(t)) return 'Bạn chưa chọn cổng USB.';
  if (/Failed to open|already open|Access denied|NetworkError/i.test(t)) return 'Cổng USB đang bị chương trình khác dùng (Arduino, idf.py monitor, trang khác…). Đóng chương trình đó rồi thử lại.';
  if (/Failed to connect|Timeout|timed out|sync/i.test(t)) return 'Không vào được chế độ nạp. Giữ nút BOOT, bấm rồi thả RST/EN, rồi bấm nạp lại. Kiểm tra cáp USB có truyền dữ liệu.';
  if (/doesn't fit/i.test(t)) return 'Firmware lớn hơn bộ nhớ flash của bo này. Kiểm tra đúng loại bo (16 MB).';
  return t;
}

/* ---------- flashing ---------- */
let busy = false;
async function run() {
  if (busy) return;
  if (!('serial' in navigator)) { say('Trình duyệt này chưa hỗ trợ Web Serial. Hãy mở bằng Chrome hoặc Edge trên máy tính.', 'bad'); return; }
  const mode = (modeInputs.find(i => i.checked) || {}).value || 'update';
  const manifestUrl = root.getAttribute('manifest');
  const dir = manifestUrl.replace(/manifest\.json$/, '');
  busy = true; go.disabled = true; panel.hidden = false; logBox.textContent = '';
  resetSteps(mode); progress(0, 'Đang bắt đầu…'); say('');
  let transport = null, loader = null;
  const t0 = performance.now();
  try {
    /* 1. port: must be requested inside the click */
    step('port', 'run');
    const port = await navigator.serial.requestPort({});
    const info = port.getInfo ? port.getInfo() : {};
    const native = info.usbVendorId === 0x303a;  // ESP32-S3 built-in USB: baud does not matter
    step('port', 'done', native ? 'USB của ESP32-S3' : 'USB-UART');

    /* 2. chip, stub, fast baud (fallback to slower if the bridge refuses) */
    step('chip', 'run', 'đang kết nối…');
    const wanted = Number(baudSel.value) || 921600;
    let chipName = '';
    for (const baud of [...new Set([wanted, 460800, 115200])]) {
      try {
        transport = new Transport(port, false);
        loader = new ESPLoader({ transport, baudrate: baud, romBaudrate: 115200, terminal, debugLogging: false });
        chipName = await loader.main();
        log('Tốc độ: ' + baud + ' baud');
        break;
      } catch (e) {
        log('Kết nối ở ' + baud + ' baud lỗi: ' + (e.message || e));
        try { await transport.disconnect(); } catch { /* đã đóng */ }
        transport = null; loader = null;
        if (native || baud === 115200) throw e;
      }
    }
    const manifest = await (await fetch(manifestUrl, { cache: 'no-cache' })).json();
    const build = manifest.builds[0];
    const family = String(build.chipFamily || '').replace(/[-\s]/g, '').toUpperCase();
    if (family && !chipName.replace(/[-\s]/g, '').toUpperCase().startsWith(family)) {
      throw new Error(`Bo đang cắm là ${chipName}, nhưng firmware này dành cho ${build.chipFamily}. Hãy chọn đúng loại robot.`);
    }
    step('chip', 'done', chipName.split('(')[0].trim());

    /* 3. download every part (cached for retries) */
    step('download', 'run');
    const parts = build.parts.map(p => ({ ...p, url: dir + p.path }));
    const sizes = await Promise.all(parts.map(p => fetch(p.url, { method: 'HEAD', cache: 'no-cache' })
      .then(r => Number(r.headers.get('content-length')) || 0).catch(() => 0)));
    const totalDl = sizes.reduce((a, b) => a + b, 0) || 1;
    const got = parts.map(() => 0);
    for (let i = 0; i < parts.length; i++) {
      parts[i].data = pad4(await fetchPart(parts[i].url, n => {
        got[i] = n; const sum = got.reduce((a, b) => a + b, 0);
        progress(sum / totalDl * 100, 'Đang tải ' + fmtSize(sum) + ' / ' + fmtSize(totalDl));
      }));
    }
    step('download', 'done', fmtSize(parts.reduce((a, p) => a + p.data.length, 0)));

    /* 4. update: skip parts already identical on the chip */
    let todo = parts;
    if (mode === 'update') {
      step('compare', 'run');
      todo = [];
      for (const p of parts) {
        progress(0, 'Đang so sánh ' + p.path + '…');
        let same = false;
        try { same = (await loader.flashMd5sum(p.offset, p.data.length)).toLowerCase() === md5(p.data); } catch (e) { log('Không so sánh được ' + p.path + ': ' + e.message); }
        log(p.path + (same ? ': giống trên chip, bỏ qua' : ': cần ghi'));
        if (!same) todo.push(p);
      }
      const skipped = parts.length - todo.length;
      step('compare', 'done', skipped ? `bỏ qua ${skipped}/${parts.length} phần không đổi` : 'ghi tất cả');
    }

    /* 5. erase (full install only) */
    if (mode === 'full') {
      step('erase', 'run', 'khoảng 15–40 giây…');
      progress(100, 'Đang xoá toàn bộ bộ nhớ flash…');
      bar.classList.add('busy');
      await loader.eraseFlash();
      bar.classList.remove('busy');
      step('erase', 'done');
    }

    /* 6. write */
    if (!todo.length) {
      step('write', 'skip', 'robot đã có đúng firmware này');
    } else {
      step('write', 'run', 'đang nén…');
      const total = todo.reduce((a, p) => a + p.data.length, 0);
      const before = todo.map((_, i) => todo.slice(0, i).reduce((a, p) => a + p.data.length, 0));
      const start = performance.now();
      progress(0, 'Đang nén dữ liệu…');
      await loader.writeFlash({
        fileArray: todo.map(p => ({ data: bstr(p.data), address: p.offset })),
        flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep', eraseAll: false, compress: true,
        reportProgress: (index, written, size) => {
          const done = before[index] + (size ? todo[index].data.length * written / size : 0);
          const secs = (performance.now() - start) / 1000, rate = done / Math.max(secs, 0.1);
          progress(done / total * 100, `Đang ghi ${todo[index].path} · ${Math.round(done / total * 100)}%`);
          stat.textContent = `${fmtSize(done)} / ${fmtSize(total)} · ${(rate / 1024).toFixed(0)} KB/s · còn ${fmtTime((total - done) / rate)}`;
          step('write', 'run', `${index + 1}/${todo.length}: ${todo[index].path}`);
        },
      });
      step('write', 'done', fmtSize(total));
    }

    /* 7. reboot */
    step('reboot', 'run');
    try { await loader.after('hard_reset'); } catch { /* một số bo cần bấm RST */ }
    step('reboot', 'done');
    progress(100, 'Hoàn tất');
    stat.textContent = 'Tổng thời gian ' + fmtTime((performance.now() - t0) / 1000);
    say('Nạp xong! Robot đang khởi động lại. Nếu màn hình chưa sáng sau 30 giây, bấm nút RST trên bo.', 'ok');
  } catch (e) {
    const running = stepList.querySelector('[data-state="run"]');
    if (running) step(running.dataset.step, 'fail');
    bar.classList.remove('busy');
    say(friendly(e), 'bad');
    log('LỖI: ' + (e && e.stack || e));
  } finally {
    try { if (transport) await transport.disconnect(); } catch { /* đã đóng */ }
    busy = false; go.disabled = false;
  }
}

go.addEventListener('click', run);
modeInputs.forEach(i => i.addEventListener('change', () => {
  document.querySelectorAll('.fl-mode label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
}));
$('fl-log-copy')?.addEventListener('click', () => navigator.clipboard?.writeText(logBox.textContent).catch(() => {}));
if (!('serial' in navigator)) say('Trình duyệt này chưa hỗ trợ Web Serial. Hãy mở bằng Chrome hoặc Edge trên máy tính.', 'bad');
