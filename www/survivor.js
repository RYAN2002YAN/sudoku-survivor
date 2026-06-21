// ============================================================
// survivor.js — PvP Survivor Mode
// Two players in shared dungeon. Monsters chase nearest player.
// Players can collide & block each other. First to finish Sudoku
// OR last survivor wins.
// ============================================================

var Survivor = {
  active: false,
  size: 6,
  timer: 0,
  winner: null,         // 0 (draw), 1, or 2

  // Shared dungeon
  tileMap: null,
  monsters: [],
  iceWalls: [],

  // Player states
  p1: {
    tileX: 3, tileY: 5, pixelX: 0, pixelY: 0,
    lives: 3, invulnTimer: 0,
    lastMoveDir: { dx: 0, dy: -1 },
    moveCooldown: 0,
    grid: null, selected: { row: -1, col: -1 },
    completed: null, done: false, score: 0,
    color: '#2ecc71',
  },
  p2: {
    tileX: 7, tileY: 5, pixelX: 0, pixelY: 0,
    lives: 3, invulnTimer: 0,
    lastMoveDir: { dx: 0, dy: -1 },
    moveCooldown: 0,
    grid: null, selected: { row: -1, col: -1 },
    completed: null, done: false, score: 0,
    color: '#e74c3c',
  },

  // Input tracking
  p1Held: [],     // Player 1 (WASD)
  p2Held: [],     // Player 2 (Arrow keys)
};

var SV_MOVE_INTERVAL = 0.12;
var SV_WALL_DENSITY = 0.12;

// ---- Init ----

function survivorInit(size, emptyCells) {
  configureSudokuEngine(size);
  var gen = generatePuzzle(emptyCells);

  Survivor.active = true;
  Survivor.size = size;
  Survivor.timer = 0;
  Survivor.winner = 0;
  Survivor.tileMap = generateDungeonMap(SV_WALL_DENSITY);
  Survivor.monsters = [];
  Survivor.iceWalls = [];

  // Spawn 3 monsters
  for (var i = 0; i < 3; i++) {
    var pos = findSurvivorSpawn(5);
    if (pos) {
      var m = createMonster(i, pos.x, pos.y, 2.5);
      m.moveTimer = i * 0.3;
      Survivor.monsters.push(m);
    }
  }

  // Init both players
  initSurvivorPlayer(Survivor.p1, 3, 5, gen);
  initSurvivorPlayer(Survivor.p2, 7, 5, gen);

  // Ensure spawn positions are walkable
  Survivor.tileMap[5][3] = 0;
  Survivor.tileMap[5][7] = 0;

  buildSurvivorUI();
  renderSurvivorSudoku(1);
  renderSurvivorSudoku(2);
  updateSurvivorStats();
  updateSurvivorCanvasSize();

  game.state = 'survivor';
}

function initSurvivorPlayer(p, tx, ty, gen) {
  p.tileX = tx;
  p.tileY = ty;
  p.pixelX = tx * TILE_SIZE;
  p.pixelY = ty * TILE_SIZE;
  p.lives = 3;
  p.invulnTimer = 0;
  p.moveCooldown = 0;
  p.lastMoveDir = { dx: 0, dy: -1 };
  p.grid = gen.puzzle.map(function (r) { return r.slice(); });
  p.selected = { row: -1, col: -1 };
  p.completed = makeSurvivorBoolArrays(Survivor.size);
  p.done = false;
  p.score = 0;
}

function makeSurvivorBoolArrays(size) {
  var bc = size === 6 ? 6 : 9;
  var a = { row: [], col: [], box: [] };
  for (var i = 0; i < size; i++) { a.row.push(false); a.col.push(false); }
  for (var i = 0; i < bc; i++) a.box.push(false);
  return a;
}

function findSurvivorSpawn(minDist) {
  var cands = [];
  for (var r = 0; r < MAP_ROWS; r++) {
    for (var c = 0; c < MAP_COLS; c++) {
      if (Survivor.tileMap[r][c] === 0) {
        var d1 = Math.abs(r - 5) + Math.abs(c - 3);
        var d2 = Math.abs(r - 5) + Math.abs(c - 7);
        if (d1 >= minDist && d2 >= minDist) cands.push({ x: c, y: r });
      }
    }
  }
  if (cands.length > 0) return cands[Math.floor(Math.random() * cands.length)];
  return { x: 1, y: 1 };
}

// ---- UI ----

var survivorPuzzle = null;
var survivorSolution = null;

