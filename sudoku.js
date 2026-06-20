// ============================================================
// sudoku.js — Parameterized Sudoku Engine (6×6 or 9×9)
// ============================================================

const Sudoku = { size: 6, boxRows: 2, boxCols: 3, maxNum: 6, boxCount: 6, diagBoxes: [0, 3] };

/**
 * Configure grid dimensions.
 * @param {number} size — 6 (2×3 boxes) or 9 (3×3 boxes)
 */
function configureSudokuEngine(size) {
  Sudoku.size = size;
  if (size === 6) {
    Sudoku.boxRows = 2; Sudoku.boxCols = 3;
    Sudoku.maxNum = 6; Sudoku.boxCount = 6;
    Sudoku.diagBoxes = [0, 3];
  } else {
    Sudoku.boxRows = 3; Sudoku.boxCols = 3;
    Sudoku.maxNum = 9; Sudoku.boxCount = 9;
    Sudoku.diagBoxes = [0, 4, 8];
  }
}

/** Fisher-Yates shuffle */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Which box does (row, col) belong to? */
function getBoxIndex(row, col) {
  return Math.floor(row / Sudoku.boxRows) * (Sudoku.size / Sudoku.boxCols) + Math.floor(col / Sudoku.boxCols);
}

/** All cell coordinates in a given box */
function getBoxCells(boxIdx) {
  const boxesPerRow = Sudoku.size / Sudoku.boxCols;
  const boxRow = Math.floor(boxIdx / boxesPerRow);
  const boxCol = boxIdx % boxesPerRow;
  const sr = boxRow * Sudoku.boxRows;
  const sc = boxCol * Sudoku.boxCols;
  const cells = [];
  for (let r = sr; r < sr + Sudoku.boxRows; r++)
    for (let c = sc; c < sc + Sudoku.boxCols; c++)
      cells.push({ row: r, col: c });
  return cells;
}

/** Sudoku rule check */
function isValidMove(grid, row, col, value) {
  for (let c = 0; c < Sudoku.size; c++) if (grid[row][c] === value) return false;
  for (let r = 0; r < Sudoku.size; r++) if (grid[r][col] === value) return false;
  for (const cell of getBoxCells(getBoxIndex(row, col))) if (grid[cell.row][cell.col] === value) return false;
  return true;
}

/** Find first empty cell */
function findEmpty(grid) {
  for (let r = 0; r < Sudoku.size; r++)
    for (let c = 0; c < Sudoku.size; c++)
      if (grid[r][c] === 0) return { row: r, col: c };
  return null;
}

/** Backtracking solver */
function solveSudoku(grid) {
  const empty = findEmpty(grid);
  if (!empty) return true;
  const { row, col } = empty;
  const nums = shuffle(Array.from({ length: Sudoku.maxNum }, (_, i) => i + 1));
  for (const num of nums) {
    if (isValidMove(grid, row, col, num)) {
      grid[row][col] = num;
      if (solveSudoku(grid)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

/** Pre-fill independent diagonal boxes */
function fillDiagonalBoxes(grid) {
  for (const boxIdx of Sudoku.diagBoxes) {
    const cells = getBoxCells(boxIdx);
    const values = shuffle(Array.from({ length: Sudoku.maxNum }, (_, i) => i + 1));
    for (let i = 0; i < cells.length; i++) grid[cells[i].row][cells[i].col] = values[i];
  }
}

/** Generate complete valid solution */
function generateSolution() {
  const grid = Array.from({ length: Sudoku.size }, () => Array(Sudoku.size).fill(0));
  fillDiagonalBoxes(grid);
  solveSudoku(grid);
  return grid;
}

/** Blank out cells to create puzzle */
function createPuzzle(solution, emptyCells) {
  const puzzle = solution.map(row => [...row]);
  const positions = [];
  for (let r = 0; r < Sudoku.size; r++)
    for (let c = 0; c < Sudoku.size; c++) positions.push({ r, c });
  shuffle(positions);
  const maxEmpty = Sudoku.size * Sudoku.size - Sudoku.maxNum; // leave at least N clues
  let removed = 0;
  for (const { r, c } of positions) {
    if (removed >= Math.min(emptyCells, maxEmpty)) break;
    puzzle[r][c] = 0;
    removed++;
  }
  return puzzle;
}

/** Main: generate puzzle + solution */
function generatePuzzle(emptyCells) {
  const solution = generateSolution();
  const maxEmpty = Sudoku.size * Sudoku.size - Sudoku.maxNum;
  const puzzle = createPuzzle(solution, Math.min(emptyCells, maxEmpty));
  return { puzzle, solution };
}

/** Row complete? */
function isRowComplete(grid, row) {
  for (let c = 0; c < Sudoku.size; c++) if (grid[row][c] === 0) return false;
  return true;
}

/** Column complete? */
function isColComplete(grid, col) {
  for (let r = 0; r < Sudoku.size; r++) if (grid[r][col] === 0) return false;
  return true;
}

/** Box complete? */
function isBoxComplete(grid, boxIdx) {
  for (const cell of getBoxCells(boxIdx)) if (grid[cell.row][cell.col] === 0) return false;
  return true;
}

/** Entire puzzle filled? */
function isPuzzleComplete(grid) {
  for (let r = 0; r < Sudoku.size; r++) for (let c = 0; c < Sudoku.size; c++) if (grid[r][c] === 0) return false;
  return true;
}
