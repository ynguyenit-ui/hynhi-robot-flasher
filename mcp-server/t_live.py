"""Live-data tools: weather, news, lottery, Wikipedia, web search, markets, tax codes, translation."""
import datetime as dt
import json
import re
import xml.etree.ElementTree as ET

from netutil import FetchError, clip, fetch, fetch_json, fold, q, strip_tags, web_search
from registry import I, S, tool

CONFIG = {'city': 'Hà Nội'}  # app.py sets this from DEFAULT_CITY


def vn(x, dec=0):
    """Vietnamese number format: 1.234.567,89"""
    return f'{float(x):,.{dec}f}'.replace(',', '_').replace('.', ',').replace('_', '.')

WMO = {0: 'trời quang', 1: 'ít mây', 2: 'có mây', 3: 'nhiều mây, u ám', 45: 'sương mù', 48: 'sương mù đóng băng',
       51: 'mưa phùn nhẹ', 53: 'mưa phùn', 55: 'mưa phùn dày', 56: 'mưa phùn lạnh', 57: 'mưa phùn lạnh dày',
       61: 'mưa nhỏ', 63: 'mưa vừa', 65: 'mưa to', 66: 'mưa lạnh', 67: 'mưa lạnh to', 71: 'tuyết nhẹ',
       73: 'tuyết', 75: 'tuyết dày', 77: 'mưa tuyết', 80: 'mưa rào nhẹ', 81: 'mưa rào', 82: 'mưa rào rất to',
       85: 'mưa tuyết rào', 86: 'mưa tuyết rào to', 95: 'dông', 96: 'dông kèm mưa đá', 99: 'dông mạnh, mưa đá'}
THU = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']
CITY_ALIAS = {'sai gon': 'Ho Chi Minh City', 'tp hcm': 'Ho Chi Minh City', 'hcm': 'Ho Chi Minh City',
              'ho chi minh': 'Ho Chi Minh City', 'tphcm': 'Ho Chi Minh City', 'ha noi': 'Hanoi', 'hue': 'Hue',
              'da nang': 'Da Nang', 'vung tau': 'Vung Tau', 'nha trang': 'Nha Trang', 'da lat': 'Da Lat'}


def _geocode(city):
    name = CITY_ALIAS.get(fold(city), city)
    for lang in ('vi', 'en'):
        r = fetch_json(f'https://geocoding-api.open-meteo.com/v1/search?count=5&language={lang}&name={q(name)}', ttl=86400)
        res = r.get('results') or []
        vn = [x for x in res if x.get('country_code') == 'VN']
        if res:
            return (vn or res)[0]
    raise FetchError(f'Không tìm thấy địa điểm "{city}"')


def _aqi_text(v):
    if v is None:
        return ''
    for lim, t in ((50, 'tốt'), (100, 'trung bình'), (150, 'kém cho nhóm nhạy cảm'), (200, 'xấu'), (300, 'rất xấu')):
        if v <= lim:
            return t
    return 'nguy hại'


@tool('weather_forecast', 'tra_cuu',
      'Thời tiết hiện tại, chất lượng không khí (AQI) và dự báo nhiều ngày cho bất kỳ tỉnh/thành/địa điểm nào '
      'ở Việt Nam hoặc thế giới. Dùng khi người dùng hỏi thời tiết, nhiệt độ, mưa, nắng, có nên mang ô.',
      {'city': S('Tên địa điểm, ví dụ "Hà Nội", "Đà Lạt", "Tokyo". Bỏ trống = thành phố mặc định'),
       'days': I('Số ngày dự báo (1-7)', 1, 7, 3)})
