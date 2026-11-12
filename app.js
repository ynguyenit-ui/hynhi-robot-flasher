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

/* pins: [chân trên module, GPIO, loại dây]. wires: các dây còn lại [chân trên module, nối tới, loại dây]. */
const MODULES = {
  display: { name: 'Màn ST7789 240×240', note: 'SPI · 3,3 V', art: 'display', pins: [['SCL / SCLK', 41, 'spi'], ['SDA / MOSI', 42, 'spi'], ['DC', 46, 'gpio'], ['RES / RST', 17, 'gpio']], wires: [['VCC', '3V3', 'v33'], ['BLK (đèn nền)', '3V3', 'v33'], ['GND', 'GND', 'gnd']], tip: 'Màn không có chân CS thì bỏ qua; nếu có, nối CS xuống GND.' },
  mic: { name: 'Micro ICS-43434 / INMP441', note: 'I²S · 3,3 V', art: 'mic', pins: [['WS', 4, 'i2s'], ['SCK', 5, 'i2s'], ['SD', 6, 'i2s']], wires: [['VDD', '3V3', 'v33'], ['L/R', 'GND', 'gnd'], ['GND', 'GND', 'gnd']], tip: 'Chỉ cấp 3,3 V. Cấp 5 V sẽ hỏng micro.' },
  amp: { name: 'Ampli MAX98357A', note: 'I²S · 5 V · loa 4–8 Ω, 3 W', art: 'amp', pins: [['BCLK', 15, 'i2s'], ['LRC', 16, 'i2s'], ['DIN', 7, 'i2s'], ['SD', 48, 'gpio']], wires: [['Vin', '5V', 'v5'], ['GND', 'GND', 'gnd'], ['Cọc + / −', 'Hai dây loa', 'analog']], tip: 'Dây SD để robot tắt loa trong khi nhạc ra Bluetooth. Sau khi nối, chọn GPIO48 ở mục MAX98357A SD trên trang cấu hình.' },
  dac: { name: 'DAC PCM5102A', note: 'I²S · dùng chung dây với ampli', art: 'dac', pins: [['BCK', 15, 'i2s'], ['LCK', 16, 'i2s'], ['DIN', 7, 'i2s']], wires: [['VIN', '5V', 'v5'], ['GND', 'GND', 'gnd'], ['SCK', 'GND', 'gnd'], ['XSMT', '3V3 (bỏ tắt tiếng)', 'v33']], tip: 'BCK, LCK, DIN nối song song với BCLK, LRC, DIN của MAX98357A.' },
  kcx: { name: 'Bluetooth KCX_BT_EMITTER', note: 'Phát nhạc ra loa Bluetooth · 5 V', art: 'kcx', pins: [], wires: [['AUDIO_L (IN_L)', 'PCM5102A · LOUT', 'analog'], ['AUDIO_R (IN_R)', 'PCM5102A · ROUT', 'analog'], ['AGND', 'PCM5102A · AGND', 'gnd'], ['LINK', 'GPIO47', 'gpio'], ['+5V', '5V', 'v5'], ['PGND', 'GND', 'gnd']], tip: 'Dây LINK báo cho robot biết loa Bluetooth đã kết nối; sau khi nối, chọn GPIO47 ở mục KCX LINK trên trang cấu hình. Giữ nút PAIR trên module để ghép loa.' },
  servo: { name: 'Servo MG90S ×2', note: 'PWM · nguồn 5 V riêng', art: 'servo', pins: [['Cổ · dây cam', 12, 'pwm'], ['Đầu · dây cam', 13, 'pwm']], wires: [['Dây đỏ', '5V riêng (≥ 2 A)', 'v5'], ['Dây nâu', 'GND chung', 'gnd']], tip: 'Không lấy 5 V cho servo từ chân 5V của ESP32: robot dễ tự khởi động lại.' },
  touch: { name: 'Nút chạm TTP223 và LED', note: 'Chạm · LED trạng thái', art: 'touch', pins: [['TTP223 · I/O', 0, 'gpio'], ['LED · chân +', 3, 'pwm']], wires: [['TTP223 · VCC', '3V3', 'v33'], ['TTP223 · GND', 'GND', 'gnd'], ['LED · chân −', 'GND qua trở 220 Ω', 'gnd']], tip: 'GPIO0 cũng là nút BOOT: không chạm vào nút khi vừa cấp nguồn.' },
  apds: { name: 'Cảm biến APDS-9930', note: 'I²C · 3,3 V · vẫy tay, lại gần', art: 'apds', pins: [['SDA', 18, 'i2c'], ['SCL', 9, 'i2c']], wires: [['VCC', '3V3', 'v33'], ['GND', 'GND', 'gnd']], tip: 'Chân VL nối 3V3 nếu module tách riêng nguồn LED hồng ngoại.' },
  oled: { name: 'OLED phụ SSD1306 0,96″', note: 'I²C · 3,3 V', art: 'oled', pins: [['SDA', 39, 'i2c'], ['SCL', 40, 'i2c']], wires: [['VCC', '3V3', 'v33'], ['GND', 'GND', 'gnd']], tip: '' },
  tof: { name: 'Đo khoảng cách VL53L0X', note: 'I²C · 3,3 V · hướng xuống mặt bàn', art: 'tof', pins: [['SDA', 10, 'i2c'], ['SCL', 11, 'i2c']], wires: [['VIN', '3V3', 'v33'], ['GND', 'GND', 'gnd']], tip: 'Gắn chĩa xuống để robot biết mép bàn và khi bị nhấc lên.' },
  motor: { name: 'Mạch động cơ L298N', note: '4 chân điều khiển · 2 bánh xe', art: 'motor', pins: [['IN1', 8, 'pwm'], ['IN2', 21, 'pwm'], ['IN3', 1, 'pwm'], ['IN4', 2, 'pwm']], wires: [['+12V', 'Pin 6–12 V', 'v5'], ['GND', 'GND chung', 'gnd'], ['OUT1 · OUT2', 'Động cơ trái', 'analog'], ['OUT3 · OUT4', 'Động cơ phải', 'analog']], tip: 'Giữ nguyên jumper ENA và ENB trên mạch.' }
};
const LEFT = ['display', 'mic', 'amp', 'servo', 'touch'];
const RIGHT = ['dac', 'apds', 'oled', 'tof', 'motor'];   /* KCX được vẽ ngay dưới PCM5102A */
const ORDER = ['display', 'mic', 'amp', 'dac', 'kcx', 'servo', 'touch', 'apds', 'oled', 'tof', 'motor'];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const art = id => '<svg viewBox="0 0 112 80" aria-hidden="true">' + ART[MODULES[id].art] + '</svg>';

