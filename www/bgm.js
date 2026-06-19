// ============================================================
// bgm.js — Procedural Adaptive Background Music
// Uses Web Audio API oscillators — zero audio files.
// Music adapts to game state: faster/darker as monsters approach.
// ============================================================

const BGM = (() => {
  let ctx = null;
  let playing = false;
  let muted = false;

  // Current scene and intensity
  let scene = 'menu';       // 'menu' | 'playing' | 'levelclear' | 'gameover'
  let intensity = 0;        // 0 (calm) … 1 (danger — monster very close)

  // Active audio nodes
  let bassOsc = null;
  let bassGain = null;
  let padOsc1 = null, padOsc2 = null;
  let padGain = null;
  let beatTimer = null;      // setInterval for percussion
  let arpTempo = 0;          // current arpeggio interval in ms
  let arpTimer = null;       // setTimeout chain for arp notes
  let noteIndex = 0;

  // ---- Music Scales ----
  // A minor pentatonic (safe, atmospheric) → shifts to dissonant under pressure
  const calmScale = [220, 261.6, 293.7, 329.6, 349.2, 392, 440];     // A3–A4 minor pentatonic
  const tenseScale = [220, 233.1, 261.6, 277.2, 293.7, 311.1, 349.2]; // More chromatic / dissonant

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---- Arpeggio (melody notes) ----

  function scheduleArpNote() {
    if (!playing || muted) return;

    try {
      const c = getCtx();
      const now = c.currentTime;

      // Pick scale based on intensity
      const scale = intensity > 0.6 ? tenseScale : calmScale;
      // Walk the scale (pattern depends on scene)
      switch (scene) {
        case 'menu':
          noteIndex = (noteIndex + 1) % scale.length;
          break;
        case 'playing':
          noteIndex = (noteIndex + 2) % scale.length; // skip-one pattern, more active
          break;
        case 'levelclear':
          noteIndex = (noteIndex + 1) % scale.length;
          break;
        case 'gameover':
          noteIndex = (noteIndex - 1 + scale.length) % scale.length; // descending
          break;
      }

      const freq = scale[Math.abs(noteIndex) % scale.length];
      const osc = c.createOscillator();
      const vol = c.createGain();

      osc.type = scene === 'gameover' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const noteGain = 0.025 + intensity * 0.03; // Louder when intense
      vol.gain.setValueAtTime(noteGain, now);
      vol.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(vol);
      vol.connect(c.destination);

      osc.start(now);
      osc.stop(now + 0.3);

      // Schedule next note — tempo depends on scene + intensity
      let baseTempo;
      switch (scene) {
        case 'menu':    baseTempo = 800; break;
        case 'playing': baseTempo = 500; break;
        case 'levelclear': baseTempo = 350; break; // faster, celebratory
        case 'gameover': baseTempo = 1200; break;
        default: baseTempo = 600;
      }
      // Intensity shrinks the interval by up to 40%
      arpTempo = baseTempo * (1 - intensity * 0.4);
      arpTempo = Math.max(200, Math.min(2000, arpTempo));

    } catch (e) { /* silent */ }

    if (playing && !muted) {
      arpTimer = setTimeout(scheduleArpNote, arpTempo);
    }
  }

  // ---- Percussion (subtle beat) ----

  function playBeat() {
    if (!playing || muted) return;
    try {
      const c = getCtx();
      const now = c.currentTime;
      const bufferSize = Math.floor(c.sampleRate * 0.04);
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
      }
      const source = c.createBufferSource();
      source.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      const vol = c.createGain();
      vol.gain.setValueAtTime(0.02 + intensity * 0.04, now);
      source.connect(filter);
      filter.connect(vol);
      vol.connect(c.destination);
      source.start(now);
      source.stop(now + 0.05);
    } catch (e) { /* silent */ }
  }

  function startBeat() {
    if (beatTimer) clearInterval(beatTimer);
    beatTimer = setInterval(() => {
      if (scene === 'menu') return; // No percussion in menu
      playBeat();
      // Double beat when very intense
      if (intensity > 0.7) setTimeout(playBeat, 150);
    }, scene === 'playing' ? 800 : 1200);
  }

  // ---- Drone (bass + pad always on) ----

  function startDrone() {
    stopDrones();
    try {
      const c = getCtx();
      bassOsc = c.createOscillator();
      bassGain = c.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(55, c.currentTime); // A1 — deep
      bassGain.gain.setValueAtTime(0.06, c.currentTime);
      bassOsc.connect(bassGain);
      bassGain.connect(c.destination);
      bassOsc.start();

      // Pad: two slightly detuned sines for warmth
      padOsc1 = c.createOscillator();
      padOsc2 = c.createOscillator();
      padGain = c.createGain();

      padOsc1.type = 'sine';
      padOsc2.type = 'sine';
      padOsc1.frequency.setValueAtTime(110, c.currentTime);    // A2
      padOsc2.frequency.setValueAtTime(110.5, c.currentTime);  // Slight detune

      padGain.gain.setValueAtTime(0.03, c.currentTime);

      padOsc1.connect(padGain);
      padOsc2.connect(padGain);
      padGain.connect(c.destination);

      padOsc1.start();
      padOsc2.start();
    } catch (e) { /* silent */ }
  }

  function stopDrones() {
    try {
      if (bassOsc) { bassOsc.stop(); bassOsc = null; }
      if (bassGain) { bassGain = null; }
      if (padOsc1) { padOsc1.stop(); padOsc1 = null; }
      if (padOsc2) { padOsc2.stop(); padOsc2 = null; }
      if (padGain) { padGain = null; }
    } catch (e) { /* */ }
  }

  // ---- Public API ----

  function isPlaying() { return playing && !muted; }

  function toggleMute() {
    muted = !muted;
    if (muted) {
      stopAll();
    } else if (playing) {
      stopAll();
      startAll(scene);
    }
    return muted;
  }

  function toggle() {
    if (playing) {
      stop();
    } else {
      start(scene);
    }
    return playing;
  }

  function start(newScene) {
    if (newScene) scene = newScene;
    if (muted) { playing = true; return; }
    if (playing) stopAll();

    // Initialize audio context (must be called from user gesture)
    getCtx();
    playing = true;
    startAll(scene);
  }

  function stop() {
    playing = false;
    stopAll();
  }

  function setScene(newScene) {
    if (scene === newScene) return;
    scene = newScene;
    if (playing && !muted) {
      // Restart drone for smooth transition (simple approach)
      stopDrones();
      startDrone();
      // Restart arpeggio
      if (arpTimer) clearTimeout(arpTimer);
      scheduleArpNote();
    }
  }

  /**
   * Set danger intensity (0 = calm, 1 = monster right next to you).
   * Call this from the game loop.
   */
  function setIntensity(val) {
    intensity = Math.max(0, Math.min(1, val));
    // Modulate pad gain for tension
    if (padGain && playing) {
      try {
        const c = getCtx();
        const targetGain = 0.03 + intensity * 0.04;
        padGain.gain.linearRampToValueAtTime(targetGain, c.currentTime + 0.3);
        // Detune the pad oscillators more under pressure
        if (padOsc1 && padOsc2) {
          padOsc1.frequency.linearRampToValueAtTime(110 - intensity * 5, c.currentTime + 0.5);
          padOsc2.frequency.linearRampToValueAtTime(110.5 + intensity * 3, c.currentTime + 0.5);
        }
      } catch (e) { /* */ }
    }
  }

  function startAll(sceneName) {
    startDrone();
    scheduleArpNote();
    startBeat();
  }

  function stopAll() {
    stopDrones();
    if (arpTimer) { clearTimeout(arpTimer); arpTimer = null; }
    if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
  }

  return { start, stop, setScene, setIntensity, toggle, toggleMute, isPlaying };
})();
