/* Diagnostics over USB: one button. Pick the port, read the chip (esptool-js, download mode),
   restart the robot and read its boot log to find the configuration page address. */
import { ESPLoader, Transport } from 'https://unpkg.com/esptool-js@0.6.1/bundle.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
function resetInfo() {
  document.querySelectorAll('[data-dg]').forEach(el => { el.textContent = '—'; });
  $('dg-open').hidden = true;
  $('dg-url').textContent = 'Chưa có';
  $('dg-url').dataset.found = '';
}

if (!('serial' in navigator)) {
  status('Trình duyệt này không hỗ trợ Web Serial. Hãy mở trang bằng Chrome hoặc Edge trên máy tính.', 'bad');
  $('dg-connect').disabled = true;
}

$('dg-connect').addEventListener('click', async () => {
  if (busy) return;
  let port;
  try {
    port = await navigator.serial.requestPort();
  } catch (e) {
    if (e && e.name !== 'NotFoundError') status('Không mở được cổng: ' + e.message, 'bad');
    return;
  }
  busy = true;
  $('dg-connect').disabled = true;
  resetInfo();
  const info = port.getInfo();
  const usb = info.usbVendorId === 0x303a ? 'USB gốc ESP32-S3' : info.usbVendorId === 0x1a86 ? 'USB-UART CH34x' : info.usbVendorId === 0x10c4 ? 'USB-UART CP210x' : 'USB serial';
  setInfo('port', usb + (info.usbVendorId ? ' (VID ' + info.usbVendorId.toString(16).padStart(4, '0') + ':' + (info.usbProductId || 0).toString(16).padStart(4, '0') + ')' : ''));
  const chipRead = await readChip(port);
  await readBootLog(port, !chipRead);
  busy = false;
  $('dg-connect').disabled = false;
  $('dg-connect').textContent = 'Kết nối lại';
});

/* Step 1: download mode, read the chip, then hard reset so the boot log starts from the top. */
async function readChip(port) {
  status('Đang đọc thông tin chip…', '');
  const terminal = { clean() {}, writeLine(t) { log(t); }, write(t) { log(t); } };
  let transport = null, ok = false;
  try {
    transport = new Transport(port, false);
    const loader = new ESPLoader({ transport, baudrate: 115200, terminal });
    setInfo('chip', await loader.main());
    const features = await loader.chip.getChipFeatures(loader);
    setInfo('features', features.map(f => String(f).trim()).join(', '));
    setInfo('mac', await loader.chip.readMac(loader));
    try { setInfo('crystal', (await loader.chip.getCrystalFreq(loader)) + ' MHz'); } catch { /* không bắt buộc */ }
    try {
      const id = await loader.readFlashId();
      const vendors = { 0x68: 'Boya', 0xc8: 'GigaDevice', 0xef: 'Winbond', 0x20: 'XMC', 0x5e: 'Zbit', 0x0b: 'XTX', 0x85: 'Puya', 0x1c: 'EON' };
      setInfo('flash', (await loader.detectFlashSize()) + ' · ' + (vendors[id & 0xff] || 'mã 0x' + (id & 0xff).toString(16)));
    } catch { /* không bắt buộc */ }
    await loader.after('hard_reset');
    ok = true;
  } catch (e) {
    log('Không vào được chế độ nạp: ' + (e.message || e));
  }
  try { if (transport) await transport.disconnect(); } catch { /* bỏ qua */ }
  await sleep(300);
  return ok;
}

/* Step 2: read the boot log at 115200 bps and pick out the useful lines. */
async function readBootLog(port, pulseReset) {
  const found = {};
  try {
    await port.open({ baudRate: 115200, bufferSize: 65536 });
  } catch (e) {
    status('Không mở được cổng để đọc log: ' + e.message + '. Đóng các chương trình khác đang dùng cổng này.', 'bad');
    return;
  }
  try {
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    if (pulseReset) {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleep(120);
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    }
  } catch { /* một số cổng không có tín hiệu RTS/DTR */ }
  status('Robot đang khởi động lại, đang tìm địa chỉ trang cấu hình (tối đa 45 giây)…', '');
  const reader = port.readable.getReader();
  const decoder = new TextDecoder();
  let pending = '', doneAt = 0;
  const deadline = Date.now() + 45000;
  const timer = setInterval(() => { if (Date.now() > deadline || (doneAt && Date.now() > doneAt)) reader.cancel().catch(() => {}); }, 250);
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
      if (found.url && !doneAt) doneAt = Date.now() + 4000;  // a few more seconds for RAM, camera…
    }
  } catch { /* cancelled at the deadline */ }
  clearInterval(timer);
  try { reader.releaseLock(); } catch { /* bỏ qua */ }
  try { await port.close(); } catch { /* bỏ qua */ }
  if (found.url) {
    const ap = found.url.includes('192.168.4.1');
    status(ap ? 'Robot đang phát Wi-Fi cấu hình: kết nối điện thoại hoặc máy tính vào Wi-Fi của robot rồi mở địa chỉ bên dưới.'
              : 'Đã đọc xong. Bấm “Mở trang cấu hình” để cài đặt robot.', ap ? '' : 'ok');
  } else if (found.any) {
    status('Đã đọc log nhưng robot chưa vào Wi-Fi trong 45 giây. Bấm “Kết nối lại” để thử lần nữa.', '');
  } else {
    status('Không nhận được log. Kiểm tra cáp USB dữ liệu và chọn đúng cổng của robot.', 'bad');
  }
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
  if ((m = line.match(/sta ip: ([\d.]+)/))) { setInfo('ip', m[1]); setInfo('wifi', 'Đã kết nối Wi-Fi nhà'); }
  if ((m = line.match(/Local control: (http:\/\/[\d.]+:\d+)/))) {
    found.url = m[1];
    setInfo('ip', m[1].replace(/^http:\/\//, '').replace(/:\d+$/, ''));
    const url = $('dg-url');
    url.textContent = m[1];
    url.dataset.found = '1';
    const link = $('dg-open');
    link.href = m[1] + '/';
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
