// ============================================================
// monsters.js — Monster AI and Effect System
// A* pathfinding, monster state machine, ice walls, stun/freeze
// ============================================================

// ---- A* Pathfinding ----

/**
 * Manhattan distance heuristic for A*.
 */
function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Build a combined walkability map that includes both static walls
 * and active ice walls.
 */
function buildWalkableMap(tileMap, iceWalls) {
  // Fast check: if there are no ice walls, just use the tileMap directly
  if (!iceWalls || iceWalls.length === 0) {
    return (x, y) => {
      if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) return false;
      return tileMap[y][x] === 0;
    };
  }

  // Build a set of ice wall positions for O(1) lookup
  const iceSet = new Set(iceWalls.map(w => `${w.x},${w.y}`));
  return (x, y) => {
    if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) return false;
    if (tileMap[y][x] === 1) return false;
    if (iceSet.has(`${x},${y}`)) return false;
    return true;
  };
}

/**
 * A* pathfinding on a grid with 4-directional movement.
 *
 * @param {number} startX - start tile column
 * @param {number} startY - start tile row
 * @param {number} goalX - goal tile column
 * @param {number} goalY - goal tile row
 * @param {number[][]} tileMap - 2D array, 0=walkable, 1=wall
 * @param {Array<{x:number, y:number, timer:number}>} iceWalls - active ice walls
 * @returns {Array<{x:number, y:number}> | null} - path (inclusive of start), or null
 */
function astar(startX, startY, goalX, goalY, tileMap, iceWalls) {
  const isWalkable = buildWalkableMap(tileMap, iceWalls);

  // If goal is unreachable, return null early
  if (!isWalkable(goalX, goalY) || !isWalkable(startX, startY)) {
    return null;
  }

  // If already at goal
  if (startX === goalX && startY === goalY) {
    return [{ x: startX, y: startY }];
  }

  // Node: { x, y, g, f, parent }
  const openSet = [{
    x: startX, y: startY,
    g: 0,
    f: heuristic(startX, startY, goalX, goalY),
    parent: null
  }];

  const closedSet = new Set();

  while (openSet.length > 0) {
    // Find node with lowest f in open set
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) {
        lowestIdx = i;
      }
    }

    const current = openSet.splice(lowestIdx, 1)[0];
    const currentKey = `${current.x},${current.y}`;

    // Reached goal — reconstruct path
    if (current.x === goalX && current.y === goalY) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closedSet.add(currentKey);

    // Four cardinal neighbors
    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const n of neighbors) {
      const nKey = `${n.x},${n.y}`;

      if (!isWalkable(n.x, n.y)) continue;
      if (closedSet.has(nKey)) continue;

      const g = current.g + 1;
      const h = heuristic(n.x, n.y, goalX, goalY);
      const f = g + h;

      // Search open set for existing node (linear, but 11×11 grid = max ~121 nodes)
      const existing = openSet.find(node => node.x === n.x && node.y === n.y);
      if (existing) {
        // Already in open set — update if better
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      } else {
        openSet.push({ x: n.x, y: n.y, g, f, parent: current });
      }
    }
  }

  return null; // No path found
}

// ---- Monster Creation and Update ----

/**
 * Create a monster at a given tile position.
 *
 * @param {number} id
 * @param {number} tileX
 * @param {number} tileY
 * @param {number} speed - tiles per second
 * @returns {Object} monster object
 */
function createMonster(id, tileX, tileY, speed) {
  return {
    id,
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE,
    tileX,
    tileY,
    speed,
    moveInterval: 1.0 / speed,  // seconds between tile steps
    moveTimer: 0,                // countdown to next step
    moveCooldown: 0,             // path recalculation cooldown
    path: [],
    pathIndex: 0,
    state: 'chasing',            // 'chasing' | 'stunned' | 'frozen'
    stateTimer: 0,
    color: '#e74c3c',            // red
  };
}

/**
 * Update all monsters for one fixed timestep.
 *
 * @param {Array} monsters
 * @param {number} dt - delta time in seconds
 * @param {number} playerTileX
 * @param {number} playerTileY
 * @param {number[][]} tileMap
 * @param {Array} iceWalls
 */
