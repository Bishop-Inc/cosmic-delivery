'use strict';

const { Ship, Asteroid, Bullet, Enemy, Powerup, Whale, MiniWhale } = require('./entities');
const { getSectorConfig, GAME_W, GAME_H } = require('./sectors');
const { addHighscore } = require('./highscores');

// ---------------------------------------------------------------------------
// Nagatoro dialogue
// ---------------------------------------------------------------------------
const NAGATORO_LINES = {
  sector1: [
    "Oaoaooa~ Senpai, try not to crash us into rocks on the FIRST sector! {gunner}, keep an eye on this one~",
    "Ehehe~ sector one and {pilot} already looks nervous! {gunner}, you're the only competent one here, probably~",
    "{pilot}! Those are ASTEROIDS, baka~ They don't move out of your way! {gunner}, cover for this disaster please~",
    "The Belt~ Lots of rocks, zero excuses! {pilot} steers, {gunner} shoots. Even Senpai can manage that... maybe~",
    "Hmph! {pilot} acts so confident but watch them panic the second a rock gets close~ {gunner}, stay sharp okay?",
    "You know what's cute? Watching {pilot} pretend they know what they're doing~ {gunner}... I actually believe in you two."
  ],
  sector2: [
    "Oaoaooa~ PIRATES?! {pilot}, they shoot BACK, just so you know! Don't embarrass me in front of the enemy~",
    "Sector two and now we have REAL opponents~ {gunner}, show them what we've got! {pilot}, try not to fly INTO them~",
    "Ehehe~ {pilot}'s face right now~ It's okay Senpai, I'll protect you! ...just kidding, {gunner} will~",
    "Pirates spotted~ They drop loot when {gunner} blows them up. Emphasis on WHEN, not if. We believe in {gunner}~",
    "Hmph! {pilot} thinks evasive maneuvers are just wiggling around! {gunner}, please compensate for this~",
    "{pilot}, {gunner}... pirates are nothing. We've come so far together already. Don't mess it up now, baka~"
  ],
  sector3: [
    "Is that... a space WHALE?! Oaoaooa~ {pilot}, aim for the mouth when it opens! {gunner}, SHOOT THE MOUTH~",
    "THE WHALE! {pilot}, keep us alive! {gunner}, you're literally our only hope right now! No pressure, ehehe~",
    "It's huge... it's beautiful... it will absolutely end us~ {pilot}, {gunner}... this is what we trained for!",
    "Hmph! Her name is Margaret and she is FURIOUS~ Shoot the open mouth! GO! Don't just stare at it, baka~",
    "{pilot}! DODGE! {gunner}! SHOOT! THE MOUTH! WHEN IT'S OPEN! Oaoaooa~ WHY IS THIS SO HARD~",
    "She spawns babies too~ {gunner}, handle the babies. {pilot}, try not to crash into the babies. Or the mom. Or anything~"
  ],
  death: [
    "Senpai... you DIED?! Ahaha, that was so pathetic it's almost cute~ ...almost.",
    "Oaoaooa~ {pilot} flew us into THAT?! {gunner} was actually doing fine! Baka baka baka~",
    "Dead again~ {pilot}, that asteroid was literally just SITTING THERE. How... how did you hit it~",
    "Ehehe... I'm not even mad, I'm just... disappointed~ {pilot} and {gunner}, you were SO close too.",
    "Hmph! Most people get better with practice. {pilot} is a special case~ ...come on, let's try again.",
    "...hey. {pilot}. {gunner}. We'll get it next time, okay? I know we will. Don't give up on me~"
  ],
  victory: [
    "W-we actually did it?! I mean... of course we did! {pilot} and {gunner} aren't COMPLETELY useless~ ...that was really fun though.",
    "VICTORY! Oaoaooa~ The whale is GONE! {pilot}, that was almost impressive! {gunner}, you were amazing~",
    "WE SURVIVED THE WHALE! {pilot}, that was flying! {gunner}, that was shooting! Together... you're actually kind of great~",
    "Delivery complete! Ehehe~ {pilot} and {gunner} beat a space whale! I knew you could do it. Don't tell anyone I said that~",
    "Hmph! We won! WE WON! {pilot} only crashed us twice, {gunner} carried, and I... supervised perfectly~ as always.",
    "{pilot}... {gunner}... I'm really glad we did this together. Genuinely. Don't make it weird~ ehehe."
  ],
  powerupWasted: [
    "You had ONE job, Senpai! ONE! Ehehe, your face right now~",
    "{gunner} is holding a powerup and just... not using it~ Baka, what are you WAITING for~",
    "Spread shot! {gunner} aimed at nothing with FIVE BULLETS! That takes a special kind of talent~",
    "The powerup is just floating there~ Are you two allergic to winning or something? Oaoaooa~"
  ]
};

