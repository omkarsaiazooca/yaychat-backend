import { ethers, utils } from "ethers";
import { Request, Response } from "express";
import { v1 as uuidv1 } from "uuid";
import { keys } from "../config/keys";
import { OrderStatus } from "../data/order";
import { TransactionService } from "../services/transaction.service";
import { UserService } from "../services/user.service";
import { BaseAPIOperations } from "./base.operations";
import { Indexx500tokenABI } from "../helpers/test_indexx500";
import { IndexxCryptotokenABI } from "../helpers/test_indexxcrypto";
import { TestFTTTokenABI } from "..//helpers/test_fttToken";
import { IndexxUSDPtokenABI } from "../helpers/test_indexxusdp";
import { IndexxExtokenABI } from "../helpers/test_indexxexchange";
import { IndexxService } from "../services/IndexxTokens.service";
import { CoreWalletService } from "../services/coreWallet.service";
import { OrderService } from "../services/order.service";
import { OrderTransaction } from "../data/order";
import { StripePaymentService } from "../services/stripePayment.service";
import { WalletOperations } from "./wallet.operations";
import { PaypalService } from "../services/paypal.service";
import {
  checkandUpdateTx,
  subscribeToTransactions,
} from "./bnbsubcribe.operations";
import { SendEmail } from "./email.operations";
import { ERC20_ABI } from "../helpers/BEP_20_ABI";
import { UserWallet } from "../data/user";
import { AffilateService } from "../services/affiliate.service";
import { NonPaypalSubscriptionService } from "../services/nonPaypalSubscription.service";
import { testWIBSTokenAbi } from "../helpers/test_wibs";
const solanaWeb3 = require("@solana/web3.js");

const Client = require("bitcoin-core");
const Web3 = require("web3");
const uservice: UserService = new UserService();
const affiliateUser: AffilateService = new AffilateService();
const txservice: TransactionService = new TransactionService();
const indexxService: IndexxService = new IndexxService();
const coreWalletService: CoreWalletService = new CoreWalletService();
const orderService: OrderService = new OrderService();
const stripeService: StripePaymentService = new StripePaymentService();
const paypalService: PaypalService = new PaypalService();
const nonPaypalSubscriptionService: NonPaypalSubscriptionService =
  new NonPaypalSubscriptionService();