function updateMonsters(monsters, dt, playerTileX, playerTileY, tileMap, iceWalls) {
  for (const m of monsters) {
    // ---- Handle state timers ----
    if (m.state === 'stunned' || m.state === 'frozen') {
      m.stateTimer -= dt;
      if (m.stateTimer <= 0) {
        m.state = 'chasing';
        m.stateTimer = 0;
        // Force path recalculation when unstunned
        m.moveCooldown = 0;
      }
      continue; // No movement while stunned/frozen
    }

    // ---- Recalculate path periodically ----
    m.moveCooldown -= dt;
    if (m.moveCooldown <= 0) {
      const newPath = astar(m.tileX, m.tileY, playerTileX, playerTileY, tileMap, iceWalls);
      if (newPath && newPath.length > 1) {
        m.path = newPath;
        m.pathIndex = 1; // Start from 1 because 0 is current position
      } else {
        m.path = [];
        m.pathIndex = 0;
      }
      m.moveCooldown = 0.3; // Recalculate path every 0.3s
    }

    // ---- Move along path at the monster's speed interval ----
    m.moveTimer -= dt;
    if (m.moveTimer <= 0 && m.path.length > 0 && m.pathIndex < m.path.length) {
      const target = m.path[m.pathIndex];

      // Check if the target tile is still walkable (not occupied by a new ice wall)
      const isWalkable = buildWalkableMap(tileMap, iceWalls);
      if (isWalkable(target.x, target.y)) {
        m.tileX = target.x;
        m.tileY = target.y;
        m.x = target.x * TILE_SIZE;
        m.y = target.y * TILE_SIZE;
        m.pathIndex++;
      } else {
        // Path blocked — force recalculation next update
        m.path = [];
        m.pathIndex = 0;
        m.moveCooldown = 0;
      }

      m.moveTimer += m.moveInterval;
    }
  }
}

// ---- Effect System ----

/**
 * Apply a stun or freeze effect to monsters.
 *
 * @param {Array} monsters
 * @param {'stun'|'freeze'} type
 * @param {number} targetTileX - for stun: nearest monster to this position
 * @param {number} targetTileY
 * @param {number} durationSeconds
 */
function applyEffect(monsters, type, targetTileX, targetTileY, durationSeconds) {
  if (type === 'freeze') {
    // Freeze all monsters
    for (const m of monsters) {
      m.state = 'frozen';
      m.stateTimer = Math.max(m.stateTimer, durationSeconds);
    }
  } else if (type === 'stun') {
    // Stun the nearest monster to the target position
    let nearest = null;
    let nearestDist = Infinity;
    for (const m of monsters) {
      if (m.state === 'chasing') {
        const dist = Math.abs(m.tileX - targetTileX) + Math.abs(m.tileY - targetTileY);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = m;
        }
      }
    }
    // Also consider already stunned/frozen monsters if no chasing ones
    if (!nearest) {
      for (const m of monsters) {
        const dist = Math.abs(m.tileX - targetTileX) + Math.abs(m.tileY - targetTileY);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = m;
        }
      }
    }
    if (nearest) {
      nearest.state = 'stunned';
      nearest.stateTimer = Math.max(nearest.stateTimer, durationSeconds);
      nearest.path = [];
      nearest.pathIndex = 0;
    }
  }
}

/**
 * Remove expired ice walls.
 *
 * @param {Array} iceWalls
 * @param {number} dt - delta time in seconds
 */
function updateIceWalls(iceWalls, dt) {
  for (let i = iceWalls.length - 1; i >= 0; i--) {
    iceWalls[i].timer -= dt;
    if (iceWalls[i].timer <= 0) {
      iceWalls.splice(i, 1);
    }
  }
}

/**
 * Place an ice wall at the player's previous position (behind them).
 *
 * @param {number} playerTileX
 * @param {number} playerTileY
 * @param {{dx:number, dy:number}} lastMoveDir
 * @param {number[][]} tileMap
 * @param {Array} iceWalls
 */