function getLine(category, pilot, gunner) {
  const lines = NAGATORO_LINES[category];
  if (!lines) return '';
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line
    .replace(/{pilot}/g, pilot || 'Pilot')
    .replace(/{gunner}/g, gunner || 'Gunner');
}

// ---------------------------------------------------------------------------
// Room code generator
// ---------------------------------------------------------------------------
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Circle-circle collision
// ---------------------------------------------------------------------------
function circlesCollide(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return (dx * dx + dy * dy) < (ar + br) * (ar + br);
}

// ---------------------------------------------------------------------------
// Room class
// ---------------------------------------------------------------------------
class Room {
  constructor(io) {
    this.io = io;
    this.roomCode = generateRoomCode();
    this.players = []; // max 2: { id, socketId, name, role: 'pilot'|'gunner' }
    this.nextPlayerId = 1;

    // Game state
    this.ship = new Ship();
    this.asteroids = [];
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.whale = null;

    this.score = 0;
    this.sector = 1;
    this.sectorTimer = 60;
    this.lives = 1;
    this.captainMessage = '';
    this.captainMessageTimer = 0;
    this.gamePhase = 'lobby'; // lobby | playing | sectorTransition | death | victory

    // Input state
    this.pilotInput = { up: false, down: false, left: false, right: false };
    this.gunnerInput = { aimX: 0.5, aimY: 0.5, shooting: false, holdingRepair: false };

    // Timers
    this.bulletCooldown = 0;
    this.asteroidSpawnTimer = 0;
    this.enemySpawnTimer = 0;
    this.transitionTimer = 0;
    this.disconnectHoldTimer = 0;
    this.whalePhaseEnemyTimer = 0;

    // Sector config
    this.sectorConfig = getSectorConfig(1, 1.0);
    this.sectorElapsed = 0;
    this.difficulty = 1.0;
    this.loopCount = 0;

    // Loop
    this.loop = null;
    this.lastTick = 0;
  }

  // -------------------------------------------------------------------------
  // Player management
  // -------------------------------------------------------------------------
  addPlayer(socketId, name) {
    if (this.players.length >= 2) return null;
    const role = this.players.length === 0 ? 'pilot' : 'gunner';
    const player = {
      id: this.nextPlayerId++,
      socketId,
      name: name || 'Cadet',
      role
    };
    this.players.push(player);
    return player;
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return null;
    const [removed] = this.players.splice(idx, 1);
    if (this.gamePhase === 'playing') {
      // Pause for 60s to allow rejoin
      this.gamePhase = 'paused';
      this.disconnectHoldTimer = 60;
    }
    return removed;
  }

  rejoinPlayer(socketId, name, role) {
    // Re-attach socket to an existing slot
    const existing = this.players.find(p => p.role === role);
    if (existing) {
      existing.socketId = socketId;
      if (name) existing.name = name;
    } else {
      this.players.push({ id: this.nextPlayerId++, socketId, name: name || 'Cadet', role });
    }
    if (this.gamePhase === 'paused' && this.players.length === 2) {
      this.gamePhase = 'playing';
    }
    return this.players.find(p => p.socketId === socketId);
  }

  getPilotName() {
    const p = this.players.find(pl => pl.role === 'pilot');
    return p ? p.name : 'Pilot';
  }

  getGunnerName() {
    const p = this.players.find(pl => pl.role === 'gunner');
    return p ? p.name : 'Gunner';
  }

