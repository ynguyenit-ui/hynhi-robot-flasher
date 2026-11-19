"""Lịch vạn niên (thuật toán Hồ Ngọc Đức), xem ngày, tuổi, phong thuỷ, thần số học, cung hoàng đạo, tarot."""
import datetime as dt
import hashlib
import math
import random
import re

from netutil import fold
from registry import I, S, tool

TZ = 7.0
CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']
CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']
CON_GIAP = ['Chuột', 'Trâu', 'Hổ', 'Mèo', 'Rồng', 'Rắn', 'Ngựa', 'Dê', 'Khỉ', 'Gà', 'Chó', 'Lợn']
TIET_KHI = ['Xuân phân', 'Thanh minh', 'Cốc vũ', 'Lập hạ', 'Tiểu mãn', 'Mang chủng', 'Hạ chí', 'Tiểu thử', 'Đại thử',
            'Lập thu', 'Xử thử', 'Bạch lộ', 'Thu phân', 'Hàn lộ', 'Sương giáng', 'Lập đông', 'Tiểu tuyết', 'Đại tuyết',
            'Đông chí', 'Tiểu hàn', 'Đại hàn', 'Lập xuân', 'Vũ thủy', 'Kinh trập']
GIO_HD = ['110100101100', '001101001011', '110011010010', '101100110100', '001011001101', '010010110011']
THAN_12 = [('Thanh Long', True), ('Minh Đường', True), ('Thiên Hình', False), ('Chu Tước', False), ('Kim Quỹ', True),
           ('Kim Đường (Bảo Quang)', True), ('Bạch Hổ', False), ('Ngọc Đường', True), ('Thiên Lao', False),
           ('Huyền Vũ', False), ('Tư Mệnh', True), ('Câu Trận', False)]
NAP_AM = ['Hải Trung Kim', 'Lư Trung Hỏa', 'Đại Lâm Mộc', 'Lộ Bàng Thổ', 'Kiếm Phong Kim', 'Sơn Đầu Hỏa', 'Giản Hạ Thủy',
          'Thành Đầu Thổ', 'Bạch Lạp Kim', 'Dương Liễu Mộc', 'Tuyền Trung Thủy', 'Ốc Thượng Thổ', 'Tích Lịch Hỏa',
          'Tùng Bách Mộc', 'Trường Lưu Thủy', 'Sa Trung Kim', 'Sơn Hạ Hỏa', 'Bình Địa Mộc', 'Bích Thượng Thổ',
          'Kim Bạch Kim', 'Phú Đăng Hỏa', 'Thiên Hà Thủy', 'Đại Trạch Thổ', 'Thoa Xuyến Kim', 'Tang Đố Mộc',
          'Đại Khê Thủy', 'Sa Trung Thổ', 'Thiên Thượng Hỏa', 'Thạch Lựu Mộc', 'Đại Hải Thủy']
THU = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']


# ---------- Hồ Ngọc Đức lunar algorithm ----------
def jd_from_date(d, m, y):
    a = (14 - m) // 12
    y2 = y + 4800 - a
    m2 = m + 12 * a - 3
    jd = d + (153 * m2 + 2) // 5 + 365 * y2 + y2 // 4 - y2 // 100 + y2 // 400 - 32045
    if jd < 2299161:
        jd = d + (153 * m2 + 2) // 5 + 365 * y2 + y2 // 4 - 32083
    return jd


def jd_to_date(jd):
    if jd > 2299160:
        a = jd + 32044
        b = (4 * a + 3) // 146097
        c = a - (b * 146097) // 4
    else:
        b, c = 0, jd + 32082
    d = (4 * c + 3) // 1461
    e = c - (1461 * d) // 4
    m = (5 * e + 2) // 153
    return e - (153 * m + 2) // 5 + 1, m + 3 - 12 * (m // 10), b * 100 + d - 4800 + m // 10


def _new_moon(k):
    T = k / 1236.85
    T2, T3 = T * T, T * T * T
    dr = math.pi / 180
    jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
    jd1 += 0.00033 * math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
    M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
    Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
    F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
    s = math.sin
    C1 = (0.1734 - 0.000393 * T) * s(M * dr) + 0.0021 * s(2 * dr * M)
    C1 = C1 - 0.4068 * s(Mpr * dr) + 0.0161 * s(dr * 2 * Mpr)
    C1 = C1 - 0.0004 * s(dr * 3 * Mpr)
    C1 = C1 + 0.0104 * s(dr * 2 * F) - 0.0051 * s(dr * (M + Mpr))
    C1 = C1 - 0.0074 * s(dr * (M - Mpr)) + 0.0004 * s(dr * (2 * F + M))
    C1 = C1 - 0.0004 * s(dr * (2 * F - M)) - 0.0006 * s(dr * (2 * F + Mpr))
    C1 = C1 + 0.0010 * s(dr * (2 * F - Mpr)) + 0.0005 * s(dr * (2 * Mpr + M))
    if T < -11:
        dt_ = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    else:
        dt_ = -0.000278 + 0.000265 * T + 0.000262 * T2
    return jd1 + C1 - dt_


