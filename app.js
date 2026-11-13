'use strict';
/* Chân custom của robot Hynhi: nguồn dữ liệu duy nhất cho sơ đồ và bảng đấu dây. */
const TYPE = {
  spi: ['SPI', '#4597df'],
  i2s: ['I²S', '#3cbca1'],
  i2c: ['I²C', '#d6a34d'],
  pwm: ['PWM / điều khiển', '#ae71cb'],
  gpio: ['GPIO', '#ff8197'],
  analog: ['Âm thanh analog', '#a3d95b'],
  v5: ['Nguồn 5 V', '#ef4444'],
  v33: ['Nguồn 3,3 V', '#f59e0b'],
  gnd: ['GND', '#8b97aa']
};
const WIRE_LEGEND = ['spi', 'i2s', 'i2c', 'pwm', 'gpio', 'analog', 'v5', 'v33', 'gnd'];

/* Hình vẽ module trong khung 112 x 80. Chấm vàng là hàng chân hàn. */
const pads = (n, y, x0 = 14, step = 0) => { const s = step || (84 / Math.max(1, n - 1)); let o = ''; for (let i = 0; i < n; i++) o += '<circle cx="' + (x0 + i * s).toFixed(1) + '" cy="' + y + '" r="2.6" fill="#e6c76a" stroke="#8a6d1f" stroke-width=".8"/>'; return o; };
const ART = {
  display: '<rect x="6" y="2" width="100" height="76" rx="5" fill="#1b4fa0" stroke="#0e2f66"/>' + pads(8, 9, 20, 10.3) + '<rect x="14" y="16" width="84" height="56" rx="3" fill="#0b0d12" stroke="#3a4558"/><rect x="18" y="20" width="76" height="48" rx="2" fill="#10203a"/><circle cx="44" cy="44" r="7" fill="#7fe0ff"/><circle cx="68" cy="44" r="7" fill="#7fe0ff"/><path d="M48 58q8 6 16 0" stroke="#7fe0ff" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  mic: '<rect x="20" y="6" width="72" height="68" rx="6" fill="#5a2d82" stroke="#3b1a5a"/>' + pads(3, 15, 34, 22) + pads(3, 66, 34, 22) + '<rect x="42" y="27" width="28" height="26" rx="3" fill="#cfd4dc" stroke="#7a8496"/><circle cx="56" cy="40" r="5" fill="#1d2430"/>',
  amp: '<rect x="14" y="6" width="84" height="68" rx="5" fill="#b3202f" stroke="#7d1420"/>' + pads(7, 14, 22, 11.3) + '<rect x="38" y="28" width="24" height="20" rx="2" fill="#15181e"/><rect x="30" y="56" width="52" height="14" rx="2" fill="#2f9e5b" stroke="#1f6e3f"/><circle cx="44" cy="63" r="3.4" fill="#cfd4dc"/><circle cx="68" cy="63" r="3.4" fill="#cfd4dc"/><rect x="70" y="30" width="14" height="8" rx="1" fill="#d9a441"/>',
  dac: '<rect x="8" y="6" width="96" height="68" rx="4" fill="#3d2a7a" stroke="#281a55"/>' + pads(6, 14, 18, 11) + '<rect x="36" y="28" width="26" height="18" rx="2" fill="#15181e"/><rect x="80" y="24" width="24" height="30" rx="3" fill="#1b1e25" stroke="#4a5568"/><circle cx="96" cy="39" r="6" fill="#0a0c10" stroke="#8b97aa"/>' + pads(5, 66, 16, 11) + '<rect x="14" y="30" width="10" height="6" rx="1" fill="#d9a441"/><rect x="14" y="40" width="10" height="6" rx="1" fill="#d9a441"/>',
  kcx: '<rect x="10" y="10" width="92" height="60" rx="4" fill="#12583f" stroke="#0b3b2a"/>' + pads(6, 18, 20, 9) + pads(5, 62, 20, 9) + '<rect x="30" y="30" width="26" height="22" rx="2" fill="#15181e"/><path d="M70 28h20v5h-14v5h14v5h-14v5h14v5h-20" fill="none" stroke="#d9a441" stroke-width="2.2"/><circle cx="20" cy="42" r="3" fill="#4aa3ff"/>',
  servo: '<rect x="18" y="26" width="62" height="42" rx="4" fill="#2b6fd1" stroke="#1b4c96"/><rect x="8" y="38" width="82" height="7" rx="2" fill="#1f56a6"/><circle cx="13" cy="41.5" r="2" fill="#0a0e15"/><circle cx="85" cy="41.5" r="2" fill="#0a0e15"/><rect x="50" y="14" width="24" height="14" rx="3" fill="#2b6fd1" stroke="#1b4c96"/><rect x="40" y="8" width="52" height="7" rx="3.5" fill="#f1f3f6" stroke="#9aa5b5"/><circle cx="62" cy="11.5" r="2.4" fill="#59647a"/><path d="M80 60c14 2 18 8 22 14" stroke="#8a4a1c" stroke-width="2.4" fill="none"/><path d="M80 63c12 2 16 8 19 13" stroke="#d93a3a" stroke-width="2.4" fill="none"/><path d="M80 66c10 2 13 7 16 11" stroke="#e8a52c" stroke-width="2.4" fill="none"/>',
  touch: '<rect x="22" y="8" width="68" height="64" rx="5" fill="#b3202f" stroke="#7d1420"/>' + pads(3, 64, 40, 16) + '<circle cx="56" cy="34" r="19" fill="none" stroke="#e6c76a" stroke-width="3"/><circle cx="56" cy="34" r="8" fill="#e6c76a"/>',
  apds: '<rect x="16" y="12" width="80" height="56" rx="5" fill="#1e5fb4" stroke="#123f7c"/>' + pads(5, 60, 28, 14) + '<rect x="40" y="22" width="14" height="12" rx="1.5" fill="#14181f"/><rect x="58" y="22" width="14" height="12" rx="1.5" fill="#d7dbe2"/><circle cx="24" cy="20" r="3" fill="#0a0e15" stroke="#cfd4dc"/><circle cx="88" cy="20" r="3" fill="#0a0e15" stroke="#cfd4dc"/>',
  oled: '<rect x="8" y="6" width="96" height="68" rx="4" fill="#1d2f52" stroke="#12203a"/>' + pads(4, 13, 38, 12) + '<rect x="14" y="20" width="84" height="42" rx="2" fill="#05070b" stroke="#47536a"/><path d="M22 44h14l5-12 7 22 6-10h36" fill="none" stroke="#69c0ff" stroke-width="2"/><rect x="36" y="64" width="40" height="6" rx="1" fill="#47536a"/>',
  tof: '<rect x="18" y="14" width="76" height="52" rx="5" fill="#6c3a96" stroke="#472368"/>' + pads(6, 58, 28, 11.2) + '<rect x="44" y="22" width="24" height="16" rx="2" fill="#14181f"/><circle cx="51" cy="30" r="3.4" fill="#4a5568"/><circle cx="61" cy="30" r="3.4" fill="#7a8496"/><circle cx="26" cy="22" r="3" fill="#0a0e15" stroke="#cfd4dc"/><circle cx="86" cy="22" r="3" fill="#0a0e15" stroke="#cfd4dc"/>',
  motor: '<rect x="8" y="4" width="96" height="72" rx="4" fill="#b3202f" stroke="#7d1420"/><rect x="34" y="10" width="44" height="34" rx="2" fill="#15181e"/><path d="M38 16h36M38 22h36M38 28h36M38 34h36" stroke="#59647a" stroke-width="2.4"/><rect x="12" y="24" width="14" height="22" rx="1.5" fill="#2f6fd1"/><rect x="86" y="24" width="14" height="22" rx="1.5" fill="#2f6fd1"/><rect x="14" y="58" width="30" height="14" rx="1.5" fill="#2f6fd1"/>' + pads(6, 65, 54, 8.6) + '<circle cx="84" cy="52" r="4" fill="#15181e" stroke="#59647a"/>'
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let firmwareDir = 'custom';
function loadManifest() {
  const facts = document.getElementById('facts');
  const dir = firmwareDir;
  fetch('firmware/' + dir + '/manifest.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(async manifest => {
    if (dir !== firmwareDir) return;
    const build = manifest.builds[0];
    const items = [manifest.version, build.chipFamily, build.parts.length + ' phần nạp'];
    try {
      const head = await fetch('firmware/' + dir + '/' + build.parts.find(p => p.path === 'xiaozhi.bin').path, { method: 'HEAD' });
      const size = Number(head.headers.get('content-length'));
      if (size) items.push('Ứng dụng ' + (size / 1048576).toFixed(1) + ' MB');
    } catch { /* kích thước chỉ để tham khảo */ }
    facts.innerHTML = items.map(t => '<li>' + esc(t) + '</li>').join('');
  }).catch(() => { facts.innerHTML = '<li class="warn">Chưa tìm thấy gói firmware.</li>'; });
}

