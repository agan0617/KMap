// 音樂與音效：全部用 Web Audio 即時合成，不用音檔。
// 背景音樂每個地區一首寫好的小曲（2026-10-24 Ken 要可愛、各地不同）：旋律＋和弦伴奏＋低音＋輕打擊，循環播放；
// 限時關換成同一首的快板。旋律用簡譜寫：1～7 是 do～ti，' 高八度、, 低八度，- 延長一格，. 休止；一格是八分音符。
const Sound = (() => {
  let ctx = null, master = null, bgmBus = null, sfxBus = null;
  let timer = null, nextAt = 0, step = 0, song = null, seq = null, fast = false;

  const MAJ = [0, 2, 4, 5, 7, 9, 11];
  const QUAL = { M: [0, 4, 7], m: [0, 3, 7], 5: [0, 7] };

  // key：do 的 MIDI 音高（72＝C5）；chords：每小節一個和弦，「半音數＋M/m/5」；
  // bs／cs：一小節裡第幾格彈低音／和弦，arp＝和弦拆成分解和弦；drum：k 大鼓、s 沙鈴、w 木魚、h 手鼓、c 拍板、b 鈴
  const SONGS = {
    taiwan: { // 馬林巴＋烏克麗麗，輕快帶一點搖擺
      bpm: 112, key: 72, bar: 8, swing: 0.12, lead: 'marimba', acc: 'uke', arp: true, bs: [0, 4], cs: [0, 2, 4, 6],
      drum: { k: [0, 4], s: [2, 6] },
      chords: '0M 7M 9m 7M 5M 0M 7M 0M',
      mel: `1 . 2 3 5 - 3 . | 2 . 1 2 3 - - . | 3 . 5 6 5 - 3 2 | 2 - 3 - 2 - - . |
            5 . 6 1' 6 - 5 . | 3 . 5 6 5 - - . | 6 5 3 2 1 . 2 3 | 1 - - . . . . .`,
    },
    japan: { // 琴的撥弦，陽音階（do re fa sol la），以 re 收尾
      bpm: 92, key: 72, bar: 8, lead: 'koto', acc: 'koto', arp: true, bs: [0], cs: [2, 4, 6],
      drum: { k: [0], w: [4] },
      chords: '25 05 55 25 95 55 75 25',
      mel: `2 . 4 . 5 - 4 . | 2 . 1 . 2 - - . | 4 . 5 6 5 . 4 2 | 4 - - . 5 . 4 . |
            6 . 5 . 4 5 6 1' | 6 - 5 . 4 - - . | 2 . 4 5 6 . 5 4 | 2 - - . . . . .`,
    },
    china: { // 笛子＋古箏分解和弦，五聲音階，木魚打拍子
      bpm: 100, key: 72, bar: 8, lead: 'flute', acc: 'koto', arp: true, bs: [0], cs: [0, 2, 4, 6],
      drum: { w: [0, 2, 4, 6] },
      chords: '05 7M 9m 7M 9m 2m 7M 0M',
      mel: `3 5 6 . 5 3 2 . | 1 2 3 - 2 - - . | 5 . 6 1' 6 5 3 . | 2 - 3 2 1 - - . |
            6, . 1 2 3 . 5 . | 6 5 3 . 2 - - . | 3 5 2 3 6, . 1 2 | 1 - - . . . . .`,
    },
    usa: { // 班鳩琴的鄉村小調，低音一根一五交替
      bpm: 126, key: 67, bar: 8, lead: 'banjo', acc: 'uke', bs: [0, 4], cs: [2, 6],
      drum: { k: [0, 4], c: [2, 6] },
      chords: '0M 5M 0M 7M 0M 5M 7M 0M',
      mel: `1 . 3 5 5 . 3 . | 4 . 6 . 5 - - . | 3 . 5 1' 1' . 6 5 | 4 . 3 . 2 - - . |
            1 . 3 5 5 . 6 7 | 1' . 6 . 5 . 3 . | 4 . 2 . 5 . 7, 2 | 1 - - . . . . .`,
    },
    asia: { // 鐵琴＋馬林巴，像甘美朗的叮叮噹噹
      bpm: 104, key: 74, bar: 8, lead: 'glock', acc: 'marimba', arp: true, bs: [0], cs: [0, 2, 4, 6],
      drum: { b: [0], s: [2, 6] },
      chords: '0M 7M 9m 0M 5M 9m 7M 0M',
      mel: `1 2 3 5 3 2 1 . | 5, . 1 . 2 - - . | 3 5 6 5 3 2 3 . | 5 - - . 3 . . . |
            6 . 5 . 6 1' 6 5 | 3 . 2 . 3 - - . | 2 3 5 3 2 1 6, . | 1 - - . . . . .`,
    },
    europe: { // 音樂盒圓舞曲（三拍子）
      bpm: 138, key: 72, bar: 6, lead: 'musicbox', acc: 'musicbox', bs: [0], cs: [2, 4],
      drum: { b: [0] },
      chords: '0M 0M 7M 7M 0M 5M 7M 0M',
      mel: `5 - - - 3 4 | 5 - 1' - 5 - | 4 - - - 2 3 | 4 - 7 - 4 - |
            3 - - - 1 2 | 3 - 6 - 5 4 | 3 - 2 - 7, 2 | 1 - - - . .`,
    },
    africa: { // 拇指琴＋手鼓＋沙鈴，切分節奏
      bpm: 112, key: 72, bar: 8, lead: 'kalimba', acc: 'marimba', arp: true, bs: [0, 3, 6], cs: [1, 3, 5, 7],
      drum: { s: [0, 1, 2, 3, 4, 5, 6, 7], h: [0, 3, 6], w: [4] },
      chords: '0M 5M 0M 7M 5M 0M 7M 0M',
      mel: `1 . 1 3 . 5 . 3 | 5 . 6 5 . 3 2 . | 1 . 1 3 . 5 . 6 | 5 - - . . 3 2 . |
            6 . 6 5 . 6 1' . | 6 5 3 . 2 . 3 . | 5 . 3 2 . 1 2 . | 1 - - . . . . .`,
    },
    americas: { // 鋼鼓的加勒比海風
      bpm: 120, key: 72, bar: 8, lead: 'steel', acc: 'marimba', bs: [0, 3, 6], cs: [2, 4, 7],
      drum: { k: [0], s: [1, 3, 5, 7], h: [3, 6] },
      chords: '0M 2m 7M 0M 0M 5M 7M 0M',
      mel: `. 3 . 5 . 3 1 . | 2 . 4 . 6 . 5 . | . 7, . 2 . 5 4 . | 3 - - . . . . . |
            . 3 . 5 . 1' 6 . | 5 . 4 . 6 . 4 . | 3 . 5 . 2 . 7, . | 1 - - . . . . .`,
    },
    oceania: { // 烏克麗麗的夏威夷慢搖擺
      bpm: 96, key: 72, bar: 8, swing: 0.2, lead: 'uke', acc: 'uke', arp: true, bs: [0], cs: [0, 2, 4, 6],
      drum: { s: [1, 3, 5, 7] },
      chords: '0M 5M 7M 7M 0M 5M 7M 0M',
      mel: `3 . 3 2 3 . 5 . | 6 . 5 . 3 - - . | 2 . 2 1 2 . 3 . | 5 . 3 . 2 - - . |
            3 . 3 2 3 . 5 . | 1' . 6 . 5 - 6 . | 5 . 3 . 2 . 3 . | 1 - - . . . . .`,
    },
  };
  const VOL = { marimba: 0.3, uke: 0.24, koto: 0.24, flute: 0.15, banjo: 0.22, glock: 0.2, musicbox: 0.24, kalimba: 0.28, steel: 0.22 };

  // 把簡譜字串轉成每格的音（{semi, len}）與每小節的和弦
  const parsed = {};
  function parse(key) {
    if (parsed[key]) return parsed[key];
    const s = SONGS[key], toks = s.mel.replace(/\|/g, ' ').trim().split(/\s+/), mel = [];
    toks.forEach((tk, i) => {
      if (tk === '.' || tk === '-') { mel.push(null); return; }
      const d = +tk[0] - 1, oct = (tk.match(/'/g) || []).length - (tk.match(/,/g) || []).length;
      let len = 1;
      while (toks[i + len] === '-') len++;
      mel.push({ semi: MAJ[d] + 12 * oct, len });
    });
    const chords = s.chords.split(/\s+/).map(c => [+c.slice(0, -1), QUAL[c.slice(-1)]]);
    return (parsed[key] = { mel, chords, steps: mel.length });
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.32; bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    // 淡淡的殘響：一條回授延遲線，只接背景音樂
    const fb = ctx.createGain(); fb.gain.value = 0.18;
    const dl = ctx.createDelay(); dl.delayTime.value = 0.19;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    bgmBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
  }

  const mhz = m => 440 * Math.pow(2, (m - 69) / 12);
  const on = k => Store.settings()[k];

  // ── 音色 ──
  function osc(type, f, t, dur, vol, bus, att = 0.005) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + att + dur + 0.05);
  }
  function slide(type, f0, f1, t, dur, vol, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  // 撥弦：三角波＋高八度正弦，濾波器從亮收到暗
  function pluck(freq, t, dur, vol, bus, bright = 1) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'triangle'; o1.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6 * bright, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(bus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, freq, bus = sfxBus, type = 'lowpass') {
    const n = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(bus); n.start(t);
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const INST = {
    musicbox: (f, t, d, v, b) => { osc('sine', f, t, clamp(d, 0.9, 1.6), v, b, 0.003); osc('sine', f * 3, t, 0.25, v * 0.12, b, 0.003); osc('sine', f * 5.04, t, 0.08, v * 0.06, b, 0.003); },
    glock: (f, t, d, v, b) => { osc('sine', f, t, clamp(d, 1, 1.6), v, b, 0.003); osc('sine', f * 2.76, t, 0.3, v * 0.25, b, 0.003); osc('sine', f * 5.4, t, 0.1, v * 0.1, b, 0.003); },
    marimba: (f, t, d, v, b) => { osc('sine', f, t, clamp(d, 0.3, 0.6), v, b, 0.004); osc('sine', f * 4, t, 0.05, v * 0.25, b, 0.002); },
    kalimba: (f, t, d, v, b) => { osc('sine', f, t, clamp(d, 0.5, 1), v, b, 0.003); osc('sine', f * 5.95, t, 0.06, v * 0.3, b, 0.002); osc('triangle', f * 2, t, 0.12, v * 0.15, b, 0.003); },
    uke: (f, t, d, v, b) => pluck(f, t, clamp(d, 0.4, 0.9), v, b, 1.6),
    banjo: (f, t, d, v, b) => pluck(f, t, clamp(d, 0.25, 0.5), v, b, 2.4),
    koto: (f, t, d, v, b) => pluck(f, t, clamp(d, 0.8, 1.4), v, b, 1.8),
    steel: (f, t, d, v, b) => { osc('sine', f, t, clamp(d, 0.5, 0.9), v, b, 0.004); osc('sine', f * 2, t, 0.35, v * 0.35, b, 0.004); osc('sine', f * 3.01, t, 0.15, v * 0.12, b, 0.004); },
    flute: (f, t, d, v, b) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; l.frequency.value = 5.5; lg.gain.value = f * 0.006;
      l.connect(lg); lg.connect(o.frequency);
      const end = t + Math.max(d * 0.9, 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.05);
      g.gain.setValueAtTime(v * 0.85, end); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
      o.connect(g); g.connect(b); o.start(t); l.start(t); o.stop(end + 0.2); l.stop(end + 0.2);
      osc('triangle', f * 2, t, 0.05, v * 0.1, b);
    },
    bass: (f, t, d, v, b) => osc('triangle', f, t, clamp(d, 0.2, 0.45), v, b, 0.01),
  };
  const DRUM = {
    k: (t, b) => slide('sine', 150, 48, t, 0.18, 0.5, b),
    s: (t, b) => noise(t, 0.04, 0.12, 7000, b, 'highpass'),
    w: (t, b, j) => osc('sine', j % 4 ? 900 : 1200, t, 0.05, 0.22, b, 0.001),
    h: (t, b, j) => slide('sine', j === 0 ? 200 : 260, 150, t, 0.14, 0.4, b),
    c: (t, b) => noise(t, 0.05, 0.25, 2200, b, 'bandpass'),
    b: (t, b) => INST.glock(mhz(96), t, 0.6, 0.05, b),
  };

  // ── 背景音樂 ──
  function tick() {
    const e = 60 / (song.bpm * (fast ? 1.3 : 1)) / 2; // 一格（八分音符）幾秒
    while (nextAt < ctx.currentTime + 0.25) {
      const i = step % seq.steps, bar = Math.floor(i / song.bar), j = i % song.bar;
      const t = nextAt + (j % 2 && song.swing ? e * song.swing : 0);
      const m = seq.mel[i];
      if (m) INST[song.lead](mhz(song.key + m.semi), t, m.len * e, VOL[song.lead], bgmBus);
      const [root, qual] = seq.chords[bar];
      const k = song.cs.indexOf(j);
      if (k >= 0) {
        const tones = qual.map(s => song.key - 12 + root + s);
        if (song.arp) INST[song.acc](mhz(tones[k % tones.length]), t, 2 * e, VOL[song.acc] * 0.4, bgmBus);
        else tones.forEach(n => INST[song.acc](mhz(n), t, e, VOL[song.acc] * 0.25, bgmBus));
      }
      const bi = song.bs.indexOf(j);
      if (bi >= 0) INST.bass(mhz(song.key - 24 + root + (bi % 2 ? 7 : 0)), t, 2 * e, 0.22, bgmBus);
      for (const [d, at] of Object.entries(song.drum)) if (at.includes(j)) DRUM[d](t, bgmBus, j);
      if (fast && !song.drum.s?.includes(j)) DRUM.s(t, bgmBus);
      nextAt += e;
      step++;
    }
  }

  function bgm(regionKey, s) {
    stopBgm();
    if (!ctx || !on('bgm') || !s) return;
    const key = SONGS[regionKey] ? regionKey : 'taiwan';
    song = SONGS[key]; seq = parse(key); fast = s === 'fast'; step = 0;
    nextAt = ctx.currentTime + 0.1;
    timer = setInterval(tick, 80);
  }
  function stopBgm() { if (timer) clearInterval(timer); timer = null; }

  // ── 音效（2026-10-24 改成鐵琴、音樂盒那種圓潤的音，答錯也不刺耳） ──
  const semi = d => 12 * Math.floor(d / 7) + MAJ[((d % 7) + 7) % 7];
  const sfx = {
    tap() { slide('sine', 900, 1500, ctx.currentTime, 0.06, 0.14, sfxBus); },
    ok(combo = 0) { // 連對越多音越高
      const t = ctx.currentTime, up = Math.min(combo, 10);
      INST.glock(mhz(72 + semi(2 + up)), t, 0.6, 0.32, sfxBus);
      INST.glock(mhz(72 + semi(4 + up)), t + 0.07, 0.6, 0.3, sfxBus);
      INST.musicbox(mhz(72 + semi(7 + up)), t + 0.14, 0.8, 0.22, sfxBus);
    },
    ng() { // 「哦哦～」兩聲往下
      const t = ctx.currentTime;
      slide('triangle', 523, 494, t, 0.13, 0.3, sfxBus);
      slide('triangle', 392, 311, t + 0.16, 0.26, 0.3, sfxBus);
    },
    step() { INST.kalimba(mhz(72 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)]), ctx.currentTime, 0.5, 0.3, sfxBus); },
    stamp() {
      const t = ctx.currentTime;
      slide('sine', 170, 60, t, 0.22, 0.6, sfxBus); noise(t, 0.08, 0.3, 900);
      [96, 100, 103].forEach((m, i) => INST.glock(mhz(m), t + 0.08 + i * 0.06, 0.5, 0.12, sfxBus));
    },
    level() { const t = ctx.currentTime; [72, 76, 79, 84].forEach((m, i) => INST.glock(mhz(m), t + i * 0.07, 0.7, 0.26, sfxBus)); },
    goal() {
      const t = ctx.currentTime;
      [[72, 0], [76, 0.1], [79, 0.2], [84, 0.3], [79, 0.5], [84, 0.6], [88, 0.75]].forEach(([m, d]) => INST.musicbox(mhz(m), t + d, 1, 0.3, sfxBus));
      [96, 100, 103, 108].forEach((m, i) => INST.glock(mhz(m), t + 0.9 + i * 0.05, 0.6, 0.1, sfxBus));
    },
    tick() { osc('sine', 1500, ctx.currentTime, 0.03, 0.1, sfxBus, 0.001); },
    clear() { // 挑戰模式整區全對：小號角＋鈴聲閃閃
      const t = ctx.currentTime;
      [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [76, 0.6], [79, 0.72], [84, 0.9]].forEach(([m, d]) => {
        INST.musicbox(mhz(m), t + d, 1.2, 0.3, sfxBus); INST.marimba(mhz(m - 12), t + d, 0.4, 0.2, sfxBus);
      });
      [[48, 0], [55, 0.36], [60, 0.9]].forEach(([m, d]) => INST.bass(mhz(m), t + d, 0.45, 0.35, sfxBus));
      [96, 100, 103, 108, 103, 108, 112].forEach((m, i) => INST.glock(mhz(m), t + 1.1 + i * 0.07, 0.8, 0.1, sfxBus));
      slide('sine', 150, 48, t + 0.9, 0.25, 0.5, sfxBus);
    },
  };
  function play(name, arg) {
    if (!ctx || !on('sfx')) return;
    sfx[name]?.(arg);
  }

  return { init, bgm, stopBgm, play, SONGS, parse };
})();
