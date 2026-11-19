"""Học tập, tư vấn, giải trí: dữ liệu lấy trực tuyến (Wikipedia, tìm kiếm web, bộ đề GPLX trên GitHub)."""
import ast
import datetime as dt
import json
import math
import operator
import random
import re

from netutil import clip, fetch, fetch_json, fold, q, strip_tags, web_search
from registry import I, S, tool
from t_live import read_web_page, translate_text, wikipedia_lookup

_rnd = random.SystemRandom()


def _grounding(query, n=4):
    try:
        hits = web_search(query, n)
    except Exception:
        hits = []
    if not hits:
        return ''
    return 'Thông tin tham khảo mới từ Internet:\n' + '\n'.join(f'- {h["title"]}: {h["snippet"]} ({h["url"]})' for h in hits)


# ---------------- Gia sư ----------------
SUBJECTS = {
    'toan': 'Toán', 'vat-ly': 'Vật lý', 'hoa-hoc': 'Hoá học', 'sinh-hoc': 'Sinh học', 'ngu-van': 'Ngữ văn',
    'lich-su': 'Lịch sử', 'dia-ly': 'Địa lý', 'tin-hoc': 'Tin học', 'tieng-anh': 'Tiếng Anh', 'tieng-phap': 'Tiếng Pháp',
    'tieng-duc': 'Tiếng Đức', 'tieng-y': 'Tiếng Ý', 'tieng-tay-ban-nha': 'Tiếng Tây Ban Nha', 'tieng-nga': 'Tiếng Nga',
    'tieng-nhat': 'Tiếng Nhật', 'tieng-han': 'Tiếng Hàn', 'tieng-trung': 'Tiếng Trung', 'tieng-thai': 'Tiếng Thái',
    'tieng-viet': 'Tiếng Việt', 'tieng-hindi': 'Tiếng Hindi (Ấn Độ)', 'tieng-indonesia': 'Tiếng Indonesia',
    'tieng-malaysia': 'Tiếng Mã Lai', 'tieng-bo-dao-nha': 'Tiếng Bồ Đào Nha'}
LANG_CODE = {'tieng-anh': 'en', 'tieng-phap': 'fr', 'tieng-duc': 'de', 'tieng-y': 'it', 'tieng-tay-ban-nha': 'es',
             'tieng-nga': 'ru', 'tieng-nhat': 'ja', 'tieng-han': 'ko', 'tieng-trung': 'zh-CN', 'tieng-thai': 'th',
             'tieng-hindi': 'hi', 'tieng-indonesia': 'id', 'tieng-malaysia': 'ms', 'tieng-bo-dao-nha': 'pt'}


@tool('tutor', 'hoc_tap',
      'Gia sư AI cho học sinh: Toán, Lý, Hoá, Sinh, Văn, Sử, Địa, Tin và 15 ngoại ngữ (Anh, Pháp, Đức, Ý, Tây Ban Nha, Nga, Nhật, '
      'Hàn, Trung, Thái, Hindi, Indonesia, Mã Lai, Bồ Đào Nha, tiếng Việt cho người nước ngoài). Gọi khi người dùng muốn học, '
      'hỏi bài, luyện tập, kiểm tra bài làm. Trả về phương pháp dạy và tư liệu để bạn giảng tiếp.',
      {'subject': S('Môn học', list(SUBJECTS)), 'question': S('Câu hỏi/bài tập/chủ đề cần học'),
       'grade': S('Lớp hoặc trình độ, ví dụ "lớp 8", "mới bắt đầu", "IELTS 6.0"'),
       'mode': S('Hình thức', ['giang-bai', 'giai-bai-tap', 'kiem-tra', 'luyen-noi', 'tu-vung'], 'giang-bai')}, ['subject'])