function drawMap() {
  const host = document.getElementById('wiring-map');
  const W = 1100, TOP = 22, CARD_W = 316, BW = 196, BX = (W - BW) / 2, HEAD = 62, ROW = 26, PAD = 10, GAP = 16, LINK = 52;
  const kcxRows = MODULES.kcx.wires.slice(0, 3);
  const size = id => HEAD + MODULES[id].pins.length * ROW + PAD + (id === 'dac' ? LINK + HEAD + kcxRows.length * ROW + PAD : 0);
  const natural = list => list.reduce((a, id) => a + size(id), 0) + (list.length - 1) * GAP;
  const inner = Math.max(natural(LEFT), natural(RIGHT));
  const H = inner + TOP * 2;
  const place = (list, x) => {
    const gap = list.length > 1 ? (inner - list.reduce((a, id) => a + size(id), 0)) / (list.length - 1) : 0;
    let y = TOP;
    return list.map(id => { const box = { id, x, y, h: HEAD + MODULES[id].pins.length * ROW + PAD }; y += size(id) + gap; return box; });
  };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sơ đồ đấu nối GPIO">';
  /* Bo ESP32-S3 */
  s += '<rect x="' + BX + '" y="6" width="' + BW + '" height="' + (H - 12) + '" rx="12" fill="#12382c" stroke="#2f7a5c" stroke-width="2"/>';
  s += '<rect x="' + (BX + BW / 2 - 25) + '" y="' + (H / 2 - 70) + '" width="50" height="104" rx="6" fill="#c9ced6" stroke="#8b97aa"/>';
  s += '<rect x="' + (BX + BW / 2 - 20) + '" y="' + (H / 2 - 62) + '" width="40" height="60" rx="3" fill="#1b1f27"/>';
  s += '<text class="b" x="' + (BX + BW / 2) + '" y="' + (H / 2 - 36) + '" text-anchor="middle">ESP</text>';
  s += '<text class="b" x="' + (BX + BW / 2) + '" y="' + (H / 2 - 16) + '" text-anchor="middle">32</text>';
  s += '<text class="s" x="' + (BX + BW / 2) + '" y="' + (H / 2 + 54) + '" text-anchor="middle">S3</text>';
  s += '<rect x="' + (BX + BW / 2 - 20) + '" y="' + (H - 24) + '" width="40" height="16" rx="3" fill="#c9ced6"/>';
  s += '<text class="s" x="' + (BX + BW / 2) + '" y="' + (H - 30) + '" text-anchor="middle">USB</text>';
  const card = (id, x, y, h) => {
    const m = MODULES[id];
    let o = '<rect x="' + x + '" y="' + y + '" width="' + CARD_W + '" height="' + h + '" rx="10" fill="#111722" stroke="#33405a"/>';
    o += '<g transform="translate(' + (x + 10) + ' ' + (y + 8) + ') scale(.6)">' + ART[m.art] + '</g>';
    o += '<text class="t" x="' + (x + 88) + '" y="' + (y + 26) + '">' + esc(m.name) + '</text>';
    o += '<text class="s" x="' + (x + 88) + '" y="' + (y + 44) + '">' + esc(m.note) + '</text>';
    return o;
  };
  const draw = (boxes, side) => {
    for (const b of boxes) {
      const m = MODULES[b.id];
      s += card(b.id, b.x, b.y, b.h);
      m.pins.forEach(([label, gpio, type], k) => {
        const y = b.y + HEAD + k * ROW + ROW / 2, color = TYPE[type][1];
        const px = side === 'L' ? b.x + CARD_W : b.x, bx = side === 'L' ? BX : BX + BW;
        s += '<path d="M' + px + ' ' + y + 'H' + bx + '" stroke="' + color + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
        s += '<circle cx="' + px + '" cy="' + y + '" r="5.5" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
        s += '<circle cx="' + bx + '" cy="' + y + '" r="5.5" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
        s += '<text class="p" x="' + (side === 'L' ? b.x + CARD_W - 16 : b.x + 16) + '" y="' + (y + 4.5) + '" text-anchor="' + (side === 'L' ? 'end' : 'start') + '">' + esc(label) + '</text>';
        const gx = side === 'L' ? bx + 12 : bx - 12, gw = 62;
        s += '<rect x="' + (side === 'L' ? gx - 4 : gx - gw + 4) + '" y="' + (y - 10) + '" width="' + gw + '" height="20" rx="5" fill="#0c111b" stroke="' + color + '"/>';
        s += '<text class="g" x="' + (side === 'L' ? gx + gw / 2 - 4 : gx - gw / 2 + 4) + '" y="' + (y + 4.5) + '" text-anchor="middle">GPIO' + gpio + '</text>';
      });
      if (b.id === 'dac') {
        /* PCM5102A -> KCX: ba dây analog nối thẳng hai module, không về ESP32. */
        const ky = b.y + b.h + LINK, kh = HEAD + kcxRows.length * ROW + PAD, cx = b.x + CARD_W / 2;
        [['LOUT', 'analog', -34], ['ROUT', 'analog', 0], ['AGND', 'gnd', 34]].forEach(([name, type, dx]) => {
          const color = TYPE[type][1];
          s += '<path d="M' + (cx + dx) + ' ' + (b.y + b.h) + 'V' + ky + '" stroke="' + color + '" stroke-width="3.2" stroke-linecap="round"/>';
          s += '<circle cx="' + (cx + dx) + '" cy="' + (b.y + b.h) + '" r="5.5" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
          s += '<circle cx="' + (cx + dx) + '" cy="' + ky + '" r="5.5" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
        });
        s += '<text class="s" x="' + (cx + 56) + '" y="' + (b.y + b.h + LINK / 2 + 4) + '">LOUT · ROUT · AGND</text>';
        s += '<text class="s" x="' + (cx - 56) + '" y="' + (b.y + b.h + LINK / 2 + 4) + '" text-anchor="end">dây âm thanh</text>';
        s += card('kcx', b.x, ky, kh);
        kcxRows.forEach(([label, target, type], k) => {
          const y = ky + HEAD + k * ROW + ROW / 2, color = TYPE[type][1];
          s += '<circle cx="' + (b.x + 22) + '" cy="' + y + '" r="5" fill="' + color + '"/>';
          s += '<text class="p" x="' + (b.x + 36) + '" y="' + (y + 4.5) + '">' + esc(label) + '</text>';
          s += '<text class="s" x="' + (b.x + CARD_W - 14) + '" y="' + (y + 4.5) + '" text-anchor="end">← ' + esc(target.replace('PCM5102A · ', '')) + '</text>';
        });
      }
    }
  };
  draw(place(LEFT, 12), 'L');
  draw(place(RIGHT, W - 12 - CARD_W), 'R');
  s += '</svg>';
  host.innerHTML = s;
  document.getElementById('legend').innerHTML = WIRE_LEGEND.map(k => '<span><i style="background:' + TYPE[k][1] + '"></i>' + TYPE[k][0] + '</span>').join('');
}

