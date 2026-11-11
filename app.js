'use strict';
/* Chân custom của robot Hynhi: nguồn dữ liệu duy nhất cho sơ đồ đấu nối. */
const TYPE = {
  spi: ['SPI', '#4597df'],
  i2s: ['I²S', '#3cbca1'],
  i2c: ['I²C', '#d6a34d'],
  pwm: ['PWM / điều khiển', '#ae71cb'],
  gpio: ['GPIO', '#ff8197']
};

/* Mỗi hình vẽ nằm trong khung 56 x 44. */
const ART = {
  display: '<rect x="2" y="2" width="52" height="40" rx="4" fill="#161a22" stroke="#3a4558"/><rect x="9" y="6" width="38" height="30" rx="2" fill="#0a2b4d"/><rect x="12" y="9" width="32" height="24" rx="1" fill="#1a73c9"/><circle cx="28" cy="21" r="7" fill="none" stroke="#ff8197" stroke-width="2"/>',
  mic: '<rect x="4" y="4" width="48" height="36" rx="4" fill="#5a2d82"/><rect x="20" y="12" width="16" height="16" rx="2" fill="#c8cdd6"/><circle cx="28" cy="20" r="4" fill="#1d2430"/><circle cx="9" cy="9" r="2" fill="#e6c76a"/><circle cx="47" cy="35" r="2" fill="#e6c76a"/>',
  amp: '<rect x="4" y="4" width="48" height="36" rx="4" fill="#c4263f"/><rect x="18" y="13" width="20" height="14" rx="2" fill="#1d2430"/><rect x="40" y="29" width="9" height="7" fill="#2f9e5b"/><circle cx="9" cy="9" r="2" fill="#e6c76a"/><circle cx="9" cy="35" r="2" fill="#e6c76a"/>',
  servo: '<rect x="6" y="12" width="36" height="24" rx="3" fill="#2b6fd1"/><rect x="2" y="22" width="44" height="5" fill="#1f56a6"/><circle cx="44" cy="20" r="6" fill="#e9edf3"/><circle cx="44" cy="20" r="2" fill="#3a4558"/>',
  touch: '<rect x="4" y="4" width="48" height="36" rx="4" fill="#5a2d82"/><circle cx="28" cy="20" r="11" fill="none" stroke="#e6c76a" stroke-width="3"/><circle cx="28" cy="20" r="4" fill="#e6c76a"/>',
  apds: '<rect x="4" y="6" width="48" height="32" rx="4" fill="#1e5fb4"/><rect x="14" y="14" width="12" height="9" rx="1" fill="#14181f"/><rect x="30" y="14" width="10" height="9" rx="1" fill="#c8cdd6"/><circle cx="9" cy="11" r="2" fill="#e6c76a"/>',
  oled: '<rect x="2" y="4" width="52" height="36" rx="3" fill="#232a36"/><rect x="7" y="8" width="42" height="20" rx="1" fill="#05070b" stroke="#47536a"/><path d="M12 18h8l3-6 4 11 3-5h14" fill="none" stroke="#69c0ff" stroke-width="1.6"/><rect x="14" y="32" width="28" height="4" fill="#47536a"/>',
  tof: '<rect x="4" y="6" width="48" height="32" rx="4" fill="#6c3a96"/><rect x="14" y="13" width="14" height="14" rx="2" fill="#14181f"/><circle cx="21" cy="20" r="4" fill="#4a5568"/><rect x="33" y="14" width="10" height="10" rx="1" fill="#c8cdd6"/>',
  motor: '<rect x="3" y="4" width="50" height="38" rx="3" fill="#c4263f"/><rect x="14" y="8" width="26" height="22" rx="2" fill="#1d2430"/><rect x="17" y="11" width="20" height="3" fill="#59647a"/><rect x="17" y="17" width="20" height="3" fill="#59647a"/><rect x="17" y="23" width="20" height="3" fill="#59647a"/><rect x="6" y="34" width="8" height="5" fill="#2f9e5b"/><rect x="42" y="34" width="8" height="5" fill="#2f9e5b"/>'
};

