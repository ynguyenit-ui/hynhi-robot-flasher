/* Quản trị trang nạp: đọc/sửa site-config.json qua GitHub API bằng token của quản trị viên. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FILE = 'site-config.json';
  const TAB_NAMES = { firmware: 'Nạp firmware', phicom: 'Loa Phicom', mcp: 'MCP', diag: 'Chẩn đoán' };
  const VARIANTS = { custom: 'Robot để bàn', cam: 'Robot Camera', btbridge: 'Loa Bluetooth (ESP32)' };
  const DEFAULT_CFG = {
    version: 1, announcement: { text: '', tone: 'info' },
    tabs: Object.entries(TAB_NAMES).map(([id, label]) => ({ id, label, visible: true })),
    variants: { custom: { visible: true }, cam: { visible: true }, btbridge: { visible: true } },
    texts: {}, theme: { accent: '' },
    firmware: { password_sha256: '', protect: ['custom', 'cam', 'btbridge'], hint: '' },
    mcp: { server: 'https://hynhi-mcp.onrender.com', password_sha256: '' },
  };
  let token = '', repo = '', sha = '', saved = '', cfg = null, defaults = {};

  const keep = {
    get() { try { return JSON.parse(localStorage.getItem('hynhi-admin') || sessionStorage.getItem('hynhi-admin') || 'null'); } catch { return null; } },
    set(v, remember) { try { (remember ? localStorage : sessionStorage).setItem('hynhi-admin', JSON.stringify(v)); } catch { /* bỏ qua */ } },
    clear() { try { localStorage.removeItem('hynhi-admin'); sessionStorage.removeItem('hynhi-admin'); } catch { /* bỏ qua */ } },
  };

  async function gh(path, opts = {}) {
    const r = await fetch('https://api.github.com' + path, { ...opts, headers: {
      Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) } });
    const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.message || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return data;
  }
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const b64enc = s => { const b = new TextEncoder().encode(s); let x = ''; b.forEach(c => { x += String.fromCharCode(c); }); return btoa(x); };
  const merge = (base, over) => {
    const out = structuredClone(base);
    for (const [k, v] of Object.entries(over || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && !Array.isArray(out[k]) ? merge(out[k], v) : v;
    return out;
  };
  const serialize = c => JSON.stringify(c, null, 2) + '\n';

  function setMsg(el, text, ok) { el.textContent = text; el.className = 'msg' + (ok === true ? ' ok' : ok === false ? ' bad' : ''); }
  function dirty() {
    const d = serialize(cfg) !== saved;
    setMsg($('save-msg'), d ? 'Có thay đổi chưa lưu.' : 'Chưa có thay đổi.', d ? undefined : true);
    try { localStorage.setItem('hynhi-preview-config', serialize(cfg)); } catch { /* xem trước cần bộ nhớ */ }
    return d;
  }

  /* ---------- Đăng nhập ---------- */
  async function login(t, r, remember) {
    token = t; repo = r;
    const info = await gh(`/repos/${repo}`);
    if (!info.permissions?.push) throw new Error('Token không có quyền ghi repo này.');
    keep.set({ token, repo }, remember);
    $('login').hidden = true;
    $('app').hidden = false;
    await load();
  }
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    setMsg($('login-msg'), 'Đang kiểm tra token…');
    try { await login(f.get('token').trim(), f.get('repo').trim(), !!f.get('remember')); }
    catch (err) { setMsg($('login-msg'), 'Đăng nhập lỗi: ' + err.message, false); }
  });
  $('logout').addEventListener('click', () => { keep.clear(); location.reload(); });

  /* ---------- Tải cấu hình ---------- */
  async function load() {
    try {
      const f = await gh(`/repos/${repo}/contents/${FILE}?ref=main&t=${Date.now()}`);
      sha = f.sha;
      cfg = merge(DEFAULT_CFG, JSON.parse(b64dec(f.content)));
    } catch (e) {
      if (e.status !== 404) throw e;
      sha = ''; cfg = structuredClone(DEFAULT_CFG);
    }
    saved = serialize(cfg);
    await loadDefaults();
    renderAll();
    dirty();
  }
  async function loadDefaults() {
    const html = await (await fetch('index.html?t=' + Date.now(), { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    defaults = {};
    doc.querySelectorAll('[data-edit]').forEach(el => { defaults[el.dataset.edit] = el.innerHTML.trim(); });
  }

  /* ---------- Hiển thị ---------- */
  function renderAll() { renderGeneral(); renderTabs(); renderFirmware(); renderMcp(); renderTexts(); renderHistory(); }

  function renderGeneral() {
    $('ann-text').value = cfg.announcement.text || '';
    $('ann-tone').value = cfg.announcement.tone || 'info';
    $('accent-hex').value = cfg.theme.accent || '';
    $('accent').value = cfg.theme.accent || '#ff4f70';
    const pages = `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/`;
    $('status-table').innerHTML = [
      ['Trang nạp', `<a href="${pages}" target="_blank" rel="noopener">${pages}</a>`],
      ['Trang quản trị', `<a href="${pages}admin.html" target="_blank" rel="noopener">${pages}admin.html</a>`],
      ['Mật khẩu nạp firmware', cfg.firmware.password_sha256 ? '<span class="pill">Đang bật</span>' : '<span class="pill off">Tắt</span>'],
      ['Mật khẩu kết nối MCP', cfg.mcp.password_sha256 ? '<span class="pill">Đang bật</span>' : '<span class="pill off">Tắt</span>'],
      ['Nội dung đã sửa', Object.keys(cfg.texts).length + ' mục'],
    ].map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  }
  $('ann-text').addEventListener('input', e => { cfg.announcement.text = e.target.value.trim(); dirty(); });
  $('ann-tone').addEventListener('change', e => { cfg.announcement.tone = e.target.value; dirty(); });
  $('accent').addEventListener('input', e => { cfg.theme.accent = e.target.value; $('accent-hex').value = e.target.value; dirty(); });
  $('accent-hex').addEventListener('change', e => {
    const v = e.target.value.trim();
    if (v && !/^#[0-9a-f]{6}$/i.test(v)) { e.target.value = cfg.theme.accent; return; }
    cfg.theme.accent = v; if (v) $('accent').value = v; dirty();
  });
  $('accent-reset').addEventListener('click', () => { cfg.theme.accent = ''; renderGeneral(); dirty(); });

  function renderTabs() {
    $('tab-list').innerHTML = cfg.tabs.map((t, i) => `
      <div class="item" data-i="${i}">
        <label class="check"><input type="checkbox" data-act="vis" ${t.visible !== false ? 'checked' : ''}> Hiện</label>
        <input type="text" data-act="label" value="${esc(t.label || TAB_NAMES[t.id])}" aria-label="Tên tab ${esc(TAB_NAMES[t.id])}">
        <span class="row" style="gap:6px;flex:none"><button class="mini" data-act="up" ${i ? '' : 'disabled'} aria-label="Lên">▲</button><button class="mini" data-act="down" ${i < cfg.tabs.length - 1 ? '' : 'disabled'} aria-label="Xuống">▼</button></span>
      </div>`).join('');
  }
  $('tab-list').addEventListener('input', e => {
    const i = +e.target.closest('.item').dataset.i;
    if (e.target.dataset.act === 'label') cfg.tabs[i].label = e.target.value;
    if (e.target.dataset.act === 'vis') {
      cfg.tabs[i].visible = e.target.checked;
      if (!cfg.tabs.some(t => t.visible !== false)) { cfg.tabs[i].visible = true; e.target.checked = true; }
    }
    dirty();
  });
  $('tab-list').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act !== 'up' && act !== 'down') return;
    const i = +e.target.closest('.item').dataset.i, j = act === 'up' ? i - 1 : i + 1;
    [cfg.tabs[i], cfg.tabs[j]] = [cfg.tabs[j], cfg.tabs[i]];
    renderTabs(); dirty();
  });

  function renderFirmware() {
    $('variant-list').innerHTML = Object.entries(VARIANTS).map(([id, name]) => `
      <div class="item"><label class="check"><input type="checkbox" data-v="${id}" ${cfg.variants[id]?.visible !== false ? 'checked' : ''}> Hiện</label>
      <span><b>${name}</b> <small style="color:var(--muted)">firmware/${id}</small></span><span></span></div>`).join('');
    $('fw-protect').innerHTML = Object.entries(VARIANTS).map(([id, name]) =>
      `<label class="check" style="flex:none"><input type="checkbox" data-p="${id}" ${cfg.firmware.protect.includes(id) ? 'checked' : ''}> ${name}</label>`).join('');
    $('fw-hint').value = cfg.firmware.hint || '';
    const on = !!cfg.firmware.password_sha256;
    $('fw-pass-state').textContent = on ? 'Đang bật' : 'Đang tắt';
    $('fw-pass-state').className = 'pill' + (on ? '' : ' off');
  }
  $('variant-list').addEventListener('change', e => { const id = e.target.dataset.v; if (id) { cfg.variants[id] = { ...(cfg.variants[id] || {}), visible: e.target.checked }; dirty(); } });
  $('fw-protect').addEventListener('change', () => { cfg.firmware.protect = [...$('fw-protect').querySelectorAll('input:checked')].map(x => x.dataset.p); dirty(); });
  $('fw-hint').addEventListener('input', e => { cfg.firmware.hint = e.target.value.trim(); dirty(); });
  $('fw-pass-set').addEventListener('click', async () => {
    const p = $('fw-pass').value;
    if (p.length < 4) return setMsg($('save-msg'), 'Mật khẩu nạp firmware tối thiểu 4 ký tự.', false);
    cfg.firmware.password_sha256 = await hash('hynhi-fw:', p);
    $('fw-pass').value = ''; renderFirmware(); renderGeneral(); dirty();
  });
  $('fw-pass-clear').addEventListener('click', () => { cfg.firmware.password_sha256 = ''; renderFirmware(); renderGeneral(); dirty(); });

  function renderMcp() {
    $('mcp-server').value = cfg.mcp.server || '';
    const on = !!cfg.mcp.password_sha256;
    $('mcp-pass-state').textContent = on ? 'Đang bật' : 'Đang tắt';
    $('mcp-pass-state').className = 'pill' + (on ? '' : ' off');
  }
  $('mcp-server').addEventListener('input', e => { cfg.mcp.server = e.target.value.trim().replace(/\/+$/, ''); dirty(); });
  $('mcp-pass-set').addEventListener('click', async () => {
    const p = $('mcp-pass').value;
    if (p.length < 4) return setMsg($('save-msg'), 'Mật khẩu MCP tối thiểu 4 ký tự.', false);
    cfg.mcp.password_sha256 = await hash('hynhi-mcp:', p);
    $('mcp-pass').value = ''; renderMcp(); renderGeneral(); dirty();
  });
  $('mcp-pass-clear').addEventListener('click', () => { cfg.mcp.password_sha256 = ''; renderMcp(); renderGeneral(); dirty(); });
  async function mcpAdmin(path, body) {
    const r = await fetch((cfg.mcp.server || DEFAULT_CFG.mcp.server) + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!r.ok) throw new Error(r.status === 403 ? 'Sai ADMIN_KEY' : 'HTTP ' + r.status);
    return r.json();
  }
  async function loadDevices() {
    const key = $('mcp-key').value;
    const tb = $('mcp-devices');
    tb.innerHTML = '<tr><td colspan="5">Đang tải… (máy chủ miễn phí có thể mất ~50 s để thức dậy)</td></tr>';
    try {
      const d = await mcpAdmin('/api/admin?key=' + encodeURIComponent(key));
      tb.innerHTML = d.devices.length ? d.devices.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.state)}${x.error && x.state !== 'online' ? `<br><small>${esc(x.error)}</small>` : ''}</td>
        <td>${x.calls}</td><td><code>${esc(x.endpoint)}</code></td><td><button class="mini danger" data-del="${esc(x.id)}">Xoá</button></td></tr>`).join('')
        : '<tr><td colspan="5">Chưa có robot nào.</td></tr>';
    } catch (e) { tb.innerHTML = `<tr><td colspan="5">Lỗi: ${esc(e.message)}</td></tr>`; }
  }
  $('mcp-load').addEventListener('click', loadDevices);
  $('mcp-devices').addEventListener('click', async e => {
    const id = e.target.dataset.del;
    if (!id) return;
    if (e.target.dataset.confirm !== '1') { e.target.dataset.confirm = '1'; e.target.textContent = 'Chắc chắn?'; return; }
    try { await mcpAdmin('/api/admin/remove', { key: $('mcp-key').value, id }); loadDevices(); }
    catch (err) { e.target.textContent = err.message; }
  });

  function renderTexts() {
    const f = $('txt-filter').value.trim().toLowerCase(), v = $('txt-view').value;
    const keys = Object.keys(defaults).filter(k => (!v || k.startsWith(v + '.')) &&
      (!f || k.toLowerCase().includes(f) || defaults[k].toLowerCase().includes(f) || (cfg.texts[k] || '').toLowerCase().includes(f)));
    $('txt-list').innerHTML = keys.map(k => `
      <div class="txt ${cfg.texts[k] ? 'changed' : ''}" data-k="${esc(k)}">
        <span class="k">${esc(k)}</span>
        <span class="d">Mặc định: ${esc(defaults[k].replace(/<[^>]+>/g, ' '))}</span>
        <textarea placeholder="Để trống = dùng mặc định">${esc(cfg.texts[k] || '')}</textarea>
        ${cfg.texts[k] ? '<span><button class="mini" data-reset>Khôi phục mặc định</button></span>' : ''}
      </div>`).join('') || '<p>Không có mục phù hợp.</p>';
  }
  $('txt-filter').addEventListener('input', renderTexts);
  $('txt-view').addEventListener('change', renderTexts);
  $('txt-list').addEventListener('input', e => {
    const box = e.target.closest('.txt'), k = box.dataset.k, v = e.target.value.trim();
    if (v) cfg.texts[k] = v; else delete cfg.texts[k];
    box.classList.toggle('changed', !!v);
    dirty();
  });
  $('txt-list').addEventListener('click', e => {
    if (!e.target.hasAttribute('data-reset')) return;
    delete cfg.texts[e.target.closest('.txt').dataset.k];
    renderTexts(); dirty();
  });

  async function renderHistory() {
    const tb = $('hist');
    try {
      const list = await gh(`/repos/${repo}/commits?path=${FILE}&per_page=15`);
      tb.innerHTML = list.map(c => `<tr><td>${new Date(c.commit.author.date).toLocaleString('vi-VN')}</td><td>${esc(c.commit.message.split('\n')[0])}</td>
        <td><button class="mini" data-sha="${c.sha}">Nạp bản này vào trình sửa</button></td></tr>`).join('') || '<tr><td>Chưa có lần lưu nào.</td></tr>';
    } catch (e) { tb.innerHTML = `<tr><td>Lỗi: ${esc(e.message)}</td></tr>`; }
  }
  $('hist').addEventListener('click', async e => {
    const s = e.target.dataset.sha;
    if (!s) return;
    const f = await gh(`/repos/${repo}/contents/${FILE}?ref=${s}`);
    cfg = merge(DEFAULT_CFG, JSON.parse(b64dec(f.content)));
    renderAll(); dirty();
    setMsg($('save-msg'), 'Đã nạp bản cũ vào trình sửa. Bấm Lưu để áp dụng.');
  });

  async function hash(salt, text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Lưu ---------- */
  $('save').addEventListener('click', async () => {
    if (!dirty()) return;
    const btn = $('save');
    btn.disabled = true;
    setMsg($('save-msg'), 'Đang lưu lên GitHub…');
    try {
      const body = { message: 'Quản trị: cập nhật cấu hình trang nạp', content: b64enc(serialize(cfg)), branch: 'main' };
      if (sha) body.sha = sha;
      const r = await gh(`/repos/${repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) });
      sha = r.content.sha;
      saved = serialize(cfg);
      setMsg($('save-msg'), 'Đã lưu. Trang nạp cập nhật sau khoảng 1 phút.', true);
      renderGeneral(); renderHistory();
    } catch (e) {
      const noWrite = e.status === 403 || /not accessible|permission/i.test(e.message);
      setMsg($('save-msg'), e.status === 409 ? 'Cấu hình vừa bị sửa ở nơi khác. Bấm Huỷ thay đổi để tải bản mới rồi sửa lại.'
        : noWrite ? 'Token chưa có quyền GHI. Vào github.com → Settings → Developer settings → Fine-grained tokens → sửa token: Repository access chọn hynhi-robot-flasher, '
          + 'Permissions → Contents: Read and write → Update. (Hoặc dùng token Classic có quyền "repo".) Rồi đăng xuất và đăng nhập lại.'
        : 'Lưu lỗi: ' + e.message, false);
    } finally { btn.disabled = false; }
  });
  $('revert').addEventListener('click', () => load());
  $('preview').addEventListener('click', () => { dirty(); window.open('./?preview=1#' + (cfg.tabs.find(t => t.visible !== false)?.id || 'firmware'), '_blank', 'noopener'); });

  document.querySelector('.adm-nav').addEventListener('click', e => {
    const p = e.target.closest('button')?.dataset.p;
    if (!p) return;
    document.querySelectorAll('.adm-nav button').forEach(b => b.setAttribute('aria-current', b.dataset.p === p ? 'true' : 'false'));
    document.querySelectorAll('[data-panel]').forEach(s => { s.hidden = s.dataset.panel !== p; });
  });
  window.addEventListener('beforeunload', e => { if (cfg && serialize(cfg) !== saved) e.preventDefault(); });

  const k = keep.get();
  if (k?.token) login(k.token, k.repo || 'ynguyenit-ui/hynhi-robot-flasher', !!localStorage.getItem('hynhi-admin')).catch(err => setMsg($('login-msg'), 'Phiên đăng nhập hết hạn: ' + err.message, false));
})();
