// Web Audio API Beep Generator (Bekerja tanpa file eksternal)
function createAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return AudioContext ? new AudioContext() : null;
}

export function playBeep(freq = 800, duration = 100, type = 'sine') {
  try {
    const ctx = createAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch (e) {
    console.warn('Audio play prevented:', e);
  }
}

export function playError() {
  playBeep(250, 200, 'square');
}

export function playSuccessSound() {
  playBeep(880, 150, 'sine');
}

export function playErrorSound() {
  playError();
}