const LEFT = [
  { name: 'Màn ST7789 240×240', note: 'SPI · 3,3 V', art: 'display', pins: [['SCLK', 41, 'spi'], ['MOSI', 42, 'spi'], ['DC', 46, 'gpio'], ['RST', 17, 'gpio']] },
  { name: 'Micro ICS-43434', note: 'I²S · 3,3 V', art: 'mic', pins: [['WS', 4, 'i2s'], ['SCK', 5, 'i2s'], ['SD', 6, 'i2s']] },
  { name: 'Ampli MAX98357A / PCM5102A', note: 'I²S · 5 V · loa 3 W', art: 'amp', pins: [['BCLK', 15, 'i2s'], ['LRCLK', 16, 'i2s'], ['DIN', 7, 'i2s']] },
  { name: 'Servo MG90S ×2', note: 'PWM · 5 V riêng', art: 'servo', pins: [['Cổ', 12, 'pwm'], ['Đầu', 13, 'pwm']] },
  { name: 'Nút chạm TTP223 / LED', note: 'Chạm mức thấp · LED PWM', art: 'touch', pins: [['OUT / BOOT', 0, 'gpio'], ['LED', 3, 'pwm']] }
];
const RIGHT = [
  { name: 'Cảm biến APDS-9930', note: 'I²C · 3,3 V', art: 'apds', pins: [['SDA', 18, 'i2c'], ['SCL', 9, 'i2c']] },
  { name: 'OLED phụ SSD1306', note: 'I²C · 3,3 V', art: 'oled', pins: [['SDA', 39, 'i2c'], ['SCL', 40, 'i2c']] },
  { name: 'ToF VL53L0X', note: 'I²C · hướng xuống, báo mép bàn', art: 'tof', pins: [['SDA', 10, 'i2c'], ['SCL', 11, 'i2c']] },
  { name: 'Mạch động cơ L298N', note: '4 chân điều khiển · 5–12 V', art: 'motor', pins: [['IN1', 8, 'pwm'], ['IN2', 21, 'pwm'], ['IN3', 1, 'pwm'], ['IN4', 2, 'pwm']] }
];

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(list, top, total, x) {
  const HEAD = 44, ROW = 22, PAD = 12;
  const heights = list.map(m => HEAD + m.pins.length * ROW + PAD);
  const gap = list.length > 1 ? (total - heights.reduce((a, b) => a + b, 0)) / (list.length - 1) : 0;
  let y = top;
  return list.map((m, i) => {
    const box = { m, x, y, h: heights[i], rows: m.pins.map((p, k) => ({ p, y: y + HEAD + k * ROW + ROW / 2 })) };
    y += heights[i] + gap;
    return box;
  });
}