def tutor(subject, question='', grade='', mode='giang-bai'):
    name = SUBJECTS.get(subject, subject)
    lang = LANG_CODE.get(subject)
    style = {
        'giang-bai': 'Giảng ngắn gọn từng ý, có ví dụ gần gũi, sau mỗi ý hỏi lại 1 câu để kiểm tra hiểu bài.',
        'giai-bai-tap': 'Không đưa ngay đáp án: gợi mở từng bước (dữ kiện → công thức → tính toán → kết luận), '
                        'để học sinh tự làm, chỉ giải trọn khi học sinh yêu cầu.',
        'kiem-tra': 'Ra 3-5 câu hỏi từ dễ đến khó, hỏi từng câu một, chấm điểm và giải thích chỗ sai.',
        'luyen-noi': 'Hội thoại ngắn bằng ngoại ngữ, mỗi lượt 1-2 câu đơn giản, sửa lỗi phát âm/ngữ pháp nhẹ nhàng, '
                     'nói nghĩa tiếng Việt khi cần.',
        'tu-vung': 'Dạy 5 từ mới theo chủ đề: từ, cách đọc, nghĩa, ví dụ; sau đó đố lại.'}.get(mode, '')
    out = [f'Vai trò: gia sư {name}{" " + grade if grade else ""}. Nói tiếng Việt thân thiện, câu ngắn vì trả lời bằng giọng nói. {style}']
    if lang:
        out.append(f'Với ngoại ngữ: đọc chậm, mỗi câu ngoại ngữ kèm nghĩa tiếng Việt; khuyến khích học viên nhắc lại.')
        if question:
            try:
                out.append(translate_text(question, lang, 'vi'))
            except Exception:
                pass
    elif question:
        try:
            w = wikipedia_lookup(question)
            if 'không có mục' not in w:
                out.append(clip(w, 1500))
        except Exception:
            pass
        g = _grounding(f'{question} {name} {grade}'.strip(), 3)
        if g:
            out.append(g)
    if question:
        out.append(f'Yêu cầu của học sinh: {question}')
    return '\n'.join(out)


