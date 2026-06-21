// ============================================================
// game.js — Main Game Engine
// Game loop, player movement, rendering, input, level management
// ============================================================

// ---- Player Move Speed ----

const PLAYER_MOVE_INTERVAL = 0.12; // seconds between tile moves (~8 tiles/sec max)

// ---- Difficulty Configuration ----

const DIFFICULTY_CONFIG = {
  easy: {
    label: { en: 'Easy', zh: '简单' },
    monsterSpeedMul: 0.65,
    emptyCellsOffset: -4,
    wallDensityOffset: -0.05,
    livesBonus: 1,
  },
  medium: {
    label: { en: 'Medium', zh: '中等' },
    monsterSpeedMul: 1.0,
    emptyCellsOffset: 0,
    wallDensityOffset: 0,
    livesBonus: 0,
  },
  hard: {
    label: { en: 'Hard', zh: '困难' },
    monsterSpeedMul: 1.35,
    emptyCellsOffset: 4,
    wallDensityOffset: 0.05,
    livesBonus: -1,
  },
  extreme: {
    label: { en: 'Extreme', zh: '压力' },
    monsterSpeedMul: 1.7,
    emptyCellsOffset: 8,
    wallDensityOffset: 0.10,
    livesBonus: -1,
  },
};

// ---- Level Configuration ----

const LEVEL_CONFIG = [
  null, // level 0 unused
  { monsterSpeed: 2.0, monsterCount: 1, emptyCells: 10, wallDensity: 0.12 },
  { monsterSpeed: 2.4, monsterCount: 1, emptyCells: 12, wallDensity: 0.15 },
  { monsterSpeed: 2.8, monsterCount: 2, emptyCells: 14, wallDensity: 0.18 },
  { monsterSpeed: 3.2, monsterCount: 2, emptyCells: 16, wallDensity: 0.20 },
  { monsterSpeed: 3.6, monsterCount: 3, emptyCells: 18, wallDensity: 0.22 },
];

/**
 * Get config for a level number, with difficulty multipliers applied.
 */
function getLevelConfig(level) {
  const diff = DIFFICULTY_CONFIG[game.difficulty] || DIFFICULTY_CONFIG.medium;

  let config;
  if (level >= LEVEL_CONFIG.length) {
    const base = LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
    const extraLevel = level - (LEVEL_CONFIG.length - 1);
    config = {
      monsterSpeed: base.monsterSpeed + extraLevel * 0.3,
      monsterCount: base.monsterCount + Math.floor(extraLevel / 2),
      emptyCells: Math.min(28, base.emptyCells + extraLevel),
      wallDensity: Math.min(0.35, base.wallDensity + extraLevel * 0.02),
    };
  } else {
    config = { ...LEVEL_CONFIG[level] };
  }

  // Apply difficulty multipliers
  config.monsterSpeed *= diff.monsterSpeedMul;
  config.emptyCells = Math.max(6, Math.min(30, config.emptyCells + diff.emptyCellsOffset));
  config.wallDensity = Math.max(0.06, Math.min(0.38, config.wallDensity + diff.wallDensityOffset));

  return config;
}

// ---- Procedural Dungeon Generation ----

/**
 * Generate a procedural dungeon map using room placement + corridor connections.
 *
 * Algorithm:
 *   1. Start with all walls
 *   2. Place 3-6 rectangular rooms at random positions
 *   3. Connect rooms with L-shaped corridors
 *   4. Add random scattered pillars for tactical cover
 *   5. Ensure outer wall perimeter
 *   6. Verify player start (5,5) is walkable
 *
 * @param {number} wallDensity - fraction of non-room tiles that become walls (0.10–0.35)
 * @returns {number[][]} 11×11 tile map (0=walkable, 1=wall)
 */
function generateDungeonMap(wallDensity) {
  const W = MAP_COLS;  // 11
  const H = MAP_ROWS;  // 11

  // Step 1: Start with all walkable (except outer wall)
  const map = Array.from({ length: H }, () => Array(W).fill(0));
  for (let r = 0; r < H; r++) { map[r][0] = 1; map[r][W - 1] = 1; }
  for (let c = 0; c < W; c++) { map[0][c] = 1; map[H - 1][c] = 1; }

  // Step 2: Place walls to create rooms and corridors
  // Strategy: carve a few L-shaped corridors, then fill some areas with walls

  // First, ensure central cross is open (guarantees player mobility)
  for (let i = 2; i <= 8; i++) { map[5][i] = 0; map[i][5] = 0; }

  // Place 2-3 horizontal walls to create corridors
  const hWalls = 2 + Math.floor(Math.random() * 2); // 2-3
  for (let w = 0; w < hWalls; w++) {
    const row = 2 + Math.floor(Math.random() * 7); // rows 2-8
    const start = 1 + Math.floor(Math.random() * 4); // col 1-4
    const len = 2 + Math.floor(Math.random() * 4);  // length 2-5

    for (let c = start; c < Math.min(start + len, W - 1); c++) {
      // Don't block the center cross
      if (Math.abs(row - 5) <= 1 && Math.abs(c - 5) <= 1) continue;
      map[row][c] = 1;
    }
  }

  // Place 2-3 vertical walls
  const vWalls = 2 + Math.floor(Math.random() * 2); // 2-3
  for (let w = 0; w < vWalls; w++) {
    const col = 2 + Math.floor(Math.random() * 7);
    const start = 1 + Math.floor(Math.random() * 4);
    const len = 2 + Math.floor(Math.random() * 4);

    for (let r = start; r < Math.min(start + len, H - 1); r++) {
      if (Math.abs(r - 5) <= 1 && Math.abs(col - 5) <= 1) continue;
      map[r][col] = 1;
    }
  }

  // Step 3: Add scattered pillars based on density
  const pillarCount = Math.floor(wallDensity * W * H);
  for (let p = 0; p < pillarCount; p++) {
    const px = 1 + Math.floor(Math.random() * (W - 2));
    const py = 1 + Math.floor(Math.random() * (H - 2));

    // Don't block center or the immediate vicinity
    if (Math.abs(px - 5) + Math.abs(py - 5) <= 2) continue;
    // Only place on currently walkable tiles
    if (map[py][px] === 0) {
      map[py][px] = 1;
    }
  }

  // Step 4: BFS from center — if any unreachable walkable tiles,
  // carve a path to connect them
  ensureConnectivity(map, 5, 5);

  return map;
}

