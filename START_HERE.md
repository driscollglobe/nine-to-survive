# START HERE — Nine to Survive (for a first-time Claude Code user)

Welcome. This folder is a complete, working game: **Nine to Survive — Your Number**, a
real-time office-survival game. Everything you need is inside, including its full history
and instructions for the AI that's been building it.

## 1. Put the folder in the right place

Unzip this so the folder sits on your **Desktop** and is named exactly:

```
Desktop/nine to survive
```

(That's it — no install, no dependencies. It's plain HTML/JS. You do need a **Mac** for
the test scripts; the game itself runs anywhere.)

## 2. Play it first (30 seconds)

Double-click **`ntos-standalone.html`** — the whole game in one file, opens in your
browser. Get a feel for it before touching anything:
- Click the floor to walk the badger around. Work happens when you're AT your desk.
- Watch for ❗ — the Boss walks the floor; Brad steals from unattended inboxes.
- Coffee / couch / chatting with coworkers refills Soul. Bank $3,100 and walk out the EXIT.

## 3. Get Claude Code

Claude Code is the AI coding tool this project is built with. Easiest path:

1. Download the **Claude desktop app**: https://claude.ai/download (sign in or make an
   account — ask Kevin which plan/account to use).
2. In the app, open **Claude Code** (it's a tab/section in the desktop app).
3. When it asks for a project folder, choose **`Desktop/nine to survive`** — the folder
   from step 1. That's important: Claude reads the files in whatever folder you open.

## 4. Your first message to Claude

Paste this exactly:

> Read HANDOFF.md and SESSION_LOG.md in this folder, then run both test suites
> (`cd` into the folder, then `osascript -l JavaScript game-test.js` and
> `osascript -l JavaScript world-test.js`) and confirm they're green. Then give me a
> short summary of where the project stands and wait for my direction.

Claude will read the project's own documentation, verify everything works, and brief you.
From there, just tell it what you want in plain English ("make the boss meaner",
"add a vending machine", "the couch feels too strong") — it knows the codebase rules.

## 5. The three rules (Claude knows these, but so should you)

1. **Never edit `ntos-standalone.html` by hand.** It's built from the other files by
   running `python3 build_standalone.py`. Edit the source files; rebuild.
2. **The code is split on purpose**: `ntos-game.js` = rules, `ntos-world.js` = the office,
   `index.html` = presentation. Ask Claude to keep changes in the right file.
3. **After any change**: run both test files (they must say `0 failed`), then rebuild the
   standalone. Claude does this automatically if you let it.

## 6. What the files are

| File | What it is |
|---|---|
| `ntos-standalone.html` | The whole game, one file. **This is what you share/upload.** |
| `index.html` + `ntos-game.js` + `ntos-world.js` | The same game as editable source (open index.html to play the dev version) |
| `game-test.js`, `world-test.js` | Automated tests (140 checks incl. 100 simulated careers) |
| `build_standalone.py` | Rebuilds the standalone from the source files |
| `HANDOFF.md` | The project's current state — Claude's briefing doc |
| `SESSION_LOG.md` | The full build history, session by session |
| `TASKS.md` | The most recent work order (example of how Kevin briefs Claude) |
| `assets/mascot.png` | The badger logo (start screen) |

## 7. Publishing to the web

Upload **`ntos-standalone.html`** to GitHub, renamed **`index.html`**, in a repo with
GitHub Pages turned on. One file, done. (Ask Claude Code to walk you through it —
say "help me publish this to GitHub Pages" and it will.)

## Handy extras

- Add `?movie=1` to the game URL and it plays itself to the win (a demo mode).
- Your run auto-saves in the browser; there's a Resume button on the title screen.
- This folder is a git repository — every change ever made is in the history. Ask Claude
  "show me the git log" if you're curious.
