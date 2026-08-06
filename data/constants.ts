export async function MainNetConst() {
  const MAINNETRPCURL = "https://bsc-dataseed.binance.org/";
  const USDTChainLinkPriceFeedAdd =
    "0xB97Ad0E74fa7d920791E90258A6E2085088b4320";
}

export async function TestNetConst() {
  const TESTNETRPCURL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
  const USDTChainLinkPriceFeedAdd =
    "0xEca2605f0BCF2BA5966372C99837b1F182d3D620";
}

export const MessageConstants = {
  InvalidAddress: "Invalid Address",
  InvalidAmount: "Invalid Amount",
  InvalidAmountOrAddress: "Invalid Amount or Address",
  InvalidAmountOrAddressOrPrivateKey:
    "Invalid Amount or Address or Private Key",
  InvalidPrivateKey: "Invalid Private Key",
  InvalidTransactionHash: "Invalid Transaction Hash",
  InvalidTransactionHashOrAddress: "Invalid Transaction Hash or Address",
  InvalidTransactionHashOrAddressOrPrivateKey:
    "Invalid Transaction Hash or Address or Private Key",
  InvalidTransactionHashOrPrivateKey: "Invalid Transaction Hash or Private Key",
  InvalidTransactionHashOrPrivateKeyOrAddress:
    "Invalid Transaction Hash or Private Key or Address",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmount:
    "Invalid Transaction Hash or Private Key or Address or Amount",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPrice:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimit:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimitOrData:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit or Data",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimitOrDataOrNonce:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit or Data or Nonce",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimitOrDataOrNonceOrChainId:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit or Data or Nonce or Chain Id",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimitOrDataOrNonceOrChainIdOrTo:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit or Data or Nonce or Chain Id or To",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimitOrDataOrNonceOrChainIdOrToOrValue:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit or Data or Nonce or Chain Id or To or Value",
  InvalidTransactionHashOrPrivateKeyOrAddressOrAmountOrGasPriceOrGasLimitOrDataOrNonceOrChainIdOrToOrValueOrData:
    "Invalid Transaction Hash or Private Key or Address or Amount or Gas Price or Gas Limit or Data or Nonce or Chain Id or To or Value or Data",
  EmailVerified: "Email Verified",
  EmailNotVerified: "Email Not Verified",
  EmailRegistered: "Email Already Registered. Please login.",
  EmailNotRegistered: "Email Not Registered",
  EmailSent: "Email Sent",
  EmailAlreadyVerified: "Email Already Verified",
  InvalidEmailCode: "Invalid Email Code",
  ErrorWhileVerifyingEmail: "Error While Verifying Email. Please Try Again",
  ErrorWhileSendingEmail: "Error While Sending Email. Please Try Again",
  MobileNotVerified: "Mobile not Registered or Verified",
};