/**
 * BFS from (sx, sy). Any walkable tile that's unreachable gets connected
 * by carving a straight path from the nearest reachable tile.
 */
function ensureConnectivity(map, sx, sy) {
  const W = MAP_COLS, H = MAP_ROWS;
  const reachable = new Set();
  const queue = [[sx, sy]];
  reachable.add(`${sx},${sy}`);

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H &&
          map[ny][nx] === 0 && !reachable.has(`${nx},${ny}`)) {
        reachable.add(`${nx},${ny}`);
        queue.push([nx, ny]);
      }
    }
  }

  // Find unreachable walkable tiles and connect them
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (map[r][c] === 0 && !reachable.has(`${c},${r}`)) {
        // Carve a path toward center
        let cx = c, cy = r;
        while (!reachable.has(`${cx},${cy}`)) {
          map[cy][cx] = 0;
          reachable.add(`${cx},${cy}`);
          // Move toward center
          if (Math.abs(cx - sx) > Math.abs(cy - sy)) {
            cx += (sx > cx ? 1 : -1);
          } else {
            cy += (sy > cy ? 1 : -1);
          }
        }
      }
    }
  }
}

/**
 * Carve an L-shaped corridor between two points (kept for potential use).
 */
function carveCorridor(map, x1, y1, x2, y2) {
  if (Math.random() < 0.5) {
    carveH(map, x1, x2, y1);
    carveV(map, y1, y2, x2);
  } else {
    carveV(map, y1, y2, x1);
    carveH(map, x1, x2, y2);
  }
}

function carveH(map, x1, x2, y) {
  const [start, end] = x1 < x2 ? [x1, x2] : [x2, x1];
  for (let x = start; x <= end; x++) {
    if (y > 0 && y < MAP_ROWS - 1) map[y][x] = 0;
  }
}

function carveV(map, y1, y2, x) {
  const [start, end] = y1 < y2 ? [y1, y2] : [y2, y1];
  for (let y = start; y <= end; y++) {
    if (x > 0 && x < MAP_COLS - 1) map[y][x] = 0;
  }
}

/**
 * Carve an L-shaped corridor between two points.
 * Randomly chooses horizontal-first or vertical-first.
 */
function carveCorridor(map, x1, y1, x2, y2) {
  if (Math.random() < 0.5) {
    // Horizontal first, then vertical
    carveH(map, x1, x2, y1);
    carveV(map, y1, y2, x2);
  } else {
    // Vertical first, then horizontal
    carveV(map, y1, y2, x1);
    carveH(map, x1, x2, y2);
  }
}

function carveH(map, x1, x2, y) {
  const [start, end] = x1 < x2 ? [x1, x2] : [x2, x1];
  for (let x = start; x <= end; x++) {
    if (y > 0 && y < MAP_ROWS - 1) map[y][x] = 0;
  }
}

function carveV(map, y1, y2, x) {
  const [start, end] = y1 < y2 ? [y1, y2] : [y2, y1];
  for (let y = start; y <= end; y++) {
    if (x > 0 && x < MAP_COLS - 1) map[y][x] = 0;
  }
}

// ---- Game State ----

const game = {
  // Flow
  state: 'menu',       // 'menu' | 'playing' | 'gameover' | 'levelclear'
  level: 1,
  score: 0,
  lives: 3,
  timer: 0,
  difficulty: 'medium', // 'easy' | 'medium' | 'hard' | 'extreme'
  gridSize: 6,          // 6 (2×3 boxes) or 9 (3×3 boxes)

  // Player
  playerTileX: 5,
  playerTileY: 5,
  playerPixelX: 5 * 32,
  playerPixelY: 5 * 32,
  invulnTimer: 0,
  lastMoveDir: { dx: 0, dy: -1 }, // Default facing up
  moveCooldown: 0,     // seconds between tile moves (prevents too-fast movement)

  // Dungeon
  tileMap: null,

  // Sudoku
  sudokuSolution: null,  // number[6][6]
  sudokuGrid: null,      // number[6][6] — the puzzle (givens non-zero)
  playerGrid: null,      // number[6][6] — current board state
  completed: { row: [], col: [], box: [] },
  selectedCell: { row: -1, col: -1 },

  // Monsters and effects
  monsters: [],
  iceWalls: [],

  // Rendering
  canvas: null,
  ctx: null,

  // Timing
  lastTimestamp: 0,
  accumulator: 0,

  // Effect log message + timer
  effectMsg: '',
  effectTimer: 0,

  // Level advance interval (so we can clear it on restart)
  levelAdvanceInterval: null,
};

// ---- Input Handling ----

const heldDirections = []; // Stack: most recent first

