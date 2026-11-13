'use strict';
/* Wiring diagrams for both firmwares, drawn on the real board headers.
   Uses TYPE, ART, pads and esc from app.js. A module whose pins sit on both headers, or on
   non-adjacent rows, is drawn as several cards so that every wire stays a straight line. */

ART.strip = '<rect x="4" y="26" width="104" height="28" rx="3" fill="#15181e" stroke="#3a4558"/>' +
  [0, 1, 2, 3, 4, 5, 6, 7].map(i => '<rect x="' + (9 + i * 12.4) + '" y="33" width="9" height="9" rx="1.5" fill="#f1f3f6"/><circle cx="' + (13.5 + i * 12.4) + '" cy="37.5" r="2.4" fill="' + ['#ff5c7a', '#ffb547', '#f5e663', '#3ddc97', '#4aa3ff', '#a77bff', '#ff7ad9', '#ffffff'][i] + '"/>').join('') + pads(4, 48, 18, 25);
ART.led = '<circle cx="56" cy="30" r="16" fill="#3ddc97" opacity=".9"/><rect x="40" y="30" width="32" height="18" fill="#3ddc97" opacity=".9"/><rect x="36" y="46" width="40" height="6" rx="2" fill="#cfd4dc"/><path d="M46 52v22M66 52v18" stroke="#cfd4dc" stroke-width="3.5"/>';