# ---------------- Tư vấn chuyên gia ----------------
DOMAINS = {
    'nghe-nghiep': ('chuyên gia hướng nghiệp', 'Hỏi sở thích, điểm mạnh, hoàn cảnh; gợi ý 3 hướng nghề kèm kỹ năng cần có, mức lương tham khảo, lộ trình học.', 'xu hướng việc làm'),
    'du-lich-viet-nam': ('hướng dẫn viên du lịch Việt Nam', 'Gợi ý lịch trình theo ngày, mùa đẹp, phương tiện, chi phí, món đặc sản, lưu ý an toàn.', 'du lịch kinh nghiệm'),
    'du-lich-quoc-te': ('chuyên gia du lịch quốc tế', 'Visa cho người Việt, thời điểm đẹp, chi phí, lịch trình, văn hoá cần biết, đổi tiền, sim/internet.', 'du lịch kinh nghiệm visa'),
    'luat-doanh-nghiep': ('luật sư doanh nghiệp', 'Trình bày theo Luật Doanh nghiệp hiện hành: thủ tục, hồ sơ, thời hạn, lệ phí, cơ quan giải quyết.', 'luật doanh nghiệp thủ tục'),
    'luat-dat-dai': ('luật sư đất đai', 'Trình bày theo Luật Đất đai hiện hành: điều kiện, thủ tục sang tên, sổ đỏ, thuế phí, tranh chấp, thừa kế.', 'luật đất đai thủ tục'),
    'luat-dan-su': ('luật sư dân sự', 'Trình bày theo Bộ luật Dân sự: quyền và nghĩa vụ, hợp đồng, vay mượn, thừa kế, bồi thường, hôn nhân gia đình.', 'bộ luật dân sự'),
    'luat-giao-thong': ('chuyên gia luật giao thông', 'Mức phạt theo nghị định hiện hành, trừ điểm bằng lái, quy tắc an toàn.', 'mức phạt giao thông nghị định'),
    'suc-khoe': ('bác sĩ tư vấn sức khoẻ', 'Hỏi triệu chứng, thời gian, tuổi; giải thích nguyên nhân thường gặp, cách chăm sóc tại nhà, dấu hiệu cần đi khám ngay.', 'triệu chứng nguyên nhân cách điều trị'),
    'dinh-duong': ('chuyên gia dinh dưỡng', 'Gợi ý thực đơn cân bằng, lượng calo, món Việt dễ nấu, lưu ý bệnh lý.', 'dinh dưỡng thực đơn'),
    'bai-thuoc-dan-gian': ('thầy thuốc y học cổ truyền', 'Giới thiệu bài thuốc dân gian phổ biến, cách dùng, liều, người không nên dùng; nhấn mạnh chỉ hỗ trợ.', 'bài thuốc dân gian chữa'),
    'tuyen-sinh': ('chuyên gia tư vấn tuyển sinh', 'Phương thức xét tuyển, tổ hợp môn, điểm chuẩn tham khảo, học phí, lịch tuyển sinh năm nay.', 'tuyển sinh 2026 điểm chuẩn'),
    'tam-ly': ('chuyên gia tâm lý', 'Lắng nghe, đồng cảm, đặt câu hỏi mở, gợi ý cách tự chăm sóc tinh thần; khuyên tìm hỗ trợ chuyên môn khi cần.', 'tâm lý cách vượt qua'),
    'nuoi-day-con': ('chuyên gia nuôi dạy con', 'Phát triển theo độ tuổi, dinh dưỡng, giấc ngủ, kỷ luật tích cực, an toàn cho trẻ.', 'nuôi dạy con'),
    'nong-nghiep': ('kỹ sư nông nghiệp', 'Kỹ thuật trồng, chăm sóc, phân bón, sâu bệnh, thời vụ, chăn nuôi.', 'kỹ thuật trồng chăm sóc'),
    'cong-nghe': ('kỹ thuật viên công nghệ', 'Hướng dẫn từng bước sửa lỗi điện thoại, máy tính, mạng Wi-Fi, phần mềm.', 'cách khắc phục lỗi'),
    'kinh-doanh': ('cố vấn kinh doanh', 'Phân tích thị trường, vốn, chi phí, kênh bán, marketing online, rủi ro; ví dụ con số cụ thể.', 'kinh nghiệm kinh doanh'),
}
SAFETY = {'suc-khoe': 'Không chẩn đoán thay bác sĩ. Triệu chứng nặng (khó thở, đau ngực, sốt cao co giật, chảy máu nhiều) → gọi 115 hoặc đến viện ngay.',
          'bai-thuoc-dan-gian': 'Bài thuốc dân gian chỉ hỗ trợ, không thay thuốc điều trị; phụ nữ có thai, trẻ nhỏ, người bệnh mạn tính hỏi bác sĩ trước.',
          'tam-ly': 'Nếu người dùng có ý định tự hại: khuyến khích gọi ngay 115 hoặc người thân, đường dây hỗ trợ tâm lý.',
          'luat-doanh-nghiep': 'Thông tin pháp lý tham khảo; vụ việc cụ thể nên hỏi luật sư hoặc cơ quan nhà nước.',
          'luat-dat-dai': 'Thông tin pháp lý tham khảo; vụ việc cụ thể nên hỏi luật sư, văn phòng đăng ký đất đai.',
          'luat-dan-su': 'Thông tin pháp lý tham khảo; vụ việc cụ thể nên hỏi luật sư.'}


@tool('expert_advice', 'tu_van',
      'Tư vấn chuyên gia: nghề nghiệp, du lịch trong nước & quốc tế, luật doanh nghiệp/đất đai/dân sự/giao thông, sức khoẻ, '
      'dinh dưỡng, bài thuốc dân gian, tuyển sinh 2026, tâm lý, nuôi dạy con, nông nghiệp, công nghệ, kinh doanh. '
      'Trả về khung tư vấn và thông tin mới nhất tìm được trên Internet.',
      {'domain': S('Lĩnh vực', list(DOMAINS)), 'question': S('Câu hỏi cụ thể của người dùng')}, ['domain', 'question'])