def weather_forecast(city=None, days=3):
    g = _geocode(city or CONFIG.get('city') or 'Hà Nội')
    lat, lon = g['latitude'], g['longitude']
    w = fetch_json('https://api.open-meteo.com/v1/forecast?timezone=auto'
                   f'&latitude={lat}&longitude={lon}&forecast_days={days}'
                   '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,uv_index'
                   '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset',
                   ttl=600)
    try:
        a = fetch_json(f'https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi,pm2_5',
                       ttl=1800)['current']
    except Exception:
        a = {}
    c = w['current']
    place = ', '.join(x for x in (g.get('name'), g.get('admin1'), g.get('country')) if x)
    lines = [f'Thời tiết {place} lúc {c["time"][11:16]}: {WMO.get(c["weather_code"], "")}, {c["temperature_2m"]:.0f}°C '
             f'(cảm giác {c["apparent_temperature"]:.0f}°C), độ ẩm {c["relative_humidity_2m"]}%, gió {c["wind_speed_10m"]:.0f} km/h'
             + (f', UV {c["uv_index"]:.0f}' if c.get('uv_index') is not None else '') + '.']
    if a.get('us_aqi') is not None:
        lines.append(f'Không khí: AQI {a["us_aqi"]:.0f} ({_aqi_text(a["us_aqi"])}), PM2.5 {a.get("pm2_5", 0):.0f} µg/m³.')
    d = w['daily']
    for i, day in enumerate(d['time']):
        dd = dt.date.fromisoformat(day)
        label = 'Hôm nay' if i == 0 else 'Ngày mai' if i == 1 else f'{THU[dd.weekday()]} {dd.day}/{dd.month}'
        lines.append(f'{label}: {WMO.get(d["weather_code"][i], "")}, {d["temperature_2m_min"][i]:.0f}–{d["temperature_2m_max"][i]:.0f}°C, '
                     f'khả năng mưa {d["precipitation_probability_max"][i] or 0}% ({d["precipitation_sum"][i] or 0:.1f} mm), '
                     f'UV tối đa {d["uv_index_max"][i] or 0:.0f}' + (f', mặt trời mọc {d["sunrise"][i][11:]} lặn {d["sunset"][i][11:]}' if i == 0 else '') + '.')
    return '\n'.join(lines)


# ---------------- News ----------------
NEWS_CATS = {'moi-nhat': 'tin-moi-nhat', 'noi-bat': 'tin-noi-bat', 'thoi-su': 'thoi-su', 'the-gioi': 'the-gioi',
             'kinh-doanh': 'kinh-doanh', 'giai-tri': 'giai-tri', 'the-thao': 'the-thao', 'phap-luat': 'phap-luat',
             'giao-duc': 'giao-duc', 'suc-khoe': 'suc-khoe', 'doi-song': 'gia-dinh', 'du-lich': 'du-lich',
             'khoa-hoc': 'khoa-hoc', 'so-hoa': 'so-hoa', 'xe': 'oto-xe-may', 'bat-dong-san': 'bat-dong-san'}
TT_CATS = {'moi-nhat': 'tin-moi-nhat', 'noi-bat': 'tin-moi-nhat', 'thoi-su': 'thoi-su', 'the-gioi': 'the-gioi',
           'kinh-doanh': 'kinh-doanh', 'giai-tri': 'giai-tri', 'the-thao': 'the-thao', 'phap-luat': 'phap-luat',
           'giao-duc': 'giao-duc', 'suc-khoe': 'suc-khoe', 'doi-song': 'nhip-song-tre', 'du-lich': 'du-lich',
           'khoa-hoc': 'khoa-hoc', 'so-hoa': 'cong-nghe', 'xe': 'xe', 'bat-dong-san': 'nha-dat'}
_last_news: list = []


def _rss(url, ttl=300):
    root = ET.fromstring(fetch(url, ttl=ttl).encode('utf-8'))
    items = []
    for it in root.iter('item'):
        desc = it.findtext('description') or ''
        items.append({'title': (it.findtext('title') or '').strip(), 'link': (it.findtext('link') or '').strip(),
                      'desc': strip_tags(desc), 'date': it.findtext('pubDate') or ''})
    return items


@tool('news_headlines', 'tra_cuu',
      'Đọc tin tức mới nhất từ VnExpress/Tuổi Trẻ theo chuyên mục. Sau đó có thể dùng news_read_article để đọc chi tiết một bài.',
      {'category': S('Chuyên mục', list(NEWS_CATS), 'moi-nhat'),
       'keyword': S('Lọc theo từ khoá (tuỳ chọn), ví dụ "bão", "giá xăng"'),
       'count': I('Số tin (1-10)', 1, 10, 5),
       'source': S('Nguồn báo', ['vnexpress', 'tuoitre'], 'vnexpress')})
def news_headlines(category='moi-nhat', keyword=None, count=5, source='vnexpress'):
    global _last_news
    cat = category if category in NEWS_CATS else 'moi-nhat'
    url = (f'https://tuoitre.vn/rss/{TT_CATS[cat]}.rss' if source == 'tuoitre'
           else f'https://vnexpress.net/rss/{NEWS_CATS[cat]}.rss')
    items = _rss(url)
    if keyword:
        k = fold(keyword)
        items = [i for i in items if k in fold(i['title'] + ' ' + i['desc'])]
        if not items:
            hits = web_search(f'{keyword} tin tức mới nhất', 5)
            return 'Không thấy tin phù hợp trong chuyên mục. Kết quả tìm trên web:\n' + '\n'.join(
                f'- {h["title"]}: {h["snippet"]}' for h in hits)
    _last_news = items[:count]
    out = [f'Tin {cat.replace("-", " ")} ({source}):']
    for n, i in enumerate(_last_news, 1):
        out.append(f'{n}. {i["title"]}. {clip(i["desc"], 220)}')
    out.append('(Người dùng có thể yêu cầu đọc chi tiết bài theo số thứ tự.)')
    return '\n'.join(out)