function buildSurvivorUI() {
  document.getElementById('dungeon-panel').style.display = '';
  document.getElementById('sudoku-panel').style.display = 'none';
  document.getElementById('pvp-container').style.display = 'none';

  var svDiv = document.getElementById('survivor-container');
  if (!svDiv) {
    svDiv = document.createElement('div');
    svDiv.id = 'survivor-container';
    svDiv.innerHTML =
      '<div id="sv-top-bar">' +
        '<span id="sv-timer">0:00</span>' +
        '<span id="sv-winner-msg"></span>' +
        '<button id="sv-quit" onclick="survivorQuit()">✕</button>' +
      '</div>' +
      '<div id="sv-main">' +
        '<div class="sv-side" id="sv-left">' +
          '<h3>🎮 P1 <span class="sv-lives" id="sv-p1-lives">♥♥♥</span></h3>' +
          '<table class="sv-grid" id="sv-grid-1"></table>' +
          '<div class="sv-numpad" id="sv-numpad-1"></div>' +
        '</div>' +
        '<div id="sv-dungeon-wrap">' +
          '<canvas id="sv-canvas" width="384" height="384"></canvas>' +
        '</div>' +
        '<div class="sv-side" id="sv-right">' +
          '<h3>P2 🎮 <span class="sv-lives" id="sv-p2-lives">♥♥♥</span></h3>' +
          '<table class="sv-grid" id="sv-grid-2"></table>' +
          '<div class="sv-numpad" id="sv-numpad-2"></div>' +
        '</div>' +
      '</div>';
    document.getElementById('game-main').appendChild(svDiv);
  }
  svDiv.style.display = 'block';
  document.getElementById('dungeon-panel').style.display = 'none';

  configureSudokuEngine(Survivor.size);
  var gen = generatePuzzle(Survivor.size === 6 ? 12 : 27);
  survivorPuzzle = gen.puzzle;
  survivorSolution = gen.solution;

  Survivor.p1.grid = survivorPuzzle.map(function (r) { return r.slice(); });
  Survivor.p2.grid = survivorPuzzle.map(function (r) { return r.slice(); });

  buildSurvivorGrid(1);
  buildSurvivorGrid(2);
  buildSurvivorNumpad(1);
  buildSurvivorNumpad(2);

  Survivor.p1.pixelX = Survivor.p1.tileX * TILE_SIZE;
  Survivor.p1.pixelY = Survivor.p1.tileY * TILE_SIZE;
  Survivor.p2.pixelX = Survivor.p2.tileX * TILE_SIZE;
  Survivor.p2.pixelY = Survivor.p2.tileY * TILE_SIZE;
}

