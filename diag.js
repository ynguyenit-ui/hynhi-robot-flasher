/* Chẩn đoán qua USB: đọc thông tin chip (esptool-js, chế độ nạp) và đọc log khởi động để lấy địa chỉ trang cấu hình. */
import { ESPLoader, Transport } from 'https://unpkg.com/esptool-js@0.6.1/bundle.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let port = null;
let busy = false;

const logBox = $('dg-log');
const MAX_LOG_LINES = 400;
const logLines = [];
function log(line) {
  logLines.push(line);
  if (logLines.length > MAX_LOG_LINES) logLines.splice(0, logLines.length - MAX_LOG_LINES);
  logBox.textContent = logLines.join('\n');
  logBox.scrollTop = logBox.scrollHeight;
}
function status(text, tone) {
  const el = $('dg-status');
  el.textContent = text;
  el.dataset.tone = tone || '';
}
function setInfo(key, value) {
  const el = document.querySelector('[data-dg="' + key + '"]');
  if (el && value) el.textContent = value;
}
function setBusy(on) {
  busy = on;
  for (const id of ['dg-connect', 'dg-chip', 'dg-ip']) $(id).disabled = on || (id !== 'dg-connect' && !port);
}

if (!('serial' in navigator)) {
  status('Trình duyệt này không hỗ trợ Web Serial. Hãy mở trang bằng Chrome hoặc Edge trên máy tính.', 'bad');
  for (const id of ['dg-connect', 'dg-chip', 'dg-ip']) $(id).disabled = true;
}

$('dg-connect').addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    const info = port.getInfo();
    const usb = info.usbVendorId === 0x303a ? 'USB gốc ESP32-S3' : info.usbVendorId === 0x1a86 ? 'USB-UART CH34x' : info.usbVendorId === 0x10c4 ? 'USB-UART CP210x' : 'USB serial';
    setInfo('port', usb + (info.usbVendorId ? ' (VID ' + info.usbVendorId.toString(16).padStart(4, '0') + ':' + (info.usbProductId || 0).toString(16).padStart(4, '0') + ')' : ''));
    status('Đã chọn cổng. Bấm “Đọc thông tin chip” hoặc “Đọc địa chỉ IP”.', 'ok');
  } catch (e) {
    if (e && e.name !== 'NotFoundError') status('Không mở được cổng: ' + e.message, 'bad');
  }
  setBusy(false);
});

/* Bước 1: vào chế độ nạp, đọc chip, rồi khởi động lại và đọc log. */
$('dg-chip').addEventListener('click', async () => {
  if (!port || busy) return;
  setBusy(true);
  status('Đang kết nối chế độ nạp…', '');
  const terminal = { clean() {}, writeLine(t) { log(t); }, write(t) { log(t); } };
  let transport = null;
  try {
    transport = new Transport(port, false);
    const loader = new ESPLoader({ transport, baudrate: 115200, terminal });
    const chip = await loader.main();
    setInfo('chip', chip);
    const features = await loader.chip.getChipFeatures(loader);
    setInfo('features', features.map(f => String(f).trim()).join(', '));
    setInfo('mac', await loader.chip.readMac(loader));
    try { setInfo('crystal', (await loader.chip.getCrystalFreq(loader)) + ' MHz'); } catch { /* không bắt buộc */ }
    try {
      const id = await loader.readFlashId();
      const vendors = { 0x68: 'Boya', 0xc8: 'GigaDevice', 0xef: 'Winbond', 0x20: 'XMC', 0x5e: 'Zbit', 0x0b: 'XTX', 0x85: 'Puya', 0x1c: 'EON' };
      const size = await loader.detectFlashSize();
      setInfo('flash', size + ' · ' + (vendors[id & 0xff] || 'mã 0x' + (id & 0xff).toString(16)) + ' (ID ' + id.toString(16) + ')');
    } catch { /* không bắt buộc */ }
    status('Đã đọc chip. Đang khởi động lại robot để đọc log…', 'ok');
    await loader.after('hard_reset');
  } catch (e) {
    status('Không vào được chế độ nạp: ' + (e.message || e) + '. Thử giữ nút BOOT, bấm RST rồi thả BOOT.', 'bad');
    try { if (transport) await transport.disconnect(); } catch { /* bỏ qua */ }
    setBusy(false);
    return;
  }
  try { await transport.disconnect(); } catch { /* bỏ qua */ }
  await sleep(300);
  await readBootLog(false);
});