def expert_advice(domain, question):
    role, frame, hint = DOMAINS.get(domain, ('chuyên gia', 'Trả lời rõ ràng, có ví dụ.', ''))
    out = [f'Vai trò: {role}. {frame} Trả lời ngắn gọn, dễ nghe bằng giọng nói; hỏi lại nếu thiếu thông tin.']
    if domain in SAFETY:
        out.append('Lưu ý an toàn: ' + SAFETY[domain])
    g = _grounding(f'{question} {hint}', 5)
    if g:
        out.append(g)
    out.append(f'Câu hỏi: {question}')
    return '\n'.join(out)


# ---------------- Nấu ăn ----------------
RECIPE_SITES = ('monngonmoingay.com', 'cooky.vn', 'dienmayxanh.com', 'bachhoaxanh.com', 'vnexpress.net', 'giadinh.suckhoedoisong.vn')


@tool('cooking_recipe', 'giai_tri',
      'Dạy nấu ăn: tìm công thức món ăn trên Internet (nguyên liệu, các bước, mẹo), món Việt và quốc tế; '
      'hoặc gợi ý món theo nguyên liệu có sẵn.',
      {'dish': S('Tên món, ví dụ "phở bò", "cá kho tộ"; hoặc nguyên liệu có sẵn "trứng, cà chua"'),
       'servings': I('Số người ăn', 1, 20)}, ['dish'])
def cooking_recipe(dish, servings=None):
    hits = []
    try:  # Món Ngon Mỗi Ngày has its own search: works even when search engines rate-limit us
        page = fetch(f'https://monngonmoingay.com/?s={q(dish)}', ttl=3600)
        words = [w for w in fold(dish).split() if len(w) > 1]
        for u in dict.fromkeys(re.findall(r'href="(https://monngonmoingay\.com/([a-z0-9-]+)/)"', page)):
            score = sum(w in u[1].split('-') for w in words)
            if score >= max(1, len(words) - 1):
                hits.append((score, {'title': u[1], 'url': u[0], 'snippet': ''}))
        hits = [h for _, h in sorted(hits, key=lambda x: -x[0])]
    except Exception:
        pass
    hits += web_search(f'cách làm {dish} công thức nguyên liệu', 8)
    hits.sort(key=lambda h: 0 if any(s in h['url'] for s in RECIPE_SITES) else 1)
    for h in hits[:4]:
        if 'news.google.com' in h['url']:
            continue
        try:
            body = strip_tags(fetch(h['url'], ttl=21600, timeout=12))
        except Exception:
            continue
        low = body.lower()
        i = low.find('nguyên liệu:')
        if i < 0:
            i = low.find('nguyên liệu')
        if i >= 0 and len(body) - i > 300:
            body = body[i:]
            end = re.search(r'(?i)\n\s*(Tags|Xem thêm|Bài viết liên quan|Có thể bạn quan tâm|Tin liên quan|Bình luận)\b', body)
            body = body[:end.start()] if end else body
            return clip(f'Công thức "{dish}" (nguồn {h["url"]}){f", điều chỉnh cho {servings} người" if servings else ""}:\n{body}', 3200) + \
                '\nHãy đọc cho người dùng theo từng bước, hỏi xong bước này mới sang bước tiếp.'
    if hits:
        return 'Gợi ý công thức từ Internet:\n' + '\n'.join(f'- {h["title"]}: {h["snippet"]}' for h in hits[:5])
    return f'Chưa tìm được công thức cho {dish}.'


# ---------------- Kể chuyện, thần thoại ----------------
FOLK = ['Tấm Cám', 'Sự tích Thánh Gióng', 'Sơn Tinh Thủy Tinh', 'Cây tre trăm đốt', 'Sự tích trầu cau', 'Con Rồng cháu Tiên',
        'Ăn khế trả vàng', 'Thạch Sanh', 'Cóc kiện trời', 'Sự tích bánh chưng bánh giầy', 'Sự tích dưa hấu', 'Sự tích Hồ Gươm',
        'Thánh Gióng', 'Sọ Dừa', 'Sự tích chú Cuội cung trăng', 'Cây khế', 'Chử Đồng Tử', 'Sự tích cây vú sữa', 'Mỵ Châu Trọng Thủy',
        'Lạc Long Quân Âu Cơ', 'Sự tích con muỗi', 'Thỏ và rùa', 'Nàng Bạch Tuyết', 'Cô bé Lọ Lem', 'Cô bé quàng khăn đỏ',
        'Vịt con xấu xí', 'Nàng tiên cá', 'Aladdin và cây đèn thần', 'Ba chú heo con', 'Cậu bé chăn cừu']


