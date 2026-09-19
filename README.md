# NEXA : CLASSIC EVOLVED

<p align="center">
  <strong>A modern arcade reimagining of the legendary Nokia Snake II.</strong><br>
  Built with 100% pure vanilla HTML5, CSS3, and JavaScript.<br>
  Zero external frameworks. Zero build steps. Zero external audio or image dependencies.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Web_Audio_API-00F0FF?style=for-the-badge&logo=web-audio&logoColor=black" alt="Web Audio API">
  <img src="https://img.shields.io/badge/License-MIT-39FF14?style=for-the-badge" alt="License">
</p>

---

## ⚡ Highlights & Features

- **Classic Gameplay Reimagined**: Smooth 60 FPS sub-frame interpolated movement with direction queuing that prevents accidental 180° turns.
- **Nokia Snake II Timed Bonus**:
  - Periodically spawns a glowing bonus entity with an animated circular countdown ring.
  - Pulses faster with urgent audio clicks as time runs out.
  - **Dynamic Score Scaling**: Reaction-based reward yielding from **+250 up to +1000** points depending on how fast you collect it.
- **Pure Procedural Web Audio**:
  - Sound effects (eating, power-ups, combos, level up, countdown, death crunch) procedurally synthesized via Web Audio API oscillators and noise buffers.
  - Ambient synthwave soundtrack featuring a dark, filtered bassline and rhythmic pads.
  - Autoplay-safe: initializes seamlessly on first user click or keypress.
- **6 Dynamic Power-Ups**:
  - ⚡ **Speed Boost**: Accelerates snake movement.
  - ⏱ **Slow Mo**: Slows down the game tick for bullet-time precision.
  - 🧲 **Magnet**: Gradually pulls nearby food items toward the snake's head.
  - ✖ **2X Score**: Multiplies all scored points for 10 seconds.
  - 👻 **Ghost**: Temporarily grants phase-through immunity across obstacles.
  - 🔥 **Frenzy**: Immediately spawns multiple bonus food items.
- **Combo System**: Fast consecutive food pickups build an escalating score multiplier (`x2`, `x3`, `x4`...) with an animated HUD decay gauge and rising pitch audio.
- **Progressive Levels & Intelligent Obstacles**:
  - Level scaling increases board speed and introduces procedural obstacles (corners, center pillars, barrier slits, labyrinth corridors).
  - Safe generation algorithm guarantees obstacles and items never spawn on the snake or box the player into impossible situations.
- **Special Events**: Random arcade events like *Food Frenzy*, *Double Score*, *Time Rush*, and *Golden Rush*.
- **High-DPI Responsive Canvas**:
  - Square 24×24 grid rendered crisply across desktop, tablet, and mobile screens via `devicePixelRatio`.
  - Subtle background grid with drifting cyber dust motes and soft vignette framing.
- **Full Mobile & Touch Support**:
  - Pure, ultra-responsive swipe steering across the entire game board.
  - Zero on-screen clutter: completely free of virtual buttons or joysticks.
  - Low-latency continuous gesture tracking supporting rapid zigzag turns.
  - Full suppression of mobile browser pull-to-refresh and page scroll.
- **Customizable Settings & Storage**:
  - Toggles for Sound FX, Ambient Music, Particles, Screen Shake, and Reduced Motion.
  - Difficulty modes: **Easy**, **Normal**, and **Hard**.
  - Persistent tracking of High Score, Max Combo, Highest Level, and Total Games via `localStorage`.

---

## 🕹 Controls

| Action | Keyboard | Mobile / Touch |
| :--- | :--- | :--- |
| **Move / Steer** | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | **Swipe anywhere on board** (Up, Down, Left, Right) |
| **Pause / Resume** | <kbd>P</kbd> or <kbd>Esc</kbd> | Tap top-right Pause button |
| **Start / Restart** | <kbd>Enter</kbd> or <kbd>Space</kbd> | Tap Menu / Game Over buttons |

---

## 📁 Project Structure

```text
NEXA/
├── index.html            # Main entry point (compatible with GitHub Pages)
├── LICENSE               # MIT License
├── README.md             # Project documentation & guide
├── .gitignore            # Git exclusion rules
└── src/
    ├── css/
    │   └── style.css     # Neon arcade styling, UI modals & animations
    └── js/
        └── script.js     # Modular game engine & procedural Web Audio API
```

---

## 🚀 How to Run

### Offline (Direct in Browser)
No installation, package managers, or build steps required. Simply open `index.html` in any modern web browser:
- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari

### Local Development Server (Optional)
If you prefer running via a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve
```

---

## 📤 Pushing to GitHub

To push this repository to your GitHub account:

### 1. Initialize Git & Commit
```bash
git init
git add .
git commit -m "feat: initial release of NEXA - Classic Evolved"
git branch -M main
```

### 2. Connect Your GitHub Remote
Create a new empty repository on [GitHub](https://github.com/new) (e.g. `nexa`), then link and push:

```bash
git remote add origin https://github.com/<YOUR_USERNAME>/nexa.git
git push -u origin main
```

### 3. Enable GitHub Pages (Instant Playable Online Game)
1. Go to your repository on GitHub.
2. Navigate to **Settings** > **Pages** (under the "Code and automation" section).
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: Select `main` and `/ (root)`
4. Click **Save**.
5. Your game will be live at: `https://<YOUR_USERNAME>.github.io/nexa/`

---

## 🧱 Architecture Overview

`src/js/script.js` is structured into decoupled, single-responsibility classes:

| Class | Responsibility |
| :--- | :--- |
| `Game` | State machine (`MENU`, `COUNTDOWN`, `PLAYING`, `PAUSED`, `GAME_OVER`), fixed-step tick loop, delta-time rendering |
| `Snake` | Grid navigation, sub-frame interpolation, directional eyes, input buffer |
| `FoodManager` | Normal food, golden food, and timed bonus entity with circular countdown ring |
| `PowerUpManager` | Ground item spawning, active duration timers, and power-up modifiers |
| `ObstacleManager` | Procedural level-based obstacle generation and collision verification |
| `ParticleSystem` | Pooled particle emitter for sparkles, shockwaves, and impact debris |
| `AudioManager` | Web Audio API synthesizer for SFX and procedural ambient soundtrack |
| `InputManager` | Multi-platform input capturing (Keyboard WASD/Arrows, Responsive Touch Swipes) |
| `UIManager` | HUD metrics, floating score popups, screen shake/flash triggers, screen transitions |
| `StorageManager` | Safe `localStorage` handler with quota error fallbacks |

---

## 📜 License

Distributed under the [MIT License](LICENSE). Feel free to play, fork, and build upon NEXA!
