#!/usr/bin/env python3
"""Rebuild ntos-standalone.html = index.html with the external theme stylesheet
(ntos-theme.css) and both module <script src> tags (ntos-game.js, ntos-world.js)
replaced by their raw contents inlined. This keeps the *source* organised across
files while the *standalone* stays a single shareable file. Everything else in
index.html is preserved."""
import io, os, re, sys
BASE = os.path.dirname(os.path.abspath(__file__))
def read(p): return io.open(p, encoding='utf-8').read()

index = read(f'{BASE}/index.html')
out = index

# 1) inline the theme stylesheet ------------------------------------------------
css = read(f'{BASE}/ntos-theme.css').rstrip('\n')
css_pat = re.compile(r'<link rel="stylesheet" href="ntos-theme\.css">')
if len(css_pat.findall(out)) != 1:
    sys.exit('ABORT: expected exactly one ntos-theme.css <link> tag')
out = css_pat.sub(lambda m: '<style>\n' + css + '\n</style>', out)

# 2) inline the two JS modules --------------------------------------------------
for mod in ('ntos-game', 'ntos-world'):
    src = read(f'{BASE}/{mod}.js').rstrip('\n')
    pat = re.compile(r'<script src="' + mod + r'\.js\?v=[^"]*"></script>')
    if len(pat.findall(out)) != 1:
        sys.exit(f'ABORT: expected exactly one {mod}.js <script src> tag')
    out = pat.sub(lambda m: '<script>\n' + src + '\n</script>', out)

io.open(f'{BASE}/ntos-standalone.html', 'w', encoding='utf-8').write(out)
for tok in ('NineToSurvive', 'NtosWorld', 'startGame', 'ENCOUNTERS', 'newDay'):
    assert tok in out, 'missing '+tok
assert '.js?v=' not in out, 'src tag leaked'
assert 'href="ntos-theme.css"' not in out, 'css link leaked'
assert '--ink:' in out, 'theme tokens missing'
print('OK standalone rebuilt: %d bytes' % len(out))