  // -------------------------------------------------------------------------
  // Game lifecycle
  // -------------------------------------------------------------------------
  startGame() {
    if (this.gamePhase !== 'lobby') return;
    this.resetGame();
    this.gamePhase = 'playing';
    this.sector = 1;
    this.sectorConfig = getSectorConfig(1, this.difficulty);
    this.sectorTimer = this.sectorConfig.duration;
    this.setCaptainMessage(getLine('sector1', this.getPilotName(), this.getGunnerName()), 6);
    this.start();
  }

  resetGame() {
    this.ship.reset();
    this.asteroids = [];
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.whale = null;
    this.score = 0;
    this.lives = 1;
    this.pilotInput = { up: false, down: false, left: false, right: false };
    this.gunnerInput = { aimX: 0.5, aimY: 0.5, shooting: false, holdingRepair: false };
    this.bulletCooldown = 0;
    this.asteroidSpawnTimer = 0;
    this.enemySpawnTimer = 0;
    this.sectorElapsed = 0;
    this.whalePhaseEnemyTimer = 0;
  }

  restartGame() {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
    this.gamePhase = 'lobby';
    this.difficulty = 1.0;
    this.loopCount = 0;
    this.resetGame();
    this.sector = 1;
    this.broadcast();
    // Auto-start if 2 players
    if (this.players.length === 2) {
      this.startGame();
    }
  }

