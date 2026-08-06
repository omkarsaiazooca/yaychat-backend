export enum AuthProviders {
  Local = "Local",
  Facebook = "Facebook",
  Google = "Google",
  Apple = "Apple"
}

export enum Languages {
  US = "en-us", // version1 language
  CN = "zh-cn", // version1 language
  SP = "es", // Spanish
  FR = "fr", // French
}

// Map user input to Languages enum
export const languageMap: { [key: string]: Languages } = {
  English: Languages.US,
  Chinese: Languages.CN,
  Spanish: Languages.SP,
  French: Languages.FR,
};

export enum Currency {
  USDC= "USDC",
  USDT = "USDT",
  BTC = "BTC",
  LTC = "LTC",
  USD = "USD",
  ETH = "ETH",
  IN500 = "IN500",
  INXC = "INXC",
  IUSDP = "IUSD+",
  BNB = "BNB",
  BUSD = "BUSD",
  INEX = "INEX",
  INXP = "INXP",
  SRT = "SRT",
}

export enum ContactTypes {
  Default,
  Business,
  Permanent,
  Residant,
}

export enum FileTypes {
  ImagePng = "image/png",
  ImageJpg = "image/jpg",
  VideoUrl = "video/url",
}

export interface Contact {
  contactType: ContactTypes;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface Address {
  // contactType: ContactTypes;
  language: Languages;
  country: string;
  state: string;
  city: string;
  place: string;
  addressLine1: string;
  addressLine2: string;
  pincode: string;
}

export enum PaymentTypes {
  // BTC = 'BTC',
  // LTC = 'LTC',
  DirectCrypto = "DirectCrypto",
  CC = "CreditCard",
  BankDirect = "BankDirect",
  Paypal = "Paypal",
  ACH = "ACH",
  Zelle = "Zelle",
  Venmo = "Venmo",
  Wire = "Wire-Transfer",
  TygaPay = "TygaPay",
  USD = "USD",
  ApplePay = "ApplePay",
  Gpay = "Gpay",
  Stripe = "Stripe",
}

export interface IAccountDetails {
  accountType: PaymentTypes;
  accountId: string;
  currency: string;
  accountBankName: string;
  accountNumber: string;
  accountHolderName: string;
  accountHolderAddress: string;
  accountIBAN: string;
}

export interface AccountLite extends IAccountDetails {
  referenceName: string;
  accountHoldername: string;
  accountType: PaymentTypes;
  kycId: string; // kyc refernece
  accountId: string;
}

export interface TransactionAccount extends AccountLite, IAccountDetails {
  referenceName: string; //
  accountHoldername: string;
  accountBankName: string;
  accountNumber: string;
  accountIBAN: string;
  accountBankAddress: string;
  email: string;
  accountType: PaymentTypes;
  kycId: string; // kyc refernece
  accountId: string;
  exchangeReceiveAddress: string;
  userReceiveAddress: string;
  amount: number;
  currency: string;
}

export interface CryptoAccount extends IAccountDetails {
  accountType: PaymentTypes;
  accountId: string;
}

export interface CreditCardAccount extends IAccountDetails {
  accountType: PaymentTypes;
  accountId: string;
  cardType: string;
}

export enum CurrencyType {
  Fiat = "Fiat",
  Crypto = "Crypto",
}

export interface BankAccount extends IAccountDetails {
  accountType: PaymentTypes;
  accountNumber: string;
  swift: string;
  iban: string;
  bic: string;
  ukSortCode: string;
  bsbCode: string;
  regNumber: string;
  currency: string;
  bankName: string;
  bankAddress: string;
}

export interface ResponseData<T> {
  status: number;
  data: T;
}

export interface PagedMetaData {
  next: string;
  prev: string;
  totalItems: number;
}

export interface ErrorData {
  message: string;
  error: string;
}
export interface ErrorResponse {
  status: number;
  data: ErrorData;
  // meta: PagedMetaData;
}

export interface TransactionList {
  amount: number;
  currency: string;
  orderId: string;
  blockchainHash?: string;
  userId: string;
  name: string;
  baseCurrency: string;
  orderStatus: string;
}

export interface SMTPData {
  host: string;
  port: number;
  secure: boolean;
  auth: Credentials;
  tls: TLSData;
  defaultFrom: string;
  defaultTo: string;
}

export interface Credentials {
  user: string;
  pass: string;
}

export interface TLSData {
  rejectUnauthorized: boolean;
}

export enum TransactionType {
  BUY = "BUY",
  SELL = "SELL",
  DEPOSIT_FIAT = "DEPOSIT_FIAT",
  WITHDRAW_FIAT = "WITHDRAW_FIAT",
  DEPOSIT_CRYPTO = "DEPOSIT_CRYPTO",
  WITHDRAW_CYRPTO = "WITHDRAW_CRYPTO",
  CONVERT = "CONVERT",
}

export enum WalletType {
  FundingWallet = "Asset Wallet",
  SpotWallet = "SpotWallet",
}

export enum CurrencyAcceptance {
  None = 0,
  BUY = 1,
  SELL = 2,
  CONVERT = 3,
  DEPOSIT_FIAT = 4,
  WITHDRAW_FIAT = 5,
  DEPOSIT_CRYPTO = 6,
  WITHDRAW_CRYPTO = 7,
  ALL = 8,
}

export interface apiPosts {
  id: string;
  tags: string[];
  claps: number;
  last_modified_at: Date;
  published_at: Date;
  url: string;
  image_url: string;
  lang: string;
  publication_id: string;
  word_count: number;
  title: string;
  reading_time: number;
  responses_count: number;
  voters: number;
  topics: string[];
  author: string;
  subtitle: string;
}