def _new_moon_day(k):
    return math.floor(_new_moon(k) + 0.5 + TZ / 24)


def _sun_longitude_rad(jdn):
    T = (jdn - 2451545.0) / 36525
    T2 = T * T
    dr = math.pi / 180
    M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2
    L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
    DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * math.sin(dr * M)
    DL += (0.019993 - 0.000101 * T) * math.sin(dr * 2 * M) + 0.000290 * math.sin(dr * 3 * M)
    L = (L0 + DL) * dr
    return L - math.pi * 2 * math.floor(L / (math.pi * 2))


def _sun_long(day):
    return math.floor(_sun_longitude_rad(day - 0.5 - TZ / 24) / math.pi * 6)


def _month11(y):
    off = jd_from_date(31, 12, y) - 2415021
    k = math.floor(off / 29.530588853)
    nm = _new_moon_day(k)
    return _new_moon_day(k - 1) if _sun_long(nm) >= 9 else nm


def _leap_offset(a11):
    k = math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
    i = 1
    arc = _sun_long(_new_moon_day(k + i))
    while True:
        last = arc
        i += 1
        arc = _sun_long(_new_moon_day(k + i))
        if arc == last or i >= 14:
            break
    return i - 1


def solar_to_lunar(d, m, y):
    day = jd_from_date(d, m, y)
    k = math.floor((day - 2415021.076998695) / 29.530588853)
    start = _new_moon_day(k + 1)
    if start > day:
        start = _new_moon_day(k)
    a11 = _month11(y)
    b11 = a11
    if a11 >= start:
        ly = y
        a11 = _month11(y - 1)
    else:
        ly = y + 1
        b11 = _month11(y + 1)
    ld = day - start + 1
    diff = math.floor((start - a11) / 29)
    leap = False
    lm = diff + 11
    if b11 - a11 > 365:
        ld_off = _leap_offset(a11)
        if diff >= ld_off:
            lm = diff + 10
            leap = diff == ld_off
    if lm > 12:
        lm -= 12
    if lm >= 11 and diff < 4:
        ly -= 1
    return ld, lm, ly, leap


def lunar_to_solar(ld, lm, ly, leap=False):
    if lm < 11:
        a11, b11 = _month11(ly - 1), _month11(ly)
    else:
        a11, b11 = _month11(ly), _month11(ly + 1)
    k = math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853)
    off = lm - 11
    if off < 0:
        off += 12
    if b11 - a11 > 365:
        lo = _leap_offset(a11)
        leap_month = lo - 2
        if leap_month < 0:
            leap_month += 12
        if leap and lm != leap_month:
            return None
        if leap or off >= lo:
            off += 1
    return jd_to_date(_new_moon_day(k + off) + ld - 1)


def can_chi_year(y):
    return f'{CAN[(y + 6) % 10]} {CHI[(y + 8) % 12]}'


def day_info(d: dt.date):
    jd = jd_from_date(d.day, d.month, d.year)
    ld, lm, ly, leap = solar_to_lunar(d.day, d.month, d.year)
    day_chi = (jd + 1) % 12
    than, good = THAN_12[(day_chi - ((lm - 1) % 6) * 2) % 12]
    hours = [f'{CHI[i]} ({(i * 2 - 1) % 24}h-{(i * 2 + 1) % 24}h)' for i, c in enumerate(GIO_HD[day_chi % 6]) if c == '1']
    tk = TIET_KHI[math.floor(_sun_longitude_rad(jd + 1 - 0.5 - TZ / 24) / math.pi * 12)]
    return {'jd': jd, 'ld': ld, 'lm': lm, 'ly': ly, 'leap': leap, 'day_cc': f'{CAN[(jd + 9) % 10]} {CHI[day_chi]}',
            'month_cc': f'{CAN[(ly * 12 + lm + 3) % 10]} {CHI[(lm + 1) % 12]}', 'year_cc': can_chi_year(ly),
            'day_chi': day_chi, 'than': than, 'hoang_dao': good, 'gio_hd': hours, 'tiet_khi': tk}


LE_DL = {(1, 1): 'Tết Dương lịch', (14, 2): 'Lễ Tình nhân', (8, 3): 'Quốc tế Phụ nữ', (30, 4): 'Giải phóng miền Nam',
         (1, 5): 'Quốc tế Lao động', (1, 6): 'Quốc tế Thiếu nhi', (2, 9): 'Quốc khánh', (20, 10): 'Phụ nữ Việt Nam',
         (20, 11): 'Nhà giáo Việt Nam', (24, 12): 'Giáng sinh', (22, 12): 'Quân đội nhân dân VN', (3, 2): 'Thành lập Đảng'}
LE_AL = {(1, 1): 'Tết Nguyên Đán', (15, 1): 'Tết Nguyên Tiêu (Rằm tháng Giêng)', (3, 3): 'Tết Hàn thực',
         (10, 3): 'Giỗ Tổ Hùng Vương', (15, 4): 'Lễ Phật Đản', (5, 5): 'Tết Đoan Ngọ', (15, 7): 'Vu Lan',
         (15, 8): 'Tết Trung thu', (23, 12): 'Ông Công ông Táo'}