  // -------------------------------------------------------------------------
  // Game loop
  // -------------------------------------------------------------------------
  start() {
    if (this.loop) clearInterval(this.loop);
    this.lastTick = Date.now();
    this.loop = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;
      this.update(dt);
      this.broadcast();
    }, 1000 / 30);
  }

  stop() {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(dt) {
    // Captain message timer
    if (this.captainMessageTimer > 0) {
      this.captainMessageTimer -= dt;
      if (this.captainMessageTimer <= 0) {
        this.captainMessage = '';
      }
    }

    switch (this.gamePhase) {
      case 'playing':   this.updatePlaying(dt); break;
      case 'paused':    this.updatePaused(dt);   break;
      case 'sectorTransition': this.updateTransition(dt); break;
      case 'death':     this.updateDeath(dt);    break;
      case 'victory':   this.updateVictory(dt);  break;
    }
  }

  updatePaused(dt) {
    this.disconnectHoldTimer -= dt;
    if (this.disconnectHoldTimer <= 0) {
      this.gamePhase = 'death';
      this.setCaptainMessage(getLine('death', this.getPilotName(), this.getGunnerName()), 6);
    }
  }

  updateDeath(dt) {
    // Wait for restart
  }

  updateVictory(dt) {
    // Wait for restart or loop
  }

  updateTransition(dt) {
    this.transitionTimer -= dt;
    if (this.transitionTimer <= 0) {
      this.startSector(this.sector);
    }
  }

  updatePlaying(dt) {
    this.sectorTimer -= dt;
    this.sectorElapsed += dt;

    // Move ship
    this.updateShip(dt);

    // Shooting
    this.updateShooting(dt);

    // Spawn entities
    this.updateSpawns(dt);

    // Update all entities
    this.updateEntities(dt);

    // Collisions
    this.updateCollisions();

    // Check whale death from collision damage
    if (this.whale && this.whale.hp <= 0) {
      this.whale.dead = true;
      this.score += 500;
      this.triggerVictory();
      return;
    }

    // Cleanup dead entities
    this.cleanup();

    // Check sector end
    this.checkSectorEnd();
  }

  // -------------------------------------------------------------------------
  // Ship movement
  // -------------------------------------------------------------------------
  updateShip(dt) {
    const ACCEL = 800;
    const FRICTION = 0.92;
    const MAX_SPEED = 300;

    const { up, down, left, right } = this.pilotInput;
    if (up)    this.ship.vy -= ACCEL * dt;
    if (down)  this.ship.vy += ACCEL * dt;
    if (left)  this.ship.vx -= ACCEL * dt;
    if (right) this.ship.vx += ACCEL * dt;

    // Friction
    this.ship.vx *= Math.pow(FRICTION, dt * 60);
    this.ship.vy *= Math.pow(FRICTION, dt * 60);

    // Cap speed
    const spd = Math.sqrt(this.ship.vx * this.ship.vx + this.ship.vy * this.ship.vy);
    if (spd > MAX_SPEED) {
      this.ship.vx = (this.ship.vx / spd) * MAX_SPEED;
      this.ship.vy = (this.ship.vy / spd) * MAX_SPEED;
    }

    // Move
    this.ship.x += this.ship.vx * dt;
    this.ship.y += this.ship.vy * dt;

    // Clamp to bounds
    this.ship.x = Math.max(this.ship.radius, Math.min(GAME_W - this.ship.radius, this.ship.x));
    this.ship.y = Math.max(this.ship.radius, Math.min(GAME_H - this.ship.radius, this.ship.y));

    this.ship.update(dt);
  }

  // -------------------------------------------------------------------------
  // Shooting
  // -------------------------------------------------------------------------
  updateShooting(dt) {
    this.bulletCooldown -= dt;
    if (!this.gunnerInput.shooting || this.bulletCooldown > 0) return;

    const BULLET_SPEED = 400;
    const aimX = this.gunnerInput.aimX * GAME_W;
    const aimY = this.gunnerInput.aimY * GAME_H;
    const dx = aimX - this.ship.x;
    const dy = aimY - this.ship.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (this.ship.hasSpreadShot > 0) {
      // 5 bullets in a spread
      const angles = [-0.35, -0.175, 0, 0.175, 0.35];
      for (const a of angles) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const rvx = nx * cos - ny * sin;
        const rvy = nx * sin + ny * cos;
        this.bullets.push(new Bullet(this.ship.x, this.ship.y, rvx * BULLET_SPEED, rvy * BULLET_SPEED, false));
      }
      this.ship.hasSpreadShot--;
    } else {
      this.bullets.push(new Bullet(this.ship.x, this.ship.y, nx * BULLET_SPEED, ny * BULLET_SPEED, false));
    }
    this.bulletCooldown = 0.15;
  }

  // -------------------------------------------------------------------------
  // Spawning
  // -------------------------------------------------------------------------
  updateSpawns(dt) {
    const cfg = this.sectorConfig;

    // Asteroid spawning
    if (cfg.asteroid) {
      this.asteroidSpawnTimer -= dt;
      const interval = cfg.asteroid.getRateInterval(this.sectorElapsed, cfg.duration);
      if (this.asteroidSpawnTimer <= 0) {
        this.asteroidSpawnTimer = interval;
        if (this.asteroids.length < 30) {
          const p = cfg.asteroid.getSpawnParams();
          this.asteroids.push(new Asteroid(p.x, p.y, p.vx, p.vy, p.size));
        }
      }
    }

    // Enemy spawning
    if (cfg.spawnEnemies && cfg.enemy) {
      this.enemySpawnTimer -= dt;
      if (this.enemySpawnTimer <= 0) {
        this.enemySpawnTimer = cfg.enemy.getRateInterval();
        const activeEnemies = this.enemies.filter(e => !e.dead).length;
        if (activeEnemies < cfg.enemy.maxOnScreen) {
          const p = cfg.enemy.getSpawnParams();
          this.enemies.push(new Enemy(p.x, p.y, p.targetX, p.targetY));
        }
      }
    }

    // Whale sector: sector 3 enemy spawns from whale mouth in phase 3
    if (this.sector === 3 && this.whale && this.whale.entered) {
      if (this.whale.phase === 3 && this.whale.mouthOpen) {
        this.whalePhaseEnemyTimer -= dt;
        if (this.whalePhaseEnemyTimer <= 0) {
          this.whalePhaseEnemyTimer = 2.5;
          const activeEnemies = this.enemies.filter(e => !e.dead).length;
          if (activeEnemies < 5) {
            // Spawn from whale mouth position (left side of whale)
            const mx = this.whale.x - this.whale.radius;
            const my = this.whale.y;
            const targetX = 100 + Math.random() * 280;
            const targetY = 40 + Math.random() * 190;
            this.enemies.push(new Enemy(mx, my, targetX, targetY));
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Entity updates
  // -------------------------------------------------------------------------
  updateEntities(dt) {
    for (const a of this.asteroids) a.update(dt);
    for (const b of this.bullets) b.update(dt);

    // Enemies update + collect their bullet shots
    for (const e of this.enemies) {
      e._wantShoot = null;
      e.update(dt, this.ship.x, this.ship.y);
      if (e._wantShoot) {
        const { shipX, shipY } = e._wantShoot;
        const dx = shipX - e.x;
        const dy = shipY - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const spd = 220;
        this.bullets.push(new Bullet(e.x, e.y, (dx / dist) * spd, (dy / dist) * spd, true));
      }
    }

    // Whale update
    if (this.whale) {
      this.whale._wantSpit = 0;
      this.whale._wantMiniWhale = false;
      this.whale.update(dt, this.ship.x, this.ship.y);

      // Handle spit
      if (this.whale._wantSpit > 0) {
        for (let i = 0; i < 5; i++) {
          const angle = Math.PI + (Math.random() - 0.5) * 1.0; // spit leftward
          const speed = 60 + Math.random() * 40;
          this.asteroids.push(new Asteroid(
            this.whale.x - this.whale.radius,
            this.whale.y + (Math.random() - 0.5) * 30,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            'small'
          ));
        }
      }

      // Handle mini-whale spawn
      if (this.whale._wantMiniWhale) {
        this.whale.miniWhales.push(new MiniWhale(
          this.whale.x - this.whale.radius,
          this.whale.y + (Math.random() - 0.5) * 40,
          this.ship.x,
          this.ship.y
        ));
      }

      if (this.whale.dead) {
        this.score += 500;
        this.triggerVictory();
        return;
      }
    }

    // Powerups
    for (const p of this.powerups) p.update(dt);

    // Repair check
    if (this.gunnerInput.holdingRepair && this.ship.hasShield) {
      // Repair is contextual — just refreshes shield timer slightly
      // (already handled via powerup collection)
    }
  }

  // -------------------------------------------------------------------------
  // Collisions
  // -------------------------------------------------------------------------
  updateCollisions() {
    const ship = this.ship;

    // Player bullets vs asteroids
    for (const b of this.bullets) {
      if (b.dead || b.fromEnemy) continue;
      for (const a of this.asteroids) {
        if (a.dead) continue;
        if (circlesCollide(b.x, b.y, b.radius, a.x, a.y, a.radius)) {
          b.dead = true;
          a.hp--;
          if (a.hp <= 0) {
            a.dead = true;
            this.score += a.size === 'large' ? 30 : a.size === 'medium' ? 15 : 5;
            const children = a.split();
            for (const c of children) this.asteroids.push(c);
          }
          break;
        }
      }
    }

    // Player bullets vs enemies
    for (const b of this.bullets) {
      if (b.dead || b.fromEnemy) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (circlesCollide(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          b.dead = true;
          e.hp--;
          if (e.hp <= 0) {
            e.dead = true;
            this.score += 100;
            const cfg = this.sectorConfig;
            const dropChance = (cfg.enemy && cfg.enemy.powerupDropChance) || 0;
            if (Math.random() < dropChance) {
              const types = ['shield', 'spread', 'repair'];
              const type = types[Math.floor(Math.random() * types.length)];
              this.powerups.push(new Powerup(e.x, e.y, type));
            }
          }
          break;
        }
      }
    }

    // Player bullets vs whale
    if (this.whale && !this.whale.dead) {
      for (const b of this.bullets) {
        if (b.dead || b.fromEnemy) continue;
        if (!this.whale.mouthOpen) continue;
        if (circlesCollide(b.x, b.y, b.radius, this.whale.x, this.whale.y, this.whale.radius)) {
          b.dead = true;
          this.whale.hp--;
          this.score += 10;
          if (this.whale.hp <= 0) {
            this.whale.dead = true;
          }
        }
      }
      // Player bullets vs mini-whales
      for (const mw of this.whale.miniWhales) {
        if (mw.dead) continue;
        for (const b of this.bullets) {
          if (b.dead || b.fromEnemy) continue;
          if (circlesCollide(b.x, b.y, b.radius, mw.x, mw.y, mw.radius)) {
            b.dead = true;
            mw.hp--;
            if (mw.hp <= 0) {
              mw.dead = true;
              this.score += 50;
            }
          }
        }
      }
    }

    // Ship vs asteroids
    if (!ship.hasShield) {
      for (const a of this.asteroids) {
        if (a.dead) continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, a.x, a.y, a.radius)) {
          this.killShip();
          return;
        }
      }
    }

    // Ship vs enemies
    if (!ship.hasShield) {
      for (const e of this.enemies) {
        if (e.dead || e.state !== 'attacking') continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, e.x, e.y, e.radius)) {
          this.killShip();
          return;
        }
      }
    }

    // Ship vs enemy bullets
    if (!ship.hasShield) {
      for (const b of this.bullets) {
        if (b.dead || !b.fromEnemy) continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, b.x, b.y, b.radius)) {
          this.killShip();
          return;
        }
      }
    }

    // Ship vs mini-whales
    if (!ship.hasShield && this.whale) {
      for (const mw of this.whale.miniWhales) {
        if (mw.dead) continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, mw.x, mw.y, mw.radius)) {
          this.killShip();
          return;
        }
      }
    }

    // Ship vs powerups
    for (const p of this.powerups) {
      if (p.dead) continue;
      if (circlesCollide(ship.x, ship.y, ship.radius, p.x, p.y, p.radius)) {
        p.dead = true;
        this.collectPowerup(p.type);
      }
    }
  }

  collectPowerup(type) {
    switch (type) {
      case 'shield':
        this.ship.hasShield = true;
        this.ship.shieldTimer = 8;
        this.emitEvent('powerup', 'Shield activated! You have 8 seconds of invincibility!');
        break;
      case 'spread':
        this.ship.hasSpreadShot += 10;
        this.emitEvent('powerup', 'Spread shot! 10 bursts of 5 bullets!');
        break;
      case 'repair':
        // Repair restores shield briefly or grants a bonus shield
        if (!this.ship.hasShield) {
          this.ship.hasShield = true;
          this.ship.shieldTimer = 5;
          this.emitEvent('powerup', 'Emergency repair! 5-second shield!');
        } else {
          this.ship.shieldTimer += 5;
          this.emitEvent('powerup', 'Repair kit extends shield by 5 seconds!');
        }
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  cleanup() {
    // Remove off-screen asteroids
    this.asteroids = this.asteroids.filter(a => {
      if (a.dead) return false;
      if (a.x < -60 || a.x > GAME_W + 60 || a.y < -60 || a.y > GAME_H + 60) return false;
      return true;
    });

    this.enemies = this.enemies.filter(e => !e.dead);

    this.bullets = this.bullets.filter(b => {
      if (b.dead) return false;
      if (b.x < -20 || b.x > GAME_W + 20 || b.y < -20 || b.y > GAME_H + 20) return false;
      return true;
    });

    this.powerups = this.powerups.filter(p => !p.dead);
  }

  // -------------------------------------------------------------------------
  // Sector transitions
  // -------------------------------------------------------------------------
  checkSectorEnd() {
    if (this.sector < 3 && this.sectorTimer <= 0) {
      this.beginSectorTransition();
    }
    // Sector 3 ends when whale dies (handled in entity update)
  }

  beginSectorTransition() {
    this.gamePhase = 'sectorTransition';
    this.transitionTimer = 4;
    this.sector++;
    this.swapRoles();
    const pilotName = this.getPilotName();
    const gunnerName = this.getGunnerName();
    let msg;
    if (this.sector === 2) {
      msg = getLine('sector2', pilotName, gunnerName);
    } else if (this.sector === 3) {
      msg = getLine('sector3', pilotName, gunnerName);
    } else {
      msg = `Entering sector ${this.sector}!`;
    }
    this.setCaptainMessage(msg, 6);
    this.emitEvent('sectorTransition', `Sector ${this.sector} — roles swapped! ${pilotName} is now ${this.players.find(p => p.name === pilotName)?.role}!`);
  }

  startSector(sector) {
    this.sectorConfig = getSectorConfig(sector, this.difficulty);
    this.sectorTimer = this.sectorConfig.duration;
    this.sectorElapsed = 0;
    this.asteroidSpawnTimer = 0;
    this.enemySpawnTimer = 0;

    // Clear entities for clean sector start
    this.asteroids = [];
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];

    if (sector === 3) {
      this.whale = new Whale();
      this.whalePhaseEnemyTimer = 5;
    }

    this.gamePhase = 'playing';
  }

  swapRoles() {
    for (const p of this.players) {
      p.role = p.role === 'pilot' ? 'gunner' : 'pilot';
    }
  }

  // -------------------------------------------------------------------------
  // Death / Victory
  // -------------------------------------------------------------------------
  killShip() {
    if (this.ship.hasShield) return;
    this.lives = 0;
    this.gamePhase = 'death';
    this.setCaptainMessage(getLine('death', this.getPilotName(), this.getGunnerName()), 8);
    this.emitEvent('death', 'Ship destroyed!');
  }

  triggerVictory() {
    if (this.gamePhase === 'victory') return; // prevent double-trigger
    this.gamePhase = 'victory';
    this.setCaptainMessage(getLine('victory', this.getPilotName(), this.getGunnerName()), 10);
    this.emitEvent('victory', `Victory! Final score: ${this.score}`);

    // Save highscore
    const names = this.players.map(p => p.name).join(' & ');
    addHighscore({
      roomName: names || this.roomCode,
      score: this.score,
      deliveries: 1,
      date: new Date().toISOString()
    });

    // Loop back after 8s with increased difficulty
    setTimeout(() => {
      if (this.gamePhase === 'victory') {
        this.loopCount++;
        this.difficulty = 1 + this.loopCount * 0.2;
        this.resetGame();
        this.sector = 1;
        this.sectorConfig = getSectorConfig(1, this.difficulty);
        this.sectorTimer = this.sectorConfig.duration;
        this.sectorElapsed = 0;
        this.gamePhase = 'playing';
        this.setCaptainMessage(`Loop ${this.loopCount + 1}! Difficulty +20%. Good luck.`, 5);
      }
    }, 8000);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  setCaptainMessage(msg, duration) {
    this.captainMessage = msg;
    this.captainMessageTimer = duration || 5;
  }

  emitEvent(type, message) {
    this.io.to(this.roomCode).emit('game:event', { type, message });
  }

  getRoles() {
    const roles = {};
    for (const p of this.players) {
      roles[p.role] = p.name;
    }
    return roles;
  }

  // -------------------------------------------------------------------------
  // Broadcast
  // -------------------------------------------------------------------------
  broadcast() {
    const state = {
      ship: {
        x: this.ship.x,
        y: this.ship.y,
        vx: this.ship.vx,
        vy: this.ship.vy,
        hasShield: this.ship.hasShield,
        hasSpreadShot: this.ship.hasSpreadShot
      },
      asteroids: this.asteroids.map(a => ({
        id: a.id, x: a.x, y: a.y, vx: a.vx, vy: a.vy,
        size: a.size, hp: a.hp, radius: a.radius
      })),
      enemies: this.enemies.map(e => ({
        id: e.id, x: e.x, y: e.y, hp: e.hp, radius: e.radius, state: e.state
      })),
      bullets: this.bullets.map(b => ({
        id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
        radius: b.radius, fromEnemy: b.fromEnemy
      })),
      powerups: this.powerups.map(p => ({
        id: p.id, x: p.x, y: p.y, type: p.type, radius: p.radius
      })),
      whale: this.whale && !this.whale.dead ? {
        x: this.whale.x,
        y: this.whale.y,
        hp: this.whale.hp,
        maxHp: this.whale.maxHp,
        mouthOpen: this.whale.mouthOpen,
        phase: this.whale.phase,
        radius: this.whale.radius,
        miniWhales: this.whale.miniWhales.map(mw => ({
          id: mw.id, x: mw.x, y: mw.y, hp: mw.hp, radius: mw.radius
        }))
      } : null,
      score: this.score,
      sector: this.sector,
      sectorTimer: Math.max(0, Math.round(this.sectorTimer)),
      captainMessage: this.captainMessage,
      lives: this.lives,
      gamePhase: this.gamePhase,
      roles: this.getRoles(),
      difficulty: this.difficulty
    };

    this.io.to(this.roomCode).emit('state:snapshot', state);
  }
}

module.exports = { Room, generateRoomCode };
