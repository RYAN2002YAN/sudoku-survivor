// ============================================================
// pvp.js — Local PvP Game Mode (Arena: Sudoku Race)
// Two players, same puzzle, first to complete wins.
// ============================================================

var PvP = {
  active: false,
  mode: 'arena',        // 'arena' | 'survivor'
  puzzle: null,         // shared puzzle grid
  solution: null,       // shared solution
  size: 6,

  // Player 1
  p1: {
    grid: null,          // current filled state
    selected: { row: -1, col: -1 },
    completed: { row: [], col: [], box: [] },
    done: false,
    score: 0,
    finishedAt: 0,
  },

  // Player 2
  p2: {
    grid: null,
    selected: { row: -1, col: -1 },
    completed: { row: [], col: [], box: [] },
    done: false,
    score: 0,
    finishedAt: 0,
  },

  timer: 0,
  winner: null,          // 1 or 2 or null
  gameOver: false,
};

// ---- Init ----

function pvpInit(size, emptyCells) {
  configureSudokuEngine(size);
  var gen = generatePuzzle(emptyCells);

  PvP.active = true;
  PvP.mode = 'arena';
  PvP.size = size;
  PvP.puzzle = gen.puzzle.map(function (r) { return r.slice(); });
  PvP.solution = gen.solution.map(function (r) { return r.slice(); });
  PvP.timer = 0;
  PvP.winner = null;
  PvP.gameOver = false;

  // Player 1 state
  PvP.p1.grid = gen.puzzle.map(function (r) { return r.slice(); });
  PvP.p1.selected = { row: -1, col: -1 };
  PvP.p1.completed = makeBoolArrays(size);
  PvP.p1.done = false;
  PvP.p1.score = 0;
  PvP.p1.finishedAt = 0;

  // Player 2 state
  PvP.p2.grid = gen.puzzle.map(function (r) { return r.slice(); });
  PvP.p2.selected = { row: -1, col: -1 };
  PvP.p2.completed = makeBoolArrays(size);
  PvP.p2.done = false;
  PvP.p2.score = 0;
  PvP.p2.finishedAt = 0;

  buildPvPUI();
  updateBothPlayers(game.gridSize);
}

// ---- Helpers ----

function makeBoolArrays(size) {
  var boxCount = size === 6 ? 6 : 9;
  var arrs = { row: [], col: [], box: [] };
  for (var i = 0; i < size; i++) { arrs.row.push(false); arrs.col.push(false); }
  for (var i = 0; i < boxCount; i++) arrs.box.push(false);
  return arrs;
}

function pvpPlayerInput(player, value) {
  if (!PvP.active || PvP.gameOver) return;
  if (player.selected.row < 0 || player.selected.col < 0) return;
  if (player.done) return;

  var r = player.selected.row;
  var c = player.selected.col;

  // Can't modify given cells
  if (PvP.puzzle[r][c] !== 0) return;

  var correct = PvP.solution[r][c];

  if (value === correct) {
    player.grid[r][c] = value;
    player.score += 10;
    pvpFlashCell(player === PvP.p1 ? 1 : 2, r, c, 'correct-flash');
    pvpCheckCompletion(player);
    player.selected = { row: -1, col: -1 };
    SoundManager.sfxCorrect();
  } else {
    pvpFlashCell(player === PvP.p1 ? 1 : 2, r, c, 'wrong-flash');
    SoundManager.sfxWrong();
  }

  renderPvPSudoku(1);
  renderPvPSudoku(2);
  updatePvPStats();
}