function drawMap() {
  const host = document.getElementById('wiring-map');
  const W = 1000, TOP = 24, CARD_W = 290, BX = 395, BW = 210;
  const leftHeights = LEFT.reduce((a, m) => a + 44 + m.pins.length * 22 + 12, 0) + (LEFT.length - 1) * 16;
  const H = leftHeights + TOP * 2;
  const L = layout(LEFT, TOP, leftHeights, 12);
  const R = layout(RIGHT, TOP, leftHeights, W - 12 - CARD_W);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sơ đồ đấu nối GPIO">';
  /* bo ESP32-S3 */
  s += '<rect x="' + BX + '" y="8" width="' + BW + '" height="' + (H - 16) + '" rx="14" fill="#0f3a2c" stroke="#2f7a5c" stroke-width="2"/>';
  s += '<rect x="' + (BX + 62) + '" y="' + (H / 2 - 74) + '" width="86" height="86" rx="6" fill="#1b1f27" stroke="#4a5568"/>';
  s += '<text class="b" x="' + (BX + BW / 2) + '" y="' + (H / 2 - 22) + '" text-anchor="middle">ESP32</text>';
  s += '<text class="b" x="' + (BX + BW / 2) + '" y="' + (H / 2 - 4) + '" text-anchor="middle">S3</text>';
  s += '<text class="s" x="' + (BX + BW / 2) + '" y="' + (H / 2 + 36) + '" text-anchor="middle">N16R8 · 44 chân</text>';
  s += '<rect x="' + (BX + BW / 2 - 18) + '" y="' + (H - 22) + '" width="36" height="14" rx="3" fill="#c8cdd6"/>';
  s += '<text class="s" x="' + (BX + BW / 2) + '" y="' + (H - 28) + '" text-anchor="middle">USB</text>';
  const draw = (boxes, side) => {
    for (const b of boxes) {
      s += '<g><rect x="' + b.x + '" y="' + b.y + '" width="' + CARD_W + '" height="' + b.h + '" rx="12" fill="#0d1626" stroke="#2c3d57"/>';
      s += '<g transform="translate(' + (b.x + 10) + ' ' + (b.y + 7) + ')">' + ART[b.m.art] + '</g>';
      s += '<text class="t" x="' + (b.x + 76) + '" y="' + (b.y + 22) + '">' + esc(b.m.name) + '</text>';
      s += '<text class="s" x="' + (b.x + 76) + '" y="' + (b.y + 38) + '">' + esc(b.m.note) + '</text>';
      for (const r of b.rows) {
        const [label, gpio, type] = r.p, color = TYPE[type][1];
        const px = side === 'L' ? b.x + CARD_W : b.x;       // chân trên thẻ module
        const bx = side === 'L' ? BX : BX + BW;              // chân trên bo
        const dir = side === 'L' ? 1 : -1;
        const mid = (px + bx) / 2;
        s += '<path d="M' + px + ' ' + r.y + 'C' + mid + ' ' + r.y + ' ' + mid + ' ' + r.y + ' ' + bx + ' ' + r.y + '" stroke="' + color + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
        s += '<circle cx="' + px + '" cy="' + r.y + '" r="5" fill="' + color + '" stroke="#0a1220" stroke-width="2"/>';
        s += '<circle cx="' + bx + '" cy="' + r.y + '" r="5" fill="' + color + '" stroke="#0a1220" stroke-width="2"/>';
        const lx = side === 'L' ? b.x + CARD_W - 14 : b.x + 14;
        s += '<text class="p" x="' + lx + '" y="' + (r.y + 4) + '" text-anchor="' + (side === 'L' ? 'end' : 'start') + '">' + esc(label) + '</text>';
        const gx = bx + dir * 14;
        s += '<text class="g" x="' + gx + '" y="' + (r.y + 4) + '" text-anchor="' + (side === 'L' ? 'start' : 'end') + '">GPIO' + gpio + '</text>';
      }
      s += '</g>';
    }
  };
  draw(L, 'L'); draw(R, 'R');
  s += '</svg>';
  host.innerHTML = s;

  /* Danh sách thẻ cho màn hình hẹp. */
  const list = document.createElement('div');
  list.className = 'map-list';
  for (const m of LEFT.concat(RIGHT)) {
    const card = document.createElement('div');
    card.className = 'mod';
    card.innerHTML = '<header><svg viewBox="0 0 56 44" aria-hidden="true">' + ART[m.art] + '</svg><div><h4>' + esc(m.name) + '</h4><p>' + esc(m.note) + '</p></div></header>' +
      '<table>' + m.pins.map(([label, gpio, type]) => '<tr style="--w:' + TYPE[type][1] + '"><td>' + esc(label) + '</td><td>GPIO' + gpio + '</td></tr>').join('') + '</table>';
    list.append(card);
  }
  host.after(list);

  document.getElementById('legend').innerHTML = Object.values(TYPE).map(([name, color]) => '<span><i style="background:' + color + '"></i>' + name + '</span>').join('');
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
loadManifest();
