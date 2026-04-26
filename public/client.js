/* ============================================================
   COSMIC DELIVERY CO. — Client JS
   Vanilla JS, no modules, no build step.
   Logical canvas: 480x270. Scale to fit window.
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------
     CONSTANTS & CONFIG
  ------------------------- */
  var LOGICAL_W = 480;
  var LOGICAL_H = 270;

  var SECTOR_NAMES = [
    'SECTOR 1: THE BELT',
    'SECTOR 2: PIRATE SKIRMISH',
    'SECTOR 3: THE WHALE'
  ];

  var CAPTAIN_LINES = {
    death: [
      '"The cargo is lost in the void..."',
      '"No... not like this..."',
      '"Signal lost. Crew unaccounted for."'
    ],
    victory: [
      '"Delivery confirmed! Outstanding work, crew!"',
      '"Package delivered! The client is pleased."',
      '"Flawless execution. Drinks are on me."'
    ]
  };

  /* -------------------------
     STATE
  ------------------------- */
  var socket;
  var myRole = null;      // 'pilot' | 'gunner'
  var myPlayerId = null;
  var roomCode = null;
  var isHost = false;
  var currentScreen = 'title';

  var lastState = null;
  var currentState = null;

  var shooting = false;
  var holdingRepair = false;

  // Stars for parallax background
  var stars = [];
  var starScrollX = 0;

  // Particles
  var particles = [];

  // Screen shake
  var shakeTimer = 0;
  var shakeX = 0;
  var shakeY = 0;

  // Captain typewriter
  var captainFull = '';
  var captainDisplayed = '';
  var captainTimerId = null;
  var captainCharIdx = 0;

  // Transition countdown
  var transCountdown = 5;
  var transInterval = null;

  /* -------------------------
     DOM REFS
  ------------------------- */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var canvasWrapper = document.getElementById('canvas-wrapper');

  var screens = {
    title: document.getElementById('screen-title'),
    lobby: document.getElementById('screen-lobby'),
    sectorTransition: document.getElementById('screen-sector-transition'),
    death: document.getElementById('screen-death'),
    victory: document.getElementById('screen-victory'),
    disconnected: document.getElementById('screen-disconnected')
  };

  var hud = document.getElementById('hud');
  var captainDialogue = document.getElementById('captain-dialogue');
  var captainPortraitCanvas = document.getElementById('captain-portrait');
  var captainPortraitCtx = captainPortraitCanvas.getContext('2d');

  /* -------------------------
     CANVAS SCALING
  ------------------------- */
  function resizeCanvas() {
    var ww = window.innerWidth;
    var wh = window.innerHeight;
    var ratio = LOGICAL_W / LOGICAL_H;
    var w, h;
    if (ww / wh > ratio) {
      h = wh;
      w = h * ratio;
    } else {
      w = ww;
      h = w / ratio;
    }
    canvas.style.width = Math.floor(w) + 'px';
    canvas.style.height = Math.floor(h) + 'px';
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  /* -------------------------
     SCREEN MANAGEMENT
  ------------------------- */
  function showScreen(name) {
    currentScreen = name;

    // Hide all screens
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.remove('active');
    });

    // Hide canvas
    canvasWrapper.classList.remove('active');
    hud.style.display = 'none';

    if (name === 'playing') {
      canvasWrapper.classList.add('active');
      hud.style.display = 'block';
    } else if (screens[name]) {
      screens[name].classList.add('active');
    }
  }

  /* -------------------------
     STICKER POPUP SYSTEM
  ------------------------- */
  function showStickerPopup(src, duration) {
    var el = document.getElementById('sticker-float');
    var img = document.getElementById('sticker-float-img');
    img.src = src;
    el.style.display = 'block';
    el.style.opacity = '1';
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.style.display = 'none'; }, 500);
    }, duration || 2000);
  }

  /* -------------------------
     STAR FIELD INIT
  ------------------------- */
  function initStars() {
    stars = [];
    // Layer 1: distant tiny stars
    var layers = [
      { count: 40, speed: 0.1, size: 0.5, alpha: 0.35, type: 'normal' },
      { count: 25, speed: 0.25, size: 1,   alpha: 0.55, type: 'normal' },
      { count: 12, speed: 0.5,  size: 1.5, alpha: 0.85, type: 'normal' }
    ];
    layers.forEach(function (l) {
      for (var i = 0; i < l.count; i++) {
        stars.push({
          x: Math.random() * LOGICAL_W,
          y: Math.random() * LOGICAL_H,
          speed: l.speed,
          size: l.size,
          alpha: l.alpha,
          type: 'normal'
        });
      }
    });

    // Layer 4: heart-stars — tiny pink dots that twinkle
    for (var i = 0; i < 7; i++) {
      stars.push({
        x: Math.random() * LOGICAL_W,
        y: Math.random() * LOGICAL_H,
        speed: 0.15,
        size: 1.5,
        alpha: 0.6,
        type: 'heart',
        phase: Math.random() * Math.PI * 2  // random start phase for twinkling
      });
    }
  }
  initStars();

  function updateStars(dt) {
    stars.forEach(function (s) {
      s.x -= s.speed * dt * 0.06;
      if (s.x < 0) s.x += LOGICAL_W;
      // Update heart-star twinkling phase
      if (s.type === 'heart') {
        s.phase = (s.phase || 0) + dt * 0.004;
      }
    });
  }

  function drawStars() {
    stars.forEach(function (s) {
      if (s.type === 'heart') {
        // Pink twinkling dots
        var twinkleAlpha = 0.3 + 0.5 * Math.abs(Math.sin(s.phase || 0));
        ctx.globalAlpha = twinkleAlpha;
        ctx.fillStyle = '#ff6b9d';
        ctx.beginPath();
        ctx.arc(Math.round(s.x), Math.round(s.y), s.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#e8e0f0';
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      }
    });
    ctx.globalAlpha = 1;
  }

  /* -------------------------
     PARTICLES
  ------------------------- */
  function spawnExplosion(x, y, color, count) {
    color = color || '#ff6b9d';  // default pink instead of yellow
    count = count || 10;
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
      var speed = 0.5 + Math.random() * 1.5;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, decay: 0.02 + Math.random() * 0.02,
        size: 1 + Math.random() * 2,
        color: color
      });
    }
  }

  function spawnSparks(x, y, count) {
    count = count || 4;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 0.3 + Math.random() * 0.8;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6, decay: 0.04 + Math.random() * 0.04,
        size: 1,
        color: '#f0c4e8'
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt * 0.05;
      p.y += p.vy * dt * 0.05;
      p.life -= p.decay * dt * 0.05;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  /* -------------------------
     SCREEN SHAKE
  ------------------------- */
  function triggerShake(duration) {
    shakeTimer = duration || 300;
  }

  function updateShake(dt) {
    if (shakeTimer > 0) {
      shakeTimer -= dt;
      shakeX = (Math.random() - 0.5) * 6;
      shakeY = (Math.random() - 0.5) * 6;
    } else {
      shakeTimer = 0;
      shakeX = 0;
      shakeY = 0;
    }
  }

  /* -------------------------
     DRAW HELPERS
  ------------------------- */
  function drawShip(x, y, hasShield, flashWhite, rotation) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    // Shield is rotation-independent (drawn before rotate so it stays a clean ring)
    if (hasShield) {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.strokeStyle = flashWhite ? '#ffffff' : '#ff6b9d';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.rotate(rotation || 0);

    // Body — softer rounded triangle, pink palette
    ctx.strokeStyle = flashWhite ? '#ffffff' : '#f0c4e8';
    ctx.fillStyle = flashWhite ? '#ffffff' : '#ff6b9d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Engine sparkle trail — tiny gold/pink dots instead of orange rectangle
    if (!flashWhite) {
      var sparkColors = ['#fbbf24', '#ff6b9d', '#c084fc', '#f0c4e8'];
      for (var i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.6 - i * 0.12;
        ctx.fillStyle = sparkColors[i % sparkColors.length];
        ctx.fillRect(-8 - i * 2, -1 + (Math.random() * 2 - 1), 2, 2);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-8, -2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawEVAPlayer(eva, t) {
    var x = Math.round(eva.x);
    var y = Math.round(eva.y);

    // Tiny jetpack puff trail when moving
    var spd = Math.hypot(eva.vx || 0, eva.vy || 0);
    if (spd > 30) {
      ctx.save();
      var nvx = eva.vx / spd;
      var nvy = eva.vy / spd;
      for (var i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.5 - i * 0.15;
        ctx.fillStyle = i === 0 ? '#fff' : '#ff6b9d';
        ctx.fillRect(x - nvx * (3 + i * 2) - 1, y - nvy * (3 + i * 2) - 1, 2, 2);
      }
      ctx.restore();
    }

    // Body — chibi astronaut, tumbling, with flailing limbs
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(eva.rotation || 0);

    // Limb swing: stronger when spinning fast, never zero so it always wiggles
    var spinMag = Math.min(20, Math.abs(eva.angularVelocity || 0));
    var flailRate = 10 + spinMag * 0.6;
    var flailAmp = 0.7 + Math.min(1.4, spinMag * 0.08);
    var flailT = (eva.ejectTimer || 0) * flailRate;

    // Arms — pivot at shoulders
    ctx.fillStyle = '#ff6b9d';
    ctx.save();
    ctx.translate(-2, 1);
    ctx.rotate(Math.sin(flailT) * flailAmp - 0.5);
    ctx.fillRect(-2, 0, 2, 3);
    ctx.restore();
    ctx.save();
    ctx.translate(2, 1);
    ctx.rotate(-Math.sin(flailT + 0.7) * flailAmp + 0.5);
    ctx.fillRect(0, 0, 2, 3);
    ctx.restore();

    // Legs — pivot at hips
    ctx.save();
    ctx.translate(-1, 4);
    ctx.rotate(Math.sin(flailT + Math.PI) * flailAmp * 0.8);
    ctx.fillRect(-1, 0, 1.5, 3);
    ctx.restore();
    ctx.save();
    ctx.translate(1, 4);
    ctx.rotate(-Math.sin(flailT + Math.PI + 0.5) * flailAmp * 0.8);
    ctx.fillRect(-0.5, 0, 1.5, 3);
    ctx.restore();

    // Torso (drawn last so limbs sit behind it)
    ctx.fillRect(-2, 1, 4, 3);

    // Helmet
    ctx.fillStyle = '#f0c4e8';
    ctx.beginPath();
    ctx.arc(0, -1, 2.8, 0, Math.PI * 2);
    ctx.fill();
    // Visor
    ctx.fillStyle = '#1a0d2e';
    ctx.fillRect(-1.7, -1.6, 3.4, 1.1);
    // Visor highlight
    ctx.fillStyle = '#ff6b9d';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-1.4, -1.4, 0.6, 0.5);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Boarding progress arc (green) when in pickup zone
    if (eva.boardingTimer > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var pct = Math.min(1, eva.boardingTimer / 0.4);
      ctx.arc(0, 0, 7, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Drift warning ring (red, pulsing) near the edges
    var margin = 35;
    if (eva.x < margin || eva.x > LOGICAL_W - margin || eva.y < margin || eva.y > LOGICAL_H - margin) {
      ctx.save();
      ctx.strokeStyle = '#f87171';
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin((t || 0) * 0.012);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Role label
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.globalAlpha = 0.8;
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText((eva.role || '').toUpperCase(), x, y - 7);
    ctx.restore();
  }

  function drawAsteroid(ast) {
    var x = Math.round(ast.x);
    var y = Math.round(ast.y);
    var r = ast.radius || 8;

    // Softer pastel colors
    var color;
    if (r > 14) color = '#b8b0d4';      // pastel lavender (was harsh cyan)
    else if (r > 8) color = '#9b8fb5';  // soft purple-grey (was grey)
    else color = '#7a6e8a';             // muted purple (was dark grey)

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.85;

    // Irregular polygon
    var points = 8;
    ctx.beginPath();
    for (var i = 0; i < points; i++) {
      var angle = (Math.PI * 2 / points) * i;
      var jitter = r * (0.7 + 0.3 * Math.sin(ast.id * 31.7 + i * 13.3));
      var px = Math.cos(angle) * jitter;
      var py = Math.sin(angle) * jitter;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Kawaii face on medium and large asteroids
    if (r > 8) {
      ctx.globalAlpha = 0.9;
      // Eyes — two white dots
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.1, Math.max(1, r * 0.1), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.1, Math.max(1, r * 0.1), 0, Math.PI * 2);
      ctx.fill();
      // Small mouth
      ctx.beginPath();
      ctx.arc(0, r * 0.1, Math.max(1, r * 0.12), 0, Math.PI);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawEnemy(en) {
    var x = Math.round(en.x);
    var y = Math.round(en.y);
    var r = en.radius || 8;
    var flash = en._flashWhite;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = flash ? '#ffffff' : '#b13e53';
    ctx.fillStyle = flash ? '#ffffff' : '#b13e53';
    ctx.lineWidth = 1;

    // Diamond / arrow pointing left (toward player)
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(0, -r * 0.6);
    ctx.lineTo(r * 0.6, 0);
    ctx.lineTo(0, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 0.3, -r * 0.25, 2, 2);
    ctx.fillRect(r * 0.05, -r * 0.25, 2, 2);

    ctx.restore();
  }

  function drawBullet(b) {
    var x = Math.round(b.x);
    var y = Math.round(b.y);
    // Player bullets: pink dots; enemy bullets: soft red (unchanged logic)
    var color = b.fromEnemy ? '#f87171' : '#ff6b9d';
    var trailColor = b.fromEnemy ? 'rgba(248,113,113,0.4)' : 'rgba(255,107,157,0.4)';

    // Trail
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
    var nx = b.vx / speed;
    var ny = b.vy / speed;
    ctx.moveTo(x, y);
    ctx.lineTo(x - nx * 5, y - ny * 5);
    ctx.stroke();

    // Dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPowerup(pw, t) {
    var x = Math.round(pw.x);
    var y = Math.round(pw.y);
    var r = pw.radius || 7;
    var pulse = 0.7 + 0.3 * Math.sin(t * 0.004);

    var color, letter;
    if (pw.type === 'shield')  { color = '#c084fc'; letter = 'S'; }
    else if (pw.type === 'spread') { color = '#fbbf24'; letter = 'W'; }
    else if (pw.type === 'repair') { color = '#86efac'; letter = 'R'; }
    else { color = '#f0c4e8'; letter = '?'; }

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = pulse;

    // Outer sparkle particles
    for (var i = 0; i < 4; i++) {
      var sparkAngle = (t * 0.003 + i * Math.PI / 2);
      var sparkR = r * 1.8;
      var sx = Math.cos(sparkAngle) * sparkR;
      var sy = Math.sin(sparkAngle) * sparkR;
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillStyle = color;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    ctx.globalAlpha = pulse;

    // Glow
    var grd = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.4);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Letter
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 0);

    ctx.restore();
  }

  function drawWhale(whale, t) {
    if (!whale) return;
    var x = Math.round(whale.x);
    var y = Math.round(whale.y);
    var r = whale.radius || 60;
    var flash = whale._flashWhite;

    ctx.save();
    ctx.translate(x, y);

    // Body — softer purples
    ctx.fillStyle = flash ? '#ffffff' : '#9b59b6';
    ctx.strokeStyle = flash ? '#ffffff' : '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Blush marks on cheeks
    if (!flash) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, r * 0.15, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.05, r * 0.15, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Mouth area
    var mouthOpenAmt = whale.mouthOpen ? 0.4 : 0.1;
    ctx.fillStyle = flash ? '#ffffff' : '#c084fc';
    ctx.beginPath();
    ctx.ellipse(-r * 0.7, 0, r * 0.3, r * 0.25 * mouthOpenAmt + r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tiny tongue when mouth is open
    if (whale.mouthOpen && !flash) {
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.ellipse(-r * 0.7, r * 0.06, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    ctx.fillStyle = flash ? '#0d0b1a' : '#f0c4e8';
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.2, r * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#0d0b1a';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.22, r * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Tail fin
    ctx.fillStyle = flash ? '#ffffff' : '#6d28a7';
    ctx.beginPath();
    ctx.moveTo(r * 0.8, 0);
    ctx.lineTo(r * 1.2, -r * 0.3);
    ctx.lineTo(r * 1.1, 0);
    ctx.lineTo(r * 1.2, r * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Health bar
    if (whale.maxHp && whale.maxHp > 0) {
      var barW = r * 2;
      var barX = x - barW / 2;
      var barY = y - r * 0.7;
      var hpRatio = Math.max(0, whale.hp / whale.maxHp);

      ctx.fillStyle = '#0d0b1a';
      ctx.fillRect(barX, barY - 6, barW, 5);
      ctx.fillStyle = hpRatio > 0.5 ? '#86efac' : hpRatio > 0.25 ? '#fbbf24' : '#f87171';
      ctx.fillRect(barX, barY - 6, barW * hpRatio, 5);
      ctx.strokeStyle = '#7c6a8c';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY - 6, barW, 5);
    }
  }

  function drawMiniWhale(en, t) {
    var x = Math.round(en.x);
    var y = Math.round(en.y);
    var r = en.radius || 18;
    var flash = en._flashWhite;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = flash ? '#ffffff' : '#9b59b6';
    ctx.strokeStyle = flash ? '#ffffff' : '#c084fc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = flash ? '#0d0b1a' : '#f0c4e8';
    ctx.beginPath();
    ctx.arc(-r * 0.2, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* -------------------------
     NAGATORO PORTRAIT DRAW
  ------------------------- */
  function drawCaptainPortrait() {
    var pc = captainPortraitCtx;
    var w = 48, h = 48;
    pc.clearRect(0, 0, w, h);

    // Background
    pc.fillStyle = '#1a0d2e';
    pc.fillRect(0, 0, w, h);

    // --- Neck ---
    pc.fillStyle = '#f4c5a0';  // peach skin
    pc.fillRect(20, 34, 8, 6);

    // --- Head (round) ---
    pc.fillStyle = '#f4c5a0';
    pc.beginPath();
    pc.arc(24, 24, 13, 0, Math.PI * 2);
    pc.fill();

    // --- Hair (dark with purple tint) covering top and sides ---
    pc.fillStyle = '#2d1a4a';
    // Top of hair
    pc.beginPath();
    pc.arc(24, 20, 13, Math.PI, 0);
    pc.fill();
    // Side hair left
    pc.fillRect(11, 18, 5, 14);
    // Side hair right
    pc.fillRect(32, 18, 5, 14);
    // Bangs — a few strands over forehead
    pc.fillRect(14, 13, 20, 5);
    // Hair part highlight
    pc.fillStyle = '#4a2d6e';
    pc.fillRect(22, 11, 4, 3);

    // --- Eyes (big anime eyes) ---
    // White of eye left
    pc.fillStyle = '#ffffff';
    pc.beginPath();
    pc.ellipse(19, 23, 4, 5, 0, 0, Math.PI * 2);
    pc.fill();
    // White of eye right
    pc.beginPath();
    pc.ellipse(29, 23, 4, 5, 0, 0, Math.PI * 2);
    pc.fill();

    // Iris left (dark)
    pc.fillStyle = '#3d2060';
    pc.beginPath();
    pc.ellipse(19, 24, 3, 4, 0, 0, Math.PI * 2);
    pc.fill();
    // Iris right
    pc.beginPath();
    pc.ellipse(29, 24, 3, 4, 0, 0, Math.PI * 2);
    pc.fill();

    // Pupil left
    pc.fillStyle = '#0d0b1a';
    pc.beginPath();
    pc.arc(19, 24, 1.5, 0, Math.PI * 2);
    pc.fill();
    // Pupil right
    pc.beginPath();
    pc.arc(29, 24, 1.5, 0, Math.PI * 2);
    pc.fill();

    // Eye shine left
    pc.fillStyle = '#ffffff';
    pc.fillRect(20, 21, 2, 2);
    // Eye shine right
    pc.fillRect(30, 21, 2, 2);

    // --- Small nose dot ---
    pc.fillStyle = '#e8a080';
    pc.fillRect(23, 28, 2, 1);

    // --- Cat-like mischievous smile ---
    pc.strokeStyle = '#c07060';
    pc.lineWidth = 1;
    pc.beginPath();
    pc.moveTo(18, 31);
    pc.quadraticCurveTo(24, 35, 30, 31);
    pc.stroke();
    // Small fang/smirk left
    pc.strokeStyle = '#ffffff';
    pc.lineWidth = 0.8;
    pc.beginPath();
    pc.moveTo(20, 31);
    pc.lineTo(19, 33);
    pc.stroke();

    // --- Blush on cheeks ---
    pc.globalAlpha = 0.45;
    pc.fillStyle = '#ff6b9d';
    pc.beginPath();
    pc.ellipse(14, 28, 4, 2.5, 0, 0, Math.PI * 2);
    pc.fill();
    pc.beginPath();
    pc.ellipse(34, 28, 4, 2.5, 0, 0, Math.PI * 2);
    pc.fill();
    pc.globalAlpha = 1;

    // --- Collar/top ---
    pc.fillStyle = '#ff6b9d';
    pc.fillRect(17, 37, 14, 5);
    // Collar trim
    pc.fillStyle = '#c084fc';
    pc.fillRect(17, 37, 14, 2);
  }

  /* -------------------------
     CRT SCANLINE OVERLAY (canvas)
  ------------------------- */
  function drawScanlines() {
    ctx.save();
    ctx.globalAlpha = 0.03;   // much more subtle — was 0.08
    ctx.fillStyle = '#000000';
    for (var y = 0; y < LOGICAL_H; y += 2) {
      ctx.fillRect(0, y, LOGICAL_W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* -------------------------
     HUD UPDATE
  ------------------------- */
  function updateHUD(state) {
    if (!state) return;

    document.getElementById('hud-score').textContent = 'SCORE: ' + (state.score || 0);

    var sectorIdx = (state.sector || 1) - 1;
    document.getElementById('hud-sector').textContent = SECTOR_NAMES[sectorIdx] || ('SECTOR ' + state.sector);

    var secs = Math.ceil(state.sectorTimer || 0);
    var mm = Math.floor(secs / 60);
    var ss = secs % 60;
    document.getElementById('hud-timer').textContent =
      (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;

    var roleStr = myRole ? ('YOU: ' + myRole.toUpperCase()) : '';
    document.getElementById('hud-role').textContent = roleStr;

    document.getElementById('hud-lives').textContent = 'LIVES: ' + (state.lives !== undefined ? state.lives : '?');

    var shieldEl = document.getElementById('hud-shield');
    if (state.ship && state.ship.hasShield) {
      shieldEl.style.display = 'block';
    } else {
      shieldEl.style.display = 'none';
    }

    var evaEl = document.getElementById('hud-eva');
    if (evaEl) {
      var anyEVA = state.pilotEVA || state.gunnerEVA;
      if (anyEVA) {
        var roles = [];
        if (state.pilotEVA)  roles.push('PILOT');
        if (state.gunnerEVA) roles.push('GUNNER');
        evaEl.textContent = roles.join(' + ') + ' ADRIFT — RESCUE';
        evaEl.style.display = 'block';
      } else {
        evaEl.style.display = 'none';
      }
    }
  }

  /* -------------------------
     CAPTAIN DIALOGUE
  ------------------------- */
  function showCaptainMessage(msg) {
    if (!msg) {
      captainDialogue.style.display = 'none';
      return;
    }
    if (msg === captainFull) return; // same message, don't restart

    captainFull = msg;
    captainDisplayed = '';
    captainCharIdx = 0;
    captainDialogue.style.display = 'flex';
    document.getElementById('captain-text').textContent = '';

    if (captainTimerId) clearInterval(captainTimerId);
    captainTimerId = setInterval(function () {
      if (captainCharIdx < captainFull.length) {
        captainDisplayed += captainFull[captainCharIdx];
        captainCharIdx++;
        document.getElementById('captain-text').textContent = captainDisplayed;
      } else {
        clearInterval(captainTimerId);
        captainTimerId = null;
      }
    }, 30);
  }

  function hideCaptain() {
    if (captainTimerId) clearInterval(captainTimerId);
    captainTimerId = null;
    captainFull = '';
    captainDialogue.style.display = 'none';
  }

  /* -------------------------
     MAIN RENDER LOOP
  ------------------------- */
  var lastFrameTime = 0;

  function render(ts) {
    requestAnimationFrame(render);

    var dt = ts - lastFrameTime;
    lastFrameTime = ts;
    if (dt > 100) dt = 100; // cap delta

    if (currentScreen !== 'playing') return;

    var state = currentState;

    updateStars(dt);
    updateParticles(dt);
    updateShake(dt);

    // Clear
    ctx.save();
    ctx.translate(Math.round(shakeX), Math.round(shakeY));

    // Background — sector 3 gets a subtle purple radial gradient
    if (state && state.sector === 3) {
      var bgGrad = ctx.createRadialGradient(LOGICAL_W * 0.5, LOGICAL_H * 0.5, 0, LOGICAL_W * 0.5, LOGICAL_H * 0.5, LOGICAL_W * 0.7);
      bgGrad.addColorStop(0, '#1a0d2e');
      bgGrad.addColorStop(1, '#0d0b1a');
      ctx.fillStyle = bgGrad;
    } else {
      ctx.fillStyle = '#0d0b1a';
    }
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Starfield
    drawStars();

    if (!state) {
      ctx.restore();
      return;
    }

    // Asteroids
    if (state.asteroids) {
      state.asteroids.forEach(function (a) { drawAsteroid(a); });
    }

    // Powerups
    if (state.powerups) {
      state.powerups.forEach(function (pw) { drawPowerup(pw, ts); });
    }

    // Whale (sector 3)
    if (state.whale) {
      drawWhale(state.whale, ts);
      // Mini-whales
      if (state.whale.miniWhales) {
        state.whale.miniWhales.forEach(function (mw) { drawMiniWhale(mw, ts); });
      }
    }

    // Enemies
    if (state.enemies) {
      state.enemies.forEach(function (en) { drawEnemy(en); });
    }

    // Bullets
    if (state.bullets) {
      state.bullets.forEach(function (b) { drawBullet(b); });
    }

    // Ship
    if (state.ship) {
      var flashWhite = state.ship._flashWhite || false;
      drawShip(state.ship.x, state.ship.y, state.ship.hasShield, flashWhite, state.ship.rotation);
    }

    // EVA crewmates (drawn after ship so they're on top when overlapping at re-board)
    if (state.pilotEVA)  drawEVAPlayer(state.pilotEVA, ts);
    if (state.gunnerEVA) drawEVAPlayer(state.gunnerEVA, ts);

    // Particles
    drawParticles();

    // CRT scanlines
    drawScanlines();

    ctx.restore();

    // HUD
    updateHUD(state);

    // Captain dialogue
    if (state.captainMessage) {
      showCaptainMessage(state.captainMessage);
    } else {
      hideCaptain();
    }
  }

  requestAnimationFrame(render);

  /* -------------------------
     SOCKET SETUP
  ------------------------- */
  function setupSocket() {
    socket = io();

    socket.on('connect', function () {
      console.log('[CDC] Connected:', socket.id);
    });

    socket.on('disconnect', function () {
      console.log('[CDC] Disconnected');
      if (currentScreen === 'playing') {
        showScreen('disconnected');
      }
    });

    socket.on('reconnect', function () {
      console.log('[CDC] Reconnected');
      // Server will need to re-establish game state
    });

    // Game state snapshot
    socket.on('state:snapshot', function (state) {
      lastState = currentState;
      currentState = state;

      // Handle game phase transitions
      if (state.gamePhase === 'death' && currentScreen !== 'death') {
        triggerShake(400);
        showStickerPopup('/stickers/oops.webp', 3000);
        setTimeout(function () {
          var deathCap = CAPTAIN_LINES.death[Math.floor(Math.random() * CAPTAIN_LINES.death.length)];
          document.getElementById('death-caption').textContent = state.captainMessage || deathCap;
          document.getElementById('death-score').textContent = state.score || 0;
          showScreen('death');
        }, 600);
      } else if (state.gamePhase === 'victory' && currentScreen !== 'victory') {
        showStickerPopup('/stickers/tina_sticker1.webp', 4000);
        var victCap = CAPTAIN_LINES.victory[Math.floor(Math.random() * CAPTAIN_LINES.victory.length)];
        document.getElementById('victory-caption').textContent = state.captainMessage || victCap;
        document.getElementById('victory-score').textContent = state.score || 0;
        document.getElementById('victory-deliveries').textContent = (state.deliveries || 0) + ' DELIVERIES';
        showScreen('victory');
      } else if (state.gamePhase === 'sectorTransition' && currentScreen !== 'sectorTransition') {
        showSectorTransition(state);
      } else if (state.gamePhase === 'paused' && currentScreen !== 'disconnected') {
        showScreen('disconnected');
      } else if (state.gamePhase === 'playing' && currentScreen !== 'playing') {
        showScreen('playing');
      }
    });

    // Room events
    socket.on('room:playerJoined', function (data) {
      updateLobbyPlayers(data.role, data.playerName, true);
    });

    socket.on('room:playerLeft', function (data) {
      updateLobbyPlayers(data.role, 'DISCONNECTED', false);
      if (currentScreen === 'playing') {
        showScreen('disconnected');
      }
    });

    socket.on('game:event', function (ev) {
      console.log('[CDC] game event:', ev.type, ev.message);

      if (ev.type === 'asteroid_destroyed') {
        spawnExplosion(ev.x || 240, ev.y || 135, '#b8b0d4', 8);
      } else if (ev.type === 'enemy_destroyed') {
        spawnExplosion(ev.x || 240, ev.y || 135, '#f87171', 12);
      } else if (ev.type === 'ship_hit') {
        triggerShake(300);
        if (currentState && currentState.ship) {
          currentState.ship._flashWhite = true;
          setTimeout(function () {
            if (currentState && currentState.ship) currentState.ship._flashWhite = false;
          }, 150);
        }
      } else if (ev.type === 'bullet_impact') {
        spawnSparks(ev.x || 240, ev.y || 135, 4);
      } else if (ev.type === 'powerup_collected') {
        showStickerPopup('/stickers/tina_sticker_.webp', 2000);
      } else if (ev.type === 'eject') {
        triggerShake(500);
        if (currentState && currentState.ship) {
          spawnSparks(currentState.ship.x, currentState.ship.y, 8);
        }
      } else if (ev.type === 'rescue') {
        if (currentState && currentState.ship) {
          spawnExplosion(currentState.ship.x, currentState.ship.y, '#86efac', 14);
        }
      } else if (ev.type === 'eva_lost') {
        triggerShake(300);
      }
    });
  }

  /* -------------------------
     LOBBY HELPERS
  ------------------------- */
  function updateLobbyPlayers(role, name, connected) {
    if (role === 'pilot') {
      document.getElementById('pilot-name').textContent = name || 'WAITING...';
      var st = document.getElementById('pilot-status');
      st.textContent = connected ? '[ READY ]' : '[ EMPTY ]';
      st.className = 'slot-status' + (connected ? ' ready' : '');
    } else if (role === 'gunner') {
      document.getElementById('gunner-name').textContent = name || 'WAITING...';
      var st2 = document.getElementById('gunner-status');
      st2.textContent = connected ? '[ READY ]' : '[ EMPTY ]';
      st2.className = 'slot-status' + (connected ? ' ready' : '');
    }
  }

  /* -------------------------
     SECTOR TRANSITION
  ------------------------- */
  function showSectorTransition(state) {
    showScreen('sectorTransition');
    if (transInterval) clearInterval(transInterval);
    transCountdown = 5;
    document.getElementById('trans-timer').textContent = transCountdown;

    var newSector = state.sector || 2;
    document.getElementById('trans-sector-complete').textContent = 'SECTOR ' + (newSector - 1) + ' COMPLETE!';
    document.getElementById('trans-bonus').textContent = '+' + (state.sectorBonus || 0) + ' BONUS';

    // Determine new role for display
    var newRole = myRole === 'pilot' ? 'GUNNER' : 'PILOT';
    document.getElementById('trans-new-role').textContent = 'YOU ARE NOW: ' + newRole;
    document.getElementById('trans-caption').textContent = state.captainMessage || '"Good work out there, crew!"';

    transInterval = setInterval(function () {
      transCountdown--;
      document.getElementById('trans-timer').textContent = transCountdown;
      if (transCountdown <= 0) {
        clearInterval(transInterval);
        transInterval = null;
        // Role swap
        myRole = newRole.toLowerCase();
        showScreen('playing');
      }
    }, 1000);
  }

  /* -------------------------
     HIGHSCORES
  ------------------------- */
  function loadHighscores() {
    fetch('/api/highscores')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = document.getElementById('highscores-list');
        if (!data || !data.length) {
          list.innerHTML = '<div class="hs-loading">NO SCORES YET</div>';
          return;
        }
        list.innerHTML = data.slice(0, 8).map(function (entry, i) {
          return '<div class="hs-entry">' +
            '<span class="hs-rank">#' + (i + 1) + '</span>' +
            '<span class="hs-name">' + escHtml(entry.roomName || 'UNKNOWN') + '</span>' +
            '<span class="hs-score">' + (entry.score || 0) + '</span>' +
            '</div>';
        }).join('');
      })
      .catch(function () {
        document.getElementById('highscores-list').innerHTML =
          '<div class="hs-loading">--</div>';
      });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* -------------------------
     INPUT HANDLING
     Both clients always send the full payload (WASD + mouse + click + E + space).
     Server picks which fields to use each tick based on EVA state. This lets the
     remaining player take over both controls when their crewmate is in EVA.
  ------------------------- */
  var myKeys = { up: false, down: false, left: false, right: false };
  var myAim  = { aimX: 0.5, aimY: 0.5 };
  var myEjectKey = false;

  function emitInput() {
    if (!socket || !myRole) return;
    var payload = {
      up: myKeys.up, down: myKeys.down, left: myKeys.left, right: myKeys.right,
      aimX: myAim.aimX, aimY: myAim.aimY,
      shooting: shooting,
      holdingRepair: holdingRepair,
      ejectKey: myEjectKey
    };
    socket.emit(myRole === 'pilot' ? 'input:pilot' : 'input:gunner', payload);
  }

  function setupInput() {
    // WASD — both clients capture; server decides whether it drives the ship or the EVA jetpack
    window.addEventListener('keydown', function (e) {
      if (currentScreen !== 'playing') return;
      var changed = false;
      if (e.key === 'w' || e.key === 'ArrowUp')    { if (!myKeys.up)    { myKeys.up    = true; changed = true; } }
      if (e.key === 's' || e.key === 'ArrowDown')  { if (!myKeys.down)  { myKeys.down  = true; changed = true; } }
      if (e.key === 'a' || e.key === 'ArrowLeft')  { if (!myKeys.left)  { myKeys.left  = true; changed = true; } }
      if (e.key === 'd' || e.key === 'ArrowRight') { if (!myKeys.right) { myKeys.right = true; changed = true; } }
      if (e.code === 'Space') {
        if (!holdingRepair) { holdingRepair = true; changed = true; }
        e.preventDefault && e.preventDefault();
      }
      if (e.key === 'e' || e.key === 'E') {
        if (!myEjectKey) { myEjectKey = true; changed = true; }
        e.preventDefault && e.preventDefault();
      }
      if (changed) emitInput();
      if (e.key === 'w' || e.key === 's' || e.key === 'a' || e.key === 'd' ||
          e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault && e.preventDefault();
      }
    });

    window.addEventListener('keyup', function (e) {
      if (currentScreen !== 'playing') return;
      var changed = false;
      if (e.key === 'w' || e.key === 'ArrowUp')    { if (myKeys.up)    { myKeys.up    = false; changed = true; } }
      if (e.key === 's' || e.key === 'ArrowDown')  { if (myKeys.down)  { myKeys.down  = false; changed = true; } }
      if (e.key === 'a' || e.key === 'ArrowLeft')  { if (myKeys.left)  { myKeys.left  = false; changed = true; } }
      if (e.key === 'd' || e.key === 'ArrowRight') { if (myKeys.right) { myKeys.right = false; changed = true; } }
      if (e.code === 'Space')      { if (holdingRepair) { holdingRepair = false; changed = true; } }
      if (e.key === 'e' || e.key === 'E') { if (myEjectKey) { myEjectKey = false; changed = true; } }
      if (changed) emitInput();
    });

    // Mouse — both clients capture; server uses for ship aim/shoot when whoever's on board
    var lastMouseEmit = 0;
    canvas.addEventListener('mousemove', function (e) {
      if (currentScreen !== 'playing') return;
      var now = Date.now();
      if (now - lastMouseEmit < 33) return; // 30Hz throttle
      lastMouseEmit = now;
      var rect = canvas.getBoundingClientRect();
      myAim.aimX = (e.clientX - rect.left) / rect.width;
      myAim.aimY = (e.clientY - rect.top) / rect.height;
      emitInput();
    });

    canvas.addEventListener('mousedown', function (e) {
      if (currentScreen !== 'playing') return;
      if (e.button === 0) {
        shooting = true;
        var rect = canvas.getBoundingClientRect();
        myAim.aimX = (e.clientX - rect.left) / rect.width;
        myAim.aimY = (e.clientY - rect.top) / rect.height;
        emitInput();
      }
    });

    canvas.addEventListener('mouseup', function (e) {
      if (e.button === 0) {
        shooting = false;
        var rect = canvas.getBoundingClientRect();
        myAim.aimX = (e.clientX - rect.left) / rect.width;
        myAim.aimY = (e.clientY - rect.top) / rect.height;
        emitInput();
      }
    });

    // Touch fallback (mobile)
    canvas.addEventListener('touchmove', function (e) {
      if (currentScreen !== 'playing') return;
      e.preventDefault();
      var now = Date.now();
      if (now - lastMouseEmit < 33) return;
      lastMouseEmit = now;
      var touch = e.touches[0];
      var rect = canvas.getBoundingClientRect();
      myAim.aimX = (touch.clientX - rect.left) / rect.width;
      myAim.aimY = (touch.clientY - rect.top) / rect.height;
      emitInput();
    }, { passive: false });

    canvas.addEventListener('touchstart', function (e) {
      if (currentScreen !== 'playing') return;
      e.preventDefault();
      shooting = true;
      var touch = e.touches[0];
      var rect = canvas.getBoundingClientRect();
      myAim.aimX = (touch.clientX - rect.left) / rect.width;
      myAim.aimY = (touch.clientY - rect.top) / rect.height;
      emitInput();
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      shooting = false;
      emitInput();
    });
  }

  /* -------------------------
     BUTTON BINDINGS
  ------------------------- */
  function setupButtons() {
    // Create room
    document.getElementById('btn-create').addEventListener('click', function () {
      var name = document.getElementById('create-name').value.trim() || 'CAPTAIN';
      socket.emit('room:create', { playerName: name }, function (res) {
        if (res.error) {
          showError(res.error);
          return;
        }
        myPlayerId = res.playerId;
        myRole = res.role;
        roomCode = res.roomCode;
        isHost = true;

        document.getElementById('lobby-room-code').textContent = res.roomCode;
        updateLobbyPlayers(res.role, name, true);

        document.getElementById('btn-start').style.display = 'block';
        document.getElementById('lobby-guest-msg').style.display = 'none';
        document.getElementById('lobby-waiting').style.display = 'block';

        showScreen('lobby');
      });
    });

    // Join room
    document.getElementById('btn-join').addEventListener('click', function () {
      var code = document.getElementById('join-code').value.trim().toUpperCase();
      var name = document.getElementById('join-name').value.trim() || 'GUNNER';
      if (!code) { showError('Enter a room code'); return; }
      socket.emit('room:join', { roomCode: code, playerName: name }, function (res) {
        if (res.error) {
          showError(res.error);
          return;
        }
        myPlayerId = res.playerId;
        myRole = res.role;
        roomCode = code;
        isHost = false;

        document.getElementById('lobby-room-code').textContent = code;
        updateLobbyPlayers(res.role, name, true);

        document.getElementById('btn-start').style.display = 'none';
        document.getElementById('lobby-guest-msg').style.display = 'block';
        document.getElementById('lobby-waiting').style.display = 'none';

        // If host already in, populate their slot too
        if (res.roles) {
          Object.keys(res.roles).forEach(function (r) {
            if (r !== myRole) updateLobbyPlayers(r, res.roles[r], true);
          });
        }

        showScreen('lobby');
      });
    });

    // Start game (host)
    document.getElementById('btn-start').addEventListener('click', function () {
      socket.emit('game:start');
    });

    // Restart from death
    document.getElementById('btn-restart-death').addEventListener('click', function () {
      socket.emit('game:restart');
      showScreen('playing');
    });

    // Restart from victory
    document.getElementById('btn-restart-victory').addEventListener('click', function () {
      socket.emit('game:restart');
      showScreen('playing');
    });

    // Enter key on inputs
    document.getElementById('create-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btn-create').click();
    });
    document.getElementById('join-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
    });
    document.getElementById('join-code').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
      // Auto uppercase
      document.getElementById('join-code').value = document.getElementById('join-code').value.toUpperCase();
    });
  }

  function showError(msg) {
    var el = document.getElementById('title-error');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  /* -------------------------
     AUDIO (best-effort)
  ------------------------- */
  function setupAudio() {
    var sounds = {};
    var files = {
      shoot: '/audio/shoot.wav',
      explode: '/audio/explode.wav',
      powerup: '/audio/powerup.wav',
      hit: '/audio/hit.wav',
      music: '/audio/music.ogg'
    };

    Object.keys(files).forEach(function (key) {
      try {
        var audio = new Audio(files[key]);
        audio.preload = 'none';
        sounds[key] = audio;
      } catch (e) { /* no audio */ }
    });

    return {
      play: function (name) {
        try {
          if (sounds[name]) {
            sounds[name].currentTime = 0;
            sounds[name].play().catch(function () {});
          }
        } catch (e) {}
      }
    };
  }

  /* -------------------------
     INIT
  ------------------------- */
  function init() {
    drawCaptainPortrait();
    setupSocket();
    setupInput();
    setupButtons();
    setupAudio(); // fire and forget
    loadHighscores();
    showScreen('title');
  }

  init();

})();