const isGpio = name => /^\d+$/.test(name);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const BOARDS = {
  custom: {
    title: 'HYNHI ROBOT · ESP32-S3 CUSTOM GPIO',
    subtitle: 'Robot để bàn · bo ESP32-S3 N16R8 44 chân · mọi chân đổi được trong tab Chân GPIO của trang cấu hình',
    boardName: 'ESP32-S3 N16R8', boardSub: 'DevKit 44 chân', camera: false,
    left: ['3V3', '3V3', 'RST', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5V', 'GND'],
    right: ['GND', '43', '44', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'GND', 'GND'],
    usable: [...range(0, 18), 21, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48],
    kind: n => (n >= 35 && n <= 37) ? ['PSRAM', '#b91c1c'] : (n === 19 || n === 20) ? ['USB', '#7c3aed'] : null,
    ports: [['USB', 'GPIO19/20'], ['UART', 'GPIO43/44']],
    rail33: 'Đường 3,3 V từ chân 3V3 của bo: micro, màn hình, APDS-9930, VL53L0X, OLED, TTP223',
    rail5: 'bo · ampli · DAC · KCX',
    powerNote: 'Servo cần nguồn 5 V riêng ≥ 2 A; mạch L298N cấp pin 6–12 V riêng cho động cơ. Mọi module nối GND chung với bo.',
    modules: [
      { short: 'Màn ST7789', snote: 'SPI · 240×240 · 3,3 V', art: 'display', pins: [['SCL / SCLK', 41, 'spi'], ['SDA / MOSI', 42, 'spi'], ['DC', 46, 'gpio'], ['RES / RST', 17, 'gpio']] },
      { short: 'Micro INMP441', snote: 'I²S · 3,3 V · L/R nối GND', art: 'mic', pins: [['WS', 4, 'i2s'], ['SCK', 5, 'i2s'], ['SD', 6, 'i2s']] },
      { short: 'Âm thanh I²S', snote: 'MAX98357A + PCM5102A song song', art: 'amp', pins: [['DIN', 7, 'i2s'], ['BCLK / BCK', 15, 'i2s'], ['LRC / LCK', 16, 'i2s']] },
      { short: 'MAX98357A · SD', snote: 'tắt loa trong khi phát Bluetooth', art: 'amp', pins: [['SD', 48, 'gpio']] },
      { short: 'Bluetooth KCX', snote: 'LINK báo đã nối loa', art: 'kcx', pins: [['LINK', 47, 'gpio']] },
      { short: 'Servo MG90S ×2', snote: 'PWM · 5 V riêng', art: 'servo', pins: [['Cổ · dây cam', 12, 'pwm'], ['Đầu · dây cam', 13, 'pwm']] },
      { short: 'Nút chạm TTP223', snote: '3,3 V · cũng là nút BOOT', art: 'touch', pins: [['I/O', 0, 'gpio']] },
      { short: 'LED trạng thái', snote: 'chân − qua trở 220 Ω xuống GND', art: 'led', pins: [['LED +', 3, 'pwm']] },
      { short: 'APDS-9930', snote: 'I²C · vẫy tay, lại gần', art: 'apds', pins: [['SDA', 18, 'i2c'], ['SCL', 9, 'i2c']] },
      { short: 'OLED SSD1306', snote: 'I²C · 3,3 V', art: 'oled', pins: [['SDA', 39, 'i2c'], ['SCL', 40, 'i2c']] },
      { short: 'VL53L0X', snote: 'I²C · chĩa xuống mặt bàn', art: 'tof', pins: [['SDA', 10, 'i2c'], ['SCL', 11, 'i2c']] },
      { short: 'L298N · 2 bánh N20', snote: 'giữ jumper ENA / ENB', art: 'motor', pins: [['IN1', 8, 'pwm'], ['IN2', 21, 'pwm'], ['IN3', 1, 'pwm'], ['IN4', 2, 'pwm']] }
    ]
  },
  cam: {
    title: 'HYNHI ROBOT CAMERA · ESP32-S3 CUSTOM GPIO',
    subtitle: 'Robot Camera · bo ESP32-S3 CAM N16R8 · camera OV3660 / OV5640 tự nhận · mọi chân đổi được trong tab Chân GPIO',
    boardName: 'ESP32-S3 CAM', boardSub: 'N16R8', camera: true,
    left: ['3V3', 'EN', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5V'],
    right: ['43', '44', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'GND'],
    usable: [0, 1, 2, 3, 4, 5, 14, 19, 20, 21, 38, 39, 40, 41, 42, 45, 46, 47, 48],
    kind: n => ((n >= 6 && n <= 13) || (n >= 15 && n <= 18)) ? ['camera', '#c2410c'] : (n >= 35 && n <= 37) ? ['PSRAM', '#b91c1c'] : (n === 19 || n === 20) ? ['USB', '#7c3aed'] : (n === 43 || n === 44) ? ['UART', '#be185d'] : null,
    ports: [['USB', 'GPIO19/20'], ['UART', 'GPIO43/44']],
    rail33: 'Đường 3,3 V từ chân 3V3 của bo: micro, màn hình, VL53L0X, OLED, TTP223',
    rail5: 'bo · ampli · DAC · KCX · LED',
    powerNote: 'Servo cần nguồn 5 V riêng ≥ 2 A. Mọi module nối GND chung với bo. GPIO19/20 là cổng USB gốc: dùng cho module thì nạp qua cổng UART (CH343).',
    modules: [
      { short: 'I²C: VL53L0X + OLED', snote: 'chung bus camera · OLED 0x3D', art: 'tof', pins: [['SDA', 4, 'i2c'], ['SCL', 5, 'i2c']] },
      { short: 'LED WS2812', snote: '8 bóng · 5 V', art: 'strip', pins: [['DIN', 3, 'gpio']] },
      { short: 'Servo MG90S ×2', snote: 'PWM · 5 V riêng', art: 'servo', pins: [['Đầu · dây cam', 46, 'pwm'], ['Cổ · dây cam', 14, 'pwm']] },
      { short: 'Micro INMP441', snote: 'I²S · 3,3 V · L/R nối GND', art: 'mic', pins: [['SD', 1, 'i2s'], ['SCK', 2, 'i2s'], ['WS', 42, 'i2s']] },
      { short: 'Âm thanh I²S', snote: 'MAX98357A · PCM5102A · KCX', art: 'amp', pins: [['KCX · LINK', 41, 'gpio'], ['LRC / LCK', 40, 'i2s'], ['BCLK / BCK', 39, 'i2s'], ['DIN', 38, 'i2s']] },
      { short: 'Nút chạm TTP223', snote: '3,3 V · cũng là nút BOOT', art: 'touch', pins: [['I/O', 0, 'gpio']] },
      { short: 'Màn ST7789', snote: 'SPI · 240×240 · 3,3 V', art: 'display', pins: [['DC', 45, 'gpio'], ['RES / RST', 48, 'gpio'], ['SCL / SCLK', 47, 'spi'], ['SDA / MOSI', 21, 'spi']] }
    ]
  }
};

function drawWiring(id) {
  const host = document.getElementById('wiring-map');
  const B = BOARDS[id] || BOARDS.custom;
  const W = 1500, P = 52, Y0 = 250, BX = 610, BW = 280, HX = [BX + 26, BX + BW - 26], CHIP = 104, CARD_W = 420, PADY = 23;
  const rows = Math.max(B.left.length, B.right.length);
  const rowY = i => Y0 + i * P, BOARD_BOTTOM = rowY(rows - 1) + 110, PWR = BOARD_BOTTOM + 40, H = PWR + 300;
  const RED = '#ef4444', AMBER = '#f59e0b';
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sơ đồ đấu nối ' + esc(B.title) + '">';
  /* Title banner */
  s += '<rect x="0" y="0" width="' + W + '" height="150" rx="16" fill="#0f1420"/>';
  s += '<image href="images/logo.png" x="24" y="14" width="122" height="122" preserveAspectRatio="xMidYMid meet"/>';
  s += '<text class="ch" x="170" y="72">' + esc(B.title) + '</text>';
  s += '<text class="cs2" x="172" y="108">' + esc(B.subtitle) + '</text>';
  s += '<circle cx="182" cy="132" r="7" fill="#3ddc97"/><text class="cs" x="196" y="137">Chấm tròn: chân đang nối module</text>';
  s += '<circle cx="470" cy="132" r="7" fill="none" stroke="#e7ecf3" stroke-width="2.4"/><text class="cs" x="484" y="137">Chấm rỗng: chân dùng được, đang trống</text>';
  /* 3.3 V rail */
  s += '<path d="M' + (BX - 10 - CHIP) + ' ' + (Y0 - 50) + 'H' + (BX + BW + 10 + CHIP) + '" stroke="' + AMBER + '" stroke-width="3" stroke-dasharray="10 6"/>';
  s += '<text class="cs" x="' + (BX + BW / 2) + '" y="' + (Y0 - 58) + '" text-anchor="middle" style="fill:' + AMBER + '">' + esc(B.rail33) + '</text>';
  /* Board */
  s += '<rect x="' + BX + '" y="' + (Y0 - 36) + '" width="' + BW + '" height="' + (BOARD_BOTTOM - Y0 + 36) + '" rx="14" fill="#16181d" stroke="#3a4558" stroke-width="2"/>';
  const top = Y0 - 20;
  if (B.camera) {
    s += '<rect x="' + (BX + 70) + '" y="' + top + '" width="140" height="180" rx="6" fill="#c9ced6" stroke="#8b97aa"/>';
    s += '<text class="b" x="' + (BX + 140) + '" y="' + (top + 24) + '" text-anchor="middle" style="fill:#1b1f27">ESP32-S3</text>';
    s += '<circle cx="' + (BX + 140) + '" cy="' + (top + 96) + '" r="40" fill="#0b0d12" stroke="#59647a" stroke-width="4"/><circle cx="' + (BX + 140) + '" cy="' + (top + 96) + '" r="22" fill="#1d2a4a"/><circle cx="' + (BX + 132) + '" cy="' + (top + 88) + '" r="6" fill="#7fa8ff" opacity=".7"/>';
    s += '<rect x="' + (BX + 128) + '" y="' + (top + 136) + '" width="24" height="90" fill="#d9822b"/>';
    s += '<rect x="' + (BX + 80) + '" y="' + (top + 226) + '" width="120" height="34" rx="3" fill="#2a2f3a" stroke="#59647a"/>';
    s += '<text class="s" x="' + (BX + 140) + '" y="' + (top + 286) + '" text-anchor="middle">Camera OV3660 / OV5640</text>';
  } else {
    s += '<rect x="' + (BX + 72) + '" y="' + (top + 14) + '" width="136" height="220" rx="6" fill="#c9ced6" stroke="#8b97aa"/>';
    s += '<path d="M' + (BX + 84) + ' ' + (top + 28) + 'h16v14h14v-14h14v14h14v-14h14v14h14v-14h16" fill="none" stroke="#6b7385" stroke-width="3"/>';
    s += '<text class="b" x="' + (BX + 140) + '" y="' + (top + 90) + '" text-anchor="middle" style="fill:#1b1f27">ESP32-S3</text>';
    s += '<text class="s" x="' + (BX + 140) + '" y="' + (top + 112) + '" text-anchor="middle" style="fill:#3a4558">WROOM-1 N16R8</text>';
  }
  s += '<text class="b" x="' + (BX + 140) + '" y="' + (rowY(12) + 4) + '" text-anchor="middle">' + esc(B.boardName) + '</text>';
  s += '<text class="s" x="' + (BX + 140) + '" y="' + (rowY(12) + 22) + '" text-anchor="middle">' + esc(B.boardSub) + '</text>';
  [['RST', BX + 96], ['BOOT', BX + 184]].forEach(([t, x]) => { s += '<rect x="' + (x - 14) + '" y="' + (rowY(15) - 14) + '" width="28" height="28" rx="4" fill="#2a2f3a" stroke="#59647a"/><circle cx="' + x + '" cy="' + rowY(15) + '" r="7" fill="#59647a"/><text class="s" x="' + x + '" y="' + (rowY(15) + 30) + '" text-anchor="middle">' + t + '</text>'; });
  B.ports.forEach(([t, sub], k) => { const x = BX + 96 + k * 88; s += '<rect x="' + (x - 24) + '" y="' + (BOARD_BOTTOM - 32) + '" width="48" height="26" rx="8" fill="#c9ced6" stroke="#8b97aa"/><text class="b" x="' + x + '" y="' + (BOARD_BOTTOM - 40) + '" text-anchor="middle">' + t + '</text><text class="s" x="' + x + '" y="' + (BOARD_BOTTOM - 56) + '" text-anchor="middle">' + sub + '</text>'; });
  /* Pin -> module */
  const used = {};
  B.modules.forEach(m => m.pins.forEach(([label, gpio, type]) => { used[gpio] = { m, label, type }; }));
  const powerKind = name => name === '3V3' ? ['3V3', AMBER] : name === '5V' ? ['5V', RED] : name === 'GND' ? ['GND', '#8b97aa'] : (name === 'EN' || name === 'RST') ? ['RST', '#8b97aa'] : null;
  [B.left, B.right].forEach((hdr, side) => hdr.forEach((name, i) => {
    const y = rowY(i), hx = HX[side], gpio = isGpio(name) ? Number(name) : -1;
    const kind = gpio >= 0 ? B.kind(gpio) : powerKind(name), u = used[name];
    const usable = gpio >= 0 && B.usable.includes(gpio);
    const cx = side === 0 ? BX - 10 - CHIP : BX + BW + 10;
    const color = u ? TYPE[u.type][1] : kind ? kind[1] : '#33405a';
    s += '<circle cx="' + hx + '" cy="' + y + '" r="7" fill="#0b0d12" stroke="#e6c76a" stroke-width="2.4"/>';
    s += '<text class="s" x="' + (side === 0 ? hx + 14 : hx - 14) + '" y="' + (y + 4) + '" text-anchor="' + (side === 0 ? 'start' : 'end') + '">' + name + '</text>';
    s += '<path d="M' + hx + ' ' + y + 'H' + (side === 0 ? BX - 10 : BX + BW + 10) + '" stroke="' + color + '" stroke-width="2.4" opacity="' + (u || kind ? 1 : .5) + '"/>';
    s += '<rect x="' + cx + '" y="' + (y - 15) + '" width="' + CHIP + '" height="30" rx="7" fill="' + (u ? '#0c111b' : kind ? kind[1] : '#0c111b') + '" stroke="' + color + '" stroke-width="1.6"/>';
    s += '<text class="cg" x="' + (cx + CHIP / 2) + '" y="' + (y + 5.5) + '" text-anchor="middle" style="fill:' + (u ? '#3ddc97' : kind ? '#fff' : '#e7ecf3') + '">' + (gpio >= 0 ? 'GPIO' + name : name) + '</text>';
    if (kind && gpio >= 0 && !usable) s += '<text class="s" x="' + (side === 0 ? cx - 10 : cx + CHIP + 10) + '" y="' + (y + 4) + '" text-anchor="' + (side === 0 ? 'end' : 'start') + '" style="fill:' + kind[1] + '">' + kind[0] + '</text>';
    if (usable && !u) {
      const dx = side === 0 ? cx - 12 : cx + CHIP + 12;
      s += '<circle cx="' + dx + '" cy="' + y + '" r="7" fill="none" stroke="#e7ecf3" stroke-width="2.4"/>';
      s += '<text class="s" x="' + (side === 0 ? dx - 14 : dx + 14) + '" y="' + (y + 4) + '" text-anchor="' + (side === 0 ? 'end' : 'start') + '">trống' + (kind ? ' · ' + kind[0] : '') + '</text>';
    }
  }));
  /* Module cards: one card per run of adjacent rows on one header. */
  const cards = [];
  B.modules.forEach(m => {
    const placed = m.pins.map(p => { const name = String(p[1]); const side = B.left.includes(name) ? 0 : 1; return { p, side, row: (side ? B.right : B.left).indexOf(name) }; })
      .filter(x => x.row >= 0).sort((a, b) => a.side - b.side || a.row - b.row);
    let run = [];
    placed.forEach((x, k) => {
      if (run.length && (x.side !== run[0].side || x.row !== run[run.length - 1].row + 1)) { cards.push({ m, run }); run = []; }
      run.push(x);
      if (k === placed.length - 1) cards.push({ m, run });
    });
  });
  cards.forEach(({ m, run }) => {
    const side = run[0].side, ys = run.map(x => rowY(x.row));
    const ctop = Math.min(...ys) - PADY, h = Math.max(...ys) + PADY - ctop;
    const x = side === 0 ? 18 : W - 18 - CARD_W, inner = side === 0 ? x + CARD_W : x;
    const chipEdge = side === 0 ? BX - 10 - CHIP : BX + BW + 10 + CHIP;
    s += '<rect x="' + x + '" y="' + ctop + '" width="' + CARD_W + '" height="' + h + '" rx="10" fill="#111722" stroke="#33405a"/>';
    const scale = Math.min(.8, (h - 10) / 80), artX = side === 0 ? x + 10 : x + CARD_W - 10 - 112 * scale;
    s += '<g transform="translate(' + artX + ' ' + (ctop + (h - 80 * scale) / 2) + ') scale(' + scale.toFixed(3) + ')">' + ART[m.art] + '</g>';
    const tx = side === 0 ? x + 20 + 112 * scale : x + CARD_W - 20 - 112 * scale, anchor = side === 0 ? 'start' : 'end';
    const single = run.length === 1, ty = single ? ctop + h / 2 - 2 : ctop + 28;
    s += '<text class="ct" x="' + tx + '" y="' + ty + '" text-anchor="' + anchor + '">' + esc(m.short) + '</text>';
    s += '<text class="cs" x="' + tx + '" y="' + (ty + (single ? 17 : 20)) + '" text-anchor="' + anchor + '">' + esc(m.snote) + '</text>';
    run.forEach(({ p: [label, , type] }, k) => {
      const y = ys[k], color = TYPE[type][1];
      s += '<path d="M' + inner + ' ' + y + 'H' + chipEdge + '" stroke="' + color + '" stroke-width="3.4" stroke-linecap="round"/>';
      s += '<circle cx="' + inner + '" cy="' + y + '" r="6" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
      s += '<circle cx="' + chipEdge + '" cy="' + y + '" r="7" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
      s += '<text class="cp" x="' + (side === 0 ? inner - 16 : inner + 16) + '" y="' + (y + 5.5) + '" text-anchor="' + (side === 0 ? 'end' : 'start') + '">' + esc(label) + '</text>';
    });
  });
  /* Power chain */
  const py = PWR + 70, bw = 250, gap = 60, x0 = 40;
  const boxes = [['Pin Li-ion 3,7 V', '14250 / 18650', '#1e5fb4'], ['Mạch sạc + tăng áp 5 V', 'TP4056 + MT3608 hoặc IP5306', '#12583f'], ['Công tắc nguồn', 'gạt 2 vị trí', '#2a2f3a'], ['Tụ lọc 470–1000 µF', '16–25 V, sát chân 5V', '#3d2a7a']];
  s += '<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + RED + '"/></marker></defs>';
  s += '<rect x="18" y="' + PWR + '" width="' + (W - 36) + '" height="150" rx="12" fill="#111722" stroke="#33405a"/>';
  s += '<text class="ct" x="40" y="' + (PWR + 32) + '">Nguồn</text>';
  boxes.forEach(([t, sub, col], i) => {
    const x = x0 + i * (bw + gap);
    s += '<rect x="' + x + '" y="' + (py - 26) + '" width="' + bw + '" height="64" rx="10" fill="' + col + '" stroke="#0c111b"/>';
    s += '<text class="cp" x="' + (x + bw / 2) + '" y="' + py + '" text-anchor="middle">' + t + '</text>';
    s += '<text class="cs" x="' + (x + bw / 2) + '" y="' + (py + 22) + '" text-anchor="middle" style="fill:#d6dce6">' + sub + '</text>';
    if (i) s += '<path d="M' + (x - gap + 6) + ' ' + (py + 6) + 'H' + (x - 8) + '" stroke="' + RED + '" stroke-width="4" marker-end="url(#arr)"/>';
  });
  const railX = x0 + 4 * (bw + gap) - gap + 6;
  s += '<path d="M' + railX + ' ' + (py + 6) + 'H' + (W - 40) + '" stroke="' + RED + '" stroke-width="4"/>';
  s += '<text class="cp" x="' + (railX + 16) + '" y="' + (py - 6) + '" style="fill:' + RED + '">Đường 5 V</text>';
  s += '<text class="cs" x="' + (railX + 16) + '" y="' + (py + 30) + '">' + esc(B.rail5) + '</text>';
  s += '<text class="cs" x="40" y="' + (PWR + 136) + '">' + esc(B.powerNote) + '</text>';
  s += '<text class="cf" x="18" y="' + (PWR + 196) + '">• Mạch mới: nạp firmware xong, kết nối Wi-Fi “Hynhi Robot - …” của robot rồi mở 192.168.4.1:8080 để chọn chân GPIO.</text>';
  s += '<text class="cf" x="18" y="' + (PWR + 236) + '">• Robot đã vào Wi-Fi nhà: mở IP:8080 của robot (xem trên màn hình robot hoặc tab Chẩn đoán).</text>';
  s += '</svg>';
  host.innerHTML = s;
  const extra = B.camera
    ? [['Camera', '#c2410c'], ['PSRAM', '#b91c1c'], ['USB gốc', '#7c3aed'], ['UART0 (log)', '#be185d']]
    : [['PSRAM', '#b91c1c'], ['USB gốc', '#7c3aed']];
  document.getElementById('legend').innerHTML = WIRE_LEGEND.filter(k => k !== 'analog').map(k => '<span><i style="background:' + TYPE[k][1] + '"></i>' + TYPE[k][0] + '</span>').join('') +
    extra.map(([t, c]) => '<span><i style="background:' + c + '"></i>' + t + '</span>').join('');
}
