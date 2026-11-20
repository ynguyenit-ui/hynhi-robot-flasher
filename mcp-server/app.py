"""Hynhi MCP - máy chủ MCP trực tuyến cho robot Xiaozhi.

Mỗi robot đăng ký "MCP endpoint" (wss://api.xiaozhi.me/mcp/?token=...) lấy ở xiaozhi.me → Agent → Cấu hình.
Máy chủ giữ một kết nối WebSocket cho mỗi endpoint và trả lời initialize / tools/list / tools/call (JSON-RPC 2.0),
nên AI của robot dùng được toàn bộ công cụ ở đây mà không cần nạp lại firmware.
"""
import asyncio
import base64
import hashlib
import json
import logging
import os
import secrets
import time
import urllib.parse
from pathlib import Path

from aiohttp import ClientSession, ClientTimeout, WSMsgType, web

import registry
import t_lich  # noqa: F401  (registers tools)
import t_live
import t_tri_thuc  # noqa: F401

VERSION = '1.0.0'
ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('DATA_DIR', ROOT / 'data'))
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / 'devices.json'
MAX_DEVICES = int(os.environ.get('MAX_DEVICES', '300'))
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')
PUBLIC_URL = (os.environ.get('PUBLIC_URL') or os.environ.get('RENDER_EXTERNAL_URL') or '').rstrip('/')
RENDER_KEY, RENDER_SID = os.environ.get('RENDER_API_KEY', ''), os.environ.get('RENDER_SERVICE_ID', '')
ENV_STORE = 'MCP_DEVICES_B64'
# Mật khẩu đăng ký: biến môi trường, hoặc trường mcp.password_sha256 trong site-config.json của trang nạp (trang quản trị đặt).
SITE_CONFIG_URL = os.environ.get('SITE_CONFIG_URL', 'https://ynguyenit-ui.github.io/hynhi-robot-flasher/site-config.json')
PASS_SALT = 'hynhi-mcp:'
_pw = {'hash': '', 'at': 0.0}
t_live.CONFIG['city'] = os.environ.get('DEFAULT_CITY', 'Hà Nội')
log = logging.getLogger('hynhi-mcp')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
STARTED = time.time()


def mask(url):
    p = urllib.parse.urlparse(url)
    tok = urllib.parse.parse_qs(p.query).get('token', [''])[0]
    return f'{p.netloc}{p.path}?token=…{tok[-6:]}' if tok else p.netloc + p.path


def dev_id(url):
    return hashlib.sha256(url.encode()).hexdigest()[:12]


class Device:
    def __init__(self, rec):
        self.rec = rec
        self.state = 'connecting'
        self.error = ''
        self.since = 0.0
        self.calls = 0
        self.last_tool = ''
        self.last_call = 0.0
        self.task = None
        self.ws = None
        self.connected = asyncio.Event()
        self.fails = 0

    @property
    def url(self):
        return self.rec['url']

    def public(self, full=False):
        d = {'id': self.rec['id'], 'name': self.rec['name'], 'state': self.state, 'calls': self.calls,
             'online_since': int(self.since) if self.state == 'online' else None,
             'last_tool': self.last_tool, 'last_call': int(self.last_call) or None}
        if full:
            d.update(endpoint=mask(self.url), error=self.error, created=self.rec.get('created'))
        return d


