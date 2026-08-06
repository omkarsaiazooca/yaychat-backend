import { Schema } from "mongoose";
import { User } from "../data/user";
import { IDocumentModel } from "../data/base";
import { Languages } from "../data/common";
import { addressSchema, basicSchema, cryptoAccount } from "./common";

export interface UserModel extends IDocumentModel<User>, User { }

var authproviderSchema: Schema = new Schema({
  provider: String,
  userid: String,
  phash: String,
  psalt: String,
});

var verficationSchema: Schema = new Schema({
  activated: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  photoVerified: { type: Boolean, default: false },
  addressVerified: { type: Boolean, default: false },
  currencyUpdated: { type: Boolean, default: false },
  activatedOn: { type: Date },
  emailVerifiedOn: { type: Date },
  phoneVerifiedOn: { type: Date },
  photoVerifiedOn: { type: Date },
  addressVerifiedOn: { type: Date },
  currencyUpdatedOn: { type: Date, default: new Date() },
  emailCodeExpiry: { type: Date },
  emailCode: { type: String },
  emailDeliverability: {
    status: { type: String },
    subStatus: { type: String },
    provider: { type: String },
    checkedAt: { type: Date },
    didYouMean: { type: String },
    account: { type: String },
    domain: { type: String },
  },
});

// Define the ClaimSchema
export var ClaimSchema: Schema = new Schema({
  coinName: { type: String },
  coinNetwork: { type: String },
  coinSymbol: { type: String },
  totalFreeCoins: { type: Number },
  claimedDate: { type: Date, default: Date.now },
  claimStatus: { type: String, default: "Pending" }, // e.g., "Pending", "Completed"
  userId: { type: String },
  transactionId: { type: String }, // Optional
});

export var UserWallet: Schema = new Schema({
  userId: String,
  coinType: String,
  coinWalletAddress: String,
  coinPrivateKey: String,
  coinNetwork: String,
  coinName: String,
  coinSymbol: String,
  coinDecimals: Number,
  coinStakedBalance: Number,
  coinBalance: Number,
  coinBalanceInUSD: Number,
  coinBalanceInBTC: Number,
  coinCreatedOn: Date,
  coinLastUsedOn: Date,
  coinPrice: { type: Number, default: 0 },
  coinPrevPrice: { type: Number, default: 0 },
  isCoinActive: { type: Boolean, default: true },
  isImported: { type: Number, default: false },
  notes: { type: String, default: "" },
  specialNotes: { type: String, default: "" },
  amountInvested: { type: Number, default: 0 },
});

export var UserRewards: Schema = new Schema({
  userId: String,
  email: String,
  firstName: String,
  lastName: String,
  referralCode: String,
  lastUpdatedOn: Date,
  totalRewards: Number,
  rewardCurrency: String,
  rewardCurrencySymbol: String,
  rewardCurrencyDecimals: Number,
});

export var Permissions: Schema = new Schema({
  buy: Boolean,
  buyApprovedOn: Date, // Date when Honey Bee approved Captain Bee
  sell: Boolean,
  sellApprovedOn: Date, // Date when Honey Bee approved Captain Bee
  convert: Boolean,
  convertApprovedOn: Date, // Date when Honey Bee approved Captain Bee
});

export var BeeRelationship: Schema = new Schema({
  honeybeeEmail: String, // ID of the Honey Bee
  captainBeeEmail: String, // ID of the Captain Bee
  permissions: { type: Permissions }, // Permissions granted by Honey Bee to Captain Bee
});

export var CaptainBeeRelationship: Schema = new Schema({
  mainCaptainBeeEmail: String, // Email of the Main Captain Bee
  captainBeeEmail: String, // Email of the Captain Bee
  permissions: { type: Permissions }, // Permissions granted by Honey Bee to Captain Bee
});

export var userPrivacySettings: Schema = new Schema({
  hideRealName: { type: Boolean, default: false },
  hideBalance: { type: Boolean, default: false },
  pushNotifications: { type: Boolean, default: true },
})

export var userSchema: Schema = new Schema();
userSchema.add({
  email: String,
  phone: String,
  username: String,
  firstName: String,
  lastName: String,
  isPhonePublic: { type: Boolean, default: false },
  isEmailPublic: { type: Boolean, default: false },
  walletAddress: { type: String, default: "" },
  userType: { type: String, deafult: "Centralized" },
  language: { type: String, default: Languages.US },
  role: String,
  country: String,
  basic: { type: basicSchema },
  userRiskLevel: String,
  address: { type: addressSchema },
  authProviders: [{ type: authproviderSchema }],
  verification: { type: verficationSchema },
  accounts: [{ type: cryptoAccount }],
  baseCurrency: String,
  referralCodeUsed: String,
  userRewards: { type: UserRewards },
  userWallets: [{ type: UserWallet }],
  freeTrailUserWallets: [{ type: UserWallet, default: [] }],
  lastLogin: Date,
  vipLevel: { type: String, default: "VIP-1" },
  kycStatus: { type: String, default: "Pending" },
  isKYCPass: { type: Boolean, default: "false" },
  isParticipatedInGroupReward: { type: Boolean, default: "false" },
  KYCUpdatedDate: Date,
  referralCode: String,
  favouriteCurrencies: [{ type: String, default: [""] }],
  userMnemonic: String,
  password: String,
  profilePic: String,
  bio: { type: String, default: "" },
  relationships: [{ type: BeeRelationship }],
  captainBeeRelationShips: [{ type: CaptainBeeRelationship }],
  coinClaims: [{ type: ClaimSchema }],
  personalIdNumber: { type: String, default: "" },
  isTestFundActive: { type: Boolean, default: false },
  isWithdrawRestricted: { type: Boolean, default: false },
  isFreeTrailEnded: { type: Boolean, default: false },
  freeTrailEndDate: Date,
  freeTrailStartDate: Date,
  BTCYAcknowledgementStatus: { type: Boolean, default: false },
  BTCYAcknowledgementDate: Date,
  BTCYMigrationStatus: { type: String, default: "Not Started" }, //'In Queue' | 'Completed' | 'Not Started' }
  BTCYMigrationDate: Date,
  tutorialWatched: { type: Boolean, default: false },
  UserPrivacyBTCYAppSettings: { type: userPrivacySettings },
  fcmToken: { type: String, },
  deviceType: { type: String, enum: ['ios', 'android'], },
  deviceModel: { type: String },
  osVersion: { type: String },
  uniqueId: { type: String },
  brand: { type: String },
  lastActive: { type: Date, default: Date.now },
  mutedChatIds: { type: [String], default: [] }, // Array of chat/group IDs that are muted
  nuggetBalance: { type: Number, default: 0 },
});

// Users
userSchema.index({ email: 1 }, { unique: true });
// If you often lookup wallet by coin:
userSchema.index({ 'userWallets.coinSymbol': 1, 'userWallets.coinNetwork': 1 });

export default userSchema;
