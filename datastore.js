// ═══════════════════════════════════════════════════════════════════════
// CSS DataStore — pluggable data backend
// v2.0 | Driver: GitHub API + localStorage cache
//
// THE SINGLE WRITER. Every sleeve loads this file; nothing else touches
// localStorage or CSS_DATA.json directly (NARSIL "don't bypass DataStore").
//
// Promoted July 19, 2026 out of system.html's inline copy, which had been
// the live implementation while THIS file sat unloaded and stale. The v1
// file lacked: UTF-8 safe decode, the pending/dirty/pushing push machine,
// flush() on pagehide, stale-SHA retry, and the sync-glyph states. Loading
// v1 as-written would have regressed all five. Keep the consumer pointed
// here so the two can never fork again.
//
// Architecture: driver-shaped so the backend can change without any caller
// changing. GitHubDriver is the only one implemented; Electron/CRDT stubs
// were removed (rebuild from scratch if those phases arrive).
//
// Contract: DataStore.use(driver).init() → load() → save(data) → flush()
// ═══════════════════════════════════════════════════════════════════════

// ── DATASTORE INTERFACE ─────────────────────────────────────────────────
// All drivers must implement: init(), load(), save(data), status()
// DataStore exposes the same API regardless of driver.

const DataStore = {
  _driver: null,
  _ready: false,
  _listeners: [],

  // Set which driver to use before calling init()
  use(driver) {
    this._driver = driver;
    return this;
  },

  async init() {
    if (!this._driver) throw new Error('DataStore: no driver set. Call DataStore.use(driver) first.');
    await this._driver.init();
    this._ready = true;
    return this;
  },

  async load() {
    if (!this._ready) throw new Error('DataStore: call init() before load()');
    const data = await this._driver.load();
    this._emit('load', data);
    return data;
  },

  async save(data) {
    if (!this._ready) throw new Error('DataStore: call init() before save()');
    await this._driver.save(data);
    this._emit('save', data);
  },

  status() {
    return this._driver?.status?.() || { driver: 'none', ready: this._ready };
  },

  // Immediate push of any pending save (bypasses the debounce). Safe no-op
  // when the driver has none or doesn't support it.
  flush() {
    return this._driver?.flush?.();
  },

  // Simple event bus for UI reactivity
  on(event, fn) { this._listeners.push({ event, fn }); },
  _emit(event, payload) {
    this._listeners
      .filter(l => l.event === event)
      .forEach(l => l.fn(payload));
  }
};


// ── PHASE 1: GITHUB DRIVER ──────────────────────────────────────────────
// Reads/writes CSS_DATA.json in a private GitHub repository.
// localStorage acts as cache — writes are immediate locally,
// async-pushed to GitHub. Offline: works from cache, syncs on reconnect.
//
// Required localStorage keys (set via DataStore setup UI or direct):
//   css_github_token  — personal access token (repo scope)
//   css_github_repo   — "username/reponame"
//   css_github_path   — file path in repo (default: "CSS_DATA.json")

