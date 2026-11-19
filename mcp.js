/* Tab MCP: đăng ký MCP endpoint của robot Xiaozhi với máy chủ Hynhi MCP. */
(() => {
  const $ = id => document.getElementById(id);
  const DEFAULT_SERVER = 'https://hynhi-mcp.onrender.com';
  let server = DEFAULT_SERVER;
  let groups = {};
  const VI = { weather_forecast: 'Thời tiết & không khí', news_headlines: 'Tin tức', news_read_article: 'Đọc bài báo', lottery_results: 'Kết quả xổ số',
    lottery_check_ticket: 'Dò vé số', wikipedia_lookup: 'Bách khoa Wikipedia', web_search: 'Tìm kiếm Internet', read_web_page: 'Đọc trang web',
    traffic_fine_lookup: 'Tra phạt nguội', gold_price: 'Giá vàng', exchange_rate: 'Tỷ giá & quy đổi', crypto_price: 'Tiền số Bitcoin',
    stock_price: 'Chứng khoán', business_tax_lookup: 'Mã số thuế doanh nghiệp', lunar_calendar: 'Lịch vạn niên', days_until_event: 'Đếm ngược sự kiện',
    age_compatibility: 'Xem tuổi hợp khắc', feng_shui_advice: 'Phong thuỷ', find_good_days: 'Xem ngày tốt', numerology_reading: 'Thần số học',
    daily_horoscope: 'Cung hoàng đạo hôm nay', tarot_reading: 'Bói Tarot', translate_text: 'Dịch thuật', tutor: 'Gia sư 23 môn',
    driving_theory_quiz: 'Ôn thi bằng lái 600 câu', expert_advice: 'Tư vấn chuyên gia', cooking_recipe: 'Dạy nấu ăn', kids_story: 'Kể chuyện cho bé',
    greek_mythology: 'Thần thoại Hy Lạp', vietnamese_joke: 'Tiếu lâm Việt Nam', riddle_game: 'Câu đố vui', calculator: 'Máy tính',
    unit_convert: 'Đổi đơn vị', current_datetime: 'Giờ thế giới' };
  const short = d => d.split(/\.\s/)[0].replace(/\.+$/, '') + '.';

  const store = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* chỉ để nhớ */ } },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function api(path, body, timeout = 20000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(server + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal });
      return await r.json();
    } finally { clearTimeout(t); }
  }

  function msg(text, ok) {
    const el = $('mcp-msg');
    el.textContent = text;
    el.className = 'mcp-msg ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
  }

  async function loadStats() {
    const ul = $('mcp-stats');
    try {
      const s = await api('/api/status', null, 60000);  // máy chủ miễn phí có thể mất ~50 s để thức dậy
      ul.innerHTML = [`<li class="ok-pill">● Máy chủ hoạt động · v${esc(s.version)}</li>`, `<li>${s.tools} công cụ</li>`,
        `<li>${s.online}/${s.devices} robot online</li>`, `<li>${s.calls} lượt gọi</li>`].join('');
    } catch {
      ul.innerHTML = '<li class="bad-pill">● Chưa kết nối được máy chủ MCP</li><li>Thử lại sau ít phút hoặc đổi máy chủ ở cuối trang</li>';
    }
  }

  function renderTools(data) {
    groups = data.groups;
    const by = {};
    data.tools.forEach(t => (by[t.group] = by[t.group] || []).push(t));
    $('mcp-tools').innerHTML = Object.entries(groups).filter(([g]) => by[g]).map(([g, name]) => `
      <div class="mcp-group"><h3>${esc(name)} <span>${by[g].length}</span></h3><ul>${by[g].map(t =>
        `<li><b>${esc(VI[t.name] || t.name.replace(/_/g, ' '))}</b><span>${esc(short(t.description))}</span></li>`).join('')}</ul></div>`).join('');
    $('mcp-group-list').innerHTML = Object.entries(groups).map(([g, name]) =>
      `<label class="mcp-check"><input type="checkbox" name="g" value="${g}" checked> ${esc(name)} (${(by[g] || []).length})</label>`).join('');
    $('mcp-try-tool').innerHTML = data.tools.map(t => `<option value="${t.name}" data-params="${esc(t.params.join(', '))}">${esc(VI[t.name] || t.name)} (${t.name})</option>`).join('');
    syncTryHint();
  }

  const EXAMPLES = {
    weather_forecast: { city: 'Đà Nẵng', days: 3 }, news_headlines: { category: 'the-thao', count: 3 }, lottery_results: { region: 'mien-nam' },
    lunar_calendar: {}, gold_price: {}, stock_price: { symbols: 'FPT,VCB,vnindex' }, exchange_rate: { currency: 'USD', amount: 100 },
    crypto_price: { coins: 'btc,eth' }, wikipedia_lookup: { query: 'Vịnh Hạ Long' }, numerology_reading: { birth_date: '15/08/1995', full_name: 'Nguyễn Văn An' },
    feng_shui_advice: { birth_year: 1990, gender: 'nam' }, age_compatibility: { year1: 1990, year2: 1993 }, find_good_days: { purpose: 'khai trương', days_ahead: 30 },
    tutor: { subject: 'toan', question: 'định lý Pitago', grade: 'lớp 8' }, kids_story: { title: 'Cây khế' }, vietnamese_joke: {},
    driving_theory_quiz: { vehicle: 'oto', critical_only: true }, business_tax_lookup: { tax_code: '0101248141' }, translate_text: { text: 'Xin chào', target: 'ja' },
    calculator: { expression: '15% * 2500000' }, cooking_recipe: { dish: 'canh chua cá' }, days_until_event: { event: 'tết' },
  };
  function syncTryHint() {
    const sel = $('mcp-try-tool');
    $('mcp-try-args').value = JSON.stringify(EXAMPLES[sel.value] || {});
    $('mcp-try-args').placeholder = 'Tham số: ' + (sel.selectedOptions[0]?.dataset.params || 'không có');
  }

  async function loadTools() {
    try { renderTools(await api('/api/tools', null, 60000)); }
    catch { renderTools(await (await fetch('mcp/tools.json')).json()); }
  }

  function form() {
    const f = new FormData($('mcp-reg'));
    const all = Object.keys(groups);
    const on = f.getAll('g');
    return { name: (f.get('name') || '').trim(), url: (f.get('url') || '').trim(), password: f.get('password') || '',
      disabled_groups: all.filter(g => !on.includes(g)) };
  }
  function validUrl(u) { return /^wss?:\/\/[^ ]+token=/.test(u); }

  $('mcp-reg').addEventListener('submit', async e => {
    e.preventDefault();
    const b = form();
    if (!validUrl(b.url)) return msg('Điểm cuối phải có dạng wss://api.xiaozhi.me/mcp/?token=...', false);
    msg('Đang kết nối robot với máy chủ… (lần đầu có thể mất tới 1 phút)');
    try {
      const r = await api('/api/register', b, 70000);
      msg(r.message, r.ok);
      if (r.ok) { store.set('hynhi-mcp-url', b.url); store.set('hynhi-mcp-name', b.name); loadStats(); }
      if (r.need_password) $('mcp-pass-row').hidden = false;
    } catch { msg('Không gọi được máy chủ MCP. Kiểm tra mạng hoặc thử lại sau.', false); }
  });

  $('mcp-check').addEventListener('click', async () => {
    const { url } = form();
    if (!validUrl(url)) return msg('Dán điểm cuối MCP của robot trước.', false);
    try {
      const r = await api('/api/device', { url });
      if (!r.ok) return msg(r.message, false);
      const d = r.device;
      const st = { online: 'đang online', connecting: 'đang kết nối', error: 'lỗi kết nối' }[d.state] || d.state;
      msg(`"${d.name}": ${st}, ${d.calls} lượt gọi${d.last_tool ? `, gần nhất: ${d.last_tool}` : ''}${d.error && d.state !== 'online' ? ` (${d.error})` : ''}.`, d.state === 'online');
    } catch { msg('Không gọi được máy chủ MCP.', false); }
  });

  $('mcp-del').addEventListener('click', async () => {
    const { url } = form();
    if (!validUrl(url)) return msg('Dán đúng điểm cuối MCP đã đăng ký để xoá.', false);
    const btn = $('mcp-del');
    if (btn.dataset.confirm !== '1') {  // bấm 2 lần để xác nhận
      btn.dataset.confirm = '1';
      btn.lastChild.textContent = 'Bấm lần nữa để xoá';
      setTimeout(() => { btn.dataset.confirm = ''; btn.lastChild.textContent = 'Xoá robot này'; }, 4000);
      return;
    }
    btn.dataset.confirm = '';
    btn.lastChild.textContent = 'Xoá robot này';
    try {
      const r = await api('/api/unregister', { url });
      msg(r.message, r.ok);
      if (r.ok) { store.set('hynhi-mcp-url', ''); loadStats(); }
    } catch { msg('Không gọi được máy chủ MCP.', false); }
  });

  $('mcp-try-tool').addEventListener('change', syncTryHint);
  $('mcp-try').addEventListener('submit', async e => {
    e.preventDefault();
    const out = $('mcp-try-out');
    out.hidden = false;
    let args;
    try { args = JSON.parse($('mcp-try-args').value || '{}'); } catch { out.textContent = 'Tham số phải là JSON, ví dụ {"city":"Huế"}'; return; }
    out.textContent = 'Đang chạy…';
    try {
      const r = await api('/api/try', { tool: $('mcp-try-tool').value, args }, 60000);
      out.textContent = (r.ms != null ? `(${r.ms} ms)\n` : '') + r.text;
    } catch { out.textContent = 'Không gọi được máy chủ MCP.'; }
  });

  $('mcp-server').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('mcp-server-url').value.trim().replace(/\/+$/, '');
    store.set('hynhi-mcp-server', v && v !== DEFAULT_SERVER ? v : '');
    server = v || DEFAULT_SERVER;
    loadStats(); loadTools();
  });

  async function init() {
    let cfg = {};
    try { cfg = (await window.hynhiConfig) || {}; } catch { /* dùng mặc định */ }
    const m = cfg.mcp || {};
    server = store.get('hynhi-mcp-server') || m.server || DEFAULT_SERVER;
    $('mcp-server-url').value = server;
    if (m.password_sha256) $('mcp-pass-row').hidden = false;
    const f = $('mcp-reg');
    f.url.value = store.get('hynhi-mcp-url');
    f.name.value = store.get('hynhi-mcp-name');
    loadStats();
    loadTools();
  }
  let started = false;
  const start = () => { if (!started && location.hash === '#mcp') { started = true; init(); } };
  window.addEventListener('hashchange', start);
  window.addEventListener('DOMContentLoaded', start);
})();
