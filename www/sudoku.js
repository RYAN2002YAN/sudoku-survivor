// ============================================================
// sudoku.js — 6×6 Sudoku Engine
// Generates valid puzzles, validates moves, detects completions
// ============================================================

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Box layout for 6×6 with 2×3 boxes:
 *   Box 0: rows 0-1, cols 0-2    Box 1: rows 0-1, cols 3-5
 *   Box 2: rows 2-3, cols 0-2    Box 3: rows 2-3, cols 3-5
 *   Box 4: rows 4-5, cols 0-2    Box 5: rows 4-5, cols 3-5
 */
function getBoxIndex(row, col) {
  return Math.floor(row / 2) * 2 + Math.floor(col / 3);
}

/**
 * Get all cell coordinates belonging to a given box (0-5).
 */
function getBoxCells(boxIdx) {
  const boxRow = Math.floor(boxIdx / 2); // 0, 1, 2
  const boxCol = boxIdx % 2;             // 0, 1
  const startRow = boxRow * 2;
  const startCol = boxCol * 3;
  const cells = [];
  for (let r = startRow; r < startRow + 2; r++) {
    for (let c = startCol; c < startCol + 3; c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/**
 * Check if placing `value` at (row, col) is valid per Sudoku rules.
 * No duplicate in the same row, column, or 2×3 box.
 */
function isValidMove(grid, row, col, value) {
  // Check row
  for (let c = 0; c < 6; c++) {
    if (grid[row][c] === value) return false;
  }
  // Check column
  for (let r = 0; r < 6; r++) {
    if (grid[r][col] === value) return false;
  }
  // Check 2×3 box
  const boxCells = getBoxCells(getBoxIndex(row, col));
  for (const cell of boxCells) {
    if (grid[cell.row][cell.col] === value) return false;
  }
  return true;
}

/**
 * Find the first empty cell (value === 0) in the grid.
 * Returns { row, col } or null if the grid is full.
 */
function findEmpty(grid) {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (grid[r][c] === 0) return { row: r, col: c };
    }
  }
  return null;
}

/**
 * Solve the Sudoku grid in-place using backtracking.
 * Returns true if solved, false if unsolvable.
 */
function solveSudoku(grid) {
  const empty = findEmpty(grid);
  if (!empty) return true; // All cells filled — solved

  const { row, col } = empty;
  const nums = shuffle([1, 2, 3, 4, 5, 6]);

  for (const num of nums) {
    if (isValidMove(grid, row, col, num)) {
      grid[row][col] = num;
      if (solveSudoku(grid)) return true;
      grid[row][col] = 0; // Backtrack
    }
  }
  return false;
}

/**
 * Pre-fill independent diagonal boxes to reduce backtracking.
 * For 6×6 with 2×3 boxes, only boxes 0 and 3 are truly independent
 * (they don't share any rows or columns):
 *   Box 0: rows 0-1, cols 0-2
 *   Box 3: rows 2-3, cols 3-5
 */
function fillDiagonalBoxes(grid) {
  // Box 0 and Box 3 are the only independent diagonal boxes in 6×6
  const independentBoxes = [0, 3];
  for (const boxIdx of independentBoxes) {
    const cells = getBoxCells(boxIdx);
    const values = shuffle([1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < cells.length; i++) {
      grid[cells[i].row][cells[i].col] = values[i];
    }
  }
}

/**
 * Generate a complete, valid 6×6 Sudoku solution.
 */
function generateSolution() {
  const grid = Array.from({ length: 6 }, () => Array(6).fill(0));
  fillDiagonalBoxes(grid);
  solveSudoku(grid);
  return grid;
}

/**
 * Create a puzzle by removing cells from a complete solution.
 * Returns a new grid with `emptyCells` cells set to 0.
 */
function createPuzzle(solution, emptyCells) {
  const puzzle = solution.map(row => [...row]);

  // Build a list of all cell positions and shuffle it
  const positions = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      positions.push({ r, c });
    }
  }
  shuffle(positions);

  let removed = 0;
  for (const { r, c } of positions) {
    if (removed >= emptyCells) break;
    puzzle[r][c] = 0;
    removed++;
  }

  return puzzle;
}

/**
 * Main entry point: generate a new 6×6 Sudoku puzzle.
 *
 * @param {number} emptyCells — how many cells to leave blank (6–30 typical)
 * @returns {{ puzzle: number[][], solution: number[][] }}
 */
function generatePuzzle(emptyCells) {
  const solution = generateSolution();
  const puzzle = createPuzzle(solution, Math.min(emptyCells, 30)); // Cap at 30
  return { puzzle, solution };
}

/**
 * Check if a row is completely filled (all cells non-zero).
 */
function isRowComplete(grid, row) {
  for (let c = 0; c < 6; c++) {
    if (grid[row][c] === 0) return false;
  }
  return true;
}

/**
 * Check if a column is completely filled (all cells non-zero).
 */
function isColComplete(grid, col) {
  for (let r = 0; r < 6; r++) {
    if (grid[r][col] === 0) return false;
  }
  return true;
}

/**
 * Check if a 2×3 box is completely filled (all cells non-zero).
 */
function isBoxComplete(grid, boxIdx) {
  const cells = getBoxCells(boxIdx);
  for (const cell of cells) {
    if (grid[cell.row][cell.col] === 0) return false;
  }
  return true;
}

/**
 * Check if the entire puzzle is filled.
 */
function isPuzzleComplete(grid) {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return true;
}
