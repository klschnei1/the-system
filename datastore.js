// ═══════════════════════════════════════════════════════════════════════
// CSS DataStore — pluggable data backend
// v1.0 | Driver: GitHub API + localStorage cache
//
// Architecture: three-driver progression
//   Phase 1 (now)      GitHubDriver     — GitHub API + localStorage cache
//   Phase 2 (Electron) FileSystemDriver — direct filesystem read/write
//   Phase 3 (CRDT)     AutomergeDriver  — conflict-free replicated sync
//
// Nothing above this layer should care which driver is active.
// Swap the driver, the rest of the system is unchanged.
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

      const data = JSON.parse(atob(json.content.replace(/\n/g, '')));
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

    // Push to GitHub async — don't block UI
    this._schedulePush(data);
  },

  _schedulePush(data) {
    if (this._pushPending) return; // debounce — one push per cycle
    this._pushPending = true;
    setTimeout(async () => {
      try {
        await this._pushToGitHub(data);
      } catch (e) {
        console.warn('GitHubDriver: push failed, will retry on next save.', e.message);
      }
      this._pushPending = false;
    }, 1500); // 1.5s debounce
  },

  async _pushToGitHub(data) {
    const url = `${this._baseUrl}/repos/${this._repo}/contents/${this._path}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = {
      message: `css: sync ${new Date().toISOString().slice(0,10)}`,
      content,
      ...(this._sha ? { sha: this._sha } : {})
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub push failed: ${err.message}`);
    }

    const json = await res.json();
    this._sha = json.content.sha;
    localStorage.setItem(this.SHA_KEY, this._sha);
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
      pushPending: this._pushPending
    };
  }
};


// ── PHASE 2: FILESYSTEM DRIVER (Electron — stub) ────────────────────────
// When system.html is packaged as an Electron app, swap this driver in.
// Electron exposes `window.electronAPI` via preload script.
// No changes needed anywhere else in the codebase.

const FileSystemDriver = {
  _path: null,
  _cache: null,

  async init() {
    // Electron preload exposes the file path from app config
    this._path = window.electronAPI?.dataPath || './CSS_DATA.json';
    console.log('FileSystemDriver: initialized. Path:', this._path);
  },

  async load() {
    // window.electronAPI.readFile() exposed via Electron's contextBridge
    const raw = await window.electronAPI.readFile(this._path);
    this._cache = JSON.parse(raw);
    return this._cache;
  },

  async save(data) {
    this._cache = data;
    await window.electronAPI.writeFile(this._path, JSON.stringify(data, null, 2));
  },

  status() {
    return { driver: 'FileSystem (Electron)', path: this._path };
  }
};


// ── PHASE 3: CRDT DRIVER (Automerge — stub) ─────────────────────────────
// When multi-device sync and conflict-free editing is needed.
// Automerge documents are CRDTs — any two versions can be merged without conflict.
// Sync happens via a relay (could be GitHub, a local relay server, or P2P).
// The document's change history IS the evolution log.

const AutomergeDriver = {
  _doc: null,
  _repo: null, // Automerge.Repo instance

  async init() {
    // import * as Automerge from '@automerge/automerge'
    // this._repo = new Automerge.Repo({ ... sync config ... })
    // this._doc = await this._repo.find(docId)
    console.log('AutomergeDriver: stub — implement when ready for Phase 3.');
  },

  async load() {
    // return Automerge.toJS(this._doc)
    return null;
  },

  async save(data) {
    // this._doc = Automerge.change(this._doc, doc => { Object.assign(doc, data) })
    // sync happens automatically via Repo
  },

  status() {
    return { driver: 'Automerge (CRDT)', ready: false, note: 'Phase 3 — not yet implemented' };
  }
};


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
// In a module environment: export { DataStore, GitHubDriver, FileSystemDriver, AutomergeDriver }
// In the current inline-script environment: these are available as globals.
