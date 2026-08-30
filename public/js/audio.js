// Web Audio Context Synthesizer
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playBeep(freq = 800, duration = 0.1, type = 'sine') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

export function playSuccessSound() {
  try {
    playBeep(600, 0.08, 'sine');
    setTimeout(() => playBeep(900, 0.12, 'sine'), 90);
  } catch (e) {}
}

export function playAlertSound() {
  try {
    playBeep(300, 0.15, 'sawtooth');
    setTimeout(() => playBeep(250, 0.2, 'sawtooth'), 160);
  } catch (e) {}
}

export const playErrorSound = playAlertSound;
export const playSuccess = playSuccessSound;
export const playBeepSound = playBeep;

window.postaAudio = {
  playBeep,
  playSuccessSound,
  playAlertSound
};
