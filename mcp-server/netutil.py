"""HTTP helpers shared by the tools: short timeouts, a small TTL cache, text cleanup."""
import gzip
import html
import json
import re
import threading
import time
import urllib.parse
import urllib.request

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0 Safari/537.36')
_cache: dict = {}
_lock = threading.Lock()


class FetchError(Exception):
    pass


def fetch(url, data=None, headers=None, timeout=12, ttl=0, encoding=None, retries=2):
    """Return the body as text. ttl>0 caches successful responses for that many seconds."""
    key = (url, data if isinstance(data, (bytes, str)) else json.dumps(data, sort_keys=True))
    if ttl:
        with _lock:
            hit = _cache.get(key)
            if hit and hit[0] > time.time():
                return hit[1]
    h = {'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.8', 'Accept-Encoding': 'gzip'}
    h.update(headers or {})
    if isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
        h.setdefault('Content-Type', 'application/x-www-form-urlencoded')
    elif isinstance(data, str):
        data = data.encode()
    last, text = None, None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
                raw = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    raw = gzip.decompress(raw)
                cs = encoding or r.headers.get_content_charset() or 'utf-8'
                text = raw.decode(cs, 'replace')
            break
        except urllib.error.HTTPError as e:
            last = e
            if e.code < 500:
                break
        except Exception as e:  # timeouts, DNS, resets: retry once
            last = e
        time.sleep(0.4)
    if text is None:
        raise FetchError(f'Không lấy được dữ liệu ({type(last).__name__}: {last})')
    if ttl:
        with _lock:
            _cache[key] = (time.time() + ttl, text)
            if len(_cache) > 300:
                for k in sorted(_cache, key=lambda k: _cache[k][0])[:100]:
                    _cache.pop(k, None)
    return text


def fetch_json(url, data=None, headers=None, timeout=12, ttl=0):
    if isinstance(data, (dict, list)) and headers and headers.get('Content-Type') == 'application/json':
        data = json.dumps(data)
    return json.loads(fetch(url, data, headers, timeout, ttl))


def strip_tags(s):
    s = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', s or '')
    s = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</h\d>', '\n', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t\r\f\v]+', ' ', s)
    return re.sub(r'\n\s*\n+', '\n', s).strip()


def q(s):
    return urllib.parse.quote(str(s))


def fold(s):
    """Lowercase and drop Vietnamese diacritics for fuzzy matching."""
    import unicodedata
    s = unicodedata.normalize('NFD', str(s).lower().replace('đ', 'd').replace('Đ', 'd'))
    return re.sub(r'\s+', ' ', ''.join(c for c in s if unicodedata.category(c) != 'Mn')).strip()


def clip(s, n=3500):
    s = str(s)
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + ' …'


_ddg_block_until = 0.0


def _brave(query, n):
    import os
    key = os.environ.get('BRAVE_API_KEY')
    if not key:
        return []
    r = fetch_json('https://api.search.brave.com/res/v1/web/search?country=vn&search_lang=vi&count=%d&q=%s' % (n, q(query)),
                   headers={'X-Subscription-Token': key, 'Accept': 'application/json'}, ttl=600)
    return [{'title': strip_tags(x['title']), 'url': x['url'], 'snippet': strip_tags(x.get('description', ''))}
            for x in r.get('web', {}).get('results', [])]


def _google_cse(query, n):
    import os
    key, cx = os.environ.get('GOOGLE_API_KEY'), os.environ.get('GOOGLE_CSE_ID')
    if not (key and cx):
        return []
    r = fetch_json(f'https://www.googleapis.com/customsearch/v1?hl=vi&num={min(n, 10)}&key={key}&cx={cx}&q={q(query)}', ttl=600)
    return [{'title': x['title'], 'url': x['link'], 'snippet': x.get('snippet', '')} for x in r.get('items', [])]


def _ddg(query, n):
    global _ddg_block_until
    if time.time() < _ddg_block_until:
        return []
    # DuckDuckGo often hangs for cloud IPs: fail fast (4 s, no retry) and skip it for 10 minutes,
    # otherwise every search waited ~25 s before Google News answered.
    try:
        page = fetch('https://html.duckduckgo.com/html/?kl=vn-vi&q=' + urllib.parse.quote_plus(query), timeout=4, retries=1)
    except Exception:
        _ddg_block_until = time.time() + 600
        return []
    if 'result__a' not in page:  # rate limited ("anomaly" page): back off for 10 minutes
        _ddg_block_until = time.time() + 600
        return []
    out = []
    for m in re.finditer(r'(?s)<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
                         r'class="result__snippet"[^>]*>(.*?)</a>', page):
        href = html.unescape(m.group(1))
        u = urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get('uddg', [href])[0]
        if 'duckduckgo.com/y.js' not in u:  # skip ads
            out.append({'title': strip_tags(m.group(2)), 'url': u, 'snippet': strip_tags(m.group(3))})
    return out


def _gnews(query, n):
    import xml.etree.ElementTree as ET
    xml = fetch(f'https://news.google.com/rss/search?hl=vi&gl=VN&ceid=VN:vi&q={q(query)}', ttl=600)
    out = []
    for it in ET.fromstring(xml.encode('utf-8')).iter('item'):
        out.append({'title': it.findtext('title') or '', 'url': it.findtext('link') or '',
                    'snippet': f'{it.findtext("source") or ""} - {(it.findtext("pubDate") or "")[:16]}'})
    return out


def _wiki(query, n):
    r = fetch_json(f'https://vi.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit={n}&srsearch={q(query)}', ttl=3600)
    return [{'title': x['title'], 'url': 'https://vi.wikipedia.org/wiki/' + q(x['title'].replace(' ', '_')),
             'snippet': strip_tags(x.get('snippet', ''))} for x in r.get('query', {}).get('search', [])]


_search_cache = {}


def web_search(query, n=5):
    """List of {title, url, snippet}: Brave / Google CSE (if keys set), DuckDuckGo, Google News, Wikipedia."""
    hit = _search_cache.get(query)
    if hit and hit[0] > time.time():
        return hit[1][:n]
    for engine in (_brave, _google_cse, _ddg, _gnews, _wiki):
        try:
            res = engine(query, max(n, 5))
        except Exception:
            res = []
        if res:
            _search_cache[query] = (time.time() + 600, res)
            if len(_search_cache) > 200:
                _search_cache.clear()
            return res[:n]
    return []