/* Bảng đấu dây từng module: mỗi dòng là một sợi dây, gồm cả nguồn và GND. */
function drawTables() {
  const list = document.getElementById('wiring-tables');
  list.innerHTML = '';
  for (const id of ORDER) {
    const m = MODULES[id];
    const row = (label, target, type, strong) => '<tr style="--w:' + TYPE[type][1] + '"><td>' + esc(label) + '</td><td class="wire" aria-hidden="true"><i></i></td><td' + (strong ? ' class="gp"' : '') + '>' + esc(target) + '</td></tr>';
    const card = document.createElement('article');
    card.className = 'mod';
    card.id = 'mod-' + id;
    card.innerHTML = '<header><div class="pic" data-photo="' + id + '">' + art(id) + '</div><div><h4>' + esc(m.name) + '</h4><p>' + esc(m.note) + '</p></div></header>' +
      '<table><thead><tr><th>Chân trên module</th><th></th><th>Nối tới</th></tr></thead><tbody>' +
      m.pins.map(([label, gpio, type]) => row(label, 'GPIO' + gpio, type, true)).join('') +
      m.wires.map(([label, target, type]) => row(label, target, type, false)).join('') + '</tbody></table>' +
      (m.tip ? '<p class="tip">' + esc(m.tip) + '</p>' : '');
    list.append(card);
    /* Có ảnh thật images/modules/<id>.jpg thì dùng ảnh thay cho hình vẽ. */
    const photo = new Image();
    photo.alt = m.name;
    photo.onload = () => { const box = card.querySelector('.pic'); box.replaceChildren(photo); box.classList.add('photo'); };
    photo.src = 'images/modules/' + id + '.jpg';
  }
}

function loadManifest() {
  const facts = document.getElementById('facts');
  fetch('firmware/custom/manifest.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(async manifest => {
    const build = manifest.builds[0];
    const items = [manifest.version, build.chipFamily, build.parts.length + ' phần nạp'];
    try {
      const head = await fetch('firmware/custom/' + build.parts.find(p => p.path === 'xiaozhi.bin').path, { method: 'HEAD' });
      const size = Number(head.headers.get('content-length'));
      if (size) items.push('Ứng dụng ' + (size / 1048576).toFixed(1) + ' MB');
    } catch { /* kích thước chỉ để tham khảo */ }
    facts.innerHTML = items.map(t => '<li>' + esc(t) + '</li>').join('');
  }).catch(() => { facts.innerHTML = '<li class="warn">Chưa tìm thấy gói firmware.</li>'; });
}

drawMap();
drawTables();
loadManifest();
