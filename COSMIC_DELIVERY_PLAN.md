# Cosmic Delivery Co. — Build Plan

A 2-player co-op web game. Two players share one spaceship: one **pilots** (movement), the other **gunners** (aim + shoot). They deliver a package across 3 sectors of increasing chaos. Built to be played long-distance over the internet — pilot is in Bishkek, gunner is abroad — so latency tolerance is a hard requirement.

This document is the complete spec. Build it in the order described. Do not refactor, optimize, or expand scope mid-build. Cut features before cutting deadlines.

---

## 0. North Star

The point of this game is **the gesture**, not the artifact. It's a gift for a long-distance partner. That means:

- **Personality > polish.** A goofy space whale boss that barely works > a flawless asteroid field.
- **Coordination > skill.** Mechanics should force the two players to *talk*. If a single player could play both roles easily, the design is wrong.
- **Latency-tolerant always.** No frame-perfect inputs. Server is authoritative. Aim for "feels fine at 250ms ping."
- **Ship what's working.** If Sunday afternoon arrives and a feature isn't done, cut it. A finished janky game beats an unfinished polished one.

If a design decision conflicts with the above, the above wins.

---

## 1. Tech Stack (locked, do not change)

- **Server:** Node.js 20+, Express, Socket.IO 4.x
- **Client:** Single `index.html` + vanilla JS + HTML5 Canvas. No build step. No framework.
- **Hosting:** Render free tier for the server. Static client served by the same Express instance (so one URL, no CORS hell).
- **Persistence:** A single `highscores.json` file on the server, read/written with `fs.promises`. No database.
- **Audio:** HTML5 `<audio>` tags with preload. Source files from freesound.org (CC0) or generate with sfxr/jsfxr.

**Do not** introduce: TypeScript, Vite, React, an ECS library, a physics engine, Redis, a database, Docker, or a build step. The whole thing is plain JS.

---

## 2. File Structure

```
cosmic-delivery/
├── package.json
├── server.js              # Express + Socket.IO + game loop
├── game/
│   ├── room.js            # Room state, player slots, game loop per room
│   ├── entities.js        # Ship, Asteroid, Enemy, Bullet, Whale classes
│   ├── sectors.js         # Sector definitions, spawn logic
│   └── highscores.js      # Read/write highscores.json
├── public/
│   ├── index.html         # Entry point: title, room code UI, canvas
│   ├── client.js          # Render loop, input handling, socket events
│   ├── style.css          # Title screen + HUD styling
│   ├── sprites/           # PNG sprites (or generated procedurally)
│   └── sounds/            # .mp3/.ogg files
├── highscores.json        # Created on first run
└── README.md              # How to run locally, how to deploy
```

---

## 3. Visual & Audio Direction

**Style: Pixel art / retro arcade.** Think original Asteroids meets NES Star Soldier. Black background, white/colored sprites, scanline filter optional but nice. CRT vibes.

