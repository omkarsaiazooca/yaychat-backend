export interface AlchemyConfigItem {
    input: number;
    multiplierRange: string;
    probabilities: Record<string, number>;
}
export interface AlchemyConfig {
    [userType: string]: AlchemyConfigItem[];
}

export const alchemySelectedUsersLabel = "Selected Users Only";

const ALCHEMY_RESTRICTED_LIMIT_EMAILS = new Set<string>();

export const ALCHEMY_DISABLED = (process.env.ALCHEMY_DISABLED ?? "0") === "1";
export const ALCHEMY_DISABLED_MESSAGE = "Alchemy is currently disabled for all users";
export const ALCHEMY_COOLDOWN_MINUTES = 7 * 24 * 60;

export const ALCHEMY_DEFAULT_INPUT_LIMIT = 50000;
export const ALCHEMY_RESTRICTED_INPUT_LIMIT = 10000;
export const ALCHEMY_TOTAL_LIQUIDITY_SEED = 15000;

export function getAlchemyInputLimit(email?: string): number {
    const normalized = String(email ?? "").toLowerCase();
    return ALCHEMY_RESTRICTED_LIMIT_EMAILS.has(normalized) ? ALCHEMY_RESTRICTED_INPUT_LIMIT : ALCHEMY_DEFAULT_INPUT_LIMIT;
}

export function formatAlchemyInputLimitLabel(limit: number): string {
    if (!Number.isFinite(limit)) {
        return "";
    }
    if (limit >= 1000 && limit % 1000 === 0) {
        return `${limit / 1000}k`;
    }
    return `${limit}`;
}

export const alchemyConfig: AlchemyConfig = {
    free: [
        { input: 5000, multiplierRange: "0.5–1.2x", probabilities: { "0.5x": 40, "0.6x": 35, "1x": 20, "1.3x": 5 } },
        { input: 10000, multiplierRange: "0.4x–1.3x", probabilities: { "0.3x": 45, "0.5x": 30, "1x": 20, "1.5x": 5 } },
        { input: 50000, multiplierRange: "0.3x-1.5x", probabilities: { "0.3x": 50, "0.6x": 25, "1.1x": 15, "2.5x": 10 } }
    ],
    electric: [
        { input: 2500, multiplierRange: "0.5x–1.3x", probabilities: { "0.5x": 38, "0.8x": 32, "1.1x": 20, "1.5x": 10 } },
        { input: 5000, multiplierRange: "0.4x–1.7x", probabilities: { "0.4x": 40, "0.7x": 30, "1.2x": 20, "1.7x": 10 } },
        { input: 20000, multiplierRange: "0.2x–2.8x", probabilities: { "0.2x": 45, "0.5x": 25, "1.3x": 20, "2.8x": 10 } },
        { input: 50000, multiplierRange: "0.2x–3x", probabilities: { "0.2x": 48, "0.5x": 22, "1.3x": 20, "3x": 10 } }
    ],
    turbo: [
        { input: 5000, multiplierRange: "0.4x–2x", probabilities: { "0.4x": 40, "0.7x": 28, "1.3x": 20, "2x": 12 } },
        { input: 10000, multiplierRange: "0.3x–2.5x", probabilities: { "0.3x": 42, "0.6x": 26, "1.4x": 20, "2.5x": 12 } },
        { input: 20000, multiplierRange: "0.2x–3x", probabilities: { "0.2x": 45, "0.5x": 25, "1.5x": 20, "3x": 10 } },
        { input: 50000, multiplierRange: "0.2x–3x", probabilities: { "0.2x": 45, "0.5x": 25, "1.5x": 20, "3x": 10 } }
    ],
    nuclear: [
        { input: 10000, multiplierRange: "0.5x–1.4x", probabilities: { "0.5x": 38, "0.8x": 30, "1.2x": 20, "1.7x": 10 } },
        { input: 20000, multiplierRange: "0.4x–2x", probabilities: { "0.4x": 40, "0.7x": 28, "1.3x": 20, "2x": 12 } },
        { input: 50000, multiplierRange: "0.3x–2.5x", probabilities: { "0.3x": 42, "0.6x": 26, "1.4x": 20, "2.5x": 12 } },
        { input: 100000, multiplierRange: "0.1x–3.2x", probabilities: { "0.1x": 55, "0.5x": 20, "1.5x": 15, "3.2x": 10 } }
    ],
    quantum: [
        { input: 10000, multiplierRange: "0.5x–1.4x", probabilities: { "0.5x": 38, "0.8x": 30, "1.2x": 20, "1.7x": 10 } },
        { input: 20000, multiplierRange: "0.4x–2x", probabilities: { "0.4x": 40, "0.7x": 28, "1.3x": 20, "2x": 12 } },
        { input: 50000, multiplierRange: "0.3x–2.5x", probabilities: { "0.3x": 42, "0.6x": 26, "1.4x": 20, "2.5x": 12 } },
        { input: 100000, multiplierRange: "0.2x–3x", probabilities: { "0.2x": 45, "0.5x": 25, "1.5x": 20, "3x": 10 } },
        { input: 150000, multiplierRange: "0.2x–3x", probabilities: { "0.2x": 45, "0.5x": 25, "1.5x": 20, "3x": 10 } },
        { input: 200000, multiplierRange: "0.1x–3.8x", probabilities: { "0.1x": 65, "0.5x": 20, "1.5x": 8, "3.8x": 7 } }
    ]
};