function handleKeyDown(e) {
  // Prevent default for game keys
  const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyR',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
    'Digit7', 'Digit8', 'Digit9',
    'Backspace', 'Delete', 'Escape'];
  if (gameKeys.includes(e.code)) {
    e.preventDefault();
  }

  // WASD movement
  const dirMap = {
    'KeyW': { dx: 0, dy: -1 },
    'KeyA': { dx: -1, dy: 0 },
    'KeyS': { dx: 0, dy: 1 },
    'KeyD': { dx: 1, dy: 0 },
  };

  if (dirMap[e.code]) {
    // Remove existing entry for this key, then push to front
    const idx = heldDirections.findIndex(d => d.code === e.code);
    if (idx >= 0) heldDirections.splice(idx, 1);
    heldDirections.unshift({ code: e.code, ...dirMap[e.code] });
    return;
  }

  // Space: start game / next level
  if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
    if (game.state === 'menu') {
      try {
        SoundManager.init();
        BGM.start('playing');
        startLevel(1);
      } catch (err) {
        console.error('[SudokuSurvivor] Space handler error:', err);
      }
    }
    return;
  }

  // R: restart
  if (e.code === 'KeyR') {
    if (game.state === 'gameover') {
      restartGame();
    }
    return;
  }

  // PvP mode: route number keys to Player 1
  if (game.state === 'pvp' && e.code >= 'Digit1' && e.code <= 'Digit9') {
    var pvpVal = parseInt(e.code.replace('Digit', ''));
    if (pvpVal <= PvP.size) {
      pvpHandleKey(1, pvpVal.toString());
      return;
    }
  }

  // Number keys 1-9: fill selected Sudoku cell
  const maxDigit = game.gridSize === 6 ? 'Digit6' : 'Digit9';
  if (e.code >= 'Digit1' && e.code <= maxDigit) {
    const value = parseInt(e.code.replace('Digit', ''));
    onSudokuInput(value);
    return;
  }

  // Backspace / Delete: clear selected cell
  if (e.code === 'Backspace' || e.code === 'Delete') {
    clearSelectedCell();
    return;
  }

  // Escape: back to menu (quit current game)
  if (e.code === 'Escape') {
    if (game.state === 'playing') {
      // Quit to menu — lose progress
      BGM.setScene('menu');
      stopAllGameTimers();
      game.state = 'menu';
      game.tileMap = null;
      hideOverlay();
      buildMenuOverlay();
      return;
    }
    if (game.state === 'gameover' || game.state === 'levelclear') {
      stopAllGameTimers();
      game.state = 'menu';
      game.tileMap = null;
      hideOverlay();
      buildMenuOverlay();
      BGM.setScene('menu');
      return;
    }
    if (game.state === 'pvp') {
      pvpQuit();
      return;
    }
    // Default: deselect Sudoku cell
    game.selectedCell = { row: -1, col: -1 };
    renderSudoku();
    return;
  }
}

function handleKeyUp(e) {
  const idx = heldDirections.findIndex(d => d.code === e.code);
  if (idx >= 0) heldDirections.splice(idx, 1);
}

// ---- Touch Controls (Virtual D-pad) ----

const DIR_MAP = {
  up:    { code: 'DpadUp',    dx: 0,  dy: -1 },
  down:  { code: 'DpadDown',  dx: 0,  dy: 1  },
  left:  { code: 'DpadLeft',  dx: -1, dy: 0  },
  right: { code: 'DpadRight', dx: 1,  dy: 0  },
};

function setupTouchControls() {
  const buttons = document.querySelectorAll('.dpad-btn');

  buttons.forEach(btn => {
    const dir = btn.dataset.dir;
    const mapping = DIR_MAP[dir];
    if (!mapping) return;

    // Touch start: press the virtual key
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const idx = heldDirections.findIndex(d => d.code === mapping.code);
      if (idx >= 0) heldDirections.splice(idx, 1);
      heldDirections.unshift({ code: mapping.code, dx: mapping.dx, dy: mapping.dy });
    });

    // Touch end: release
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      const idx = heldDirections.findIndex(d => d.code === mapping.code);
      if (idx >= 0) heldDirections.splice(idx, 1);
    });

    // Also support mouse for testing on desktop
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const idx = heldDirections.findIndex(d => d.code === mapping.code);
      if (idx >= 0) heldDirections.splice(idx, 1);
      heldDirections.unshift({ code: mapping.code, dx: mapping.dx, dy: mapping.dy });
    });

    btn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      const idx = heldDirections.findIndex(d => d.code === mapping.code);
      if (idx >= 0) heldDirections.splice(idx, 1);
    });

    btn.addEventListener('mouseleave', (e) => {
      const idx = heldDirections.findIndex(d => d.code === mapping.code);
      if (idx >= 0) heldDirections.splice(idx, 1);
    });
  });
}

/**
 * Get the current movement direction (based on most recently pressed key).
 */
function getCurrentDirection() {
  return heldDirections.length > 0
    ? { dx: heldDirections[0].dx, dy: heldDirections[0].dy }
    : { dx: 0, dy: 0 };
}

// ---- Initialization ----

function init() {
  try {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');
    game.ctx.imageSmoothingEnabled = false;

    // Input listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Mute button (toggles both SFX and BGM)
    var muteBtn = document.getElementById('mute-btn');
    if (muteBtn) muteBtn.addEventListener('click', function () {
      var sfxMuted = SoundManager.toggleMute();
      var bgmMuted = BGM.toggleMute();
      var allMuted = sfxMuted && bgmMuted;
      muteBtn.textContent = allMuted ? '🔇' : '🔊';
      if (allMuted) muteBtn.classList.add('muted');
      else muteBtn.classList.remove('muted');
    });

    // Language toggle button
    var langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.addEventListener('click', function () {
      I18n.toggleLang();
      langBtn.textContent = I18n.getLang() === 'zh' ? '中' : 'EN';
      if (game.state === 'menu') buildMenuOverlay();
      else if (game.state === 'gameover') showGameOverOverlay();
      else if (game.state === 'levelclear') buildLevelClearOverlay();
    });

    // Virtual D-pad for touch devices
    setupTouchControls();

    // Build dynamic UI
    configureSudokuEngine(game.gridSize);
    buildSudokuTable();
    buildNumberPad();
    game.completed = makeCompletedArrays(game.gridSize);

    // Build menu overlay with current language
    buildMenuOverlay();

    // Start the game loop
    game.lastTimestamp = 0;
    game.accumulator = 0;
    requestAnimationFrame(gameLoop);

    console.log('[SudokuSurvivor] Init OK — grid=' + game.gridSize + ' difficulty=' + game.difficulty + ' state=' + game.state);
  } catch (err) {
    console.error('[SudokuSurvivor] Init FAILED:', err);
  }
}

/**
 * Build the 6×6 Sudoku table in the DOM.
 */
function makeCompletedArrays(size) {
  const boxCount = size === 6 ? 6 : 9;
  return {
    row: Array(size).fill(false),
    col: Array(size).fill(false),
    box: Array(boxCount).fill(false),
  };
}

