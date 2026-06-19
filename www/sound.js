// ============================================================
// sound.js — Web Audio API Sound Effects
// All sounds are synthesized (oscillators + noise), no files needed.
// ============================================================

const SoundManager = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /**
   * Toggle mute on/off. Returns new mute state.
   */
  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function isMuted() { return muted; }

  // ---- Utility: play a tone ----

  function playTone(freq, duration, type, gain, rampDown) {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const vol = c.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      vol.gain.setValueAtTime(gain || 0.15, c.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (rampDown || duration));

      osc.connect(vol);
      vol.connect(c.destination);

      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (e) {
      // Silently fail — audio is not critical
    }
  }

  function playNoise(duration, gain) {
    if (muted) return;
    try {
      const c = getCtx();
      const bufferSize = Math.floor(c.sampleRate * duration);
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }

      const source = c.createBufferSource();
      source.buffer = buffer;

      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, c.currentTime);
      filter.Q.setValueAtTime(0.5, c.currentTime);

      const vol = c.createGain();
      vol.gain.setValueAtTime(gain || 0.08, c.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

      source.connect(filter);
      filter.connect(vol);
      vol.connect(c.destination);

      source.start(c.currentTime);
      source.stop(c.currentTime + duration);
    } catch (e) { /* silent */ }
  }

  // ---- Game Sound Effects ----

  /** Correct Sudoku answer: two ascending pings */
  function sfxCorrect() {
    playTone(660, 0.08, 'sine', 0.12, 0.06);
    setTimeout(() => playTone(880, 0.1, 'sine', 0.12, 0.08), 60);
  }

  /** Wrong answer: short buzzer */
  function sfxWrong() {
    playTone(150, 0.2, 'sawtooth', 0.1, 0.15);
    playTone(110, 0.25, 'square', 0.06, 0.2);
  }

  /** Row complete — ice wall: crystalline ascending */
  function sfxRowComplete() {
    playTone(523, 0.12, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.1, 0.1), 80);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.12, 0.12), 160);
    // Add a shimmer (high harmonic)
    setTimeout(() => playTone(1568, 0.1, 'sine', 0.05, 0.08), 200);
  }

  /** Column complete — stun: electric zap */
  function sfxColComplete() {
    playNoise(0.15, 0.1);
    playTone(440, 0.1, 'square', 0.06, 0.08);
    setTimeout(() => playNoise(0.1, 0.06), 100);
  }

  /** Box complete — freeze: deep descending sweep */
  function sfxBoxComplete() {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const vol = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.4);
      vol.gain.setValueAtTime(0.12, c.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);

      osc.connect(vol);
      vol.connect(c.destination);

      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.5);
    } catch (e) { /* silent */ }
  }

  /** Player hit by monster: low thud */
  function sfxHit() {
    playTone(60, 0.3, 'sine', 0.2, 0.25);
    playTone(40, 0.35, 'triangle', 0.15, 0.3);
  }

  /** Level clear: victory arpeggio */
  function sfxLevelClear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.15, 'sine', 0.12, 0.12), i * 120);
    });
    // Final chord
    setTimeout(() => {
      playTone(523, 0.3, 'sine', 0.08, 0.25);
      playTone(659, 0.3, 'sine', 0.08, 0.25);
      playTone(784, 0.3, 'sine', 0.08, 0.25);
    }, 500);
  }

  /** Game over: descending minor */
  function sfxGameOver() {
    const notes = [440, 370, 311, 261];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'triangle', 0.1, 0.18), i * 180);
    });
    setTimeout(() => playTone(220, 0.5, 'triangle', 0.15, 0.45), 720);
  }

  /** Monster approaching warning: subtle low pulse (called periodically) */
  function sfxMonsterClose() {
    playTone(80, 0.08, 'sine', 0.05, 0.06);
  }

  /** Speed boost active: pulsing low hum */
  function sfxBoostWarning() {
    playTone(90, 0.15, 'sawtooth', 0.04, 0.12);
  }

  /** Level start: quick ascending */
  function sfxLevelStart() {
    playTone(440, 0.1, 'sine', 0.1, 0.08);
    setTimeout(() => playTone(660, 0.15, 'sine', 0.12, 0.12), 100);
  }

  // ---- Public API ----
  return {
    toggleMute,
    isMuted,
    sfxCorrect,
    sfxWrong,
    sfxRowComplete,
    sfxColComplete,
    sfxBoxComplete,
    sfxHit,
    sfxLevelClear,
    sfxGameOver,
    sfxMonsterClose,
    sfxBoostWarning,
    sfxLevelStart,
    /** Resume audio context on first user interaction */
    init() { getCtx(); },
  };
})();
