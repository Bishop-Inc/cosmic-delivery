'use strict';

const { Ship, Asteroid, Bullet, Enemy, Powerup, Whale, MiniWhale, EVAPlayer } = require('./entities');
const { getSectorConfig, GAME_W, GAME_H } = require('./sectors');
const { addHighscore } = require('./highscores');

// ---------------------------------------------------------------------------
// Nagatoro dialogue
// ---------------------------------------------------------------------------
const NAGATORO_LINES = {
  sector1: [
    "the belt~ rocks, zero excuses lol. {pilot} steers, {gunner} shoots. tipo even senpai can do that ?",
    "oki oki sector 1~ {pilot} alrd nervous. {gunner} pls cover for this disaster~",
    "oaoaooa {pilot} those r ASTEROIDS, baka~ they don't move. {gunner} stay sharp",
    "ehehe~ {pilot} acts confident but watch them panic in 3 seconds lol",
    "aga aga {gunner}... i actually believe in u two. dont make it weird~",
    "lil belt, lil rocks~ tipo just don't crash {pilot}~"
  ],
  sector2: [
    "oaoaooa PIRATES~ {pilot} they shoot BACK okay ? don't embarrass me",
    "sector 2~ real opponents tdy. {gunner} show them. {pilot} dont fly INTO them",
    "ehehe~ {pilot} face right now. tipo {gunner} please carry~",
    "pirates drop loot when {gunner} blows them up. WHEN not if. aga ?",
    "boje moi {pilot} thinks dodging is wiggling~ {gunner} compensate pls",
    "{pilot} {gunner}~ pirates r nothing. we came so far tgthr. dont mess it up"
  ],
  sector3: [
    "is that... a space WHALE ? oaoaooa~ {gunner} SHOOT THE MOUTH",
    "THE WHALE. {pilot} keep us alive. {gunner} ur our only hope, no pressure ehehe~",
    "she's huge. she's beautiful. she will end us~ {pilot} {gunner} this is it",
    "her name is margaret and she is FURIOUS~ shoot the open mouth GO. dont stare baka",
    "{pilot} DODGE. {gunner} SHOOT. THE MOUTH. WHEN OPEN. blin why is this hard~",
    "she spawns babies too~ {gunner} babies. {pilot} dont crash into babies. or mom. or anything"
  ],
  death: [
    "senpai... u DIED ? ahaha pathetic, almost cute~ ...almost",
    "oaoaooa~ {pilot} flew us into THAT. {gunner} was alrd doing fine. baka baka baka~",
    "dead again~ {pilot} that asteroid was just SITTING there. kak tak~",
    "ehehe... ne ochenskii. {pilot} {gunner} u were SO close tbh~",
    "hmph. most ppl get better with practice. {pilot} is special~ ...kel, eshe raz",
    "...{pilot}. {gunner}. eshe raz ? we'll get it. ya znayu. dont give up on me~"
  ],
  victory: [
    "we actually did it ? i mean of course we did~ {pilot} {gunner} not COMPLETELY useless lol",
    "VICTORY oaoaooa~ whale GONE. {pilot} almost impressive. {gunner} ty molodets~",
    "WE SURVIVED. {pilot} that was flying. {gunner} that was shooting. tgthr u r kinda great~",
    "delivery complete~ ehehe {pilot} {gunner} beat a whale. ya znala u could~ dont tell anyone",
    "WE WON. {pilot} only crashed twice~ {gunner} carried. i supervised perfectly~",
    "{pilot}... {gunner}... rakhmat. genuinely. dont make it weird~ ehehe"
  ],
  powerupWasted: [
    "ONE job senpai. ONE. ehehe ur face rn~",
    "{gunner} holding a powerup and just... not using it. baka, what r u WAITING for~",
    "spread shot~ {gunner} aimed at NOTHING with 5 bullets. tipo a special talent",
    "powerup just floating there~ allergic to winning ? oaoaooa~"
  ],
  eject: [
    "{pilot}!! oaoaooa u FLEW out the WINDOW~ {gunner} go go go",
    "senpaaaai literally floating away~ {gunner} ur moment, save ur dummy",
    "ehehe~ {pilot} got YEETED by a rock. {gunner} blin FLY",
    "hmph. NOT writing the apology letter to {pilot}'s mom. {gunner} hurry~"
  ],
  drifting: [
    "{pilot} doing lil tumbles in space~ tipo kinda cute ehehe",
    "oaoaooa senpai just hold still~ {gunner} kel kel kel",
    "{pilot} making 'help me' face thru the visor~ adorable lol",
    "{pilot} flailing in zero-g~ funniest thing tbh"
  ],
  distress: [
    "boje moi {gunner} HURRY~ {pilot} drifting blin. ya tebe govoryu HURRY",
    "{gunner} STOP being cool and SAVE THEM~ oaoaooa",
    "{pilot} getting really small on screen~ THAT'S BAD. go go go",
    "oaoaooa i can't watch~ {gunner} please please please"
  ],
  rescue: [
    "senpai's back~ dont... dont do that again, baka",
    "oaoaooa~ {gunner} ty molodets~ {pilot} say ty ty, properly",
    "crew recovered ehehe~ {pilot} owes {gunner} dinner. taking notes~",
    "hmph i knew u'd save them~ ...oki mb i was a LIL worried"
  ],
  lostCrew: [
    "...{pilot} ? ...gde ty ? ...vse. blin. ne znayu what to say~",
    "{pilot} is GONE~ just... gone. {gunner}... mne tak jal'~",
    "we lost crew~ the void took {pilot}. ehehe... not funny is it",
    "{gunner}... we tried. we really did~ ...eshe raz. tgthr"
  ],
  boardingClose: [
    "lil closer~ dont BUMP them, baka",
    "almost there~ steady... steady... oaoaooa",
    "slow down {gunner}~ gonna squish {pilot} ehehe~"
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
    this.pilotEVA = null;
    this.gunnerEVA = null;

    this.score = 0;
    this.sector = 1;
    this.sectorTimer = 60;
    this.lives = 1;
    this.captainMessage = '';
    this.captainMessageTimer = 0;
    this.gamePhase = 'lobby'; // lobby | playing | sectorTransition | death | victory

    // Input state — unified payload from each client. Server picks fields based on EVA state.
    this.pilotInput  = { up: false, down: false, left: false, right: false,
                         aimX: 0.5, aimY: 0.5, shooting: false, holdingRepair: false, ejectKey: false };
    this.gunnerInput = { up: false, down: false, left: false, right: false,
                         aimX: 0.5, aimY: 0.5, shooting: false, holdingRepair: false, ejectKey: false };
    this.prevPilotEjectKey = false;
    this.prevGunnerEjectKey = false;
    this.boardingDialogueCooldown = 0;

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
    this.pilotEVA = null;
    this.gunnerEVA = null;
    this.score = 0;
    this.lives = 1;
    this.pilotInput  = { up: false, down: false, left: false, right: false,
                         aimX: 0.5, aimY: 0.5, shooting: false, holdingRepair: false, ejectKey: false };
    this.gunnerInput = { up: false, down: false, left: false, right: false,
                         aimX: 0.5, aimY: 0.5, shooting: false, holdingRepair: false, ejectKey: false };
    this.prevPilotEjectKey = false;
    this.prevGunnerEjectKey = false;
    this.boardingDialogueCooldown = 0;
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

    // Voluntary eject (rising-edge on E key per role)
    this.handleVoluntaryEject();

    // Move ship
    this.updateShip(dt);

    // EVA bodies (jetpack thrust + drift checks + reboard)
    this.updateEVA(dt);

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

    // Pilot drives normally. If pilot is EVA, gunner falls in. If both EVA, ship drifts.
    const wasdSource =
      !this.pilotEVA  ? this.pilotInput  :
      !this.gunnerEVA ? this.gunnerInput : null;

    if (wasdSource) {
      if (wasdSource.up)    this.ship.vy -= ACCEL * dt;
      if (wasdSource.down)  this.ship.vy += ACCEL * dt;
      if (wasdSource.left)  this.ship.vx -= ACCEL * dt;
      if (wasdSource.right) this.ship.vx += ACCEL * dt;
    }

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

    // Ship orients like a car — nose follows velocity vector. Bullets still
    // fire toward the gunner's mouse independently, so aim stays decoupled.
    // Holds last rotation when stationary so it doesn't snap to center.
    let targetRot = this.ship.rotation;
    const shipSpd = Math.hypot(this.ship.vx, this.ship.vy);
    if (shipSpd > 25) targetRot = Math.atan2(this.ship.vy, this.ship.vx);
    let diff = targetRot - this.ship.rotation;
    while (diff > Math.PI)  diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const ROT_SPEED = 12; // rad/s — smooth car-like turn
    const maxStep = ROT_SPEED * dt;
    this.ship.rotation += Math.max(-maxStep, Math.min(maxStep, diff));

    this.ship.update(dt);
  }

  // -------------------------------------------------------------------------
  // Shooting
  // -------------------------------------------------------------------------
  updateShooting(dt) {
    this.bulletCooldown -= dt;

    // Gunner shoots normally. If gunner is EVA, pilot falls in. If both EVA, no shooting.
    const mouseSource =
      !this.gunnerEVA ? this.gunnerInput :
      !this.pilotEVA  ? this.pilotInput  : null;

    if (!mouseSource || !mouseSource.shooting || this.bulletCooldown > 0) return;

    const BULLET_SPEED = 400;
    const aimX = mouseSource.aimX * GAME_W;
    const aimY = mouseSource.aimY * GAME_H;
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
  // EVA — voluntary eject, jetpack, drift checks, auto-reboard
  // -------------------------------------------------------------------------
  handleVoluntaryEject() {
    // Voluntary eject only allowed in sectors 1-2 (sector 3 keeps lethal stakes
    // around the whale fight — but we still allow it because the user picked
    // "voluntary E still allowed" for sector 3). Re-evaluating: spec says
    // "voluntary E still allowed" in sector 3, so we permit it everywhere.
    const pilotEdge  = this.pilotInput.ejectKey  && !this.prevPilotEjectKey;
    const gunnerEdge = this.gunnerInput.ejectKey && !this.prevGunnerEjectKey;
    if (pilotEdge && !this.pilotEVA) {
      // Eject straight up-ish from the ship
      this.ejectShip('pilot', this.ship.x, this.ship.y + 12, 0, 0);
    }
    if (gunnerEdge && !this.gunnerEVA) {
      this.ejectShip('gunner', this.ship.x, this.ship.y - 12, 0, 0);
    }
    this.prevPilotEjectKey  = this.pilotInput.ejectKey;
    this.prevGunnerEjectKey = this.gunnerInput.ejectKey;
  }

  updateEVA(dt) {
    if (this.boardingDialogueCooldown > 0) this.boardingDialogueCooldown -= dt;

    const evas = [];
    if (this.pilotEVA)  evas.push(this.pilotEVA);
    if (this.gunnerEVA) evas.push(this.gunnerEVA);

    for (const eva of evas) {
      const input = eva.role === 'pilot' ? this.pilotInput : this.gunnerInput;
      const ACCEL = 200;
      if (input.up)    eva.vy -= ACCEL * dt;
      if (input.down)  eva.vy += ACCEL * dt;
      if (input.left)  eva.vx -= ACCEL * dt;
      if (input.right) eva.vx += ACCEL * dt;

      // Higher cap so the eject "fly-away" reads as dramatic; jetpack itself can't
      // exceed 140 of its own thrust because ACCEL=200 gets bled by friction.
      const SPD_MAX = 240;
      const spd = Math.hypot(eva.vx, eva.vy);
      if (spd > SPD_MAX) {
        eva.vx = (eva.vx / spd) * SPD_MAX;
        eva.vy = (eva.vy / spd) * SPD_MAX;
      }

      eva.update(dt);

      // Off-screen = lost crew
      if (eva.x < -30 || eva.x > GAME_W + 30 || eva.y < -30 || eva.y > GAME_H + 30) {
        return this.loseEVA(eva.role, 'drift');
      }

      // Throttled drift / distress dialogue
      if (!eva.driftingFired && eva.ejectTimer > 3) {
        eva.driftingFired = true;
        this.setCaptainMessage(getLine('drifting', this.getPilotName(), this.getGunnerName()), 4);
      }
      if (!eva.distressFired && eva.ejectTimer > 8) {
        eva.distressFired = true;
        this.setCaptainMessage(getLine('distress', this.getPilotName(), this.getGunnerName()), 4);
      }

      // Auto re-board
      if (eva.ejectTimer > 0.5) {
        const dist = Math.hypot(this.ship.x - eva.x, this.ship.y - eva.y);
        const shipSpd = Math.hypot(this.ship.vx, this.ship.vy);
        if (dist < 18 && shipSpd < 80) {
          eva.boardingTimer += dt;
          if (eva.boardingTimer >= 0.4) {
            this.rescueEVA(eva.role);
            return;
          }
        } else {
          eva.boardingTimer = 0;
          // "boardingClose" hint when ship is near but too fast / not yet in range
          if (dist < 35 && this.boardingDialogueCooldown <= 0) {
            this.boardingDialogueCooldown = 6;
            this.setCaptainMessage(getLine('boardingClose', this.getPilotName(), this.getGunnerName()), 3);
          }
        }
      }
    }
  }

  ejectShip(role, hitterX, hitterY, hitterVX = 0, hitterVY = 0) {
    if (role === 'pilot' && this.pilotEVA) return;
    if (role === 'gunner' && this.gunnerEVA) return;
    const dx = this.ship.x - hitterX;
    const dy = this.ship.y - hitterY;
    const d = Math.hypot(dx, dy) || 1;
    // Big "yeet" impulse so they fly away dramatically
    const impulse = 340;
    const evx = (dx / d) * impulse + hitterVX * 0.45 + this.ship.vx * 0.6;
    const evy = (dy / d) * impulse + hitterVY * 0.45 + this.ship.vy * 0.6;
    const eva = new EVAPlayer(this.ship.x, this.ship.y, evx, evy, role);
    if (role === 'pilot') this.pilotEVA = eva;
    else this.gunnerEVA = eva;
    // Recoil ship harder + add a little ship spin
    this.ship.vx *= -0.4;
    this.ship.vy *= -0.4;
    this.setCaptainMessage(getLine('eject', this.getPilotName(), this.getGunnerName()), 4);
    this.emitEvent('eject', `${role === 'pilot' ? this.getPilotName() : this.getGunnerName()} ejected!`);
  }

  rescueEVA(role) {
    if (role === 'pilot') this.pilotEVA = null;
    else this.gunnerEVA = null;
    this.score += 50;
    this.ship.hasShield = true;
    this.ship.shieldTimer = Math.max(this.ship.shieldTimer, 2);
    this.setCaptainMessage(getLine('rescue', this.getPilotName(), this.getGunnerName()), 4);
    this.emitEvent('rescue', 'Crew recovered!');
  }

  loseEVA(role, reason) {
    this.pilotEVA = null;
    this.gunnerEVA = null;
    this.lives = 0;
    this.gamePhase = 'death';
    this.setCaptainMessage(getLine('lostCrew', this.getPilotName(), this.getGunnerName()), 8);
    this.emitEvent('eva_lost', `Crew lost (${reason})`);
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

    // Ship is invincible to fatal hits while any crew is in EVA — there's no
    // one (or no one safe) to pilot the rescuer ship if it also dies. Sectors
    // 1-2 eject instead of killing; sector 3 (whale) keeps lethal stakes.
    const anyEVA = this.pilotEVA || this.gunnerEVA;
    const shipVulnerable = !ship.hasShield && !anyEVA;

    if (shipVulnerable) {
      // Ship vs asteroids
      for (const a of this.asteroids) {
        if (a.dead) continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, a.x, a.y, a.radius)) {
          if (this.sector < 3) this.ejectShip('pilot', a.x, a.y, a.vx, a.vy);
          else this.killShip();
          return;
        }
      }

      // Ship vs enemies
      for (const e of this.enemies) {
        if (e.dead || e.state !== 'attacking') continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, e.x, e.y, e.radius)) {
          if (this.sector < 3) this.ejectShip('pilot', e.x, e.y, 0, 0);
          else this.killShip();
          return;
        }
      }

      // Ship vs enemy bullets
      for (const b of this.bullets) {
        if (b.dead || !b.fromEnemy) continue;
        if (circlesCollide(ship.x, ship.y, ship.radius, b.x, b.y, b.radius)) {
          if (this.sector < 3) this.ejectShip('pilot', b.x, b.y, b.vx, b.vy);
          else this.killShip();
          return;
        }
      }

      // Ship vs mini-whales (sector 3 only — always lethal)
      if (this.whale) {
        for (const mw of this.whale.miniWhales) {
          if (mw.dead) continue;
          if (circlesCollide(ship.x, ship.y, ship.radius, mw.x, mw.y, mw.radius)) {
            this.killShip();
            return;
          }
        }
      }
    }

    // EVA crewmates vs world
    for (const eva of [this.pilotEVA, this.gunnerEVA]) {
      if (!eva || eva.ejectTimer < 0.5) continue;
      // Asteroids: bounce hard + add big roll for the "rolling ragdoll" gag
      for (const a of this.asteroids) {
        if (a.dead) continue;
        if (circlesCollide(eva.x, eva.y, eva.radius, a.x, a.y, a.radius)) {
          const dx = eva.x - a.x;
          const dy = eva.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d;
          const ny = dy / d;
          // Push scales with asteroid size — bigger rocks send you flying further
          const push = 160 + a.radius * 4;
          eva.vx = nx * push + a.vx * 0.6;
          eva.vy = ny * push + a.vy * 0.6;
          // Big spin kick. Keep sign consistent with existing rotation so it
          // accelerates the tumble rather than awkwardly fighting it.
          const spinKick = 14 + Math.random() * 10;
          eva.angularVelocity += (eva.angularVelocity >= 0 ? 1 : -1) * spinKick;
          eva.x = a.x + nx * (a.radius + eva.radius + 1);
          eva.y = a.y + ny * (a.radius + eva.radius + 1);
        }
      }
      // Enemy bullets: lethal
      for (const b of this.bullets) {
        if (b.dead || !b.fromEnemy) continue;
        if (circlesCollide(eva.x, eva.y, eva.radius, b.x, b.y, b.radius)) {
          return this.loseEVA(eva.role, 'shot');
        }
      }
      // Enemies (ramming): lethal
      for (const e of this.enemies) {
        if (e.dead || e.state !== 'attacking') continue;
        if (circlesCollide(eva.x, eva.y, eva.radius, e.x, e.y, e.radius)) {
          return this.loseEVA(eva.role, 'rammed');
        }
      }
      // Player bullets pass through (no friendly fire)
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
    this.pilotEVA = null;
    this.gunnerEVA = null;

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
        rotation: this.ship.rotation,
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
      pilotEVA: this.pilotEVA ? {
        x: this.pilotEVA.x, y: this.pilotEVA.y,
        vx: this.pilotEVA.vx, vy: this.pilotEVA.vy,
        rotation: this.pilotEVA.rotation,
        radius: this.pilotEVA.radius,
        role: this.pilotEVA.role,
        boardingTimer: this.pilotEVA.boardingTimer,
        ejectTimer: this.pilotEVA.ejectTimer
      } : null,
      gunnerEVA: this.gunnerEVA ? {
        x: this.gunnerEVA.x, y: this.gunnerEVA.y,
        vx: this.gunnerEVA.vx, vy: this.gunnerEVA.vy,
        rotation: this.gunnerEVA.rotation,
        radius: this.gunnerEVA.radius,
        role: this.gunnerEVA.role,
        boardingTimer: this.gunnerEVA.boardingTimer,
        ejectTimer: this.gunnerEVA.ejectTimer
      } : null,
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