const GitHubDriver = {
  _token: null,
  _repo: null,
  _path: 'CSS/CSS_DATA.json',
  _sha: null,           // GitHub requires SHA for updates
  _cache: null,
  _pushPending: false,
  _baseUrl: 'https://api.github.com',
  CACHE_KEY: 'css_v3_data',
  SHA_KEY: 'css_github_sha',

  async init() {
    this._token = localStorage.getItem('css_github_token');
    this._repo  = localStorage.getItem('css_github_repo');
    const path  = localStorage.getItem('css_github_path');
    if (path) this._path = path;
    this._sha   = localStorage.getItem(this.SHA_KEY) || null;

    if (!this._token || !this._repo) {
      throw new Error('GitHubDriver: missing css_github_token or css_github_repo in localStorage.');
    }
  },

  async load() {
    try {
      const url = `${this._baseUrl}/repos/${this._repo}/contents/${this._path}`;
      const res = await fetch(url, { headers: this._headers() });

      if (res.status === 404) {
        // File doesn't exist yet — start from cache or empty
        console.warn('GitHubDriver: file not found on remote. Using local cache.');
        return this._loadFromCache();
      }

      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

      const json = await res.json();
      this._sha = json.sha;
      localStorage.setItem(this.SHA_KEY, this._sha);

      const data = JSON.parse(decodeURIComponent(escape(atob(json.content.replace(/\n/g, '')))));
      // Update local cache
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
      this._cache = data;
      return data;

    } catch (e) {
      console.warn('GitHubDriver: load failed, falling back to cache.', e.message);
      return this._loadFromCache();
    }
  },

  async save(data) {
    // Write to localStorage immediately — UI is always fast
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    this._cache = data;

    // The push always sends whatever was saved LAST, not the data captured
    // when the debounce started — saves landing mid-debounce are never dropped.
    this._pendingData = data;
    this._dirty = true;
    this._schedulePush();
  },

  _schedulePush() {
    if (this._pushTimer) clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.flush(), 1500); // 1.5s debounce
    this._setSync('pending');
  },

  // Push now, skipping the debounce. Called by the timer, and directly on
  // visibilitychange→hidden so iOS suspending the PWA can't strand a save.
  async flush() {
    if (this._pushTimer) { clearTimeout(this._pushTimer); this._pushTimer = null; }
    if (this._pushing) return;           // in-flight push will re-check _dirty
    if (!this._dirty) return;
    this._pushing = true;
    const payload = this._pendingData;
    this._dirty = false;
    try {
      await this._pushToGitHub(payload);
      this._lastPushError = null;
      this._setSync(this._dirty ? 'pending' : 'synced');
    } catch (e) {
      this._dirty = true;                // keep the payload for the next attempt
      this._lastPushError = e.message;
      this._setSync('failed');
      console.warn('GitHubDriver: push failed, will retry on next save.', e.message);
    } finally {
      this._pushing = false;             // NEVER wedge the state machine
    }
    // A save arrived while this push was in flight — send it too.
    if (this._dirty && !this._pushTimer && !this._lastPushError) this._schedulePush();
  },

  async _pushToGitHub(data) {
    const url = `${this._baseUrl}/repos/${this._repo}/contents/${this._path}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = {
      message: `css: sync ${new Date().toISOString().slice(0,10)}`,
      content,
      ...(this._sha ? { sha: this._sha } : {})
    };

    let res = await fetch(url, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(body)
    });

    // Stale SHA (409 conflict / 422 mismatch) used to fail every push forever.
    // Refetch the current SHA and retry once — last writer wins, same policy
    // as remote-wins on load.
    if (!res.ok && (res.status === 409 || res.status === 422)) {
      const fresh = await fetch(url, { headers: this._headers() });
      if (fresh.ok) {
        const fj = await fresh.json();
        this._sha = fj.sha;
        localStorage.setItem(this.SHA_KEY, this._sha);
        res = await fetch(url, {
          method: 'PUT',
          headers: this._headers(),
          body: JSON.stringify({ ...body, sha: this._sha })
        });
      }
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub push failed: ${err.message}`);
    }

    const json = await res.json();
    this._sha = json.content.sha;
    localStorage.setItem(this.SHA_KEY, this._sha);
  },

  _setSync(state) {
    this._syncState = state;
    // The glyph is chrome; a UI error must never break the sync machinery.
    try {
      if (typeof window !== 'undefined' && window.updateSyncGlyph) window.updateSyncGlyph(state, this._lastPushError);
    } catch (e) { /* glyph render failed — sync continues */ }
  },

  _loadFromCache() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },

  _headers() {
    return {
      'Authorization': `token ${this._token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  },

  status() {
    return {
      driver: 'GitHub',
      repo: this._repo,
      path: this._path,
      sha: this._sha,
      hasCachedData: !!localStorage.getItem(this.CACHE_KEY),
      syncState: this._syncState || 'synced',   // synced | pending | failed
      pushPending: !!(this._dirty || this._pushing),
      lastPushError: this._lastPushError || null
    };
  }
};


// Phase 2 (FileSystemDriver) and Phase 3 (AutomergeDriver) stubs removed.
// Rebuild from scratch when those phases are actually needed.


// ── SETUP HELPER ────────────────────────────────────────────────────────
// Called once during initial GitHub setup.
// Stores credentials in localStorage, initializes the driver.

async function setupGitHubDataStore(token, repo, path = 'CSS/CSS_DATA.json') {
  localStorage.setItem('css_github_token', token);
  localStorage.setItem('css_github_repo', repo);
  localStorage.setItem('css_github_path', path);
  await DataStore.use(GitHubDriver).init();
  return DataStore.status();
}


// ── EXPORT ──────────────────────────────────────────────────────────────
// Loaded as a classic script by every sleeve (system.html's loader array),
// so DataStore / GitHubDriver / setupGitHubDataStore are globals. Becomes a
// real module export if sleeves ever move to type="module".

