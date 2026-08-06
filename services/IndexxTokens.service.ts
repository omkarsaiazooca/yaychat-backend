var Web3 = require("web3");
import axios from "axios";
import ECPairFactory from "ecpair";
import { ethers } from "ethers";
import * as ecc from "tiny-secp256k1";
import { keys } from "../config/keys";
import { CoreWallet } from "../data/coreWallet";
import { UserWallet } from "../data/user";
import { Indexx500tokenABI } from "../helpers/test_indexx500";
import { IndexxCryptotokenABI } from "../helpers/test_indexxcrypto";
import { IndexxStockTokenAPI as IndexxStockTokenABI } from "../helpers/test_indexxstocktoken";
import { IndexxExtokenABI } from "../helpers/test_indexxexchange";
import { testIndexxPhoenixABI } from "../helpers/test_IndexxPhoenix";
import { IndexxUSDPtokenABI } from "../helpers/test_indexxusdp";
import { testSoRekttokenABI } from "../helpers/test_sorekt";
import { TransactionService } from "../services/transaction.service";
import { CoreWalletService } from "./coreWallet.service";
import { decryptData } from "./crypto.service";
import { UserService } from "./user.service";
import * as jsonData from "../contractData/contractsAddress.json";
import Binance from "node-binance-api";
import bitcoinBlack from "../contractData/BitcoinBlackXNFT.json";
import bitcoinGreen from "../contractData/BitcoinGreenXNFT.json";
import bitcoinPink from "../contractData/BitcoinPinkXNFT.json";
import bitcoinPurple from "../contractData/BitcoinPurpleXNFT.json";
import bitcoinOrange from "../contractData/BitcoinOrangeXNFT.json";
import bitcoinBlue from "../contractData/BitcoinBlueXNFT.json";
import ethereumBlack from "../contractData/EthereumBlackXNFT.json";
import ethereumGreen from "../contractData/EthereumGreenXNFT.json";
import ethereumPink from "../contractData/EthereumPinkXNFT.json";
import ethereumPurple from "../contractData/EthereumPurpleXNFT.json";
import ethereumOrange from "../contractData/EthereumOrangeXNFT.json";
import ethereumBlue from "../contractData/EthereumBlueXNFT.json";
import e_bitcoinBlack from "../contractData/e_BitcoinBlackXNFT.json";
import e_bitcoinGreen from "../contractData/e_BitcoinGreenXNFT.json";
import e_bitcoinPink from "../contractData/e_BitcoinPinkXNFT.json";
import e_bitcoinPurple from "../contractData/e_BitcoinPurpleXNFT.json";
import e_bitcoinOrange from "../contractData/e_BitcoinOrangeXNFT.json";
import e_bitcoinBlue from "../contractData/e_BitcoinBlueXNFT.json";
import e_ethereumBlack from "../contractData/e_EthereumBlackXNFT.json";
import e_ethereumGreen from "../contractData/e_EthereumGreenXNFT.json";
import e_ethereumPink from "../contractData/e_EthereumPinkXNFT.json";
import e_ethereumPurple from "../contractData/e_EthereumPurpleXNFT.json";
import e_ethereumOrange from "../contractData/e_EthereumOrangeXNFT.json";
import e_ethereumBlue from "../contractData/e_EthereumBlueXNFT.json";
import usdNFT from "../contractData/XUSDNFT.json";
import e_usdNFT from "../contractData/e_XUSDNFT.json";
import { CurrencyService } from "./currency.service";
import { PriceTicker } from "../data/priceTicker";
import { WalletUserService } from "./walletUser.service";
import { testWIBSTokenAbi } from "../helpers/test_wibs";

const bitcoin = require("bitcoinjs-lib");
let wservice: WalletUserService = new WalletUserService();
let coreWalletService: CoreWalletService = new CoreWalletService();
let txService: TransactionService = new TransactionService();
const currencyService: CurrencyService = new CurrencyService();
const binance = new Binance().options({
  APIKEY: keys.BinanceKey.key,
  APISECRET: keys.BinanceSecret.key,
  family: 4,
});
export class IndexxService {
  constructor() {}