function buildSurvivorGrid(pn) {
  var table = document.getElementById('sv-grid-' + pn);
  table.innerHTML = '';
  var size = Survivor.size;
  var boxRows = size === 6 ? 2 : 3;
  var boxCols = size === 6 ? 3 : 3;

  for (var r = 0; r < size; r++) {
    var tr = document.createElement('tr');
    if ((r + 1) % boxRows === 0 && r < size - 1) tr.classList.add('box-border-bottom');
    for (var c = 0; c < size; c++) {
      var td = document.createElement('td');
      td.dataset.row = r;
      td.dataset.col = c;
      if ((c + 1) % boxCols === 0 && c < size - 1) td.classList.add('box-border-right');
      td.addEventListener('click', (function (n, row, col) {
        return function () { survivorSelectCell(n, row, col); };
      })(pn, r, c));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function buildSurvivorNumpad(pn) {
  var pad = document.getElementById('sv-numpad-' + pn);
  pad.innerHTML = '';
  var maxNum = Survivor.size === 6 ? 6 : 9;
  for (var v = 1; v <= maxNum; v++) {
    var btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.textContent = v;
    btn.addEventListener('click', (function (n, val) {
      return function () {
        var p = n === 1 ? Survivor.p1 : Survivor.p2;
        survivorPlayerInput(p, val);
      };
    })(pn, v));
    pad.appendChild(btn);
  }
}

function renderSurvivorSudoku(pn) {
  var player = pn === 1 ? Survivor.p1 : Survivor.p2;
  var table = document.getElementById('sv-grid-' + pn);
  var cells = table.querySelectorAll('td');
  cells.forEach(function (td) {
    var r = parseInt(td.dataset.row);
    var c = parseInt(td.dataset.col);
    td.classList.remove('selected', 'given');

    var gv = survivorPuzzle[r][c];
    var pv = player.grid[r][c];

    if (gv !== 0) { td.textContent = gv; td.classList.add('given'); }
    else if (pv !== 0) { td.textContent = pv; }
    else { td.textContent = ''; }

    if (r === player.selected.row && c === player.selected.col) td.classList.add('selected');
  });
}

function updateSurvivorStats() {
  var p1r = Survivor.p1.completed.row.filter(function (x) { return x; }).length;
  var p2r = Survivor.p2.completed.row.filter(function (x) { return x; }).length;
  document.getElementById('sv-p1-lives').textContent = '♥'.repeat(Survivor.p1.lives) + '♡'.repeat(3 - Survivor.p1.lives);
  document.getElementById('sv-p2-lives').textContent = '♥'.repeat(Survivor.p2.lives) + '♡'.repeat(3 - Survivor.p2.lives);
  document.getElementById('sv-timer').textContent = formatSurvivorTime(Survivor.timer);
}

function formatSurvivorTime(sec) {
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function updateSurvivorCanvasSize() {
  // Canvas is fixed 384x384
}

// ---- Player Input ----

function survivorSelectCell(pn, row, col) {
  if (!Survivor.active || Survivor.winner) return;
  if (survivorPuzzle[row][col] !== 0) return;
  var p = pn === 1 ? Survivor.p1 : Survivor.p2;
  if (p.lives <= 0 || p.done) return;

  if (p.selected.row === row && p.selected.col === col) {
    p.selected = { row: -1, col: -1 };
  } else {
    p.selected = { row: row, col: col };
  }
  renderSurvivorSudoku(pn);
}

function survivorPlayerInput(player, value) {
  if (!Survivor.active || Survivor.winner) return;
  if (player.lives <= 0 || player.done) return;
  if (player.selected.row < 0 || player.selected.col < 0) return;

  var r = player.selected.row;
  var c = player.selected.col;
  if (survivorPuzzle[r][c] !== 0) return;

  if (value === survivorSolution[r][c]) {
    player.grid[r][c] = value;
    player.score += 10;
    survivorCheckCompletion(player);
    player.selected = { row: -1, col: -1 };
    SoundManager.sfxCorrect();
  } else {
    SoundManager.sfxWrong();
    // Speed boost all monsters
    applyWrongAnswerBoost(Survivor.monsters);
  }

  renderSurvivorSudoku(player === Survivor.p1 ? 1 : 2);
  updateSurvivorStats();
}

function survivorCheckCompletion(player) {
  var size = Survivor.size;
  var grid = player.grid;

  for (var r = 0; r < size; r++) {
    if (!player.completed.row[r] && isRowComplete(grid, r)) {
      player.completed.row[r] = true;
      player.score += 30;
      // Ice wall behind this player
      spawnIceWall(player.tileX, player.tileY, player.lastMoveDir, Survivor.tileMap, Survivor.iceWalls, Survivor.monsters);
      SoundManager.sfxRowComplete();
    }
  }
  for (var c = 0; c < size; c++) {
    if (!player.completed.col[c] && isColComplete(grid, c)) {
      player.completed.col[c] = true;
      player.score += 30;
    }
  }
  var bc = size === 6 ? 6 : 9;
  for (var b = 0; b < bc; b++) {
    if (!player.completed.box[b] && isBoxComplete(grid, b)) {
      player.completed.box[b] = true;
      player.score += 50;
    }
  }

  if (!player.done && isPuzzleComplete(grid)) {
    player.done = true;
    Survivor.winner = player === Survivor.p1 ? 1 : 2;
    SoundManager.sfxLevelClear();
    document.getElementById('sv-winner-msg').textContent = 'P' + Survivor.winner + ' WINS by Sudoku!';
    document.getElementById('sv-winner-msg').style.color = '#ffd700';
  }
}

// ---- Game Loop ----

function survivorUpdate(dt) {
  if (!Survivor.active || Survivor.winner) return;

  Survivor.timer += dt;

  // 1. Player movement
  survivorMovePlayer(Survivor.p1, Survivor.p1Held, dt);
  survivorMovePlayer(Survivor.p2, Survivor.p2Held, dt);

  // 2. Monster AI — chase nearest player
  updateMonsters(Survivor.monsters, dt, Survivor.p1.tileX, Survivor.p1.tileY, Survivor.tileMap, Survivor.iceWalls);
  // Make monsters also aware of P2: redirect closest to nearest player
  for (var i = 0; i < Survivor.monsters.length; i++) {
    var m = Survivor.monsters[i];
    if (m.state === 'chasing') {
      var d1 = Math.abs(m.tileX - Survivor.p1.tileX) + Math.abs(m.tileY - Survivor.p1.tileY);
      var d2 = Math.abs(m.tileX - Survivor.p2.tileX) + Math.abs(m.tileY - Survivor.p2.tileY);
      if (d2 < d1 && Survivor.p2.lives > 0) {
        // Recalculate path to P2
        if (m.moveCooldown <= 0) {
          var np = astar(m.tileX, m.tileY, Survivor.p2.tileX, Survivor.p2.tileY, Survivor.tileMap, Survivor.iceWalls);
          if (np && np.length > 1) { m.path = np; m.pathIndex = 1; m.moveCooldown = 0.3; }
        }
      }
    }
  }

  // 3. Ice wall decay
  updateIceWalls(Survivor.iceWalls, dt);

  // 4. Wrong answer boost
  updateWrongAnswerBoost(Survivor.monsters, dt);

  // 5. Invulnerability decay
  [Survivor.p1, Survivor.p2].forEach(function (p) {
    if (p.invulnTimer > 0) { p.invulnTimer -= dt; if (p.invulnTimer < 0) p.invulnTimer = 0; }
  });

  // 6. Monster collision with both players
  for (var i = 0; i < Survivor.monsters.length; i++) {
    var m = Survivor.monsters[i];
    [Survivor.p1, Survivor.p2].forEach(function (p) {
      if (p.invulnTimer <= 0 && p.lives > 0 && m.tileX === p.tileX && m.tileY === p.tileY) {
        p.lives--;
        p.invulnTimer = 3.0;
        p.selected = { row: -1, col: -1 };
        SoundManager.sfxHit();
        if (p.lives <= 0) {
          p.lives = 0;
          // Check if other player wins by elimination
          var other = p === Survivor.p1 ? Survivor.p2 : Survivor.p1;
          if (other.lives > 0 && !Survivor.winner) {
            Survivor.winner = p === Survivor.p1 ? 2 : 1;
            SoundManager.sfxGameOver();
            document.getElementById('sv-winner-msg').textContent = 'P' + Survivor.winner + ' WINS by survival!';
            document.getElementById('sv-winner-msg').style.color = '#e74c3c';
          }
        }
      }
    });
  }

  updateSurvivorStats();
  renderSurvivorCanvas();
}

function survivorMovePlayer(p, held, dt) {
  if (p.lives <= 0) return;
  if (p.moveCooldown > 0) { p.moveCooldown -= dt; return; }
  if (held.length === 0) return;

  var dir = held[0];
  var nx = p.tileX + dir.dx;
  var ny = p.tileY + dir.dy;
  if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) return;
  if (Survivor.tileMap[ny][nx] === 1) return;
  if (Survivor.iceWalls.some(function (w) { return w.x === nx && w.y === ny; })) return;
  // Blocked by other player
  var other = p === Survivor.p1 ? Survivor.p2 : Survivor.p1;
  if (nx === other.tileX && ny === other.tileY && other.lives > 0) return;

  p.lastMoveDir = { dx: dir.dx, dy: dir.dy };
  p.tileX = nx;
  p.tileY = ny;
  p.pixelX = nx * TILE_SIZE;
  p.pixelY = ny * TILE_SIZE;
  p.moveCooldown = SV_MOVE_INTERVAL;
}

// ---- Canvas Rendering ----

function renderSurvivorCanvas() {
  var canvas = document.getElementById('sv-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var map = Survivor.tileMap;

  // Clear
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tiles
  for (var row = 0; row < MAP_ROWS; row++) {
    for (var col = 0; col < MAP_COLS; col++) {
      var px = col * TILE_SIZE;
      var py = row * TILE_SIZE;
      ctx.fillStyle = map[row][col] === 0 ? ((row + col) % 2 === 0 ? '#1e1e38' : '#1a1a32') : '#3a3a4a';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  // Ice walls
  Survivor.iceWalls.forEach(function (w) {
    var px = w.x * TILE_SIZE, py = w.y * TILE_SIZE;
    ctx.fillStyle = 'rgba(100, 180, 255, 0.7)';
    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  });

  // Monsters
  Survivor.monsters.forEach(function (m) {
    var px = m.tileX * TILE_SIZE, py = m.tileY * TILE_SIZE;
    ctx.fillStyle = m.state === 'stunned' ? '#f1c40f' : m.state === 'frozen' ? '#3498db' : '#e74c3c';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + 7, py + 6, 7, 7);
    ctx.fillRect(px + 18, py + 6, 7, 7);
  });

  // Player 1 (green)
  if (Survivor.p1.lives > 0) {
    var p1x = Survivor.p1.tileX * TILE_SIZE, p1y = Survivor.p1.tileY * TILE_SIZE;
    if (Survivor.p1.invulnTimer > 0 && Math.floor(Date.now() / 120) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(p1x + 2, p1y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(p1x + 12, p1y + 10, 8, 12); // P1 label
    ctx.globalAlpha = 1;
  }

  // Player 2 (red)
  if (Survivor.p2.lives > 0) {
    var p2x = Survivor.p2.tileX * TILE_SIZE, p2y = Survivor.p2.tileY * TILE_SIZE;
    if (Survivor.p2.invulnTimer > 0 && Math.floor(Date.now() / 120) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(p2x + 2, p2y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(p2x + 12, p2y + 10, 8, 12);
    ctx.globalAlpha = 1;
  }

  // Winner overlay
  if (Survivor.winner) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, canvas.height / 2 - 30, canvas.width, 60);
    ctx.fillStyle = Survivor.winner === 1 ? '#2ecc71' : '#e74c3c';
    ctx.font = '22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P' + Survivor.winner + ' WINS!', canvas.width / 2, canvas.height / 2 + 8);
  }
}

// ---- Input ----

function survivorHandleKey(e, isDown) {
  if (!Survivor.active) return false;

  // P1: WASD
  var p1Map = { 'KeyW': { dx: 0, dy: -1 }, 'KeyA': { dx: -1, dy: 0 }, 'KeyS': { dx: 0, dy: 1 }, 'KeyD': { dx: 1, dy: 0 } };
  // P2: Arrow keys
  var p2Map = { 'ArrowUp': { dx: 0, dy: -1 }, 'ArrowLeft': { dx: -1, dy: 0 }, 'ArrowDown': { dx: 0, dy: 1 }, 'ArrowRight': { dx: 1, dy: 0 } };

  if (p1Map[e.code]) {
    if (isDown) {
      var idx = Survivor.p1Held.findIndex(function (d) { return d.code === e.code; });
      if (idx >= 0) Survivor.p1Held.splice(idx, 1);
      Survivor.p1Held.unshift({ code: e.code, dx: p1Map[e.code].dx, dy: p1Map[e.code].dy });
    } else {
      var idx2 = Survivor.p1Held.findIndex(function (d) { return d.code === e.code; });
      if (idx2 >= 0) Survivor.p1Held.splice(idx2, 1);
    }
    return true;
  }

  if (p2Map[e.code]) {
    if (isDown) {
      var idx = Survivor.p2Held.findIndex(function (d) { return d.code === e.code; });
      if (idx >= 0) Survivor.p2Held.splice(idx, 1);
      Survivor.p2Held.unshift({ code: e.code, dx: p2Map[e.code].dx, dy: p2Map[e.code].dy });
    } else {
      var idx2 = Survivor.p2Held.findIndex(function (d) { return d.code === e.code; });
      if (idx2 >= 0) Survivor.p2Held.splice(idx2, 1);
    }
    return true;
  }

  // Number keys for P1 Sudoku input
  if (isDown && e.code >= 'Digit1' && e.code <= 'Digit9') {
    var val = parseInt(e.code.replace('Digit', ''));
    if (val <= Survivor.size && Survivor.p1.lives > 0 && !Survivor.p1.done) {
      survivorPlayerInput(Survivor.p1, val);
      return true;
    }
  }

  // Numpad keys for P2 Sudoku input
  if (isDown && e.code >= 'Numpad1' && e.code <= 'Numpad9') {
    var val = parseInt(e.code.replace('Numpad', ''));
    if (val <= Survivor.size && Survivor.p2.lives > 0 && !Survivor.p2.done) {
      survivorPlayerInput(Survivor.p2, val);
      return true;
    }
  }

  return false;
}

function survivorQuit() {
  Survivor.active = false;
  document.getElementById('survivor-container').style.display = 'none';
  document.getElementById('dungeon-panel').style.display = '';
  document.getElementById('sudoku-panel').style.display = '';
  Survivor.p1Held = [];
  Survivor.p2Held = [];
  game.state = 'menu';
  BGM.setScene('menu');
  buildMenuOverlay();
}
