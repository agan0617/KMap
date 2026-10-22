// 音樂與音效：全部用 Web Audio 即時合成，不用音檔。
// 背景音樂依地區換音階（日本：都節音階，像琴的撥弦），限時連擊時換成快板。
const Sound = (() => {
  let ctx = null, master = null, bgmBus = null, sfxBus = null;
  let timer = null, nextAt = 0, step = 0, style = null, scale = null, phrase = [];

  const SCALES = {
    // 半音數，以 D 為主音
    japan: [0, 1, 5, 7, 8],      // 都節音階 D E♭ G A B♭
    taiwan: [0, 3, 5, 7, 10],    // 羽調五聲音階（台灣民謠常見的小調色彩）
    china: [0, 2, 4, 7, 9],      // 宮調五聲音階
    usa: [0, 2, 4, 5, 7, 9, 10], // 混合利地安調式（鄉村、民謠常見的大調帶降七音）
    world: [0, 2, 4, 5, 7, 9, 11],
  };
  const ROOT = 146.83; // D3

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.32; bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    // 簡單的殘響：兩條回授延遲線
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const dl = ctx.createDelay(); dl.delayTime.value = 0.23;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    bgmBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
  }

  const hz = semi => ROOT * Math.pow(2, semi / 12);
  const on = k => Store.settings()[k];

  // 撥弦音色：三角波＋高八度正弦，快起慢收
  function pluck(freq, t, dur, vol, bus, bright = 1) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'triangle'; o1.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6 * bright, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(bus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function tone(type, freq, t, dur, vol, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, freq) {
    const n = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t);
  }

  // ── 背景音樂：每 4 小節產生一個新樂句，音階上的隨機漫步，句尾回到主音或五度 ──
  function newPhrase() {
    const n = scale.length, notes = [];
    let deg = Math.floor(Math.random() * n) + n; // 從中音域開始
    for (let i = 0; i < 16; i++) {
      if (Math.random() < (style === 'fast' ? 0.15 : 0.32)) { notes.push(null); continue; }
      deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
      deg = Math.max(n - 2, Math.min(n * 2 + 2, deg));
      notes.push(deg);
    }
    notes[15] = Math.random() < 0.6 ? n : n + (scale.indexOf(7) >= 0 ? scale.indexOf(7) : 2);
    return notes;
  }
  const degToSemi = d => { const n = scale.length; return Math.floor(d / n) * 12 + scale[((d % n) + n) % n]; };

  function tick() {
    const beat = style === 'fast' ? 0.16 : 0.34;
    while (nextAt < ctx.currentTime + 0.25) {
      const i = step % 16;
      if (i === 0) phrase = newPhrase();
      const d = phrase[i];
      if (d != null) pluck(hz(degToSemi(d)), nextAt, style === 'fast' ? 0.5 : 1.4, 0.16, bgmBus);
      // 低音：每小節第一拍撥主音或五度
      if (i % 4 === 0) {
        const low = (Math.floor(step / 16) % 2 && i === 8) ? 7 : 0;
        pluck(hz(low - 12), nextAt, 2.2, 0.13, bgmBus, 0.6);
      }
      if (style === 'fast' && i % 2 === 1) noise(nextAt, 0.05, 0.05, 6000);
      nextAt += beat;
      step++;
    }
  }

  function bgm(regionKey, s) {
    stopBgm();
    if (!ctx || !on('bgm') || !s) return;
    style = s; scale = SCALES[regionKey] || SCALES.japan; step = 0;
    nextAt = ctx.currentTime + 0.1;
    timer = setInterval(tick, 80);
  }
  function stopBgm() { if (timer) clearInterval(timer); timer = null; }

  // ── 音效 ──
  const sfx = {
    tap() { tone('sine', 880, ctx.currentTime, 0.05, 0.12); },
    ok(combo = 0) {
      const t = ctx.currentTime, up = Math.min(combo, 12);
      pluck(hz(19 + up), t, 0.6, 0.35, sfxBus, 1.5);
      pluck(hz(24 + up), t + 0.09, 0.9, 0.35, sfxBus, 1.5);
    },
    ng() { const t = ctx.currentTime; tone('square', 196, t, 0.28, 0.12, 110); tone('square', 185, t + 0.02, 0.28, 0.08, 100); },
    step() { pluck(hz(12 + [0, 5, 7][Math.floor(Math.random() * 3)]), ctx.currentTime, 0.3, 0.2, sfxBus, 1.2); },
    stamp() { const t = ctx.currentTime; tone('sine', 120, t, 0.25, 0.6, 50); noise(t, 0.12, 0.5, 900); },
    level() { const t = ctx.currentTime; [0, 5, 7, 12, 17].forEach((s, i) => pluck(hz(12 + s), t + i * 0.08, 0.8, 0.28, sfxBus, 1.4)); },
    goal() {
      const t = ctx.currentTime;
      [[0, 0], [5, 0.15], [7, 0.3], [12, 0.45], [7, 0.7], [12, 0.85]].forEach(([s, d]) => pluck(hz(12 + s), t + d, 1, 0.3, sfxBus, 1.3));
    },
    tick() { tone('sine', 1400, ctx.currentTime, 0.04, 0.1); },
  };
  function play(name, arg) {
    if (!ctx || !on('sfx')) return;
    sfx[name]?.(arg);
  }

  return { init, bgm, stopBgm, play };
})();
