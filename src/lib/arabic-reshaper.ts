/**
 * Arabic Text Reshaper for jsPDF
 * 
 * jsPDF doesn't natively handle Arabic text shaping or RTL.
 * This module:
 * 1. Converts Arabic characters to their correct contextual presentation forms
 * 2. Handles LAM-ALEF ligatures
 * 3. Reverses the text for correct RTL display in LTR-only PDF renderers
 */

// ─── Arabic Presentation Forms ──────────────────────────────────────────────
// Format: base_codepoint → [isolated, final, initial, medial]

const FORMS: Record<number, [number, number, number, number]> = {
  0x0621: [0xFE80, 0xFE80, 0xFE80, 0xFE80], // HAMZA
  0x0622: [0xFE81, 0xFE82, 0xFE81, 0xFE82], // ALEF MADDA
  0x0623: [0xFE83, 0xFE84, 0xFE83, 0xFE84], // ALEF HAMZA ABOVE
  0x0624: [0xFE85, 0xFE86, 0xFE85, 0xFE86], // WAW HAMZA
  0x0625: [0xFE87, 0xFE88, 0xFE87, 0xFE88], // ALEF HAMZA BELOW
  0x0626: [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C], // YEH HAMZA
  0x0627: [0xFE8D, 0xFE8E, 0xFE8D, 0xFE8E], // ALEF
  0x0628: [0xFE8F, 0xFE90, 0xFE91, 0xFE92], // BEH
  0x0629: [0xFE93, 0xFE94, 0xFE93, 0xFE94], // TEH MARBUTA
  0x062A: [0xFE95, 0xFE96, 0xFE97, 0xFE98], // TEH
  0x062B: [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C], // THEH
  0x062C: [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0], // JEEM
  0x062D: [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4], // HAH
  0x062E: [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8], // KHAH
  0x062F: [0xFEA9, 0xFEAA, 0xFEA9, 0xFEAA], // DAL
  0x0630: [0xFEAB, 0xFEAC, 0xFEAB, 0xFEAC], // THAL
  0x0631: [0xFEAD, 0xFEAE, 0xFEAD, 0xFEAE], // REH
  0x0632: [0xFEAF, 0xFEB0, 0xFEAF, 0xFEB0], // ZAIN
  0x0633: [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4], // SEEN
  0x0634: [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8], // SHEEN
  0x0635: [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC], // SAD
  0x0636: [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0], // DAD
  0x0637: [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4], // TAH
  0x0638: [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8], // ZAH
  0x0639: [0xFEC9, 0xFECA, 0xFECB, 0xFECC], // AIN
  0x063A: [0xFECD, 0xFECE, 0xFECF, 0xFED0], // GHAIN
  0x0641: [0xFED1, 0xFED2, 0xFED3, 0xFED4], // FEH
  0x0642: [0xFED5, 0xFED6, 0xFED7, 0xFED8], // QAF
  0x0643: [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC], // KAF
  0x0644: [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0], // LAM
  0x0645: [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4], // MEEM
  0x0646: [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8], // NOON
  0x0647: [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC], // HEH
  0x0648: [0xFEED, 0xFEEE, 0xFEED, 0xFEEE], // WAW
  0x0649: [0xFEEF, 0xFEF0, 0xFEEF, 0xFEF0], // ALEF MAKSURA
  0x064A: [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4], // YEH
};

// ─── LAM-ALEF Ligatures ────────────────────────────────────────────────────
// When LAM (0x0644) is followed by certain ALEF variants → ligature
// Format: alef_variant → [isolated_ligature, final_ligature]

const LAM_ALEF: Record<number, [number, number]> = {
  0x0622: [0xFEF5, 0xFEF6], // LAM + ALEF MADDA
  0x0623: [0xFEF7, 0xFEF8], // LAM + ALEF HAMZA ABOVE
  0x0625: [0xFEF9, 0xFEFA], // LAM + ALEF HAMZA BELOW
  0x0627: [0xFEFB, 0xFEFC], // LAM + ALEF
};

// ─── Joining Classification ────────────────────────────────────────────────

// Dual-joining: connects on both sides (has initial & medial forms)
const DUAL_JOIN = new Set([
  0x0626, 0x0628, 0x062A, 0x062B, 0x062C, 0x062D, 0x062E,
  0x0633, 0x0634, 0x0635, 0x0636, 0x0637, 0x0638, 0x0639, 0x063A,
  0x0640, // TATWEEL (kashida)
  0x0641, 0x0642, 0x0643, 0x0644, 0x0645, 0x0646, 0x0647,
  0x064A,
]);

// Right-joining: connects on right side only (has final form but no initial/medial)
const RIGHT_JOIN = new Set([
  0x0622, 0x0623, 0x0624, 0x0625, 0x0627, 0x0629,
  0x062F, 0x0630, 0x0631, 0x0632, 0x0648, 0x0649,
]);

// ─── Helper Functions ──────────────────────────────────────────────────────

function isArabicLetter(code: number): boolean {
  return DUAL_JOIN.has(code) || RIGHT_JOIN.has(code) || code === 0x0621;
}

