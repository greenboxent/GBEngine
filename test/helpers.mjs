// Test helpers: an in-memory localStorage and a fake Realtime Database that
// speaks the small subset of the Firebase API the engine uses.

export function installLocalStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: k => { store.delete(k); },
        clear: () => store.clear(),
    };
    return store;
}

/**
 * A fake `firebaseService` backed by a plain object tree.
 * @param {object} [opts]
 * @param {object} [opts.tree]       Initial database contents.
 * @param {object|null} [opts.user]  Signed-in user ({uid, isAnonymous, email}) or null.
 * @param {boolean} [opts.hang]      If true, `get` never settles (offline).
 */
export function makeFakeFirebase({ tree = {}, user = null, hang = false } = {}) {
    const calls = { get: 0, set: 0, push: 0 };
    const node = (path, create = false) => {
        let cur = tree;
        for (const part of path.split('/').filter(Boolean)) {
            if (cur == null || typeof cur !== 'object') return undefined;
            if (!(part in cur)) { if (!create) return undefined; cur[part] = {}; }
            cur = cur[part];
        }
        return cur;
    };
    const snap = (val, key = null) => ({
        exists: () => val !== undefined && val !== null,
        val: () => val,
        key,
        forEach: fn => { for (const [k, v] of Object.entries(val ?? {})) fn(snap(v, k)); },
    });
    let pushId = 0;
    const functions = {
        ref: (_db, path) => ({ path }),
        get: async q => {
            calls.get++;
            if (hang) return new Promise(() => {});
            if (q.filter) {
                const all = node(q.path) ?? {};
                const out = {};
                for (const [k, v] of Object.entries(all)) if (v?.[q.filter.child] === q.filter.equals) out[k] = v;
                return snap(out);
            }
            return snap(node(q.path));
        },
        set: async (r, value) => {
            calls.set++;
            const parts = r.path.split('/').filter(Boolean);
            const last = parts.pop();
            const parent = node(parts.join('/'), true);
            if (value === null) delete parent[last]; else parent[last] = JSON.parse(JSON.stringify(value));
        },
        push: r => ({ path: `${r.path}/-id${++pushId}` }),
        query: (r, order, eq) => ({ path: r.path, filter: { child: order.child, equals: eq.value } }),
        orderByChild: child => ({ child }),
        equalTo: value => ({ value }),
    };
    const fb = {
        tree, calls, functions,
        user,
        initialized: true,
        authRestoreTimedOut: false,
        isReady: () => fb.user !== null,
        getDatabase: () => ({}),
        getFunctions: () => functions,
        getUser: () => fb.user,
        getPlayerId: () => fb.user?.uid ?? 'local',
        getAuthProvider: () => (!fb.user ? 'none' : fb.user.isAnonymous ? 'anonymous' : 'google'),
        signOut: async () => { fb.user = null; },
    };
    return fb;
}