def _parse_date(s):
    if not s:
        return dt.date.today()
    f = fold(s)
    if f in ('hom nay', 'today'):
        return dt.date.today()
    if f in ('ngay mai', 'mai'):
        return dt.date.today() + dt.timedelta(days=1)
    if f in ('hom qua',):
        return dt.date.today() - dt.timedelta(days=1)
    nums = [int(x) for x in re.findall(r'\d+', s)]
    if len(nums) >= 3:
        a, b, c = nums[:3]
        return dt.date(a, b, c) if a > 31 else dt.date(c, b, a)
    if len(nums) == 2:
        return dt.date(dt.date.today().year, nums[1], nums[0])
    raise ValueError('Ngày không hợp lệ, dùng dạng dd/mm/yyyy')


def _describe(d):
    i = day_info(d)
    lines = [f'{THU[d.weekday()]}, ngày {d.day}/{d.month}/{d.year} dương lịch',
             f'Âm lịch: ngày {i["ld"]} tháng {i["lm"]}{" (nhuận)" if i["leap"] else ""} năm {i["year_cc"]} ({i["ly"]})',
             f'Ngày {i["day_cc"]}, tháng {i["month_cc"]}, năm {i["year_cc"]}. Tiết khí: {i["tiet_khi"]}.',
             f'{"Ngày hoàng đạo" if i["hoang_dao"] else "Ngày hắc đạo"} ({i["than"]}).',
             'Giờ hoàng đạo: ' + ', '.join(i['gio_hd']) + '.']
    xx = []
    if i['ld'] in (5, 14, 23):
        xx.append('ngày Nguyệt kỵ')
    if i['ld'] in (3, 7, 13, 18, 22, 27):
        xx.append('ngày Tam nương')
    if xx:
        lines.append('Lưu ý: ' + ', '.join(xx) + ' (dân gian kiêng khởi sự việc lớn).')
    le = [LE_DL.get((d.day, d.month)), LE_AL.get((i['ld'], i['lm'])) if not i['leap'] else None]
    if i['ld'] == 1:
        le.append('Mùng 1 âm lịch')
    elif i['ld'] == 15:
        le.append('Ngày rằm')
    le = [x for x in le if x]
    if le:
        lines.append('Sự kiện: ' + ', '.join(le) + '.')
    return '\n'.join(lines)


@tool('lunar_calendar', 'lich',
      'Lịch vạn niên: đổi dương lịch sang âm lịch (và ngược lại), can chi ngày/tháng/năm, tiết khí, ngày hoàng đạo/hắc đạo, '
      'giờ hoàng đạo, ngày lễ. Dùng khi hỏi "hôm nay âm lịch ngày mấy", "rằm tháng 7 là ngày nào".',
      {'date': S('Ngày dương lịch dd/mm/yyyy hoặc "hôm nay", "ngày mai". Bỏ trống = hôm nay'),
       'lunar_date': S('Nếu muốn đổi ÂM → DƯƠNG: ngày âm dạng dd/mm/yyyy (năm âm lịch)'),
       'leap_month': {'type': 'boolean', 'description': 'Tháng âm là tháng nhuận'}})
def lunar_calendar(date=None, lunar_date=None, leap_month=False):
    if lunar_date:
        nums = [int(x) for x in re.findall(r'\d+', lunar_date)]
        if len(nums) == 2:
            nums.append(solar_to_lunar(*reversed(dt.date.today().timetuple()[:3]))[2])
        r = lunar_to_solar(nums[0], nums[1], nums[2], bool(leap_month))
        if not r:
            return f'Năm âm {nums[2]} không có tháng {nums[1]} nhuận.'
        return f'Ngày {nums[0]}/{nums[1]}{" nhuận" if leap_month else ""} âm lịch năm {nums[2]}:\n' + _describe(dt.date(r[2], r[1], r[0]))
    return _describe(_parse_date(date))


@tool('days_until_event', 'lich', 'Đếm ngược tới Tết Nguyên Đán, Trung thu, Giáng sinh, sinh nhật hoặc một ngày bất kỳ.',
      {'event': S('Sự kiện: "tet", "trung thu", "giang sinh", "vu lan", "noel"... hoặc ngày dd/mm/yyyy')}, ['event'])
def days_until_event(event):
    today = dt.date.today()
    f = fold(event)
    lunar = {'tet': (1, 1), 'trung thu': (15, 8), 'vu lan': (15, 7), 'phat dan': (15, 4), 'doan ngo': (5, 5),
             'gio to': (10, 3), 'ong tao': (23, 12), 'ram thang gieng': (15, 1), 'nguyen tieu': (15, 1)}
    solar = {'giang sinh': (24, 12), 'noel': (24, 12), 'tet duong': (1, 1), 'quoc khanh': (2, 9),
             'thieu nhi': (1, 6), 'nha giao': (20, 11), 'phu nu': (20, 10), '8/3': (8, 3), 'valentine': (14, 2)}
    target, name = None, event
    for k, (ld, lm) in lunar.items():
        if k in f:
            ly = solar_to_lunar(today.day, today.month, today.year)[2]
            for yy in (ly, ly + 1):
                d, m, y = lunar_to_solar(ld, lm, yy)
                if dt.date(y, m, d) >= today:
                    target, name = dt.date(y, m, d), f'{k.title()} (âm lịch {ld}/{lm})'
                    break
            break
    if not target:
        for k, (d, m) in solar.items():
            if k in f:
                target = dt.date(today.year, m, d)
                if target < today:
                    target = dt.date(today.year + 1, m, d)
                name = k.title()
                break
    if not target:
        target = _parse_date(event)
        if target < today:
            try:
                target = target.replace(year=target.year + 1) if target.year == today.year else target
            except ValueError:
                pass
    n = (target - today).days
    if n == 0:
        return f'Hôm nay chính là {name}!'
    return f'Còn {n} ngày nữa tới {name} ({THU[target.weekday()]}, {target.day}/{target.month}/{target.year}), khoảng {n // 7} tuần {n % 7} ngày.'