function pvpCheckCompletion(player) {
  var size = PvP.size;
  var grid = player.grid;
  var done = player.done;

  for (var r = 0; r < size; r++) {
    if (!player.completed.row[r] && isRowComplete(grid, r)) {
      player.completed.row[r] = true;
      player.score += 30;
    }
  }
  for (var c = 0; c < size; c++) {
    if (!player.completed.col[c] && isColComplete(grid, c)) {
      player.completed.col[c] = true;
      player.score += 30;
    }
  }
  var boxCount = size === 6 ? 6 : 9;
  for (var b = 0; b < boxCount; b++) {
    if (!player.completed.box[b] && isBoxComplete(grid, b)) {
      player.completed.box[b] = true;
      player.score += 50;
    }
  }

  // Check if this player just finished
  if (!player.done && isPuzzleComplete(grid)) {
    player.done = true;
    player.finishedAt = PvP.timer;
    if (!PvP.winner) {
      PvP.winner = player === PvP.p1 ? 1 : 2;
      PvP.gameOver = true;
      SoundManager.sfxLevelClear();
      showPvPResult();
    }
  }
}

function pvpSelectCell(playerNum, row, col) {
  if (!PvP.active || PvP.gameOver) return;
  if (PvP.puzzle[row][col] !== 0) return; // given cell

  var player = playerNum === 1 ? PvP.p1 : PvP.p2;
  if (player.done) return;

  if (player.selected.row === row && player.selected.col === col) {
    player.selected = { row: -1, col: -1 };
  } else {
    player.selected = { row: row, col: col };
  }
  renderPvPSudoku(playerNum);
}

// ---- UI Build ----

function buildPvPUI() {
  // Hide single-player panels, show PvP layout
  document.getElementById('dungeon-panel').style.display = 'none';
  document.getElementById('sudoku-panel').style.display = 'none';

  // Show PvP container
  var pvpDiv = document.getElementById('pvp-container');
  if (!pvpDiv) {
    pvpDiv = document.createElement('div');
    pvpDiv.id = 'pvp-container';
    pvpDiv.innerHTML =
      '<div id="pvp-top-bar">' +
        '<span id="pvp-timer">0:00</span>' +
        '<span id="pvp-winner-msg"></span>' +
        '<button id="pvp-quit" onclick="pvpQuit()">✕</button>' +
      '</div>' +
      '<div id="pvp-boards">' +
        '<div class="pvp-side" id="pvp-left">' +
          '<h3>🎮 P1 <span class="pvp-progress" id="p1-progress"></span></h3>' +
          '<table class="pvp-grid" id="pvp-grid-1"></table>' +
          '<div class="pvp-numpad" id="pvp-numpad-1"></div>' +
        '</div>' +
        '<div class="pvp-divider"></div>' +
        '<div class="pvp-side" id="pvp-right">' +
          '<h3>🎮 P2 <span class="pvp-progress" id="p2-progress"></span></h3>' +
          '<table class="pvp-grid" id="pvp-grid-2"></table>' +
          '<div class="pvp-numpad" id="pvp-numpad-2"></div>' +
        '</div>' +
      '</div>';
    document.getElementById('game-main').appendChild(pvpDiv);
  }
  pvpDiv.style.display = 'block';

  buildPvPGrid(1);
  buildPvPGrid(2);
  buildPvPNumpad(1);
  buildPvPNumpad(2);
  renderPvPSudoku(1);
  renderPvPSudoku(2);
  updatePvPStats();
}