  async transferIndexx500(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        console.log(keys.env.key);
        const rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.BSC_RPC_TEST.key
            : keys.BSC_RPC_MAIN.key;

        console.log(rpcURL);
        var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexx500Contract = new web3.eth.Contract(
          Indexx500tokenABI,
          keys.TestIndexx500Contract.key
        );
        const tokenBalance = await indexx500Contract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();
        console.log("userAddress", userWallet.coinWalletAddress);
        console.log("privateKey", privateKey);
        console.log("walletBalance", tokenBalance);
        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));
        console.log("walletBalance", balanceInEth);
        console.log("ikey", keys.IndexxTestKey.key);
        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexx500Contract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);

            let indexx500 = await indexx500Contract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexx500.status) {
              return indexx500;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexxCrypto(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.BSC_RPC_TEST.key
          : keys.BSC_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexxCryptoContract = new web3.eth.Contract(
          IndexxCryptotokenABI,
          keys.TestIndexxCryptoContract.key
        );
        const tokenBalance = await indexxCryptoContract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();
        console.log("userAddress", userWallet.coinWalletAddress);
        console.log("privateKey", privateKey);
        console.log("walletBalance", tokenBalance);
        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));
        console.log("walletBalance", balanceInEth);
        console.log("ikey", keys.IndexxTestKey.key);
        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexxCryptoContract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);

            let indexxCrypto = await indexxCryptoContract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexxCrypto.status) {
              return indexxCrypto;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexxUSDP(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.BSC_RPC_TEST.key
          : keys.BSC_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexx500Contract = new web3.eth.Contract(
          IndexxUSDPtokenABI,
          keys.TestIndexxUSDPContract.key
        );
        const tokenBalance = await indexx500Contract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();
        console.log("userAddress", userWallet.coinWalletAddress);
        console.log("privateKey", privateKey);
        console.log("walletBalance", tokenBalance);
        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));
        console.log("walletBalance", balanceInEth);
        console.log("ikey", keys.IndexxTestKey.key);
        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexx500Contract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);

            let indexx500 = await indexx500Contract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexx500.status) {
              return indexx500;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexxExchange(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.BSC_RPC_TEST.key
          : keys.BSC_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexx500Contract = new web3.eth.Contract(
          IndexxExtokenABI,
          keys.TestIndexxExContract.key
        );
        const tokenBalance = await indexx500Contract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();

        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));

        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexx500Contract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);
            let indexx500 = await indexx500Contract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexx500.status) {
              return indexx500;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexx500OnETH(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        console.log(keys.env.key);
        const rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.ETH_RPC_TEST.key
            : keys.ETH_RPC_MAIN.key;

        console.log(rpcURL);
        var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexx500Contract = new web3.eth.Contract(
          Indexx500tokenABI,
          keys.TestETHIndexx500Contract.key
        );
        const isProd = (env: any) => env === "prod";
        const isTestOrDev = (env: any) => ["test", "development"].includes(env);

        if (isProd(keys.env.key) || isProd(keys.dex_env.key)) {
          indexx500Contract = new web3.eth.Contract(
            Indexx500tokenABI,
            keys.MainETHIndexx500Contract.key
          );
        } else if (isTestOrDev(keys.env.key) || isTestOrDev(keys.dex_env.key)) {
          indexx500Contract = new web3.eth.Contract(
            Indexx500tokenABI,
            keys.TestETHIndexx500Contract.key
          );
        }

        const tokenBalance = await indexx500Contract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();
        console.log("userAddress", userWallet.coinWalletAddress);
        console.log("privateKey", privateKey);
        console.log("walletBalance", tokenBalance);
        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));
        console.log("walletBalance", balanceInEth);
        console.log("ikey", keys.IndexxTestKey.key);
        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexx500Contract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);

            let indexx500 = await indexx500Contract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexx500.status) {
              return indexx500;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexxCryptoOnETH(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.ETH_RPC_TEST.key
          : keys.ETH_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexxCryptoContract = new web3.eth.Contract(
          IndexxCryptotokenABI,
          keys.TestETHIndexxCryptoContract.key
        );
        const isProd = (env: any) => env === "prod";
        const isTestOrDev = (env: any) => ["test", "development"].includes(env);

        if (isProd(keys.env.key) || isProd(keys.dex_env.key)) {
          indexxCryptoContract = new web3.eth.Contract(
            IndexxCryptotokenABI,
            keys.MainETHIndexxCryptoContract.key
          );
        } else if (isTestOrDev(keys.env.key) || isTestOrDev(keys.dex_env.key)) {
          indexxCryptoContract = new web3.eth.Contract(
            IndexxCryptotokenABI,
            keys.TestETHIndexxCryptoContract.key
          );
        }
        const tokenBalance = await indexxCryptoContract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();
        console.log("userAddress", userWallet.coinWalletAddress);
        console.log("privateKey", privateKey);
        console.log("walletBalance", tokenBalance);
        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));
        console.log("walletBalance", balanceInEth);
        console.log("ikey", keys.IndexxTestKey.key);
        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexxCryptoContract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);

            let indexxCrypto = await indexxCryptoContract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexxCrypto.status) {
              return indexxCrypto;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexxUSDPOnETH(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.ETH_RPC_TEST.key
          : keys.ETH_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexxUSDPContract = new web3.eth.Contract(
          IndexxUSDPtokenABI,
          keys.TestETHIndexxUSDPContract.key
        );

        const isProd = (env: any) => env === "prod";
        const isTestOrDev = (env: any) => ["test", "development"].includes(env);

        if (isProd(keys.env.key) || isProd(keys.dex_env.key)) {
          indexxUSDPContract = new web3.eth.Contract(
            IndexxUSDPtokenABI,
            keys.MainETHIndexxUSDPContract.key
          );
        } else if (isTestOrDev(keys.env.key) || isTestOrDev(keys.dex_env.key)) {
          indexxUSDPContract = new web3.eth.Contract(
            IndexxUSDPtokenABI,
            keys.TestETHIndexxUSDPContract.key
          );
        }

        const tokenBalance = await indexxUSDPContract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();
        console.log("userAddress", userWallet.coinWalletAddress);
        console.log("privateKey", privateKey);
        console.log("walletBalance", tokenBalance);
        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));
        console.log("walletBalance", balanceInEth);
        console.log("ikey", keys.IndexxTestKey.key);
        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexxUSDPContract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);

            let indexx500 = await indexxUSDPContract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexx500.status) {
              return indexx500;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async transferIndexxExchangeOnETH(
    amount: number,
    address: string,
    email: string,
    coin: string
  ) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.ETH_RPC_TEST.key
          : keys.ETH_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let user = await wservice.findOneSelect({ email: email }, {});
      if (user) {
        let userWallet = user.userWallets.find(
          (w) => w.coinSymbol == coin
        ) as UserWallet;
        console.log("rpcURL", rpcURL);
        const privateKey = await decryptData(userWallet.coinPrivateKey);
        web3.eth.accounts.wallet.add(privateKey);
        let indexxExContract = new web3.eth.Contract(
          IndexxExtokenABI,
          keys.TestETHIndexxExContract.key
        );

        const isProd = (env: any) => env === "prod";
        const isTestOrDev = (env: any) => ["test", "development"].includes(env);

        if (isProd(keys.env.key) || isProd(keys.dex_env.key)) {
          indexxExContract = new web3.eth.Contract(
            IndexxExtokenABI,
            keys.MainETHIndexxExContract.key
          );
        } else if (isTestOrDev(keys.env.key) || isTestOrDev(keys.dex_env.key)) {
          indexxExContract = new web3.eth.Contract(
            IndexxExtokenABI,
            keys.TestETHIndexxExContract.key
          );
        }
        const tokenBalance = await indexxExContract.methods
          .balanceOf(userWallet.coinWalletAddress)
          .call();

        const balanceInEth = Number(ethers.utils.formatEther(tokenBalance));

        const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
        const basicWalletBal = await this.walletBalance(
          signerObj.address,
          privateKey
        );
        let getCoreWalletDetails: CoreWallet = await this.getCoreWalletDetails(
          coin
        );
        if (getCoreWalletDetails.coinBalance < 0.1) {
        } else {
          let gasEstimate = await indexxExContract.methods
            .transfer(address, web3.utils.toWei(String(amount), "ether"))
            .estimateGas({ from: signerObj.address });
          if (basicWalletBal < gasEstimate) {
            await this.sendCoinForGasFee(
              signerObj.address,
              getCoreWalletDetails.coinPrivateKey,
              gasEstimate
            );
          }
          if (balanceInEth < amount) {
            return {
              status: 500,
              data: "Insufficient Balance",
            };
          } else {
            let parameter = {
              from: signerObj.address,
              gas: gasEstimate,
            };
            web3.eth.accounts.wallet.add(privateKey);
            let indexx500 = await indexxExContract.methods
              .transfer(address, web3.utils.toWei(String(amount), "ether"))
              .send(parameter);

            if (indexx500.status) {
              return indexx500;
            } else {
              return false;
            }
          }
        }
      } else {
        return { status: 500, data: "User not found" };
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  //Helpers
  async walletBalance(address: string, privateKey: string) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.BSC_RPC_TEST.key
          : keys.BSC_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
      const walletBalance = await rpcProvider.getBalance(address);
      let wallet = new ethers.Wallet(privateKey, rpcProvider);
      const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
      console.log("walletBalance", balanceInEth);
      return balanceInEth;
    } catch (err) {
      return false;
    }
  }

  async sendCoinForGasFee(address: string, privateKey: string, amount: number) {
    try {
      console.log(keys.env.key);
      const rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.BSC_RPC_TEST.key
          : keys.BSC_RPC_MAIN.key;

      console.log(rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
      let wallet = new ethers.Wallet(privateKey, rpcProvider);
      let transaction = await wallet.sendTransaction({
        to: address,
        value: ethers.utils.parseEther(String(amount)),
      });
      return transaction;
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  //This method is used for getting the core wallet details for a specific coin
  async getCoreWalletDetails(coin: string, coinNetwork: string = "") {
    try {
      if (coinNetwork) {
        let coreWallet = await coreWalletService.findOneSelect(
          { coin: coin, coinNetwork: coinNetwork },
          {}
        );
        if (coreWallet) {
          return coreWallet;
        } else {
          return {} as CoreWallet;
        }
      } else {
        let coreWallet = await coreWalletService.findOneSelect(
          { coin: coin },
          {}
        );
        if (coreWallet) {
          return coreWallet;
        } else {
          return {} as CoreWallet;
        }
      }
    } catch (err) {
      return {} as CoreWallet;
    }
  }

  async transferIndexx500byAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainIndexx500Contract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestIndexx500Contract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainIndexx500Contract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestIndexx500Contract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      const getCoreWalletDetails = await this.getCoreWalletDetails("IN500");
      let privateKey;

      if (exchangeName == "CEX") {
        if (keys.env.key === "development") {
          privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
        } else {
          privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
        }
      } else {
        privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
      }
      /*
      let indexx500Contract = new web3.eth.Contract(
        Indexx500tokenABI,
        contractAddress
      );
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexx500 = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

*/
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        String(contractAddress),
        Indexx500tokenABI,
        wallet
      );
      let tx = await contract.mint(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );
      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexx500 = await provider.getTransactionReceipt(tx.hash);
      if (indexx500.status) {
        return { status: 200, data: indexx500 as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferWIBSbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainWIBSContract.key;
        rpcURL = keys.ETH_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestWIBSContract.key;
        rpcURL = keys.ETH_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainWIBSContract.key;
        rpcURL = keys.ETH_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestWIBSContract.key;
        rpcURL = keys.ETH_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);

      let privateKey = keys.WIBS_PERSONAL_WALLET_PRIVATE.key;
   
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        String(contractAddress),
        testWIBSTokenAbi,
        wallet
      );

      // Perform the transfer
      let tx = await contract.transferFromContract(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );

      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexx500 = await provider.getTransactionReceipt(tx.hash);
      if (indexx500.status) {
        return { status: 200, data: indexx500 as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferIndexxPhoenixbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainIndexxPhoenixContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestIndexxPhoenixContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainIndexxPhoenixContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestIndexxPhoenixContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let indexx500Contract = new web3.eth.Contract(
        testIndexxPhoenixABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("INXP");
      let privateKey;
      if (exchangeName == "CEX") {
        if (keys.env.key === "development") {
          privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
        } else {
          privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
        }
      } else {
        privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      }
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexx500 = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (indexx500.status) {
        return { status: 200, data: indexx500 as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferIndexxCryptobyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      let rpcURL;

      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainIndexxCryptoContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestIndexxCryptoContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainIndexxCryptoContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestIndexxCryptoContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let indexxCryptoContract = new web3.eth.Contract(
        IndexxCryptotokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("INXC");
      let privateKey;
      if (exchangeName == "CEX") {
        if (keys.env.key === "development") {
          privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
        } else {
          privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
        }
      } else {
        if (keys.dex_env.key === "development") {
          privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
        } else {
          privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
        }
      }
      console.log(getCoreWalletDetails);

      /*const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexxCryptoContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxCryto = await indexxCryptoContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);
*/
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        String(contractAddress),
        IndexxCryptotokenABI,
        wallet
      );
      let tx = await contract.mint(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );
      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexxCryto = await provider.getTransactionReceipt(tx.hash);
      if (indexxCryto.status) {
        return { status: 200, data: indexxCryto as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferIndexxUSDPbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName: string = "CEX"
  ) {
    try {
      let rpcURL;

      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainIndexxUSDPContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestIndexxUSDPContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainIndexxUSDPContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestIndexxUSDPContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let indexxUSDPContract = new web3.eth.Contract(
        IndexxUSDPtokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("IUSD+");
      let privateKey;
      if (exchangeName == "CEX") {
        if (keys.env.key === "development") {
          privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
        } else {
          privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
        }
      } else {
        privateKey = keys.PERSONAL_WALLET_PRIVATE.key;
      }
      /*
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexxUSDPContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);

      let indexxUSDP = await indexxUSDPContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);
*/
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        String(contractAddress),
        IndexxUSDPtokenABI,
        wallet
      );
      let tx = await contract.mint(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );
      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexxUSDP = await provider.getTransactionReceipt(tx.hash);
      if (indexxUSDP.status) {
        return { status: 200, data: indexxUSDP as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferIndexxExchangebyAdmin(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "CEX"
  ) {
    try {
      let rpcURL;

      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainIndexxExContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestIndexxExContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainIndexxExContract.key;
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestIndexxExContract.key;
        rpcURL = keys.BSC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      console.log("contractAddress", contractAddress, exchangeName);
      const getCoreWalletDetails = await this.getCoreWalletDetails("INEX");
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      /*
      let indexxExContract = new web3.eth.Contract(
        IndexxExtokenABI,
        contractAddress
      );
      
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      let gasEstimate = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxEx = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter); */
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        String(contractAddress),
        IndexxExtokenABI,
        wallet
      );
      let tx = await contract.mint(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );
      //await contract.mint(toAddress, ethers.utils.parseUnits(String(amount), 18));
      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexxEx = await provider.getTransactionReceipt(tx.hash);
      console.log("indexxEx", indexxEx);
      if (type === "Withdraw_Rewards") {
        await this.transactionCreation(
          tx,
          email,
          type,
          "INEX",
          amount,
          info,
          "Self withdrawal wallet"
        );
      }
      if (indexxEx.status) {
        return { status: 200, data: indexxEx as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferPolygonIndexxExchangebyAdmin(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "CEX"
  ) {
    try {
      let rpcURL;

      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainMaticIndexxExContract.key;
        rpcURL = keys.MATIC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestMaticIndexxExContract.key;
        rpcURL = keys.MATIC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainMaticIndexxExContract.key;
        rpcURL = keys.MATIC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestMaticIndexxExContract.key;
        rpcURL = keys.MATIC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      console.log("contractAddress", contractAddress, exchangeName);
      const getCoreWalletDetails = await this.getCoreWalletDetails(
        "INEX",
        "Polygon"
      );
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      /*
      let indexxExContract = new web3.eth.Contract(
        IndexxExtokenABI,
        contractAddress
      );
      
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      let gasEstimate = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxEx = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter); */
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        String(contractAddress),
        IndexxExtokenABI,
        wallet
      );
      let tx = await contract.mint(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );
      //await contract.mint(toAddress, ethers.utils.parseUnits(String(amount), 18));
      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexxEx = await provider.getTransactionReceipt(tx.hash);
      console.log("indexxEx", indexxEx);
      if (type === "Withdraw_Rewards") {
        await this.transactionCreation(
          tx,
          email,
          type,
          "INEX",
          amount,
          info,
          "Self withdrawal wallet"
        );
      }
      if (indexxEx.status) {
        return { status: 200, data: indexxEx as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferTestIndexxExchangebyAdmimForGiftCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = ""
  ) {
    try {
      let rpcURL;

      let contractAddress;

      contractAddress = keys.MainMaticIndexxExContract.key;
      rpcURL = keys.MATIC_RPC_MAIN.key;
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      console.log("contractAddress", contractAddress, exchangeName);
      let indexxExContract = new web3.eth.Contract(
        IndexxExtokenABI,
        contractAddress
      );
      const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      let gasEstimate = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxEx = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);
      console.log(indexxEx);
      if (type === "Withdraw_Rewards") {
        await this.transactionCreationForGiftCard(
          indexxEx,
          email, //email considered a giftcard code for giftcard claim
          type,
          "INEX",
          amount,
          info,
          "Gift card redeem withdrawal to wallet"
        );
      }
      if (indexxEx.status) {
        return { status: 200, data: indexxEx as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferMainIndexxExchangebyAdmimForGiftCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = ""
  ) {
    try {
      let rpcURL;

      let contractAddress;

      contractAddress = keys.MainMaticIndexxExContract.key;
      rpcURL = keys.MATIC_RPC_MAIN.key;
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      console.log("contractAddress", contractAddress, exchangeName);
      let indexxExContract = new web3.eth.Contract(
        IndexxExtokenABI,
        contractAddress
      );
      const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      const currentGasPrice = await web3.eth.getGasPrice(); // fetch the current gas price
      const increaseFactor = 200; // representing 120% or an increase of 20%
      const adjustedGasPrice = web3.utils
        .toBN(currentGasPrice)
        .mul(web3.utils.toBN(increaseFactor))
        .div(web3.utils.toBN(100)); // multiply by 120 and then divide by 100

      let gasEstimate = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
        gasPrice: adjustedGasPrice.toString(), // use the adjusted gas price
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxEx = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);
      console.log(indexxEx);
      if (type === "Withdraw_Rewards") {
        await this.transactionCreationForGiftCard(
          indexxEx,
          email, //email considered a giftcard code for giftcard claim
          type,
          "INEX",
          amount,
          info,
          "Gift card redeem withdrawal to wallet"
        );
      }
      if (indexxEx.status) {
        return { status: 200, data: indexxEx as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferMainMaticBTCXNFTbyAdmimForGiftCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "",
    SelectedGiftCardOptions: any
  ) {
    try {
      let contracts = [
        {
          address: jsonData.bitcoinBlack,
          abi: bitcoinBlack.abi,
          value: 1,
        },
        {
          address: jsonData.bitcoinBlue,
          abi: bitcoinBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.bitcoinGreen,
          abi: bitcoinGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.bitcoinPurple,
          abi: bitcoinPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.bitcoinPink,
          abi: bitcoinPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.bitcoinOrange,
          abi: bitcoinOrange.abi,
          value: 0.001,
        },
      ];
      console.log(
        "SelectedGiftCardOptions in indexxtokenservice",
        SelectedGiftCardOptions,
        SelectedGiftCardOptions.redeemOptions.length
      );
      let txHashs: any[] = [];
      for (let i = 0; i < SelectedGiftCardOptions.redeemOptions.length; i++) {
        console.log("start", i);
        if (SelectedGiftCardOptions.redeemOptions[i].quantity === 0) {
          continue;
        } else {
          console.log(
            "SelectedGiftCardOptions.redeemOptions[i]",
            SelectedGiftCardOptions.redeemOptions[i],
            i
          );
          const element = contracts.find(
            (x) =>
              x.value === SelectedGiftCardOptions.redeemOptions[i].item.value
          );
          let totalQuanity = SelectedGiftCardOptions.redeemOptions[i].quantity;
          let res = await this.getCurrentMintNumberByAddress(
            element?.address,
            element?.abi,
            "BTC",
            "Polygon",
            totalQuanity
          );

          let rpcURL = keys.MATIC_RPC_MAIN.key;
          console.log(
            "contractAddress",
            element?.address,
            exchangeName,
            rpcURL,
            res?.tokenUriS
          );
          var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

          console.log("contractAddress", element?.address, exchangeName);
          let xnftContract = new web3.eth.Contract(
            element?.abi,
            element?.address
          );
          const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
          const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
          const currentGasPrice = await web3.eth.getGasPrice(); // fetch the current gas price
          const increaseFactor = 200; // representing 120% or an increase of 20%
          const adjustedGasPrice = web3.utils
            .toBN(currentGasPrice)
            .mul(web3.utils.toBN(increaseFactor))
            .div(web3.utils.toBN(100)); // multiply by 120 and then divide by 100
          let gasEstimate = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .estimateGas({ from: signerObj.address });
          let parameter = {
            from: signerObj.address,
            gas: gasEstimate,
            gasPrice: adjustedGasPrice.toString(), // use the adjusted gas price
          };
          web3.eth.accounts.wallet.add(privateKey);
          let indexxEx = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .send(parameter);
          await this.transactionCreationForGiftCard(
            indexxEx,
            email, //email considered a giftcard code for giftcard claim
            type,
            "XNFT token",
            amount,
            info,
            "Gift card redeem withdrawal to wallet"
          );
          if (indexxEx.status) {
            //return { status: 200, data: indexxEx as any };
            txHashs.push(indexxEx);
            console.log("current i ", i);
          } else {
            return { status: 500, data: "Failed to transfer" as any };
          }
        }
      }
      console.log("return", txHashs);
      return { status: 200, data: txHashs };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferMainMaticETHXNFTbyAdmimForGiftCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "",
    SelectedGiftCardOptions: any
  ) {
    try {
      let contracts = [
        {
          address: jsonData.ethereumBlack,
          abi: ethereumBlack.abi,
          value: 1,
        },
        {
          address: jsonData.ethereumBlue,
          abi: ethereumBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.ethereumGreen,
          abi: ethereumGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.ethereumPurple,
          abi: ethereumPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.ethereumPink,
          abi: ethereumPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.ethereumOrange,
          abi: ethereumOrange.abi,
          value: 0.001,
        },
      ];

      console.log(
        "SelectedGiftCardOptions in indexxtokenservice",
        SelectedGiftCardOptions
      );
      let txHashs: any[] = [];

      for (let i = 0; i < SelectedGiftCardOptions.redeemOptions.length; i++) {
        if (SelectedGiftCardOptions.redeemOptions[i].quantity === 0) {
          continue;
        } else {
          console.log(
            "SelectedGiftCardOptions.redeemOptions[i]",
            SelectedGiftCardOptions.redeemOptions[i],
            i
          );
          const element = contracts.find(
            (x) =>
              x.value === SelectedGiftCardOptions.redeemOptions[i].item.value
          );
          let totalQuanity = SelectedGiftCardOptions.redeemOptions[i].quantity;
          let res = await this.getCurrentMintNumberByAddress(
            element?.address,
            element?.abi,
            "ETH",
            "Polygon",
            totalQuanity
          );

          let rpcURL = keys.MATIC_RPC_MAIN.key;
          console.log(
            "contractAddress",
            element?.address,
            exchangeName,
            rpcURL,
            res?.tokenUriS
          );
          var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

          console.log("contractAddress", element?.address, exchangeName);
          let xnftContract = new web3.eth.Contract(
            element?.abi,
            element?.address
          );
          const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
          const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
          const currentGasPrice = await web3.eth.getGasPrice(); // fetch the current gas price
          const increaseFactor = 200; // representing 120% or an increase of 20%
          const adjustedGasPrice = web3.utils
            .toBN(currentGasPrice)
            .mul(web3.utils.toBN(increaseFactor))
            .div(web3.utils.toBN(100)); // multiply by 120 and then divide by 100
          let gasEstimate = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .estimateGas({ from: signerObj.address });
          let parameter = {
            from: signerObj.address,
            gas: gasEstimate,
            gasPrice: adjustedGasPrice.toString(), // use the adjusted gas price
          };
          web3.eth.accounts.wallet.add(privateKey);
          let indexxEx = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .send(parameter);
          console.log(indexxEx);
          await this.transactionCreationForGiftCard(
            indexxEx,
            email, //email considered a giftcard code for giftcard claim
            type,
            "INEX",
            amount,
            info,
            "Gift card redeem withdrawal to wallet"
          );
          if (indexxEx.status) {
            //return { status: 200, data: indexxEx as any };
            txHashs.push(indexxEx);
          } else {
            return { status: 500, data: "Failed to transfer" as any };
          }
        }
      }
      return { status: 200, data: txHashs };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferMainMaticXUSDNFTbyAdmimForGiftCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "",
    SelectedGiftCardOptions: any
  ) {
    try {
      let contracts = [
        {
          address: jsonData.XUSDNFT,
          abi: usdNFT.abi,
          value: 1,
        },
      ];
      console.log(
        "SelectedGiftCardOptions in indexxtokenservice",
        SelectedGiftCardOptions,
        SelectedGiftCardOptions.redeemOptions.length
      );
      let txHashs: any[] = [];
      for (let i = 0; i < SelectedGiftCardOptions.redeemOptions.length; i++) {
        console.log("start", i);
        if (SelectedGiftCardOptions.redeemOptions[i].quantity === 0) {
          continue;
        } else {
          console.log(
            "SelectedGiftCardOptions.redeemOptions[i]",
            SelectedGiftCardOptions.redeemOptions[i],
            i
          );
          const element = contracts.find(
            (x) =>
              x.value === SelectedGiftCardOptions.redeemOptions[i].item.value
          );
          let totalQuanity = SelectedGiftCardOptions.redeemOptions[i].quantity;
          let res = await this.getCurrentMintNumberByAddress(
            element?.address,
            element?.abi,
            "XUSD",
            "Polygon",
            totalQuanity
          );

          let rpcURL = keys.MATIC_RPC_MAIN.key;
          console.log(
            "contractAddress",
            element?.address,
            exchangeName,
            rpcURL,
            res?.tokenUriS
          );
          var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

          console.log("contractAddress", element?.address, exchangeName);
          let xnftContract = new web3.eth.Contract(
            element?.abi,
            element?.address
          );
          const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
          const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
          const currentGasPrice = await web3.eth.getGasPrice(); // fetch the current gas price
          const increaseFactor = 200; // representing 120% or an increase of 20%
          const adjustedGasPrice = web3.utils
            .toBN(currentGasPrice)
            .mul(web3.utils.toBN(increaseFactor))
            .div(web3.utils.toBN(100)); // multiply by 120 and then divide by 100
          let gasEstimate = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .estimateGas({ from: signerObj.address });
          let parameter = {
            from: signerObj.address,
            gas: gasEstimate,
            gasPrice: adjustedGasPrice.toString(), // use the adjusted gas price
          };
          web3.eth.accounts.wallet.add(privateKey);
          let indexxEx = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .send(parameter);
          await this.transactionCreationForGiftCard(
            indexxEx,
            email, //email considered a giftcard code for giftcard claim
            type,
            "XNFT token",
            amount,
            info,
            "Gift card redeem withdrawal to wallet"
          );
          if (indexxEx.status) {
            //return { status: 200, data: indexxEx as any };
            txHashs.push(indexxEx);
            console.log("current i ", i);
          } else {
            return { status: 500, data: "Failed to transfer" as any };
          }
        }
      }
      console.log("return", txHashs);
      return { status: 200, data: txHashs };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferMainMaticBTCXNFTbyAdmimForXNFTCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "",
    SelectedGiftCardOptions: any
  ) {
    try {
      let contracts = [
        {
          address: jsonData.bitcoinBlack,
          abi: bitcoinBlack.abi,
          value: 1,
        },
        {
          address: jsonData.bitcoinBlue,
          abi: bitcoinBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.bitcoinGreen,
          abi: bitcoinGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.bitcoinPurple,
          abi: bitcoinPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.bitcoinPink,
          abi: bitcoinPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.bitcoinOrange,
          abi: bitcoinOrange.abi,
          value: 0.001,
        },
      ];
      console.log(
        "SelectedGiftCardOptions in indexxtokenservice",
        SelectedGiftCardOptions,
        SelectedGiftCardOptions.redeemOptions.length
      );
      let txHashs: any[] = [];
      for (let i = 0; i < SelectedGiftCardOptions.redeemOptions.length; i++) {
        console.log("start", i);
        if (SelectedGiftCardOptions.redeemOptions[i].quantity === 0) {
          continue;
        } else {
          console.log(
            "SelectedGiftCardOptions.redeemOptions[i]",
            SelectedGiftCardOptions.redeemOptions[i],
            i
          );
          const element = contracts.find(
            (x) =>
              x.value === SelectedGiftCardOptions.redeemOptions[i].item.value
          );
          let totalQuanity = SelectedGiftCardOptions.redeemOptions[i].quantity;
          let res = await this.getCurrentMintNumberByAddress(
            element?.address,
            element?.abi,
            "BTC",
            "Polygon",
            totalQuanity
          );

          let rpcURL = keys.MATIC_RPC_MAIN.key;
          console.log(
            "contractAddress",
            element?.address,
            exchangeName,
            rpcURL,
            res?.tokenUriS
          );
          var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

          console.log("contractAddress", element?.address, exchangeName);
          let xnftContract = new web3.eth.Contract(
            element?.abi,
            element?.address
          );
          const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
          const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
          const currentGasPrice = await web3.eth.getGasPrice(); // fetch the current gas price
          const increaseFactor = 200; // representing 120% or an increase of 20%
          const adjustedGasPrice = web3.utils
            .toBN(currentGasPrice)
            .mul(web3.utils.toBN(increaseFactor))
            .div(web3.utils.toBN(100)); // multiply by 120 and then divide by 100
          let gasEstimate = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .estimateGas({ from: signerObj.address });
          let parameter = {
            from: signerObj.address,
            gas: gasEstimate,
            gasPrice: adjustedGasPrice.toString(), // use the adjusted gas price
          };
          web3.eth.accounts.wallet.add(privateKey);
          let indexxEx = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .send(parameter);
          await this.transactionCreationForGiftCard(
            indexxEx,
            email, //email considered a giftcard code for giftcard claim
            type,
            "XNFT token",
            amount,
            info,
            "Gift card redeem withdrawal to wallet"
          );
          if (indexxEx.status) {
            //return { status: 200, data: indexxEx as any };
            txHashs.push(indexxEx);
            console.log("current i ", i);
          } else {
            return { status: 500, data: "Failed to transfer" as any };
          }
        }
      }
      console.log("return", txHashs);
      return { status: 200, data: txHashs };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferMainMaticETHXNFTbyAdmimForXNFTCard(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "",
    SelectedGiftCardOptions: any
  ) {
    try {
      let contracts = [
        {
          address: jsonData.ethereumBlack,
          abi: ethereumBlack.abi,
          value: 1,
        },
        {
          address: jsonData.ethereumBlue,
          abi: ethereumBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.ethereumGreen,
          abi: ethereumGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.ethereumPurple,
          abi: ethereumPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.ethereumPink,
          abi: ethereumPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.ethereumOrange,
          abi: ethereumOrange.abi,
          value: 0.001,
        },
      ];

      console.log(
        "SelectedGiftCardOptions in indexxtokenservice",
        SelectedGiftCardOptions
      );
      let txHashs: any[] = [];

      for (let i = 0; i < SelectedGiftCardOptions.redeemOptions.length; i++) {
        if (SelectedGiftCardOptions.redeemOptions[i].quantity === 0) {
          continue;
        } else {
          console.log(
            "SelectedGiftCardOptions.redeemOptions[i]",
            SelectedGiftCardOptions.redeemOptions[i],
            i
          );
          const element = contracts.find(
            (x) =>
              x.value === SelectedGiftCardOptions.redeemOptions[i].item.value
          );
          let totalQuanity = SelectedGiftCardOptions.redeemOptions[i].quantity;
          let res = await this.getCurrentMintNumberByAddress(
            element?.address,
            element?.abi,
            "ETH",
            "Polygon",
            totalQuanity
          );

          let rpcURL = keys.MATIC_RPC_MAIN.key;
          console.log(
            "contractAddress",
            element?.address,
            exchangeName,
            rpcURL,
            res?.tokenUriS
          );
          var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

          console.log("contractAddress", element?.address, exchangeName);
          let xnftContract = new web3.eth.Contract(
            element?.abi,
            element?.address
          );
          const privateKey = keys.PERSONAL_MATIC_WALLET_PRIVATE.key;
          const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
          const currentGasPrice = await web3.eth.getGasPrice(); // fetch the current gas price
          const increaseFactor = 200; // representing 120% or an increase of 20%
          const adjustedGasPrice = web3.utils
            .toBN(currentGasPrice)
            .mul(web3.utils.toBN(increaseFactor))
            .div(web3.utils.toBN(100)); // multiply by 120 and then divide by 100
          let gasEstimate = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .estimateGas({ from: signerObj.address });
          let parameter = {
            from: signerObj.address,
            gas: gasEstimate,
            gasPrice: adjustedGasPrice.toString(), // use the adjusted gas price
          };
          web3.eth.accounts.wallet.add(privateKey);
          let indexxEx = await xnftContract.methods
            .mintForAddressCompany(toAddress, res?.tokenUriS)
            .send(parameter);
          console.log(indexxEx);
          await this.transactionCreationForGiftCard(
            indexxEx,
            email, //email considered a giftcard code for giftcard claim
            type,
            "INEX",
            amount,
            info,
            "Gift card redeem withdrawal to wallet"
          );
          if (indexxEx.status) {
            //return { status: 200, data: indexxEx as any };
            txHashs.push(indexxEx);
          } else {
            return { status: 500, data: "Failed to transfer" as any };
          }
        }
      }
      return { status: 200, data: txHashs };
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }
  
  async transferIndexxStockbyAdminBNBChain(
    toAddress: string,
    amount: number,
    exchangeName = "CEX",
    contractAddress: string
  ) {
    try {
      let rpcURL;

      if (exchangeName == "CEX" && keys.env.key == "prod") {
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        rpcURL = keys.BSC_RPC_TEST.key;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        rpcURL = keys.BSC_RPC_MAIN.key;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        rpcURL = keys.BSC_RPC_TEST.key;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      let privateKey;
      if (exchangeName == "CEX") {
        if (keys.env.key === "development") {
          privateKey = keys.PERSONAL_STOCK_WALLET_PRIVATE.key;
        } else {
          privateKey = keys.PERSONAL_STOCK_MAIN_WALLET_PRIVATE.key;
        }
      } else {
        if (keys.dex_env.key === "development") {
          privateKey = keys.PERSONAL_STOCK_WALLET_PRIVATE.key;
        } else {
          privateKey = keys.PERSONAL_STOCK_MAIN_WALLET_PRIVATE.key;
        }
      }
      /*console.log(getCoreWalletDetails);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexxCryptoContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxStock = await indexxCryptoContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);
*/
      const provider = new ethers.providers.JsonRpcProvider(rpcURL);
      const wallet = new ethers.Wallet(privateKey, provider);
      console.log("address");
      const contract = new ethers.Contract(
        String(contractAddress),
        IndexxStockTokenABI,
        wallet
      );
      let tx = await contract.mint(
        toAddress,
        ethers.utils.parseUnits(String(amount), 18),
        {
          gasPrice: await provider.getGasPrice(),
        }
      );
      console.log("Minting tokens, transaction hash:", tx.hash);

      await tx.wait();

      console.log(tx);
      const indexxStock = await provider.getTransactionReceipt(tx.hash);
      if (indexxStock.status) {
        return { status: 200, data: indexxStock as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferETHIndexx500byAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainETHIndexx500Contract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexx500Contract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainETHIndexx500Contract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexx500Contract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let indexx500Contract = new web3.eth.Contract(
        Indexx500tokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("IN500");
      let privateKey;
      privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);

      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexx500 = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (indexx500.status) {
        return { status: 200, data: indexx500 as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferETHIndexxPhoenixbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainETHIndexxPhoenixContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxPhoenixContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainETHIndexxPhoenixContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxPhoenixContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let indexx500Contract = new web3.eth.Contract(
        testIndexxPhoenixABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("INXP");
      let privateKey;
      privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexx500 = await indexx500Contract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (indexx500.status) {
        return { status: 200, data: indexx500 as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferSoRektbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainSoRektContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestSoRektContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainSoRektContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestSoRektContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let soRektContract = new web3.eth.Contract(
        testSoRekttokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("SRT");
      let privateKey;
      privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await soRektContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let soRekt = await soRektContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (soRekt.status) {
        return { status: 200, data: soRekt as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferETHIndexxCryptobyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainETHIndexxCryptoContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxCryptoContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainETHIndexxCryptoContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxCryptoContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let indexxCryptoContract = new web3.eth.Contract(
        IndexxCryptotokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("INXC");
      let privateKey;
      privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexxCryptoContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxCryto = await indexxCryptoContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (indexxCryto.status) {
        return { status: 200, data: indexxCryto as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferETHIndexxUSDPbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName: string = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainETHIndexxUSDPContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxUSDPContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainETHIndexxUSDPContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxUSDPContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));
      let indexxUSDPContract = new web3.eth.Contract(
        IndexxUSDPtokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("IUSD+");
      let privateKey;
      privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await indexxUSDPContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);

      let indexxUSDP = await indexxUSDPContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (indexxUSDP.status) {
        return { status: 200, data: indexxUSDP as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferETHIndexxExchangebyAdmin(
    toAddress: string,
    amount: number,
    email: string = "",
    info: string = "",
    type: string = "",
    exchangeName: string = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      let contractAddress;
      if (exchangeName == "CEX" && keys.env.key == "prod") {
        contractAddress = keys.MainETHIndexxExContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "CEX" &&
        (keys.env.key == "test" || keys.env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxExContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName == "DEX" && keys.dex_env.key == "prod") {
        contractAddress = keys.MainETHIndexxExContract.key;
        rpcURL = "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (
        exchangeName == "DEX" &&
        (keys.dex_env.key == "test" || keys.dex_env.key == "development")
      ) {
        contractAddress = keys.TestETHIndexxExContract.key;
        rpcURL = "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      console.log("contractAddress", contractAddress, exchangeName, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      console.log("contractAddress", contractAddress, exchangeName);
      let indexxExContract = new web3.eth.Contract(
        IndexxExtokenABI,
        contractAddress
      );
      const getCoreWalletDetails = await this.getCoreWalletDetails("INEX");
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      let gasEstimate = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      web3.eth.accounts.wallet.add(privateKey);
      let indexxEx = await indexxExContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);
      console.log(indexxEx);
      if (type === "Withdraw_Rewards") {
        await this.transactionCreation(
          indexxEx,
          email,
          type,
          "INEX",
          amount,
          info,
          "Self withdrawal wallet"
        );
      }
      if (indexxEx.status) {
        return { status: 200, data: indexxEx as any };
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferEthereumbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName: string = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      if (exchangeName === "CEX") {
        rpcURL =
          keys.env.key == "development"
            ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else {
        rpcURL =
          keys.dex_env.key == "development"
            ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      }
      let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
      let getCoreWalletDetails = await this.getCoreWalletDetails("ETH");
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const walletBalance = await rpcProvider.getBalance(
        getCoreWalletDetails.coinAddress
      );
      console.log("rpcURL", rpcURL);
      console.log("exchangeName", exchangeName);
      let wallet = new ethers.Wallet(privateKey, rpcProvider);
      const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
      if (balanceInEth < amount) {
        return { status: 500, data: "Insufficient Balance" as any };
      } else {
        // Create a transaction object
        let tx = {
          to: toAddress,
          // Convert currency unit from ether to wei
          value: ethers.utils.parseEther(amount.toString()),
        };
        // Send a transaction
        let transactionHash = await wallet.sendTransaction(tx);
        return { status: 200, data: transactionHash as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferPolygonbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName: string = "CEX"
  ) {
    try {
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let rpcURL;
      if (exchangeName === "CEX") {
        rpcURL =
          keys.env.key == "development"
            ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      } else if (exchangeName === "XNFT") {
        rpcURL =
          keys.env.key == "development"
            ? keys.MATIC_RPC_TEST.key
            : keys.MATIC_RPC_MAIN.key;
      } else {
        rpcURL =
          keys.dex_env.key == "development"
            ? keys.MATIC_RPC_TEST.key
            : keys.MATIC_RPC_MAIN.key;
      }
      let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
      let getCoreWalletDetails = await this.getCoreWalletDetails("MATIC");
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      let wallet = new ethers.Wallet(privateKey, rpcProvider);

      const walletBalance = await rpcProvider.getBalance(wallet.address);
      console.log("rpcURL", rpcURL);
      console.log("exchangeName", exchangeName);
      console.log("walletBalance", walletBalance);
      console.log("getCoreWalletDetails.coinAddress", wallet.address);
      console.log(wallet.address);
      const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
      // CONVERT INEX TO MATIC
      let INEXPrice = await currencyService.findOne({
        code: "INEX",
        type: "BUY",
      });
      let querySymbol = `MATICUSDT`;
      let results: PriceTicker = await binance.prevDay(querySymbol);
      let final = {
        symbol: results.symbol,
        priceChange: Number(results.priceChange),
        priceChangePercent: Number(results.priceChangePercent),
        lastPrice: Number(results.lastPrice),
      };

      let inexPriceInMatic = INEXPrice.sellPrice / final.lastPrice;
      let amountInMatic = amount * inexPriceInMatic;
      console.log("amountInMatic", amountInMatic);
      console.log("inexPriceInMatic", inexPriceInMatic);

      if (balanceInEth < amountInMatic) {
        return { status: 500, data: "Insufficient Balance" as any };
      } else {
        // Create a transaction object
        let tx = {
          to: toAddress,
          // Convert currency unit from ether to wei
          value: ethers.utils.parseEther(amountInMatic.toString()),
        };
        // Send a transaction
        let transactionHash = await wallet.sendTransaction(tx);
        return { status: 200, data: transactionHash as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferBitcoinbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName = "XNFT"
  ) {
    try {
      console.log(toAddress, amount);
      const fromAddress = keys.BITCOIN_PUBLIC_KEY.key;
      const ECPair = ECPairFactory(ecc);
      const MAINNNET = bitcoin.networks.mainnet;
      const keyPair = ECPair.fromWIF(keys.BITCOIN_PRIVATE_KEY.key, MAINNNET);

      console.log("fromAddress", fromAddress);
      const payload = {
        inputs: [{ addresses: [fromAddress] }],
        outputs: [
          {
            addresses: [toAddress],
            value: parseInt(Math.floor(amount * Math.pow(10, 8)).toString()),
          },
        ],
      };

      const response = await axios.post(
        `https://api.blockcypher.com/v1/btc/main/txs/new`,
        JSON.stringify(payload)
      );
      let unsignedTx = response.data;
      unsignedTx.pubkeys = [];
      /** 
       * tmptx.pubkeys.push(keys.publicKey.toString('hex'));
                let signature = keys.sign(Buffer.from(tosign, "hex"));
                let encodedSignature = bitcoin.script.signature.encode(signature, bitcoin.Transaction.SIGHASH_ALL);
                let hexStr = encodedSignature.toString("hex").slice(0, -2); return hexStr;
      */
      // unsignedTx.signatures = unsignedTx.tosign.map((tosign: any, n: any) => {
      //   unsignedTx.pubkeys.push(keyPair.publicKey.toString("hex"));
      //   return bitcoin.script.signature
      //     .encode(keyPair.sign(Buffer.from(tosign, "hex")), 0x01)
      //     .toString("hex")
      //     .slice(0, -2);
      // });

      unsignedTx.signatures = unsignedTx.tosign.map((tosign: any, n: any) => {
        unsignedTx.pubkeys.push(keyPair.publicKey.toString("hex"));
        let signature = keyPair.sign(Buffer.from(tosign, "hex"));
        let encodedSignature = bitcoin.script.signature.encode(
          signature,
          bitcoin.Transaction.SIGHASH_ALL
        );
        let hexStr = encodedSignature.toString("hex").slice(0, -2);
        return hexStr;
      });

      console.log("unsignedTx", unsignedTx);
      const signedTx = await axios.post(
        `https://api.blockcypher.com/v1/btc/main/txs/send`,
        JSON.stringify(unsignedTx)
      );

      console.log("signedTx", JSON.stringify(signedTx.data));
      return { status: 200, data: signedTx.data.tx.hash };
    } catch (err: any) {
      console.log(err.response.data.errors);
      console.log("err", JSON.stringify(err));
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferLitecoinbyAdmin(toAddress: string, amount: number) {
    return { status: 200, data: {} as any };
  }

  async transferBinancetokenbyAdmin(
    toAddress: string,
    amount: number,
    exchangeName: string = "CEX"
  ) {
    try {
      let rpcURL;
      if (exchangeName === "CEX") {
        rpcURL =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.BSC_RPC_TEST.key
            : keys.BSC_RPC_MAIN.key;
      } else {
        7;
        rpcURL =
          keys.dex_env.key == "development" || keys.dex_env.key == "test"
            ? keys.BSC_RPC_TEST.key
            : keys.BSC_RPC_MAIN.key;
      }
      console.log("rpcURL", rpcURL);
      console.log("exchangeName", exchangeName);
      let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
      let getCoreWalletDetails = await this.getCoreWalletDetails("BNB");
      console.log("getCoreWalletDetails", getCoreWalletDetails);
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const walletBalance = await rpcProvider.getBalance(
        getCoreWalletDetails.coinAddress
      );
      let wallet = new ethers.Wallet(privateKey, rpcProvider);
      console.log(wallet);
      const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
      if (balanceInEth < amount) {
        return { status: 500, data: "Insufficient Balance" as any };
      } else {
        // Create a transaction object
        let tx = {
          to: toAddress,
          // Convert currency unit from ether to wei
          value: ethers.utils.parseEther(amount.toString()),
        };
        // Send a transaction
        let transactionHash = await wallet.sendTransaction(tx);
        console.log(transactionHash);
        return { status: 200, data: transactionHash as any };
      }
    } catch (err) {
      return { status: 500, data: "Failed to transfer" as any };
    }
  }

  async transferBUSDbyAdmin(toAddress: string, amount: number) {
    try {
      let rpcURL =
        keys.env.key == "development" || keys.env.key == "test"
          ? keys.BSC_RPC_TEST.key
          : keys.BSC_RPC_MAIN.key;
      let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
      let getCoreWalletDetails = await this.getCoreWalletDetails("BUSD");
      const privateKey = await decryptData(getCoreWalletDetails.coinPrivateKey);
      const walletBalance = await rpcProvider.getBalance(
        getCoreWalletDetails.coinAddress
      );
      let wallet = new ethers.Wallet(privateKey, rpcProvider);
      const balanceInEth = Number(ethers.utils.formatEther(walletBalance));
      if (balanceInEth < amount) {
        return { status: 500, data: "Insufficient Balance" };
      } else {
        // Create a transaction object
        let tx = {
          to: toAddress,
          // Convert currency unit from ether to wei
          value: ethers.utils.parseEther(amount.toString()),
        };
        // Send a transaction
        let transactionHash = await wallet.sendTransaction(tx);
        return { status: 200, data: transactionHash };
      }
    } catch (err) {
      return false;
    }
  }
  /*Helpers*/
  async transactionCreation(
    txData: any,
    email: string,
    type: string,
    currencyRef: string,
    amount: number = 0,
    info: string = "",
    walletType: string = ""
  ) {
    try {
      let orderNumer = Math.floor(100000 + Math.random() * 900000);
      let transactionData = {
        orderId: "RewardWithdraw" + orderNumer,
        extRef: "",
        txId: txData.transactionHash,
        status: txData.status,
        amount: amount,
        from: txData.from,
        currencyRef: currencyRef,
        to: txData.to,
        transactionType: txData.value,
        txType: type,
        txDate: new Date(),
        walletType: walletType,
        info: info,
        email: email,
        exchangeName: txData.exchangeName,
        benificaryAddress: "",
      };
      let transaction = await txService.create(transactionData);
      return transaction;
    } catch (err) {
      return false;
    }
  }

  async transactionCreationForGiftCard(
    txData: any,
    giftcardCode: string,
    type: string,
    currencyRef: string,
    amount: number = 0,
    info: string = "",
    walletType: string = ""
  ) {
    try {
      let orderNumer = Math.floor(100000 + Math.random() * 900000);
      let transactionData = {
        orderId: "GiftCard Redeem" + orderNumer,
        extRef: "",
        txId: txData.transactionHash,
        status: txData.status,
        amount: amount,
        from: txData.from,
        currencyRef: currencyRef,
        to: txData.to,
        transactionType: txData.value,
        txType: type,
        txDate: new Date(),
        walletType: walletType,
        info: info,
        email: giftcardCode,
        exchangeName: txData.exchangeName,
        benificaryAddress: "",
      };
      let transaction = await txService.create(transactionData);
      return transaction;
    } catch (err) {
      return false;
    }
  }

  async getCurrentMintNumberByAddress(
    address: any,
    abiValue: any,
    type: any,
    blockchain = "",
    totalQuanity: number
  ) {
    try {
      if (blockchain === "Polygon") {
        let rpcProvider = new ethers.providers.JsonRpcProvider(
          keys.MATIC_RPC_MAIN.key
        );

        const spFeed = new ethers.Contract(address, abiValue, rpcProvider);
        let res = await spFeed.totalSupply();
        const mintCount = parseInt(res);
        const uriP = await spFeed.uriPrefix();
        const uriS = await spFeed.uriSuffix();
        //const tokenUri = uriP + (mintCount + 1) + uriS;

        let tokenUriS = [];
        for (let i = 0; i < totalQuanity; i++) {
          console.log("tokenURI", uriP + (mintCount + i + 1) + uriS);
          tokenUriS.push(uriP + (mintCount + i + 1) + uriS);
        }
        return {
          mintCount,
          tokenUriS,
        };
      } else if (blockchain === "Ethereum") {
        let rpcProvider = new ethers.providers.JsonRpcProvider(
          keys.ETH_RPC_MAIN.key
        );

        const spFeed = new ethers.Contract(address, abiValue, rpcProvider);
        let res = await spFeed.totalSupply();
        const mintCount = parseInt(res);
        const uriP = await spFeed.uriPrefix();
        const uriS = await spFeed.uriSuffix();
        //const tokenUri = uriP + (mintCount + 1) + uriS;

        let tokenUriS = [];
        for (let i = 0; i < totalQuanity; i++) {
          console.log("tokenURI", uriP + (mintCount + i + 1) + uriS);
          tokenUriS.push(uriP + (mintCount + i + 1) + uriS);
        }
        return {
          mintCount,
          tokenUriS,
        };
      }
    } catch (err) {
      return {
        mintCount: 0,
        tokenUriS: [],
      };
    }
  }
}

/*
    orderId: string;
   extRef: string;
    txId: string;
    from: string;
    to: string;
    amount: number;
    info: string;
    status: OrderStatus;
    currencyRef: String;
    walletType: String;
    transactionType: String;
    email: string,
    txDate: Date
*/

/*
let contracts = [
        {
          address: jsonData.bitcoinBlack,
          abi: bitcoinBlack.abi,
          value: 1,
          type: "BTC",

        },
        {
          address: jsonData.bitcoinBlue,
          abi: bitcoinBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.bitcoinGreen,
          abi: bitcoinGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.bitcoinPurple,
          abi: bitcoinPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.bitcoinPink,
          abi: bitcoinPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.bitcoinOrange,
          abi: bitcoinOrange.abi,
          value: 0.001,
        },
        {
          address: jsonData.ethereumBlack,
          abi: ethereumBlack.abi,
          value: 1,
        },
        {
          address: jsonData.ethereumBlue,
          abi: ethereumBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.ethereumGreen,
          abi: ethereumGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.ethereumPurple,
          abi: ethereumPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.ethereumPink,
          abi: ethereumPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.ethereumOrange,
          abi: ethereumOrange.abi,
          value: 0.001,
        },
        {
          address: jsonData.e_bitcoinBlack,
          abi: e_bitcoinBlack.abi,
          value: 1,
        },
        {
          address: jsonData.e_bitcoinBlue,
          abi: e_bitcoinBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.e_bitcoinGreen,
          abi: e_bitcoinGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.e_bitcoinPurple,
          abi: e_bitcoinPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.e_bitcoinPink,
          abi: e_bitcoinPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.e_bitcoinOrange,
          abi: e_bitcoinOrange.abi,
          value: 0.001,
        },
        {
          address: jsonData.e_ethereumBlack,
          abi: e_ethereumBlack.abi,
          value: 1,
        },
        {
          address: jsonData.e_ethereumBlue,
          abi: e_ethereumBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.e_ethereumGreen,
          abi: e_ethereumGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.e_ethereumPurple,
          abi: e_ethereumPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.e_ethereumPink,
          abi: e_ethereumPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.e_ethereumOrange,
          abi: e_ethereumOrange.abi,
          value: 0.001,
        },
        {
          address: jsonData.XUSDNFT,
          abi: usdNFT.abi,
          value: 1.00,
        },
        {
          address: jsonData.e_XUSDNFT,
          abi: e_usdNFT.abi,
          value: 1.00,
        },
      ];
*/