class Hub:
    def __init__(self):
        self.devices: dict[str, Device] = {}
        self.session: ClientSession | None = None
        self.save_lock = asyncio.Lock()

    # ---------- persistence ----------
    def load(self):
        recs = []
        if DB.exists():
            try:
                recs = json.loads(DB.read_text('utf-8'))
            except Exception as e:
                log.warning('devices.json lỗi: %s', e)
        if not recs and os.environ.get(ENV_STORE):
            try:
                recs = json.loads(base64.b64decode(os.environ[ENV_STORE]).decode())
            except Exception as e:
                log.warning('%s lỗi: %s', ENV_STORE, e)
        for line in os.environ.get('MCP_ENDPOINTS', '').replace(';', '\n').splitlines():
            name, _, url = line.strip().rpartition('|')
            url = url.strip()
            if url.startswith(('ws://', 'wss://')) and not any(r['url'] == url for r in recs):
                recs.append({'id': dev_id(url), 'name': name.strip() or 'Robot', 'url': url, 'created': int(time.time()), 'pinned': True})
        return recs

    async def save(self):
        recs = [d.rec for d in self.devices.values()]
        async with self.save_lock:
            tmp = DB.with_suffix('.tmp')
            tmp.write_text(json.dumps(recs, ensure_ascii=False, indent=1), 'utf-8')
            os.replace(tmp, DB)
            if RENDER_KEY and RENDER_SID:  # Render free disks are wiped on restart: mirror into an env var
                val = base64.b64encode(json.dumps([r for r in recs if not r.get('pinned')], ensure_ascii=False).encode()).decode()
                try:
                    async with self.session.put(f'https://api.render.com/v1/services/{RENDER_SID}/env-vars/{ENV_STORE}',
                                                json={'value': val}, headers={'Authorization': f'Bearer {RENDER_KEY}'},
                                                timeout=ClientTimeout(total=15)) as r:
                        if r.status >= 300:
                            log.warning('Lưu env Render lỗi HTTP %s', r.status)
                except Exception as e:
                    log.warning('Lưu env Render lỗi: %s', e)

    # ---------- lifecycle ----------
    async def start(self, app):
        self.session = ClientSession(timeout=ClientTimeout(total=None, sock_connect=15))
        for rec in self.load():
            self.add(rec)
        await self.save()
        log.info('Hynhi MCP %s: %d công cụ, %d robot', VERSION, len(registry.TOOLS), len(self.devices))
        app['keepalive'] = asyncio.create_task(self.keepalive())

    async def stop(self, app):
        app['keepalive'].cancel()
        for d in self.devices.values():
            d.task.cancel()
        await self.session.close()

    def add(self, rec):
        d = Device(rec)
        self.devices[rec['id']] = d
        d.task = asyncio.create_task(self.run(d))
        return d

    async def remove(self, did):
        d = self.devices.pop(did, None)
        if d:
            d.task.cancel()
            if d.ws is not None:
                await d.ws.close()
        await self.save()
        return d

    async def keepalive(self):
        """Render/Railway free plans sleep without inbound traffic: ping our own public URL."""
        while True:
            await asyncio.sleep(600)
            if PUBLIC_URL:
                try:
                    async with self.session.get(PUBLIC_URL + '/healthz', timeout=ClientTimeout(total=20)) as r:
                        await r.read()
                except Exception as e:
                    log.info('keepalive: %s', e)

    # ---------- MCP over WebSocket ----------
    async def run(self, d: Device):
        while True:
            try:
                d.state, d.error, d.since = 'connecting', '', 0.0
                async with self.session.ws_connect(d.url, heartbeat=25, max_msg_size=4 * 1024 * 1024) as ws:
                    d.ws = ws
                    d.state, d.since = 'online', time.time()
                    d.connected.set()
                    log.info('[%s] đã kết nối %s', d.rec['name'], mask(d.url))
                    async for msg in ws:
                        if msg.type == WSMsgType.TEXT:
                            asyncio.create_task(self.on_message(d, ws, msg.data))
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                            break
                    d.error = f'đóng kết nối (mã {ws.close_code})'
            except asyncio.CancelledError:
                d.state = 'stopped'
                raise
            except Exception as e:
                d.error = str(e)[:200] or type(e).__name__
            d.ws = None
            # a session that lived a while was healthy: start the backoff over
            d.fails = 1 if d.since and time.time() - d.since > 60 else d.fails + 1
            bad_token = any(x in d.error for x in ('401', '403', '4001', '4003', '4004'))
            d.state = 'error' if bad_token or d.fails > 2 else 'connecting'
            d.connected.set()
            delay = min(600 if bad_token else 120, 2 ** min(d.fails, 7))
            log.info('[%s] mất kết nối: %s → thử lại sau %ss', d.rec['name'], d.error, delay)
            await asyncio.sleep(delay)

    async def on_message(self, d, ws, raw):
        try:
            msg = json.loads(raw)
        except ValueError:
            return
        for m in (msg if isinstance(msg, list) else [msg]):
            if not isinstance(m, dict) or 'method' not in m:
                continue
            resp = await self.handle(d, m)
            if resp is not None and 'id' in m and not ws.closed:
                await ws.send_str(json.dumps({'jsonrpc': '2.0', 'id': m['id'], **resp}, ensure_ascii=False))

    async def handle(self, d, m):
        method, params = m['method'], m.get('params') or {}
        disabled = set(d.rec.get('disabled_groups') or [])
        if method == 'initialize':
            return {'result': {'protocolVersion': params.get('protocolVersion', '2024-11-05'),
                               'capabilities': {'tools': {'listChanged': False}},
                               'serverInfo': {'name': 'Hynhi MCP', 'version': VERSION}}}
        if method == 'tools/list':
            return {'result': {'tools': registry.schemas(disabled)}}
        if method == 'tools/call':
            name = params.get('name', '')
            d.calls += 1
            d.last_tool, d.last_call = name, time.time()
            t0 = time.time()
            try:
                text, err = await asyncio.wait_for(
                    asyncio.to_thread(registry.call, name, params.get('arguments') or {}, disabled), 28)
            except asyncio.TimeoutError:
                text, err = 'Nguồn dữ liệu phản hồi quá chậm, hãy thử lại sau.', True
            log.info('[%s] %s %s → %s (%.1fs)', d.rec['name'], name, json.dumps(params.get('arguments'), ensure_ascii=False)[:120],
                     'lỗi' if err else 'ok', time.time() - t0)
            return {'result': {'content': [{'type': 'text', 'text': text}], 'isError': err}}
        if method == 'ping':
            return {'result': {}}
        if method.startswith('notifications/'):
            return None
        return {'error': {'code': -32601, 'message': f'Method not found: {method}'}}


