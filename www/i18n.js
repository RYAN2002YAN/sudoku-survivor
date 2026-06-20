// ============================================================
// i18n.js — Bilingual Chinese/English Translation System
// ============================================================

const I18n = (() => {
  const STORAGE_KEY = 'sudoku-survivor-lang';

  // ---- Translation Strings ----
  const strings = {
    en: {
      // Top bar
      'stat.lives': 'Lives',
      'stat.score': 'Score',
      'stat.level': 'Level',
      'stat.time': 'Time',

      // Menu overlay
      'menu.title': 'SUDOKU\nSURVIVOR',
      'menu.subtitle': `Solve the 6×6 Sudoku while
escaping monsters in the dungeon.

Complete a ROW → Ice wall behind you
Complete a COL → Stun nearest monster
Complete a BOX → Freeze all monsters
Wrong answer → Monsters speed up!`,
      'menu.start': 'PRESS SPACE TO START',

      // Game over overlay
      'gameover.title': 'GAME OVER',
      'gameover.level': 'Level',
      'gameover.score': 'Score',
      'gameover.time': 'Time',
      'gameover.restart': 'PRESS R TO RESTART',

      // Level clear overlay
      'levelclear.title': 'LEVEL CLEAR!',
      'levelclear.next': 'Next level in',

      // Sudoku panel
      'sudoku.label': '🔢 Sudoku',
      'sudoku.rows': 'Rows',
      'sudoku.cols': 'Cols',
      'sudoku.boxes': 'Boxes',

      // Effect messages
      'effect.row': '❄️ Row complete! Ice wall deployed!',
      'effect.col': '⚡ Column complete! Monster stunned!',
      'effect.box': '🧊 Box complete! All monsters frozen!',
      'effect.wrong': '🔥 Monsters sped up!',
      'effect.clear': '🎉 Puzzle solved! Level cleared!',

      // Mute button
      'esc.menu': 'ESC for menu',
      'mute.title': 'Toggle sound',
      'lang.title': 'Switch language',
    },

    zh: {
      // 顶栏
      'stat.lives': '生命',
      'stat.score': '分数',
      'stat.level': '关卡',
      'stat.time': '时间',

      // 菜单覆盖层
      'menu.title': '数独\n逃生',
      'menu.subtitle': `一边躲避地牢怪物
一边解开 6×6 数独。

完成一行 → 身后生成冰墙
完成一列 → 眩晕最近怪物
完成一宫 → 冻结全部怪物
填入错误 → 怪物加速！`,
      'menu.start': '按 空格键 开始',

      // 游戏结束
      'gameover.title': '游戏结束',
      'gameover.level': '关卡',
      'gameover.score': '分数',
      'gameover.time': '时间',
      'gameover.restart': '按 R 重新开始',

      // 关卡通关
      'levelclear.title': '通关！',
      'levelclear.next': '下一关倒计时',

      // 数独面板
      'sudoku.label': '🔢 数独',
      'sudoku.rows': '行',
      'sudoku.cols': '列',
      'sudoku.boxes': '宫',

      // 效果消息
      'effect.row': '❄️ 行完成！冰墙已部署！',
      'effect.col': '⚡ 列完成！怪物眩晕！',
      'effect.box': '🧊 宫完成！全部冰冻！',
      'effect.wrong': '🔥 怪物加速了！',
      'effect.clear': '🎉 数独解决！关卡通关！',

      // 按钮
      'esc.menu': 'ESC 返回菜单',
      'mute.title': '切换音效',
      'lang.title': '切换语言',
    },
  };

  let currentLang = 'zh'; // Default Chinese

  /**
   * Initialize: load saved preference or detect browser language.
   */
  function init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'zh')) {
        currentLang = saved;
      } else {
        // Detect browser language
        const navLang = (navigator.language || '').toLowerCase();
        currentLang = navLang.startsWith('zh') ? 'zh' : 'en';
      }
    } catch (e) {
      currentLang = 'zh';
    }
    applyLanguage();
  }

  /**
   * Translate a key. Falls back to English if missing.
   */
  function t(key) {
    return strings[currentLang]?.[key] || strings.en[key] || key;
  }

  /**
   * Get current language code.
   */
  function getLang() {
    return currentLang;
  }

  /**
   * Toggle between zh and en.
   */
  function toggleLang() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) { /* */ }
    applyLanguage();
    return currentLang;
  }

  /**
   * Update all DOM elements with data-i18n attributes.
   * Also rebuild overlay content based on game state.
   */
  function applyLanguage() {
    // Update all [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const text = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else {
        // Support newlines in overlay titles
        if (text.includes('\n')) {
          el.innerHTML = text.split('\n').map(l => `<span>${l}</span>`).join('<br>');
        } else {
          el.textContent = text;
        }
      }
    });

    // Update [data-i18n-title] attributes (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });

    // Update effect log labels
    updateSudokuLabels();

    // Update overlay based on current game state
    if (typeof game !== 'undefined') {
      updateOverlayLanguage();
    }
  }

  function updateSudokuLabels() {
    const rowsEl = document.querySelector('#sudoku-status span:nth-child(1)');
    const colsEl = document.querySelector('#sudoku-status span:nth-child(2)');
    const boxesEl = document.querySelector('#sudoku-status span:nth-child(3)');
    if (rowsEl) rowsEl.childNodes[0].textContent = t('sudoku.rows') + ': ';
    if (colsEl) colsEl.childNodes[0].textContent = t('sudoku.cols') + ': ';
    if (boxesEl) boxesEl.childNodes[0].textContent = t('sudoku.boxes') + ': ';
  }

  function updateOverlayLanguage() {
    const overlay = document.getElementById('overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    if (typeof game === 'undefined') return;

    if (game.state === 'gameover') {
      overlay.querySelector('h2').textContent = t('gameover.title');
      const stats = overlay.querySelectorAll('.subtitle span');
      // Rebuild game over text
      overlay.querySelector('.key-hint').textContent = t('gameover.restart');
    } else if (game.state === 'levelclear') {
      overlay.querySelector('h2').textContent = t('levelclear.title');
    } else if (game.state === 'menu') {
      overlay.querySelector('h1').innerHTML = t('menu.title').replace('\n', '<br>');
      overlay.querySelector('.subtitle').innerHTML = t('menu.subtitle').replace(/\n/g, '<br>');
      overlay.querySelector('.key-hint').textContent = t('menu.start');
    }
  }

  return { init, t, getLang, toggleLang, applyLanguage, updateOverlayLanguage };
})();

// Auto-init when script loads
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => I18n.init());
}
