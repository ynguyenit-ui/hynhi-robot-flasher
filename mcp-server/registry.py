"""Tool registry: each tool has a name, a group, a Vietnamese description and a JSON schema."""
import traceback

GROUPS = {
    'tra_cuu': 'Tin tức & tra cứu',
    'tai_chinh': 'Tài chính',
    'lich': 'Lịch & tâm linh',
    'hoc_tap': 'Học tập & gia sư',
    'tu_van': 'Tư vấn chuyên gia',
    'giai_tri': 'Giải trí & cho bé',
    'tien_ich': 'Tiện ích',
}
TOOLS: dict = {}


def tool(name, group, desc, props=None, required=()):
    def deco(fn):
        TOOLS[name] = {
            'name': name, 'group': group, 'fn': fn,
            'schema': {'name': name, 'description': desc, 'inputSchema': {
                'type': 'object', 'properties': props or {}, 'required': list(required)}},
        }
        return fn
    return deco


def S(desc, enum=None, default=None):
    d = {'type': 'string', 'description': desc}
    if enum:
        d['enum'] = list(enum)
    if default is not None:
        d['default'] = default
    return d


def I(desc, lo=None, hi=None, default=None):
    d = {'type': 'integer', 'description': desc}
    if lo is not None:
        d['minimum'] = lo
    if hi is not None:
        d['maximum'] = hi
    if default is not None:
        d['default'] = default
    return d


def schemas(disabled_groups=()):
    return [t['schema'] for t in TOOLS.values() if t['group'] not in disabled_groups]


def call(name, args, disabled_groups=()):
    """Run a tool; returns (text, is_error). Never raises."""
    t = TOOLS.get(name)
    if not t or t['group'] in disabled_groups:
        return f'Không có công cụ {name}.', True
    props = t['schema']['inputSchema']['properties']
    clean = {}
    for k, v in (args or {}).items():
        if k not in props or v is None or v == '':
            continue
        if props[k].get('type') == 'integer':
            try:
                v = int(float(v))
            except (TypeError, ValueError):
                continue
            if 'minimum' in props[k]:
                v = max(v, props[k]['minimum'])
            if 'maximum' in props[k]:
                v = min(v, props[k]['maximum'])
        clean[k] = v
    for k in t['schema']['inputSchema']['required']:
        if k not in clean:
            return f'Thiếu tham số "{k}".', True
    try:
        out = t['fn'](**clean)
        return (out if isinstance(out, str) else str(out)), False
    except Exception as e:  # tool failures go back to the AI as text, never kill the connection
        traceback.print_exc()
        return f'Lỗi khi chạy {name}: {e}', True