@tool('kids_story', 'giai_tri',
      'Kể chuyện cho bé: truyện cổ tích Việt Nam và thế giới, ngụ ngôn (Tấm Cám, Thánh Gióng, Sơn Tinh Thủy Tinh, Cây khế, '
      'Lọ Lem, Bạch Tuyết...). Lấy nội dung từ Wikipedia để bạn kể lại bằng giọng truyền cảm.',
      {'title': S('Tên truyện (bỏ trống = chọn ngẫu nhiên)'), 'age': I('Tuổi của bé', 2, 15)})
def kids_story(title=None, age=None):
    title = title or _rnd.choice(FOLK)
    text = wikipedia_lookup(title if fold(title).startswith(('su tich', 'truyen')) else f'{title} truyện cổ tích')
    if 'không có mục' in text:
        text = wikipedia_lookup(title)
    g = '' if len(text) > 600 else _grounding(f'truyện {title} nội dung', 3)
    return (f'Hãy kể truyện "{title}" cho bé{f" {age} tuổi" if age else ""}: giọng ấm áp, câu ngắn, có lời thoại nhân vật, '
            f'kể thành 3-5 đoạn, cuối truyện nêu bài học nhẹ nhàng và hỏi bé một câu.\nTư liệu:\n{clip(text, 2800)}\n{g}').strip()


@tool('greek_mythology', 'giai_tri',
      'Thần thoại Hy Lạp, La Mã, Bắc Âu, Ai Cập: các vị thần (Zeus, Athena, Poseidon, Hades...), anh hùng (Heracles, Achilles, '
      'Perseus), sự tích (hộp Pandora, ngựa thành Troy). Nội dung từ Wikipedia.',
      {'topic': S('Vị thần, anh hùng hoặc sự tích (bỏ trống = ngẫu nhiên)')})
def greek_mythology(topic=None):
    topic = topic or _rnd.choice(['Zeus', 'Athena', 'Poseidon', 'Hades', 'Prometheus', 'Hộp Pandora', 'Heracles', 'Achilles',
                                   'Perseus', 'Medusa', 'Ngựa thành Troia', 'Odysseus', 'Icarus', 'Orpheus', 'Apollo', 'Artemis'])
    text = wikipedia_lookup(f'{topic} thần thoại')
    if 'không có mục' in text:
        text = wikipedia_lookup(topic)
    return f'Kể lại câu chuyện thần thoại về "{topic}" hấp dẫn, dễ hiểu:\n{clip(text, 3000)}'


def _scrape_blocks(query, min_len=60, max_len=600):
    """Find a page from web search and return its text blocks (jokes, riddles...)."""
    for h in web_search(query, 6)[:4]:
        try:
            page = fetch(h['url'], ttl=21600, timeout=10)
        except Exception:
            continue
        main = re.search(r'(?is)<(article|main)[^>]*>(.*?)</\1>', page)
        blocks = re.split(r'(?i)<h[2-4][^>]*>', main.group(2) if main else page)
        out = []
        for b in blocks:
            t = strip_tags(b)
            if min_len <= len(t) <= max_len and not re.search(r'(?i)cookie|đăng nhập|bình luận|copyright|quảng cáo', t):
                out.append(t)
        if len(out) >= 5:
            return out, h['url']
    return [], ''


WS = 'https://vi.wikisource.org/w/api.php?format=json&'
JOKE_BOOKS = ['Tiếu lâm An Nam/Quyển thứ nhất/', 'Tiếu lâm An Nam/Quyển thứ hai/', 'Góp cười truyện thế/']


def _ws_pages(prefix):
    r = fetch_json(WS + f'action=query&list=prefixsearch&pslimit=100&pssearch={q(prefix)}', ttl=86400)
    return [p['title'] for p in r['query']['prefixsearch'] if p['title'] != prefix.rstrip('/')]