@tool('news_read_article', 'tra_cuu',
      'Đọc nội dung chi tiết một bài báo: theo số thứ tự trong danh sách tin vừa đọc, hoặc theo đường link.',
      {'index': I('Số thứ tự bài trong danh sách vừa đọc (1-10)', 1, 10), 'url': S('Link bài báo (tuỳ chọn)')})
def news_read_article(index=None, url=None):
    if not url:
        if not _last_news:
            return 'Chưa có danh sách tin. Hãy gọi news_headlines trước.'
        url = _last_news[min(max(index or 1, 1), len(_last_news)) - 1]['link']
    page = fetch(url, ttl=1800)
    title = strip_tags((re.search(r'(?is)<h1[^>]*>(.*?)</h1>', page) or re.search(r'(?is)<title>(.*?)</title>', page)).group(1))
    paras = re.findall(r'(?is)<p class="(?:description|Normal)"[^>]*>(.*?)</p>', page)
    if not paras:
        body = re.search(r'(?is)<div[^>]+(?:detail-content|fck_detail|article-content|detail__content)[^>]*>(.*?)</article>', page)
        paras = re.findall(r'(?is)<p[^>]*>(.*?)</p>', body.group(1) if body else page)
    text = '\n'.join(t for t in (strip_tags(p) for p in paras) if len(t) > 30)
    return clip(f'{title}\n{text}', 3500) if text else f'{title}\n(Không trích được nội dung bài.)'


# ---------------- Lottery ----------------
XS_REGIONS = {'mien-bac': 'mien-bac-xsmb', 'mien-trung': 'mien-trung-xsmt', 'mien-nam': 'mien-nam-xsmn'}


def _xs_items(region):
    return _rss(f'https://xskt.com.vn/rss-feed/{XS_REGIONS.get(region, "mien-bac-xsmb")}.rss', ttl=300)


def _xs_pick(items, date):
    if not date:
        return items[0] if items else None
    m = re.search(r'(\d{1,2})[/-](\d{1,2})', date)
    if not m:
        return items[0]
    tag = f'{int(m.group(1)):02d}/{int(m.group(2)):02d}'
    return next((i for i in items if tag in i['title']), None)


def _xs_format(desc):
    # "[An Giang] ĐB: 190579 1: 71864 ..." -> one line per province / prize
    desc = re.sub(r'\s+', ' ', desc)
    desc = re.sub(r'7: (\d{3})8: (\d{2})', r'7: \1 8: \2', desc)
    desc = re.sub(r'\s(ĐB|\d):', r'\n  \1:', desc)
    return desc.replace('[', '\n[').strip()


@tool('lottery_results', 'tra_cuu',
      'Kết quả xổ số kiến thiết Việt Nam (miền Bắc, Trung, Nam) theo ngày, có lọc theo tỉnh. Dữ liệu 7 ngày gần nhất.',
      {'region': S('Miền', list(XS_REGIONS), 'mien-bac'), 'date': S('Ngày dạng dd/mm, bỏ trống = kỳ mới nhất'),
       'province': S('Tỉnh (với miền Trung/Nam), ví dụ "An Giang"')})
def lottery_results(region='mien-bac', date=None, province=None):
    it = _xs_pick(_xs_items(region), date)
    if not it:
        return f'Chưa có kết quả {region} ngày {date} (chỉ lưu 7 ngày gần nhất hoặc chưa quay xong, quay lúc 16h15–18h30).'
    body = _xs_format(it['desc'])
    if province:
        blocks = re.split(r'\n(?=\[)', body)
        hit = [b for b in blocks if fold(province) in fold(b)]
        body = '\n'.join(hit) if hit else body
    return f'{it["title"]}\n{body}'


