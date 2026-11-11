/**
 * Boot awaits several services (consent/ads, Play Billing, cloud progress).
 * If one never settles — no network, a host without Google Play services such
 * as Google Play Games on PC — startup would sit on a black screen forever.
 * `guarded()` lets boot carry on after `ms`, logging which step was slow.
 * @module systems/bootGuard
 */

/**
 * Resolves with `promise`'s result, or `fallback` if it rejects or takes longer than `ms`.
 *
 * @example
 * await guarded('firebaseService.init', firebaseService.init(firebaseConfig), 10000);
 *
 * @param {string}  label     Name of the step, for the console warning.
 * @param {Promise} promise   The step to wait for.
 * @param {number}  ms        Give up after this many milliseconds.
 * @param {*}       [fallback=undefined]  Value to resolve with when it fails or times out.
 * @returns {Promise<*>}
 */
export function guarded(label, promise, ms, fallback = undefined) {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            console.warn(`[boot] ${label} timed out after ${ms}ms — continuing`);
            resolve(fallback);
        }, ms);
        Promise.resolve(promise).then(
            value => { clearTimeout(timer); resolve(value); },
            err => { clearTimeout(timer); console.warn(`[boot] ${label} failed:`, err); resolve(fallback); },
        );
    });
}