function isDiacritic(code: number): boolean {
  return (code >= 0x064B && code <= 0x065F) || code === 0x0670 || code === 0x0610 ||
         code === 0x0611 || code === 0x0612 || code === 0x0613 || code === 0x0614 ||
         code === 0x0615;
}

function canJoinLeft(code: number): boolean {
  return DUAL_JOIN.has(code);
}

function canJoinRight(code: number): boolean {
  return DUAL_JOIN.has(code) || RIGHT_JOIN.has(code);
}

/**
 * Find the previous non-diacritic Arabic character index.
 * Returns -1 if none found.
 */
function findPrevJoining(codes: number[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    if (isDiacritic(codes[i])) continue;
    return i;
  }
  return -1;
}

/**
 * Find the next non-diacritic character index.
 * Returns -1 if none found.
 */
function findNextJoining(codes: number[], index: number): number {
  for (let i = index + 1; i < codes.length; i++) {
    if (isDiacritic(codes[i])) continue;
    return i;
  }
  return -1;
}

// ─── Main Reshaping Function ───────────────────────────────────────────────

/**
 * Reshape Arabic text for rendering in jsPDF.
 * 
 * 1. Applies contextual character forms (isolated/initial/medial/final)
 * 2. Handles LAM-ALEF ligatures
 * 3. Reverses the string for correct RTL display in LTR rendering
 * 
 * @param text - Input Arabic text in logical order
 * @returns Shaped and reversed text ready for jsPDF rendering
 */
export function reshapeArabic(text: string): string {
  if (!text) return '';
  
  const codes: number[] = [];
  for (const char of text) {
    codes.push(char.codePointAt(0) || 0);
  }
  
  const result: number[] = [];
  let i = 0;
  
  while (i < codes.length) {
    const code = codes[i];
    
    // Non-Arabic character: pass through
    if (!isArabicLetter(code) && !isDiacritic(code)) {
      result.push(code);
      i++;
      continue;
    }
    
    // Diacritic: pass through (transparent for joining)
    if (isDiacritic(code)) {
      result.push(code);
      i++;
      continue;
    }
    
    // ── Check for LAM-ALEF ligature ──
    if (code === 0x0644) { // LAM
      const nextIdx = findNextJoining(codes, i);
      if (nextIdx >= 0 && LAM_ALEF[codes[nextIdx]]) {
        const alefCode = codes[nextIdx];
        const ligature = LAM_ALEF[alefCode];
        
        // Determine if LAM receives a right connection
        const prevIdx = findPrevJoining(codes, i);
        const rightConnected = prevIdx >= 0 && canJoinLeft(codes[prevIdx]);
        
        // Use final form if right-connected, otherwise isolated
        result.push(rightConnected ? ligature[1] : ligature[0]);
        
        // Collect any diacritics between LAM and ALEF
        for (let j = i + 1; j < nextIdx; j++) {
          if (isDiacritic(codes[j])) result.push(codes[j]);
        }
        
        i = nextIdx + 1;
        continue;
      }
    }
    
    // ── Regular Arabic character shaping ──
    const forms = FORMS[code];
    if (!forms) {
      result.push(code);
      i++;
      continue;
    }
    
    // Determine joining context
    const prevIdx = findPrevJoining(codes, i);
    const nextIdx = findNextJoining(codes, i);
    
    // Right connection: previous character must be DUAL-joining (can connect from its left)
    const rightConnected = prevIdx >= 0 && isArabicLetter(codes[prevIdx]) && canJoinLeft(codes[prevIdx]);
    
    // Left connection: this character must be DUAL-joining AND next char must be Arabic (R or D)
    const leftConnected = canJoinLeft(code) && nextIdx >= 0 && isArabicLetter(codes[nextIdx]);
    
    // Select form: 0=isolated, 1=final, 2=initial, 3=medial
    let formIndex: number;
    if (!rightConnected && !leftConnected) {
      formIndex = 0; // Isolated
    } else if (rightConnected && !leftConnected) {
      formIndex = 1; // Final
    } else if (!rightConnected && leftConnected) {
      formIndex = 2; // Initial
    } else {
      formIndex = 3; // Medial
    }
    
    result.push(forms[formIndex]);
    i++;
  }
  
  // ── Reverse Arabic blocks for RTL display in LTR renderer ──
  const shapedText = result.map(c => String.fromCodePoint(c)).join('');
  
  // Match blocks of Arabic text (including spaces and punctuation between Arabic words, and trailing punctuation)
  const arabicRegex = /[\u0600-\u06FF\uFE70-\uFEFF]+(?:[\s\p{P}]+[\u0600-\u06FF\uFE70-\uFEFF]+)*[\s\p{P}]*/gu;
  
  return shapedText.replace(arabicRegex, (match) => {
    return match.split('').reverse().join('');
  });
}

/**
 * Check if a string contains Arabic characters.
 */
export function containsArabic(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) || 0;
    if (code >= 0x0600 && code <= 0x06FF) return true;
    if (code >= 0xFE70 && code <= 0xFEFF) return true;
  }
  return false;
}
