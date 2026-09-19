/**
 * NEXA : CLASSIC EVOLVED
 * Modern Arcade Snake Engine (HTML5 Canvas + Web Audio API)
 */

'use strict';

/* ==========================================================================
   CONFIG & CONSTANTS
   ========================================================================== */

const CONFIG = {
  GRID_SIZE: 24, // 24x24 grid board
  BASE_TICK_MS: {
    easy: 150,
    normal: 125,
    hard: 100
  },
  MIN_TICK_MS: 58,
  SPEED_RAMP_PER_LEVEL: 4.5,
  COMBO_TIMEOUT_SEC: 3.8,
  BONUS_BASE_INTERVAL: 6, // Spawn timed bonus every ~6 foods eaten
  BONUS_DURATION_SEC: {
    easy: 11,
    normal: 9,
    hard: 7
  },
  STORAGE_KEYS: {
    HIGH_SCORE: 'nexa_high_score',
    BEST_COMBO: 'nexa_best_combo',
    HIGHEST_LEVEL: 'nexa_highest_level',
    TOTAL_GAMES: 'nexa_total_games',
    SETTINGS: 'nexa_settings'
  }
};

const POWERUP_TYPES = {
  SPEED: {
    id: 'SPEED',
    name: 'SPEED BOOST',
    symbol: '⚡',
    color: '#00f0ff',
    duration: 8
  },
  SLOW: {
    id: 'SLOW',
    name: 'SLOW MO',
    symbol: '⏱',
    color: '#39ff14',
    duration: 7
  },
  MAGNET: {
    id: 'MAGNET',
    name: 'MAGNET',
    symbol: '🧲',
    color: '#b026ff',
    duration: 8
  },
  MULTIPLIER: {
    id: 'MULTIPLIER',
    name: '2X SCORE',
    symbol: '×2',
    color: '#ffd700',
    duration: 10
  },
  GHOST: {
    id: 'GHOST',
    name: 'GHOST',
    symbol: '👻',
    color: '#00d0ff',
    duration: 6
  },
  FRENZY: {
    id: 'FRENZY',
    name: 'FRENZY',
    symbol: '🔥',
    color: '#ff7700',
    duration: 8
  }
};

/* ==========================================================================
   STORAGE MANAGER
   ========================================================================== */

class StorageManager {
  static loadStats() {
    try {
      return {
        highScore: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.HIGH_SCORE), 10) || 0,
        bestCombo: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.BEST_COMBO), 10) || 1,
        highestLevel: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.HIGHEST_LEVEL), 10) || 1,
        totalGames: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_GAMES), 10) || 0
      };
    } catch {
      return { highScore: 0, bestCombo: 1, highestLevel: 1, totalGames: 0 };
    }
  }

  static saveStats(stats) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.HIGH_SCORE, stats.highScore);
      localStorage.setItem(CONFIG.STORAGE_KEYS.BEST_COMBO, stats.bestCombo);
      localStorage.setItem(CONFIG.STORAGE_KEYS.HIGHEST_LEVEL, stats.highestLevel);
      localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_GAMES, stats.totalGames);
    } catch {
      // Ignore private browsing storage quota exceptions
    }
  }

  static loadSettings() {
    const defaults = {
      sound: true,
      music: true,
      particles: true,
      shake: true,
      reducedMotion: false,
      difficulty: 'normal'
    };
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }

  static saveSettings(settings) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Storage unavailable
    }
  }

  static resetStats() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.HIGH_SCORE);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.BEST_COMBO);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.HIGHEST_LEVEL);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.TOTAL_GAMES);
    } catch {
      // Storage unavailable
    }
  }
}

/* ==========================================================================
   AUDIO MANAGER (Pure Web Audio API Procedural Synth & Ambience)
   ========================================================================== */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.isMusicPlaying = false;
    this.ambientInterval = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.ambientStep = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 0.9 : 0, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.28 : 0, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(enabled ? 0.9 : 0, this.ctx.currentTime);
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(enabled ? 0.28 : 0, this.ctx.currentTime);
    }
    if (!enabled && this.isMusicPlaying) {
      this.stopMusic();
    } else if (enabled && !this.isMusicPlaying) {
      this.startMusic();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.3, pitchDrop = 0) {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      const t = this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq, t);
      if (pitchDrop !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchDrop), t + duration);
      }

      gain.gain.setValueAtTime(gainVal, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // Audio playback safety
    }
  }

  playClick() {
    this.playTone(850, 'triangle', 0.04, 0.2, -300);
  }

  playEatNormal() {
    if (!this.soundEnabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(520, 'sine', 0.08, 0.25);
    setTimeout(() => this.playTone(780, 'sine', 0.09, 0.3), 40);
  }

  playEatGolden() {
    if (!this.soundEnabled || !this.ctx) return;
    const notes = [587, 880, 1174, 1567];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.12, 0.35), idx * 45);
    });
  }

  playBonusSpawn() {
    if (!this.soundEnabled || !this.ctx) return;
    this.playTone(400, 'square', 0.15, 0.2, 350);
  }

  playBonusCollect(score) {
    if (!this.soundEnabled || !this.ctx) return;
    const baseFreq = score > 700 ? 660 : 440;
    [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.16, 0.28), idx * 40);
    });
  }

  playPowerUpCollect() {
    if (!this.soundEnabled || !this.ctx) return;
    [440, 554, 659, 880, 1108].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.1, 0.3), idx * 30);
    });
  }

  playCombo(multiplier) {
    if (!this.soundEnabled || !this.ctx) return;
    const freq = Math.min(1800, 320 * Math.pow(1.12, multiplier));
    this.playTone(freq, 'sine', 0.14, 0.35);
  }

  playLevelUp() {
    if (!this.soundEnabled || !this.ctx) return;
    const arpeggio = [440, 554, 659, 880, 1108, 1318];
    arpeggio.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'square', 0.15, 0.25), i * 60);
    });
  }

  playCountdown(digit) {
    if (!this.soundEnabled || !this.ctx) return;
    if (digit === 'GO!') {
      this.playTone(880, 'sine', 0.35, 0.45);
    } else {
      this.playTone(440, 'triangle', 0.12, 0.3);
    }
  }

  playSpecialEvent() {
    if (!this.soundEnabled || !this.ctx) return;
    [300, 450, 600, 900].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.14, 0.2), i * 50);
    });
  }

  playDeath() {
    if (!this.soundEnabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.55);

      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.55);

      // Noise impact layer
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(800, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(80, t + 0.25);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.25);
    } catch {
      // Fallback
      this.playTone(180, 'square', 0.4, 0.4, -140);
    }
  }

  startMusic() {
    if (!this.musicEnabled || this.isMusicPlaying || !this.ctx) return;
    this.isMusicPlaying = true;
    this.ambientStep = 0;

    const scale = [65.41, 77.78, 87.31, 98.0, 116.54, 130.81]; // Dark electro bass scale (C2, Eb2, F2, G2, Bb2, C3)
    const arpeggio = [261.63, 311.13, 392.0, 466.16];

    this.ambientInterval = setInterval(() => {
      if (!this.isMusicPlaying || !this.musicEnabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const bassFreq = scale[this.ambientStep % scale.length];
        this.ambientStep++;

        // Sub synth pulse
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, t);
        filter.frequency.exponentialRampToValueAtTime(140, t + 0.35);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(t);
        osc.stop(t + 0.4);

        // Ambient high chime on every 4th beat
        if (this.ambientStep % 4 === 0) {
          const arpOsc = this.ctx.createOscillator();
          const arpGain = this.ctx.createGain();
          arpOsc.type = 'triangle';
          const arpNote = arpeggio[(this.ambientStep / 4) % arpeggio.length];
          arpOsc.frequency.setValueAtTime(arpNote, t);

          arpGain.gain.setValueAtTime(0.08, t);
          arpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

          arpOsc.connect(arpGain);
          arpGain.connect(this.musicGain);

          arpOsc.start(t);
          arpOsc.stop(t + 0.7);
        }
      } catch {
        // Safe synth loop
      }
    }, 420);
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }
}