function setGridSize(size) {
  game.gridSize = size;
  configureSudokuEngine(size);
  buildSudokuTable();
  buildNumberPad();
  game.completed = makeCompletedArrays(size);
}

function buildSudokuTable() {
  const table = document.getElementById('sudoku-grid');
  table.innerHTML = '';
  table.className = game.gridSize === 9 ? 'grid-9' : '';
  const size = game.gridSize;

  // Box dimensions: 6×6 → 2×3 boxes, 9×9 → 3×3 boxes
  var boxRows = size === 6 ? 2 : 3;
  var boxCols = size === 6 ? 3 : 3;

  for (var r = 0; r < size; r++) {
    var tr = document.createElement('tr');
    // Thick border AFTER the last row of each box (not after the last grid row)
    if ((r + 1) % boxRows === 0 && r < size - 1) {
      tr.classList.add('box-border-bottom');
    }
    for (var c = 0; c < size; c++) {
      var td = document.createElement('td');
      td.dataset.row = r;
      td.dataset.col = c;
      // Thick border AFTER the last column of each box
      if ((c + 1) % boxCols === 0 && c < size - 1) {
        td.classList.add('box-border-right');
      }
      td.addEventListener('click', (function (row, col) {
        return function () { onSudokuCellClick(row, col); };
      })(r, c));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function buildNumberPad() {
  var pad = document.getElementById('number-pad');
  if (!pad) return;
  pad.innerHTML = '';
  var maxNum = game.gridSize === 6 ? 6 : 9;
  for (var v = 1; v <= maxNum; v++) {
    var btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.dataset.value = v;
    btn.textContent = v;
    btn.addEventListener('click', (function (val) {
      return function () { onSudokuInput(val); };
    })(v));
    pad.appendChild(btn);
  }
}

// ---- Level Management ----

function startLevel(level) {
  const config = getLevelConfig(level);

  // Clear any pending auto-advance
  if (game.levelAdvanceInterval) {
    clearInterval(game.levelAdvanceInterval);
    game.levelAdvanceInterval = null;
  }

  // Reset state for new level
  game.state = 'playing';
  game.level = level;
  game.timer = 0;
  game.score = (level - 1) * 100; // Base score from previous levels
  // Base lives with difficulty modifier
  const diff = DIFFICULTY_CONFIG[game.difficulty] || DIFFICULTY_CONFIG.medium;
  if (level === 1) {
    game.lives = 3 + diff.livesBonus;
  }
  game.monsters = [];
  game.iceWalls = [];
  game.invulnTimer = 0;
  game.moveCooldown = 0;
  game.lastMoveDir = { dx: 0, dy: -1 };
  game.completed = makeCompletedArrays(game.gridSize);
  game.selectedCell = { row: -1, col: -1 };
  game.effectMsg = '';
  game.effectTimer = 0;

  // Generate dungeon
  game.tileMap = generateDungeonMap(config.wallDensity);

  // Place player at center (must be walkable)
  game.playerTileX = 5;
  game.playerTileY = 5;
  game.playerPixelX = 5 * TILE_SIZE;
  game.playerPixelY = 5 * TILE_SIZE;

  // If center is a wall (shouldn't happen), find nearest walkable
  if (game.tileMap[5][5] === 1) {
    for (let r = 5; r >= 1; r--) {
      if (game.tileMap[r][5] === 0) {
        game.playerTileY = r;
        game.playerPixelY = r * TILE_SIZE;
        break;
      }
    }
  }

  // Configure Sudoku engine for current grid size
  configureSudokuEngine(game.gridSize);

  // Scale empty cells for grid size (6×6=36 cells, 9×9=81 cells → ~2.25x)
  const emptyScale = game.gridSize === 9 ? 2.25 : 1;
  const emptyCells = Math.round(config.emptyCells * emptyScale);

  // Generate Sudoku puzzle
  const { puzzle, solution } = generatePuzzle(emptyCells);
  game.sudokuGrid = puzzle.map(row => [...row]);     // Deep copy
  game.sudokuSolution = solution.map(row => [...row]);
  game.playerGrid = puzzle.map(row => [...row]);     // Starts with givens, player fills rest

  // Spawn monsters at distance from player
  for (let i = 0; i < config.monsterCount; i++) {
    const pos = findSpawnPosition(5);
    const m = createMonster(i, pos.x, pos.y, config.monsterSpeed);
    // Stagger initial movement so they don't all move on the exact same frame
    m.moveTimer = i * 0.3;
    game.monsters.push(m);
  }

  // Reset speed boost state
  if (typeof wrongAnswerBoostActive !== 'undefined') {
    wrongAnswerBoostActive = false;
    wrongAnswerBoostTimer = 0;
  }

  // Update UI
  renderSudoku();
  updateUI();
  hideOverlay();
}

function restartGame() {
  game.score = 0;
  game.lives = 3;
  BGM.setScene('playing');
  startLevel(1);
}

/**
 * Find a walkable tile at least minDistance from the player.
 */
function findSpawnPosition(minDistance) {
  const candidates = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (game.tileMap[r][c] === 0) {
        const dist = Math.abs(r - game.playerTileY) + Math.abs(c - game.playerTileX);
        if (dist >= minDistance) {
          candidates.push({ x: c, y: r });
        }
      }
    }
  }
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  // Fallback: any walkable tile
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (game.tileMap[r][c] === 0) return { x: c, y: r };
    }
  }
  return { x: 1, y: 1 };
}

// ---- Game Loop ----

function gameLoop(timestamp) {
  if (!game.lastTimestamp) game.lastTimestamp = timestamp;

  let frameTime = (timestamp - game.lastTimestamp) / 1000;
  game.lastTimestamp = timestamp;

  // Cap frame time to prevent spiral of death
  if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

  if (game.state === 'playing' || game.state === 'pvp') {
    game.accumulator += frameTime;

    while (game.accumulator >= FIXED_TIMESTEP) {
      if (game.state === 'playing') update(FIXED_TIMESTEP);
      else if (game.state === 'pvp') pvpUpdate(FIXED_TIMESTEP);
      game.accumulator -= FIXED_TIMESTEP;
    }
  }

  if (game.state === 'pvp') renderPvPCanvas();
  else render();
  requestAnimationFrame(gameLoop);
}

