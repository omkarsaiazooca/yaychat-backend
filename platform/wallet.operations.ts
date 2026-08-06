import { BIP32Factory } from "bip32";
import { Network, validate } from "bitcoin-address-validation";
import Wallet from "ethereumjs-wallet";
import { Request, Response } from "express";
import { keys } from "../config/keys";
import {
  Currency,
  CurrencyType,
  TransactionAccount,
  TransactionType,
  WalletType,
} from "../data/common";
import { UserWallet } from "../data/user";
import { Keypair } from "@solana/web3.js";
import { decryptData, encryptData } from "../services/crypto.service";
import { UserService } from "../services/user.service";
import { BaseAPIOperations } from "./base.operations";
import { ethers } from "ethers";
import { v1 as uuidv1 } from "uuid";
import { OrderStatus } from "../data/order";
import { TransactionService } from "../services/transaction.service";
import { Transaction } from "../data/transaction";
import { IndexxService } from "../services/IndexxTokens.service";
import { CoreWallet } from "../data/coreWallet";
import { CoreWalletService } from "../services/coreWallet.service";
import ECPairFactory from "ecpair";
import * as ecc from "tiny-secp256k1";
import { BitcoinService } from "../services/bitcoin.service";
import { WalletUserService } from "../services/walletUser.service";
const web3 = require("web3");
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");
const ECPair = ECPairFactory(ecc);
const env = keys.env.key;
let network = bitcoin.networks.bitcoin; //use networks.testnet for testnet
let path = "m/49'/0'/0'/0/0"; //use testnet path "m/44'/1'/0'/0/0" for testnet
console.log("env", env);
if (env == "development" || env == "test") {
  network = bitcoin.networks.testnet;
} else if (env == "main" || env == "prod") {
  network = bitcoin.networks.bitcoin;
}

let uservice: UserService = new UserService();
let wuserservice: WalletUserService = new WalletUserService();
let txserivce: TransactionService = new TransactionService();
let indexxService: IndexxService = new IndexxService();
let coreWalletService: CoreWalletService = new CoreWalletService();
let bitcoinService: BitcoinService = new BitcoinService();