def _ws_text(title):
    r = fetch_json(WS + f'action=parse&prop=text&disableeditsection=1&redirects=1&page={q(title)}', ttl=86400)
    h = r['parse']['text']['*']
    h = re.sub(r'(?is)<(table|div)[^>]+(?:header|ws-noexport|navbox|licenseContainer|mw-references)[^>]*>.*?</\1>', ' ', h)
    return strip_tags(h)


@tool('vietnamese_joke', 'giai_tri',
      'Kể truyện cười, tiếu lâm Việt Nam (Tiếu lâm An Nam, Trạng Quỳnh, Góp cười truyện thế...) lấy từ thư viện Wikisource; '
      'có thể lọc theo từ khoá.',
      {'topic': S('Chủ đề/từ khoá, ví dụ "Trạng Quỳnh", "thầy đồ", "vợ chồng" (tuỳ chọn)')})
def vietnamese_joke(topic=''):
    titles = []
    if topic:
        r = fetch_json(WS + f'action=query&list=search&srlimit=20&srsearch={q(topic + " cười")}', ttl=3600)
        titles = [x['title'] for x in r['query']['search'] if 80 <= x.get('wordcount', 0) <= 900]
    if not titles:
        titles = _ws_pages(_rnd.choice(JOKE_BOOKS))
    for title in _rnd.sample(titles, min(4, len(titles))):
        text = _ws_text(title)
        if 150 <= len(text) <= 4000:
            return (f'Kể lại truyện cười này bằng lời văn hiện đại, ngắn gọn, duyên dáng, nhấn vào câu chốt '
                    f'(Wikisource: {title}):\n{clip(text, 2500)}')
    return 'Chưa tải được truyện cười, hãy tự kể một truyện cười dân gian Việt Nam ngắn, lành mạnh.'


@tool('riddle_game', 'giai_tri', 'Câu đố vui, đố mẹo, câu đố dân gian cho bé và gia đình (có đáp án) lấy từ Internet. Đố người dùng rồi mới nói đáp án.',
      {'topic': S('Loại câu đố: "dân gian", "mẹo", "con vật", "toán"... (tuỳ chọn)')})
def riddle_game(topic=''):
    blocks, src = _scrape_blocks(f'câu đố {topic or "vui"} có đáp án cho bé', 25, 400)
    qa = [b for b in blocks if re.search(r'(?i)đáp án|là gì|\?', b)]
    pick = _rnd.sample(qa or blocks, min(3, len(qa or blocks))) if (qa or blocks) else []
    if not pick:
        return 'Chưa tải được câu đố. Hãy tự ra một câu đố dân gian quen thuộc cho người dùng.'
    return (f'Chọn một câu đố dưới đây, đọc câu đố, chờ người dùng đoán, gợi ý nếu sai, rồi mới nói đáp án (nguồn {src}):\n'
            + '\n'.join(f'- {p}' for p in pick))


# ---------------- Ôn thi bằng lái ----------------
GPLX_URL = 'https://raw.githubusercontent.com/nqthaivl/on-gplx-tiktok/main/seed/gplx-questions.json'
_quiz_state: dict = {}


def _gplx():
    return json.loads(fetch(GPLX_URL, ttl=86400, timeout=20))


@tool('driving_theory_quiz', 'hoc_tap',
      'Ôn thi lý thuyết bằng lái xe theo bộ 600 câu hỏi hiện hành (ô tô) và các câu dùng cho xe máy, có câu điểm liệt và giải thích. '
      'Hỏi từng câu, người dùng trả lời số đáp án, sau đó gọi lại với answer để chấm.',
      {'vehicle': S('Loại bằng', ['oto', 'xemay'], 'oto'), 'question_number': I('Số câu cụ thể (1-600), bỏ trống = ngẫu nhiên', 1, 600),
       'critical_only': {'type': 'boolean', 'description': 'Chỉ câu điểm liệt'},
       'answer': I('Đáp án người dùng chọn cho câu vừa hỏi (1-4)', 1, 4)})
