'use strict';

const GAME_W = 480;
const GAME_H = 270;

// Returns a random spawn position on the screen edge
function edgeSpawn() {
  const edge = Math.floor(Math.random() * 4); // 0=top,1=right,2=bottom,3=left
  switch (edge) {
    case 0: return { x: Math.random() * GAME_W, y: -25 };
    case 1: return { x: GAME_W + 25, y: Math.random() * GAME_H };
    case 2: return { x: Math.random() * GAME_W, y: GAME_H + 25 };
    case 3: return { x: -25, y: Math.random() * GAME_H };
  }
}

// Returns velocity pointing roughly toward center from spawn position
function velocityTowardCenter(x, y, speed) {
  const cx = GAME_W / 2 + (Math.random() - 0.5) * 100;
  const cy = GAME_H / 2 + (Math.random() - 0.5) * 80;
  const dx = cx - x;
  const dy = cy - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const actualSpeed = speed * (0.8 + Math.random() * 0.4);
  return {
    vx: (dx / dist) * actualSpeed,
    vy: (dy / dist) * actualSpeed
  };
}

function weightedAsteroidSize() {
  const r = Math.random();
  if (r < 0.50) return 'large';
  if (r < 0.80) return 'medium';
  return 'small';
}

// Sector configs are consumed by Room; this just returns timing/rate parameters
// difficulty is a multiplier (1.0 base, increases each loop)
function getSectorConfig(sector, difficulty) {
  difficulty = difficulty || 1.0;

  switch (sector) {
    case 1: {
      // The Belt — pure asteroids, rate ramps 0→60s
      return {
        sector: 1,
        name: 'The Belt',
        duration: 60,
        asteroid: {
          // Rate function: given elapsed time 0-60, returns seconds between spawns
          getRateInterval(elapsed, sectorDuration) {
            const t = Math.min(elapsed / sectorDuration, 1);
            // 2s at start → 0.5s at end
            return (2 - t * 1.5) / difficulty;
          },
          getSpawnParams() {
            const pos = edgeSpawn();
            const speed = (30 + Math.random() * 50) * difficulty;
            const vel = velocityTowardCenter(pos.x, pos.y, speed);
            return { ...pos, ...vel, size: weightedAsteroidSize() };
          }
        },
        enemy: null,
        spawnEnemies: false
      };
    }

    case 2: {
      // Pirate Skirmish — light asteroids + enemy ships
      return {
        sector: 2,
        name: 'Pirate Skirmish',
        duration: 60,
        asteroid: {
          getRateInterval() { return 4 / difficulty; },
          getSpawnParams() {
            const pos = edgeSpawn();
            const speed = (30 + Math.random() * 50) * difficulty;
            const vel = velocityTowardCenter(pos.x, pos.y, speed);
            return { ...pos, ...vel, size: weightedAsteroidSize() };
          }
        },
        enemy: {
          getRateInterval() { return 3 / difficulty; },
          maxOnScreen: 3,
          getSpawnParams() {
            // Spawn from left or right edge
            const fromLeft = Math.random() < 0.5;
            const x = fromLeft ? -20 : GAME_W + 20;
            const y = 30 + Math.random() * (GAME_H - 60);
            // Target: random position in center region
            const targetX = 80 + Math.random() * 300;
            const targetY = 40 + Math.random() * (GAME_H - 80);
            return { x, y, targetX, targetY };
          },
          powerupDropChance: 0.30
        },
        spawnEnemies: true
      };
    }

    case 3: {
      // The Whale — boss sector
      return {
        sector: 3,
        name: 'The Whale',
        duration: 120, // up to 2 min, ends when whale dies
        asteroid: null,
        enemy: null,
        spawnEnemies: false,
        spawnWhale: true
      };
    }

    default:
      return getSectorConfig(1, difficulty);
  }
}

module.exports = { getSectorConfig, edgeSpawn, GAME_W, GAME_H };