@tool('lottery_check_ticket', 'tra_cuu',
      'Dò vé số: so số vé với kết quả kỳ mới nhất (hoặc ngày chỉ định) của một miền, báo trúng giải nào, trùng 2 số cuối.',
      {'number': S('Dãy số trên vé, ví dụ "190579"'), 'region': S('Miền', list(XS_REGIONS), 'mien-bac'),
       'date': S('Ngày dd/mm (tuỳ chọn)')}, ['number'])
def lottery_check_ticket(number, region='mien-bac', date=None):
    num = re.sub(r'\D', '', number)
    it = _xs_pick(_xs_items(region), date)
    if not num or not it:
        return 'Không dò được (thiếu số vé hoặc chưa có kết quả).'
    hits, loto = [], []
    desc = re.sub(r'7: (\d{3})8: (\d{2})', r'7: \1 8: \2', it['desc'])
    for prov_block in re.split(r'(?=\[)', desc):
        prov = (re.match(r'\[([^\]]+)\]', prov_block.strip()) or [None, ''])[1]
        for prize, nums in re.findall(r'(ĐB|\d):\s*([\d\s-]+)', prov_block):
            for n in re.findall(r'\d+', nums):
                if num.endswith(n):
                    hits.append(f'{"Giải đặc biệt" if prize == "ĐB" else "Giải " + prize} ({n}){" - " + prov if prov else ""}')
                elif n[-2:] == num[-2:]:
                    loto.append(f'{prize}:{n}{" " + prov if prov else ""}')
    head = f'Dò vé {num} với {it["title"]}: '
    if hits:
        return head + 'TRÚNG ' + '; '.join(hits) + '. Hãy kiểm tra lại với vé gốc và đại lý.'
    return head + 'không trúng giải.' + (f' Trùng 2 số cuối với: {", ".join(loto[:6])}.' if loto else '')


# ---------------- Knowledge ----------------
@tool('wikipedia_lookup', 'tra_cuu',
      'Tra cứu bách khoa Wikipedia (tiếng Việt, tự chuyển tiếng Anh nếu thiếu): nhân vật, địa danh, sự kiện, khái niệm.',
      {'query': S('Chủ đề cần tra'), 'lang': S('Ngôn ngữ', ['vi', 'en'], 'vi')}, ['query'])
def wikipedia_lookup(query, lang='vi'):
    for lg in ([lang, 'en'] if lang != 'en' else ['en']):
        s = fetch_json(f'https://{lg}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch={q(query)}', ttl=3600)
        hits = s.get('query', {}).get('search', [])
        if not hits:
            continue
        title = hits[0]['title']
        e = fetch_json(f'https://{lg}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=0'
                       f'&exchars=2500&format=json&redirects=1&titles={q(title)}', ttl=3600)
        page = next(iter(e['query']['pages'].values()))
        text = re.sub(r'\n{2,}', '\n', page.get('extract', '')).strip()
        others = ', '.join(h['title'] for h in hits[1:])
        return clip(f'Wikipedia ({lg}) - {title}:\n{text}' + (f'\n(Mục liên quan: {others})' if others else ''), 3000)
    return f'Wikipedia không có mục nào cho "{query}".'


@tool('web_search', 'tra_cuu',
      'Tìm kiếm Internet (như Google) để lấy thông tin mới, sự kiện gần đây, giá cả, lịch chiếu, địa chỉ... '
      'Trả về tiêu đề, đoạn trích và link.',
      {'query': S('Câu tìm kiếm'), 'count': I('Số kết quả (1-8)', 1, 8, 5)}, ['query'])
def web_search_tool(query, count=5):
    hits = web_search(query, count)
    if not hits:
        return 'Không có kết quả.'
    return '\n'.join(f'{n}. {h["title"]}\n   {h["snippet"]}\n   {h["url"]}' for n, h in enumerate(hits, 1))


@tool('read_web_page', 'tra_cuu', 'Đọc nội dung văn bản của một trang web theo link (ví dụ link lấy từ web_search).',
      {'url': S('Địa chỉ trang')}, ['url'])
def read_web_page(url):
    if not re.match(r'https?://', url):
        return 'Link phải bắt đầu bằng http:// hoặc https://'
    page = fetch(url, ttl=900, timeout=15)
    blocks = [m.group(2) for m in re.finditer(r'(?is)<(article|main)[^>]*>(.*?)</\1>', page)]
    return clip(strip_tags(max(blocks, key=len) if blocks else page), 3500)