export class TxOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  private normalizeEmail(email: any): string {
    return String(email ?? "").trim().toLowerCase();
  }

  private isBTCY(coin: any): boolean {
    return String(coin ?? "").trim().toUpperCase() === "BTCY";
  }

  //For CEX
  async createTransaction(req: any, res: any) {
    try {
      let { email, txHash, coin, coinNetwork } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOne({ email: email });
      //console.log(user)
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }
      const txDetails = await txservice.findOne({ txId: txHash });
      if (txDetails) {
        return { status: 400, data: { message: "Transaction already exists" } };
      }
      let checkStatus = await this.checkCoinTransaction(
        coin,
        txHash,
        coinNetwork
      );
      let getUserWallet = await uservice.findOne({
        email: email,
      });

      let getRequiredCoin = getUserWallet.userWallets.find(
        (x) => x.coinSymbol === coin
      );
      let recevierWalletAddr = getRequiredCoin?.coinWalletAddress;
      if (coin === "FTT_ETH" || coin === "FTT") {
        let coreWallet = await coreWalletService.findOne({
          coinSymbol: "FTT",
        });
        recevierWalletAddr = coreWallet?.coinAddress;
      }
      console.log(checkStatus, recevierWalletAddr);
      if (
        checkStatus &&
        checkStatus.confirmations >= 3 &&
        checkStatus.transferedAmount != 0 &&
        String(recevierWalletAddr).toLocaleLowerCase ===
          String(checkStatus.to).toLocaleLowerCase
      ) {
        const newTx = await txservice.create({
          email: email,
          orderId: uuidv1(),
          extRef: "",
          txId: txHash,
          from: checkStatus.from,
          to: checkStatus.to,
          amount: checkStatus.transferedAmount,
          exchangeName: "CEX",
          info: "Deposit crypto by user",
          status: OrderStatus.Completed,
          currencyRef: coin,
          walletType: "ASSET_WALLET",
          transactionType: "DEPOSIT_CRYPTO",
          txDate: new Date(),
          benificaryAddress: "",
        });
        let getUser = await uservice.findOne({ email: email });
        if (coin === "FTT" || coin === "FTT_ETH") {
          let getCoin = getUser.userWallets.find(
            (x) => x.coinSymbol === "FTT" && x.coinNetwork === "Ethereum"
          );
          if (getCoin !== undefined) {
            //update user wallet balance
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                "userWallets.coinSymbol": "FTT",
                "userWallets.coinNetwork": "Ethereum",
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": checkStatus.transferedAmount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );

            if (newTx && wallet) {
              return {
                status: 200,
                data: { data: newTx, message: "Transaction created" },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            const walletOps = new WalletOperations(req, res);

            //create coin wallet
            const wallet = await walletOps.createFTTETHWallet(
              user.email,
              "FTT_Token",
              checkStatus.transferedAmount
            );
            if (newTx && wallet) {
              return {
                status: 200,
                data: { data: newTx, message: "Transaction created" },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          }
        } else {
          let getCoin = getUser.userWallets.find((x) => x.coinSymbol === coin);
          console.log(getCoin);
          if (getCoin !== undefined) {
            if (coin === "INEX") {
              if (coinNetwork === "Polygon") {
                let getCoin2 = getUser.userWallets.find(
                  (x) => x.coinSymbol === coin && x.coinNetwork === "Polygon"
                );
                if (getCoin2 !== undefined) {
                  const wallet = await uservice.updatePart(
                    {
                      email: user.email,
                      "userWallets.coinSymbol": coin,
                      "userWallets.coinNetwork": "Polygon",
                    },
                    {
                      $inc: {
                        "userWallets.$.coinBalance":
                          checkStatus.transferedAmount,
                      },
                      $set: {
                        coinLastUsedOn: new Date(),
                      },
                    }
                  );
                  console.log(newTx);
                  console.log(wallet);
                  if (newTx && wallet) {
                    return {
                      status: 200,
                      data: { data: newTx, message: "Transaction created" },
                    };
                  } else {
                    return {
                      status: 500,
                      data: { message: "Internal Server Error" },
                    };
                  }
                } else {
                  const walletOps = new WalletOperations(req, res);
                  let wallet;
                  wallet = await walletOps.createMATICINEXWallet(
                    email,
                    coin,
                    checkStatus.transferedAmount
                  );
                  if (newTx && wallet) {
                    return {
                      status: 200,
                      data: { data: newTx, message: "Transaction created" },
                    };
                  } else {
                    return {
                      status: 500,
                      data: { message: "Internal Server Error" },
                    };
                  }
                }
              } else {
                const wallet = await uservice.updatePart(
                  {
                    email: user.email,
                    "userWallets.coinSymbol": coin,
                  },
                  {
                    $inc: {
                      "userWallets.$.coinBalance": checkStatus.transferedAmount,
                    },
                    $set: {
                      coinLastUsedOn: new Date(),
                    },
                  }
                );
                console.log(newTx);
                console.log(wallet);
                if (newTx && wallet) {
                  return {
                    status: 200,
                    data: { data: newTx, message: "Transaction created" },
                  };
                } else {
                  return {
                    status: 500,
                    data: { message: "Internal Server Error" },
                  };
                }
              }
            } else {
              //update user wallet balance
              const wallet = await uservice.updatePart(
                {
                  email: user.email,
                  "userWallets.coinSymbol": coin,
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": checkStatus.transferedAmount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
              console.log(newTx);
              console.log(wallet);
              if (newTx && wallet) {
                return {
                  status: 200,
                  data: { data: newTx, message: "Transaction created" },
                };
              } else {
                return {
                  status: 500,
                  data: { message: "Internal Server Error" },
                };
              }
            }
          } else {
            const walletOps = new WalletOperations(req, res);
            let wallet;
            //create coin wallet
            if (req.params.coin == "BTC") {
              wallet = await walletOps.createBitcoinWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "ETH") {
              wallet = await walletOps.createEthereumWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "BNB") {
              wallet = await walletOps.createBinanceWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "IN500") {
              wallet = await walletOps.createIN500Wallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "WIBS") {
              wallet = await walletOps.createETHWIBSWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "INXC") {
              wallet = await walletOps.createINXCWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "IUSDP") {
              wallet = await walletOps.createIUSDPWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "BUSD") {
              wallet = await walletOps.createBUSDWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "INEX") {
              wallet = await walletOps.createINEXWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            } else if (req.params.coin == "LTC") {
              wallet = await walletOps.createLitecoinWallet(
                email,
                coin,
                checkStatus.transferedAmount
              );
            }
            if (newTx && wallet) {
              return {
                status: 200,
                data: { data: newTx, message: "Transaction created" },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          }
        }
      } else {
        return { status: 500, data: { message: "Invalid transaction hash" } };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  //For DEX
  async checkDeposit(req: any, res: any) {
    try {
      let txHash = req.body.txHash;
      let coin = req.body.orderDetails.breakdown.inCurrenyName;
      let blockchainName = req.body.orderDetails.blockchainName;
      const txDetails = await txservice.findOne({ txId: txHash });
      if (txDetails) {
        return { status: 400, data: { message: "Transaction already exists" } };
      }
      let checkStatus = await this.dexCheckCoinTransaction(
        coin,
        txHash,
        blockchainName
      );
      let getCoreWallet = await coreWalletService.findOne({
        coin: coin,
      });

      console.log(checkStatus, "checkStatus");
      if (
        checkStatus &&
        checkStatus.confirmations >= 3 &&
        checkStatus.transferedAmount != 0 &&
        String(getCoreWallet.coinAddress).toLocaleLowerCase ===
          String(checkStatus.to).toLocaleLowerCase
      ) {
        const newTx = await txservice.create({
          email: String(req.body.email).toLowerCase(),
          userWalletAddress: req.body.userWalletAddress,
          orderId: req.body.orderDetails.orderId,
          extRef: "",
          txId: txHash,
          from: checkStatus.from,
          to: checkStatus.to,
          amount: checkStatus.transferedAmount,
          info: "Deposit crypto by user",
          status: OrderStatus.ReceivedDeposit,
          currencyRef: coin,
          exchangeName: "DEX",
          walletType: "CORE WALLET",
          transactionType: "DEPOSIT_CRYPTO",
          txDate: new Date(),
          benificaryAddress: "",
        });
        //get orderDetails
        let getOrderDetails = await orderService.findOne({
          orderId: req.body.orderDetails.orderId,
          exchangeName: req.body.orderDetails.exchangeName,
        });

        let createOrderTX = {
          currency: getOrderDetails.breakdown.inCurrenyName,
          amount: getOrderDetails.breakdown.inAmount,
          trnReference: "",
          trnHash: txHash,
          walletAddress: getCoreWallet.coinAddress,
          created: new Date(),
          status: "Completed",
        } as OrderTransaction;

        //update user DEX order
        const order = await orderService.updatePart(
          {
            orderId: req.body.orderDetails.orderId,
            exchangeName: req.body.orderDetails.exchangeName,
          },
          {
            $set: {
              status: OrderStatus.ReceivedDeposit,
              orderCompletedOn: new Date(),
              transactions: getOrderDetails.transactions?.concat(createOrderTX),
            },
          }
        );

        if (newTx) {
          return { status: 200, data: { message: "Transaction created" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else {
        return { status: 500, data: { message: "Invalid transaction hash" } };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async confirmExchange(req: any, res: any) {
    try {
      let checkOrder = await orderService.findOne({
        orderId: req.body.orderId,
      });
      console.log("checkOrder", checkOrder);
      let getTX = await txservice.findOne({
        orderId: req.body.orderId,
      });
      if (
        checkOrder.status === "ReceivedDeposit" &&
        getTX.status === "ReceivedDeposit"
      ) {
        if (checkOrder.breakdown.outCurrencyName === "ETH") {
          let payOut = await indexxService.transferEthereumbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.hash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "BNB") {
          let payOut = await indexxService.transferBinancetokenbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.hash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  txId: res.data?.txHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "IN500") {
          let payOut = {
            status: 400,
            data: {} as any,
          };
          if (checkOrder.blockchainName === "Ethereum") {
            payOut = await indexxService.transferETHIndexx500byAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          } else {
            payOut = await indexxService.transferIndexx500byAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          }
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.transactionHash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "INEX") {
          let payOut = {
            status: 400,
            data: {} as any,
          };
          if (checkOrder.blockchainName === "Ethereum") {
            payOut = await indexxService.transferETHIndexxExchangebyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "",
              "",
              "",
              "DEX"
            );
          } else {
            payOut = await indexxService.transferIndexxExchangebyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "",
              "",
              "",
              "DEX"
            );
          }
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.transactionHash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "INXC") {
          let payOut = {
            status: 400,
            data: {} as any,
          };
          if (checkOrder.blockchainName === "Ethereum") {
            payOut = await indexxService.transferETHIndexxCryptobyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          } else {
            payOut = await indexxService.transferIndexxCryptobyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          }
          console.log(payOut);
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.transactionHash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "IUSD+") {
          let payOut = {
            status: 400,
            data: {} as any,
          };
          if (checkOrder.blockchainName === "Ethereum") {
            payOut = await indexxService.transferETHIndexxUSDPbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          } else {
            payOut = await indexxService.transferIndexxUSDPbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          }
          console.log("payout", payOut);
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.transactionHash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "BTC") {
          let payOut = await indexxService.transferBitcoinbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount
          );
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.inCurrenyName,
              amount: checkOrder.breakdown.inAmount,
              trnReference: "",
              trnHash: payOut.data,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  txId: res.data?.txHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "LTC") {
          let payOut = await indexxService.transferLitecoinbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount
          );
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.inCurrenyName,
              amount: checkOrder.breakdown.inAmount,
              trnReference: "",
              trnHash: payOut.data.hash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );

            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else if (checkOrder.breakdown.outCurrencyName === "INXP") {
          let payOut = {
            status: 400,
            data: {} as any,
          };
          if (checkOrder.blockchainName === "Ethereum") {
            payOut = await indexxService.transferETHIndexxPhoenixbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          } else {
            payOut = await indexxService.transferIndexxPhoenixbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
          }
          if (payOut.status === 200) {
            let createOrderTX = {
              currency: checkOrder.breakdown.outCurrencyName,
              amount: checkOrder.breakdown.outAmount,
              trnReference: "",
              trnHash: payOut.data.transactionHash,
              walletAddress: checkOrder.receiverAccount.userReceiveAddress,
              created: new Date(),
              status: "Completed",
            } as OrderTransaction;

            //update order
            const updateOrder = await orderService.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  transactions: checkOrder.transactions?.concat(createOrderTX),
                },
              }
            );

            //update tx
            const txUpdate = await txservice.updatePart(
              {
                orderId: req.body.orderId,
              },
              {
                $set: {
                  status: OrderStatus.Completed,
                  orderCompletedOn: new Date(),
                },
              }
            );
            return { status: 200, data: { message: "Order completed" } };
          } else {
            return {
              status: 500,
              data: { message: "Internal Server Error" },
            };
          }
        } else {
          return { status: 500, data: { message: "Coin not supported" } };
        }
      } else {
        return { status: 400, data: { message: "Order not completed" } };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async checkandconfirmExchange(req: any, res: any) {
    try {
      let txDetails = req.body.txDetails;
      let orderId = req.body.orderId;
      let updateTx = await checkandUpdateTx(txDetails, orderId);
      if (updateTx.status === 200) {
        console.log("Transaction updated");
        let checkOrder = await orderService.findOne({
          orderId: req.body.orderId,
        });
        console.log("checkOrder", checkOrder);
        let getTX = await txservice.findOne({
          orderId: req.body.orderId,
        });
        if (
          checkOrder.status === "ReceivedDeposit" &&
          getTX.status === "ReceivedDeposit"
        ) {
          if (checkOrder.breakdown.outCurrencyName === "ETH") {
            let payOut = await indexxService.transferEthereumbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.hash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "BNB") {
            let payOut = await indexxService.transferBinancetokenbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount,
              "DEX"
            );
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.hash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    txId: res.data?.txHash,
                    txDate: new Date(),
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "IN500") {
            let payOut = {
              status: 400,
              data: {} as any,
            };
            if (checkOrder.blockchainName === "Ethereum") {
              payOut = await indexxService.transferETHIndexx500byAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            } else {
              payOut = await indexxService.transferIndexx500byAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            }
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.transactionHash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "INEX") {
            let payOut = {
              status: 400,
              data: {} as any,
            };
            if (checkOrder.blockchainName === "Ethereum") {
              payOut = await indexxService.transferETHIndexxExchangebyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "",
                "",
                "",
                "DEX"
              );
            } else {
              payOut = await indexxService.transferIndexxExchangebyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "",
                "",
                "",
                "DEX"
              );
            }
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.transactionHash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "INXC") {
            let payOut = {
              status: 400,
              data: {} as any,
            };
            if (checkOrder.blockchainName === "Ethereum") {
              payOut = await indexxService.transferETHIndexxCryptobyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            } else {
              payOut = await indexxService.transferIndexxCryptobyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            }
            console.log(payOut);
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.transactionHash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "IUSD+") {
            let payOut = {
              status: 400,
              data: {} as any,
            };
            if (checkOrder.blockchainName === "Ethereum") {
              payOut = await indexxService.transferETHIndexxUSDPbyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            } else {
              payOut = await indexxService.transferIndexxUSDPbyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            }
            console.log("payout", payOut);
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.transactionHash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "BTC") {
            let payOut = await indexxService.transferBitcoinbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount
            );
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.inCurrenyName,
                amount: checkOrder.breakdown.inAmount,
                trnReference: "",
                trnHash: payOut.data,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    txId: res.data?.txHash,
                    txDate: new Date(),
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "LTC") {
            let payOut = await indexxService.transferLitecoinbyAdmin(
              checkOrder.receiverAccount.userReceiveAddress,
              checkOrder.breakdown.outAmount
            );
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.inCurrenyName,
                amount: checkOrder.breakdown.inAmount,
                trnReference: "",
                trnHash: payOut.data.hash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );

              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else if (checkOrder.breakdown.outCurrencyName === "INXP") {
            let payOut = {
              status: 400,
              data: {} as any,
            };
            if (checkOrder.blockchainName === "Ethereum") {
              payOut = await indexxService.transferETHIndexxPhoenixbyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            } else {
              payOut = await indexxService.transferIndexxPhoenixbyAdmin(
                checkOrder.receiverAccount.userReceiveAddress,
                checkOrder.breakdown.outAmount,
                "DEX"
              );
            }
            if (payOut.status === 200) {
              let createOrderTX = {
                currency: checkOrder.breakdown.outCurrencyName,
                amount: checkOrder.breakdown.outAmount,
                trnReference: "",
                trnHash: payOut.data.transactionHash,
                walletAddress: checkOrder.receiverAccount.userReceiveAddress,
                created: new Date(),
                status: "Completed",
              } as OrderTransaction;

              //update order
              const updateOrder = await orderService.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    transactions:
                      checkOrder.transactions?.concat(createOrderTX),
                  },
                }
              );

              //update tx
              const txUpdate = await txservice.updatePart(
                {
                  orderId: req.body.orderId,
                },
                {
                  $set: {
                    status: OrderStatus.Completed,
                    orderCompletedOn: new Date(),
                  },
                }
              );
              return { status: 200, data: { message: "Order completed" } };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Coin not supported" } };
          }
        } else {
          return { status: 400, data: { message: "Order not completed" } };
        }
      } else {
        console.log("failed to sent the crypto");
        return {
          status: 500,
          data: {
            message: "failed to sent the crypto",
          },
        };
      }
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  async updateTransaction(req: any, res: any) {}

  async registerFiatDeposit(req: any, res: any) {
    try {
      let { email, txHash, coin, amount } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }
      const txDetails = await txservice.findOne({ txId: txHash });
      if (txDetails) {
        return { status: 400, data: { message: "Transaction already exists" } };
      }
      const newTx = await txservice.create({
        email: email,
        orderId: uuidv1(),
        extRef: "",
        txId: txHash,
        from: "",
        to: "",
        amount: amount,
        info: "Deposit fiat by user",
        status: OrderStatus.Pending,
        currencyRef: coin,
        exchangeName: "CEX",
        walletType: "ASSET_WALLET",
        transactionType: "DEPOSIT_FIAT",
        txDate: new Date(),
        benificaryAddress: "",
      });
      //update user wallet balance
      const wallet = await uservice.updatePart(
        {
          email: user.email,
          "userWallets.coinSymbol": coin,
        },
        {
          $inc: {
            "userWallets.$.coinBalance": amount,
          },
          $set: {
            coinLastUsedOn: new Date(),
          },
        }
      );
      if (newTx && wallet) {
        return { status: 200, data: { message: "Transaction created" } };
      } else {
        return { status: 500, data: { message: "Internal Server Error" } };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerFiatDepositForSmartAPY(req: any, res: any) {
    try {
      let { email, txHash, coin, amount } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }
      const txDetails = await txservice.findOne({ txId: txHash });
      if (txDetails) {
        return { status: 400, data: { message: "Transaction already exists" } };
      }
      const newTx = await txservice.create({
        email: email,
        orderId: uuidv1(),
        extRef: "",
        txId: txHash,
        from: "",
        to: "",
        amount: amount,
        info: "Deposit fiat by user",
        status: OrderStatus.Pending,
        currencyRef: coin,
        exchangeName: "CEX",
        walletType: "ASSET_WALLET",
        transactionType: "DEPOSIT_FIAT",
        txDate: new Date(),
        benificaryAddress: "",
      });
      //update user wallet balance
      const wallet = await uservice.updatePart(
        {
          email: user.email,
          "userWallets.coinSymbol": coin,
        },
        {
          $inc: {
            "userWallets.$.coinBalance": amount,
          },
          $set: {
            coinLastUsedOn: new Date(),
          },
        }
      );
      if (newTx && wallet) {
        return { status: 200, data: { message: "Transaction created" } };
      } else {
        return { status: 500, data: { message: "Internal Server Error" } };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }


  async registerFiatDepositForOrder(req: any, res: any) {
    try {
      const { email, orderId, fromDetails, toDetails, paymentReceiptUrl } =
        req.body;
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }
      let getOrderDetails = await orderService.findOne({
        orderId: orderId,
      });
      const txDetails = await txservice.findOne({ orderId: orderId });
      if (txDetails) {
        return { status: 400, data: { message: "Transaction already exists" } };
      }
      console.log("getOrderDetails", getOrderDetails);
      const newTx = await txservice.create({
        email: email,
        orderId: orderId,
        extRef: "",
        txId: "",
        from: JSON.stringify(fromDetails),
        benificaryAddress: JSON.stringify(fromDetails),
        to: JSON.stringify(toDetails),
        amount: getOrderDetails.breakdown.inAmount,
        info: "Deposit fiat by user",
        notes: "Deposit fiat by user",
        status: OrderStatus.Pending,
        currencyRef: getOrderDetails.breakdown.inCurrenyName,
        exchangeName: "CEX",
        walletType: "",
        transactionType: "DEPOSIT_FIAT",
        txDate: new Date(),
        depositedType: getOrderDetails.paymentType,
        paymentReceiptUrl: paymentReceiptUrl,
      });

      if (getOrderDetails.orderType === "MonthlyINEXBuy") {
        const combinedAddressDetails = {
          from: fromDetails,
          to: toDetails,
        };
        let res = await nonPaypalSubscriptionService.updatePart(
          {
            orderId: orderId,
          },
          {
            address: JSON.stringify(combinedAddressDetails),
          }
        );
      }
      await new SendEmail().sendFiatDepositNotification(
        email,
        orderId,
        getOrderDetails.breakdown.inAmount,
        JSON.stringify(fromDetails),
        JSON.stringify(toDetails),
        paymentReceiptUrl,
        req.body.website
      );
      return { status: 200, data: { message: "Transaction created" } };
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerCryptoWithdraw(req: any, res: any) {
    try {
      let { email, address, coin, amount, coinNetwork } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }

      let getWalletOfWithdrawToken = user.userWallets.find(
        (x) => x.coinSymbol === coin
      );
      let balanceOfCoin = Number(getWalletOfWithdrawToken?.coinBalance);
      if (balanceOfCoin >= Number(amount)) {
        // const txDetails = await txservice.findOne({txId: txHash});
        // if(txDetails) {
        //   return {status: 400, data: {message: "Transaction already exists"}};
        // }
        const newTx = await txservice.create({
          email: email,
          orderId: uuidv1(),
          extRef: "",
          txId: "",
          from: "",
          to: address,
          amount: amount,
          info: "Withdraw crypto by user",
          status: OrderStatus.Pending,
          currencyRef: coin,
          walletType: "ASSET_WALLET",
          transactionType: "WITHDRAW_CRYPTO",
          exchangeName: "CEX",
          txDate: new Date(),
          benificaryAddress: "",
        });
        if (coin === "BNB") {
          //transfer bnb
          let res = await indexxService.transferBinancetokenbyAdmin(
            address,
            amount
          );
          if (res.status === 200) {
            // let updateUser = await uservice.updatePart(
            //   { email: email, userWallets: { $elemMatch: { "coinSymbol": coin } } },
            //   { $set: { "userWallets.$.coinBalance": balanceInEth - amount } });
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            console.log(wallet);
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.hash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: { data: res.data, message: "Transaction created" },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else if (coin === "ETH") {
          //transfer eth
          let res = await indexxService.transferEthereumbyAdmin(
            address,
            amount
          );
          if (res.status === 200) {
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.hash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: { data: res.data, message: "Transaction created" },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else if (coin === "IN500") {
          //transfer in500
          let res = await indexxService.transferIndexx500byAdmin(
            address,
            amount
          );
          if (res.status === 200) {
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            console.log(res.data);
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.transactionHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: {
                  data: { hash: res.data?.transactionHash },
                  message: "Transaction created",
                },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else if (coin === "WIBS") {
          //transfer WIBS
          let res = await indexxService.transferWIBSbyAdmin(address, amount);
          if (res.status === 200) {
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            console.log(res.data);
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.transactionHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: {
                  data: { hash: res.data?.transactionHash },
                  message: "Transaction created",
                },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else if (coin === "INEX") {
          if (coinNetwork === "Polygon") {
            //transfer inex
            let res = await indexxService.transferPolygonIndexxExchangebyAdmin(
              address,
              amount
            );
            if (res.status === 200) {
              //update user wallet
              const wallet = await uservice.updatePart(
                {
                  email: user.email,
                  userWallets: {
                    $elemMatch: { coinSymbol: coin, coinNetwork: "Polygon" },
                  },
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": -amount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
              //update tx
              const updateTx = await txservice.updatePart(
                {
                  email: user.email,
                  orderId: newTx.orderId,
                },
                {
                  $set: {
                    txId: res.data?.transactionHash,
                    txDate: new Date(),
                    status: OrderStatus.Completed,
                    from: res.data?.from,
                  },
                }
              );
              console.log(newTx);
              console.log(wallet);
              console.log(updateTx);

              if (newTx && wallet && updateTx) {
                return {
                  status: 200,
                  data: {
                    data: { hash: res.data?.transactionHash },
                    message: "Transaction created",
                  },
                };
              } else {
                return {
                  status: 500,
                  data: { message: "Internal Server Error" },
                };
              }
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            //transfer inex
            let res = await indexxService.transferIndexxExchangebyAdmin(
              address,
              amount
            );
            if (res.status === 200) {
              //update user wallet
              const wallet = await uservice.updatePart(
                {
                  email: user.email,
                  userWallets: { $elemMatch: { coinSymbol: coin } },
                },
                {
                  $inc: {
                    "userWallets.$.coinBalance": -amount,
                  },
                  $set: {
                    coinLastUsedOn: new Date(),
                  },
                }
              );
              //update tx
              const updateTx = await txservice.updatePart(
                {
                  email: user.email,
                  orderId: newTx.orderId,
                },
                {
                  $set: {
                    txId: res.data?.transactionHash,
                    txDate: new Date(),
                    status: OrderStatus.Completed,
                    from: res.data?.from,
                  },
                }
              );
              console.log(newTx);
              console.log(wallet);
              console.log(updateTx);

              if (newTx && wallet && updateTx) {
                return {
                  status: 200,
                  data: {
                    data: { hash: res.data?.transactionHash },
                    message: "Transaction created",
                  },
                };
              } else {
                return {
                  status: 500,
                  data: { message: "Internal Server Error" },
                };
              }
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          }
        } else if (coin === "INXC") {
          //transfer inxc
          let res = await indexxService.transferIndexxCryptobyAdmin(
            address,
            amount
          );
          if (res.status === 200) {
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.transactionHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: {
                  data: { hash: res.data?.transactionHash },
                  message: "Transaction created",
                },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else if (coin === "IUSD+" || coin === "IUSDP") {
          //transfer iusd+
          let res = await indexxService.transferIndexxUSDPbyAdmin(
            address,
            amount
          );
          if (res.status === 200) {
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.transactionHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: {
                  data: { hash: res.data?.transactionHash },
                  message: "Transaction created",
                },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else if (
          coin === "APPL" ||
          coin === "AAPL" ||
          coin === "TLSA" ||
          coin === "TSLA" ||
          coin === "MSFT" ||
          coin === "META" ||
          coin === "GOOGL" ||
          coin === "PEP" ||
          coin === "BCM" ||
          coin === "AMZN" ||
          coin === "NVDA" ||
          coin === "SNP500"
        ) {
          let contractAddress = "";
          switch (true) {
            case coin.includes("APPL"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxAppleContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxAppleContract.key;
              }
              break;
            case coin.includes("APPL"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxAppleContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxAppleContract.key;
              }
              break;
            case coin.includes("TLSA"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxTelsaContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxTelsaContract.key;
              }
              break;
            case coin.includes("TSLA"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxTelsaContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxTelsaContract.key;
              }
              break;
            case coin.includes("META"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxMetaContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxMetaContract.key;
              }
              break;
            case coin.includes("NVDA"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxNividiaContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxNividaContract.key;
              }
              break;
            case coin.includes("AMZN"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxAmazonContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxAmazonContract.key;
              }
              break;
            case coin.includes("SNP500"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxSNP500Contract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxSNP500Contract.key;
              }
              break;
            case coin.includes("BCM"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxBroadcomContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxBroadcomContract.key;
              }
              break;
            case coin.includes("GOOGL"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxGoogleContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxGoogleContract.key;
              }
              break;
            case coin.includes("MSFT"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxMicrosoftContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxMicrsoftContract.key;
              }
              break;
            case coin.includes("PEP"):
              if (keys.env.key == "prod") {
                contractAddress = keys.MainIndexxPepsiCoContract.key;
              } else if (
                keys.env.key == "test" ||
                keys.env.key == "development"
              ) {
                contractAddress = keys.TestIndexxPepsiCoContract.key;
              }
              break;
            default:
              throw new Error("Type does not support");
          }
          //transfer stock token
          let res = await indexxService.transferIndexxStockbyAdminBNBChain(
            address,
            amount,
            "CEX",
            contractAddress
          );
          if (res.status === 200) {
            //update user wallet
            const wallet = await uservice.updatePart(
              {
                email: user.email,
                userWallets: { $elemMatch: { coinSymbol: coin } },
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -amount,
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            //update tx
            const updateTx = await txservice.updatePart(
              {
                email: user.email,
                orderId: newTx.orderId,
              },
              {
                $set: {
                  txId: res.data?.transactionHash,
                  txDate: new Date(),
                  status: OrderStatus.Completed,
                  from: res.data?.from,
                },
              }
            );

            if (newTx && wallet && updateTx) {
              return {
                status: 200,
                data: {
                  data: { hash: res.data?.transactionHash },
                  message: "Transaction created",
                },
              };
            } else {
              return {
                status: 500,
                data: { message: "Internal Server Error" },
              };
            }
          } else {
            return { status: 500, data: { message: "Internal Server Error" } };
          }
        } else {
          return { status: 400, data: { message: "Invalid coin" } };
        }
      } else {
        return {
          status: 500,
          data: {
            message: "Enough Balance not avalible to withdraw",
          },
        };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async registerFiatWithdraw(req: any, res: any) {
    try {
      let {
        email,
        beneficiaryName,
        routingNumber,
        accountNumber,
        bankName,
        swiftCode,
        addressLine1,
        city,
        state,
        country,
        zipCode,
        amount,
        coin,
      } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }
      // const txDetails = await txservice.findOne({txId: txHash});
      // if(txDetails) {
      //   return {status: 400, data: {message: "Transaction already exists"}};
      // }
      let fullBenificaryDetails = {
        beneficiaryName: beneficiaryName,
        routingNumber: routingNumber,
        accountNumber: accountNumber,
        bankName: bankName,
        swiftCode: swiftCode,
        addressLine1: addressLine1,
        city: city,
        state: state,
        country: country,
        zipCode: zipCode,
      };

      const newTx = await txservice.create({
        email: email,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: "",
        to: accountNumber,
        amount: amount,
        info: "Withdraw fiat by user",
        status: OrderStatus.Pending,
        currencyRef: coin,
        walletType: "ASSET_WALLET",
        transactionType: "WITHDRAW_FIAT",
        exchangeName: "CEX",
        txDate: new Date(),
        benificaryAddress: JSON.stringify(fullBenificaryDetails),
      });

      //send email to user
      await new SendEmail().sendFiatWithdrawNotification(
        user.email,
        beneficiaryName,
        accountNumber,
        routingNumber,
        bankName,
        swiftCode,
        addressLine1,
        city,
        state,
        country,
        zipCode,
        amount,
        "USD"
      );
      //send email to admin
      await new SendEmail().sendFiatWithdrawNotificationToAdmin(
        user.email,
        beneficiaryName,
        accountNumber,
        routingNumber,
        bankName,
        swiftCode,
        addressLine1,
        city,
        state,
        country,
        zipCode,
        amount,
        "USD"
      );

      if (newTx) {
        return { status: 200, data: { message: "Transaction created" } };
      } else {
        return { status: 500, data: { message: "Internal Server Error" } };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async updateFiatWithdrawTx(req: any, res: any) {
    try {
      let { email, orderId, status, notes } = req.body;
      email = String(email).toLowerCase();
      const user = await uservice.findOne({ email: email });
      if (!user) {
        return { status: 404, data: { message: "User not found" } };
      }

      const getTxByOrder = await txservice.findOne({
        email: email,
        orderId: orderId,
      });
      if (getTxByOrder) {
        const updateTx = await txservice.updatePart(
          {
            email: user.email,
            orderId: orderId,
          },
          {
            $set: {
              txId: res.data?.transactionHash,
              txDate: new Date(),
              status: status === "Completed" ? OrderStatus.Completed : status,
              info: notes ? notes : getTxByOrder?.info,
            },
          }
        );
        const parsedAddress = JSON.parse(getTxByOrder.benificaryAddress);
        const beneficiaryName = parsedAddress.beneficiaryName || "NA";
        const accountNumber = parsedAddress.accountNumber || "NA";
        const routingNumber = parsedAddress.routingNumber || "NA";
        const bankName = parsedAddress.bankName || "NA";
        const swiftCode = parsedAddress.swiftCode || "NA";
        const addressLine1 = parsedAddress.addressLine1 || "NA";
        const city = parsedAddress.city || "NA";
        const state = parsedAddress.state || "NA";
        const country = parsedAddress.country || "NA";
        const zipCode = parsedAddress.zipCode || "NA";
        //send email to user
        await new SendEmail().sendFiatWithdrawCompletedNotification(
          user.email,
          beneficiaryName,
          accountNumber,
          routingNumber,
          bankName,
          swiftCode,
          addressLine1,
          city,
          state,
          country,
          zipCode,
          String(getTxByOrder.amount),
          "USD"
        );
        return {
          status: 200,
          data: { message: "Transaction found and updated" },
        };
      } else {
        return { status: 404, data: { message: "Transaction not found" } };
      }
    } catch (err: any) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  //This method can be used for stripe
  async processDEXBuyOrder(orderDetails: any) {
    let checkOrder = await orderService.findOne({
      orderId: orderDetails.orderId,
    });
    let checkStripe = await stripeService.findOne({
      orderId: orderDetails.orderId,
    });
    if (
      checkOrder.status === "ReceivedFiat" &&
      checkStripe.status === "succeeded"
    ) {
      if (checkOrder.breakdown.outCurrencyName === "ETH") {
        let payOut = await indexxService.transferEthereumbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.hash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: orderDetails.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "BNB") {
        let payOut = await indexxService.transferBinancetokenbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.hash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                txId: payOut.data?.txHash,
                txDate: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "IN500") {
        let payOut = {
          status: 400,
          data: {} as any,
        };
        if (checkOrder.blockchainName === "Ethereum") {
          payOut = await indexxService.transferETHIndexx500byAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        } else {
          payOut = await indexxService.transferIndexx500byAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        }
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "INEX") {
        let payOut = {
          status: 400,
          data: {} as any,
        };
        if (checkOrder.blockchainName === "Ethereum") {
          payOut = await indexxService.transferETHIndexxExchangebyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "",
            "",
            "",
            "DEX"
          );
        } else {
          payOut = await indexxService.transferIndexxExchangebyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "",
            "",
            "",
            "DEX"
          );
        }
        console.log(payOut, "payout");
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;
          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "INXC") {
        let payOut = {
          status: 400,
          data: {} as any,
        };
        if (checkOrder.blockchainName === "Ethereum") {
          payOut = await indexxService.transferETHIndexxCryptobyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        } else {
          payOut = await indexxService.transferIndexxCryptobyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        }
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "IUSD+") {
        let payOut = {
          status: 400,
          data: {} as any,
        };
        if (checkOrder.blockchainName === "Ethereum") {
          payOut = await indexxService.transferETHIndexxUSDPbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        } else {
          payOut = await indexxService.transferIndexxUSDPbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        }
        console.log(payOut);
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "BTC") {
        let payOut = await indexxService.transferBitcoinbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.inCurrenyName,
            amount: checkOrder.breakdown.inAmount,
            trnReference: "",
            trnHash: payOut.data,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "LTC") {
        let payOut = await indexxService.transferLitecoinbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.inCurrenyName,
            amount: checkOrder.breakdown.inAmount,
            trnReference: "",
            trnHash: payOut.data.hash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "INXP") {
        let payOut = {
          status: 400,
          data: {} as any,
        };
        if (checkOrder.blockchainName === "Ethereum") {
          payOut = await indexxService.transferETHIndexxPhoenixbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        } else {
          payOut = await indexxService.transferIndexxPhoenixbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        }
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "SRT") {
        let payOut = {
          status: 400,
          data: {} as any,
        };
        if (checkOrder.blockchainName === "Ethereum") {
          payOut = await indexxService.transferSoRektbyAdmin(
            checkOrder.receiverAccount.userReceiveAddress,
            checkOrder.breakdown.outAmount,
            "DEX"
          );
        } else {
          return { status: 500, data: { message: "Only supports Ethereum" } };
        }
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else {
        return { status: 500, data: { message: "Coin not supported" } };
      }
    }
  }

  //This method can be used for Paypal
  async processDEXBuyOrderByPaypal(orderDetails: any) {
    let checkOrder = await orderService.findOne({
      orderId: orderDetails.data.orderId,
    });
    let checkPaypal = await paypalService.findOne({
      orderId: orderDetails.data.orderId,
    });
    console.log(
      checkPaypal.status === "APPROVED" &&
        checkOrder?.orderId === checkPaypal?.orderId
    );
    if (
      checkPaypal.status === "APPROVED" &&
      checkOrder?.orderId === checkPaypal?.orderId
    ) {
      if (checkOrder.breakdown.outCurrencyName === "ETH") {
        let payOut = await indexxService.transferEthereumbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.hash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: orderDetails.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "BNB") {
        let payOut = await indexxService.transferBinancetokenbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.hash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                txId: payOut.data?.txHash,
                txDate: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "IN500") {
        let payOut = await indexxService.transferIndexx500byAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "INEX") {
        let payOut = await indexxService.transferIndexxExchangebyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "",
          "",
          "",
          "DEX"
        );
        console.log(payOut, "payout");
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;
          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "INXC") {
        let payOut = await indexxService.transferIndexxCryptobyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "IUSD+") {
        let payOut = await indexxService.transferIndexxUSDPbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        console.log(payOut);
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "BTC") {
        let payOut = await indexxService.transferBitcoinbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.inCurrenyName,
            amount: checkOrder.breakdown.inAmount,
            trnReference: "",
            trnHash: payOut.data,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "LTC") {
        let payOut = await indexxService.transferLitecoinbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.inCurrenyName,
            amount: checkOrder.breakdown.inAmount,
            trnReference: "",
            trnHash: payOut.data.hash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else if (checkOrder.breakdown.outCurrencyName === "INXP") {
        let payOut = await indexxService.transferIndexxPhoenixbyAdmin(
          checkOrder.receiverAccount.userReceiveAddress,
          checkOrder.breakdown.outAmount,
          "DEX"
        );
        if (payOut.status === 200) {
          let createOrderTX = {
            currency: checkOrder.breakdown.outCurrencyName,
            amount: checkOrder.breakdown.outAmount,
            trnReference: "",
            trnHash: payOut.data.transactionHash,
            walletAddress: checkOrder.receiverAccount.userReceiveAddress,
            created: new Date(),
            status: "Completed",
          } as OrderTransaction;

          //update order
          const updateOrder = await orderService.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txservice.updatePart(
            {
              orderId: checkOrder.orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                orderCompletedOn: new Date(),
              },
            }
          );
          return { status: 200, data: { message: "Order completed" } };
        } else {
          return { status: 500, data: { message: "Internal Server Error" } };
        }
      } else {
        return { status: 500, data: { message: "Coin not supported" } };
      }
    } else {
      return { status: 500, data: { message: "Internal Server Error" } };
    }
  }

  async startDEXBlockchainSubscribe(orderId: string) {
    try {
      const checkOrder = await orderService.findOne({
        orderId: orderId,
      });
      if (checkOrder) {
        let subscribeDetails = await subscribeToTransactions(
          String(checkOrder.receiverAccount?.exchangeReceiveAddress),
          checkOrder.breakdown.inCurrenyName,
          checkOrder.blockchainName,
          checkOrder.orderId
        );
        console.log(subscribeDetails, "subscribeDetails");
        return {
          status: 200,
          data: {
            message: "Subscribed",
            subscriptionDetails: subscribeDetails,
          },
        };
      } else {
        return {
          status: 500,
          data: { message: "Internal Server Error, Order not found" },
        };
      }
    } catch (err) {
      console.log(err);
      return {
        status: 500,
        data: { message: "Internal Server Error, Order not found" },
      };
    }
  }

  async sendCrypto(req: any, res: any) {
    try {
      let getFromUser = await uservice.findOne({
        email: req.body.fromEmail,
      });

      let getToUser = await uservice.findOne({
        email: req.body.toEmail,
      });

      if (getFromUser && getToUser) {
        let getFromUserWallets = getFromUser.userWallets;
        let getToUserWallets = getToUser.userWallets;
        let findFromUserSendCryptoCoin = getFromUserWallets.find(
          (x) => x.coinSymbol === req.body.coin
        ) as UserWallet;
        let findToUserCryptoCoin = getToUserWallets.find(
          (x) => x.coinSymbol === req.body.coin
        ) as UserWallet;
        if (
          !findFromUserSendCryptoCoin ||
          findFromUserSendCryptoCoin.coinBalance >= Number(req.body.amount)
        ) {
          //send crypto to the receiver
          let updateFromUserWallet = await uservice.updatePart(
            {
              email: req.body.fromEmail,
              "userWallets.coinSymbol": req.body.coin,
            },
            {
              $set: {
                "userWallets.$.coinBalance":
                  findFromUserSendCryptoCoin?.coinBalance -
                  Number(req.body.amount),
                coinLastUsedOn: new Date(),
              },
            }
          );
          let updateToUserWallet = await uservice.updatePart(
            {
              email: req.body.toEmail,
              "userWallets.coinSymbol": req.body.coin,
            },
            {
              $set: {
                "userWallets.$.coinBalance":
                  findToUserCryptoCoin?.coinBalance + Number(req.body.amount),
                coinLastUsedOn: new Date(),
              },
            }
          );
        } else {
          return {
            status: 500,
            data: { message: "Insufficient balance to send" },
          };
        }

        return { status: 200, data: { message: "Transaction successful" } };
      } else {
        // Handle the case where one or both users are not found
        if (!getFromUser) {
          return { status: 404, data: { message: "Sender not found" } };
        } else if (!getToUser) {
          return { status: 404, data: { message: "Recipient not found" } };
        } else {
          return {
            status: 500,
            data: { message: "Sender and Recipient not found" },
          };
        }
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async sendCryptoFromUser(req: any, res: any) {
    try {
      if (this.isBTCY(req.body.coin)) {
        return {
          status: 400,
          data: { message: "BTCY transfers are currently disabled" },
        };
      }

      const fromEmail = this.normalizeEmail(req.body.fromEmail);
      const toEmail = this.normalizeEmail(req.body.toEmail);

      if (fromEmail === toEmail) {
        return {
          status: 400,
          data: { message: "Cannot send crypto to your own account" },
        };
      }

      let getFromUser = await uservice.findOne({ email: fromEmail });
      let getToUser = await uservice.findOne({ email: toEmail });

      if (!getFromUser || !getToUser) {
        return {
          status: 404,
          data: { message: "One or both users not found" },
        };
      }

      let findFromUserCoinWallet = getFromUser.userWallets.find(
        (wallet) =>
          wallet.coinSymbol === req.body.coin &&
          (req.body.coin !== "INEX" || wallet.coinNetwork === req.body.network)
      );
      let findToUserCoinWallet = getToUser.userWallets.find(
        (wallet) =>
          wallet.coinSymbol === req.body.coin &&
          (req.body.coin !== "INEX" || wallet.coinNetwork === req.body.network)
      );

      if (!findFromUserCoinWallet) {
        return {
          status: 404,
          data: { message: "Sender does not have the specified coin" },
        };
      }

      if (!findToUserCoinWallet) {
        // Create a wallet for the recipient if not exists
        await orderService.checkAndCreateUserWallet(toEmail, req.body.coin);
        getToUser = await uservice.findOne({ email: toEmail });
        findToUserCoinWallet = getToUser?.userWallets.find(
          (wallet) =>
            wallet.coinSymbol === req.body.coin &&
            (req.body.coin !== "INEX" || wallet.coinNetwork === req.body.network)
        );
      }

      if (!findToUserCoinWallet) {
        return {
          status: 500,
          data: { message: "Recipient wallet could not be prepared" },
        };
      }

      if (findFromUserCoinWallet.coinBalance < Number(req.body.amount)) {
        return { status: 400, data: { message: "Insufficient balance" } };
      }

      // Perform the balance update operations
      let getFromUserWallets = getFromUser.userWallets;
      let getToUserWallets = getToUser.userWallets;
      let findFromUserSendCryptoCoin = getFromUserWallets.find(
        (wallet) =>
          wallet.coinSymbol === req.body.coin &&
          (req.body.coin !== "INEX" || wallet.coinNetwork === req.body.network)
      ) as UserWallet;
      let findToUserCryptoCoin = getToUserWallets.find(
        (wallet) =>
          wallet.coinSymbol === req.body.coin &&
          (req.body.coin !== "INEX" || wallet.coinNetwork === req.body.network)
      ) as UserWallet;

      console.log("findFromUserSendCryptoCoin", findFromUserSendCryptoCoin);
      console.log("findToUserCryptoCoin", findToUserCryptoCoin);
      //send crypto to the receiver
      /* let updateFromUserWallet = await uservice.updatePart(
        {
          email: req.body.fromEmail,
          "userWallets.$.coinSymbol": req.body.coin,
          ...(req.body.coin === "INEX" && {
            "userWallets.$.coinNetwork": req.body.network,
          }),
        },
        {
          $set: {
            "userWallets.$.coinBalance":
              findFromUserSendCryptoCoin?.coinBalance - Number(req.body.amount),
            coinLastUsedOn: new Date(),
          },
        }
      );
      let updateToUserWallet = await uservice.updatePart(
        {
          email: req.body.toEmail,
          "userWallets.$.coinSymbol": req.body.coin,
          ...(req.body.coin === "INEX" && {
            "userWallets.$.coinNetwork": req.body.network,
          }),
        },
        {
          $set: {
            "userWallets.$.coinBalance":
              findToUserCryptoCoin?.coinBalance + Number(req.body.amount),
            coinLastUsedOn: new Date(),
          },
        }
      );*/

      // Modify the update function to use arrayFilters to target the specific wallet more accurately
      let updateFromUserWallet = await uservice.updatePartWithOptions(
        { email: fromEmail },
        {
          $set: {
            "userWallets.$[elem].coinBalance":
              findFromUserSendCryptoCoin?.coinBalance - Number(req.body.amount),
            "userWallets.$[elem].coinLastUsedOn": new Date(),
          },
        },
        {
          arrayFilters: [
            {
              "elem.coinSymbol": req.body.coin,
              ...(req.body.coin === "INEX" && {
                "elem.coinNetwork": req.body.network,
              }),
            },
          ],
        }
      );

      let updateToUserWallet = await uservice.updatePartWithOptions(
        { email: toEmail },
        {
          $set: {
            "userWallets.$[elem].coinBalance":
              findToUserCryptoCoin?.coinBalance + Number(req.body.amount),
            "userWallets.$[elem].coinLastUsedOn": new Date(),
          },
        },
        {
          arrayFilters: [
            {
              "elem.coinSymbol": req.body.coin,
              ...(req.body.coin === "INEX" && {
                "elem.coinNetwork": req.body.network,
              }),
            },
          ],
        }
      );

      console.log("updateFromUserWallet", updateFromUserWallet);
      console.log("updateToUserWallet", updateToUserWallet);
      let createToUserTx = await txservice.create({
        email: toEmail,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: fromEmail,
        to: toEmail,
        amount: req.body.amount,
        exchangeName: "CEX",
        info: `Received crypto from user ${fromEmail}`,
        status: OrderStatus.Completed,
        currencyRef: req.body.coin,
        walletType: "ASSET_WALLET",
        transactionType: "SEND_CRYPTO",
        txDate: new Date(),
        benificaryAddress: "",
      });
      let createFromUserTx = await txservice.create({
        email: fromEmail,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: fromEmail,
        to: toEmail,
        amount: req.body.amount,
        exchangeName: "CEX",
        info: `Sent crypto to user ${toEmail}`,
        status: OrderStatus.Completed,
        currencyRef: req.body.coin,
        walletType: "ASSET_WALLET",
        transactionType: "SEND_CRYPTO",
        txDate: new Date(),
        benificaryAddress: "",
      });
      await new SendEmail().sendToUserNotification(
        toEmail,
        fromEmail,
        req.body.amount,
        req.body.coin
      );
      await new SendEmail().sendFromUserNotification(
        toEmail,
        fromEmail,
        req.body.amount,
        req.body.coin
      );
      return { status: 200, data: { message: "Transaction successful" } };
    } catch (err) {
      console.error(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async sendCryptoFromUserUsingUsername(req: any, res: any) {
    try {
      // Validate request data
      if (
        !req.body.toUsername ||
        !req.body.fromEmail ||
        !req.body.coin ||
        !req.body.amount
      ) {
        return { status: 400, data: { message: "Missing required fields" } };
      }

      if (this.isBTCY(req.body.coin)) {
        return {
          status: 400,
          data: { message: "BTCY transfers are currently disabled" },
        };
      }

      // Find the recipient user
      let toUser = await uservice.findOne({ username: req.body.toUsername });
      let toUserEmail = toUser ? toUser.email : null;
      if (!toUser) {
        const affiliateToUser = await affiliateUser.findOne({
          Username: req.body.toUsername,
        });
        toUserEmail = affiliateToUser ? affiliateToUser.Email : null;
      }

      if (!toUserEmail) {
        return { status: 404, data: { message: "Recipient user not found" } };
      }

      const fromEmail = this.normalizeEmail(req.body.fromEmail);
      toUserEmail = this.normalizeEmail(toUserEmail);

      if (fromEmail === toUserEmail) {
        return {
          status: 400,
          data: { message: "Cannot send crypto to your own account" },
        };
      }

      // Find sender and recipient in the user service
      let getFromUser = await uservice.findOne({ email: fromEmail });
      let getToUser = await uservice.findOne({ email: toUserEmail });

      if (!getFromUser || !getToUser) {
        return {
          status: 404,
          data: { message: "One or both users not found" },
        };
      }

      let findFromUserCoinWallet = getFromUser.userWallets.find(
        (wallet) => wallet.coinSymbol === req.body.coin
      );
      let findToUserCoinWallet = getToUser.userWallets.find(
        (wallet) => wallet.coinSymbol === req.body.coin
      );

      if (!findFromUserCoinWallet) {
        return {
          status: 404,
          data: { message: "Sender does not have the specified coin" },
        };
      }

      if (!findToUserCoinWallet) {
        // Create a wallet for the recipient if not exists
        await orderService.checkAndCreateUserWallet(
          String(toUserEmail),
          req.body.coin
        );
        getToUser = await uservice.findOne({ email: toUserEmail });
        findToUserCoinWallet = getToUser?.userWallets.find(
          (wallet) => wallet.coinSymbol === req.body.coin
        );
      }

      if (!findToUserCoinWallet) {
        return {
          status: 500,
          data: { message: "Recipient wallet could not be prepared" },
        };
      }

      if (findFromUserCoinWallet.coinBalance < Number(req.body.amount)) {
        return { status: 400, data: { message: "Insufficient balance" } };
      }

      // Perform the balance update operations
      let getFromUserWallets = getFromUser.userWallets;
      let getToUserWallets = getToUser.userWallets;
      let findFromUserSendCryptoCoin = getFromUserWallets.find(
        (x) => x.coinSymbol === req.body.coin
      ) as UserWallet;
      let findToUserCryptoCoin = getToUserWallets.find(
        (x) => x.coinSymbol === req.body.coin
      ) as UserWallet;

      //send crypto to the receiver
      let updateFromUserWallet = await uservice.updatePart(
        {
          email: fromEmail,
          "userWallets.coinSymbol": req.body.coin,
        },
        {
          $set: {
            "userWallets.$.coinBalance":
              findFromUserSendCryptoCoin?.coinBalance - Number(req.body.amount),
            coinLastUsedOn: new Date(),
          },
        }
      );
      let updateToUserWallet = await uservice.updatePart(
        {
          email: String(toUserEmail),
          "userWallets.coinSymbol": req.body.coin,
        },
        {
          $set: {
            "userWallets.$.coinBalance":
              findToUserCryptoCoin?.coinBalance + Number(req.body.amount),
            coinLastUsedOn: new Date(),
          },
        }
      );

      let createToUserTx = await txservice.create({
        email: String(toUserEmail),
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: fromEmail,
        to: String(toUserEmail),
        amount: req.body.amount,
        exchangeName: "CEX",
        info: `Received crypto from user ${fromEmail}`,
        status: OrderStatus.Completed,
        currencyRef: req.body.coin,
        walletType: "ASSET_WALLET",
        transactionType: "SEND_CRYPTO",
        txDate: new Date(),
        benificaryAddress: "",
      });
      let createFromUserTx = await txservice.create({
        email: fromEmail,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: fromEmail,
        to: String(toUserEmail),
        amount: req.body.amount,
        exchangeName: "CEX",
        info: `Sent crypto to user ${String(toUserEmail)}`,
        status: OrderStatus.Completed,
        currencyRef: req.body.coin,
        walletType: "ASSET_WALLET",
        transactionType: "SEND_CRYPTO",
        txDate: new Date(),
        benificaryAddress: "",
      });
      await new SendEmail().sendToUserNotification(
        fromEmail,
        String(toUserEmail),
        req.body.amount,
        req.body.coin
      );
      await new SendEmail().sendFromUserNotification(
        String(toUserEmail),
        fromEmail,
        req.body.amount,
        req.body.coin
      );
      return { status: 200, data: { message: "Transaction successful" } };
    } catch (err) {
      console.error(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  /**Helpers */
  async checkCoinTransaction(coin: string, tx: string, coinNetwork: string) {
    try {
      console.log(coin, tx, "coin, tx");
      if (tx !== undefined) {
        if (coin === "BTC") {
          let client;
          if (keys.env.key === "development") {
            client = new Client({ network: "regtest" });
          } else {
            client = new Client({ network: "mainnet" });
          }
          let res = client.getTransactionByHash(tx);
          console.log(res);
          return res;
        } else if (coin === "ETH") {
          const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
          let rpcURL =
            keys.env.key == "development"
              ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
              : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
          console.log("rpcURL", rpcURL);
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          return {
            function_name: "",
            from: getTx.from,
            to: getTx.to,
            transferedAmount: Number(getTx.value) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "BNB") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          return {
            function_name: "",
            from: getTx.from,
            to: getTx.to,
            transferedAmount: Number(getTx.value) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "IN500") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          console.log(rpcURL);
          const IN500ContractAdress =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.TestIndexx500Contract.key
              : keys.MainIndexx500Contract.key;
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          if (
            IN500ContractAdress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }
          const iface = new ethers.utils.Interface(Indexx500tokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "INEX") {
          if (coinNetwork === "Polygon") {
            const rpcURL =
              keys.env.key == "development" || keys.env.key == "test"
                ? keys.MATIC_RPC_TEST.key
                : keys.MATIC_RPC_MAIN.key;
            const INEXContractAdress =
              keys.env.key == "development" || keys.env.key == "test"
                ? keys.TestMaticIndexxExContract.key
                : keys.MainMaticIndexxExContract.key;
            let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
            let getTx = await rpcProvider.getTransaction(tx);

            if (
              INEXContractAdress.toLocaleLowerCase().localeCompare(
                String(getTx?.to).toLocaleLowerCase()
              ) !== 0
            ) {
              return {
                function_name: "",
                from: getTx.from,
                to: "",
                transferedAmount: 0,
                confirmations: 0,
              };
            }
            const iface = new ethers.utils.Interface(IndexxExtokenABI);
            let decodedData = iface.parseTransaction({
              data: getTx.data,
              value: getTx.value,
            });
            console.log("decodedData", decodedData);

            // Return Decoded Transaction
            return {
              function_name: decodedData.name,
              from: getTx.from,
              to: decodedData.args[0],
              transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
              confirmations: getTx.confirmations,
            };
          } else {
            const rpcURL =
              keys.env.key == "development" || keys.env.key == "test"
                ? keys.QUICKNODE_BNB_TEST.key
                : keys.QUICKNODE_BNB_MAIN.key;
            const INEXContractAdress =
              keys.env.key == "development" || keys.env.key == "test"
                ? keys.TestIndexxExContract.key
                : keys.MainIndexxExContract.key;
            let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
            let getTx = await rpcProvider.getTransaction(tx);

            if (
              INEXContractAdress.toLocaleLowerCase().localeCompare(
                String(getTx?.to).toLocaleLowerCase()
              ) !== 0
            ) {
              return {
                function_name: "",
                from: getTx.from,
                to: "",
                transferedAmount: 0,
                confirmations: 0,
              };
            }
            const iface = new ethers.utils.Interface(IndexxExtokenABI);
            let decodedData = iface.parseTransaction({
              data: getTx.data,
              value: getTx.value,
            });
            console.log("decodedData", decodedData);

            // Return Decoded Transaction
            return {
              function_name: decodedData.name,
              from: getTx.from,
              to: decodedData.args[0],
              transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
              confirmations: getTx.confirmations,
            };
          }
        } else if (coin === "WIBS") {
          const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
          let rpcURL =
            keys.env.key == "development"
              ? "https://sepolia.infura.io/v3/" + YOUR_INFURA_API_KEY
              : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
          console.log("rpcURL", rpcURL);
          const WIBSContractAdress =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.TestWIBSContract.key
              : keys.MainWIBSContract.key;
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          console.log("getTx", getTx);
          if (
            WIBSContractAdress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }
          const iface = new ethers.utils.Interface(testWIBSTokenAbi);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });
          console.log("decodedData", decodedData);

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "IUSD+") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          const INUSDPContractAdress =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.TestIndexxUSDPContract.key
              : keys.MainIndexxUSDPContract.key;
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          if (
            INUSDPContractAdress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }
          const iface = new ethers.utils.Interface(IndexxUSDPtokenABI);
          console.log("iface", iface);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "INXC") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          const INXCContractAdress =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.TestIndexxCryptoContract.key
              : keys.MainIndexxCryptoContract.key;
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          console.log(getTx, "getTX");
          if (
            INXCContractAdress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }
          const iface = new ethers.utils.Interface(IndexxCryptotokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "FTT_ETH" || coin === "FTT") {
          const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
          let rpcURL =
            keys.env.key == "development"
              ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
              : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
          console.log("rpcURL", rpcURL);
          const FTTContractAdress =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.TestFTTContract.key
              : keys.MainFTTContract.key;
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          console.log(getTx, "getTX");
          if (
            FTTContractAdress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }
          const iface = new ethers.utils.Interface(TestFTTTokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "XRP") {
          const apiURL =
            keys.env.key === "development" || keys.env.key === "test"
              ? "https://s.altnet.rippletest.net:51234" // This is a commonly used public testnet
              : "https://s2.ripple.com:51234"; // Mainnet

          const body = {
            method: "tx",
            params: [
              {
                transaction: tx,
                binary: false,
              },
            ],
          };

          const response = await fetch(apiURL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          const txHash = data.result;

          return {
            from: txHash.Account,
            to: txHash.Destination,
            transferedAmount: Number(txHash.Amount) / Math.pow(10, 6), // XRP has 6 decimals
            confirmations: txHash.confirmations, // This might vary based on the API endpoint
          };
        } else if (coin === "DOGE") {
          const apiURL = `https://dogechain.info/api/v1/transaction/${tx}`;

          const response = await fetch(apiURL);
          const data = await response.json();
          const txHash = data.data;

          return {
            from: txHash.inputs[0].address, // Simplifying to consider the first input
            to: txHash.outputs[0].address, // Simplifying to consider the first output
            transferedAmount: Number(txHash.outputs[0].value) / Math.pow(10, 8), // Dogecoin has 8 decimals
            confirmations: txHash.confirmations,
          };
        } else if (coin === "USDC") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          const rpcProvider =
            keys.env.key === "development" || keys.env.key === "test"
              ? new ethers.providers.JsonRpcProvider(rpcURL)
              : new ethers.providers.JsonRpcProvider(rpcURL);

          const usdcAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.USDC_TESTNET_ADDRESS.key
              : keys.USDC_MAINNET_ADDRESS.key;

          let getTx = await rpcProvider.getTransaction(tx);

          if (
            usdcAddress
              .toLocaleLowerCase()
              .localeCompare(String(getTx?.to).toLocaleLowerCase()) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "USDT") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          const provider =
            keys.env.key === "development" || keys.env.key === "test"
              ? new ethers.providers.JsonRpcProvider(rpcURL)
              : new ethers.providers.JsonRpcProvider(rpcURL);

          const usdcAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.USDT_TESTNET_ADDRESS.key
              : keys.USDT_MAINNET_ADDRESS.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          if (
            usdcAddress
              .toLocaleLowerCase()
              .localeCompare(String(getTx?.to).toLocaleLowerCase()) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "MATIC") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.MATIC_RPC_TEST.key
              : keys.MATIC_RPC_MAIN.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          return {
            function_name: "",
            from: getTx.from,
            to: getTx.to,
            transferedAmount: Number(getTx.value) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "SOL") {
          const url =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.SOLANA_TESTNET_URL.key
              : keys.SOLANA_MAINNET_URL.key;

          const connection = new solanaWeb3.Connection(url, "confirmed");

          const transactionDetails = await connection.getConfirmedTransaction(
            tx
          );

          if (!transactionDetails) {
            throw new Error("Transaction not found");
          }

          // Simplifying extraction - decoding and processing would be required for detailed info
          const firstInstruction =
            transactionDetails.transaction.message.instructions[0];
          const programId = firstInstruction.programId.toBase58();

          return {
            txHash: tx,
            programId: programId,
            data: firstInstruction.data, // This is the encoded instruction data
          };
        } else if (coin === "TRX") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          const provider =
            keys.env.key === "development" || keys.env.key === "test"
              ? new ethers.providers.JsonRpcProvider(rpcURL)
              : new ethers.providers.JsonRpcProvider(rpcURL);

          const usdcAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.TRX_TESTNET_ADDRESS.key
              : keys.TRX_MAINNET_ADDRESS.key;

          const topicTransfer = utils.id("Transfer(address,address,uint256)");
          const topicAddress = "0x" + usdcAddress.slice(2).padStart(64, "0"); // Convert address to 32 bytes

          const logs = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            address: usdcAddress,
            topics: [topicTransfer, null, topicAddress],
          });

          const transactions = logs.map((log) => {
            const decoded = utils.defaultAbiCoder.decode(
              ["address", "address", "uint256"],
              log.data
            );
            return {
              txHash: log.transactionHash,
              from: decoded[0],
              to: decoded[1],
              amount: decoded[2].toString() / Math.pow(10, 18), // Assuming USDC on BSC has 18 decimals
            };
          });

          return transactions;
        } else if (coin === "DAI") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;

          const DAIContractAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.DAI_TESTNET_CONTRACT.key
              : keys.DAI_MAINNET_CONTRACT.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          if (
            DAIContractAddress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "LINK") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;
          const provider =
            keys.env.key === "development" || keys.env.key === "test"
              ? new ethers.providers.JsonRpcProvider(rpcURL)
              : new ethers.providers.JsonRpcProvider(rpcURL);

          const LINKAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.LINK_TESTNET_CONTRACT.key
              : keys.LINK_MAINNET_CONTRACT.key;

          const topicTransfer = utils.id("Transfer(address,address,uint256)");
          const topicAddress = "0x" + LINKAddress.slice(2).padStart(64, "0"); // Convert address to 32 bytes

          const logs = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            address: LINKAddress,
            topics: [topicTransfer, null, topicAddress],
          });

          const transactions = logs.map((log) => {
            const decoded = utils.defaultAbiCoder.decode(
              ["address", "address", "uint256"],
              log.data
            );
            return {
              txHash: log.transactionHash,
              from: decoded[0],
              to: decoded[1],
              amount: decoded[2].toString() / Math.pow(10, 18), // Assuming USDC on BSC has 18 decimals
            };
          });

          return transactions;
        } else if (coin === "SHIB") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;

          const SHIBContractAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.SHIB_TESTNET_CONTRACT.key
              : keys.SHIB_MAINNET_CONTRACT.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          if (
            SHIBContractAddress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "TON") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;

          const SHIBContractAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.TONCOIN_TESTNET_ADDRESS.key
              : keys.TONCOIN_MAINNET_ADDRESS.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          if (
            SHIBContractAddress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "LEO") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.ETH_RPC_TEST.key
              : keys.ETH_RPC_MAIN.key;

          const SHIBContractAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.LEO_TESTNET_ADDRESS.key
              : keys.LEO_MAINNET_ADDRESS.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          if (
            SHIBContractAddress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "TUSD") {
          const rpcURL =
            keys.env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;

          const SHIBContractAddress =
            keys.env.key === "development" || keys.env.key === "test"
              ? keys.TUSD_TESTNET_ADDRESS.key
              : keys.TUSD_MAINNET_ADDRESS.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          if (
            SHIBContractAddress.toLocaleLowerCase().localeCompare(
              String(getTx?.to).toLocaleLowerCase()
            ) !== 0
          ) {
            return {
              function_name: "",
              from: getTx.from,
              to: "",
              transferedAmount: 0,
              confirmations: 0,
            };
          }

          const iface = new ethers.utils.Interface(ERC20_ABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        }
      } else {
        return false;
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }

  async dexCheckCoinTransaction(
    coin: string,
    tx: string,
    blockchain: string = ""
  ) {
    try {
      console.log(coin, tx, blockchain, "coin, tx");
      if (tx !== undefined) {
        if (coin === "BTC") {
          let client;
          if (keys.dex_env.key === "development") {
            client = new Client({ network: "regtest" });
          } else {
            client = new Client({ network: "mainnet" });
          }
          let res = client.getTransactionByHash(tx);
          console.log(res);
          return res;
        } else if (coin === "ETH") {
          const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
          let rpcURL =
            keys.dex_env.key == "development"
              ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
              : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
          console.log("rpcURL", rpcURL);
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          return {
            function_name: "",
            from: getTx.from,
            to: getTx.to,
            transferedAmount: Number(getTx.value) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "BNB") {
          const rpcURL =
            keys.dex_env.key == "development" || keys.env.key == "test"
              ? keys.QUICKNODE_BNB_TEST.key
              : keys.QUICKNODE_BNB_MAIN.key;

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          return {
            function_name: "",
            from: getTx.from,
            to: getTx.to,
            transferedAmount: Number(getTx.value) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "IN500") {
          let rpcURL;
          if (blockchain === "Ethereum") {
            const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
            rpcURL =
              keys.dex_env.key == "development"
                ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
                : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
            console.log("rpcURL", rpcURL);
          } else {
            rpcURL =
              keys.dex_env.key == "development" || keys.env.key == "test"
                ? keys.QUICKNODE_BNB_TEST.key
                : keys.QUICKNODE_BNB_MAIN.key;
            console.log(rpcURL);
          }
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          const iface = new ethers.utils.Interface(Indexx500tokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "INEX") {
          let rpcURL;
          if (blockchain === "Ethereum") {
            const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
            rpcURL =
              keys.dex_env.key == "development"
                ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
                : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
            console.log("rpcURL", rpcURL);
          } else {
            rpcURL =
              keys.dex_env.key == "development" || keys.env.key == "test"
                ? keys.QUICKNODE_BNB_TEST.key
                : keys.QUICKNODE_BNB_MAIN.key;
          }
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          const iface = new ethers.utils.Interface(IndexxExtokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "IUSD+") {
          let rpcURL;
          if (blockchain === "Ethereum") {
            const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
            rpcURL =
              keys.dex_env.key == "development"
                ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
                : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
            console.log("rpcURL", rpcURL);
          } else {
            rpcURL =
              keys.dex_env.key == "development" || keys.env.key == "test"
                ? keys.QUICKNODE_BNB_TEST.key
                : keys.QUICKNODE_BNB_MAIN.key;
          }
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);

          const iface = new ethers.utils.Interface(IndexxUSDPtokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "INXC") {
          let rpcURL;
          if (blockchain === "Ethereum") {
            const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
            rpcURL =
              keys.dex_env.key == "development"
                ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
                : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
            console.log("rpcURL", rpcURL);
          } else {
            rpcURL =
              keys.dex_env.key == "development" || keys.env.key == "test"
                ? keys.QUICKNODE_BNB_TEST.key
                : keys.QUICKNODE_BNB_MAIN.key;
          }
          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          console.log(getTx, "getTX");
          const iface = new ethers.utils.Interface(IndexxCryptotokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        } else if (coin === "FTT") {
          const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
          let rpcURL =
            keys.env.key == "development"
              ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
              : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
          console.log("rpcURL", rpcURL);

          let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
          let getTx = await rpcProvider.getTransaction(tx);
          console.log(getTx, "getTX");
          const iface = new ethers.utils.Interface(TestFTTTokenABI);
          let decodedData = iface.parseTransaction({
            data: getTx.data,
            value: getTx.value,
          });

          // Return Decoded Transaction
          return {
            function_name: decodedData.name,
            from: getTx.from,
            to: decodedData.args[0],
            transferedAmount: Number(decodedData.args[1]) / Math.pow(10, 18),
            confirmations: getTx.confirmations,
          };
        }
      } else {
        return false;
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: { message: "Unhandled error: " + err } };
    }
  }
}
