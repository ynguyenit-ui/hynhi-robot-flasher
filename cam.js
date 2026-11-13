'use strict';
/* Robot Camera (ESP32-S3 CAM N16R8): one data source for the wiring diagram, the module tables and the pin table.
   Uses TYPE, ART, pads and esc from app.js. Pin order follows the two headers of the board, top to bottom. */
const CAM_LEFT_HDR = ['3V3', 'EN', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5V'];
const CAM_RIGHT_HDR = ['43', '44', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'GND'];

ART.strip = '<rect x="4" y="26" width="104" height="28" rx="3" fill="#15181e" stroke="#3a4558"/>' +
  [0, 1, 2, 3, 4, 5, 6, 7].map(i => '<rect x="' + (9 + i * 12.4) + '" y="33" width="9" height="9" rx="1.5" fill="#f1f3f6"/><circle cx="' + (13.5 + i * 12.4) + '" cy="37.5" r="2.4" fill="' + ['#ff5c7a', '#ffb547', '#f5e663', '#3ddc97', '#4aa3ff', '#a77bff', '#ff7ad9', '#ffffff'][i] + '"/>').join('') + pads(4, 48, 18, 25);

/* side: L/R header. pins: [label on module, GPIO, wire type]. wires: power and other wires. */
const CAM_MODULES = [
  { id: 'tof', side: 'L', short: 'I²C: VL53L0X + OLED', snote: 'chung bus camera · OLED 0x3D', name: 'VL53L0X + OLED SSD1306 (I²C)', note: 'I²C · dùng chung bus với camera · 3,3 V', art: 'tof',
    pins: [['SDA', 4, 'i2c'], ['SCL', 5, 'i2c']], wires: [['VL53L0X · VIN', '3V3', 'v33'], ['VL53L0X · GND', 'GND', 'gnd'], ['OLED · VCC', '3V3', 'v33'], ['OLED · GND', 'GND', 'gnd']],
    tip: 'GPIO4/5 là dây điều khiển camera (SCCB), chỉ thiết bị I²C mới được nối chung. Camera chiếm địa chỉ 0x3C nên OLED phải chỉnh sang 0x3D (hàn lại điện trở địa chỉ) và chọn Địa chỉ OLED = 0x3D trên trang cấu hình.' },
  { id: 'strip', side: 'L', short: 'LED WS2812', snote: '8 bóng · 5 V', name: 'LED WS2812 · 8 bóng', note: 'Dữ liệu 1 dây · 5 V', art: 'strip',
    pins: [['DIN', 3, 'gpio']], wires: [['5V', '5V', 'v5'], ['GND', 'GND', 'gnd']], tip: '' },
  { id: 'servo', side: 'L', short: 'Servo MG90S ×2', snote: 'PWM · 5 V riêng', name: 'Servo MG90S ×2', note: 'PWM · nguồn 5 V riêng', art: 'servo',
    pins: [['Đầu · dây cam', 46, 'pwm'], ['Cổ · dây cam', 14, 'pwm']], wires: [['Dây đỏ', '5V riêng (≥ 2 A)', 'v5'], ['Dây nâu', 'GND chung', 'gnd']],
    tip: 'Không lấy 5 V cho servo từ chân 5V của bo: robot dễ tự khởi động lại.' },
  { id: 'mic', side: 'R', short: 'Micro INMP441', snote: 'I²S · 3,3 V', name: 'Micro INMP441 / ICS-43434', note: 'I²S · 3,3 V', art: 'mic',
    pins: [['SD', 1, 'i2s'], ['SCK', 2, 'i2s'], ['WS', 42, 'i2s']], wires: [['VDD', '3V3', 'v33'], ['L/R', 'GND', 'gnd'], ['GND', 'GND', 'gnd']],
    tip: 'Chỉ cấp 3,3 V. Đèn IO2 trên bo sáng mờ khi micro chạy là bình thường.' },
  { id: 'audio', side: 'R', short: 'Âm thanh I²S', snote: 'MAX98357A · PCM5102A · KCX', name: 'MAX98357A + PCM5102A + KCX', note: 'I²S · ampli và DAC nối song song · 5 V', art: 'amp',
    pins: [['KCX · LINK', 41, 'gpio'], ['LRC / LCK', 40, 'i2s'], ['BCLK / BCK', 39, 'i2s'], ['DIN', 38, 'i2s']],
    wires: [['MAX98357A · Vin', '5V', 'v5'], ['PCM5102A · VIN', '5V', 'v5'], ['PCM5102A · SCK', 'GND', 'gnd'], ['PCM LOUT · ROUT · AGND', 'KCX AUDIO_L · AUDIO_R · AGND', 'analog'], ['KCX · +5V', '5V', 'v5'], ['Cọc loa + / −', 'Loa 4–8 Ω', 'analog']],
    tip: 'LRC, BCLK, DIN nối chung cho MAX98357A và PCM5102A. Sau khi nối dây LINK, chọn GPIO41 ở mục KCX LINK trên trang cấu hình.' },
  { id: 'touch', side: 'R', short: 'Nút chạm TTP223', snote: '3,3 V', name: 'Nút chạm TTP223', note: 'Chạm · 3,3 V', art: 'touch',
    pins: [['I/O', 0, 'gpio']], wires: [['VCC', '3V3', 'v33'], ['GND', 'GND', 'gnd']], tip: 'GPIO0 cũng là nút BOOT: đừng chạm khi vừa cấp nguồn.' },
  { id: 'display', side: 'R', short: 'Màn ST7789', snote: 'SPI · 240×240 · 3,3 V', name: 'Màn ST7789 240×240', note: 'SPI · 3,3 V', art: 'display',
    pins: [['DC', 45, 'gpio'], ['RES / RST', 48, 'gpio'], ['SCL / SCLK', 47, 'spi'], ['SDA / MOSI', 21, 'spi']],
    wires: [['VCC', '3V3', 'v33'], ['BLK (đèn nền)', '3V3', 'v33'], ['GND', 'GND', 'gnd']],
    tip: 'GPIO48 cũng nối đèn RGB trên bo, đèn có thể nháy khi màn khởi động. Màn có chân CS thì nối CS xuống GND.' }
];

const camPinKind = name => {
  const n = Number(name);
  if (name === '3V3') return ['3V3', '#f59e0b'];
  if (name === '5V') return ['5V', '#ef4444'];
  if (name === 'GND') return ['GND', '#8b97aa'];
  if (name === 'EN') return ['RST', '#8b97aa'];
  if ((n >= 6 && n <= 13) || (n >= 15 && n <= 18)) return ['camera', '#c2410c'];
  if (n >= 35 && n <= 37) return ['PSRAM', '#b91c1c'];
  if (n === 19 || n === 20) return ['USB', '#7c3aed'];
  if (n === 43 || n === 44) return ['UART', '#be185d'];
  return null;
};

/* GPIO that can carry a module signal on this board (the round dots on the diagram). */
const CAM_USABLE = [0, 1, 2, 3, 4, 5, 14, 19, 20, 21, 38, 39, 40, 41, 42, 45, 46, 47, 48];

function drawCamMap() {
  const host = document.getElementById('cam-map');
  if (!host) return;
  const W = 1500, P = 52, Y0 = 250, BX = 610, BW = 280, HX = [BX + 26, BX + BW - 26], CHIP = 104, CARD_W = 420, PADY = 23;
  const rowY = i => Y0 + i * P, BOARD_BOTTOM = rowY(19) + 110, PWR = BOARD_BOTTOM + 40, H = PWR + 300;
  const RED = '#ef4444', AMBER = '#f59e0b';
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sơ đồ đấu nối Hynhi Robot Camera">';
  /* Title banner */
  s += '<rect x="0" y="0" width="' + W + '" height="150" rx="16" fill="#0f1420"/>';
  s += '<image href="images/logo.png" x="24" y="14" width="122" height="122" preserveAspectRatio="xMidYMid meet"/>';
  s += '<text class="ch" x="170" y="72">HYNHI ROBOT CAMERA · ESP32-S3 CUSTOM GPIO</text>';
  s += '<text class="cs2" x="172" y="108">Sơ đồ đấu nối bo ESP32-S3 CAM N16R8 · camera OV3660 / OV5640 tự nhận · mọi chân đổi được trong tab Chân GPIO</text>';
  s += '<circle cx="182" cy="132" r="7" fill="#3ddc97"/><text class="cs" x="196" y="137">Chấm tròn: chân dùng được cho module</text>';
  s += '<circle cx="520" cy="132" r="7" fill="none" stroke="#e7ecf3" stroke-width="2.4"/><text class="cs" x="534" y="137">Chấm rỗng: chân dùng được, đang trống</text>';
  /* 3.3 V and 5 V rails along the top and bottom of the board */
  s += '<path d="M' + (BX - 10 - CHIP) + ' ' + (Y0 - 50) + 'H' + (BX + BW + 10 + CHIP) + '" stroke="' + AMBER + '" stroke-width="3" stroke-dasharray="10 6"/>';
  s += '<text class="cs" x="' + (BX + BW / 2) + '" y="' + (Y0 - 58) + '" text-anchor="middle" style="fill:' + AMBER + '">Đường 3,3 V từ chân 3V3 của bo: micro, màn hình, VL53L0X, OLED, TTP223</text>';
  /* Board */
  s += '<rect x="' + BX + '" y="' + (Y0 - 36) + '" width="' + BW + '" height="' + (BOARD_BOTTOM - Y0 + 36) + '" rx="14" fill="#16181d" stroke="#3a4558" stroke-width="2"/>';
  const top = Y0 - 20;
  s += '<rect x="' + (BX + 70) + '" y="' + top + '" width="140" height="180" rx="6" fill="#c9ced6" stroke="#8b97aa"/>';
  s += '<text class="b" x="' + (BX + 140) + '" y="' + (top + 24) + '" text-anchor="middle" style="fill:#1b1f27">ESP32-S3</text>';
  s += '<circle cx="' + (BX + 140) + '" cy="' + (top + 96) + '" r="40" fill="#0b0d12" stroke="#59647a" stroke-width="4"/><circle cx="' + (BX + 140) + '" cy="' + (top + 96) + '" r="22" fill="#1d2a4a"/><circle cx="' + (BX + 132) + '" cy="' + (top + 88) + '" r="6" fill="#7fa8ff" opacity=".7"/>';
  s += '<rect x="' + (BX + 128) + '" y="' + (top + 136) + '" width="24" height="90" fill="#d9822b"/>';
  s += '<rect x="' + (BX + 80) + '" y="' + (top + 226) + '" width="120" height="34" rx="3" fill="#2a2f3a" stroke="#59647a"/>';
  s += '<text class="s" x="' + (BX + 140) + '" y="' + (top + 286) + '" text-anchor="middle">Camera OV3660 / OV5640</text>';
  s += '<text class="b" x="' + (BX + 140) + '" y="' + (rowY(12) + 4) + '" text-anchor="middle">ESP32-S3 CAM</text>';
  s += '<text class="s" x="' + (BX + 140) + '" y="' + (rowY(12) + 22) + '" text-anchor="middle">N16R8</text>';
  [['RST', BX + 96], ['BOOT', BX + 184]].forEach(([t, x]) => { s += '<rect x="' + (x - 14) + '" y="' + (rowY(15) - 14) + '" width="28" height="28" rx="4" fill="#2a2f3a" stroke="#59647a"/><circle cx="' + x + '" cy="' + rowY(15) + '" r="7" fill="#59647a"/><text class="s" x="' + x + '" y="' + (rowY(15) + 30) + '" text-anchor="middle">' + t + '</text>'; });
  [['USB', BX + 96, 'GPIO19/20'], ['UART', BX + 184, 'GPIO43/44']].forEach(([t, x, sub]) => { s += '<rect x="' + (x - 24) + '" y="' + (BOARD_BOTTOM - 32) + '" width="48" height="26" rx="8" fill="#c9ced6" stroke="#8b97aa"/><text class="b" x="' + x + '" y="' + (BOARD_BOTTOM - 40) + '" text-anchor="middle">' + t + '</text><text class="s" x="' + x + '" y="' + (BOARD_BOTTOM - 56) + '" text-anchor="middle">' + sub + '</text>'; });
  const used = {};
  CAM_MODULES.forEach(m => m.pins.forEach(([label, gpio, type]) => { used[gpio] = { m, label, type }; }));
  [CAM_LEFT_HDR, CAM_RIGHT_HDR].forEach((hdr, side) => hdr.forEach((name, i) => {
    const y = rowY(i), hx = HX[side], kind = camPinKind(name), u = used[name];
    const cx = side === 0 ? BX - 10 - CHIP : BX + BW + 10;
    const usable = CAM_USABLE.includes(Number(name)) && /^\d+$/.test(name);
    const color = u ? TYPE[u.type][1] : kind ? kind[1] : '#33405a';
    s += '<circle cx="' + hx + '" cy="' + y + '" r="7" fill="#0b0d12" stroke="#e6c76a" stroke-width="2.4"/>';
    s += '<text class="s" x="' + (side === 0 ? hx + 14 : hx - 14) + '" y="' + (y + 4) + '" text-anchor="' + (side === 0 ? 'start' : 'end') + '">' + name + '</text>';
    s += '<path d="M' + hx + ' ' + y + 'H' + (side === 0 ? BX - 10 : BX + BW + 10) + '" stroke="' + color + '" stroke-width="2.4" opacity="' + (u || kind ? 1 : .5) + '"/>';
    const fill = u ? '#0c111b' : kind ? kind[1] : '#0c111b';
    s += '<rect x="' + cx + '" y="' + (y - 15) + '" width="' + CHIP + '" height="30" rx="7" fill="' + fill + '" stroke="' + color + '" stroke-width="1.6"/>';
    const text = /^\d+$/.test(name) ? 'GPIO' + name : name;
    s += '<text class="cg" x="' + (cx + CHIP / 2) + '" y="' + (y + 5.5) + '" text-anchor="middle" style="fill:' + (u ? '#3ddc97' : kind ? '#fff' : '#e7ecf3') + '">' + text + '</text>';
    if (kind && /^\d+$/.test(name) && !usable) s += '<text class="s" x="' + (side === 0 ? cx - 10 : cx + CHIP + 10) + '" y="' + (y + 4) + '" text-anchor="' + (side === 0 ? 'end' : 'start') + '" style="fill:' + kind[1] + '">' + kind[0] + '</text>';
    if (usable && !u) {
      const dx = side === 0 ? cx - 12 : cx + CHIP + 12;
      s += '<circle cx="' + dx + '" cy="' + y + '" r="7" fill="none" stroke="#e7ecf3" stroke-width="2.4"/>';
      s += '<text class="s" x="' + (side === 0 ? dx - 14 : dx + 14) + '" y="' + (y + 4) + '" text-anchor="' + (side === 0 ? 'end' : 'start') + '">trống' + (name === '19' || name === '20' ? ' · USB gốc' : '') + '</text>';
    }
  }));
  /* Module cards: each pin row sits at the height of its header pin, so every wire is a straight line. */
  CAM_MODULES.forEach(m => {
    const hdr = m.side === 'L' ? CAM_LEFT_HDR : CAM_RIGHT_HDR;
    const ys = m.pins.map(p => rowY(hdr.indexOf(String(p[1]))));
    const ctop = Math.min(...ys) - PADY, bottom = Math.max(...ys) + PADY, h = bottom - ctop;
    const x = m.side === 'L' ? 18 : W - 18 - CARD_W, inner = m.side === 'L' ? x + CARD_W : x;
    const chipEdge = m.side === 'L' ? BX - 10 - CHIP : BX + BW + 10 + CHIP;
    s += '<rect x="' + x + '" y="' + ctop + '" width="' + CARD_W + '" height="' + h + '" rx="10" fill="#111722" stroke="#33405a"/>';
    const scale = Math.min(.8, (h - 10) / 80), artX = m.side === 'L' ? x + 10 : x + CARD_W - 10 - 112 * scale;
    s += '<g transform="translate(' + artX + ' ' + (ctop + (h - 80 * scale) / 2) + ') scale(' + scale.toFixed(3) + ')">' + ART[m.art] + '</g>';
    const tx = m.side === 'L' ? x + 20 + 112 * scale : x + CARD_W - 20 - 112 * scale, anchor = m.side === 'L' ? 'start' : 'end';
    const single = m.pins.length === 1, ty = single ? ctop + h / 2 - 2 : ctop + 28;
    s += '<text class="ct" x="' + tx + '" y="' + ty + '" text-anchor="' + anchor + '">' + esc(m.short) + '</text>';
    s += '<text class="cs" x="' + tx + '" y="' + (ty + (single ? 17 : 20)) + '" text-anchor="' + anchor + '">' + esc(m.snote) + '</text>';
    m.pins.forEach(([label, gpio, type], k) => {
      const y = ys[k], color = TYPE[type][1];
      s += '<path d="M' + inner + ' ' + y + 'H' + chipEdge + '" stroke="' + color + '" stroke-width="3.4" stroke-linecap="round"/>';
      s += '<circle cx="' + inner + '" cy="' + y + '" r="6" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
      s += '<circle cx="' + chipEdge + '" cy="' + y + '" r="7" fill="' + color + '" stroke="#0c111b" stroke-width="2"/>';
      s += '<text class="cp" x="' + (m.side === 'L' ? inner - 16 : inner + 16) + '" y="' + (y + 5.5) + '" text-anchor="' + (m.side === 'L' ? 'end' : 'start') + '">' + esc(label) + '</text>';
    });
  });
  /* Power: battery -> charger/boost -> switch -> capacitor -> 5 V rail (board 5V pin, amp, LED, KCX, servos) */
  const py = PWR + 70, boxes = [
    ['Pin Li-ion 3,7 V', '14250 / 18650', '#1e5fb4'], ['Mạch sạc + tăng áp 5 V', 'TP4056 + MT3608 hoặc IP5306', '#12583f'],
    ['Công tắc nguồn', 'gạt 2 vị trí', '#2a2f3a'], ['Tụ lọc 470–1000 µF', '16–25 V, sát chân 5V', '#3d2a7a']];
  s += '<rect x="18" y="' + PWR + '" width="' + (W - 36) + '" height="150" rx="12" fill="#111722" stroke="#33405a"/>';
  s += '<text class="ct" x="40" y="' + (PWR + 32) + '">Nguồn cho Hynhi Robot Camera</text>';
  const bw = 250, gap = 60, x0 = 40;
  boxes.forEach(([t, sub, col], i) => {
    const x = x0 + i * (bw + gap);
    s += '<rect x="' + x + '" y="' + (py - 26) + '" width="' + bw + '" height="64" rx="10" fill="' + col + '" stroke="#0c111b"/>';
    s += '<text class="cp" x="' + (x + bw / 2) + '" y="' + (py) + '" text-anchor="middle">' + t + '</text>';
    s += '<text class="cs" x="' + (x + bw / 2) + '" y="' + (py + 22) + '" text-anchor="middle" style="fill:#d6dce6">' + sub + '</text>';
    if (i) s += '<path d="M' + (x - gap + 6) + ' ' + (py + 6) + 'H' + (x - 8) + '" stroke="' + RED + '" stroke-width="4" marker-end="url(#arr)"/>';
  });
  const railX = x0 + 4 * (bw + gap) - gap + 6;
  s += '<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + RED + '"/></marker></defs>';
  s += '<path d="M' + railX + ' ' + (py + 6) + 'H' + (W - 40) + '" stroke="' + RED + '" stroke-width="4"/>';
  s += '<text class="cp" x="' + (railX + 16) + '" y="' + (py - 6) + '" style="fill:' + RED + '">Đường 5 V</text>';
  s += '<text class="cs" x="' + (railX + 16) + '" y="' + (py + 30) + '">bo · ampli · DAC · KCX · LED</text>';
  s += '<text class="cs" x="40" y="' + (PWR + 136) + '">Servo cần nguồn 5 V riêng ≥ 2 A. Mọi module nối GND chung với bo.</text>';
  /* Footer: how to configure */
  s += '<text class="cf" x="18" y="' + (PWR + 196) + '">• Mạch mới: nạp firmware xong, kết nối Wi-Fi “Hynhi Robot - …” của robot rồi mở 192.168.4.1:8080 để chọn chân GPIO.</text>';
  s += '<text class="cf" x="18" y="' + (PWR + 236) + '">• Robot đã vào Wi-Fi nhà: mở địa chỉ IP:8080 của robot (xem trên màn hình robot hoặc mục Chẩn đoán của trang này).</text>';
  s += '<text class="cs" x="18" y="' + (PWR + 270) + '">Chân 19/20 (USB gốc) dùng được cho tín hiệu, nhưng khi đó cổng COM USB mất: nạp lại bằng cách giữ BOOT, bấm RST, thả BOOT.</text>';
  s += '</svg>';
  host.innerHTML = s;
  document.getElementById('cam-legend').innerHTML = WIRE_LEGEND.filter(k => k !== 'analog').map(k => '<span><i style="background:' + TYPE[k][1] + '"></i>' + TYPE[k][0] + '</span>').join('') +
    '<span><i style="background:#c2410c"></i>Camera</span><span><i style="background:#b91c1c"></i>PSRAM</span><span><i style="background:#7c3aed"></i>USB gốc</span><span><i style="background:#be185d"></i>UART0 (log)</span>';
}

function drawCamTables() {
  const list = document.getElementById('cam-tables');
  if (list) {
    list.innerHTML = '';
    for (const m of CAM_MODULES) {
      const row = (label, target, type, strong) => '<tr style="--w:' + TYPE[type][1] + '"><td>' + esc(label) + '</td><td class="wire" aria-hidden="true"><i></i></td><td' + (strong ? ' class="gp"' : '') + '>' + esc(target) + '</td></tr>';
      const card = document.createElement('article');
      card.className = 'mod';
      card.innerHTML = '<header><div class="pic"><svg viewBox="0 0 112 80" aria-hidden="true">' + ART[m.art] + '</svg></div><div><h4>' + esc(m.name) + '</h4><p>' + esc(m.note) + '</p></div></header>' +
        '<table><thead><tr><th>Chân trên module</th><th></th><th>Nối tới</th></tr></thead><tbody>' +
        m.pins.map(([label, gpio, type]) => row(label, 'GPIO' + gpio, type, true)).join('') +
        m.wires.map(([label, target, type]) => row(label, target, type, false)).join('') + '</tbody></table>' +
        (m.tip ? '<p class="tip">' + esc(m.tip) + '</p>' : '');
      list.append(card);
    }
  }
  const body = document.getElementById('cam-pins');
  if (!body) return;
  const used = {};
  CAM_MODULES.forEach(m => m.pins.forEach(([label, gpio]) => { used[gpio] = m.name.split(' ·')[0] + ' · ' + label; }));
  const rows = [];
  for (const g of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48]) {
    const kind = camPinKind(String(g));
    let state, text;
    if (used[g]) { state = (g === 4 || g === 5) ? 'shared' : 'used'; text = used[g] + (g === 4 || g === 5 ? ' (chung bus camera)' : '') + ([3, 45, 46].includes(g) ? ' · chân strapping' : '') + (g === 0 ? ' · cũng là nút BOOT' : '') + (g === 19 || g === 20 ? ' · cổng USB gốc' : '') + (g === 48 ? ' · đèn RGB trên bo' : ''); }
    else if (g === 19 || g === 20) { state = 'free'; text = 'Còn trống · USB gốc: dùng thì mất cổng COM USB, nạp lại bằng BOOT + RST'; }
    else if (kind) { state = 'reserved'; text = kind[0] === 'camera' ? 'Camera (dữ liệu, VSYNC, HREF, PCLK, XCLK)' : kind[0] === 'PSRAM' ? 'Bộ nhớ PSRAM 8 MB' : kind[0] === 'USB' ? 'Cổng USB gốc: nạp firmware và log (COM trên máy tính)' : 'UART0: log khởi động'; }
    else { state = 'free'; text = 'Còn trống'; }
    rows.push('<tr class="pa-' + state + '"><td>GPIO ' + g + '</td><td><span>' + { free: 'Trống', used: 'Đang dùng', shared: 'Chung I²C', reserved: 'Dành riêng' }[state] + '</span></td><td>' + esc(text) + '</td></tr>');
  }
  body.innerHTML = rows.join('');
}

drawCamMap();
drawCamTables();
