# Build — nine-to-survive-visual-v1

A **frozen, shippable snapshot** of the first production-quality visual version.

- `index.html` — the whole game in one self-contained file (all CSS + JS + the
  logo inlined). Double-click to play; upload as-is to any static host / GitHub
  Pages.
- Generated from source by `python3 build_standalone.py` at the
  "Implement visual production v1" commit. **Do not hand-edit** — regenerate from
  source and re-copy if you need a new build.
- `?movie=1` plays itself to the walkout; runs auto-save to the browser.

This folder is a release artifact, not source. Edit the game in
`../../ntos-game.js` / `../../ntos-world.js` / `../../ntos-theme.css`.
