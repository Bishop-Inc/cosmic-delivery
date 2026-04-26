'use strict';

let _nextId = 1;
function nextId() { return _nextId++; }

// ---------------------------------------------------------------------------
// Ship
// ---------------------------------------------------------------------------
class Ship {
  constructor() {
    this.id = nextId();
    this.x = 240;
    this.y = 135;
    this.vx = 0;
    this.vy = 0;
    this.radius = 10;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasSpreadShot = 0; // remaining spread shots
  }

  update(dt) {
    if (this.hasShield) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.hasShield = false;
        this.shieldTimer = 0;
      }
    }
  }

  reset() {
    this.x = 240;
    this.y = 135;
    this.vx = 0;
    this.vy = 0;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasSpreadShot = 0;
  }
}

// ---------------------------------------------------------------------------
// EVAPlayer — a crewmate floating in space (ragdoll + jetpack)
// ---------------------------------------------------------------------------
class EVAPlayer {
  constructor(x, y, vx, vy, role) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 4;
    this.rotation = 0;
    this.angularVelocity = (Math.random() - 0.5) * 8;
    this.role = role; // 'pilot' | 'gunner'
    this.boardingTimer = 0;
    this.ejectTimer = 0;
    this.driftingFired = false;
    this.distressFired = false;
    this.dead = false;
  }

  update(dt) {
    // Slight friction so jetpack feels responsive (space dust handwave)
    this.vx *= Math.pow(0.98, dt * 60);
    this.vy *= Math.pow(0.98, dt * 60);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;
    this.angularVelocity *= Math.pow(0.95, dt * 60);
    this.ejectTimer += dt;
  }
}

// ---------------------------------------------------------------------------
// Asteroid
// ---------------------------------------------------------------------------
class Asteroid {
  constructor(x, y, vx, vy, size) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size || 'large';
    switch (this.size) {
      case 'large':  this.hp = 3; this.radius = 20; break;
      case 'medium': this.hp = 2; this.radius = 12; break;
      case 'small':  this.hp = 1; this.radius = 6;  break;
      default:       this.hp = 3; this.radius = 20;
    }
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // Returns array of child asteroids on split (or empty array)
  split() {
    const children = [];
    if (this.size === 'large') {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 40;
        children.push(new Asteroid(
          this.x, this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'medium'
        ));
      }
    } else if (this.size === 'medium') {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 50;
        children.push(new Asteroid(
          this.x, this.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'small'
        ));
      }
    }
    return children;
  }
}

// ---------------------------------------------------------------------------
// Bullet
// ---------------------------------------------------------------------------
class Bullet {
  constructor(x, y, vx, vy, fromEnemy) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 2;
    this.fromEnemy = fromEnemy || false;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------
class Enemy {
  constructor(x, y, targetX, targetY) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.targetX = targetX || 240;
    this.targetY = targetY || 135;
    this.hp = 2;
    this.radius = 10;
    this.state = 'entering'; // entering | attacking | retreating
    this.shootTimer = 0;
    this.shotsRemaining = 3;
    this.speed = 100;
    this.attackPauseTimer = 0;
    this.dead = false;
    this.bullets = []; // bullets fired by this enemy (managed in room)
    this.retreatX = x; // where to retreat to (off-screen edge)
    this.retreatY = y;
  }

