# Cosmic Delivery Co. — TIGames / Nagatoro

## What Is This?
2-player co-op web game. One pilots (WASD), one guns (mouse). Deliver a package across 3 sectors of space. Built for long-distance play (Bishkek ↔ abroad). Latency-tolerant at 250ms.

## North Star
Personality > polish. Coordination > skill. Latency-tolerant always. Ship what's working.

## 90-Day Target
Game is DONE when: deployed URL works, two players across countries can play 3 sectors, Captain makes them laugh, she wants to play again.

## Tech Stack (LOCKED — do not change)
- Server: Node.js 20+, Express, Socket.IO 4.x
- Client: Single index.html + vanilla JS + HTML5 Canvas. NO build step. NO framework.
- Hosting: Render free tier
- Persistence: highscores.json (no database)
- Audio: HTML5 audio tags, CC0 sources

## DO NOT introduce
TypeScript, Vite, React, ECS library, physics engine, Redis, database, Docker, build step.

## Architecture
- Server-authoritative at 30Hz tick
- Clients are dumb renderers + input forwarders
- No client-side prediction
- Socket.IO for real-time comms
- Full snapshots each tick (fine for ~50 entities)

## Full spec
See COSMIC_DELIVERY_PLAN.md — it is the source of truth.

## Conventions
- Update progress/ after every significant change
- Follow build order in the plan
- Cut features before cutting deadlines (cut list in plan section 7)
- Everything is circle collision, O(n²) is fine
- Use dt for all physics, don't hardcode tick rate