/* ==========================================================================
   PARTICLE SYSTEM
   ========================================================================== */

class ParticleSystem {
  constructor(maxParticles = 300) {
    this.maxParticles = maxParticles;
    this.particles = [];
  }

  reset() {
    this.particles = [];
  }

  emit(x, y, count, color, speed = 120, life = 0.5, size = 3) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const vel = (Math.random() * 0.7 + 0.3) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        size: Math.random() * size + 1.5,
        color,
        alpha: 1,
        life,
        maxLife: life
      });
    }
  }

  emitFoodCollect(x, y, color = '#00f0ff') {
    this.emit(x, y, 14, color, 140, 0.45, 3.5);
  }

  emitGoldenBurst(x, y) {
    this.emit(x, y, 24, '#ffd700', 180, 0.65, 4.5);
  }

  emitBonusBurst(x, y) {
    this.emit(x, y, 35, '#b026ff', 240, 0.8, 5.5);
    this.emit(x, y, 20, '#ffd700', 160, 0.6, 3.5);
  }

  emitPowerUpBurst(x, y, color) {
    this.emit(x, y, 22, color, 190, 0.6, 4.0);
  }

  emitDeath(segments, cellSize) {
    segments.forEach((seg, i) => {
      const px = seg.x * cellSize + cellSize * 0.5;
      const py = seg.y * cellSize + cellSize * 0.5;
      const col = i === 0 ? '#ff2a55' : (i % 2 === 0 ? '#00f0ff' : '#0088ff');
      this.emit(px, py, 6, col, 130, 0.7, 3.8);
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  draw(ctx) {
    if (this.particles.length === 0) return;
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ==========================================================================
   SNAKE
   ========================================================================== */

class Snake {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.reset();
  }

  reset() {
    const midY = Math.floor(this.gridSize / 2);
    this.segments = [
      { x: 6, y: midY },
      { x: 5, y: midY },
      { x: 4, y: midY },
      { x: 3, y: midY }
    ];
    this.prevSegments = this.segments.map(s => ({ ...s }));
    this.dir = { x: 1, y: 0 };
    this.inputQueue = [];
    this.growthPending = 0;
    this.eyePulse = 0;
  }

  queueDirection(newDir) {
    const lastDir = this.inputQueue.length > 0 
      ? this.inputQueue[this.inputQueue.length - 1] 
      : this.dir;

    // Prevent immediate 180-degree reversal
    if (lastDir.x + newDir.x === 0 && lastDir.y + newDir.y === 0) {
      return;
    }

    // Limit buffer queue to 2 inputs for instantaneous response without lag
    if (this.inputQueue.length < 2) {
      this.inputQueue.push(newDir);
    }
  }

  step() {
    this.prevSegments = this.segments.map(s => ({ ...s }));

    if (this.inputQueue.length > 0) {
      this.dir = this.inputQueue.shift();
    }

    const head = this.segments[0];
    const newHead = {
      x: head.x + this.dir.x,
      y: head.y + this.dir.y
    };

    this.segments.unshift(newHead);

    if (this.growthPending > 0) {
      this.growthPending--;
    } else {
      this.segments.pop();
    }
  }

  grow(amount = 1) {
    this.growthPending += amount;
  }

  getHead() {
    return this.segments[0];
  }

  isSelfCollision(targetHead = this.getHead()) {
    // Body collision check (skip head itself)
    for (let i = 1; i < this.segments.length; i++) {
      if (this.segments[i].x === targetHead.x && this.segments[i].y === targetHead.y) {
        return true;
      }
    }
    return false;
  }

  isWallCollision(head = this.getHead()) {
    return head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize;
  }

  occupies(x, y) {
    return this.segments.some(s => s.x === x && s.y === y);
  }

  draw(ctx, cellSize, progress, isGhostActive = false, activeColor = null) {
    if (this.segments.length === 0) return;

    ctx.save();

    // Body segments
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const cur = this.segments[i];
      const prev = this.prevSegments[i] || cur;

      // Smooth visual interpolation between ticks
      const ix = prev.x + (cur.x - prev.x) * progress;
      const iy = prev.y + (cur.y - prev.y) * progress;

      const px = ix * cellSize;
      const py = iy * cellSize;
      const cx = px + cellSize * 0.5;
      const cy = py + cellSize * 0.5;

      const radius = i === 0 ? cellSize * 0.44 : cellSize * 0.38;

      if (i === 0) {
        // Head rendering
        const headColor = activeColor || '#00f0ff';
        ctx.shadowBlur = isGhostActive ? 22 : 14;
        ctx.shadowColor = headColor;
        ctx.fillStyle = isGhostActive ? 'rgba(0, 240, 255, 0.7)' : headColor;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Directional Cyber Eyes
        const eyeOffset = radius * 0.42;
        const forwardOffset = radius * 0.28;
        const perpX = -this.dir.y;
        const perpY = this.dir.x;

        const eye1X = cx + this.dir.x * forwardOffset + perpX * eyeOffset;
        const eye1Y = cy + this.dir.y * forwardOffset + perpY * eyeOffset;
        const eye2X = cx + this.dir.x * forwardOffset - perpX * eyeOffset;
        const eye2Y = cy + this.dir.y * forwardOffset - perpY * eyeOffset;

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, radius * 0.22, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, radius * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Pupil / Iris glow
        ctx.fillStyle = '#060812';
        ctx.beginPath();
        ctx.arc(eye1X + this.dir.x * 0.8, eye1Y + this.dir.y * 0.8, radius * 0.1, 0, Math.PI * 2);
        ctx.arc(eye2X + this.dir.x * 0.8, eye2Y + this.dir.y * 0.8, radius * 0.1, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Body segment rendering with gradient taper
        const t = i / this.segments.length;
        const r = Math.round(0 * (1 - t) + 0 * t);
        const g = Math.round(240 * (1 - t) + 120 * t);
        const b = Math.round(255 * (1 - t) + 220 * t);
        const bodyColor = activeColor || `rgb(${r}, ${g}, ${b})`;

        ctx.shadowBlur = isGhostActive ? 12 : 6;
        ctx.shadowColor = bodyColor;
        ctx.fillStyle = isGhostActive ? 'rgba(0, 240, 255, 0.45)' : bodyColor;

        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1 - t * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

/* ==========================================================================
   FOOD & TIMED BONUS MANAGER
   ========================================================================== */

class FoodManager {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.normalFood = null;
    this.goldenFood = null;
    this.timedBonus = null;
    this.pulseAngle = 0;
  }

  reset() {
    this.normalFood = null;
    this.goldenFood = null;
    this.timedBonus = null;
    this.pulseAngle = 0;
  }

  getValidPosition(isOccupiedFn) {
    let attempts = 0;
    while (attempts < 200) {
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);
      if (!isOccupiedFn(x, y)) {
        return { x, y };
      }
      attempts++;
    }
    // Fallback linear scan
    for (let x = 1; x < this.gridSize - 1; x++) {
      for (let y = 1; y < this.gridSize - 1; y++) {
        if (!isOccupiedFn(x, y)) return { x, y };
      }
    }
    return { x: 2, y: 2 };
  }

  spawnNormal(isOccupiedFn) {
    const pos = this.getValidPosition(isOccupiedFn);
    this.normalFood = { x: pos.x, y: pos.y, type: 'normal' };
  }

  spawnGolden(isOccupiedFn) {
    const pos = this.getValidPosition(isOccupiedFn);
    this.goldenFood = { x: pos.x, y: pos.y, type: 'golden' };
  }

  spawnTimedBonus(isOccupiedFn, durationSec) {
    const pos = this.getValidPosition(isOccupiedFn);
    this.timedBonus = {
      x: pos.x,
      y: pos.y,
      type: 'bonus',
      timeLeft: durationSec,
      maxDuration: durationSec,
      tickAccumulator: 0
    };
  }

  update(dt, onBonusExpiredFn, onBonusTickFn) {
    this.pulseAngle += dt * 4;

    if (this.timedBonus) {
      this.timedBonus.timeLeft -= dt;
      this.timedBonus.tickAccumulator += dt;

      // Pulse audio tick faster as timer runs out
      const pulseRate = Math.max(0.25, this.timedBonus.timeLeft / this.timedBonus.maxDuration);
      if (this.timedBonus.tickAccumulator >= pulseRate) {
        this.timedBonus.tickAccumulator = 0;
        if (onBonusTickFn) onBonusTickFn();
      }

      if (this.timedBonus.timeLeft <= 0) {
        this.timedBonus = null;
        if (onBonusExpiredFn) onBonusExpiredFn();
      }
    }
  }

  draw(ctx, cellSize) {
    // Normal food (Cyan/Green neon orb)
    if (this.normalFood) {
      const cx = this.normalFood.x * cellSize + cellSize * 0.5;
      const cy = this.normalFood.y * cellSize + cellSize * 0.5;
      const pulse = Math.sin(this.pulseAngle) * 1.5;
      const radius = cellSize * 0.32 + pulse;

      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Golden Food (Pulsing high shine gold diamond)
    if (this.goldenFood) {
      const cx = this.goldenFood.x * cellSize + cellSize * 0.5;
      const cy = this.goldenFood.y * cellSize + cellSize * 0.5;
      const pulse = Math.sin(this.pulseAngle * 1.5) * 2;
      const size = cellSize * 0.42 + pulse;

      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffd700';
      ctx.fillStyle = '#ffd700';

      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size, cy);
      ctx.lineTo(cx, cy + size);
      ctx.lineTo(cx - size, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Nokia Snake II Timed Bonus (Urgent circular countdown ring + morphing core)
    if (this.timedBonus) {
      const cx = this.timedBonus.x * cellSize + cellSize * 0.5;
      const cy = this.timedBonus.y * cellSize + cellSize * 0.5;
      const progress = Math.max(0, this.timedBonus.timeLeft / this.timedBonus.maxDuration);
      const urgency = 1 - progress;
      const pulse = Math.sin(this.pulseAngle * (4 + urgency * 8)) * 2;
      const radius = cellSize * 0.4 + pulse;

      ctx.save();
      // Outer Countdown Ring
      ctx.strokeStyle = '#b026ff';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#b026ff';
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.46, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress, false);
      ctx.stroke();

      // Pulsing Glowing Center Core
      ctx.fillStyle = urgency > 0.7 ? '#ff2a55' : '#b026ff';
      ctx.shadowBlur = 18;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Inner white star/sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ==========================================================================
   POWER-UP MANAGER
   ========================================================================== */

class PowerUpManager {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.groundPowerUp = null; // Power-up resting on grid awaiting pickup
    this.activePowerUps = new Map(); // id -> { type, timeLeft, maxDuration }
  }

  reset() {
    this.groundPowerUp = null;
    this.activePowerUps.clear();
  }

  spawn(isOccupiedFn) {
    if (this.groundPowerUp) return;

    const types = Object.values(POWERUP_TYPES);
    const selectedType = types[Math.floor(Math.random() * types.length)];

    let attempts = 0;
    while (attempts < 200) {
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);
      if (!isOccupiedFn(x, y)) {
        this.groundPowerUp = {
          x,
          y,
          type: selectedType,
          groundTimeLeft: 12
        };
        break;
      }
      attempts++;
    }
  }

  activate(powerUpType) {
    this.activePowerUps.set(powerUpType.id, {
      type: powerUpType,
      timeLeft: powerUpType.duration,
      maxDuration: powerUpType.duration
    });
  }

  isActive(id) {
    return this.activePowerUps.has(id);
  }

  update(dt, snakeHead, foodManager) {
    // Ground item countdown
    if (this.groundPowerUp) {
      this.groundPowerUp.groundTimeLeft -= dt;
      if (this.groundPowerUp.groundTimeLeft <= 0) {
        this.groundPowerUp = null;
      }
    }

    // Active power-up countdowns
    for (const [id, pu] of this.activePowerUps.entries()) {
      pu.timeLeft -= dt;
      if (pu.timeLeft <= 0) {
        this.activePowerUps.delete(id);
      }
    }

    // Magnet mechanics: pulls nearby food gradually toward head
    if (this.isActive('MAGNET') && snakeHead) {
      const pullItem = (item) => {
        if (!item) return;
        const dx = snakeHead.x - item.x;
        const dy = snakeHead.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < 6) {
          if (Math.random() < 0.25) {
            item.x += Math.sign(dx);
            item.y += Math.sign(dy);
          }
        }
      };
      pullItem(foodManager.normalFood);
      pullItem(foodManager.goldenFood);
      pullItem(foodManager.timedBonus);
    }
  }

  draw(ctx, cellSize, pulseAngle) {
    if (!this.groundPowerUp) return;

    const pu = this.groundPowerUp;
    const cx = pu.x * cellSize + cellSize * 0.5;
    const cy = pu.y * cellSize + cellSize * 0.5;
    const pulse = Math.sin(pulseAngle * 3) * 2;
    const radius = cellSize * 0.4 + pulse;

    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = pu.type.color;
    ctx.fillStyle = 'rgba(12, 16, 32, 0.9)';
    ctx.strokeStyle = pu.type.color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Render power-up glyph
    ctx.font = `${Math.floor(cellSize * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pu.type.color;
    ctx.fillText(pu.type.symbol, cx, cy);
    ctx.restore();
  }
}

/* ==========================================================================
   OBSTACLE MANAGER
   ========================================================================== */

class ObstacleManager {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.obstacles = new Set();
  }

  reset() {
    this.obstacles.clear();
  }

  key(x, y) {
    return `${x},${y}`;
  }

  has(x, y) {
    return this.obstacles.has(this.key(x, y));
  }

  buildLevel(level, difficulty) {
    this.obstacles.clear();
    if (level <= 1) return; // Level 1 is obstacle-free

    const N = this.gridSize;
    const addBlock = (x, y) => {
      // Keep initial snake spawn corridor clean
      if (y >= Math.floor(N / 2) - 2 && y <= Math.floor(N / 2) + 2 && x <= 8) return;
      this.obstacles.add(this.key(x, y));
    };

    // Level 2: 4 Corner blocks
    if (level >= 2) {
      const corners = [
        [3, 3], [3, 4], [4, 3],
        [N - 4, 3], [N - 4, 4], [N - 5, 3],
        [3, N - 4], [3, N - 5], [4, N - 4],
        [N - 4, N - 4], [N - 4, N - 5], [N - 5, N - 4]
      ];
      corners.forEach(([x, y]) => addBlock(x, y));
    }

    // Level 3: Center pillar structures
    if (level >= 3) {
      const mid = Math.floor(N / 2);
      addBlock(mid - 1, mid - 1);
      addBlock(mid, mid - 1);
      addBlock(mid - 1, mid);
      addBlock(mid, mid);
    }

    // Level 4: Barrier slits
    if (level >= 4) {
      const q1 = Math.floor(N * 0.25);
      const q3 = Math.floor(N * 0.75);
      for (let y = 6; y < N - 6; y++) {
        if (y % 4 !== 0) {
          addBlock(q1, y);
          addBlock(q3, y);
        }
      }
    }

    // Level 5+: Symmetrical labyrinth walls on hard difficulty
    if (level >= 5 && difficulty !== 'easy') {
      const mid = Math.floor(N / 2);
      for (let x = 6; x < N - 6; x++) {
        if (x !== mid && x !== mid - 1) {
          addBlock(x, 6);
          addBlock(x, N - 7);
        }
      }
    }
  }

  draw(ctx, cellSize) {
    if (this.obstacles.size === 0) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 42, 85, 0.22)';
    ctx.strokeStyle = '#ff2a55';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255, 42, 85, 0.4)';

    for (const key of this.obstacles) {
      const [x, y] = key.split(',').map(Number);
      const px = x * cellSize + 2;
      const py = y * cellSize + 2;
      const size = cellSize - 4;

      ctx.fillRect(px, py, size, size);
      ctx.strokeRect(px, py, size, size);

      // Cyber hazard inner pattern
      ctx.beginPath();
      ctx.moveTo(px, py + size);
      ctx.lineTo(px + size, py);
      ctx.strokeStyle = 'rgba(255, 42, 85, 0.45)';
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ==========================================================================
   INPUT MANAGER
   ========================================================================== */

class InputManager {
  constructor(onDirectionChange, onPauseToggle, onStartConfirm) {
    this.onDirectionChange = onDirectionChange;
    this.onPauseToggle = onPauseToggle;
    this.onStartConfirm = onStartConfirm;

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;

    this.bindEvents();
  }

  bindEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      // Prevent browser scrolling on gaming keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.onDirectionChange({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.onDirectionChange({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.onDirectionChange({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.onDirectionChange({ x: 1, y: 0 });
          break;
        case 'p':
        case 'P':
        case 'Escape':
          this.onPauseToggle();
          break;
        case 'Enter':
        case ' ':
          this.onStartConfirm();
          break;
      }
    });

    // Touch Swipe inputs on canvas
    const canvas = document.getElementById('game-canvas');

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = performance.now();
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      // Prevent screen pulling/scrolling during game swipe
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 0) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - this.touchStartX;
      const dy = endY - this.touchStartY;
      const elapsed = performance.now() - this.touchStartTime;

      const minSwipeDistance = 22;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > minSwipeDistance && elapsed < 450) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.onDirectionChange(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
        } else {
          this.onDirectionChange(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
        }
      }
    }, { passive: true });

    // Mobile Virtual D-Pad
    document.querySelectorAll('.dpad-btn').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const dir = btn.dataset.dir;
        if (dir === 'UP') this.onDirectionChange({ x: 0, y: -1 });
        if (dir === 'DOWN') this.onDirectionChange({ x: 0, y: 1 });
        if (dir === 'LEFT') this.onDirectionChange({ x: -1, y: 0 });
        if (dir === 'RIGHT') this.onDirectionChange({ x: 1, y: 0 });
      });
    });
  }
}

/* ==========================================================================
   UI MANAGER
   ========================================================================== */

class UIManager {
  constructor() {
    this.hudScore = document.getElementById('hud-score');
    this.hudHighScore = document.getElementById('hud-high-score');
    this.hudLevel = document.getElementById('hud-level');
    this.hudComboText = document.getElementById('hud-combo-text');
    this.hudComboFill = document.getElementById('hud-combo-fill');
    this.hudComboCard = document.getElementById('hud-combo-card');
    this.powerupsList = document.getElementById('active-powerups-list');
    this.bonusIndicator = document.getElementById('active-bonus-indicator');
    this.bonusTimerText = document.getElementById('bonus-timer-text');

    this.viewport = document.getElementById('viewport');
    this.floatingTextLayer = document.getElementById('floating-text-layer');
    this.eventBanner = document.getElementById('event-banner');
    this.eventBannerTitle = document.getElementById('event-banner-title');
    this.levelUpBanner = document.getElementById('level-up-banner');
    this.levelUpNum = document.getElementById('level-up-num');

    // Screens
    this.screenMenu = document.getElementById('screen-menu');
    this.screenCountdown = document.getElementById('screen-countdown');
    this.screenPause = document.getElementById('screen-pause');
    this.screenGameOver = document.getElementById('screen-gameover');
    this.screenSettings = document.getElementById('screen-settings');
    this.screenControls = document.getElementById('screen-controls');

    this.countdownDigit = document.getElementById('countdown-digit');

    // Menu stats
    this.menuHighScore = document.getElementById('menu-high-score');
    this.menuTotalGames = document.getElementById('menu-total-games');
    this.menuHighestLevel = document.getElementById('menu-highest-level');
    this.menuBestCombo = document.getElementById('menu-best-combo');

    // Game over stats
    this.goFinalScore = document.getElementById('gameover-final-score');
    this.goLevel = document.getElementById('gameover-level');
    this.goLength = document.getElementById('gameover-length');
    this.goCombo = document.getElementById('gameover-combo');
    this.goTime = document.getElementById('gameover-time');
    this.goNewHigh = document.getElementById('gameover-new-high');

    // Settings inputs
    this.settingSound = document.getElementById('setting-sound');
    this.settingMusic = document.getElementById('setting-music');
    this.settingParticles = document.getElementById('setting-particles');
    this.settingShake = document.getElementById('setting-shake');
    this.settingReducedMotion = document.getElementById('setting-reduced-motion');
    this.difficultyBtns = document.querySelectorAll('.segment-btn');

    this.eventTimer = null;
    this.levelUpTimer = null;
  }

  formatNumber(n) {
    return n.toLocaleString();
  }

  updateHUD(score, highScore, level, comboMultiplier, comboTimeRatio) {
    this.hudScore.textContent = this.formatNumber(score);
    this.hudHighScore.textContent = this.formatNumber(highScore);
    this.hudLevel.textContent = String(level).padStart(2, '0');

    this.hudComboText.textContent = `x${comboMultiplier}`;
    this.hudComboFill.style.width = `${Math.max(0, Math.min(100, comboTimeRatio * 100))}%`;

    if (comboMultiplier > 1) {
      this.hudComboText.classList.add('bump');
      setTimeout(() => this.hudComboText.classList.remove('bump'), 150);
    }
  }

  updateActivePowerUps(powerupsMap) {
    this.powerupsList.innerHTML = '';
    for (const pu of powerupsMap.values()) {
      const pill = document.createElement('div');
      pill.className = 'powerup-pill';
      pill.style.setProperty('--powerup-color', pu.type.color);
      pill.innerHTML = `<span>${pu.type.symbol} ${pu.type.name}</span> <span class="time-left">${pu.timeLeft.toFixed(1)}s</span>`;
      this.powerupsList.appendChild(pill);
    }
  }

  updateBonusIndicator(timedBonus) {
    if (timedBonus) {
      this.bonusIndicator.classList.add('active');
      this.bonusTimerText.textContent = `${timedBonus.timeLeft.toFixed(1)}s`;
    } else {
      this.bonusIndicator.classList.remove('active');
    }
  }

  showFloatingText(text, x, y, color = '#00f0ff') {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;

    this.floatingTextLayer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 850);
  }

  triggerScreenShake() {
    this.viewport.classList.remove('shake');
    void this.viewport.offsetWidth;
    this.viewport.classList.add('shake');
  }

  triggerScreenFlash() {
    this.viewport.classList.remove('flash');
    void this.viewport.offsetWidth;
    this.viewport.classList.add('flash');
  }

  showLevelUp(level) {
    this.levelUpNum.textContent = `LEVEL ${String(level).padStart(2, '0')}`;
    this.levelUpBanner.classList.add('active');
    clearTimeout(this.levelUpTimer);
    this.levelUpTimer = setTimeout(() => {
      this.levelUpBanner.classList.remove('active');
    }, 1800);
  }

  showSpecialEvent(title) {
    this.eventBannerTitle.textContent = title;
    this.eventBanner.classList.add('active');
    clearTimeout(this.eventTimer);
    this.eventTimer = setTimeout(() => {
      this.eventBanner.classList.remove('active');
    }, 2800);
  }

  showScreen(screenEl) {
    const screens = [
      this.screenMenu,
      this.screenCountdown,
      this.screenPause,
      this.screenGameOver,
      this.screenSettings,
      this.screenControls
    ];
    screens.forEach(s => {
      if (s === screenEl) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  hideAllScreens() {
    [
      this.screenMenu,
      this.screenCountdown,
      this.screenPause,
      this.screenGameOver,
      this.screenSettings,
      this.screenControls
    ].forEach(s => s.classList.remove('active'));
  }

  setCountdownDigit(digit) {
    this.countdownDigit.textContent = digit;
  }

  renderMenuStats(stats) {
    this.menuHighScore.textContent = this.formatNumber(stats.highScore);
    this.menuTotalGames.textContent = this.formatNumber(stats.totalGames);
    this.menuHighestLevel.textContent = String(stats.highestLevel);
    this.menuBestCombo.textContent = `x${stats.bestCombo}`;
  }

  renderGameOver(score, level, length, combo, timeFormatted, isNewHigh) {
    this.goFinalScore.textContent = this.formatNumber(score);
    this.goLevel.textContent = String(level).padStart(2, '0');
    this.goLength.textContent = String(length);
    this.goCombo.textContent = `x${combo}`;
    this.goTime.textContent = timeFormatted;

    if (isNewHigh) {
      this.goNewHigh.classList.add('active');
    } else {
      this.goNewHigh.classList.remove('active');
    }
  }
}

/* ==========================================================================
   GAME (Main Engine & State Machine)
   ========================================================================== */

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.stats = StorageManager.loadStats();
    this.settings = StorageManager.loadSettings();

    this.audio = new AudioManager();
    this.audio.setSoundEnabled(this.settings.sound);
    this.audio.setMusicEnabled(this.settings.music);

    this.particles = new ParticleSystem();
    this.snake = new Snake(CONFIG.GRID_SIZE);
    this.foodManager = new FoodManager(CONFIG.GRID_SIZE);
    this.powerUpManager = new PowerUpManager(CONFIG.GRID_SIZE);
    this.obstacleManager = new ObstacleManager(CONFIG.GRID_SIZE);
    this.ui = new UIManager();

    this.state = 'MENU'; // MENU | COUNTDOWN | PLAYING | PAUSED | GAME_OVER
    this.score = 0;
    this.level = 1;
    this.foodCount = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestRunCombo = 1;
    this.gameTimeSeconds = 0;

    this.tickInterval = CONFIG.BASE_TICK_MS[this.settings.difficulty] || 125;
    this.tickAccumulator = 0;
    this.lastFrameTime = performance.now();
    this.activeEventMultiplier = 1;

    this.ambientMotes = Array.from({ length: 28 }, () => ({
      x: Math.random() * 600,
      y: Math.random() * 600,
      speedY: -(Math.random() * 12 + 6),
      speedX: (Math.random() - 0.5) * 6,
      size: Math.random() * 1.8 + 0.8,
      alpha: Math.random() * 0.28 + 0.08
    }));

    this.setupDisplay();
    this.bindDOM();
    this.input = new InputManager(
      (dir) => this.handleDirectionInput(dir),
      () => this.togglePause(),
      () => this.handleConfirmInput()
    );

    this.applySettingsToDOM();
    this.ui.renderMenuStats(this.stats);

    // Start RAF Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupDisplay() {
    const resize = () => {
      const viewport = document.getElementById('viewport');
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.canvasScale = dpr;
      this.cellSize = (this.canvas.width / CONFIG.GRID_SIZE);
    };

    window.addEventListener('resize', resize);
    resize();
  }

  applySettingsToDOM() {
    this.ui.settingSound.checked = this.settings.sound;
    this.ui.settingMusic.checked = this.settings.music;
    this.ui.settingParticles.checked = this.settings.particles;
    this.ui.settingShake.checked = this.settings.shake;
    this.ui.settingReducedMotion.checked = this.settings.reducedMotion;

    if (this.settings.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    this.ui.difficultyBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === this.settings.difficulty);
    });
  }

  bindDOM() {
    const unlockAudio = () => this.audio.resume();
    ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, unlockAudio, { once: true });
    });

    // Menu Actions
    document.getElementById('btn-play').addEventListener('click', () => {
      this.audio.playClick();
      this.startCountdown();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showScreen(this.ui.screenSettings);
    });

    document.getElementById('btn-controls').addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showScreen(this.ui.screenControls);
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showScreen(this.ui.screenMenu);
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showScreen(this.ui.screenMenu);
    });

    document.getElementById('btn-close-controls').addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showScreen(this.ui.screenMenu);
    });

    document.getElementById('btn-controls-done').addEventListener('click', () => {
      this.audio.playClick();
      this.ui.showScreen(this.ui.screenMenu);
    });

    // Pause Controls
    document.getElementById('btn-pause-toggle').addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.audio.playClick();
      this.resumeGame();
    });

    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      this.audio.playClick();
      this.startCountdown();
    });

    document.getElementById('btn-menu-pause').addEventListener('click', () => {
      this.audio.playClick();
      this.returnToMenu();
    });

    // Game Over Controls
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.audio.playClick();
      this.startCountdown();
    });

    document.getElementById('btn-menu-gameover').addEventListener('click', () => {
      this.audio.playClick();
      this.returnToMenu();
    });

    // Settings switches
    this.ui.settingSound.addEventListener('change', (e) => {
      this.settings.sound = e.target.checked;
      this.audio.setSoundEnabled(this.settings.sound);
      StorageManager.saveSettings(this.settings);
    });

    this.ui.settingMusic.addEventListener('change', (e) => {
      this.settings.music = e.target.checked;
      this.audio.setMusicEnabled(this.settings.music);
      StorageManager.saveSettings(this.settings);
    });

    this.ui.settingParticles.addEventListener('change', (e) => {
      this.settings.particles = e.target.checked;
      StorageManager.saveSettings(this.settings);
    });

    this.ui.settingShake.addEventListener('change', (e) => {
      this.settings.shake = e.target.checked;
      StorageManager.saveSettings(this.settings);
    });

    this.ui.settingReducedMotion.addEventListener('change', (e) => {
      this.settings.reducedMotion = e.target.checked;
      document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
      StorageManager.saveSettings(this.settings);
    });

    this.ui.difficultyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playClick();
        this.settings.difficulty = btn.dataset.diff;
        this.ui.difficultyBtns.forEach(b => b.classList.toggle('active', b === btn));
        StorageManager.saveSettings(this.settings);
      });
    });

    document.getElementById('btn-reset-stats').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all high scores and game statistics?')) {
        StorageManager.resetStats();
        this.stats = StorageManager.loadStats();
        this.ui.renderMenuStats(this.stats);
        this.ui.updateHUD(0, 0, 1, 1, 0);
      }
    });
  }

  handleDirectionInput(dir) {
    if (this.state === 'PLAYING') {
      this.snake.queueDirection(dir);
    }
  }

  handleConfirmInput() {
    if (this.state === 'MENU' || this.state === 'GAME_OVER') {
      this.startCountdown();
    } else if (this.state === 'PAUSED') {
      this.resumeGame();
    }
  }

  startCountdown() {
    this.resetGameplayState();
    this.state = 'COUNTDOWN';
    this.ui.showScreen(this.ui.screenCountdown);

    let count = 3;
    this.ui.setCountdownDigit(count);
    this.audio.playCountdown(count);

    const countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.ui.setCountdownDigit(count);
        this.audio.playCountdown(count);
      } else if (count === 0) {
        this.ui.setCountdownDigit('GO!');
        this.audio.playCountdown('GO!');
      } else {
        clearInterval(countdownTimer);
        this.state = 'PLAYING';
        this.ui.hideAllScreens();
        this.audio.startMusic();
        this.lastFrameTime = performance.now();
      }
    }, 850);
  }

  resetGameplayState() {
    this.score = 0;
    this.level = 1;
    this.foodCount = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.bestRunCombo = 1;
    this.gameTimeSeconds = 0;
    this.activeEventMultiplier = 1;

    this.tickInterval = CONFIG.BASE_TICK_MS[this.settings.difficulty] || 125;
    this.tickAccumulator = 0;

    this.snake.reset();
    this.foodManager.reset();
    this.powerUpManager.reset();
    this.obstacleManager.reset();
    this.particles.reset();

    const isOccupied = (x, y) => this.isCellOccupied(x, y);
    this.foodManager.spawnNormal(isOccupied);

    this.ui.updateHUD(0, this.stats.highScore, 1, 1, 0);
    this.ui.updateActivePowerUps(this.powerUpManager.activePowerUps);
    this.ui.updateBonusIndicator(null);
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.audio.stopMusic();
      this.ui.showScreen(this.ui.screenPause);
    } else if (this.state === 'PAUSED') {
      this.resumeGame();
    }
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.ui.hideAllScreens();
    this.audio.startMusic();
    this.lastFrameTime = performance.now();
  }

  returnToMenu() {
    this.state = 'MENU';
    this.audio.stopMusic();
    this.ui.renderMenuStats(this.stats);
    this.ui.showScreen(this.ui.screenMenu);
  }

  isCellOccupied(x, y) {
    if (this.snake.occupies(x, y)) return true;
    if (this.obstacleManager.has(x, y)) return true;
    if (this.foodManager.normalFood && this.foodManager.normalFood.x === x && this.foodManager.normalFood.y === y) return true;
    if (this.foodManager.goldenFood && this.foodManager.goldenFood.x === x && this.foodManager.goldenFood.y === y) return true;
    if (this.foodManager.timedBonus && this.foodManager.timedBonus.x === x && this.foodManager.timedBonus.y === y) return true;
    if (this.powerUpManager.groundPowerUp && this.powerUpManager.groundPowerUp.x === x && this.powerUpManager.groundPowerUp.y === y) return true;
    return false;
  }

  checkLevelProgression() {
    const targetScore = this.level * 450;
    if (this.score >= targetScore) {
      this.level++;
      this.audio.playLevelUp();
      this.ui.showLevelUp(this.level);

      // Increase movement speed smoothly
      const baseTick = CONFIG.BASE_TICK_MS[this.settings.difficulty] || 125;
      this.tickInterval = Math.max(CONFIG.MIN_TICK_MS, baseTick - (this.level - 1) * CONFIG.SPEED_RAMP_PER_LEVEL);

      // Build obstacles based on new level
      this.obstacleManager.buildLevel(this.level, this.settings.difficulty);

      // Trigger occasional special event
      this.maybeTriggerSpecialEvent();
    }
  }

  maybeTriggerSpecialEvent() {
    const events = ['FOOD FRENZY', '2X SCORE', 'TIME RUSH', 'GOLDEN RUSH'];
    const chosen = events[Math.floor(Math.random() * events.length)];
    this.ui.showSpecialEvent(chosen);
    this.audio.playSpecialEvent();

    const isOccupied = (x, y) => this.isCellOccupied(x, y);

    if (chosen === 'FOOD FRENZY') {
      this.foodManager.spawnGolden(isOccupied);
      this.foodManager.spawnTimedBonus(isOccupied, CONFIG.BONUS_DURATION_SEC[this.settings.difficulty]);
    } else if (chosen === '2X SCORE') {
      this.activeEventMultiplier = 2;
      setTimeout(() => { this.activeEventMultiplier = 1; }, 12000);
    } else if (chosen === 'TIME RUSH') {
      this.foodManager.spawnTimedBonus(isOccupied, CONFIG.BONUS_DURATION_SEC[this.settings.difficulty]);
      this.powerUpManager.spawn(isOccupied);
    } else if (chosen === 'GOLDEN RUSH') {
      this.foodManager.spawnGolden(isOccupied);
    }
  }

  awardScore(basePoints, displayX, displayY, color = '#00f0ff') {
    let multiplier = this.combo * this.activeEventMultiplier;
    if (this.powerUpManager.isActive('MULTIPLIER')) {
      multiplier *= 2;
    }

    const totalPoints = basePoints * multiplier;
    this.score += totalPoints;

    // Show floating score on canvas
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvasScale || 1;
    const screenX = (displayX / dpr) * (rect.width / (this.canvas.width / dpr));
    const screenY = (displayY / dpr) * (rect.height / (this.canvas.height / dpr));

    const text = multiplier > 1 ? `+${totalPoints} (${multiplier}x)` : `+${totalPoints}`;
    this.ui.showFloatingText(text, screenX, screenY, color);

    this.checkLevelProgression();
  }

  handleEatNormal(food) {
    this.audio.playEatNormal();
    this.snake.grow(1);
    this.foodCount++;

    const px = food.x * this.cellSize + this.cellSize * 0.5;
    const py = food.y * this.cellSize + this.cellSize * 0.5;

    if (this.settings.particles) {
      this.particles.emitFoodCollect(px, py, '#00f0ff');
    }

    this.awardScore(10, px, py, '#00f0ff');
    this.incrementCombo();

    const isOccupied = (x, y) => this.isCellOccupied(x, y);

    // Spawn new normal food
    this.foodManager.spawnNormal(isOccupied);

    // Rare chance to spawn Golden Food
    if (Math.random() < 0.18 && !this.foodManager.goldenFood) {
      this.foodManager.spawnGolden(isOccupied);
    }

    // Spawn Timed Bonus on regular cadence
    if (this.foodCount % CONFIG.BONUS_BASE_INTERVAL === 0 && !this.foodManager.timedBonus) {
      this.foodManager.spawnTimedBonus(isOccupied, CONFIG.BONUS_DURATION_SEC[this.settings.difficulty]);
      this.audio.playBonusSpawn();
    }

    // Rare chance to spawn Power-Up
    if (Math.random() < 0.14) {
      this.powerUpManager.spawn(isOccupied);
    }
  }

  handleEatGolden(food) {
    this.audio.playEatGolden();
    this.snake.grow(2);

    const px = food.x * this.cellSize + this.cellSize * 0.5;
    const py = food.y * this.cellSize + this.cellSize * 0.5;

    if (this.settings.particles) {
      this.particles.emitGoldenBurst(px, py);
    }

    this.awardScore(50, px, py, '#ffd700');
    this.incrementCombo();
    this.foodManager.goldenFood = null;
  }

  handleEatTimedBonus(bonus) {
    const progress = Math.max(0, bonus.timeLeft / bonus.maxDuration);
    // Nokia Snake II Dynamic Score scaling: 250 to 1000
    const dynamicScore = Math.round(250 + 750 * progress);

    this.audio.playBonusCollect(dynamicScore);
    this.snake.grow(3);

    const px = bonus.x * this.cellSize + this.cellSize * 0.5;
    const py = bonus.y * this.cellSize + this.cellSize * 0.5;

    if (this.settings.particles) {
      this.particles.emitBonusBurst(px, py);
    }

    if (this.settings.shake) {
      this.ui.triggerScreenShake();
    }
    this.ui.triggerScreenFlash();

    this.awardScore(dynamicScore, px, py, '#b026ff');
    this.incrementCombo();
    this.foodManager.timedBonus = null;
  }

  handleCollectPowerUp(groundPU) {
    this.audio.playPowerUpCollect();
    this.powerUpManager.activate(groundPU.type);

    const px = groundPU.x * this.cellSize + this.cellSize * 0.5;
    const py = groundPU.y * this.cellSize + this.cellSize * 0.5;

    if (this.settings.particles) {
      this.particles.emitPowerUpBurst(px, py, groundPU.type.color);
    }

    this.awardScore(25, px, py, groundPU.type.color);
    this.powerUpManager.groundPowerUp = null;

    // Frenzy activates immediate multiple foods
    if (groundPU.type.id === 'FRENZY') {
      const isOccupied = (x, y) => this.isCellOccupied(x, y);
      this.foodManager.spawnGolden(isOccupied);
    }
  }

  incrementCombo() {
    this.combo++;
    this.comboTimer = CONFIG.COMBO_TIMEOUT_SEC;
    if (this.combo > this.bestRunCombo) {
      this.bestRunCombo = this.combo;
    }
    this.audio.playCombo(this.combo);
  }

  gameOver() {
    this.state = 'GAME_OVER';
    this.audio.stopMusic();
    this.audio.playDeath();

    if (this.settings.shake) {
      this.ui.triggerScreenShake();
    }
    this.ui.triggerScreenFlash();

    if (this.settings.particles) {
      this.particles.emitDeath(this.snake.segments, this.cellSize);
    }

    // Persist records
    let isNewHigh = false;
    if (this.score > this.stats.highScore) {
      this.stats.highScore = this.score;
      isNewHigh = true;
    }
    if (this.bestRunCombo > this.stats.bestCombo) {
      this.stats.bestCombo = this.bestRunCombo;
    }
    if (this.level > this.stats.highestLevel) {
      this.stats.highestLevel = this.level;
    }
    this.stats.totalGames++;
    StorageManager.saveStats(this.stats);

    const minutes = Math.floor(this.gameTimeSeconds / 60);
    const seconds = Math.floor(this.gameTimeSeconds % 60);
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    setTimeout(() => {
      this.ui.renderGameOver(
        this.score,
        this.level,
        this.snake.segments.length,
        this.bestRunCombo,
        timeFormatted,
        isNewHigh
      );
      this.ui.showScreen(this.ui.screenGameOver);
    }, 650);
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.gameTimeSeconds += dt;

    // Power-up durations & magnet
    this.powerUpManager.update(dt, this.snake.getHead(), this.foodManager);
    this.ui.updateActivePowerUps(this.powerUpManager.activePowerUps);

    // Food timers & animations
    this.foodManager.update(
      dt,
      () => {}, // Bonus expired
      () => this.audio.playTone(320, 'sine', 0.05, 0.1) // Bonus urgent tick
    );
    this.ui.updateBonusIndicator(this.foodManager.timedBonus);

    // Combo countdown
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }
    const comboRatio = this.comboTimer / CONFIG.COMBO_TIMEOUT_SEC;
    this.ui.updateHUD(this.score, this.stats.highScore, this.level, this.combo, comboRatio);

    // Dynamic speed modifier from power-ups
    let speedMod = 1.0;
    if (this.powerUpManager.isActive('SPEED')) speedMod *= 0.68;
    if (this.powerUpManager.isActive('SLOW')) speedMod *= 1.5;

    const currentTickMs = this.tickInterval * speedMod;

    // Snake movement step
    this.tickAccumulator += dt * 1000;
    while (this.tickAccumulator >= currentTickMs) {
      this.tickAccumulator -= currentTickMs;
      this.stepSnake();
    }
  }

  stepSnake() {
    this.snake.step();
    const head = this.snake.getHead();

    // Wall collision
    if (this.snake.isWallCollision(head)) {
      this.gameOver();
      return;
    }

    // Self collision
    if (this.snake.isSelfCollision(head)) {
      this.gameOver();
      return;
    }

    // Obstacle collision (Ghost power-up grants immunity)
    if (this.obstacleManager.has(head.x, head.y)) {
      if (!this.powerUpManager.isActive('GHOST')) {
        this.gameOver();
        return;
      }
    }

    // Food interactions
    const normal = this.foodManager.normalFood;
    if (normal && head.x === normal.x && head.y === normal.y) {
      this.handleEatNormal(normal);
    }

    const golden = this.foodManager.goldenFood;
    if (golden && head.x === golden.x && head.y === golden.y) {
      this.handleEatGolden(golden);
    }

    const bonus = this.foodManager.timedBonus;
    if (bonus && head.x === bonus.x && head.y === bonus.y) {
      this.handleEatTimedBonus(bonus);
    }

    // Power-up interaction
    const groundPU = this.powerUpManager.groundPowerUp;
    if (groundPU && head.x === groundPU.x && head.y === groundPU.y) {
      this.handleCollectPowerUp(groundPU);
    }
  }

  draw(dt = 0.016) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Futuristic Background Grid with subtle ambient drift
    this.drawBackgroundGrid(dt);

    // Obstacles
    this.obstacleManager.draw(this.ctx, this.cellSize);

    // Items & Food
    this.foodManager.draw(this.ctx, this.cellSize);
    this.powerUpManager.draw(this.ctx, this.cellSize, this.foodManager.pulseAngle);

    // Snake with smooth visual interpolation
    let progress = this.state === 'PLAYING' 
      ? Math.min(1, this.tickAccumulator / this.tickInterval) 
      : 1;

    let activeSnakeColor = null;
    if (this.powerUpManager.isActive('MULTIPLIER')) activeSnakeColor = '#ffd700';
    if (this.powerUpManager.isActive('SPEED')) activeSnakeColor = '#00f0ff';
    if (this.powerUpManager.isActive('SLOW')) activeSnakeColor = '#39ff14';

    this.snake.draw(
      this.ctx,
      this.cellSize,
      progress,
      this.powerUpManager.isActive('GHOST'),
      activeSnakeColor
    );

    // Particles layer
    if (this.settings.particles) {
      this.particles.draw(this.ctx);
    }
  }

  drawBackgroundGrid(dt = 0.016) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= CONFIG.GRID_SIZE; i++) {
      const pos = i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pos, 0);
      this.ctx.lineTo(pos, this.canvas.height);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, pos);
      this.ctx.lineTo(this.canvas.width, pos);
      this.ctx.stroke();
    }

    // Subtle drifting cyber motes
    if (this.ambientMotes) {
      this.ctx.fillStyle = '#00f0ff';
      for (const mote of this.ambientMotes) {
        mote.y += mote.speedY * dt;
        mote.x += mote.speedX * dt;
        if (mote.y < 0) {
          mote.y = this.canvas.height;
          mote.x = Math.random() * this.canvas.width;
        }
        if (mote.x < 0) mote.x = this.canvas.width;
        if (mote.x > this.canvas.width) mote.x = 0;

        this.ctx.globalAlpha = mote.alpha;
        this.ctx.beginPath();
        this.ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    this.update(dt);
    if (this.settings.particles) {
      this.particles.update(dt);
    }
    this.draw(dt);

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Bootstrap Game on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