  update(dt, shipX, shipY) {
    switch (this.state) {
      case 'entering': {
        // Fly toward targetX/targetY
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.vx = 0;
          this.vy = 0;
          this.state = 'attacking';
          this.attackPauseTimer = 0.4; // brief pause before shooting
          this.shotsRemaining = 3;
          this.shootTimer = 0;
        } else {
          const nx = dx / dist;
          const ny = dy / dist;
          this.x += nx * this.speed * dt;
          this.y += ny * this.speed * dt;
        }
        break;
      }
      case 'attacking': {
        this.attackPauseTimer -= dt;
        if (this.attackPauseTimer > 0) break;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.shotsRemaining > 0) {
          this.shootTimer = 0.35;
          this.shotsRemaining--;
          // Signal to spawn bullet — returned as event
          this._wantShoot = { shipX, shipY };
        }
        if (this.shotsRemaining <= 0 && this.shootTimer <= 0) {
          // Retreat off screen
          this.state = 'retreating';
          // Pick a retreat direction (back out the way we came roughly)
          const angle = Math.random() * Math.PI * 2;
          this.retreatVX = Math.cos(angle) * this.speed * 1.5;
          this.retreatVY = Math.sin(angle) * this.speed * 1.5;
        }
        break;
      }
      case 'retreating': {
        this.x += this.retreatVX * dt;
        this.y += this.retreatVY * dt;
        // Mark dead when well off screen
        if (this.x < -100 || this.x > 580 || this.y < -100 || this.y > 370) {
          this.dead = true;
        }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Powerup
// ---------------------------------------------------------------------------
class Powerup {
  constructor(x, y, type) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = (Math.random() - 0.5) * 40;
    this.radius = 8;
    this.type = type; // 'shield' | 'spread' | 'repair'
    this.dead = false;
    this.lifeTimer = 12; // disappears after 12s
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifeTimer -= dt;
    if (this.lifeTimer <= 0) this.dead = true;
    // Soft bounce off edges
    if (this.x < 0 || this.x > 480) this.vx *= -1;
    if (this.y < 0 || this.y > 270) this.vy *= -1;
    this.x = Math.max(0, Math.min(480, this.x));
    this.y = Math.max(0, Math.min(270, this.y));
  }
}

// ---------------------------------------------------------------------------
// MiniWhale
// ---------------------------------------------------------------------------
class MiniWhale {
  constructor(x, y, shipX, shipY) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = 3;
    this.radius = 15;
    this.speed = 60;
    this.dead = false;
  }

  update(dt, shipX, shipY) {
    // Weakly home toward ship
    const dx = shipX - this.x;
    const dy = shipY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    // Lerp velocity toward ship direction
    this.vx += nx * this.speed * dt * 2;
    this.vy += ny * this.speed * dt * 2;
    // Cap speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

// ---------------------------------------------------------------------------
// Whale
// ---------------------------------------------------------------------------
class Whale {
  constructor() {
    this.id = nextId();
    this.x = 600; // starts off-screen right
    this.y = 135;
    this.hp = 50;
    this.maxHp = 50;
    this.radius = 60;
    this.phase = 1;
    this.mouthOpen = false;
    this.mouthTimer = 0;
    this.mouthOpenDuration = 2;
    this.mouthClosedDuration = 3;
    this.sineOffset = 0;
    this.sineAmplitude = 60;
    this.sineSpeed = 0.8;
    this.sineBaseY = 135;
    this.entered = false;
    this.entrySpeed = 40;
    this.miniWhales = [];
    this.miniWhaleCooldown = 0;
    this.spitCooldown = 0;
    this.dead = false;
  }

  getPhase() {
    const pct = this.hp / this.maxHp;
    if (pct > 0.66) return 1;
    if (pct > 0.33) return 2;
    return 3;
  }

  update(dt, shipX, shipY) {
    // Entry
    if (!this.entered) {
      this.x -= this.entrySpeed * dt;
      if (this.x <= 380) {
        this.x = 380;
        this.entered = true;
      }
      return;
    }

    const newPhase = this.getPhase();
    if (newPhase !== this.phase) this.phase = newPhase;

    // Sine wave movement in phase 2+
    if (this.phase >= 2) {
      this.sineOffset += this.sineSpeed * dt;
      this.y = this.sineBaseY + Math.sin(this.sineOffset) * this.sineAmplitude;
    }

    // Mouth timer
    this.mouthTimer -= dt;
    if (this.mouthTimer <= 0) {
      this.mouthOpen = !this.mouthOpen;
      if (this.mouthOpen) {
        this.mouthTimer = this.phase === 3 ? 3 : this.mouthOpenDuration;
      } else {
        this.mouthTimer = this.mouthClosedDuration;
      }
    }

    // Spit asteroids from mouth (signal via _spitAsteroid)
    if (this.mouthOpen) {
      this.spitCooldown -= dt;
      if (this.spitCooldown <= 0 && this.phase === 1) {
        this.spitCooldown = 0.5;
        this._wantSpit = 1;
      }
    }

    // Mini-whale spawning in phase 2+
    if (this.phase >= 2) {
      this.miniWhaleCooldown -= dt;
      if (this.miniWhaleCooldown <= 0 && this.miniWhales.length < 4) {
        this.miniWhaleCooldown = 8;
        this._wantMiniWhale = true;
      }
    }

    // Update mini-whales
    for (const mw of this.miniWhales) {
      mw.update(dt, shipX, shipY);
    }
    this.miniWhales = this.miniWhales.filter(mw => !mw.dead);

    if (this.hp <= 0) this.dead = true;
  }
}

module.exports = { Ship, Asteroid, Bullet, Enemy, Powerup, Whale, MiniWhale, EVAPlayer, nextId };
