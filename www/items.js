// ============================================================
// items.js — Power-Up / Item System
// Items spawn randomly on the dungeon floor.
// Player walks over to pick up. Max 2 active at a time.
// ============================================================

var ITEM_DEFS = {
  apple: {
    emoji: '🍎', color: '#ff4757',
    name: { en: 'Apple', zh: '苹果' },
    type: 'instant',
    apply: function () {
      if (game.lives < 3) { game.lives++; updateUI(); }
      setEffectMsg(I18n.getLang() === 'zh' ? '🍎 生命 +1！' : '🍎 +1 Life!', 'ice', 1.5);
      SoundManager.sfxCorrect();
    },
  },
  stunGun: {
    emoji: '🔫', color: '#f1c40f',
    name: { en: 'Stun Gun', zh: '眩晕枪' },
    type: 'instant',
    apply: function () {
      var nearest = null, nearestDist = Infinity;
      for (var i = 0; i < game.monsters.length; i++) {
        var m = game.monsters[i];
        if (m.state === 'chasing') {
          var d = Math.abs(m.tileX - game.playerTileX) + Math.abs(m.tileY - game.playerTileY);
          if (d < nearestDist) { nearestDist = d; nearest = m; }
        }
      }
      if (nearest) {
        // Push monster 3 tiles away from player
        var dx = Math.sign(nearest.tileX - game.playerTileX) || 1;
        var dy = Math.sign(nearest.tileY - game.playerTileY) || 0;
        for (var push = 0; push < 3; push++) {
          var nx = nearest.tileX + dx;
          var ny = nearest.tileY + dy;
          if (nx >= 0 && nx < MAP_COLS && ny >= 0 && ny < MAP_ROWS && game.tileMap[ny][nx] === 0) {
            nearest.tileX = nx;
            nearest.tileY = ny;
            nearest.x = nx * TILE_SIZE;
            nearest.y = ny * TILE_SIZE;
          } else break;
        }
        nearest.state = 'stunned';
        nearest.stateTimer = 3.0;
        nearest.path = [];
        setEffectMsg(I18n.getLang() === 'zh' ? '🔫 怪物被击退并眩晕！' : '🔫 Monster blasted away!', 'lightning', 1.5);
        SoundManager.sfxColComplete();
      }
    },
  },
  speedBoots: {
    emoji: '⚡', color: '#3498db',
    name: { en: 'Speed Boots', zh: '速度靴' },
    type: 'buff',
    duration: 6.0,
    apply: function () {
      game.playerMoveMultiplier = 0.5; // Half cooldown = 2x speed
      setEffectMsg(I18n.getLang() === 'zh' ? '⚡ 移动加速 6 秒！' : '⚡ Speed boosted 6s!', 'lightning', 1.5);
      SoundManager.sfxCorrect();
    },
    remove: function () {
      game.playerMoveMultiplier = 1.0;
    },
  },
  hint: {
    emoji: '💡', color: '#ffd700',
    name: { en: 'Hint Scroll', zh: '提示卷轴' },
    type: 'instant',
    apply: function () {
      // Find an empty non-given cell and auto-fill it
      var empties = [];
      for (var r = 0; r < game.gridSize; r++) {
        for (var c = 0; c < game.gridSize; c++) {
          if (game.sudokuGrid[r][c] === 0 && game.playerGrid[r][c] === 0) {
            empties.push({ r: r, c: c });
          }
        }
      }
      if (empties.length > 0) {
        var pick = empties[Math.floor(Math.random() * empties.length)];
        game.playerGrid[pick.r][pick.c] = game.sudokuSolution[pick.r][pick.c];
        game.score += 5;
        flashCell(pick.r, pick.c, 'correct-flash');
        checkCompletion(pick.r, pick.c);
        setEffectMsg(I18n.getLang() === 'zh' ? '💡 提示：自动填入一格！' : '💡 Hint: cell auto-filled!', 'ice', 1.5);
        SoundManager.sfxCorrect();
        renderSudoku();
        updateUI();
      }
    },
  },
};

var Items = {
  items: [],           // Active items on map: { x, y, type, spawnTime }
  maxItems: 2,
  spawnInterval: 15,   // seconds between spawn attempts
  spawnTimer: 0,

  // Active buff tracking
  activeBuffs: {},     // { type: remainingSeconds }
};

// ---- Spawn ----

function itemsUpdate(dt) {
  Items.spawnTimer -= dt;

  // Spawn new item
  if (Items.spawnTimer <= 0 && Items.items.length < Items.maxItems) {
    Items.spawnTimer = Items.spawnInterval;
    trySpawnItem();
  }

  // Decay active buffs
  var keys = Object.keys(Items.activeBuffs);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    Items.activeBuffs[k] -= dt;
    if (Items.activeBuffs[k] <= 0) {
      // Buff expired — call remove if it exists
      if (ITEM_DEFS[k] && ITEM_DEFS[k].remove) ITEM_DEFS[k].remove();
      delete Items.activeBuffs[k];
    }
  }
}

function trySpawnItem() {
  // Find random walkable tile not occupied by player, monster, ice wall, or other item
  var attempts = 0;
  while (attempts < 30) {
    var x = 1 + Math.floor(Math.random() * (MAP_COLS - 2));
    var y = 1 + Math.floor(Math.random() * (MAP_ROWS - 2));

    if (game.tileMap[y][x] !== 0) { attempts++; continue; }
    if (x === game.playerTileX && y === game.playerTileY) { attempts++; continue; }
    if (game.monsters.some(function (m) { return m.tileX === x && m.tileY === y; })) { attempts++; continue; }
    if (game.iceWalls.some(function (w) { return w.x === x && w.y === y; })) { attempts++; continue; }
    if (Items.items.some(function (it) { return it.x === x && it.y === y; })) { attempts++; continue; }

    // Pick random item type
    var types = Object.keys(ITEM_DEFS);
    var type = types[Math.floor(Math.random() * types.length)];

    Items.items.push({ x: x, y: y, type: type });
    return;
  }
}

// ---- Pickup ----

function checkItemPickup() {
  for (var i = Items.items.length - 1; i >= 0; i--) {
    var it = Items.items[i];
    if (it.x === game.playerTileX && it.y === game.playerTileY) {
      var def = ITEM_DEFS[it.type];
      if (!def) continue;

      if (def.type === 'buff') {
        // Refresh or stack buff timer
        Items.activeBuffs[it.type] = (Items.activeBuffs[it.type] || 0) + def.duration;
        if (def.apply) def.apply();
      } else if (def.type === 'instant') {
        if (def.apply) def.apply();
      }

      Items.items.splice(i, 1);
    }
  }
}

// ---- Rendering ----

function renderItems(ctx) {
  for (var i = 0; i < Items.items.length; i++) {
    var it = Items.items[i];
    var def = ITEM_DEFS[it.type];
    if (!def) continue;

    var px = it.x * TILE_SIZE;
    var py = it.y * TILE_SIZE;

    // Pulsating glow
    var pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300 + i * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (pulse * 0.15) + ')';
    ctx.fillRect(px - 1, py - 1, TILE_SIZE + 2, TILE_SIZE + 2);

    // Item background
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);

    // Emoji
    ctx.globalAlpha = 1;
    ctx.font = (TILE_SIZE - 10) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
  }
}

// ---- Reset on new level ----

function resetItems() {
  Items.items = [];
  Items.activeBuffs = {};
  Items.spawnTimer = 5; // First item spawns quickly
  game.playerMoveMultiplier = 1.0;
}
