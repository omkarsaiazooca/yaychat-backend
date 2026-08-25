import { ImpersonationFlag } from "../../data/yaysCommunities";

/**
 * Module 3 — impersonation detection for community names.
 *
 * The risk this module addresses is specific: a community called
 * "Bitcoin Yay 0fficial" that members mistake for the real verified product
 * account, and whose announcements they therefore trust.
 *
 * The detector is advisory by design — it raises a moderation case, it never
 * blocks a create or rename. Blocking on a fuzzy name match would stop
 * legitimate communities ("BTCY Study Group") while barely inconveniencing an
 * actual bad actor, who would simply try another spelling.
 *
 * Pure and synchronous: the caller supplies the verified names to compare
 * against.
 */

/**
 * Characters people substitute to look like a letter, folded before compare.
 *
 * `1`, `l`, and `i` all collapse onto `i`, because a digit 1 is equally a
 * stand-in for either letter and the fold has to be deterministic. The cost is
 * that "balance" and "baiance" compare equal — harmless, since both sides of
 * every comparison go through the same fold.
 */
const CONFUSABLES: Record<string, string> = {
  "0": "o",
  "1": "i",
  l: "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "|": "i",
  "!": "i",
  "¡": "i",
  "×": "x",
  "０": "o",
  "１": "i",
  ı: "i",
  ѕ: "s",
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
};

/** Words that claim officialness; their presence tightens the threshold. */
const OFFICIAL_TERMS = [
  "official",
  "verified",
  "support",
  "admin",
  "team",
  "hq",
  "helpdesk",
  "customer care",
];

/** Name reduced to comparable form: lower-cased, de-confused, alphanumeric. */
export const foldName = (name: string): string => {
  const lowered = String(name || "").normalize("NFKD").toLowerCase();
  let folded = "";
  for (const char of lowered) {
    folded += CONFUSABLES[char] ?? char;
  }
  return folded.replace(/[^a-z0-9]/g, "");
};

/** Whether a name claims to be an official channel. */
export const claimsOfficial = (name: string): boolean => {
  const lowered = String(name || "").toLowerCase();
  return OFFICIAL_TERMS.some((term) => lowered.includes(term));
};

/** Levenshtein distance, iterative and allocation-light. */
export const editDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }
  let previous = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    previous[j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array(b.length + 1);
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
};

/** 1 = identical after folding, 0 = nothing in common. */
export const similarity = (a: string, b: string): number => {
  const longest = Math.max(a.length, b.length);
  if (!longest) {
    return 0;
  }
  return 1 - editDistance(a, b) / longest;
};

/** Names at or above this similarity are flagged. */
export const SIMILARITY_THRESHOLD = 0.82;

export interface VerifiedName {
  communityId: string;
  name: string;
  /** Product this official account speaks for, e.g. "Bitcoin Yay". */
  officialProduct?: string | null;
}

/**
 * Compare a proposed name against the verified communities and return every
 * collision, worst first.
 *
 * `candidateId` lets a verified community rename itself without flagging
 * against its own previous name.
 */
export const detectImpersonation = (
  candidateName: string,
  verified: VerifiedName[],
  candidateId?: string
): ImpersonationFlag[] => {
  const candidateFolded = foldName(candidateName);
  if (!candidateFolded) {
    return [];
  }
  const candidateClaimsOfficial = claimsOfficial(candidateName);
  const flags: ImpersonationFlag[] = [];

  for (const entry of verified) {
    if (candidateId && entry.communityId === candidateId) {
      continue;
    }
    const entryFolded = foldName(entry.name);
    if (!entryFolded) {
      continue;
    }
    const score = similarity(candidateFolded, entryFolded);
    const productFolded = foldName(entry.officialProduct || "");

    let reason: ImpersonationFlag["reason"] | null = null;
    if (candidateName.trim().toLowerCase() === entry.name.trim().toLowerCase()) {
      reason = "exact";
    } else if (candidateFolded === entryFolded) {
      // Same letters once 0→o and friends are folded: the classic lookalike.
      reason = "confusable";
    } else if (score >= SIMILARITY_THRESHOLD) {
      reason = "normalized";
    } else if (
      candidateClaimsOfficial &&
      ((productFolded && candidateFolded.includes(productFolded)) ||
        candidateFolded.includes(entryFolded))
    ) {
      // "Bitcoin Yay Official Support" — contains the product name or the
      // verified community's own name, *and* claims to be a channel of it. No
      // similarity floor here: the give-away is the pair of signals, and a long
      // enough suffix drives the edit distance down however blatant the name is.
      reason = "official_term";
    }

    if (reason) {
      flags.push({
        matchedCommunityId: entry.communityId,
        matchedName: entry.name,
        score: Number(score.toFixed(3)),
        reason,
      });
    }
  }

  return flags.sort((a, b) => b.score - a.score);
};

/** One-line summary for the moderation case a flag opens. */
export const impersonationSummary = (
  candidateName: string,
  flag: ImpersonationFlag
): string =>
  `"${candidateName}" resembles the verified community "${flag.matchedName}" ` +
  `(${flag.reason}, similarity ${Math.round(flag.score * 100)}%).`;