- **Resolution:** Render at 480×270 logical pixels, scale up to fit window with `image-rendering: pixelated`. Keeps everything crisp and forgiving on art quality.
- **Palette:** Limit to ~16 colors. Use a published palette like [Endesga 16](https://lospec.com/palette-list/endesga-16) or [Sweetie 16](https://lospec.com/palette-list/sweetie-16). Pick one and commit.
- **Sprites:** If hand-drawing pixel art is too slow, use simple geometric primitives drawn directly to canvas (triangles for ship, circles for asteroids, etc.) and call it stylistic. The space whale should be a hand-drawn sprite — it's the centerpiece.
- **Sound:** Looping chiptune track (find one CC0 on opengameart.org), shoot sfx, explosion sfx, powerup sfx, hit sfx. That's it.

---

## 4. Game Design Spec

### 4.1 Roles

**Pilot (Player 1):**
- Controls ship position with WASD or arrow keys
- Ship has momentum (slight inertia) — not instant snap
- Cannot shoot

**Gunner (Player 2):**
- Aims with mouse cursor (cursor position = aim direction from ship center)
- Click or hold to shoot
- Bullets travel from ship in aim direction
- Cannot move the ship

**Critical rule:** Roles are assigned on join. First player who joins a room is pilot; second is gunner. After each sector, roles **swap automatically**. This is non-negotiable — it's what makes the co-op work.

### 4.2 Sectors

Each sector is ~60 seconds of gameplay. After surviving, a "Sector Complete" screen plays with role swap announcement and a one-liner from the **Captain** character (see 4.5). Then next sector begins.

**Sector 1: The Belt**
- Asteroids spawn from screen edges, drift across with random velocity
- Asteroid sizes: large (3 hits), medium (2 hits), small (1 hit). Large breaks into 2 mediums on death; medium breaks into 2 smalls.
- Spawn rate ramps up over the 60s.
- Ship dies on contact with any asteroid.

**Sector 2: Pirate Skirmish**
- Asteroids continue at low rate
- Enemy ships spawn from edges, fly to a position, shoot bullets at the ship's current location, then retreat
- Enemy bullets are slow and visible — dodgeable
- 2 hits to kill an enemy
- Enemy ships drop a powerup token 30% of the time on death

**Sector 3: The Whale**
- Background changes color (deep purple)
- Music shifts to a "boss" track (or just slow down + lower pitch on existing track)
- A massive space whale enters from the right, takes up ~40% of the screen
- **3 phases:**
  1. Whale opens mouth periodically — only vulnerable then. Spits out 5 small asteroids at a time.
  2. At 66% HP: whale starts moving up/down in a sine wave, spawns 2 mini-whales that home weakly toward the ship.
  3. At 33% HP: whale enrages, mouth stays open longer but spawns enemy ships from its mouth.
- Whale has 50 HP total. Should take ~90 seconds to kill.
- Killing the whale = "Delivery Complete" victory screen.
- After victory: loop back to Sector 1 with +20% spawn rates and difficulty. High score = total deliveries completed.

### 4.3 Powerups

Spawn occasionally from destroyed enemies in Sector 2 and from the whale. Float across screen with slow drift.

- **Shield (blue):** Pilot must fly *over* the powerup to collect. Grants 1 free hit (next collision doesn't kill).
- **Spread Shot (yellow):** Gunner triggers by shooting it. Next 10 bullets fire in a 3-bullet spread.
- **Repair (green):** Both must coordinate — pilot flies over it AND gunner is holding spacebar at moment of pickup. If only one condition is met, powerup is wasted. This forces voice coordination. Restores shield charge.

**Do not add more powerups.** Three is enough; each one creates a different kind of conversation.

### 4.4 Scoring

- Each asteroid destroyed: +10 (small), +25 (medium), +50 (large)
- Each enemy destroyed: +100
- Whale destroyed: +1000
- Sector cleared without dying: +500 bonus
- Score persists across sectors in a single delivery run
- Run ends on death; score submitted to server

**Highscores:** Top 5 (room name + score + deliveries completed + date) stored in `highscores.json`. Shown on title screen.

### 4.5 The Captain

A small pixel-art character that appears in a dialogue box between sectors and on death/victory. This is where personality lives.

- Sample lines (write ~30 of these, randomize):
  - Sector 1 intro: "First delivery on the job, lovebirds? Try not to crash. The package is fragile. So is my patience."
  - Sector 2 intro: "Pirates ahead. Their ships are made of garbage. Yours, somehow, is worse."
  - Sector 3 intro: "There's a whale in space. Don't ask. Just shoot it."
  - On death: "You died. The package is now floating in the void. A child somewhere will not get their birthday gift. Hope you're proud."
  - On victory: "You did it. I'm legally required to congratulate you. Consider yourselves congratulated."
  - Powerup wasted (repair fail): "You both had ONE job. Literally one each. Embarrassing."

Make him sarcastic but warm. The roasting is the love language. Players should laugh, not feel bad.

**Critical:** the lines should reference both players by name if possible. Capture the names on room creation/join (default to "Pilot" and "Gunner" if blank).

---

## 5. Networking Architecture

### 5.1 Authority Model

Server is fully authoritative. Clients are dumb renderers + input forwarders.

- **30 Hz server tick.** Game state advances on the server, snapshot is broadcast to both clients each tick.
- Clients send inputs as they happen (keydown/keyup, mouse moves throttled to 30Hz, click events).
- Clients render the latest snapshot received, with optional client-side interpolation between the last two snapshots for smoothness.
- No client-side prediction (not worth the complexity for this scope).

This means there's a visible ~half-RTT input delay. At 250ms ping that's ~125ms. For this game's pace, that's acceptable. Do not try to fix it with prediction.

### 5.2 Socket.IO Events

**Client → Server:**
- `room:create { playerName }` → returns `{ roomCode, playerId, role }`
- `room:join { roomCode, playerName }` → returns `{ playerId, role }` or error
- `input:pilot { up, down, left, right }` (booleans, sent on change)
- `input:gunner { aimX, aimY, shooting, holdingRepair }` (sent on change, mouse moves throttled to 30Hz)
- `game:start` (host only, when both players ready)
- `game:restart` (after death/victory)

**Server → Client:**
- `state:snapshot { ship, asteroids, enemies, bullets, powerups, whale, score, sector, sectorTimer, captainMessage, lives }`
- `room:playerJoined { playerName, role }`
- `room:playerLeft { role }` — pause game, show "Partner disconnected" screen
- `game:event { type: 'death'|'victory'|'sectorComplete'|'powerupWasted', message }`

### 5.3 Room Lifecycle

- Room codes are 4 uppercase letters (e.g., "ZQXM"). Avoid I/O/0/1 to reduce confusion.
- Rooms expire after 1 hour of inactivity or when both players disconnect.
- Max 2 players per room. Spectators not supported (can be added later, don't bother now).
- If one player disconnects mid-game, pause the game, hold state for 60s, allow rejoin with same room code.

---

## 6. Build Order (this is the schedule)

Execute in this exact order. Do not jump ahead. Each step should produce a runnable artifact.

### Saturday Morning (3 hours): Local single-machine prototype
- [ ] Initialize Node project, install `express`, `socket.io`
- [ ] Set up Express to serve `public/` statically + Socket.IO endpoint
- [ ] Write `Room` class with player slots, game loop at 30Hz
- [ ] Implement Ship entity with pilot input handling
- [ ] Implement Bullet entity with gunner input handling
- [ ] Implement Asteroid entity (large/medium/small, splitting on death)
- [ ] Implement collision detection (circle-circle for everything, KISS)
- [ ] Render all of the above on the client canvas
- [ ] **Goal: Open two browser tabs on localhost, control pilot in one, gunner in other, play Sector 1.**

### Saturday Afternoon (3 hours): Real multiplayer
- [ ] Add room creation / join flow with 4-letter codes
- [ ] Build title screen UI (create room / join room / enter name)
- [ ] Add `game:start` flow and pre-game lobby ("Waiting for partner...")
- [ ] Handle disconnects gracefully (pause game, show reconnect screen)
- [ ] Deploy to Render free tier
- [ ] **Goal: Send the URL to your phone, play it across two devices.**

### Saturday Evening (1.5 hours): Sector 2
- [ ] Implement Enemy entity (spawn from edge, fire pattern, retreat)
- [ ] Add sector progression (timer, transition screen)
- [ ] Implement role-swap on sector transition
- [ ] Implement Powerup entities (shield, spread shot, repair)
- [ ] **Goal: Play through Sectors 1 and 2 end-to-end.**

### Sunday Morning (3 hours): Personality + sound + UI polish
- [ ] Add Captain character art + dialogue system
- [ ] Write all ~30 Captain lines
- [ ] Hook up sound effects (shoot, explode, powerup, hit)
- [ ] Add background music (one track, loops)
- [ ] Style title screen, HUD (score, sector, role indicator)
- [ ] Add visual polish: particle explosions (just dots fading out), screen shake on death, starfield background
- [ ] **Goal: It looks and sounds like a finished game.**

### Sunday Afternoon (2.5 hours): Sector 3 boss + highscores
- [ ] Implement Whale entity with 3 phases
- [ ] Implement mini-whale entity
- [ ] Implement victory screen
- [ ] Implement difficulty loop after victory
- [ ] Implement highscores.json read/write
- [ ] Show highscores on title screen
- [ ] **Goal: Full game end-to-end.**

### Sunday Evening: Playtest with girlfriend
- [ ] Send URL
- [ ] Play
- [ ] Take notes on what's broken, fix only the critical things
- [ ] Don't add features

---

## 7. Cut List (what to drop if running behind)

In strict order — cut top to bottom as needed:

1. ~~Spectator support~~ — already cut, don't add
2. **Sector 3 boss** → end game after Sector 2, victory screen says "Delivery Complete"
3. **Mini-whales in phase 2** → whale just sine-waves
4. **Repair powerup** → only ship and spread shot
5. **Highscores persistence** → just show in-session score
6. **Captain dialogue** → keep title screen personality but skip between-sector lines
7. **Music** → SFX only

Do **not** cut: role swapping, room codes, the basic Captain on title screen, the gunner-aims-with-mouse mechanic. Those are core.

---

## 8. Specific Implementation Notes

### Server game loop pattern

```javascript
// In Room class
start() {
  this.lastTick = Date.now();
  this.loop = setInterval(() => {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.update(dt);
    this.broadcast();
  }, 1000 / 30);
}
```

Use `dt` for all entity updates. Don't hardcode tick rate into physics.

### Snapshot size

Don't send the whole world every tick if it gets big. For this scope (max ~50 entities), full snapshots are fine. If snapshots exceed ~5KB, switch to delta encoding — but don't preemptively optimize.

### Input handling on client

Pilot:
```javascript
const keys = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', e => {
  const before = JSON.stringify(keys);
  if (e.key === 'w' || e.key === 'ArrowUp') keys.up = true;
  // ... etc
  if (JSON.stringify(keys) !== before) socket.emit('input:pilot', keys);
});
// Same for keyup
```

Gunner mouse:
```javascript
let lastEmit = 0;
canvas.addEventListener('mousemove', e => {
  const now = Date.now();
  if (now - lastEmit < 33) return; // throttle to 30Hz
  lastEmit = now;
  const rect = canvas.getBoundingClientRect();
  const aimX = (e.clientX - rect.left) / rect.width;  // normalize 0-1
  const aimY = (e.clientY - rect.top) / rect.height;
  socket.emit('input:gunner', { aimX, aimY, shooting, holdingRepair });
});
```

### Collision

Everything is a circle. `dist(a, b) < a.r + b.r`. Don't use a physics engine. Don't use spatial hashing. With ~50 entities O(n²) is fine.

### Deploying to Render

- Push to GitHub
- Create new Web Service on Render, point at the repo
- Build command: `npm install`
- Start command: `node server.js`
- Free tier sleeps after 15min idle — first request after sleep takes ~30s. Warn each other before playing.
- Set `PORT` from env: `const PORT = process.env.PORT || 3000;`

---

## 9. Things That Will Tempt You — Don't

- Adding TypeScript "for safety." It's a weekend project. No.
- Refactoring the entity classes into a clean ECS. The classes are fine.
- Implementing client-side prediction "for smoothness." The game design tolerates the lag. Leave it.
- Adding more sectors / weapons / powerups. Three of each is the design. Resist.
- Pretty-printing your code. Format on save, move on.
- Setting up a fancy build pipeline. There is no build. It's HTML and JS. Open the file.
- Making it work on mobile. Two players, one keyboard role, one mouse role. Desktop only. Add a "play on desktop" notice if someone opens it on mobile.

If you find yourself doing any of these, stop and go back to the build order checklist.

---

## 10. Definition of Done

The game is done when:
1. You can open the deployed URL, create a room, share the code with your girlfriend
2. She can join from her country, both of you load into the game
3. You can play through all 3 sectors (or 2 if cut), with role swaps
4. The Captain says something funny at least 4 times during a run
5. When you die, you laugh instead of being annoyed
6. She wants to play it again

That's it. That's done. Ship it.