/* Firmware choice (desk robot / Robot Camera): drives the installer and the wiring diagram below it. */
function selectFirmware(dir) {
  firmwareDir = dir === 'cam' ? 'cam' : 'custom';
  document.querySelectorAll('[data-fw-pick]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fwPick === firmwareDir)));
  document.getElementById('installer').setAttribute('manifest', 'firmware/' + firmwareDir + '/manifest.json');
  document.getElementById('wiring-title').textContent = 'Sơ đồ đấu nối · ' + (firmwareDir === 'cam' ? 'Robot Camera' : 'Robot để bàn');
  try { localStorage.setItem('hynhi-fw', firmwareDir); } catch { /* chỉ để nhớ lựa chọn */ }
  drawWiring(firmwareDir);
  loadManifest();
}
document.querySelectorAll('[data-fw-pick]').forEach(b => b.addEventListener('click', () => selectFirmware(b.dataset.fwPick)));

/* Two views: #firmware (installer + wiring diagram) and #diag. #wiring scrolls to the diagram. */
function showView() {
  const hash = location.hash.slice(1);
  const id = hash === 'diag' ? 'diag' : 'firmware';
  ['firmware', 'diag'].forEach(v => { document.getElementById(v).hidden = v !== id; });
  document.querySelectorAll('.tabs a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'page' : 'false'));
  if (hash === 'wiring') document.getElementById('wiring').scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showView);

/* Light / dark theme: follows the system until the viewer picks one. */
const themeButton = document.getElementById('theme');
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function syncThemeIcon() { themeButton.querySelector('use').setAttribute('href', isDark() ? '#i-sun' : '#i-moon'); }
themeButton.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('hynhi-theme', next); } catch { /* chỉ để nhớ lựa chọn */ }
  syncThemeIcon();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeIcon);

/* wiring.js loads after this file, so start once every script has run. */
window.addEventListener('DOMContentLoaded', () => {
  let savedFw = '';
  try { savedFw = localStorage.getItem('hynhi-fw') || ''; } catch { /* không có bộ nhớ trình duyệt */ }
  selectFirmware(savedFw);
  syncThemeIcon();
  showView();
});