hub = Hub()
_rate: dict = {}


def hash_pw(p):
    return hashlib.sha256((PASS_SALT + (p or '')).encode()).hexdigest()


async def required_hash():
    if os.environ.get('REGISTER_PASSWORD'):
        return hash_pw(os.environ['REGISTER_PASSWORD'])
    if SITE_CONFIG_URL and time.time() - _pw['at'] > 120:
        _pw['at'] = time.time()
        try:
            async with hub.session.get(SITE_CONFIG_URL, params={'t': int(time.time())}, timeout=ClientTimeout(total=8)) as r:
                if r.status == 200:
                    _pw['hash'] = ((await r.json(content_type=None)).get('mcp') or {}).get('password_sha256', '') or ''
        except Exception as e:
            log.info('site-config: %s', e)
    return _pw['hash']


def rate_ok(request, key, per_min):
    ip = request.headers.get('X-Forwarded-For', request.remote or '').split(',')[0].strip()
    now = time.time()
    bucket = [t for t in _rate.get((key, ip), []) if now - t < 60]
    if len(bucket) >= per_min:
        return False
    bucket.append(now)
    _rate[(key, ip)] = bucket
    return True


@web.middleware
async def cors(request, handler):
    if request.method == 'OPTIONS':
        resp = web.Response()
    else:
        try:
            resp = await handler(request)
        except web.HTTPException as e:
            resp = e
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp


def j(data, status=200):
    return web.json_response(data, status=status, dumps=lambda o: json.dumps(o, ensure_ascii=False))


async def body(request):
    try:
        return await request.json()
    except Exception:
        return dict(await request.post())


def valid_endpoint(url):
    p = urllib.parse.urlparse(url)
    return p.scheme in ('ws', 'wss') and p.netloc and 'token=' in p.query


async def api_status(request):
    devs = list(hub.devices.values())
    return j({'version': VERSION, 'uptime': int(time.time() - STARTED), 'tools': len(registry.TOOLS),
              'devices': len(devs), 'online': sum(d.state == 'online' for d in devs),
              'calls': sum(d.calls for d in devs), 'list': [d.public() for d in devs]})


async def api_tools(request):
    return j({'groups': registry.GROUPS, 'tools': [
        {'name': t['name'], 'group': t['group'], 'description': t['schema']['description'],
         'params': list(t['schema']['inputSchema']['properties'])} for t in registry.TOOLS.values()]})


async def api_register(request):
    if not rate_ok(request, 'reg', 6):
        return j({'ok': False, 'message': 'Thao tác quá nhanh, thử lại sau 1 phút.'}, 429)
    b = await body(request)
    url, name = (b.get('url') or '').strip(), (b.get('name') or 'Robot').strip()[:40]
    if not valid_endpoint(url):
        return j({'ok': False, 'message': 'Địa chỉ phải là MCP endpoint dạng wss://api.xiaozhi.me/mcp/?token=...'}, 400)
    need = await required_hash()
    if need and not secrets.compare_digest(hash_pw(b.get('password')), need):
        return j({'ok': False, 'need_password': True, 'message': 'Sai mật khẩu kết nối MCP (hỏi người quản trị trang nạp).'}, 403)
    did = dev_id(url)
    groups = [g for g in (b.get('disabled_groups') or []) if g in registry.GROUPS]
    if did in hub.devices:
        old = await hub.remove(did)
        rec = {**old.rec, 'name': name, 'disabled_groups': groups}
    else:
        if len(hub.devices) >= MAX_DEVICES:
            return j({'ok': False, 'message': 'Máy chủ đã đủ số robot, hãy tự triển khai máy chủ riêng.'}, 503)
        rec = {'id': did, 'name': name, 'url': url, 'created': int(time.time()), 'disabled_groups': groups}
    d = hub.add(rec)
    await hub.save()
    try:
        await asyncio.wait_for(d.connected.wait(), 10)
    except asyncio.TimeoutError:
        pass
    ok = d.state == 'online'
    return j({'ok': ok, 'id': did, 'state': d.state,
              'message': (f'Đã kết nối "{name}". Nói với robot: "thời tiết hôm nay thế nào" để thử.' if ok else
                          f'Đã lưu nhưng chưa kết nối được ({d.error or "đang thử"}). Kiểm tra lại endpoint trên xiaozhi.me.')})


