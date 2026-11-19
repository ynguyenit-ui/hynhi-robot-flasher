/* Áp cấu hình do trang quản trị (admin.html) lưu trong site-config.json: thông báo, tab, nội dung, mật khẩu nạp. */
window.hynhiPreview = new URLSearchParams(location.search).has('preview');
window.hynhiConfig = (() => {
  if (window.hynhiPreview) {  // admin.html → "Xem trước": bản nháp chưa lưu
    try { const d = JSON.parse(localStorage.getItem('hynhi-preview-config') || 'null'); if (d) return Promise.resolve(d); } catch { /* dùng bản thật */ }
  }
  return fetch('site-config.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : {})).catch(() => ({}));
})();

window.hynhiHash = async (salt, text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

(() => {
  const ss = { get(k) { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* chỉ trong phiên */ } } };

  function applyTabs(cfg) {
    const nav = document.querySelector('.tabs');
    if (!Array.isArray(cfg.tabs) || !nav) return;
    cfg.tabs.forEach(t => {
      const a = nav.querySelector(`a[href="#${t.id}"]`);
      if (!a) return;
      if (t.label) a.lastChild.textContent = t.label;
      a.hidden = t.visible === false;
      nav.appendChild(a);  // theo thứ tự trong cấu hình
    });
    const first = cfg.tabs.find(t => t.visible !== false);
    const cur = cfg.tabs.find(t => '#' + t.id === location.hash);
    if (first && ((cur && cur.visible === false) || (!location.hash && cfg.tabs[0]?.visible === false))) location.hash = first.id;
    document.querySelector('.brand')?.setAttribute('href', '#' + (first?.id || 'firmware'));
  }

  function applyTexts(cfg) {
    Object.entries(cfg.texts || {}).forEach(([k, v]) => {
      document.querySelectorAll(`[data-edit="${CSS.escape(k)}"]`).forEach(el => { if (v != null && v !== '') el.innerHTML = v; });
    });
  }

  function applyAnnouncement(cfg) {
    const a = cfg.announcement || {};
    if (!a.text) return;
    const bar = document.createElement('div');
    bar.className = 'announce announce-' + (a.tone || 'info');
    bar.setAttribute('role', 'status');
    bar.innerHTML = a.text;
    document.querySelector('main')?.prepend(bar);
  }

  function applyVariants(cfg) {
    const v = cfg.variants || {};
    document.querySelectorAll('[data-fw-pick]').forEach(b => { b.hidden = v[b.dataset.fwPick]?.visible === false; });
    const sel = document.querySelector('[data-fw-pick][aria-checked="true"]');
    if (sel && sel.hidden) document.querySelector('[data-fw-pick]:not([hidden])')?.click();
  }

  function applyTheme(cfg) {
    const c = cfg.theme?.accent;
    if (c && /^#[0-9a-f]{6}$/i.test(c)) {
      const r = document.documentElement.style;
      r.setProperty('--accent', c);
      r.setProperty('--accent-strong', `color-mix(in srgb, ${c} 85%, #000)`);
      r.setProperty('--accent-soft', `color-mix(in srgb, ${c} 12%, transparent)`);
    }
  }

  /* Mật khẩu nút nạp firmware: chặn bấm "Kết nối và nạp" tới khi nhập đúng (nhớ trong phiên). */
  function applyFirmwareLock(cfg) {
    const fw = cfg.firmware || {};
    if (!fw.password_sha256) return;
    const protect = Array.isArray(fw.protect) && fw.protect.length ? fw.protect : ['custom', 'cam', 'btbridge'];
    const installer = document.getElementById('installer');
    if (!installer) return;
    const box = document.createElement('form');
    box.className = 'fw-lock';
    box.hidden = true;
    box.innerHTML = `<label>Nhập mật khẩu nạp firmware${fw.hint ? ` <small>(${fw.hint})</small>` : ''}
      <span class="fw-lock-row"><input type="password" autocomplete="off" required><button class="button" type="submit">Mở khoá</button></span></label>
      <p class="fw-lock-msg" role="status"></p>`;
    installer.closest('.actions').after(box);
    const current = () => document.querySelector('[data-fw-pick][aria-checked="true"]')?.dataset.fwPick || 'custom';
    const locked = () => protect.includes(current()) && ss.get('hynhi-fw-unlock') !== fw.password_sha256;
    installer.addEventListener('click', e => {
      if (!locked()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      box.hidden = false;
      box.querySelector('input').focus();
    }, true);
    box.addEventListener('submit', async e => {
      e.preventDefault();
      const h = await window.hynhiHash('hynhi-fw:', box.querySelector('input').value);
      if (h !== fw.password_sha256) { box.querySelector('.fw-lock-msg').textContent = 'Sai mật khẩu.'; return; }
      ss.set('hynhi-fw-unlock', h);
      box.hidden = true;
      installer.querySelector('[slot="activate"]')?.click();
    });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const cfg = await window.hynhiConfig;
    if (!cfg || typeof cfg !== 'object') return;
    applyTheme(cfg);
    applyTexts(cfg);
    applyTabs(cfg);
    applyAnnouncement(cfg);
    if (window.hynhiPreview) applyAnnouncement({ announcement: { text: 'Đang xem trước bản nháp từ trang quản trị (chưa lưu).', tone: 'warn' } });
    applyVariants(cfg);
    applyFirmwareLock(cfg);
  });
})();
