import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "config/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

export var keys = {
  jwt: {
    secret: String(process.env.SECRET),
    tokenLife: 900,
    refreshTokenLife: 86400,
    isEncrypted: false,
  },
  localMongoDB: {
    database: String(process.env.MONGODB_URL),
  },
  MongoDB: {
    testDatabase: String(process.env.MAIN_MONGODB),
  },
  shopMongoDB: {
    testDatabase: String(process.env.SHOP_MONGOBD),
  },
  Moralis: {
    key: String(process.env.MORALIS_API_KEY),
  },
  bitGo: {
    key: "",
    isEncrypted: true,
  },
  bitGoTest: {
    key: "",
    isEncrypted: true,
  },
  smtp: {
    key: "",
    isEncrypted: true,
  },
  sendInBlueKey: {
    key: process.env.SENDINBLUE_API_KEY,
  },
  sendInBlue: {
    key: process.env.SENDINBLUE,
    isEncrypted: true,
  },
  marketingEmail: {
    awsSesRegion: String(process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1"),
    awsAccessKeyId: String(process.env.AWS_ACCESS_KEY_ID || ""),
    awsSecretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY || ""),
    awsSesFromEmail: String(
      process.env.AWS_SES_FROM_EMAIL || process.env.MARKETING_EMAIL_FROM || ""
    ),
    awsSesFromName: String(process.env.AWS_SES_FROM_NAME || "Indexx"),
    unsubscribeBaseUrl: String(
      process.env.MARKETING_EMAIL_UNSUBSCRIBE_BASE_URL ||
        process.env.API_BASE_URL ||
        "https://api.v1.indexx.ai"
    ),
    awsSesConfigurationSet: String(process.env.AWS_SES_CONFIGURATION_SET || ""),
    // Email-validation (CSV import send-safety) settings.
    // verifyMailFrom MUST be an address on a domain we control (used as SMTP MAIL FROM).
    verifyMailFrom: String(
      process.env.MARKETING_EMAIL_VERIFY_MAIL_FROM || "verify@indexx.ai"
    ),
    // Optional path to a larger, maintained disposable-domain list (newline-separated).
    verifyDisposableListPath: String(
      process.env.MARKETING_EMAIL_DISPOSABLE_LIST || ""
    ),
    // Whether to run the async SMTP verification worker (needs outbound port 25).
    verifySmtpEnabled: String(process.env.MARKETING_EMAIL_VERIFY_SMTP || "true") === "true",
    verifyBatchSize: Number(process.env.MARKETING_EMAIL_VERIFY_BATCH_SIZE || 200),
    verifyDomainConcurrency: Number(process.env.MARKETING_EMAIL_VERIFY_DOMAIN_CONCURRENCY || 2),
    verifyDomainDelayMs: Number(process.env.MARKETING_EMAIL_VERIFY_DOMAIN_DELAY_MS || 1000),
    verifyWorkerConcurrency: Number(process.env.MARKETING_EMAIL_VERIFY_WORKER_CONCURRENCY || 5),
    verifySmtpTimeoutMs: Number(process.env.MARKETING_EMAIL_VERIFY_SMTP_TIMEOUT_MS || 10000),
  },
  paypal_client_id_live: {
    key: String(process.env.PAYPAL_CLIENT_ID_MAIN),
  },
  paypal_secret_key_live: {
    key: String(process.env.PAYPAL_SECRET_KEY_MAIN),
  },
  paypal_client_id_test: {
    key: String(process.env.PAYPAL_CLIENT_ID_TEST),
  },
  paypal_secret_key_test: {
    key: String(process.env.PAYPAL_SECRET_KEY_TEST),
  },
  paypal_webhook_id: {
    key: String(process.env.PAYPAL_WEBHOOK_ID),
  },
  paypal_webhook_id_live: {
    key: String(process.env.PAYPAL_WEBHOOK_ID_MAIN),
  },
  stripe_live: {
    key: String(process.env.STRIPE_LIVE),
  },
  stripe_test: {
    key: String(process.env.STRIPE_TEST),
  },
  stripe_pk_test: {
    key: String(process.env.STRIPE_PUBLISHABLE_TEST_KEY),
  },
  stripe_bitcoinyay_test: {
    key: String(process.env.STRIPE_SECRET_KEY),
  },
  dex_stripe_test: {
    key: String(process.env.DEX_STRIPE_TEST),
  },
  dex_stripe_live: {
    key: String(process.env.DEX_STRIPE_LIVE),
  },
  stripe_webhook: {
    key: String(
      process.env.STRIPE_WEBHOOK || process.env.STRIPE_WEBHOOK_SECRET
    ),
  },
  stripe_webhook_main: {
    key: String(
      process.env.STRIPE_WEBHOOK_MAIN || process.env.STRIPE_WEBHOOK_SECRET_MAIN
    ),
  },
  bitcoinyay_stripe_webhook: {
    key: String(
      process.env.BITCOINYAY_STRIPE_WEBHOOK_SECRET ||
        process.env.BITCOINYAY_STRIPE_WEBHOOK ||
        process.env.STRIPE_WEBHOOK ||
        process.env.STRIPE_WEBHOOK_SECRET
    ),
  },
  bitcoinyay_stripe_webhook_main: {
    key: String(
      process.env.BITCOINYAY_STRIPE_WEBHOOK_SECRET_MAIN ||
        process.env.BITCOINYAY_STRIPE_WEBHOOK_MAIN ||
        process.env.STRIPE_WEBHOOK_MAIN ||
        process.env.STRIPE_WEBHOOK_SECRET_MAIN
    ),
  },
  stripe: {
    SECRETKEY: String(process.env.STRIPE_SECRETKEY),
  },
  env: {
    key: String(process.env.NODE_ENV),
  },
  dex_env: {
    key: String(process.env.DEX_NODE_ENV),
  },
  academyBaseUrl: {
    key: String(process.env.ACADEMY_BASEURL),
  },
  cryptography: {
    key: String(process.env.CRYPTOGRAPHY),
  },
  btcyFeePercent: {
    key: String(process.env.BTCY_FEE_PERCENT ?? "3"),
  },
  ALCHEMYKEY_TEST: {
    key: String(process.env.ALCHEMYKEY_TEST),
  },
  ALCHEMYKEY_MAIN: {
    key: String(process.env.ALCHEMYKEY_MAIN),
  },
  INFURA_KEYS: {
    key: String(process.env.INFURA_KEYS),
  },
  BSC_RPC_TEST: {
    key: String(process.env.BSC_RPC_TEST),
  },
  BSC_RPC_MAIN: {
    key: String(process.env.BSC_RPC_MAIN),
  },
  MATIC_RPC_TEST: {
    key: String(process.env.MATIC_RPC_TEST),
  },
  MATIC_RPC_MAIN: {
    key: String(process.env.MATIC_RPC_MAIN),
  },
  ETH_RPC_TEST: {
    key: String(process.env.ETH_RPC_TEST),
  },
  ETH_RPC_MAIN: {
    key: String(process.env.ETH_RPC_MAIN),
  },
  TestIndexx500Contract: {
    key: String(process.env.IN500_TEST),
  },
  MainIndexx500Contract: {
    key: String(process.env.IN500_MAIN),
  },
  TwelveDataApiKey: {
    key: String(process.env.TWELVE_DATA_API_KEY),
  },
  FinnhubApiKey: {
    key: String(process.env.FINNHUB_API_KEY),
  },
  RedisKey: {
    key: String(process.env.REDIS_PASSWORD),
  },
  TestWIBSContract: {
    key: String(process.env.WIBS_TEST),
  },
  MainWIBSContract: {
    key: String(process.env.WIBS_MAIN),
  },
  TestIndexxCryptoContract: {
    key: String(process.env.INXC_TEST),
  },
  MainIndexxCryptoContract: {
    key: String(process.env.INXC_MAIN),
  },
  TestIndexxAppleContract: {
    key: String(process.env.IAPPL_TEST),
  },
  MainIndexxAppleContract: {
    key: String(process.env.IAPPL_MAIN),
  },
  TestIndexxTelsaContract: {
    key: String(process.env.ITELS_TEST),
  },
  MainIndexxTelsaContract: {
    key: String(process.env.ITELS_MAIN),
  },
  TestIndexxMetaContract: {
    key: String(process.env.IMETA_TEST),
  },
  MainIndexxMetaContract: {
    key: String(process.env.IMETA_MAIN),
  },
  TestIndexxMicrsoftContract: {
    key: String(process.env.IMSFT_TEST),
  },
  MainIndexxMicrosoftContract: {
    key: String(process.env.IMSFT_MAIN),
  },
  TestIndexxBroadcomContract: {
    key: String(process.env.IBCM_TEST),
  },
  MainIndexxBroadcomContract: {
    key: String(process.env.IBCM_MAIN),
  },
  TestIndexxSNP500Contract: {
    key: String(process.env.ISNP5_TEST),
  },
  MainIndexxSNP500Contract: {
    key: String(process.env.ISNP5_MAIN),
  },
  TestIndexxPepsiCoContract: {
    key: String(process.env.IPEP_TEST),
  },
  MainIndexxPepsiCoContract: {
    key: String(process.env.IPEP_MAIN),
  },
  TestIndexxNividaContract: {
    key: String(process.env.INVDA_TEST),
  },
  MainIndexxNividiaContract: {
    key: String(process.env.INVDA_MAIN),
  },
  TestIndexxAmazonContract: {
    key: String(process.env.IAMZN_TEST),
  },
  MainIndexxAmazonContract: {
    key: String(process.env.IAMZN_MAIN),
  },
  TestIndexxGoogleContract: {
    key: String(process.env.IGOOGL_TEST),
  },
  MainIndexxGoogleContract: {
    key: String(process.env.IGOOGL_MAIN),
  },
  TestIndexxUSDPContract: {
    key: String(process.env.IUSDP_TEST),
  },
  MainIndexxUSDPContract: {
    key: String(process.env.IUSDP_MAIN),
  },
  TestIndexxExContract: {
    key: String(process.env.INEX_TEST),
  },
  TestMaticIndexxExContract: {
    key: String(process.env.MATIC_INEX_TEST),
  },
  MainMaticIndexxExContract: {
    key: String(process.env.MATIC_INEX_MAIN),
  },
  MainIndexxExContract: {
    key: String(process.env.INEX_MAIN),
  },
  TestIndexxPhoenixContract: {
    key: String(process.env.INXP_TEST),
  },
  MainIndexxPhoenixContract: {
    key: String(process.env.INXP_MAIN),
  },
  TestFTTContract: {
    key: String(process.env.FTT_TEST),
  },
  MainFTTContract: {
    key: String(process.env.FTT_MAIN),
  },
  TestSoRektContract: {
    key: String(process.env.SRT_TEST),
  },
  MainSoRektContract: {
    key: String(process.env.SRT_MAIN),
  },
  TestETHIndexx500Contract: {
    key: String(process.env.TestETHIndexx500Contract),
  },
  MainETHIndexx500Contract: {
    key: String(process.env.MainETHIndexx500Contract),
  },
  TestETHIndexxCryptoContract: {
    key: String(process.env.TestETHIndexxCryptoContract),
  },
  MainETHIndexxCryptoContract: {
    key: String(process.env.MainETHIndexxCryptoContract),
  },
  TestETHIndexxUSDPContract: {
    key: String(process.env.TestETHIndexxUSDPContract),
  },
  MainETHIndexxUSDPContract: {
    key: String(process.env.MainETHIndexxUSDPContract),
  },
  TestETHIndexxExContract: {
    key: String(process.env.TestETHIndexxExContract),
  },
  MainETHIndexxExContract: {
    key: String(process.env.MainETHIndexxExContract),
  },
  TestETHIndexxPhoenixContract: {
    key: String(process.env.TestETHIndexxPhoenixContract),
  },
  MainETHIndexxPhoenixContract: {
    key: String(process.env.MainETHIndexxPhoenixContract),
  },
  IndexxTestKey: {
    key: String(process.env.INDEXX_TEST_KEY),
  },
  BinanceKey: {
    key: String(process.env.BINANCE_KEY),
  },
  BinanceSecret: {
    key: String(process.env.BINANCE_SECRET),
  },
  ShoperPalRewardApiKey: {
    key: String(process.env.SHOPERPAL_REWARD_API_KEY),
  },
  ShoperPalRewardSecret: {
    key: String(process.env.SHOPERPAL_REWARD_SECRET),
  },
  INFURA_KEY: {
    key: String(process.env.INFURA_KEY),
  },
  BSCSCAN_KEY: {
    key: String(process.env.BSCSCAN_KEY),
  },
  QUICKNODE_BNB_TEST: {
    key: String(process.env.QUICKNODE_BNB_TEST),
  },
  QUICKNODE_BNB_MAIN: {
    key: String(process.env.QUICKNODE_BNB_MAIN),
  },
  PERSONAL_WALLET_PRIVATE: {
    key: String(process.env.PERSONAL_WALLET_PRIVATE),
  },
  PERSONAL_SELL_WALLET_SOL: {
    key: process.env.PERSONAL_SELL_WALLET_SOL,
  },
  PERSONAL_SELL_WALLET_ETH: {
    key: process.env.PERSONAL_SELL_WALLET_ETH,
  },
  WIBS_PERSONAL_WALLET_PRIVATE: {
    key: String(process.env.WIBS_PERSONAL_WALLET_PRIVATE),
  },
  PERSONAL_STOCK_WALLET_PRIVATE: {
    key: String(process.env.PERSONAL_STOCK_WALLET_PRIVATE),
  },
  PERSONAL_STOCK_MAIN_WALLET_PRIVATE: {
    key: String(process.env.PERSONAL_STOCK_MAIN_WALLET_PRIVATE),
  },
  PERSONAL_MATIC_WALLET_PRIVATE: {
    key: String(process.env.PERSONAL_MATIC_WALLET_PRIVATE),
  },
  PERSONAL_MAIN_MATIC_WALLET_PRIVATE: {
    key: String(process.env.PERSONAL_MAIN_MATIC_WALLET_PRIVATE),
  },
  ETH_MAIN_WS_URL: {
    key: String(process.env.ETH_MAIN_WS_URL),
  },
  ETH_TEST_WS_URL: {
    key: String(process.env.ETH_TEST_WS_URL),
  },
  BSC_MAIN_WS_URL: {
    key: String(process.env.BSC_MAIN_WS_URL),
  },
  BSC_TEST_WS_URL: {
    key: String(process.env.BSC_TEST_WS_URL),
  },
  BITCOIN_PRIVATE_KEY: {
    key: String(process.env.BITCOIN_PRIVATE_KEY_TEST),
  },
  BITCOIN_PUBLIC_KEY: {
    key: String(process.env.BITCOIN_PUBLIC_KEY_TEST),
  },
  SOREKT_TEST: {
    key: String(process.env.SRT_NFT_TEST),
  },
  SOREKT_MAIN: {
    key: String(process.env.SRT_NFT_MAIN),
  },
  USDC_TESTNET_ADDRESS: {
    key: String(process.env.USDC_TESTNET_ADDRESS),
  },
  USDC_MAINNET_ADDRESS: {
    key: String(process.env.USDC_MAINNET_ADDRESS),
  },
  USDT_TESTNET_ADDRESS: {
    key: String(process.env.USDT_TESTNET_ADDRESS),
  },
  USDT_MAINNET_ADDRESS: {
    key: String(process.env.USDT_MAINNET_ADDRESS),
  },
  TRX_TESTNET_ADDRESS: {
    key: String(process.env.TRX_TESTNET_ADDRESS),
  },
  TRX_MAINNET_ADDRESS: {
    key: String(process.env.TRX_MAINNET_ADDRESS),
  },
  SOLANA_TESTNET_URL: {
    key: String(process.env.SOLANA_TESTNET_URL),
  },
  SOLANA_MAINNET_URL: {
    key: String(process.env.SOLANA_MAINNET_URL),
  },
  TONCOIN_TESTNET_ADDRESS: {
    key: String(process.env.TONCOIN_TESTNET_ADDRESS),
  },
  TONCOIN_MAINNET_ADDRESS: {
    key: String(process.env.TONCOIN_MAINNET_ADDRESS),
  },
  OUR_ETHEREUM_WALLET: {
    key: String(process.env.OUR_ETHEREUM_WALLET),
  },
  OUR_SOLANA_WALLET: {
    key: String(process.env.OUR_SOLANA_WALLET),
  },
  DAI_TESTNET_CONTRACT: {
    key: String(process.env.DAI_TESTNET_CONTRACT),
  },
  DAI_MAINNET_CONTRACT: {
    key: String(process.env.DAI_MAINNET_CONTRACT),
  },
  SHIB_TESTNET_CONTRACT: {
    key: String(process.env.SHIB_TESTNET_CONTRACT),
  },
  SHIB_MAINNET_CONTRACT: {
    key: String(process.env.SHIB_MAINNET_CONTRACT),
  },
  LINK_TESTNET_CONTRACT: {
    key: String(process.env.LINK_TESTNET_CONTRACT),
  },
  LINK_MAINNET_CONTRACT: {
    key: String(process.env.LINK_MAINNET_CONTRACT),
  },
  LEO_TESTNET_ADDRESS: {
    key: String(process.env.LEO_TESTNET_ADDRESS),
  },
  LEO_MAINNET_ADDRESS: {
    key: String(process.env.LEO_MAINNET_ADDRESS),
  },
  TUSD_TESTNET_ADDRESS: {
    key: String(process.env.TUSD_TESTNET_ADDRESS),
  },
  TUSD_MAINNET_ADDRESS: {
    key: String(process.env.TUSD_MAINNET_ADDRESS),
  },
  MATIC_TESTNET_ADDRESS: {
    key: String(process.env.MATIC_TESTNET_ADDRESS),
  },
  MATIC_MAINNET_ADDRESS: {
    key: String(process.env.MATIC_MAINNET_ADDRESS),
  },
  SOL_USDC_MINT: {
    key: String(process.env.SOL_USDC_MINT),
  },
  SOL_USDT_MINT: {
    key: String(process.env.SOL_USDT_MINT),
  },
  SOL_DEV_WS_URL: {
    key: String(process.env.SOL_DEV_WS_URL),
  },
  SOL_MAIN_WS_URL: {
    key: String(process.env.SOL_MAIN_WS_URL),
  },
  SOLANA_DEV_RPC_URL: {
    key: String(process.env.SOLANA_DEV_RPC_URL),
  },
  SOLANA_MAIN_RPC_URL: {
    key: String(process.env.SOLANA_MAIN_RPC_URL),
  },
  ZEROBOUNCE_API_KEYS: {
    key: String(
      process.env.ZEROBOUNCE_API_KEYS || process.env.ZEROBOUNCE_API_KEY || ""
    ),
  },
  ZEROBOUNCE_API_URL: {
    key: String(process.env.ZEROBOUNCE_API_URL || ""),
  },
  FLAG_AD_REWARDS: {
    key: true,
  },
  admobApi: {
    publisherId: process.env.GOOGLE_ADMOB_PUBLISHER_ID || "",
    clientId: process.env.GOOGLE_ADMOB_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_ADMOB_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_ADMOB_REFRESH_TOKEN || "",
  },
  miningStation: {
    // Rewarded CPM: GOOGLE_ADMOB_REWARDED_CPM_USD > MINING_STATION_ADMOB_CPM_USD > ADMOB_REWARDED_CPM_USD
    admobRewardedCpmUsd: parseFloat(
      process.env.GOOGLE_ADMOB_REWARDED_CPM_USD ||
      process.env.MINING_STATION_ADMOB_CPM_USD ||
      process.env.ADMOB_REWARDED_CPM_USD ||
      "0"
    ),
    admobInterstitialCpmUsd: parseFloat(
      process.env.GOOGLE_ADMOB_INTERSTITIAL_CPM_USD || "0"
    ),
    // Revenue share: MINING_STATION_REFERRAL_REVENUE_SHARE_PCT > MINING_STATION_AD_REVENUE_SHARE_PCT
    revenueSharePct: parseFloat(
      process.env.MINING_STATION_REFERRAL_REVENUE_SHARE_PCT ||
      process.env.MINING_STATION_AD_REVENUE_SHARE_PCT ||
      "30"
    ),
    // Legacy fixed-per-ad rates — only used when both CPM values are 0
    legacyEarningUsdPerAd: parseFloat(
      process.env.MINING_STATION_EARNING_USD_PER_AD || "0"
    ),
    legacyEarningBtcyPerAd: parseFloat(
      process.env.MINING_STATION_EARNING_BTCY_PER_AD || "0"
    ),
  },
};