function buildPvPGrid(playerNum) {
  var table = document.getElementById('pvp-grid-' + playerNum);
  table.innerHTML = '';
  var size = PvP.size;
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
      td.addEventListener('click', (function (pn, row, col) {
        return function () { pvpSelectCell(pn, row, col); };
      })(playerNum, r, c));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function buildPvPNumpad(playerNum) {
  var pad = document.getElementById('pvp-numpad-' + playerNum);
  pad.innerHTML = '';
  var maxNum = PvP.size === 6 ? 6 : 9;
  for (var v = 1; v <= maxNum; v++) {
    var btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.textContent = v;
    btn.addEventListener('click', (function (pn, val) {
      return function () {
        var player = pn === 1 ? PvP.p1 : PvP.p2;
        pvpPlayerInput(player, val);
      };
    })(playerNum, v));
    pad.appendChild(btn);
  }
}

function renderPvPSudoku(playerNum) {
  var player = playerNum === 1 ? PvP.p1 : PvP.p2;
  var table = document.getElementById('pvp-grid-' + playerNum);
  var cells = table.querySelectorAll('td');

  cells.forEach(function (td) {
    var r = parseInt(td.dataset.row);
    var c = parseInt(td.dataset.col);
    td.classList.remove('selected', 'given', 'wrong-flash', 'correct-flash');

    var givenVal = PvP.puzzle[r][c];
    var playerVal = player.grid[r][c];

    if (givenVal !== 0) {
      td.textContent = givenVal;
      td.classList.add('given');
    } else if (playerVal !== 0) {
      td.textContent = playerVal;
    } else {
      td.textContent = '';
    }

    if (r === player.selected.row && c === player.selected.col) {
      td.classList.add('selected');
    }
  });
}

function pvpFlashCell(playerNum, row, col, cls) {
  var cell = document.querySelector('#pvp-grid-' + playerNum + ' td[data-row="' + row + '"][data-col="' + col + '"]');
  if (cell) {
    cell.classList.add(cls);
    setTimeout(function () { cell.classList.remove(cls); }, 400);
  }
}

function updatePvPStats() {
  var p1 = PvP.p1, p2 = PvP.p2;
  var p1Done = p1.completed.row.filter(function (x) { return x; }).length;
  var p2Done = p2.completed.row.filter(function (x) { return x; }).length;
  document.getElementById('p1-progress').textContent = p1.done ? '✅' : p1Done + '/' + PvP.size + '行';
  document.getElementById('p2-progress').textContent = p2.done ? '✅' : p2Done + '/' + PvP.size + '行';
}

function updateBothPlayers(size) {
  // Update player grids when grid size changes
  configureSudokuEngine(size);
  var gen = generatePuzzle(size === 6 ? 12 : 27);
  PvP.size = size;
  PvP.puzzle = gen.puzzle.map(function (r) { return r.slice(); });
  PvP.solution = gen.solution.map(function (r) { return r.slice(); });

  PvP.p1.grid = gen.puzzle.map(function (r) { return r.slice(); });
  PvP.p1.completed = makeBoolArrays(size);
  PvP.p1.done = false;

  PvP.p2.grid = gen.puzzle.map(function (r) { return r.slice(); });
  PvP.p2.completed = makeBoolArrays(size);
  PvP.p2.done = false;

  PvP.winner = null;
  PvP.gameOver = false;
  PvP.timer = 0;
  document.getElementById('pvp-winner-msg').textContent = '';

  buildPvPGrid(1);
  buildPvPGrid(2);
  buildPvPNumpad(1);
  buildPvPNumpad(2);
  renderPvPSudoku(1);
  renderPvPSudoku(2);
  updatePvPStats();
}

function showPvPResult() {
  var msg = document.getElementById('pvp-winner-msg');
  msg.textContent = 'Player ' + PvP.winner + ' wins! (' + formatPvPTime(PvP.timer) + ')';
  msg.style.color = '#ffd700';
}

function formatPvPTime(sec) {
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function pvpQuit() {
  PvP.active = false;
  document.getElementById('pvp-container').style.display = 'none';
  document.getElementById('dungeon-panel').style.display = '';
  document.getElementById('sudoku-panel').style.display = '';
  game.state = 'menu';
  BGM.setScene('menu');
  buildMenuOverlay();
}

function pvpUpdate(dt) {
  if (!PvP.active || PvP.gameOver) return;
  PvP.timer += dt;
  document.getElementById('pvp-timer').textContent = formatPvPTime(PvP.timer);
}

// ---- Keyboard for PvP ----

function pvpHandleKey(playerNum, key) {
  if (!PvP.active || PvP.gameOver) return false;

  var player = playerNum === 1 ? PvP.p1 : PvP.p2;
  if (player.done) return false;

  // Number keys
  var digit = parseInt(key);
  if (digit >= 1 && digit <= PvP.size) {
    pvpPlayerInput(player, digit);
    return true;
  }
  return false;
}
