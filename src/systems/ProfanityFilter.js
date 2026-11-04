/**
 * Player-name profanity check: vulgarities, slurs and their common
 * disguises — leetspeak (`sh1t`, `a55`, `@ss`, `b!tch`), separators
 * (`f.u.c.k`, `f_u_c_k`), stretched letters (`fuuuck`), padding digits
 * (`dick123`) and a few phonetic spellings (`phuck`, `azz`).
 * @module systems/ProfanityFilter
 */

// Matched anywhere in the name (after normalising) — words that are very
// unlikely to appear inside an innocent one.
const STRONG = [
    'fuck', 'fuk', 'fuq', 'fck', 'fcuk', 'phuck', 'phuk', 'fvck', 'stfu', 'gtfo',
    'shit', 'shyt', 'cunt', 'kunt', 'bitch', 'biatch', 'biotch', 'beyotch', 'bastard',
    'asshole', 'arsehole', 'asshat', 'asswipe', 'assclown', 'asslick', 'assface', 'kissmyass',
    'dumbass', 'jackass', 'fatass', 'smartass', 'butthole', 'buttplug',
    'cocksuck', 'dickhead', 'dickwad', 'douche', 'wanker', 'twat', 'bollock', 'goddamn', 'piss',
    'pussy', 'penis', 'vagina', 'dildo', 'jizz', 'sperm', 'clit', 'boner', 'orgasm', 'scrotum',
    'testicle', 'smegma', 'queef', 'cameltoe', 'titty', 'titties', 'boob',
    'whore', 'slut', 'skank', 'porn', 'hentai', 'milf', 'xxx', 'blowjob', 'handjob', 'rimjob',
    'incest', 'molest', 'pedophile', 'paedophile',
    'nigg', 'faggot', 'fagot', 'kike', 'wetback', 'beaner', 'tranny', 'retard', 'gook',
    'hitler', 'kkk',
];

// Matched only as a whole word (one name part, or the whole name with
// separators removed) — they turn up inside innocent names (classic,
// Dickens, cocktail, Arsenal, therapist, Scunthorpe-style problems).
const WEAK = [
    'ass', 'azz', 'arse', 'dick', 'cock', 'cum', 'anal', 'anus', 'tit', 'tits', 'semen',
    'spunk', 'wank', 'prick', 'horny', 'sex', 'sexy', 'hoe', 'hoes', 'thot', 'rape', 'rapist',
    'pedo', 'damn', 'crap', 'bugger', 'wtf', 'mofo', 'kys',
    'fag', 'dyke', 'homo', 'queer', 'spic', 'chink', 'coon', 'jap', 'negro', 'nazi', 'heil',
];

// Leetspeak / symbol stand-ins. `1` is tried as both `i` and `l`.
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' };
const SYMBOLS = '0-9@$!|+';
const NOT_WORD_CHAR = new RegExp(`[^a-z${SYMBOLS}]+`, 'g');

/** Longest run of one repeated letter in `s` (`kkk` → 3, `ass` → 2, `fuck` → 1). */
const longestRun = s => Math.max(1, ...(s.match(/(.)\1*/g) ?? ['']).map(r => r.length));

/** Shortens every run of a repeated letter to at most `max` (`fuuuck`, 1 → `fuck`). */
const squeeze = (s, max) => s.replace(/(.)\1+/g, r => r[0].repeat(Math.min(r.length, max)));

/** Leetspeak decodings of `s` — one with `1`→`i`, plus one with `1`→`l` if different. */
function decodings(s) {
    const asI = [...s].map(c => LEET[c] ?? c).join('');
    const asL = [...s].map(c => (c === '1' ? 'l' : LEET[c] ?? c)).join('');
    return asI === asL ? [asI] : [asI, asL];
}

const prep = words => words.map(w => ({ w, run: longestRun(w) }));
const STRONG_WORDS = prep(STRONG);
const WEAK_WORDS   = prep(WEAK);

/**
 * True if `name` contains a vulgar word, slur or a disguised spelling of one.
 * Errs on the side of blocking — a few innocent names that contain a strong
 * word (e.g. "Scunthorpe") are rejected too.
 * @param {string} name  Player-entered name.
 * @returns {boolean}
 */
export function containsProfanity(name) {
    const lower = String(name ?? '').toLowerCase();

    // Whole name with separators removed: catches f.u.c.k, a_s_s, etc.
    const joined = lower.replace(NOT_WORD_CHAR, '');
    for (const d of decodings(joined)) {
        if (STRONG_WORDS.some(({ w, run }) => squeeze(d, run).includes(w))) return true;
        if (WEAK_WORDS.some(({ w, run }) => squeeze(d, run) === w)) return true;
    }

    // Each name part on its own, also with padding digits dropped (dick123, 69ass).
    for (const part of lower.split(NOT_WORD_CHAR).filter(Boolean)) {
        const forms = [...decodings(part), part.replace(/[0-9]/g, '')];
        for (const f of forms) {
            if (WEAK_WORDS.some(({ w, run }) => squeeze(f, run) === w)) return true;
        }
    }
    return false;
}