export class WalletOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  get userLiteFields() {
    return {
      userId: 1,
      email: 1,
      firstName: 1,
      lastName: 1,
      role: 1,
      isVerified: 1,
      language: 1,
    };
  }

  async getWallet(req: any, res: any) {
    try {
    } catch (err) {
      console.log(err);
    }
  }

  //Used for creating Ethereum Wallet
  async createEthereumWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Ethereum",
          coinSymbol: "ETH",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createEthereumWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Ethereum",
          coinSymbol: "ETH",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  // Used for binance smart chain wallet
  async createBinanceWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Binance",
          coinSymbol: "BNB",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBinanceWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Binance",
          coinSymbol: "BNB",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createIN500Wallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Indexx500",
          coinSymbol: "IN500",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHWIBSWallet(email: string, coin: string, balance: number = 0) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "WhoIsBitcoinSatoshi",
          coinSymbol: "WIBS",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createeIN500WalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Indexx500",
          coinSymbol: "IN500",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHIN500WalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "Indexx500",
          coinSymbol: "IN500",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINXCWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxCrypto",
          coinSymbol: "INXC",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createeINXCWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxCrypto",
          coinSymbol: "INXC",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHINXCWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "IndexxCrypto",
          coinSymbol: "INXC",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }
  async createIUSDPWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxUSD+",
          coinSymbol: "iUSD+",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createeIUSDPWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxUSD+",
          coinSymbol: "iUSD+",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHIUSDPWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "IndexxUSD+",
          coinSymbol: "iUSD+",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createFTTETHWallet(email: string, coin?: string, balance?: number) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "FTX Token",
          coinSymbol: "FTT",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createINEXWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log(wallet);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }


  async createDaCrazyWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "DaCrazyHawaiian",
          coinSymbol: "DaCrazy",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log(wallet);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createMATICINEXWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Polygon",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createeINEXWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log("created indexx wallet with balance", wallet, balance);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHINEXWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log(wallet);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createETHWIBSWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Ethereum",
          coinName: "WhoIsBitcoinSatoshi",
          coinSymbol: "WIBS",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log(wallet);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }


  async createSOLWIBSWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        const addressData = Keypair.generate();
        const address = addressData.publicKey.toString();

        let encryptedPrivateKey = await encryptData(addressData.secretKey);
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address,
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Solana",
          coinName: "WhoIsBitcoinSatoshi",
          coinSymbol: "WIBS",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log(wallet);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createMATICINEXWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        {}
        //this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Polygon",
          coinName: "IndexxExchange",
          coinSymbol: "INEX",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        console.log("created indexx wallet with balance", wallet, balance);
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBUSDWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Binance Smart Chain",
          coinName: "Binance USD",
          coinSymbol: "BUSD",
          coinDecimals: 18,
          coinBalance: balance,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );
        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async verifyBitcoinWallet(email: string, coin: string, address: string) {
    try {
      if (env == "deployment" || env == "test" || env == "staging") {
        const res = await validate(address, Network.testnet);
        return { status: 200, data: res };
      } else {
        const res = await validate(address, Network.mainnet);
        return { status: 200, data: res };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async verifyBinanceWallet(email: any, coin: any, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async verifyIN500Wallet(email: any, coin: any, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async verifyINXCWallet(email: any, coin: any, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async verifyIUSDPWallet(email: any, coin: any, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async verifyBUSDWallet(email: any, coin: any, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async verifyEthereumWallet(email: any, coin: any, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async verifyINEXWallet(email: string, coin: string, address: string) {
    try {
      let res = await this.validateAddress(address);
      return { data: res, status: 200 };
    } catch (err) {
      console.log(err);
    }
  }

  async sendBitcoin(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let user = await uservice.findOneSelect(
        { email: email },
        { userWallets: 1 }
      );
      if (user) {
        let userWallet = user.userWallets.find((x) => x.coinSymbol == coin);
        if (userWallet) {
          let privateKey = await decryptData(userWallet.coinPrivateKey);
          let sendBTc = await bitcoinService.sendBitcoinTransaction(
            address,
            amount
          );
          console.log(sendBTc);
          return { status: 200, data: "transaction" };
        } else {
          return { status: 500, data: "Wallet not found" };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async sendBitcoin1(
    email: string,
    coin: string,
    address: string,
    amount: number,
    userWallerAddress: string = ""
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        { userWallets: 1 }
      );
      if (user) {
        let userWallet;
        if (userWallerAddress === "") {
          userWallet = user.userWallets.find((x) => x.coinSymbol == coin);
        } else {
          userWallet = user.userWallets.find(
            (x) =>
              x.coinSymbol == coin && x.coinWalletAddress === userWallerAddress
          );
        }
        if (userWallet) {
          let privateKey = await decryptData(userWallet.coinPrivateKey);
          let sendBTc = await bitcoinService.sendBitcoinTransaction1(
            address,
            amount,
            userWallet.coinWalletAddress,
            privateKey
          );
          console.log(sendBTc);
          return { status: 200, data: "transaction" };
        } else {
          return { status: 500, data: "Wallet not found" };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async sendBinance(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        const API_URL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.ALCHEMYKEY_TEST.key
            : keys.ALCHEMYKEY_MAIN.key;
        console.log(API_URL);
        console.log(coin);
        let rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.BSC_RPC_TEST.key
            : keys.BSC_RPC_MAIN.key;
        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let userWallet = user.userWallets.find(
          (x) => x.coinSymbol == coin
        ) as UserWallet;
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        const walletBalance = await rpcProvider.getBalance(
          userWallet.coinWalletAddress
        );
        let wallet = new ethers.Wallet(privateKey, rpcProvider);
        const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
        if (balanceInEth < amount) {
          return { status: 500, data: "Insufficient Balance" };
        } else {
          // Create a transaction object
          let tx = {
            to: address,
            // Convert currency unit from ether to wei
            value: ethers.utils.parseEther(amount.toString()),
          };
          // Send a transaction
          let transactionHash = await wallet.sendTransaction(tx);
          if (transactionHash) {
            let updateUser = await uservice.updatePart(
              {
                email: email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              { $set: { "userWallets.$.coinBalance": balanceInEth - amount } }
            );
            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: transactionHash.hash,
              from: userWallet.coinWalletAddress,
              to: address,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: "BNB",
              walletType: "Asset Wallet",
              transactionType: "WITHDRAW_CYRPTO",
              exchangeName: "CEX",
              email: email,
              txDate: new Date(),
              benificaryAddress: "",
            } as Transaction;
            let createTx = await txserivce.create(transaction);
          }
          return { status: 200, data: transactionHash };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async sendBinance1(
    email: string,
    coin: string,
    address: string,
    amount: number,
    userWallerAddress: string = ""
  ) {
    try {
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        const API_URL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.ALCHEMYKEY_TEST.key
            : keys.ALCHEMYKEY_MAIN.key;
        console.log(API_URL);
        console.log(coin);
        let rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.BSC_RPC_TEST.key
            : keys.BSC_RPC_MAIN.key;
        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let userWallet;
        if (userWallerAddress === "") {
          userWallet = user.userWallets.find(
            (x) => x.coinSymbol == coin
          ) as UserWallet;
        } else {
          userWallet = user.userWallets.find(
            (x) =>
              x.coinSymbol == coin && x.coinWalletAddress === userWallerAddress
          ) as UserWallet;
        }
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        const walletBalance = await rpcProvider.getBalance(
          userWallet.coinWalletAddress
        );
        let wallet = new ethers.Wallet(privateKey, rpcProvider);
        const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
        if (balanceInEth < amount) {
          return { status: 500, data: "Insufficient Balance" };
        } else {
          // Create a transaction object
          let tx = {
            to: address,
            // Convert currency unit from ether to wei
            value: ethers.utils.parseEther(amount.toString()),
          };
          // Send a transaction
          let transactionHash = await wallet.sendTransaction(tx);
          if (transactionHash) {
            let updateUser = await uservice.updatePart(
              {
                email: email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              { $set: { "userWallets.$.coinBalance": balanceInEth - amount } }
            );
            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: transactionHash.hash,
              from: userWallet.coinWalletAddress,
              to: address,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: "BNB",
              walletType: "Asset Wallet",
              transactionType: "WITHDRAW_CYRPTO",
              exchangeName: "CEX",
              email: email,
              txDate: new Date(),
              benificaryAddress: "",
            } as Transaction;
            let createTx = await txserivce.create(transaction);
          }
          return { status: 200, data: transactionHash };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async sendIN500(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let res = await indexxService.transferIndexx500(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendINXCOnETH(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let res = await indexxService.transferIndexxCryptoOnETH(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendIUSDPOnETH(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let res = await indexxService.transferIndexxUSDPOnETH(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendIN500OnETH(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let res = await indexxService.transferIndexx500OnETH(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendINXC(email: string, coin: string, address: string, amount: number) {
    try {
      let res = await indexxService.transferIndexxCrypto(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendIUSDP(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let res = await indexxService.transferIndexxUSDP(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendBUSD(email: string, coin: string, address: string, amount: number) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        let rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.BSC_RPC_TEST.key
            : keys.BSC_RPC_MAIN.key;
        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let userWallet = user.userWallets.find(
          (x) => x.coinSymbol == coin
        ) as UserWallet;
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        const walletBalance = await rpcProvider.getBalance(
          userWallet.coinWalletAddress
        );
        let wallet = new ethers.Wallet(privateKey, rpcProvider);
        const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
        if (balanceInEth < amount) {
          return { status: 500, data: "Insufficient Balance" };
        } else {
          // Create a transaction object
          let tx = {
            to: address,
            // Convert currency unit from ether to wei
            value: ethers.utils.parseEther(amount.toString()),
          };
          // Send a transaction
          let transactionHash = await wallet.sendTransaction(tx);
          if (transactionHash) {
            let updateUser = await uservice.updatePart(
              {
                email: email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              { $set: { "userWallets.$.coinBalance": balanceInEth - amount } }
            );

            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: transactionHash.hash,
              from: userWallet.coinWalletAddress,
              to: address,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: "BUSD",
              walletType: "Asset Wallet",
              transactionType: "WITHDRAW_CYRPTO",
              email: email,
              exchangeName: "CEX",
              txDate: new Date(),
              benificaryAddress: "",
            } as Transaction;
            let createTx = await txserivce.create(transaction);
          }
          return { status: 200, data: transactionHash };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async sendEthereum(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      if (user) {
        const rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.ALCHEMYKEY_TEST.key
            : keys.ALCHEMYKEY_MAIN.key;
        console.log(rpcURL);
        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let userWallet = user.userWallets.find(
          (x) => x.coinSymbol == coin
        ) as UserWallet;
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        const walletBalance = await rpcProvider.getBalance(
          userWallet.coinWalletAddress
        );
        console.log("privateKey", privateKey);
        let wallet = new ethers.Wallet(privateKey, rpcProvider);
        const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
        if (balanceInEth < amount) {
          return { status: 500, data: "Insufficient Balance" };
        } else {
          // Create a transaction object
          let tx = {
            to: address,
            // Convert currency unit from ether to wei
            value: ethers.utils.parseEther(amount.toString()),
          };
          // Send a transaction
          let transactionHash = await wallet.sendTransaction(tx);
          if (transactionHash) {
            let updateUser = await uservice.updatePart(
              {
                email: email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              { $set: { "userWallets.$.coinBalance": balanceInEth - amount } }
            );

            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: transactionHash.hash,
              from: userWallet.coinWalletAddress,
              to: address,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: "ETH",
              walletType: "Asset Wallet",
              transactionType: "WITHDRAW_CYRPTO",
              email: email,
              exchangeName: "CEX",
              txDate: new Date(),
              benificaryAddress: "",
            } as Transaction;
            let createTx = await txserivce.create(transaction);
          }
          return { status: 200, data: transactionHash };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async sendEthereum1(
    email: string,
    coin: string,
    address: string,
    amount: number,
    userWallerAddress: string = ""
  ) {
    try {
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
        let rpcURL =
          keys.env.key == "development"
            ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let userWallet;
        if (userWallerAddress === "") {
          userWallet = user.userWallets.find(
            (x) => x.coinSymbol == coin
          ) as UserWallet;
        } else {
          userWallet = user.userWallets.find(
            (x) =>
              x.coinSymbol == coin && x.coinWalletAddress === userWallerAddress
          ) as UserWallet;
        }
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        const walletBalance = await rpcProvider.getBalance(
          userWallet.coinWalletAddress
        );
        console.log("privateKey", privateKey);
        let wallet = new ethers.Wallet(privateKey, rpcProvider);
        const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
        if (balanceInEth < amount) {
          return { status: 500, data: "Insufficient Balance" };
        } else {
          // Create a transaction object
          let tx = {
            to: address,
            // Convert currency unit from ether to wei
            value: ethers.utils.parseEther(amount.toString()),
          };
          // Send a transaction
          let transactionHash = await wallet.sendTransaction(tx);
          if (transactionHash) {
            let updateUser = await uservice.updatePart(
              {
                email: email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              { $set: { "userWallets.$.coinBalance": balanceInEth - amount } }
            );

            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: transactionHash.hash,
              from: userWallet.coinWalletAddress,
              to: address,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: "ETH",
              walletType: "Asset Wallet",
              transactionType: "WITHDRAW_CYRPTO",
              email: email,
              exchangeName: "CEX",
              txDate: new Date(),
              benificaryAddress: "",
            } as Transaction;
            let createTx = await txserivce.create(transaction);
          }
          return { status: 200, data: transactionHash };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }
  async sendINEX(email: string, coin: string, address: string, amount: number) {
    try {
      let res = await indexxService.transferIndexxExchange(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async sendINEXOnETH(
    email: string,
    coin: string,
    address: string,
    amount: number
  ) {
    try {
      let res = await indexxService.transferIndexxExchangeOnETH(
        amount,
        address,
        email,
        coin
      );
      console.log(res);
    } catch (err) {
      console.log(err);
    }
  }

  async createBitcoinCoreWallet(email: string, coin: string) {
    try {
      //     let user = await uservice.findOneSelect({ email: email }, {});
      //     if (user) {
      //         let userWallet = user.userWallets.find(x => x.coinSymbol == coin) as UserWallet;
      //         if (userWallet) {
      //             return { status: 500, data: "Wallet already exist" };
      //         } else {
      //             let rpcURL = (keys.env.key == 'development' || keys.env.key == 'test') ? keys.BITCOIN_RPC_TEST.key : keys.BITCOIN_RPC_MAIN.key;
      //             let rpcProvider = new bitcoin_rpc(rpcURL);
      //             let wallet = await rpcProvider.getnewaddress();
      //             let privateKey = await rpcProvider.dumpprivkey(wallet);
      //             let userWallet = {
      //                 coinSymbol: coin,
      //                 coinWalletAddress: wallet,
      //                 coinPrivateKey: await encryptData(privateKey),
      //                 coinBalance: 0,
      //             } as UserWallet;
      //             let updateUser = await uservice.updatePart(
      //                 { email: email },
      //                 { $push: { userWallets: userWallet } });
      //             return { status: 200, data: wallet };
      //         }
      //     } else {
      //         return { status: 500, data: "User not found" };
      //     }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async sendMatic(
    email: string,
    coin: string,
    address: string,
    amount: number,
    userWallerAddress: string = ""
  ) {
    try {
      let user = await wuserservice.findOneSelect({ email: email }, {});
      if (user) {
        const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
        let rpcURL =
          keys.env.key == "development"
            ? "https://polygon-mumbai.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://polygon-mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
        console.log(coin);

        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let userWallet;
        if (userWallerAddress === "") {
          userWallet = user.userWallets.find(
            (x) => x.coinSymbol == coin
          ) as UserWallet;
        } else {
          userWallet = user.userWallets.find(
            (x) =>
              x.coinSymbol == coin && x.coinWalletAddress === userWallerAddress
          ) as UserWallet;
        }
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        const walletBalance = await rpcProvider.getBalance(
          userWallet.coinWalletAddress
        );
        let wallet = new ethers.Wallet(privateKey, rpcProvider);
        const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
        if (balanceInEth < amount) {
          return { status: 500, data: "Insufficient Balance" };
        } else {
          // Create a transaction object
          let tx = {
            to: address,
            // Convert currency unit from ether to wei
            value: ethers.utils.parseEther(amount.toString()),
          };
          // Send a transaction
          let transactionHash = await wallet.sendTransaction(tx);
          if (transactionHash) {
            let updateUser = await uservice.updatePart(
              {
                email: email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              { $set: { "userWallets.$.coinBalance": balanceInEth - amount } }
            );
            //create transaction
            let transaction = {
              orderId: uuidv1(),
              extRef: "",
              txId: transactionHash.hash,
              from: userWallet.coinWalletAddress,
              to: address,
              amount: amount,
              info: "",
              status: OrderStatus.Completed,
              currencyRef: "BNB",
              walletType: "Asset Wallet",
              transactionType: "WITHDRAW_CYRPTO",
              exchangeName: "CEX",
              email: email,
              txDate: new Date(),
              benificaryAddress: "",
            } as Transaction;
            let createTx = await txserivce.create(transaction);
          }
          return { status: 200, data: transactionHash };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }
  async createEthereumCoreWallet() {
    try {
      let coreWallet = await coreWalletService.findOne({ coin: "ETH" });
      if (coreWallet) {
        return { status: 500, data: "Wallet already exist" };
      } else {
        let wallet = ethers.Wallet.createRandom();
        let walletPrivateKey = await encryptData(wallet.privateKey);
        let network = env == "development" ? "Goerli" : "Mainnet";
        let coreWallet = {
          coinSymbol: "ETH",
          coinAddress: wallet.address,
          coinPrivateKey: String(walletPrivateKey),
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: network,
          coinName: "Ethereum",
        } as CoreWallet;
        let createCoreWallet = await coreWalletService.create(coreWallet);
        return { status: 200, data: createCoreWallet };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createBinanceCoreWallet() {
    try {
      let coreWallet = await coreWalletService.findOne({ coin: "BNB" });
      if (coreWallet) {
        return { status: 500, data: "Wallet already exist" };
      } else {
        let wallet = ethers.Wallet.createRandom();
        let walletPrivateKey = await encryptData(wallet.privateKey);
        let network =
          env == "development"
            ? "Binance Smart Chain Testnet"
            : "Binance Smart Chain";
        let coreWallet = {
          coinSymbol: "BNB",
          coinAddress: wallet.address,
          coinPrivateKey: String(walletPrivateKey),
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: network,
          coinName: "Binance",
        } as CoreWallet;
        let createCoreWallet = await coreWalletService.create(coreWallet);
        return { status: 200, data: createCoreWallet };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async createIndexxCryptoCoreWallet() {
    try {
      let coreWallet = await coreWalletService.findOne({ coin: "INXC" });
      if (coreWallet) {
        return { status: 500, data: "Wallet already exist" };
      } else {
        let wallet = ethers.Wallet.createRandom();
        let walletPrivateKey = await encryptData(wallet.privateKey);
        let network =
          env == "development"
            ? "Binance Smart Chain Testnet"
            : "Binance Smart Chain";
        let coreWallet = {
          coinSymbol: "INXC",
          coinAddress: wallet.address,
          coinPrivateKey: String(walletPrivateKey),
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: network,
          coinName: "IndexxCrypto",
        } as CoreWallet;
        let createCoreWallet = await coreWalletService.create(coreWallet);
        return { status: 200, data: createCoreWallet };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async createIndexx500CoreWallet() {
    try {
      let coreWallet = await coreWalletService.findOne({ coin: "IN500" });
      if (coreWallet) {
        return { status: 500, data: "Wallet already exist" };
      } else {
        let wallet = ethers.Wallet.createRandom();
        let walletPrivateKey = await encryptData(wallet.privateKey);
        let network =
          env == "development"
            ? "Binance Smart Chain Testnet"
            : "Binance Smart Chain";
        let coreWallet = {
          coinSymbol: "IN500",
          coinAddress: wallet.address,
          coinPrivateKey: String(walletPrivateKey),
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: network,
          coinName: "Indexx500",
        } as CoreWallet;
        let createCoreWallet = await coreWalletService.create(coreWallet);
        return { status: 200, data: createCoreWallet };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async createIndexxUSDPCoreWallet() {
    try {
      let coreWallet = await coreWalletService.findOne({ coin: "IUSD+" });
      if (coreWallet) {
        return { status: 500, data: "Wallet already exist" };
      } else {
        let wallet = ethers.Wallet.createRandom();
        let walletPrivateKey = await encryptData(wallet.privateKey);
        let network =
          env == "development"
            ? "Binance Smart Chain Testnet"
            : "Binance Smart Chain";
        let coreWallet = {
          coinSymbol: "IUSD+",
          coinAddress: wallet.address,
          coinPrivateKey: String(walletPrivateKey),
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: network,
          coinName: "Indexx USD+",
        } as CoreWallet;
        let createCoreWallet = await coreWalletService.create(coreWallet);
        return { status: 200, data: createCoreWallet };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: err };
    }
  }

  async createIndexxExCoreWallet() {
    try {
      let coreWallet = await coreWalletService.findOne({ coin: "INEX" });
      if (coreWallet) {
        return { status: 500, data: "Wallet already exist" };
      } else {
        let wallet = ethers.Wallet.createRandom();
        let walletPrivateKey = await encryptData(wallet.privateKey);
        let network =
          env == "development"
            ? "Binance Smart Chain Testnet"
            : "Binance Smart Chain";
        let coreWallet = {
          coinSymbol: "INEX",
          coinAddress: wallet.address,
          coinPrivateKey: String(walletPrivateKey),
          coinBalance: 0,
          coinLastUsed: new Date(),
          coinNetwork: network,
          coinName: "Indexx Exchange",
        } as CoreWallet;
        let createCoreWallet = await coreWalletService.create(coreWallet);
        return { status: 200, data: createCoreWallet };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: err };
    }
  }
  //Helpers
  async validateAddress(address: string) {
    try {
      let res = web3.utils.isAddress(address);
      return res;
    } catch (err) {
      console.log(err);
    }
  }

  async createBitcoinWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await uservice.findOneSelect({ email: email }, {});
      let TESTNET;
      let keyPair;
      let address;
      let encryptedPrivateKey;
      if (user) {
        if (env == "development" || env == "test") {
          TESTNET = bitcoin.networks.testnet;
          keyPair = ECPair.makeRandom({ network: TESTNET });
          address = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: TESTNET,
          });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        } else if (env == "prod" || env == "main") {
          keyPair = ECPair.makeRandom({ network: bitcoin.networks.bitcoin });
          address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        }
        console.log('address', address)
        let userWallet = {
          userId: user._id,
          coinSymbol: coin,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address.address,
          coinPrivateKey: encryptedPrivateKey,
          coinBalance: balance,
          coinLastUsed: new Date(),
          coinNetwork: "Bitcoin",
          coinName: "Bitcoin",
          coinDecimals: 8,
          coinStakedBalance: 0,
          coinBalanceInUSD: 0,
          coinPrice: 0,
          coinPrevPrice: 0,
          coinBalanceInBTC: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        } as UserWallet;
        let updateUser = await uservice.updatePart(
          { email: email },
          { $push: { userWallets: userWallet } }
        );
        return { status: 200, data: address.address };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBitcoinWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect({ email: email }, {});
      let TESTNET;
      let keyPair;
      let address;
      let encryptedPrivateKey;
      if (user) {
        if (env == "development" || env == "test") {
          TESTNET = bitcoin.networks.testnet;
          keyPair = ECPair.makeRandom({ network: TESTNET });
          address = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: TESTNET,
          });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        } else if (env == "prod" || env == "main") {
          keyPair = ECPair.makeRandom({ network: bitcoin.networks.bitcoin });
          address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: bitcoin });
          encryptedPrivateKey = encryptData(keyPair.toWIF());
        }
        let userWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: address.address,
          coinPrivateKey: encryptedPrivateKey,
          coinBalance: balance,
          coinLastUsed: new Date(),
          coinNetwork: "Bitcoin",
          coinName: "Bitcoin",
          coinSymbol: "BTC",
          coinDecimals: 8,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinPrice: 0,
          isCoinActive: true,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
        };
        let updateUser = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: userWallet } }
        );
        return { status: 200, data: address.address };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createBitcoinWalletForDexUser() {
    try {
      // let user = await uservice.findOneSelect({ email: email }, {});
      let TESTNET;
      let keyPair;
      let address;
      let privateKey;
      console.log(env);
      if (env == "development" || env == "test") {
        TESTNET = bitcoin.networks.testnet;
        keyPair = ECPair.makeRandom({ network: TESTNET });
        address = bitcoin.payments.p2pkh({
          pubkey: keyPair.publicKey,
          network: TESTNET,
        });
        privateKey = keyPair.toWIF();
      } else if (env == "prod" || env == "main") {
        keyPair = ECPair.makeRandom({ network: bitcoin.networks.mainnet });
        address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
        privateKey = keyPair.toWIF();
      }

      return {
        status: 200,
        data: {
          address: address.address,
          privateKey: privateKey,
        },
      };
    } catch (err) {
      console.log(err);
      return {
        status: 500,
        data: {
          address: "",
          privateKey: "",
        },
      };
    }
  }

  async createLitecoinWallet(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      if (!(env == "development" || env == "test")) {
        const ltcnet = {
          messagePrefix: "\x19Litecoin Signed Message:\n",
          bech32: "ltc",
          bip32: {
            public: 0x043587cf,
            private: 0x04358394,
          },
          pubKeyHash: 0x6f,
          scriptHash: 0xc4, //  for segwit (start with 2)
          wif: 0xef,
        };
        const keyPair = ECPair.makeRandom({ network: ltcnet });
        const { address } = bitcoin.payments.p2pkh({
          pubkey: keyPair.publicKey,
          network: ltcnet,
        });
        const encryptedPrivateKey = encryptData(keyPair.toWIF());
        console.log(address);
        return { status: 200, data: address };
      } else {
        const LITECOIN = {
          messagePrefix: "\x19Litecoin Signed Message:\n",
          bech32: "ltc",
          bip32: {
            public: 0x019da462,
            private: 0x019d9cfe,
          },
          pubKeyHash: 0x30,
          scriptHash: 0x32,
          wif: 0xb0,
        };

        const keyPair = ECPair.makeRandom({ network: LITECOIN });
        const { address } = bitcoin.payments.p2pkh({
          pubkey: keyPair.publicKey,
          network: LITECOIN,
        });
        return { status: 200, data: address };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createLitecoinWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        if (!(env == "development" || env == "test")) {
          const ltcnet = {
            messagePrefix: "\x19Litecoin Signed Message:\n",
            bech32: "ltc",
            bip32: {
              public: 0x043587cf,
              private: 0x04358394,
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4, //  for segwit (start with 2)
            wif: 0xef,
          };
          const keyPair = ECPair.makeRandom({ network: ltcnet });
          const { address } = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: ltcnet,
          });
          const encryptedPrivateKey = encryptData(keyPair.toWIF());
          console.log(address);
          return { status: 200, data: address };
        } else {
          const LITECOIN = {
            messagePrefix: "\x19Litecoin Signed Message:\n",
            bech32: "ltc",
            bip32: {
              public: 0x019da462,
              private: 0x019d9cfe,
            },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0,
          };

          const keyPair = ECPair.makeRandom({ network: LITECOIN });
          const { address } = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: LITECOIN,
          });
          return { status: 200, data: address };
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async createMaticWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Polygon",
          coinName: "Polygon",
          coinSymbol: "MATIC",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }

  async createMakerWalletForWalletUser(
    email: string,
    coin: string = "",
    balance: number = 0
  ) {
    try {
      let user = await wuserservice.findOneSelect(
        { email: email },
        this.userLiteFields
      );
      if (user) {
        let addressData = Wallet.generate();
        let encryptedPrivateKey = await encryptData(
          addressData.getPrivateKeyString()
        );
        let createUserWallet = {
          userId: user._id,
          coinType: CurrencyType.Crypto,
          coinWalletAddress: addressData.getAddressString(),
          coinPrivateKey: encryptedPrivateKey,
          coinNetwork: "Maker",
          coinName: "Maker",
          coinSymbol: "MKR",
          coinDecimals: 18,
          coinBalance: 0,
          coinBalanceInUSD: 0,
          coinBalanceInBTC: 0,
          coinCreatedOn: new Date(),
          coinLastUsedOn: new Date(),
          isCoinActive: true,
        };
        let wallet = await wuserservice.updatePart(
          { email: email },
          { $push: { userWallets: createUserWallet } }
        );

        return { status: 200, data: `${coin} Wallet Created` };
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
    }
  }
}
