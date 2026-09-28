/**
 * CARTER DROP: Minimalist Light Edition
 * Instant Rapid Dropping + Bouncy Weird Physics + Real Carter Photos
 */

(function () {
  'use strict';

  // --- TIERS DEFINITION ---
  const TIERS = [
    { tier: 1, name: "Screw", radius: 22, score: 2, color: "#64748B", photo: "images/carter_1.jpg" },
    { tier: 2, name: "Paste", radius: 30, score: 4, color: "#0284C7", photo: "images/carter_2.jpg" },
    { tier: 3, name: "DDR4", radius: 40, score: 8, color: "#16A34A", photo: "images/carter_3.jpg" },
    { tier: 4, name: "DDR5", radius: 52, score: 16, color: "#9333EA", photo: "images/carter_4.jpg" },
    { tier: 5, name: "CPU", radius: 66, score: 32, color: "#F59E0B", photo: "images/carter_5.jpg" },
    { tier: 6, name: "Fan", radius: 80, score: 64, color: "#10B981", photo: "images/carter_6.jpg" },
    { tier: 7, name: "Cooler", radius: 96, score: 128, color: "#EA580C", photo: "images/carter_7.jpg" },
    { tier: 8, name: "AIO", radius: 114, score: 256, color: "#06B6D4", photo: "images/carter_8.jpg" },
    { tier: 9, name: "PSU", radius: 132, score: 512, color: "#D97706", photo: "images/carter_9.jpg" },
    { tier: 10, name: "4090", radius: 152, score: 1024, color: "#22C55E", photo: "images/carter_10.jpg" },
    { tier: 11, name: "Custom Rig", radius: 172, score: 2048, color: "#8B5CF6", photo: "images/carter_11.jpg" }
  ];

  // Preload Carter photos
  const photoImages = {};
  TIERS.forEach(t => {
    const img = new Image();
    img.src = t.photo;
    photoImages[t.tier] = img;
  });

  // --- GAME STATE ---
  const Game = {
    canvas: null,
    ctx: null,
    width: 440,
    height: 640,
    dangerY: 90,
    dropperY: 40,

    // Physics
    engine: null,
    world: null,
    runner: null,

    // Instant Dropper (ZERO debounce)
    dropperX: 220,
    currentTier: 1,
    nextTier: 1,
    canDrop: true,

    // Score & Meta
    score: 0,
    highScore: 0,
    highestTierAchieved: 1,
    gameOver: false,
    dangerTimer: 0,
    maxDangerTime: 2800,
    isDanger: false,

    // Desk Bump
    lastBumpTime: -10000,
    maxBumpCooldown: 8000,

    // FX
    particles: [],
    floatingTexts: [],
    shockwaves: [],
    shakeIntensity: 0,

    dom: {}
  };

  // --- INIT ---
  window.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initPhysics();
    initControls();
    loadHighScore();
    pickNextComponents();
    requestAnimationFrame(renderLoop);
  });

  function initDOM() {
    Game.canvas = document.getElementById('game-canvas');
    Game.ctx = Game.canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    Game.canvas.width = Game.width * dpr;
    Game.canvas.height = Game.height * dpr;
    Game.canvas.style.width = Game.width + 'px';
    Game.canvas.style.height = Game.height + 'px';
    Game.ctx.scale(dpr, dpr);

    Game.dom = {
      score: document.getElementById('current-score'),
      highScore: document.getElementById('high-score'),
      nextPreview: document.getElementById('next-preview-canvas'),
      bumpBtn: document.getElementById('bump-btn'),
      resetQuickBtn: document.getElementById('reset-quick-btn'),
      modal: document.getElementById('game-over-modal'),
      finalScore: document.getElementById('modal-final-score'),
      modalBadge: document.getElementById('modal-tier-badge'),
      restartBtn: document.getElementById('restart-btn')
    };

    if (Game.dom.nextPreview) {
      Game.dom.nextPreview.width = 36 * dpr;
      Game.dom.nextPreview.height = 36 * dpr;
      Game.dom.nextPreviewCtx = Game.dom.nextPreview.getContext('2d');
      Game.dom.nextPreviewCtx.scale(dpr, dpr);
    }
  }

  function initPhysics() {
    const { Engine, Runner, Bodies, Composite, Events } = Matter;

    // Weird, super-bouncy physics configuration
    Game.engine = Engine.create({
      gravity: { x: 0, y: 1.5, scale: 0.0012 }
    });
    Game.world = Game.engine.world;

    const wallThick = 60;
    const ground = Bodies.rectangle(
      Game.width / 2,
      Game.height + wallThick / 2,
      Game.width + wallThick * 2,
      wallThick,
      { isStatic: true, friction: 0.2, restitution: 0.6 }
    );
    const leftWall = Bodies.rectangle(
      -wallThick / 2,
      Game.height / 2,
      wallThick,
      Game.height * 2,
      { isStatic: true, friction: 0.1, restitution: 0.7 }
    );
    const rightWall = Bodies.rectangle(
      Game.width + wallThick / 2,
      Game.height / 2,
      wallThick,
      Game.height * 2,
      { isStatic: true, friction: 0.1, restitution: 0.7 }
    );

    Composite.add(Game.world, [ground, leftWall, rightWall]);

    // Collision listener for weird bounce & merge
    Events.on(Game.engine, 'collisionStart', handleCollisions);

    Game.runner = Runner.create();
    Runner.run(Game.runner, Game.engine);
  }

  function loadHighScore() {
    try {
      const saved = localStorage.getItem('carter_drop_highscore');
      Game.highScore = saved ? parseInt(saved, 10) : 0;
      Game.dom.highScore.textContent = Game.highScore.toLocaleString();
    } catch (e) {
      Game.highScore = 0;
    }
  }

  function saveHighScore() {
    if (Game.score > Game.highScore) {
      Game.highScore = Game.score;
      Game.dom.highScore.textContent = Game.highScore.toLocaleString();
      try {
        localStorage.setItem('carter_drop_highscore', Game.highScore.toString());
      } catch (e) {}
    }
  }

  function getRandomDropTier() {
    const r = Math.random();
    if (r < 0.42) return 1;
    if (r < 0.72) return 2;
    if (r < 0.88) return 3;
    if (r < 0.96) return 4;
    return 5;
  }

  function pickNextComponents() {
    if (!Game.currentTier) Game.currentTier = getRandomDropTier();
    Game.nextTier = getRandomDropTier();
    drawNextPreview();
  }

  // --- WEIRD PHYSICS & MERGE HANDLING ---
  function handleCollisions(event) {
    if (Game.gameOver) return;

    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const { bodyA, bodyB } = pairs[i];

      // Add weird random spin/torque impulse on collision
      if (bodyA.tier && bodyB.tier) {
        bodyA.torque = (Math.random() - 0.5) * 0.06 * bodyA.mass;
        bodyB.torque = (Math.random() - 0.5) * 0.06 * bodyB.mass;
      }

      // Check if identical tiers merge
      if (
        bodyA.tier &&
        bodyB.tier &&
        bodyA.tier === bodyB.tier &&
        !bodyA.isMerging &&
        !bodyB.isMerging
      ) {
        const currentTier = bodyA.tier;
        if (currentTier >= TIERS.length) continue;

        bodyA.isMerging = true;
        bodyB.isMerging = true;

        const nextTierNum = currentTier + 1;
        const targetConfig = TIERS[nextTierNum - 1];

        const mergeX = (bodyA.position.x + bodyB.position.x) / 2;
        const mergeY = (bodyA.position.y + bodyB.position.y) / 2;

        spawnMergeFX(mergeX, mergeY, targetConfig);

        const points = targetConfig.score * 2;
        addScore(points, mergeX, mergeY);

        if (nextTierNum > Game.highestTierAchieved) {
          Game.highestTierAchieved = nextTierNum;
        }

        setTimeout(() => {
          Matter.Composite.remove(Game.world, bodyA);
          Matter.Composite.remove(Game.world, bodyB);

          const newBody = createComponentBody(mergeX, mergeY, nextTierNum);
          Matter.Composite.add(Game.world, newBody);

          // Pop impulse with extra weird bounce
          Matter.Body.setVelocity(newBody, {
            x: (Math.random() - 0.5) * 4,
            y: -3.8
          });
          newBody.torque = (Math.random() - 0.5) * 0.08 * newBody.mass;
        }, 12);
      }
    }
  }

  function createComponentBody(x, y, tier) {
    const config = TIERS[tier - 1];
    const body = Matter.Bodies.circle(x, y, config.radius, {
      restitution: 0.72,       // Super bouncy
      friction: 0.04,          // Slippery
      frictionAir: 0.002,       // Low air drag for rapid rolls
      density: 0.0016 + tier * 0.0002
    });
    body.tier = tier;
    body.config = config;
    body.spawnTime = performance.now();
    return body;
  }

  // --- INSTANT RAPID DROPPER (ZERO DEBOUNCE) ---
  function dropCurrentComponent() {
    if (Game.gameOver) return;

    const currentConfig = TIERS[Game.currentTier - 1];
    const clampedX = Math.max(
      currentConfig.radius + 4,
      Math.min(Game.width - currentConfig.radius - 4, Game.dropperX)
    );

    // Spawn physical body immediately!
    const body = createComponentBody(clampedX, Game.dropperY, Game.currentTier);
    // Slight random initial velocity for weirdness
    Matter.Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 1.5,
      y: 1.0
    });
    Matter.Composite.add(Game.world, body);

    // Immediately shift to next piece with ZERO delay
    Game.currentTier = Game.nextTier;
    Game.nextTier = getRandomDropTier();
    drawNextPreview();
  }

  // --- DESK BUMP / CASE TAP ---
  function triggerDeskBump() {
    const now = performance.now();
    if (now - Game.lastBumpTime < Game.maxBumpCooldown || Game.gameOver) return;

    Game.lastBumpTime = now;
    Game.shakeIntensity = 10;

    const allBodies = Matter.Composite.allBodies(Game.world);
    allBodies.forEach(b => {
      if (!b.isStatic && b.tier) {
        Matter.Body.applyForce(b, b.position, {
          x: (Math.random() - 0.5) * 0.05 * b.mass,
          y: -0.075 * b.mass
        });
        b.torque = (Math.random() - 0.5) * 0.1 * b.mass;
      }
    });
  }

  function addScore(pts, x, y) {
    Game.score += pts;
    Game.dom.score.textContent = Game.score.toLocaleString();
    saveHighScore();

    Game.floatingTexts.push({
      text: `+${pts}`,
      x: x,
      y: y,
      alpha: 1.0,
      color: "#2563EB"
    });
  }

  function spawnMergeFX(x, y, config) {
    Game.shockwaves.push({
      x,
      y,
      radius: config.radius * 0.6,
      maxRadius: config.radius * 2.1,
      color: config.color,
      alpha: 0.8
    });

    const count = 10 + config.tier;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 2.5 + Math.random() * 3.5;
      Game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2,
        color: config.color,
        alpha: 1.0,
        decay: 0.03
      });
    }
  }

  // --- CONTROLS ---
  function initControls() {
    const canvas = Game.canvas;

    function updateAim(clientX) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = Game.width / rect.width;
      const x = (clientX - rect.left) * scaleX;
      const curConfig = TIERS[Game.currentTier - 1];
      Game.dropperX = Math.max(curConfig.radius + 4, Math.min(Game.width - curConfig.radius - 4, x));
    }

    canvas.addEventListener('mousemove', (e) => {
      updateAim(e.clientX);
    });

    // Instant click drop
    canvas.addEventListener('pointerdown', (e) => {
      updateAim(e.clientX);
      dropCurrentComponent();
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        updateAim(e.touches[0].clientX);
        dropCurrentComponent();
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updateAim(e.touches[0].clientX);
      }
    }, { passive: true });

    // Keyboard (Arrows / Space)
    window.addEventListener('keydown', (e) => {
      const step = 24;
      const curConfig = TIERS[Game.currentTier - 1];
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        Game.dropperX = Math.max(curConfig.radius + 4, Game.dropperX - step);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        Game.dropperX = Math.min(Game.width - curConfig.radius - 4, Game.dropperX + step);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        dropCurrentComponent();
      } else if (e.key === 'b' || e.key === 'B' || e.key === 't' || e.key === 'T') {
        triggerDeskBump();
      }
    });

    Game.dom.bumpBtn.addEventListener('click', triggerDeskBump);
    Game.dom.resetQuickBtn.addEventListener('click', resetGame);
    Game.dom.restartBtn.addEventListener('click', resetGame);
  }

  // --- DANGER / GAME OVER CHECK ---
  function checkDangerAndGameOver(dt) {
    if (Game.gameOver) return;

    const allBodies = Matter.Composite.allBodies(Game.world);
    const now = performance.now();
    let hasOverflow = false;

    for (let i = 0; i < allBodies.length; i++) {
      const b = allBodies[i];
      if (b.isStatic || !b.tier) continue;

      if (now - b.spawnTime > 1200) {
        const topEdge = b.position.y - b.circleRadius;
        if (topEdge < Game.dangerY) {
          hasOverflow = true;
          break;
        }
      }
    }

    if (hasOverflow) {
      Game.dangerTimer += dt;
      Game.isDanger = true;
      if (Game.dangerTimer >= Game.maxDangerTime) {
        triggerGameOver();
      }
    } else {
      Game.dangerTimer = Math.max(0, Game.dangerTimer - dt * 1.5);
      Game.isDanger = Game.dangerTimer > 0;
    }
  }

  function triggerGameOver() {
    Game.gameOver = true;
    saveHighScore();

    const maxT = Game.highestTierAchieved;
    Game.dom.finalScore.textContent = Game.score.toLocaleString();
    Game.dom.modalBadge.textContent = `MAX: TIER ${maxT} (${TIERS[maxT - 1].name})`;
    Game.dom.modal.classList.remove('hidden');
  }

  function resetGame() {
    Game.dom.modal.classList.add('hidden');

    const allBodies = Matter.Composite.allBodies(Game.world);
    allBodies.forEach(b => {
      if (!b.isStatic) {
        Matter.Composite.remove(Game.world, b);
      }
    });

    Game.score = 0;
    Game.dangerTimer = 0;
    Game.isDanger = false;
    Game.gameOver = false;
    Game.highestTierAchieved = 1;
    Game.particles = [];
    Game.floatingTexts = [];
    Game.shockwaves = [];

    Game.dom.score.textContent = "0";
    pickNextComponents();
  }

  // --- DRAWING: NEXT PREVIEW ---
  function drawNextPreview() {
    const ctx = Game.dom.nextPreviewCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, 36, 36);
    const config = TIERS[Game.nextTier - 1];

    const scale = Math.min(16 / config.radius, 1.0);
    ctx.save();
    ctx.translate(18, 18);
    ctx.scale(scale, scale);
    renderCarterBall(ctx, 0, 0, 0, config);
    ctx.restore();
  }

  // --- CARTER PHOTO BALL RENDERING ---
  function renderCarterBall(ctx, x, y, angle, config) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const r = config.radius;
    const img = photoImages[config.tier];

    // Circular clip path for Carter photo
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.clip();
      // Draw image to cover circular ball
      ctx.drawImage(img, -r, -r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = config.color;
      ctx.fill();
    }

    // Outer sleek minimalist rim
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2.5, r * 0.07);
    ctx.strokeStyle = config.color;
    ctx.stroke();

    // Clean subtle hardware badge pill in bottom
    const badgeW = r * 1.1;
    const badgeH = Math.max(14, r * 0.28);
    const badgeY = r * 0.58;

    ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.max(8, r * 0.18)}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.name, 0, badgeY);

    // Subtle glossy reflection crescent
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, Math.PI * 1.1, Math.PI * 1.6);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.stroke();

    ctx.restore();
  }

  // --- RENDER LOOP ---
  let lastTime = performance.now();

  function renderLoop(time) {
    const dt = Math.min(33, time - lastTime);
    lastTime = time;

    checkDangerAndGameOver(dt);
    updateFX(dt);
    updateUI();

    const ctx = Game.ctx;
    ctx.save();

    // Screen Shake
    if (Game.shakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * Game.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * Game.shakeIntensity;
      ctx.translate(shakeX, shakeY);
      Game.shakeIntensity = Math.max(0, Game.shakeIntensity - 0.4);
    }

    // Clean Light Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, Game.width, Game.height);

    // Minimal grid
    ctx.strokeStyle = "rgba(0, 0, 0, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < Game.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, Game.height);
      ctx.stroke();
    }
    for (let y = 0; y < Game.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(Game.width, y);
      ctx.stroke();
    }

    // Danger line
    drawDangerLine(ctx, time);

    // Draw Physical Balls
    const allBodies = Matter.Composite.allBodies(Game.world);
    allBodies.forEach(b => {
      if (!b.isStatic && b.tier && b.config) {
        renderCarterBall(ctx, b.position.x, b.position.y, b.angle, b.config);
      }
    });

    // FX
    drawFX(ctx);

    // Dropper Aim & Preview
    if (!Game.gameOver) {
      drawDropper(ctx);
    }

    ctx.restore();

    requestAnimationFrame(renderLoop);
  }

  function drawDangerLine(ctx, time) {
    ctx.save();
    const isRed = Game.isDanger;
    ctx.strokeStyle = isRed ? "#EF4444" : "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = isRed ? 2 : 1;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(12, Game.dangerY);
    ctx.lineTo(Game.width - 12, Game.dangerY);
    ctx.stroke();
    ctx.restore();
  }

  function drawDropper(ctx) {
    ctx.save();
    const curConfig = TIERS[Game.currentTier - 1];
    const dropX = Game.dropperX;
    const dropY = Game.dropperY;

    // Subtle drop guideline
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dropX, dropY + curConfig.radius);
    ctx.lineTo(dropX, Game.height - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dropper ball preview
    renderCarterBall(ctx, dropX, dropY, 0, curConfig);

    ctx.restore();
  }

  function updateFX(dt) {
    for (let i = Game.shockwaves.length - 1; i >= 0; i--) {
      const sw = Game.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.18;
      sw.alpha -= 0.04;
      if (sw.alpha <= 0) Game.shockwaves.splice(i, 1);
    }

    for (let i = Game.particles.length - 1; i >= 0; i--) {
      const p = Game.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.alpha -= p.decay;
      if (p.alpha <= 0) Game.particles.splice(i, 1);
    }

    for (let i = Game.floatingTexts.length - 1; i >= 0; i--) {
      const ft = Game.floatingTexts[i];
      ft.y -= 1.1;
      ft.alpha -= 0.03;
      if (ft.alpha <= 0) Game.floatingTexts.splice(i, 1);
    }
  }

  function drawFX(ctx) {
    ctx.save();

    Game.shockwaves.forEach(sw => {
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    Game.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fill();
    });

    Game.floatingTexts.forEach(ft => {
      ctx.font = "bold 14px -apple-system, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
    });

    ctx.restore();
  }

  function updateUI() {
    if (!Game.dom.bumpBtn) return;
    const now = performance.now();
    const elapsed = now - Game.lastBumpTime;

    if (elapsed < Game.maxBumpCooldown) {
      Game.dom.bumpBtn.disabled = true;
      const sec = Math.ceil((Game.maxBumpCooldown - elapsed) / 1000);
      Game.dom.bumpBtn.textContent = `TAP (${sec}s)`;
    } else {
      Game.dom.bumpBtn.disabled = false;
      Game.dom.bumpBtn.textContent = "TAP";
    }
  }

})();
