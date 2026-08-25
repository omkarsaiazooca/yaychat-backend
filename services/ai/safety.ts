/**
 * Input/output safety for the assistant.
 *
 * Two layers: a hard block for categories YaysApp will not answer at all, and a
 * soft classifier that appends the correct high-risk disclaimer to an answer.
 */

export type RiskCategory = "financial" | "legal" | "medical";

export interface SafetyVerdict {
  blocked: boolean;
  /** Shown to the user in place of an answer when `blocked`. */
  reason?: string;
  categories: RiskCategory[];
}

const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(build|make|synthesi[sz]e|manufacture)\b[^.]{0,40}\b(bomb|explosive|nerve agent|bioweapon)\b/i,
    reason: "This request involves weapons or explosives, which aiainai cannot help with.",
  },
  {
    pattern: /\b(csam|child (porn|sexual))\b/i,
    reason: "This request involves child sexual abuse material and cannot be answered.",
  },
  {
    pattern: /\b(how to)\b[^.]{0,40}\b(kill myself|end my life|commit suicide)\b/i,
    reason:
      "aiainai cannot help with this. If you are in crisis, please contact your local emergency number or a suicide prevention line.",
  },
  {
    pattern: /\b(steal|crack|bypass)\b[^.]{0,30}\b(private key|seed phrase|wallet)\b/i,
    reason: "This request involves compromising someone's wallet, which aiainai cannot help with.",
  },
];

const RISK_PATTERNS: { category: RiskCategory; pattern: RegExp }[] = [
  {
    category: "financial",
    pattern:
      /\b(invest|investment|portfolio|buy|sell|trade|trading|token|crypto|stock|shares?|returns?|yield|apy|price target|btcy|nugget)\b/i,
  },
  {
    category: "legal",
    pattern: /\b(legal|lawsuit|sue|contract|attorney|lawyer|court|liability|tax(es|ation)?)\b/i,
  },
  {
    category: "medical",
    pattern:
      /\b(medical|doctor|diagnos(e|is)|symptom|prescription|medication|dosage|treatment|therapy)\b/i,
  },
];

export const DISCLAIMERS: Record<RiskCategory, string> = {
  financial:
    "General information only — not financial or investment advice. YaysApp never guarantees returns. Do your own research before acting.",
  legal:
    "General information only — not legal advice. Consult a qualified professional for your jurisdiction.",
  medical:
    "General information only — not medical advice. Consult a qualified healthcare professional.",
};

/** Screen a prompt before it reaches a provider. */
export const screenPrompt = (prompt: string): SafetyVerdict => {
  const text = String(prompt || "");
  const blocked = BLOCKED_PATTERNS.find((rule) => rule.pattern.test(text));
  if (blocked) {
    return { blocked: true, reason: blocked.reason, categories: [] };
  }
  const categories = RISK_PATTERNS.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.category
  );
  return { blocked: false, categories };
};

/**
 * Append the disclaimers a prompt's risk categories require, skipping any the
 * model already produced on its own.
 */
export const applyDisclaimers = (
  answer: string,
  categories: RiskCategory[]
): string => {
  if (!categories.length) {
    return answer;
  }
  const missing = categories
    .map((category) => DISCLAIMERS[category])
    .filter((line) => !answer.includes(line));
  if (!missing.length) {
    return answer;
  }
  return `${answer}\n\n${missing.join("\n\n")}`;
};
