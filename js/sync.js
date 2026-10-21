// 雲端存檔：進度同步到私有 repo CloudSave 的 saves/kmap.json（做法同魔塔、K書吧：瀏覽器直接打 GitHub API，沒有中間伺服器）。
// token 存在這台裝置。K地圖跟 K書吧、魔塔在同一個網域（agan0617.github.io），這台瀏覽器連過它們就直接沿用那組 token；
// App 的 WebView 跟瀏覽器資料分開，要在 App 裡另外貼一次。
// 合併規則在 Store.mergeProgress：熟練度取高的、複習排程用最近玩的那一份，所以多台裝置同時玩也不會互相蓋掉。
const Sync = (() => {
  const FILE = 'saves/kmap.json';
  const OWN = 'kmap:gh';
  const SHARED = ['shuxia:gh', 'mt.gh'];   // K書吧、魔塔存的連線設定
  const DEFAULT = { owner: 'agan0617', repo: 'CloudSave', token: '' };
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 私密視窗 */ } };

  const b64enc = s => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0)));

  // 連線設定：自己存的優先；按過「中斷連線」（off）就不沿用別的 App 的 token
  function conf() {
    const own = get(OWN);
    if (own?.off) return { ...DEFAULT, from: 'off' };
    if (own?.token) return { ...DEFAULT, ...own, from: 'kmap' };
    for (const k of SHARED) { const o = get(k); if (o?.token) return { ...DEFAULT, owner: o.owner || DEFAULT.owner, repo: o.repo || DEFAULT.repo, token: o.token, from: k }; }
    return { ...DEFAULT, from: '' };
  }
  const device = () => {
    const ua = navigator.userAgent;
    if (/KMapApp/.test(ua)) return 'Android App';
    return (/Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Web');
  };

  const S = {
    status: 'off', error: '', lastSync: 0, sha: null, onStatus: null,
    conf, connected: () => !!conf().token,
    set(st, err) {
      this.status = st; this.error = err || '';
      if (st === 'ok') this.lastSync = Date.now();
      this.onStatus?.(st, this.error);
    },
    async api(path, opt = {}) {
      const c = conf();
      const headers = { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json' };
      if (opt.body) headers['Content-Type'] = 'application/json';
      let r;
      try { r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/${path}`, { cache: 'no-store', ...opt, headers }); }
      catch (e) { throw Object.assign(new Error(e.message), { status: 0 }); }
      if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) { /* 沒內容 */ } throw Object.assign(new Error(m || 'HTTP ' + r.status), { status: r.status }); }
      return r.json();
    },
    async fetchRemote() {
      try {
        const j = await this.api('contents/' + FILE);
        return { data: JSON.parse(b64dec(j.content)), sha: j.sha };
      } catch (e) { if (e.status === 404) return { data: null, sha: null }; throw e; }
    },
    fail(e) {
      if (!e.status) this.set('offline');
      else this.set('err', e.status === 401 ? t('cloud.err401') : e.status === 403 ? t('cloud.err403') : e.status === 404 ? t('cloud.err404') : e.message);
    },

    // 拉雲端的下來合併；本機有雲端沒有的就順便推上去。回傳本機進度有沒有變
    async pull() {
      if (!this.connected()) { this.set('off'); return false; }
      this.set('sync');
      try {
        const r = await this.fetchRemote();
        this.sha = r.sha;
        const changed = Store.mergeIn(r.data?.progress);
        if (!r.data || JSON.stringify(Store.progress()) !== JSON.stringify(Store.mergeProgress(r.data.progress, {}))) await this.push();
        else this.set('ok');
        return changed;
      } catch (e) { this.fail(e); return false; }
    },

    timer: null,
    schedule() {
      if (!this.connected()) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.push(), 3000);
    },
    pushing: null,
    async push(keepalive) {
      if (!this.connected()) return;
      clearTimeout(this.timer);
      if (this.pushing && !keepalive) { this.schedule(); return; }
      this.set('sync');
      const run = async () => {
        for (let tries = 0; tries < 4; tries++) {
          try {
            // 先拿雲端最新版合併（別台裝置可能剛推過），沒衝突就直接用記住的 sha
            if (this.sha === null || tries > 0) {
              const r = await this.fetchRemote();
              this.sha = r.sha;
              if (r.data) Store.mergeIn(r.data.progress);
            }
            const body = { message: `K地圖進度 ${device()} ${new Date().toISOString().slice(0, 16)}`,
              content: b64enc(JSON.stringify({ v: 1, at: Date.now(), progress: Store.progress() })) };
            if (this.sha) body.sha = this.sha;
            const j = await this.api('contents/' + FILE, { method: 'PUT', body: JSON.stringify(body), keepalive: !!keepalive });
            this.sha = j.content.sha;
            this.set('ok');
            return;
          } catch (e) {
            if ((e.status === 409 || e.status === 422) && tries < 3) { this.sha = null; continue; }
            throw e;
          }
        }
      };
      this.pushing = run().catch(e => this.fail(e)).finally(() => { this.pushing = null; });
      return this.pushing;
    },

    // 貼 token 連線：先試讀一次，成功才存
    async connect(token) {
      const prev = get(OWN);
      put(OWN, { ...DEFAULT, token });
      this.sha = null;
      try { await this.fetchRemote(); }
      catch (e) { put(OWN, prev); this.fail(e); throw e; }
      return this.pull();
    },
    disconnect() { put(OWN, { off: true }); this.sha = null; this.set('off'); },
    // 中斷後想改回沿用 K書吧／魔塔的 token
    reuseShared() { put(OWN, null); this.sha = null; return this.pull(); },
    sharedAvailable: () => SHARED.some(k => get(k)?.token),
  };
  return S;
})();