async def api_unregister(request):
    if not rate_ok(request, 'unreg', 10):
        return j({'ok': False, 'message': 'Thao tác quá nhanh.'}, 429)
    url = ((await body(request)).get('url') or '').strip()
    d = await hub.remove(dev_id(url))
    return j({'ok': bool(d), 'message': f'Đã xoá "{d.rec["name"]}".' if d else 'Không tìm thấy endpoint này.'})


async def api_device(request):
    url = ((await body(request)).get('url') or '').strip()
    d = hub.devices.get(dev_id(url))
    if not d:
        return j({'ok': False, 'message': 'Endpoint này chưa đăng ký.'}, 404)
    return j({'ok': True, 'device': {**d.public(True), 'disabled_groups': d.rec.get('disabled_groups', [])}})


async def api_try(request):
    if not rate_ok(request, 'try', 20):
        return j({'ok': False, 'text': 'Thử quá nhiều, đợi 1 phút.'}, 429)
    b = await body(request)
    args = b.get('args') or {}
    if isinstance(args, str):
        try:
            args = json.loads(args or '{}')
        except ValueError:
            return j({'ok': False, 'text': 'args phải là JSON.'}, 400)
    t0 = time.time()
    text, err = await asyncio.to_thread(registry.call, b.get('tool', ''), args)
    return j({'ok': not err, 'text': text, 'ms': int((time.time() - t0) * 1000)})


async def api_admin(request):
    if not ADMIN_KEY or not secrets.compare_digest(request.query.get('key', ''), ADMIN_KEY):
        raise web.HTTPForbidden()
    return j({'devices': [d.public(True) for d in hub.devices.values()]})


async def api_admin_remove(request):
    b = await body(request)
    if not ADMIN_KEY or not secrets.compare_digest(str(b.get('key', '')), ADMIN_KEY):
        raise web.HTTPForbidden()
    d = await hub.remove(str(b.get('id', '')))
    return j({'ok': bool(d)})


_gplx_cache: dict = {}


async def gplx_image(request):
    """JPEG picture of a driving-theory question, for self.screen.show_image on the robot."""
    try:
        qid = int(request.match_info['qid'])
    except ValueError:
        raise web.HTTPNotFound()
    data = _gplx_cache.get(qid)
    if data is None:
        try:
            data = await asyncio.to_thread(t_tri_thuc.gplx_image_jpeg, qid)
        except Exception as e:
            log.warning('gplx %s: %s', qid, e)
            raise web.HTTPBadGateway()
        if not data:
            raise web.HTTPNotFound()
        if len(_gplx_cache) > 400:
            _gplx_cache.clear()
        _gplx_cache[qid] = data
    return web.Response(body=data, content_type='image/jpeg', headers={'Cache-Control': 'public, max-age=86400'})


async def healthz(request):
    return web.Response(text='ok')


async def index(request):
    return web.FileResponse(ROOT / 'static' / 'index.html')


def make_app():
    app = web.Application(middlewares=[cors], client_max_size=64 * 1024)
    app.router.add_get('/', index)
    app.router.add_get('/healthz', healthz)
    app.router.add_get('/gplx/{qid}.jpg', gplx_image)
    app.router.add_get('/api/status', api_status)
    app.router.add_get('/api/tools', api_tools)
    app.router.add_post('/api/register', api_register)
    app.router.add_post('/api/unregister', api_unregister)
    app.router.add_post('/api/device', api_device)
    app.router.add_post('/api/try', api_try)
    app.router.add_get('/api/admin', api_admin)
    app.router.add_post('/api/admin/remove', api_admin_remove)
    app.router.add_route('OPTIONS', '/{tail:.*}', healthz)
    app.on_startup.append(hub.start)
    app.on_cleanup.append(hub.stop)
    return app


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == '--call':  # python app.py --call weather_forecast '{"city":"Huế"}'
        sys.stdout.reconfigure(encoding='utf-8')
        print(registry.call(sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}))
        raise SystemExit
    web.run_app(make_app(), host='0.0.0.0', port=int(os.environ.get('PORT', '8080')))