def driving_theory_quiz(vehicle='oto', question_number=None, critical_only=False, answer=None):
    data = [x for x in _gplx() if not x.get('image')]
    if answer and _quiz_state.get('last'):
        x = _quiz_state['last']
        ok = answer == x['correct_option']
        _quiz_state['score'] = _quiz_state.get('score', 0) + ok
        _quiz_state['count'] = _quiz_state.get('count', 0) + 1
        return (f'{"ĐÚNG" if ok else "SAI"}! Đáp án đúng là {x["correct_option"]}: {x["options"][x["correct_option"] - 1]}\n'
                f'Giải thích: {x.get("explanation", "")}\nĐiểm phiên này: {_quiz_state["score"]}/{_quiz_state["count"]}.'
                + (' Đây là câu ĐIỂM LIỆT: sai câu này là trượt.' if x.get('is_critical') else ''))
    pool = data
    if vehicle == 'xemay':  # bỏ chương kỹ thuật/cấu tạo ô tô và nghiệp vụ vận tải
        pool = [x for x in pool if x['chapter'] in (1, 2, 5, 6) and not re.search(r'(?i)ô tô|xe tải|sơ mi rơ moóc|kinh doanh vận tải', x['question'])] or data
    if critical_only:
        pool = [x for x in pool if x.get('is_critical')] or pool
    if question_number:
        x = next((y for y in _gplx() if y['id'] == question_number), None)
        if not x:
            return 'Không có câu này.'
        if x.get('image'):
            return f'Câu {question_number} có hình biển báo/sa hình nên không đọc bằng giọng được; chọn câu khác.'
    else:
        x = _rnd.choice(pool)
    _quiz_state['last'] = x
    opts = '\n'.join(f'{i}. {o}' for i, o in enumerate(x['options'], 1))
    return (f'Câu {x["id"]} ({x["chapter_name"]}){" - CÂU ĐIỂM LIỆT" if x.get("is_critical") else ""}:\n{x["question"]}\n{opts}\n'
            'Đọc câu hỏi và các đáp án, chờ người dùng chọn số rồi gọi lại công cụ với answer. Không nói đáp án trước.')


# ---------------- Tiện ích ----------------
_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.Mod: operator.mod, ast.FloorDiv: operator.floordiv, ast.USub: operator.neg, ast.UAdd: operator.pos}
_FN = {k: getattr(math, k) for k in ('sqrt', 'sin', 'cos', 'tan', 'log', 'log10', 'exp', 'floor', 'ceil', 'factorial', 'pi', 'e')}
_FN.update(abs=abs, round=round)


def _eval(n):
    if isinstance(n, ast.Expression):
        return _eval(n.body)
    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
        return n.value
    if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
        a, b = _eval(n.left), _eval(n.right)
        if isinstance(n.op, ast.Pow) and abs(b) > 1000:
            raise ValueError('số mũ quá lớn')
        return _OPS[type(n.op)](a, b)
    if isinstance(n, ast.UnaryOp) and type(n.op) in _OPS:
        return _OPS[type(n.op)](_eval(n.operand))
    if isinstance(n, ast.Name) and n.id in _FN and not callable(_FN[n.id]):
        return _FN[n.id]
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _FN:
        return _FN[n.func.id](*[_eval(a) for a in n.args])
    raise ValueError('biểu thức không hợp lệ')


@tool('calculator', 'tien_ich', 'Máy tính chính xác: cộng trừ nhân chia, luỹ thừa, căn, phần trăm, lượng giác, giai thừa. Dùng thay vì tự nhẩm.',
      {'expression': S('Biểu thức, ví dụ "15% * 2500000", "sqrt(144) + 2^10"')}, ['expression'])
def calculator(expression):
    e = expression.replace('^', '**').replace('×', '*').replace('÷', '/').replace(',', '.')
    e = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'(\1/100)', e)
    v = _eval(ast.parse(e, mode='eval'))
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
        v = int(v)
    return f'{expression} = {v:,}'.replace(',', ' ') if isinstance(v, int) else f'{expression} = {v:.10g}'


