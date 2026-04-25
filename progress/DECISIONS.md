# DECISIONS — Cosmic Delivery Co.

*Architecture and strategy decisions with reasoning. So we never re-debate.*

## DEC-001: Progress Tracking From Day 0
- **Date:** 2026-04-26
- **Decision:** Use standard progress/ directory structure
- **Reasoning:** Consistent with all projects
- **Status:** Active

## DEC-002: Tech Stack Locked
- **Date:** 2026-04-26
- **Decision:** Node.js + Express + Socket.IO server, vanilla JS + Canvas client, no build step
- **Reasoning:** Weekend project, simplicity over scalability, one URL deployment
- **Status:** Locked — do not change

## DEC-003: Server-Authoritative Networking
- **Date:** 2026-04-26
- **Decision:** Server runs game at 30Hz, clients are dumb renderers, no client prediction
- **Reasoning:** Latency tolerance at 250ms is acceptable for game pace, prediction not worth complexity
- **Status:** Locked

## DEC-004: Build Full Game In Parallel
- **Date:** 2026-04-26
- **Decision:** Build all 3 sectors + all features at once using parallel agents, rather than sequential phases
- **Reasoning:** Spec is complete and locked, no ambiguity, parallel execution is faster
- **Status:** Active
