import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import {
  ALCHEMY_COOLDOWN_MINUTES,
  ALCHEMY_DEFAULT_INPUT_LIMIT,
  ALCHEMY_DISABLED_MESSAGE,
  ALCHEMY_RESTRICTED_INPUT_LIMIT,
  ALCHEMY_TOTAL_LIQUIDITY_SEED,
  alchemyConfig,
  alchemySelectedUsersLabel,
} from "../helpers/alchemyHelper";

export interface AlchemyConfig {
  disabled?: boolean;
  disabledMessage?: string;
  multiplier: number;
  userDailyLimit: number;
  totalDailyLimit: number;
  cooldownMinutes: number;
  minTokenRequired: number;
  dailyFeePercent: number;
  status: string;
  liquidityBalance: number;
  totalLiquidity?: number;
  initialTotalLiquidity?: number;
  selectedUsersOnlyLabel?: string;
  inputLimit?: number;
  defaultInputLimit?: number;
  restrictedInputLimit?: number;
  restrictedLimitEmails?: string[];
  alchemyTiers?: Record<string, any>;
  multiplierRanges?: Record<string, { inputs: number[]; ranges: number[][] }>;
  v2InputAmount?: number;
  v2AllowedEmails?: string[];
  v2SpecialMinimumEmails?: string[];
  v2MinimumMinedDefault?: number;
  v2MinimumMinedSpecial?: number;
  v2EmailMultipliers?: Record<string, number>;
  v2FallbackMultipliers?: number[];
  transactionSummaryExcludedEmails?: string[];
  updatedAt: Date;
}

export interface IAlchemyConfigModel
  extends IDocumentModel<AlchemyConfig>,
    AlchemyConfig {}

export var AlchemyConfigSchema: Schema = new Schema();

const defaultMultiplierRanges = {
  free: {
    inputs: [2500, 5000, 10000, 20000],
    ranges: [
      [0.5, 1.2],
      [0.4, 1.3],
      [0.3, 1.5],
      [0.3, 2.5],
    ],
  },
  electric: {
    inputs: [2500, 5000, 10000, 20000, 50000],
    ranges: [
      [0.5, 1.3],
      [0.4, 1.7],
      [0.3, 2.2],
      [0.2, 2.8],
      [0.2, 3.0],
    ],
  },
  turbo: {
    inputs: [2500, 5000, 10000, 20000, 50000],
    ranges: [
      [0.5, 1.4],
      [0.4, 2.0],
      [0.3, 2.5],
      [0.2, 3.0],
      [0.2, 3.0],
    ],
  },
  nuclear: {
    inputs: [2500, 5000, 10000, 20000, 50000, 100000],
    ranges: [
      [0.5, 1.4],
      [0.4, 2.0],
      [0.3, 2.5],
      [0.2, 3.0],
      [0.2, 3.0],
      [0.1, 3.2],
    ],
  },
  quantum: {
    inputs: [2500, 5000, 10000, 20000, 50000, 100000, 200000],
    ranges: [
      [0.5, 1.4],
      [0.4, 2.0],
      [0.3, 2.5],
      [0.2, 3.0],
      [0.2, 3.0],
      [0.1, 3.5],
      [0.1, 3.8],
    ],
  },
};

AlchemyConfigSchema.add({
  disabled: { type: Boolean, default: false },
  disabledMessage: { type: String, default: ALCHEMY_DISABLED_MESSAGE },
  multiplier: { type: Number, default: 1 },
  userDailyLimit: { type: Number, default: 1000 },
  totalDailyLimit: { type: Number, default: 10000 },
  cooldownMinutes: { type: Number, default: ALCHEMY_COOLDOWN_MINUTES },
  minTokenRequired: { type: Number, default: 100 },
  dailyFeePercent: { type: Number, default: 3 },
  status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
  liquidityBalance: { type: Number, default: ALCHEMY_TOTAL_LIQUIDITY_SEED },
  totalLiquidity: { type: Number, default: ALCHEMY_TOTAL_LIQUIDITY_SEED },
  initialTotalLiquidity: {
    type: Number,
    default: ALCHEMY_TOTAL_LIQUIDITY_SEED,
  },
  selectedUsersOnlyLabel: { type: String, default: alchemySelectedUsersLabel },
  inputLimit: { type: Number, default: ALCHEMY_DEFAULT_INPUT_LIMIT },
  defaultInputLimit: { type: Number, default: ALCHEMY_DEFAULT_INPUT_LIMIT },
  restrictedInputLimit: {
    type: Number,
    default: ALCHEMY_RESTRICTED_INPUT_LIMIT,
  },
  restrictedLimitEmails: { type: [String], default: [] },
  alchemyTiers: { type: Schema.Types.Mixed, default: alchemyConfig },
  multiplierRanges: {
    type: Schema.Types.Mixed,
    default: defaultMultiplierRanges,
  },
  v2InputAmount: { type: Number, default: 1000 },
  v2AllowedEmails: { type: [String], default: [] },
  v2SpecialMinimumEmails: { type: [String], default: [] },
  v2MinimumMinedDefault: { type: Number, default: 50000 },
  v2MinimumMinedSpecial: { type: Number, default: 10000 },
  v2EmailMultipliers: { type: Schema.Types.Mixed, default: {} },
  v2FallbackMultipliers: {
    type: [Number],
    default: [1.12, 0.86, 0.92, 1.08, 0.75, 0.8, 0.83, 1.07, 0.72],
  },
  transactionSummaryExcludedEmails: {
    type: [String],
    default: [],
  },
  updatedAt: { type: Date, default: Date.now },
});

export default AlchemyConfigSchema;