UNITS = {'m': ('len', 1), 'km': ('len', 1000), 'cm': ('len', .01), 'mm': ('len', .001), 'dam': ('len', 10), 'mile': ('len', 1609.344),
         'dặm': ('len', 1609.344), 'ft': ('len', .3048), 'inch': ('len', .0254), 'in': ('len', .0254), 'yd': ('len', .9144),
         'hải lý': ('len', 1852), 'kg': ('mass', 1), 'g': ('mass', .001), 'tấn': ('mass', 1000), 'tạ': ('mass', 100),
         'yến': ('mass', 10), 'lạng': ('mass', .1), 'lb': ('mass', .45359237), 'pound': ('mass', .45359237), 'oz': ('mass', .028349523),
         'chỉ': ('mass', .00375), 'lượng': ('mass', .0375), 'l': ('vol', 1), 'lít': ('vol', 1), 'ml': ('vol', .001),
         'm3': ('vol', 1000), 'gallon': ('vol', 3.785411784), 'm2': ('area', 1), 'km2': ('area', 1e6), 'ha': ('area', 1e4),
         'sào': ('area', 360), 'mẫu': ('area', 3600), 'công': ('area', 1000), 'acre': ('area', 4046.8564), 'km/h': ('spd', 1 / 3.6),
         'm/s': ('spd', 1), 'mph': ('spd', .44704), 'knot': ('spd', .514444), 'kwh': ('energy', 3.6e6), 'kcal': ('energy', 4184),
         'j': ('energy', 1), 'cal': ('energy', 4.184), 'gb': ('data', 1024 ** 3), 'mb': ('data', 1024 ** 2), 'tb': ('data', 1024 ** 4),
         'kb': ('data', 1024)}


@tool('unit_convert', 'tien_ich',
      'Đổi đơn vị: độ dài, khối lượng (cả chỉ, lượng vàng, tạ, yến), thể tích, diện tích (sào, mẫu, công, ha), tốc độ, năng lượng, '
      'dung lượng, nhiệt độ (C/F/K).',
      {'value': {'type': 'number', 'description': 'Giá trị'}, 'from_unit': S('Đơn vị gốc'), 'to_unit': S('Đơn vị đích')},
      ['value', 'from_unit', 'to_unit'])
def unit_convert(value, from_unit, to_unit):
    v = float(value)
    a, b = from_unit.strip().lower(), to_unit.strip().lower()
    temps = {'c': 'c', '°c': 'c', 'độ c': 'c', 'f': 'f', '°f': 'f', 'độ f': 'f', 'k': 'k', 'kelvin': 'k'}
    if a in temps and b in temps:
        c = {'c': v, 'f': (v - 32) * 5 / 9, 'k': v - 273.15}[temps[a]]
        r = {'c': c, 'f': c * 9 / 5 + 32, 'k': c + 273.15}[temps[b]]
        return f'{v:g} {from_unit} = {r:.2f} {to_unit}'
    if a not in UNITS or b not in UNITS or UNITS[a][0] != UNITS[b][0]:
        return f'Không đổi được {from_unit} sang {to_unit}.'
    return f'{v:g} {from_unit} = {v * UNITS[a][1] / UNITS[b][1]:.6g} {to_unit}'


@tool('current_datetime', 'tien_ich', 'Ngày giờ hiện tại ở Việt Nam hoặc múi giờ/thành phố khác trên thế giới.',
      {'city': S('Thành phố/quốc gia (bỏ trống = Việt Nam)')})
def current_datetime(city=None):
    from t_live import _geocode
    from zoneinfo import ZoneInfo
    tz, place = 'Asia/Ho_Chi_Minh', 'Việt Nam'
    if city:
        g = _geocode(city)
        tz, place = g.get('timezone', tz), f'{g.get("name")}, {g.get("country", "")}'
    try:
        now = dt.datetime.now(ZoneInfo(tz))
    except Exception:  # Windows without tzdata
        now = dt.datetime.utcnow() + dt.timedelta(hours=7)
    thu = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][now.weekday()]
    return f'Bây giờ ở {place} là {now:%H:%M}, {thu} ngày {now.day}/{now.month}/{now.year} (múi giờ {tz}).'