/**
 * Place an ice wall strategically between the player and the nearest chasing monster.
 * Falls back to placing behind the player if no good blocking position is found.
 *
 * @param {number} playerTileX
 * @param {number} playerTileY
 * @param {{dx:number, dy:number}} lastMoveDir
 * @param {number[][]} tileMap
 * @param {Array} iceWalls
 * @param {Array} monsters
 */
function spawnIceWall(playerTileX, playerTileY, lastMoveDir, tileMap, iceWalls, monsters) {
  // Default fallback: behind the player
  let targetX = playerTileX - lastMoveDir.dx;
  let targetY = playerTileY - lastMoveDir.dy;

  // ---- Strategic placement: block the nearest monster's approach ----
  let nearestMonster = null;
  let nearestDist = Infinity;

  for (const m of monsters || []) {
    if (m.state === 'chasing' || m.state === 'frozen') {
      const dist = Math.abs(m.tileX - playerTileX) + Math.abs(m.tileY - playerTileY);
      if (dist < nearestDist && dist > 1) {
        nearestDist = dist;
        nearestMonster = m;
      }
    }
  }

  if (nearestMonster) {
    const dx = Math.sign(nearestMonster.tileX - playerTileX);
    const dy = Math.sign(nearestMonster.tileY - playerTileY);

    // Try these positions in priority order:
    const candidates = [];
    if (dx !== 0 && dy !== 0) {
      // Monster is diagonal — try blocking both axes
      candidates.push(
        { x: playerTileX + dx, y: playerTileY },
        { x: playerTileX, y: playerTileY + dy },
        { x: playerTileX + dx, y: playerTileY + dy },
      );
    } else {
      // Monster is cardinal — block directly
      candidates.push(
        { x: playerTileX + dx, y: playerTileY + dy },
        { x: playerTileX + dx, y: playerTileY },
        { x: playerTileX, y: playerTileY + dy },
      );
    }

    for (const cand of candidates) {
      if (cand.x >= 0 && cand.x < MAP_COLS && cand.y >= 0 && cand.y < MAP_ROWS &&
          tileMap[cand.y][cand.x] === 0 &&
          !iceWalls.some(w => w.x === cand.x && w.y === cand.y) &&
          !(cand.x === playerTileX && cand.y === playerTileY)) {
        targetX = cand.x;
        targetY = cand.y;
        break;
      }
    }
  }

  // Final validation
  if (targetX < 0 || targetX >= MAP_COLS || targetY < 0 || targetY >= MAP_ROWS) return;
  if (tileMap[targetY][targetX] === 1) return;
  if (iceWalls.some(w => w.x === targetX && w.y === targetY)) return;
  if (targetX === playerTileX && targetY === playerTileY) return;

  iceWalls.push({ x: targetX, y: targetY, timer: 5.0 });
}

// ---- Wrong Answer Speed Boost ----

let wrongAnswerBoostActive = false;
let wrongAnswerBoostTimer = 0;

/**
 * Apply a temporary speed boost to all monsters (doubles their speed).
 * Called when the player enters a wrong Sudoku answer.
 */
function applyWrongAnswerBoost(monsters) {
  wrongAnswerBoostActive = true;
  wrongAnswerBoostTimer = 3.0;

  for (const m of monsters) {
    // Halve the move interval = double speed
    m.moveInterval = (1.0 / m.speed) * 0.5;
    // Also reduce path recalculation cooldown for more aggressive chasing
    m.moveCooldown = 0;
  }
}

/**
 * Update the wrong-answer speed boost timer.
 * Restores normal speed when the boost expires.
 */
function updateWrongAnswerBoost(monsters, dt) {
  if (!wrongAnswerBoostActive) return;

  wrongAnswerBoostTimer -= dt;
  if (wrongAnswerBoostTimer <= 0) {
    wrongAnswerBoostActive = false;
    wrongAnswerBoostTimer = 0;
    for (const m of monsters) {
      m.moveInterval = 1.0 / m.speed;
    }
  }
}

/**
 * Check if the wrong answer boost is active.
 */
function isWrongAnswerBoostActive() {
  return wrongAnswerBoostActive;
}