// ---- Update (Fixed Timestep) ----

function update(dt) {
  // 1. Update level timer
  game.timer += dt;

  // 2. Player movement
  updatePlayerMovement(dt);

  // 3. Monster movement
  updateMonsters(game.monsters, dt, game.playerTileX, game.playerTileY, game.tileMap, game.iceWalls);

  // 4. Wrong answer boost decay
  updateWrongAnswerBoost(game.monsters, dt);

  // 5. Ice wall decay
  updateIceWalls(game.iceWalls, dt);

  // 6. Invulnerability decay
  if (game.invulnTimer > 0) {
    game.invulnTimer -= dt;
    if (game.invulnTimer < 0) game.invulnTimer = 0;
  }

  // 7. Effect message decay
  if (game.effectTimer > 0) {
    game.effectTimer -= dt;
    if (game.effectTimer <= 0) {
      game.effectMsg = '';
      game.effectTimer = 0;
      updateEffectLog();
    }
  }

  // 8. Monster-player collision
  checkMonsterCollision();

  // 9. Monster proximity warning (every ~1s, warns when monster is within 3 tiles)
  game._proximityTimer = (game._proximityTimer || 0) - dt;
  if (game._proximityTimer <= 0) {
    game._proximityTimer = 1.0;
    for (const m of game.monsters) {
      if (m.state === 'chasing') {
        const dist = Math.abs(m.tileX - game.playerTileX) + Math.abs(m.tileY - game.playerTileY);
        if (dist <= 3) {
          SoundManager.sfxMonsterClose();
          break;
        }
      }
    }
    // Speed boost warning
    if (typeof wrongAnswerBoostActive !== 'undefined' && wrongAnswerBoostActive) {
      SoundManager.sfxBoostWarning();
    }
  }

  // 10. Update DOM UI (throttled — only every ~0.25s to avoid DOM thrashing)
  updateUI();

  // 11. BGM adaptive intensity based on nearest monster distance
  let minDist = Infinity;
  for (const m of game.monsters) {
    if (m.state !== 'stunned') { // Stunned monsters aren't threatening
      const dist = Math.abs(m.tileX - game.playerTileX) + Math.abs(m.tileY - game.playerTileY);
      if (dist < minDist) minDist = dist;
    }
  }
  // Map distance to intensity: dist 1 → 1.0, dist 5+ → 0.0
  const newIntensity = minDist <= 1 ? 1.0 : minDist >= 6 ? 0.0 : 1 - (minDist - 1) / 5;
  BGM.setIntensity(newIntensity);
}

// ---- Player Movement ----

function updatePlayerMovement(dt) {
  // Movement cooldown: prevents too-fast tile traversal
  // Without this, holding a key moves 30 tiles/sec — uncontrollable on 11×11
  if (game.moveCooldown > 0) {
    game.moveCooldown -= dt;
    return;
  }

  const dir = getCurrentDirection();
  if (dir.dx === 0 && dir.dy === 0) return;

  const newTileX = game.playerTileX + dir.dx;
  const newTileY = game.playerTileY + dir.dy;

  // Bounds check
  if (newTileX < 0 || newTileX >= MAP_COLS || newTileY < 0 || newTileY >= MAP_ROWS) return;

  // Permanent wall collision
  if (game.tileMap[newTileY][newTileX] === 1) return;

  // Ice wall collision (player cannot walk through ice walls)
  if (game.iceWalls.some(w => w.x === newTileX && w.y === newTileY)) return;

  // Move
  game.lastMoveDir = { dx: dir.dx, dy: dir.dy };
  game.playerTileX = newTileX;
  game.playerTileY = newTileY;
  game.playerPixelX = newTileX * TILE_SIZE;
  game.playerPixelY = newTileY * TILE_SIZE;
  game.moveCooldown = PLAYER_MOVE_INTERVAL;
}

// ---- Collision Detection ----

function checkMonsterCollision() {
  if (game.invulnTimer > 0) return;

  for (const m of game.monsters) {
    if (m.tileX === game.playerTileX && m.tileY === game.playerTileY) {
      onPlayerHit();
      break;
    }
  }
}

function onPlayerHit() {
  game.lives--;
  game.score = Math.max(0, game.score - 30);
  game.invulnTimer = 3.0; // 3 seconds of invulnerability

  SoundManager.sfxHit();

  // Push monsters back slightly to prevent immediate re-hit
  for (const m of game.monsters) {
    m.path = [];
    m.pathIndex = 0;
    m.moveCooldown = 0;
  }

  if (game.lives <= 0) {
    game.state = 'gameover';
    game.lives = 0;
    BGM.setScene('gameover');
    SoundManager.sfxGameOver();
    showGameOverOverlay();
  }

  updateUI();
}

// ---- Sudoku Interaction ----

function onSudokuCellClick(row, col) {
  if (game.state !== 'playing') return;

  // Can't select given cells
  if (game.sudokuGrid[row][col] !== 0) return;

  // Toggle selection
  if (game.selectedCell.row === row && game.selectedCell.col === col) {
    game.selectedCell = { row: -1, col: -1 };
  } else {
    game.selectedCell = { row, col };
  }

  renderSudoku();
}

function onSudokuInput(value) {
  if (game.state !== 'playing') return;
  if (game.selectedCell.row < 0 || game.selectedCell.col < 0) return;

  const { row, col } = game.selectedCell;

  // Can't modify given cells
  if (game.sudokuGrid[row][col] !== 0) return;

  // Can't modify already correctly filled cells
  // (actually, let's allow overwriting — player can change their answer)

  const correctValue = game.sudokuSolution[row][col];

  // Check against solution
  if (value === correctValue) {
    // Correct!
    game.playerGrid[row][col] = value;
    game.score += 10;
    SoundManager.sfxCorrect();

    // Flash green
    flashCell(row, col, 'correct-flash');

    // Check for row/col/box completions
    checkCompletion(row, col);

    // Deselect after a correct fill
    game.selectedCell = { row: -1, col: -1 };
  } else {
    // Wrong answer!
    SoundManager.sfxWrong();
    // Don't fill the cell — let the player try again
    flashCell(row, col, 'wrong-flash');

    // Speed boost all monsters
    applyWrongAnswerBoost(game.monsters);

    // Show effect message
    setEffectMsg(I18n.t('effect.wrong'), 'boost', 1.5);
  }

  renderSudoku();
  updateUI();
}