# ---------------- Finance ----------------
@tool('gold_price', 'tai_chinh', 'Giá vàng SJC trong nước (mua/bán theo khu vực) và giá vàng thế giới (USD/ounce).',
      {'branch': S('Khu vực', ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'], 'Hồ Chí Minh')})
def gold_price(branch='Hồ Chí Minh'):
    out = []
    try:
        r = fetch_json('https://sjc.com.vn/GoldPrice/Services/PriceService.ashx',
                       {'method': 'GetCurrentGoldPricesByBranch', 'BranchId': 1}, ttl=600)
        rows = [x for x in r.get('data', []) if fold(branch) in fold(x.get('BranchName', ''))] or r.get('data', [])
        out.append(f'Giá vàng SJC ({rows[0]["BranchName"] if rows else branch}), cập nhật {r.get("latestDate", "")}, đơn vị đồng/lượng:')
        table = []
        for x in rows[:8]:
            out.append(f'- {x["TypeName"]}: mua {x["Buy"].replace(",", ".")}, bán {x["Sell"].replace(",", ".")}')
            table.append([x['TypeName'].replace('Vàng ', '')[:22], vn(float(x['BuyValue']) / 1e6, 1), vn(float(x['SellValue']) / 1e6, 1)])
        hint = SHOW_TABLE.format(title='Giá vàng SJC', subtitle='Triệu đồng/lượng · ' + r.get('latestDate', ''), icon='gold',
                                 columns='Mua|Bán', rows=json.dumps(table[:6], ensure_ascii=False))
    except Exception as e:
        hint = ''
        out.append(f'Không lấy được giá SJC: {e}')
    try:
        m = fetch_json('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d', ttl=600)['chart']['result'][0]['meta']
        out.append(f'Vàng thế giới: {vn(m["regularMarketPrice"], 1)} USD/ounce.')
    except Exception:
        pass
    if hint:
        out.append(hint)
    return '\n'.join(out)


def _vcb_rates():
    xml = fetch('https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx', ttl=900)
    root = ET.fromstring(xml[xml.find('<ExrateList'):].encode('utf-8'))
    rates = {}
    for e in root.iter('Exrate'):
        num = lambda k: float(e.get(k).replace(',', '')) if e.get(k, '-').strip() not in ('-', '') else None
        rates[e.get('CurrencyCode')] = {'name': e.get('CurrencyName').strip(), 'buy': num('Buy'),
                                        'transfer': num('Transfer'), 'sell': num('Sell')}
    return rates, root.findtext('DateTime')


CUR_ALIAS = {'do': 'USD', 'do la': 'USD', 'dollar': 'USD', 'euro': 'EUR', 'yen': 'JPY', 'nhan dan te': 'CNY', 'te': 'CNY',
             'won': 'KRW', 'bang anh': 'GBP', 'bang': 'GBP', 'baht': 'THB', 'do uc': 'AUD', 'do sing': 'SGD',
             'do canada': 'CAD', 'franc': 'CHF', 'ruble': 'RUB', 'dong': 'VND', 'vnd': 'VND', 'ringgit': 'MYR',
             'rupee': 'INR', 'won han': 'KRW', 'dai te': 'TWD', 'do hong kong': 'HKD'}


def _cur(c):
    c = (c or 'USD').strip()
    return CUR_ALIAS.get(fold(c), c.upper()[:3])


@tool('exchange_rate', 'tai_chinh',
      'Tỷ giá ngoại tệ Vietcombank (mua/chuyển khoản/bán) và quy đổi tiền giữa các loại tiền tệ (USD, EUR, JPY, CNY, KRW, VND...).',
      {'currency': S('Mã hoặc tên ngoại tệ, ví dụ USD, yên, euro', default='USD'),
       'amount': {'type': 'number', 'description': 'Số tiền cần quy đổi (tuỳ chọn)'},
       'to': S('Quy đổi sang (mặc định VND)', default='VND')})
def exchange_rate(currency='USD', amount=None, to='VND'):
    src, dst = _cur(currency), _cur(to)
    lines = []
    try:
        rates, when = _vcb_rates()
        if src in rates and dst == 'VND':
            r = rates[src]
            f = lambda v: vn(v, 2 if v and v < 1000 else 0) if v else '-'
            lines.append(f'Tỷ giá Vietcombank {src} ({r["name"]}) lúc {when}: mua tiền mặt {f(r["buy"])} đ, '
                         f'chuyển khoản {f(r["transfer"])} đ, bán {f(r["sell"])} đ.')
    except Exception:
        pass
    if amount is not None or not lines:
        r = fetch_json(f'https://open.er-api.com/v6/latest/{src}', ttl=3600)
        if r.get('result') != 'success' or dst not in r['rates']:
            return '\n'.join(lines) or f'Không có tỷ giá {src}→{dst}.'
        rate = r['rates'][dst]
        if amount is not None:
            lines.append(f'{vn(amount, 2)} {src} ≈ {vn(float(amount) * rate, 0 if dst == "VND" else 2)} {dst} (tỷ giá thị trường {vn(rate, 4)}).')
        elif not lines:
            lines.append(f'1 {src} = {vn(rate, 4)} {dst} (thị trường quốc tế).')
    return '\n'.join(lines)


COINS = {'btc': 'bitcoin', 'bitcoin': 'bitcoin', 'eth': 'ethereum', 'ethereum': 'ethereum', 'bnb': 'binancecoin',
         'sol': 'solana', 'xrp': 'ripple', 'doge': 'dogecoin', 'ada': 'cardano', 'usdt': 'tether', 'ton': 'the-open-network',
         'trx': 'tron', 'dot': 'polkadot', 'ltc': 'litecoin', 'shib': 'shiba-inu', 'pepe': 'pepe', 'link': 'chainlink'}


@tool('crypto_price', 'tai_chinh', 'Giá tiền số (Bitcoin, Ethereum, BNB, Solana, XRP, Dogecoin...) theo USD và VND, biến động 24 giờ.',
      {'coins': S('Danh sách coin, cách nhau dấu phẩy, ví dụ "btc,eth"', default='btc,eth')})
def crypto_price(coins='btc,eth'):
    ids = []
    for c in re.split(r'[,\s]+', coins.lower()):
        if c:
            ids.append(COINS.get(c, c))
    r = fetch_json(f'https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd,vnd&include_24hr_change=true&ids={",".join(ids)}', ttl=120)
    if not r:
        return 'Không tìm thấy coin. Dùng mã như btc, eth, sol.'
    out, table = [], []
    for k, v in r.items():
        ch = v.get('usd_24h_change') or 0
        out.append(f'{k}: {vn(v["usd"], 2 if v["usd"] < 10 else 0)} USD ≈ {vn(v["vnd"])} đ, 24h {"tăng" if ch >= 0 else "giảm"} {vn(abs(ch), 2)}%')
        table.append([k.capitalize(), vn(v['usd'], 2 if v['usd'] < 10 else 0), '', ('+' if ch >= 0 else '-') + vn(abs(ch), 1) + '%'])
    out.append(SHOW_TABLE.format(title='Tiền số', subtitle='USD · biến động 24 giờ', icon='chart', columns='USD',
                                 rows=json.dumps(table[:6], ensure_ascii=False)))
    return '\n'.join(out)


INDEX = {'vnindex': '^VNINDEX.VN', 'vn-index': '^VNINDEX.VN', 'hnx': '^HASTC', 'sp500': '^GSPC', 's&p500': '^GSPC',
         'dow': '^DJI', 'dowjones': '^DJI', 'nasdaq': '^IXIC', 'nikkei': '^N225', 'hangseng': '^HSI', 'kospi': '^KS11'}


def _yahoo(sym):
    m = fetch_json(f'https://query1.finance.yahoo.com/v8/finance/chart/{q(sym)}?range=1d&interval=1d', ttl=120)['chart']['result'][0]['meta']
    prev = m.get('chartPreviousClose') or m.get('previousClose') or m['regularMarketPrice']
    ch = (m['regularMarketPrice'] - prev) / prev * 100 if prev else 0
    return f'{m.get("shortName") or sym}: {vn(m["regularMarketPrice"], 2)} {m.get("currency", "")}, {"tăng" if ch >= 0 else "giảm"} {vn(abs(ch), 2)}%'


@tool('stock_price', 'tai_chinh',
      'Giá cổ phiếu Việt Nam (HOSE/HNX/UPCoM: FPT, VNM, VCB, HPG...), chỉ số VN-Index, và cổ phiếu/chỉ số quốc tế (AAPL, sp500, nasdaq).',
      {'symbols': S('Mã chứng khoán, cách nhau dấu phẩy, ví dụ "FPT,VCB,vnindex"')}, ['symbols'])
def stock_price(symbols):
    syms = [s.strip() for s in re.split(r'[,\s]+', symbols) if s.strip()]
    out, vn_syms = [], []
    for s in syms:
        k = s.lower().replace(' ', '')
        if k in INDEX:
            try:
                out.append(_yahoo(INDEX[k]))
            except Exception:
                out.append(f'{s}: không lấy được chỉ số')
        else:
            vn_syms.append(s.upper())
    if vn_syms:
        rows = json.loads(fetch('https://bgapidatafeed.vps.com.vn/getliststockdata/' + ','.join(vn_syms), ttl=60) or '[]')
        found = {r['sym'] for r in rows}
        for r in rows:
            price = r.get('lastPrice') or r.get('r')
            ch = float(r.get('changePc') or 0)
            up = price >= r.get('r', price)
            out.append(f'{r["sym"]}: {vn(price * 1000)} đ ({"tăng" if up else "giảm"} {vn(abs(ch), 2)}%), tham chiếu {vn(r["r"] * 1000)}, '
                       f'trần {vn(r["c"] * 1000)}, sàn {vn(r["f"] * 1000)}, cao {vn(float(r.get("highPrice") or 0) * 1000)}, '
                       f'thấp {vn(float(r.get("lowPrice") or 0) * 1000)}, khối lượng {vn(int(r.get("lot") or 0) * 10)} cp')
        for s in vn_syms:
            if s not in found:
                try:
                    out.append(_yahoo(s))
                except Exception:
                    out.append(f'{s}: không tìm thấy mã')
    return '\n'.join(out) if out else 'Không có dữ liệu.'


@tool('business_tax_lookup', 'tai_chinh',
      'Tra cứu mã số thuế doanh nghiệp/hộ kinh doanh: tên công ty, tên quốc tế, địa chỉ, tình trạng hoạt động.',
      {'tax_code': S('Mã số thuế (10 hoặc 13 số)')}, ['tax_code'])
def business_tax_lookup(tax_code):
    code = re.sub(r'[^\d-]', '', tax_code)
    r = fetch_json(f'https://api.vietqr.io/v2/business/{code}', ttl=86400)
    d = r.get('data')
    if not d:
        return f'Không tìm thấy mã số thuế {code}. ({r.get("desc", "")})'
    return (f'MST {d["id"]}: {d["name"]}' + (f' ({d["internationalName"]})' if d.get('internationalName') else '') +
            f'\nĐịa chỉ: {d.get("address", "")}\nTình trạng: {d.get("status", "không rõ")}'
            '\nNguồn: Tổng cục Thuế (qua VietQR), có thể trễ khoảng 1 tháng.')


# ---------------- Translation / traffic ----------------
LANGS = {'vi': 'vi', 'viet': 'vi', 'en': 'en', 'anh': 'en', 'fr': 'fr', 'phap': 'fr', 'de': 'de', 'duc': 'de',
         'it': 'it', 'y': 'it', 'es': 'es', 'tay ban nha': 'es', 'ru': 'ru', 'nga': 'ru', 'ja': 'ja', 'nhat': 'ja',
         'ko': 'ko', 'han': 'ko', 'zh': 'zh-CN', 'trung': 'zh-CN', 'hoa': 'zh-CN', 'th': 'th', 'thai': 'th',
         'hi': 'hi', 'an do': 'hi', 'id': 'id', 'indo': 'id', 'indonesia': 'id', 'ms': 'ms', 'ma lai': 'ms',
         'pt': 'pt', 'bo dao nha': 'pt', 'lao': 'lo', 'khmer': 'km', 'campuchia': 'km'}


def _lang(s, default):
    k = fold(s or default).replace('tieng ', '')
    return LANGS.get(k, k[:5])


@tool('translate_text', 'hoc_tap', 'Dịch văn bản giữa tiếng Việt và hơn 20 ngôn ngữ (Anh, Pháp, Đức, Nhật, Hàn, Trung, Thái...).',
      {'text': S('Câu cần dịch'), 'target': S('Ngôn ngữ đích, ví dụ "en", "tiếng Nhật"', default='en'),
       'source': S('Ngôn ngữ nguồn (mặc định vi)', default='vi')}, ['text'])
def translate_text(text, target='en', source='vi'):
    s, t = _lang(source, 'vi'), _lang(target, 'en')
    if s == t:
        s = 'en' if t == 'vi' else 'vi'
    try:
        r = fetch_json(f'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl={s}&tl={t}&q={q(text[:1500])}', ttl=86400)
        tr = ''.join(seg[0] for seg in r[0] if seg and seg[0])
    except Exception:
        r = fetch_json(f'https://api.mymemory.translated.net/get?q={q(text[:450])}&langpair={s}|{t}', ttl=86400)
        tr = re.sub(r'<[^>]+>', '', r.get('responseData', {}).get('translatedText') or '')
    return f'Bản dịch ({s}→{t}): {tr}' if tr else 'Không dịch được lúc này.'


@tool('traffic_fine_lookup', 'tra_cuu', 'Tra cứu phạt nguội ô tô, xe máy theo biển số xe.',
      {'plate': S('Biển số, ví dụ "30A12345"'), 'vehicle': S('Loại xe', ['oto', 'xemay'], 'oto')}, ['plate'])
def traffic_fine_lookup(plate, vehicle='oto'):
    p = re.sub(r'[^0-9A-Za-z]', '', plate).upper()
    try:
        r = fetch_json('https://api.checkphatnguoi.vn/phatnguoi', {'bienso': p},
                       {'Content-Type': 'application/json', 'Origin': 'https://checkphatnguoi.vn',
                        'Referer': 'https://checkphatnguoi.vn/'}, ttl=1800)
        data = r.get('data') or []
        if r.get('status') == 1 and data:
            out = [f'Biển {p} có {len(data)} lỗi vi phạm:']
            for v in data[:5]:
                out.append(f'- {v.get("Thời gian vi phạm", "")}: {v.get("Hành vi vi phạm", "")} tại {v.get("Địa điểm vi phạm", "")}, '
                           f'trạng thái {v.get("Trạng thái", "")}')
            return '\n'.join(out)
        if r.get('status') in (1, 2):
            return f'Biển {p}: chưa ghi nhận lỗi phạt nguội.'
    except Exception:
        pass
    return (f'Hệ thống tra cứu phạt nguội tự động đang yêu cầu mã xác nhận nên mình chưa tra trực tiếp được biển {p}. '
            'Bạn tra chính thức tại csgt.vn (mục Tra cứu phương tiện vi phạm), nhập biển số và mã xác nhận; '
            'hoặc dùng ứng dụng VNeTraffic của Cục CSGT để được báo phạt nguội tự động.')


# ---------------- Fuel ----------------
def _html_table(page, cls):
    i = page.find('<table class="' + cls)
    if i < 0:
        return []
    body = page[i:page.find('</table>', i)]
    rows = []
    for k, tr in enumerate(re.findall(r'(?s)<tr[^>]*>(.*?)</tr>', body)):
        cells = [strip_tags(c).replace('\xa0', ' ').strip() for c in re.findall(r'(?s)<t[hd][^>]*>(.*?)</t[hd]>', tr)]
        if k and cells and cells[0]:
            rows.append(cells)
    return rows


@tool('fuel_price', 'tai_chinh',
      'Giá xăng dầu bán lẻ Petrolimex hôm nay (vùng 1, vùng 2, mức tăng giảm) và PVOIL. Sau đó gọi self.screen.show_table để hiện bảng.',
      {'zone': S('Vùng giá', ['1', '2'], '1')})
def fuel_price(zone='1'):
    page = fetch('https://giaxanghomnay.com/', ttl=1800)
    rows = _html_table(page, 'table-petro')
    if not rows:
        return 'Chưa đọc được bảng giá xăng dầu, thử lại sau.'
    m = re.search(r'Petrolimex\s+cập nhật\s+(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})', strip_tags(page))
    when = f'{m.group(4)}:{m.group(5)} {m.group(3)}/{m.group(2)}' if m else ''
    col = 3 if zone == '1' else 4
    out = [f'Giá bán lẻ xăng dầu Petrolimex vùng {zone}{" cập nhật " + when if when else ""}, đồng/lít:']
    table = []
    for r in rows[:7]:
        if len(r) < 5:
            continue
        ch = r[2].replace(' ', '')
        price, ch = r[col].replace(',', '.'), ch.replace(',', '.')
        out.append(f'- {r[0]}: {price} đồng' + (f' (kỳ trước {ch})' if ch and ch not in ('0', '-') else ''))
        table.append([r[0][:22], price, '', ch if ch not in ('0', '-') else ''])
    out.append('Giá điều chỉnh vào các ngày 1, 11, 21 hằng tháng.')
    out.append(SHOW_TABLE.format(title='Giá xăng dầu', subtitle=f'Đồng/lít · Petrolimex vùng {zone}' + (f' · {when}' if when else ''),
                                 icon='fuel', columns='Giá', rows=json.dumps(table[:6], ensure_ascii=False)))
    return '\n'.join(out)


SHOW_TABLE = ('[Robot có màn hình: gọi self.screen.show_table với title="{title}", subtitle="{subtitle}", icon="{icon}", '
              'columns="{columns}", rows=\'{rows}\' rồi đọc tóm tắt ngắn.]')