$('dg-ip').addEventListener('click', () => { if (port && !busy) { setBusy(true); readBootLog($('dg-reset').checked); } });

/* Bước 2: đọc log 115200 bps, tách các dòng có ích. */
async function readBootLog(reset) {
  const found = {};
  try {
    await port.open({ baudRate: 115200, bufferSize: 65536 });
  } catch (e) {
    status('Không mở được cổng để đọc log: ' + e.message, 'bad');
    setBusy(false);
    return;
  }
  try {
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    if (reset) {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(120);
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    }
  } catch { /* một số cổng không có tín hiệu RTS/DTR */ }
  status(reset ? 'Đã khởi động lại robot, đang đọc log (tối đa 45 giây)…' : 'Đang đọc log (tối đa 45 giây)…', '');
  const reader = port.readable.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const deadline = Date.now() + 45000;
  let doneAt = 0;
  const timer = setInterval(() => {
    if (Date.now() > deadline || (doneAt && Date.now() > doneAt)) reader.cancel().catch(() => {});
  }, 250);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const raw of lines) {
        const line = raw.replace(/\x1b\[[0-9;]*m/g, '');
        if (!line.trim()) continue;
        log(line);
        parse(line, found);
      }
      if (found.url && !doneAt) doneAt = Date.now() + 4000;  // đọc thêm vài giây để lấy RAM, camera…
    }
  } catch { /* bị huỷ khi hết giờ */ }
  clearInterval(timer);
  try { reader.releaseLock(); } catch { /* bỏ qua */ }
  try { await port.close(); } catch { /* bỏ qua */ }
  if (found.url) {
    const ap = found.url.includes('192.168.4.1');
    status(ap ? 'Robot đang phát Wi-Fi cấu hình. Kết nối điện thoại vào Wi-Fi của robot rồi mở địa chỉ bên dưới.'
              : 'Đã tìm thấy trang cấu hình của robot.', ap ? '' : 'ok');
  } else if (Object.keys(found).length) {
    status('Đã đọc log nhưng chưa thấy địa chỉ IP: robot có thể chưa kết nối Wi-Fi. Bấm lại để thử.', '');
  } else {
    status('Không nhận được log. Kiểm tra cáp USB dữ liệu, chọn đúng cổng, hoặc bật “Khởi động lại robot”.', 'bad');
  }
  setBusy(false);
}

function parse(line, found) {
  let m;
  if ((m = line.match(/App version:\s*(\S+)/))) setInfo('version', m[1]);
  if ((m = line.match(/DeskRobotBoard: Board: (.+?)(?:, flash=|$)/))) setInfo('board', m[1]);
  if ((m = line.match(/Boot reset reason: ([^(]+)/))) setInfo('reset', m[1].trim());
  if ((m = line.match(/Detected (\S+) camera/))) setInfo('camera', m[1]);
  if ((m = line.match(/RAM nội: còn=(\d+)/))) setInfo('ram', Math.round(Number(m[1]) / 1024) + ' KB trống');
  if ((m = line.match(/PSRAM còn=(\d+)/))) setInfo('psram', (Number(m[1]) / 1048576).toFixed(1) + ' MB trống');
  if ((m = line.match(/Access Point started with SSID (.+)$/))) setInfo('wifi', 'Đang phát Wi-Fi cấu hình: ' + m[1].trim());
  if ((m = line.match(/sta ip: ([\d.]+)/))) { setInfo('ip', m[1]); setInfo('wifi', 'Đã kết nối Wi-Fi nhà'); found.ip = m[1]; }
  if ((m = line.match(/Local control: (http:\/\/[\d.]+:\d+)/))) {
    found.url = m[1];
    const ip = m[1].replace(/^http:\/\//, '').replace(/:\d+$/, '');
    setInfo('ip', ip);
    const link = $('dg-open');
    link.href = m[1] + '/';
    link.textContent = 'Mở trang cấu hình ' + m[1];
    link.hidden = false;
  }
  if (/^[IWE] \(\d+\)/.test(line)) found.any = true;
}

$('dg-clear').addEventListener('click', () => { logLines.length = 0; logBox.textContent = ''; });
$('dg-copy').addEventListener('click', () => {
  const text = logLines.join('\n');
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => status('Đã chép log.', 'ok')).catch(() => {
    const range = document.createRange(); range.selectNodeContents(logBox);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    status('Nhấn Ctrl+C để chép log.', '');
  });
});