function clearSelectedCell() {
  if (game.state !== 'playing') return;
  if (game.selectedCell.row < 0 || game.selectedCell.col < 0) return;

  const { row, col } = game.selectedCell;

  // Can't clear given cells
  if (game.sudokuGrid[row][col] !== 0) return;

  game.playerGrid[row][col] = 0;
  renderSudoku();
}

function flashCell(row, col, className) {
  const cell = document.querySelector(`#sudoku-grid td[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  cell.classList.add(className);
  setTimeout(() => cell.classList.remove(className), 400);
}

// ---- Completion Detection ----

function checkCompletion(row, col) {
  // Check if the just-filled cell completed a row
  if (!game.completed.row[row] && isRowComplete(game.playerGrid, row)) {
    game.completed.row[row] = true;
    onRowComplete(row);
  }

  // Check if the just-filled cell completed a column
  if (!game.completed.col[col] && isColComplete(game.playerGrid, col)) {
    game.completed.col[col] = true;
    onColComplete(col);
  }

  // Check if the just-filled cell completed its box
  const boxIdx = getBoxIndex(row, col);
  if (!game.completed.box[boxIdx] && isBoxComplete(game.playerGrid, boxIdx)) {
    game.completed.box[boxIdx] = true;
    onBoxComplete(boxIdx);
  }

  // Check if entire puzzle is complete
  if (isPuzzleComplete(game.playerGrid)) {
    onPuzzleComplete();
  }
}

function onRowComplete(row) {
  spawnIceWall(game.playerTileX, game.playerTileY, game.lastMoveDir, game.tileMap, game.iceWalls, game.monsters);
  game.score += 30;
  SoundManager.sfxRowComplete();
  setEffectMsg(I18n.t('effect.row'), 'ice', 2.0);
}

function onColComplete(col) {
  applyEffect(game.monsters, 'stun', game.playerTileX, game.playerTileY, 3.0);
  game.score += 30;
  SoundManager.sfxColComplete();
  setEffectMsg(I18n.t('effect.col'), 'lightning', 2.0);
}

function onBoxComplete(boxIdx) {
  applyEffect(game.monsters, 'freeze', 0, 0, 4.0);
  game.score += 50;
  SoundManager.sfxBoxComplete();
  setEffectMsg(I18n.t('effect.box'), 'freeze', 2.0);
}

function onPuzzleComplete() {
  game.score += 100;
  game.state = 'levelclear';
  BGM.setScene('levelclear');
  SoundManager.sfxLevelClear();
  setEffectMsg(I18n.t('effect.clear'), 'ice', 3.0);

  buildLevelClearOverlay();

  // Auto-advance after 3 seconds
  let countdown = 3;
  const autoEl = document.getElementById('auto-advance');
  game.levelAdvanceInterval = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(game.levelAdvanceInterval);
      game.levelAdvanceInterval = null;
      hideOverlay();
      BGM.setScene('playing');
      startLevel(game.level + 1);
    } else {
      autoEl.textContent = `${I18n.t('levelclear.next')} ${countdown}s...`;
    }
  }, 1000);
}

// ---- Overlay Builders ----

function buildMenuOverlay() {
  const overlay = document.getElementById('overlay');
  overlay.className = '';
  const lang = I18n.getLang();

  const diffs = ['easy', 'medium', 'hard', 'extreme'];
  const diffButtons = diffs.map(d => {
    const cfg = DIFFICULTY_CONFIG[d];
    const label = cfg.label[lang] || cfg.label.en;
    const active = game.difficulty === d ? 'difficulty-btn active' : 'difficulty-btn';
    return `<button class="${active}" data-diff="${d}">${label}</button>`;
  }).join('');

  // Grid size buttons
  const gridSizes = [
    { size: 6, label: { en: '6×6', zh: '6×6 快速' } },
    { size: 9, label: { en: '9×9', zh: '9×9 深度' } },
  ];
  const gridButtons = gridSizes.map(g => {
    const label = g.label[lang] || g.label.en;
    const active = game.gridSize === g.size ? 'difficulty-btn active' : 'difficulty-btn';
    return `<button class="${active}" data-grid="${g.size}">${label}</button>`;
  }).join('');

  var pvpLabel = lang === 'zh' ? '⚔️ 本地双人对战' : '⚔️ Local PvP';
  overlay.innerHTML = `
    <h1 data-i18n="menu.title">${I18n.t('menu.title').replace('\n', '<br>')}</h1>
    <div class="subtitle" data-i18n="menu.subtitle">${I18n.t('menu.subtitle').replace(/\n/g, '<br>')}</div>
    <div class="difficulty-selector">${gridButtons}</div>
    <div class="difficulty-selector">${diffButtons}</div>
    <div class="difficulty-selector"><button class="pvp-btn" id="pvp-start-btn">${pvpLabel}</button></div>
    <div class="key-hint" data-i18n="menu.start">${I18n.t('menu.start')}</div>
    <div style="font-size:12px;color:#666;margin-top:6px;">${I18n.t('esc.menu')} &nbsp;|&nbsp; 🌐 ${I18n.getLang() === 'zh' ? '中→EN' : 'EN→中'} &nbsp;|&nbsp; 🔊</div>
  `;
  overlay.classList.remove('hidden');

  // Click handlers: grid size
  overlay.querySelectorAll('[data-grid]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      try {
        var size = parseInt(btn.dataset.grid);
        setGridSize(size);
        buildMenuOverlay();
      } catch (err) {
        console.error('[SudokuSurvivor] Grid button error:', err);
      }
    });
  });

  // Click handlers: difficulty
  overlay.querySelectorAll('.difficulty-btn').forEach(function (btn) {
    if (btn.dataset.grid) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      try {
        setDifficulty(btn.dataset.diff);
        buildMenuOverlay();
      } catch (err) {
        console.error('[SudokuSurvivor] Difficulty button error:', err);
      }
    });
  });

  // PvP button
  var pvpBtn = overlay.querySelector('#pvp-start-btn');
  if (pvpBtn) {
    pvpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      SoundManager.init();
      BGM.start('playing');
      pvpInit(game.gridSize, game.gridSize === 6 ? 12 : 27);
      game.state = 'pvp';
    });
  }
}

function setDifficulty(diff) {
  if (!DIFFICULTY_CONFIG[diff]) return;
  game.difficulty = diff;
}

function buildLevelClearOverlay() {
  var overlay = document.getElementById('overlay');
  overlay.className = 'levelclear';
  var lang = I18n.getLang();
  var escText = I18n.t('esc.menu');
  overlay.innerHTML = '<h2 style=\"color:#2ecc71;\">' + I18n.t('levelclear.title') + '</h2>' +
    '<div class=\"subtitle\">' +
      I18n.t('stat.level') + ': ' + game.level + '<br>' +
      I18n.t('stat.score') + ': ' + game.score + '<br>' +
      I18n.t('stat.time') + ': ' + formatTime(game.timer) +
    '</div>' +
    '<div class=\"key-hint\" id=\"auto-advance\">' + I18n.t('levelclear.next') + ' 3s...</div>' +
    '<div class=\"key-hint\" style=\"font-size:13px;color:#aaa;animation:none;margin-top:6px;\">' + escText + '</div>';
  overlay.classList.remove('hidden');
}

function stopAllGameTimers() {
  if (game.levelAdvanceInterval) {
    clearInterval(game.levelAdvanceInterval);
    game.levelAdvanceInterval = null;
  }
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

function showGameOverOverlay() {
  var overlay = document.getElementById('overlay');
  overlay.className = 'gameover';
  var diffCfg = DIFFICULTY_CONFIG[game.difficulty];
  var lang = I18n.getLang();
  var diffLabel = diffCfg.label[lang] || diffCfg.label.en;
  var escText = I18n.t('esc.menu');
  overlay.innerHTML = '<h2 style=\"color:#ff4757;\">' + I18n.t('gameover.title') + '</h2>' +
    '<div class=\"subtitle\">' +
      I18n.t('gameover.level') + ': ' + game.level + ' &nbsp; (' + diffLabel + ')<br>' +
      I18n.t('gameover.score') + ': ' + game.score + '<br>' +
      I18n.t('gameover.time') + ': ' + formatTime(game.timer) +
    '</div>' +
    '<div class=\"key-hint\">' + I18n.t('gameover.restart') + '</div>' +
    '<div class=\"key-hint\" style=\"font-size:13px;color:#aaa;animation:none;margin-top:6px;\">' + escText + '</div>';
  overlay.classList.remove('hidden');
}

// ---- Effect Log ----

function setEffectMsg(msg, cssClass, duration) {
  game.effectMsg = msg;
  game.effectTimer = duration;
  updateEffectLog();
}

function updateEffectLog() {
  const log = document.getElementById('effect-log');
  if (!log) return;

  log.textContent = game.effectMsg;
  log.className = '';
  if (game.effectMsg && game.effectTimer > 0) {
    // Determine class from message content
    if (game.effectMsg.includes('❄️') || game.effectMsg.includes('Ice')) log.className = 'ice';
    else if (game.effectMsg.includes('⚡') || game.effectMsg.includes('stun')) log.className = 'lightning';
    else if (game.effectMsg.includes('🧊') || game.effectMsg.includes('frozen')) log.className = 'freeze';
    else if (game.effectMsg.includes('🔥') || game.effectMsg.includes('sped')) log.className = 'boost';
    else if (game.effectMsg.includes('🎉')) log.className = 'ice';
  }
}

// ---- UI Updates ----

function updateUI() {
  // Lives
  const hearts = '♥'.repeat(Math.max(0, game.lives)) + '♡'.repeat(Math.max(0, 3 - game.lives));
  document.getElementById('lives-display').textContent = hearts;

  // Score
  document.getElementById('score-display').textContent = game.score;

  // Level
  document.getElementById('level-display').textContent = game.level;

  // Timer
  document.getElementById('timer-display').textContent = formatTime(game.timer);

  // Sudoku stats
  const rowsDone = game.completed.row.filter(Boolean).length;
  const colsDone = game.completed.col.filter(Boolean).length;
  const boxesDone = game.completed.box.filter(Boolean).length;

  document.getElementById('rows-done').textContent = rowsDone;
  document.getElementById('cols-done').textContent = colsDone;
  document.getElementById('boxes-done').textContent = boxesDone;

  // Color completed stats
  ['rows-done', 'cols-done', 'boxes-done'].forEach(id => {
    const el = document.getElementById(id);
    if (el && parseInt(el.textContent) === 6) {
      el.style.color = '#2ecc71';
    } else {
      el.style.color = '';
    }
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ---- Sudoku DOM Rendering ----

function renderSudoku() {
  const cells = document.querySelectorAll('#sudoku-grid td');
  cells.forEach(td => {
    const r = parseInt(td.dataset.row);
    const c = parseInt(td.dataset.col);

    // Clear dynamic classes
    td.classList.remove('selected', 'given', 'wrong-flash', 'correct-flash');

    // Determine what to show
    const givenVal = game.sudokuGrid[r][c];
    const playerVal = game.playerGrid[r][c];

    if (givenVal !== 0) {
      // Pre-filled given cell
      td.textContent = givenVal;
      td.classList.add('given');
    } else if (playerVal !== 0) {
      // Player has filled this cell (correctly, since we validate on input)
      td.textContent = playerVal;
    } else {
      // Empty
      td.textContent = '';
    }

    // Selection highlight
    if (r === game.selectedCell.row && c === game.selectedCell.col) {
      td.classList.add('selected');
    }
  });
}

// ---- Canvas Rendering ----

function renderPvPCanvas() {
  var ctx = game.ctx;
  var canvas = game.canvas;
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // PvP Arena background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = '22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ ARENA ⚔️', canvas.width / 2, 50);

  // Player labels
  ctx.fillStyle = '#2ecc71';
  ctx.font = '16px monospace';
  ctx.fillText('PLAYER 1', canvas.width / 4, canvas.height / 2 - 20);
  ctx.fillText('PLAYER 2', canvas.width * 3 / 4, canvas.height / 2 - 20);

  // Keyboard hints
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Keyboard 1-6', canvas.width / 4, canvas.height / 2 + 10);
  ctx.fillText('Mouse click', canvas.width * 3 / 4, canvas.height / 2 + 10);

  // VS
  ctx.fillStyle = '#ff4757';
  ctx.font = '28px monospace';
  ctx.fillText('VS', canvas.width / 2, canvas.height / 2);

  // Timer
  var mins = Math.floor(PvP.timer / 60);
  var secs = Math.floor(PvP.timer % 60);
  ctx.fillStyle = '#ffd700';
  ctx.font = '18px monospace';
  ctx.fillText(mins + ':' + (secs < 10 ? '0' : '') + secs, canvas.width / 2, canvas.height - 30);

  // Winner banner
  if (PvP.winner) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 60);
    ctx.fillStyle = '#ffd700';
    ctx.font = '24px monospace';
    ctx.fillText('PLAYER ' + PvP.winner + ' WINS!', canvas.width / 2, canvas.height / 2 + 5);
  }
}

function render() {
  const ctx = game.ctx;
  const canvas = game.canvas;

  // Clear
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!game.tileMap) {
    // No map yet — draw placeholder
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#444';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Layer 1: Floor and wall tiles
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const px = col * TILE_SIZE;
      const py = row * TILE_SIZE;
      const tile = game.tileMap[row][col];

      if (tile === 0) {
        // Floor — subtle checkerboard for depth
        const shade = (row + col) % 2 === 0 ? '#1e1e38' : '#1a1a32';
        ctx.fillStyle = shade;
      } else {
        // Wall
        ctx.fillStyle = '#3a3a4a';
      }
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Subtle grid line
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  // Layer 2: Ice walls
  for (const wall of game.iceWalls) {
    const px = wall.x * TILE_SIZE;
    const py = wall.y * TILE_SIZE;

    // Ice block
    const alpha = Math.min(0.9, 0.5 + wall.timer / 5.0 * 0.4);
    ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // Ice crystal pattern
    ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + TILE_SIZE / 2, py + 4);
    ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE - 4);
    ctx.moveTo(px + 4, py + TILE_SIZE / 2);
    ctx.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE / 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Layer 3: Monsters
  for (const m of game.monsters) {
    const px = m.tileX * TILE_SIZE;
    const py = m.tileY * TILE_SIZE;
    const size = TILE_SIZE - 4;

    // Body color based on state
    let bodyColor = '#e74c3c'; // Red (chasing)
    if (m.state === 'stunned') {
      bodyColor = (Math.floor(Date.now() / 150) % 2 === 0) ? '#f1c40f' : '#e67e22'; // Yellow-orange flash
    } else if (m.state === 'frozen') {
      bodyColor = (Math.floor(Date.now() / 200) % 2 === 0) ? '#3498db' : '#2980b9'; // Blue flash
    }

    ctx.fillStyle = bodyColor;
    ctx.fillRect(px + 2, py + 2, size, size);

    // Eyes (white)
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + 7, py + 6, 7, 7);
    ctx.fillRect(px + 18, py + 6, 7, 7);

    // Pupils (black) — look toward player
    const eyeDX = Math.sign(game.playerTileX - m.tileX) * 2;
    const eyeDY = Math.sign(game.playerTileY - m.tileY) * 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(px + 9 + eyeDX, py + 8 + eyeDY, 3, 3);
    ctx.fillRect(px + 20 + eyeDX, py + 8 + eyeDY, 3, 3);

    // State indicator
    if (m.state === 'stunned') {
      // Stars above head
      ctx.fillStyle = '#f1c40f';
      ctx.font = '10px monospace';
      ctx.fillText('⚡', px + TILE_SIZE / 2 - 5, py - 2);
    } else if (m.state === 'frozen') {
      ctx.fillStyle = '#3498db';
      ctx.font = '10px monospace';
      ctx.fillText('❄️', px + TILE_SIZE / 2 - 5, py - 2);
    }
  }

  // Layer 4: Player
  const ppx = game.playerTileX * TILE_SIZE;
  const ppy = game.playerTileY * TILE_SIZE;
  const psize = TILE_SIZE - 4;

  // Invulnerability flashing
  if (game.invulnTimer > 0 && Math.floor(Date.now() / 120) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  // Body
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(ppx + 2, ppy + 2, psize, psize);

  // Direction indicator (small triangle or eyes)
  ctx.fillStyle = '#fff';
  const eyeCX = ppx + TILE_SIZE / 2;
  const eyeCY = ppy + TILE_SIZE / 2;
  // Draw eyes looking in movement direction
  const lookX = game.lastMoveDir.dx * 5;
  const lookY = game.lastMoveDir.dy * 5;
  ctx.fillRect(ppx + 7 + lookX, ppy + 6 + lookY, 6, 5);
  ctx.fillRect(ppx + 19 + lookX, ppy + 6 + lookY, 6, 5);
  ctx.fillStyle = '#000';
  ctx.fillRect(ppx + 9 + lookX, ppy + 7 + lookY, 2, 3);
  ctx.fillRect(ppx + 21 + lookX, ppy + 7 + lookY, 2, 3);

  ctx.globalAlpha = 1.0;

  // Layer 5: Wrong-answer boost indicator
  if (typeof wrongAnswerBoostActive !== 'undefined' && wrongAnswerBoostActive) {
    // Red border pulse around the canvas
    const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.5;
    ctx.strokeStyle = `rgba(255, 70, 70, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.lineWidth = 1;
  }
}

// ---- Boot ----

// Start when the page loads
window.addEventListener('DOMContentLoaded', init);