# ---------- Tuổi, mệnh, phong thuỷ ----------
def menh(year):
    return NAP_AM[((year - 4) % 60) // 2]


HANH = {'Kim': 'Kim', 'Mộc': 'Mộc', 'Thủy': 'Thủy', 'Hỏa': 'Hỏa', 'Thổ': 'Thổ'}
SINH = {'Kim': 'Thủy', 'Thủy': 'Mộc', 'Mộc': 'Hỏa', 'Hỏa': 'Thổ', 'Thổ': 'Kim'}
KHAC = {'Kim': 'Mộc', 'Mộc': 'Thổ', 'Thổ': 'Thủy', 'Thủy': 'Hỏa', 'Hỏa': 'Kim'}
MAU = {'Kim': ('trắng, xám, ghi bạc', 'vàng, nâu đất', 'đỏ, hồng, tím'),
       'Mộc': ('xanh lá', 'đen, xanh dương', 'trắng, xám, ghi'),
       'Thủy': ('đen, xanh dương', 'trắng, xám, ghi', 'vàng, nâu đất'),
       'Hỏa': ('đỏ, hồng, cam, tím', 'xanh lá', 'đen, xanh dương'),
       'Thổ': ('vàng, nâu đất', 'đỏ, hồng, tím', 'xanh lá')}
SO = {'Kim': '6, 7', 'Mộc': '3, 4', 'Thủy': '1', 'Hỏa': '9', 'Thổ': '2, 5, 8'}
TAM_HOP = [{8, 0, 4}, {2, 6, 10}, {11, 3, 7}, {5, 9, 1}]
LUC_HOP = [{0, 1}, {2, 11}, {3, 10}, {4, 9}, {5, 8}, {6, 7}]
LUC_XUNG = [{0, 6}, {1, 7}, {2, 8}, {3, 9}, {4, 10}, {5, 11}]
LUC_HAI = [{0, 7}, {1, 6}, {2, 5}, {3, 4}, {8, 11}, {9, 10}]
CAN_HOP = [{0, 5}, {1, 6}, {2, 7}, {3, 8}, {4, 9}]
CAN_XUNG = [{0, 6}, {1, 7}, {2, 8}, {3, 9}]


def _el(year):
    return menh(year).split()[-1]


def _hanh_rel(a, b):
    if a == b:
        return 'bình hoà (cùng hành)', 1
    if SINH[a] == b or SINH[b] == a:
        return f'tương sinh ({a} và {b})', 2
    return f'tương khắc ({a} và {b})', -2


@tool('age_compatibility', 'lich',
      'Xem tuổi: con giáp, mệnh ngũ hành nạp âm của một năm sinh; hoặc xem hai tuổi hợp hay khắc (kết hôn, làm ăn, sinh con) '
      'theo tam hợp, lục hợp, tứ hành xung, ngũ hành, thiên can. Mang tính tham khảo văn hoá.',
      {'year1': I('Năm sinh người thứ nhất', 1900, 2100), 'year2': I('Năm sinh người thứ hai (tuỳ chọn)', 1900, 2100)}, ['year1'])
def age_compatibility(year1, year2=None):
    def one(y):
        e = _el(y)
        return (f'Năm {y}: tuổi {can_chi_year(y)} (con {CON_GIAP[(y + 8) % 12]}), mệnh {menh(y)} (hành {e}). '
                f'Màu hợp: {MAU[e][0]}, {MAU[e][1]}; nên tránh: {MAU[e][2]}. Số hợp: {SO[e]}.')
    if not year2:
        c = (year1 + 8) % 12
        th = next(s for s in TAM_HOP if c in s) - {c}
        lh = next(s for s in LUC_HOP if c in s) - {c}
        xung = next(s for s in LUC_XUNG if c in s) - {c}
        return (one(year1) + f'\nTam hợp với: {", ".join(CHI[x] for x in th)}; lục hợp với: {CHI[lh.pop()]}; '
                f'xung khắc mạnh với: {CHI[xung.pop()]}.')
    c1, c2, k1, k2 = (year1 + 8) % 12, (year2 + 8) % 12, (year1 + 6) % 10, (year2 + 6) % 10
    score, notes = 5, []
    rel, pts = _hanh_rel(_el(year1), _el(year2))
    score += pts
    notes.append(f'Ngũ hành mệnh: {rel}')
    if any({c1, c2} <= s for s in TAM_HOP) and c1 != c2:
        score += 2
        notes.append('Địa chi tam hợp (rất tốt)')
    if any({c1, c2} == s for s in LUC_HOP):
        score += 2
        notes.append('Địa chi lục hợp (tốt)')
    if any({c1, c2} == s for s in LUC_XUNG):
        score -= 2
        notes.append('Địa chi lục xung (kỵ)')
    if any({c1, c2} == s for s in LUC_HAI):
        score -= 1
        notes.append('Địa chi lục hại (hơi kỵ)')
    if any({k1, k2} == s for s in CAN_HOP):
        score += 1
        notes.append('Thiên can hợp')
    if any({k1, k2} == s for s in CAN_XUNG):
        score -= 1
        notes.append('Thiên can xung')
    score = max(0, min(10, score))
    verdict = 'rất hợp' if score >= 8 else 'khá hợp' if score >= 6 else 'trung bình' if score >= 4 else 'kém hợp'
    return (f'{one(year1)}\n{one(year2)}\nKết quả: {"; ".join(notes)}.\nĐiểm {score}/10 → {verdict}. '
            'Xem tuổi chỉ mang tính tham khảo; hạnh phúc phụ thuộc vào sự thấu hiểu và cố gắng của hai người.')


CUNG = {1: ('Khảm', 'Thủy', 'Đông tứ mệnh', ('Đông Nam', 'Đông', 'Nam', 'Bắc'), ('Tây Nam', 'Đông Bắc', 'Tây Bắc', 'Tây')),
        2: ('Khôn', 'Thổ', 'Tây tứ mệnh', ('Đông Bắc', 'Tây', 'Tây Bắc', 'Tây Nam'), ('Bắc', 'Đông Nam', 'Nam', 'Đông')),
        3: ('Chấn', 'Mộc', 'Đông tứ mệnh', ('Nam', 'Bắc', 'Đông Nam', 'Đông'), ('Tây', 'Tây Bắc', 'Đông Bắc', 'Tây Nam')),
        4: ('Tốn', 'Mộc', 'Đông tứ mệnh', ('Bắc', 'Nam', 'Đông', 'Đông Nam'), ('Đông Bắc', 'Tây Nam', 'Tây', 'Tây Bắc')),
        6: ('Càn', 'Kim', 'Tây tứ mệnh', ('Tây', 'Đông Bắc', 'Tây Nam', 'Tây Bắc'), ('Nam', 'Đông', 'Bắc', 'Đông Nam')),
        7: ('Đoài', 'Kim', 'Tây tứ mệnh', ('Tây Bắc', 'Tây Nam', 'Đông Bắc', 'Tây'), ('Đông', 'Nam', 'Đông Nam', 'Bắc')),
        8: ('Cấn', 'Thổ', 'Tây tứ mệnh', ('Tây Nam', 'Tây Bắc', 'Tây', 'Đông Bắc'), ('Đông Nam', 'Bắc', 'Đông', 'Nam')),
        9: ('Ly', 'Hỏa', 'Đông tứ mệnh', ('Đông', 'Đông Nam', 'Bắc', 'Nam'), ('Tây Bắc', 'Tây', 'Tây Nam', 'Đông Bắc'))}


def _digit_root(n):
    while n > 9:
        n = sum(int(c) for c in str(n))
    return n


def cung_menh(year, male):
    r = _digit_root(sum(int(c) for c in str(year)))
    if male:
        k = _digit_root(11 - r) if 11 - r > 0 else 9
        return 2 if k == 5 else k
    k = _digit_root(4 + r)
    return 8 if k == 5 else k


@tool('feng_shui_advice', 'lich',
      'Phong thuỷ Bát trạch theo năm sinh và giới tính: cung mệnh, hướng tốt (Sinh khí, Thiên y, Diên niên, Phục vị) và hướng xấu '
      'cho nhà, cửa, bàn làm việc, giường ngủ; màu sắc, con số hợp mệnh.',
      {'birth_year': I('Năm sinh', 1900, 2100), 'gender': S('Giới tính', ['nam', 'nu'], 'nam')}, ['birth_year'])
def feng_shui_advice(birth_year, gender='nam'):
    male = fold(gender).startswith('nam') or fold(gender) in ('male', 'm')
    name, hanh, nhom, good, bad = CUNG[cung_menh(birth_year, male)]
    e = _el(birth_year)
    return (f'{"Nam" if male else "Nữ"} sinh năm {birth_year} ({can_chi_year(birth_year)}), mệnh {menh(birth_year)}, '
            f'cung {name} (hành {hanh}), thuộc {nhom}.\n'
            f'Hướng tốt: Sinh khí (tài lộc) {good[0]}; Thiên y (sức khoẻ) {good[1]}; Diên niên (gia đạo, tình cảm) {good[2]}; '
            f'Phục vị (bình an, học hành) {good[3]}.\n'
            f'Hướng xấu nên tránh: Tuyệt mệnh {bad[0]}; Ngũ quỷ {bad[1]}; Lục sát {bad[2]}; Hoạ hại {bad[3]}.\n'
            f'Gợi ý: cửa chính và bàn làm việc nhìn về hướng Sinh khí; đầu giường hướng Thiên y hoặc Diên niên; '
            f'bếp đặt ở vị trí xấu nhưng miệng bếp hướng về hướng tốt.\n'
            f'Màu bản mệnh: {MAU[e][0]}; màu tương sinh: {MAU[e][1]}; hạn chế: {MAU[e][2]}. Số hợp: {SO[e]}.')


@tool('find_good_days', 'lich',
      'Xem ngày tốt: liệt kê các ngày hoàng đạo sắp tới để cưới hỏi, khai trương, động thổ, xuất hành, mua xe..., '
      'loại trừ Tam nương, Nguyệt kỵ và ngày xung tuổi (nếu cho năm sinh).',
      {'purpose': S('Việc cần làm, ví dụ "khai trương"'), 'days_ahead': I('Xét trong bao nhiêu ngày tới (7-90)', 7, 90, 30),
       'birth_year': I('Năm sinh người làm việc (để tránh ngày xung tuổi)', 1900, 2100),
       'from_date': S('Bắt đầu từ ngày dd/mm/yyyy (mặc định hôm nay)')})
def find_good_days(purpose='việc quan trọng', days_ahead=30, birth_year=None, from_date=None):
    start = _parse_date(from_date)
    my_chi = (birth_year + 8) % 12 if birth_year else None
    good = []
    for n in range(days_ahead):
        d = start + dt.timedelta(days=n)
        i = day_info(d)
        if not i['hoang_dao'] or i['ld'] in (3, 5, 7, 13, 14, 18, 22, 23, 27):
            continue
        if my_chi is not None and {my_chi, i['day_chi']} in LUC_XUNG:
            continue
        good.append(f'- {THU[d.weekday()]} {d.day}/{d.month}/{d.year} (âm {i["ld"]}/{i["lm"]}), ngày {i["day_cc"]}, {i["than"]}; '
                    f'giờ tốt: {", ".join(g.split(" ")[0] for g in i["gio_hd"][:4])}')
    if not good:
        return f'Không có ngày đẹp trong {days_ahead} ngày tới, hãy xét khoảng dài hơn.'
    return (f'Ngày tốt cho {purpose} trong {days_ahead} ngày từ {start.day}/{start.month}'
            f'{f", hợp tuổi {can_chi_year(birth_year)}" if birth_year else ""}:\n' + '\n'.join(good[:12]) +
            '\n(Tham khảo theo lịch hoàng đạo dân gian.)')


# ---------- Thần số học ----------
NUM_MEAN = {
    1: 'Người tiên phong: độc lập, quyết đoán, có tố chất lãnh đạo; cần học lắng nghe và bớt nóng vội.',
    2: 'Người hoà giải: tinh tế, giàu cảm xúc, giỏi hợp tác; cần tự tin hơn và tránh phụ thuộc.',
    3: 'Người truyền cảm hứng: sáng tạo, vui vẻ, giỏi giao tiếp; cần tập trung và kiên trì.',
    4: 'Người xây dựng: thực tế, kỷ luật, đáng tin cậy; cần linh hoạt và bớt cứng nhắc.',
    5: 'Người tự do: thích khám phá, thích nghi nhanh, đa tài; cần cam kết và tiết chế.',
    6: 'Người chăm sóc: yêu thương, trách nhiệm, hướng về gia đình; cần bớt cầu toàn và lo cho bản thân.',
    7: 'Người tìm kiếm chân lý: sâu sắc, phân tích, trực giác tốt; cần mở lòng và chia sẻ.',
    8: 'Người quyền lực: tham vọng, giỏi quản lý tài chính và kinh doanh; cần cân bằng vật chất và tinh thần.',
    9: 'Người nhân ái: bao dung, lý tưởng, sống vì cộng đồng; cần biết buông bỏ và đặt giới hạn.',
    11: 'Số chủ đạo 11 - người truyền cảm hứng tâm linh: trực giác mạnh, nhạy cảm, có sứ mệnh soi đường cho người khác.',
    22: 'Số chủ đạo 22 - nhà kiến tạo bậc thầy: biến ước mơ lớn thành hiện thực, thực tế và tầm nhìn xa.',
    33: 'Số chủ đạo 33 - người thầy yêu thương: phụng sự, chữa lành, nâng đỡ người khác.'}


def _reduce(n, keep_master=True):
    while n > 9 and not (keep_master and n in (11, 22, 33)):
        n = sum(int(c) for c in str(n))
    return n


def _letters(name):
    return [c for c in fold(name).upper() if 'A' <= c <= 'Z']


@tool('numerology_reading', 'lich',
      'Thần số học Pythagoras: số chủ đạo (đường đời), số sứ mệnh, linh hồn, nhân cách, ngày sinh và năm cá nhân '
      'từ họ tên và ngày sinh.',
      {'birth_date': S('Ngày sinh dd/mm/yyyy'), 'full_name': S('Họ tên đầy đủ (tuỳ chọn)')}, ['birth_date'])
def numerology_reading(birth_date, full_name=None):
    d = _parse_date(birth_date)
    life = _reduce(sum(int(c) for c in d.strftime('%d%m%Y')))
    pers_year = _reduce(sum(int(c) for c in f'{d.day}{d.month}{dt.date.today().year}'), False)
    out = [f'Ngày sinh {d.day}/{d.month}/{d.year}:',
           f'- Số chủ đạo (đường đời) {life}: {NUM_MEAN[life]}',
           f'- Số ngày sinh {_reduce(d.day)}: {NUM_MEAN[_reduce(d.day)].split(":")[0]}.',
           f'- Năm cá nhân {dt.date.today().year}: {pers_year} '
           f'({["", "khởi đầu mới", "hợp tác, kiên nhẫn", "sáng tạo, mở rộng", "xây nền móng", "thay đổi, tự do", "gia đình, trách nhiệm", "nội tâm, học hỏi", "thành quả, tài chính", "kết thúc, buông bỏ"][pers_year]}).']
    if full_name:
        val = lambda c: (ord(c) - 65) % 9 + 1
        L = _letters(full_name)
        vowels = [c for c in L if c in 'AEIOUY']
        cons = [c for c in L if c not in 'AEIOUY']
        expr, soul, pers = (_reduce(sum(map(val, x))) for x in (L, vowels, cons))
        out += [f'Họ tên "{full_name}":',
                f'- Số sứ mệnh {expr}: {NUM_MEAN[expr]}',
                f'- Số linh hồn (khao khát bên trong) {soul}: {NUM_MEAN[soul].split(":")[1].strip()}',
                f'- Số nhân cách (ấn tượng bên ngoài) {pers}: {NUM_MEAN[pers].split(":")[0]}.']
    out.append('(Thần số học mang tính tham khảo, giúp tự hiểu bản thân.)')
    return '\n'.join(out)


# ---------- Cung hoàng đạo & tarot ----------
ZODIAC = [((1, 20), 'Bảo Bình', 'Khí'), ((2, 19), 'Song Ngư', 'Nước'), ((3, 21), 'Bạch Dương', 'Lửa'),
          ((4, 20), 'Kim Ngưu', 'Đất'), ((5, 21), 'Song Tử', 'Khí'), ((6, 22), 'Cự Giải', 'Nước'),
          ((7, 23), 'Sư Tử', 'Lửa'), ((8, 23), 'Xử Nữ', 'Đất'), ((9, 23), 'Thiên Bình', 'Khí'),
          ((10, 23), 'Bọ Cạp', 'Nước'), ((11, 22), 'Nhân Mã', 'Lửa'), ((12, 22), 'Ma Kết', 'Đất')]
TRAIT = {'Lửa': 'nhiệt huyết, chủ động, dũng cảm', 'Đất': 'thực tế, kiên định, đáng tin', 'Khí': 'thông minh, giao tiếp tốt, thích tự do',
         'Nước': 'giàu cảm xúc, trực giác, tinh tế'}
MSG = ['Một cuộc trò chuyện bất ngờ mang lại ý tưởng hay.', 'Hãy kiên nhẫn, việc đang chờ sẽ có kết quả tốt.',
       'Thời điểm tốt để sắp xếp lại tài chính.', 'Dành thời gian cho gia đình sẽ giúp bạn nạp năng lượng.',
       'Đừng ngại nói ra suy nghĩ của mình.', 'Có quý nhân giúp đỡ trong công việc.', 'Nên tránh quyết định vội vàng khi đang mệt.',
       'Một tin vui nhỏ về tình cảm.', 'Học thêm điều mới sẽ mở ra cơ hội.', 'Chú ý giữ sức khoẻ, ngủ đủ giấc.',
       'Hợp tác nhóm mang lại hiệu quả cao.', 'Hãy tự thưởng cho mình sau những cố gắng gần đây.']
COLORS = ['đỏ', 'xanh lá', 'xanh dương', 'vàng', 'trắng', 'tím', 'cam', 'hồng', 'bạc', 'nâu']


def _zodiac(m, d):
    sign = ZODIAC[-1]
    for z in ZODIAC:
        if (m, d) >= z[0]:
            sign = z
    return sign


@tool('daily_horoscope', 'lich',
      'Tử vi/cung hoàng đạo hằng ngày: tính cung từ ngày sinh hoặc tên cung, đánh giá tình cảm, công việc, tài chính, sức khoẻ, '
      'con số và màu may mắn hôm nay. Mang tính giải trí.',
      {'birth_date': S('Ngày sinh dd/mm (hoặc dd/mm/yyyy)'), 'sign': S('Hoặc tên cung, ví dụ "Sư Tử"')})
def daily_horoscope(birth_date=None, sign=None):
    if birth_date:
        nums = [int(x) for x in re.findall(r'\d+', birth_date)]
        z = _zodiac(nums[1], nums[0])
    elif sign:
        z = next((x for x in ZODIAC if fold(x[1]) == fold(sign)), None)
        if not z:
            return 'Không rõ cung. Các cung: ' + ', '.join(x[1] for x in ZODIAC)
    else:
        return 'Cần ngày sinh hoặc tên cung hoàng đạo.'
    today = dt.date.today()
    rnd = random.Random(int(hashlib.md5(f'{z[1]}{today}'.encode()).hexdigest(), 16))
    star = lambda: '★' * rnd.randint(2, 5)
    return (f'Cung {z[1]} (nguyên tố {z[2]}: {TRAIT[z[2]]}) - ngày {today.day}/{today.month}:\n'
            f'Tình cảm {star()}, Công việc {star()}, Tài chính {star()}, Sức khoẻ {star()}.\n'
            f'Lời nhắn: {rnd.choice(MSG)} {rnd.choice(MSG)}\nSố may mắn: {rnd.randint(1, 99)}; màu may mắn: {rnd.choice(COLORS)}.\n'
            '(Mang tính giải trí.)')


TAROT = [('The Fool - Chàng Khờ', 'khởi đầu mới, tự do, dám mạo hiểm', 'liều lĩnh, thiếu chuẩn bị'),
         ('The Magician - Nhà Ảo Thuật', 'năng lực, sáng tạo, biến ý tưởng thành hiện thực', 'thao túng, thiếu tập trung'),
         ('The High Priestess - Nữ Tư Tế', 'trực giác, bí ẩn, lắng nghe nội tâm', 'bỏ qua trực giác, che giấu'),
         ('The Empress - Hoàng Hậu', 'sung túc, nuôi dưỡng, sáng tạo', 'phụ thuộc, trì trệ'),
         ('The Emperor - Hoàng Đế', 'kỷ luật, quyền lực, ổn định', 'độc đoán, cứng nhắc'),
         ('The Hierophant - Giáo Hoàng', 'truyền thống, học hỏi, người dẫn dắt', 'nổi loạn, phá lệ'),
         ('The Lovers - Tình Nhân', 'tình yêu, hoà hợp, lựa chọn quan trọng', 'bất hoà, lựa chọn sai'),
         ('The Chariot - Cỗ Xe', 'ý chí, chiến thắng, tiến lên', 'mất phương hướng, thiếu kiểm soát'),
         ('Strength - Sức Mạnh', 'can đảm, kiên nhẫn, dịu dàng mà mạnh mẽ', 'tự ti, nóng nảy'),
         ('The Hermit - Ẩn Sĩ', 'chiêm nghiệm, tìm câu trả lời bên trong', 'cô lập, khép kín'),
         ('Wheel of Fortune - Bánh Xe Số Phận', 'vận may, bước ngoặt, chu kỳ mới', 'xui rủi, kháng cự thay đổi'),
         ('Justice - Công Lý', 'công bằng, sự thật, nhân quả', 'bất công, né tránh trách nhiệm'),
         ('The Hanged Man - Người Treo Ngược', 'tạm dừng, nhìn từ góc khác, hy sinh', 'trì hoãn, bế tắc'),
         ('Death - Sự Chuyển Hoá', 'kết thúc để bắt đầu, thay đổi lớn', 'sợ thay đổi, níu kéo'),
         ('Temperance - Tiết Độ', 'cân bằng, hài hoà, kiên nhẫn', 'mất cân bằng, thái quá'),
         ('The Devil - Ác Quỷ', 'ràng buộc, cám dỗ, nhận ra điều trói buộc mình', 'giải thoát, buông bỏ thói quen xấu'),
         ('The Tower - Toà Tháp', 'biến động bất ngờ, thức tỉnh', 'né tránh khủng hoảng'),
         ('The Star - Ngôi Sao', 'hy vọng, chữa lành, cảm hứng', 'mất niềm tin, nản lòng'),
         ('The Moon - Mặt Trăng', 'mơ hồ, cảm xúc, trực giác', 'sáng tỏ dần, hết lo âu'),
         ('The Sun - Mặt Trời', 'niềm vui, thành công, năng lượng tích cực', 'lạc quan quá mức, chậm trễ'),
         ('Judgement - Phán Xét', 'thức tỉnh, đánh giá lại, cơ hội thứ hai', 'tự trách, do dự'),
         ('The World - Thế Giới', 'hoàn thành, viên mãn, trọn vẹn', 'dang dở, thiếu kết thúc')]


@tool('tarot_reading', 'lich', 'Rút bài Tarot (1 lá hoặc 3 lá quá khứ - hiện tại - tương lai) cho một câu hỏi. Mang tính giải trí.',
      {'question': S('Câu hỏi/chủ đề'), 'cards': I('Số lá: 1 hoặc 3', 1, 3, 3)})
def tarot_reading(question='', cards=3):
    rnd = random.SystemRandom()
    picks = rnd.sample(TAROT, 3 if cards >= 2 else 1)
    pos = ['Quá khứ', 'Hiện tại', 'Tương lai'] if len(picks) == 3 else ['Thông điệp']
    out = [f'Trải bài cho câu hỏi: {question or "tổng quan"}']
    for p, c in zip(pos, picks):
        rev = rnd.random() < 0.3
        out.append(f'- {p}: {c[0]}{" (ngược)" if rev else ""} → {c[2] if rev else c[1]}.')
    out.append('Hãy diễn giải nhẹ nhàng, tích cực và nhắc rằng tarot mang tính giải trí.')
    return '\n'.join(out)
