#!/usr/bin/env python3
"""Rebuild ntos-standalone.html = index.html with both module <script src> tags
(ntos-game.js, ntos-world.js) replaced by the raw modules inlined. Everything
else in index.html is preserved."""
import io, re, sys
BASE = '/Users/kevindriscoll/Desktop/nine to survive'
def read(p): return io.open(p, encoding='utf-8').read()

index = read(f'{BASE}/index.html')
out = index
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
print('OK standalone rebuilt: %d bytes' % len(out))
