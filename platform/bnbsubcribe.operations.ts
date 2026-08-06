import Web3 from "web3";
import { ethers } from "ethers";
import { keys } from "../config/keys";
import { IndexxExtokenABI } from "../helpers/test_indexxexchange";
import { Indexx500tokenABI } from "../helpers/test_indexx500";
import { IndexxUSDPtokenABI } from "../helpers/test_indexxusdp";
import { IndexxCryptotokenABI } from "../helpers/test_indexxcrypto";
import { TestFTTTokenABI } from "../helpers/test_fttToken";
import { CoreWalletService } from "../services/coreWallet.service";
import { TransactionService } from "../services/transaction.service";
import { OrderStatus, OrderTransaction } from "../data/order";
import { OrderService } from "../services/order.service";
import { IndexxService } from "../services/IndexxTokens.service";
const Client = require("bitcoin-core");
const coreWalletService: CoreWalletService = new CoreWalletService();
const txService: TransactionService = new TransactionService();
const orderService: OrderService = new OrderService();
const indexxService: IndexxService = new IndexxService();
let subscribeDetails: any;
export async function subscribeToTransactions(
  address: string,
  coin: string,
  blockchain: string,
  orderId: string
) {
  //console.log(NODE_URL);
  try {
    let wsURL = "";
    if (blockchain === "Ethereum") {
      if (keys.dex_env.key === "test" || keys.dex_env.key == "development") {
        wsURL = keys.ETH_MAIN_WS_URL.key;
      } else if (keys.dex_env.key == "prod") {
        wsURL = keys.ETH_TEST_WS_URL.key;
      }
    } else if (blockchain === "Binance") {
      if (keys.dex_env.key === "test" || keys.dex_env.key == "development") {
        wsURL = keys.BSC_TEST_WS_URL.key;
      } else if (keys.dex_env.key == "prod") {
        wsURL = keys.BSC_MAIN_WS_URL.key;
      }
    }
    console.log(wsURL, "wsURL");
    // Create a new web3 instance and connect to the Infura API endpoint for the Ethereum mainnet
    const web3 = new Web3(new Web3.providers.WebsocketProvider(wsURL));

    let subscription: any;

    subscription = web3.eth
      .subscribe("newBlockHeaders", async function (error, result) {
        if (error) return console.error(error);
        console.log(`New block detected: #${result.number}`);
        // const block = await web3.eth.getBlock(result.number);
        // block.transactions.forEach(async (transactionHash) => {
        //   console.log(transactionHash, "txhash");
        //   let valueTx = await getTx(
        //     transactionHash,
        //     address,
        //     coin,
        //     blockchain
        //   );
        //   console.log(valueTx, "value");
        //   if (valueTx?.confirmations >= 3) {
        //     console.log("Transaction confirmed");
        //     await subscription.unsubscribe((error: any, success: any) => {
        //       if (error) return console.error(error);
        //       console.log("Subscription cancelled");
        //       return valueTx;
        //     });
        //   } else {
        //     console.log("unknow Transaction");
        //   }
        // });
      })
      .on("data", async function (transaction: any) {
        console.log(`New block detected: #${transaction.number} in on`);

        const block = await web3.eth.getBlock(transaction.number);
        block.transactions.forEach(async (transactionHash) => {
          console.log(transactionHash, "txhash");
          let valueTx = await getTx(transactionHash, address, coin, blockchain);
          console.log(valueTx, "value");
          if (valueTx?.confirmations >= 3) {
            subscribeDetails = valueTx;
            console.log("Transaction confirmed");
            await subscription.unsubscribe(async (error: any, success: any) => {
              if (error) return console.error(error);
              let updateTx = await checkandUpdateTx(valueTx, orderId);
              if (updateTx.status === 200) {
                console.log("Transaction updated");
                let confirmUpdate = await confirmExchange(orderId);
                if (confirmUpdate.status === 200) {
                  console.log("Subscription cancelled");
                  subscribeDetails = valueTx;
                  return valueTx;
                } else {
                  console.log("Subscription cancelled");
                  console.log("failed to sent the crypto")
                }
              }
            });
          } else {
            console.log("unknow Transaction");
          }
        });
      })
      .on("error", console.error);
    // Cancel the subscription after 15 minutes (900000 milliseconds)
    setTimeout(() => {
      subscription.unsubscribe((error: any, success: any) => {
        if (error) return console.error(error);
        console.log("Subscription cancelled");
        //process.exit(0);
      });
    }, 10 * 60000);
  } catch (err) {
    console.log("err", err);
  }
}

export async function getTx(
  tx: string,
  address: string,
  coin: string,
  blockchain: string
) {
  try {
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
        console.log(getTx?.data.substring(0, 9));
        console.log("not token transfer");
        if (getTx.to === address) {
          const confs = await getConfirmations(tx, blockchain);
          if (confs >= 3) {
            console.log("Transaction confirmed");
            return {
              function_name: "",
              from: getTx.from,
              to: getTx.to,
              transferedAmount: Number(getTx.value) / Math.pow(10, 18),
              confirmations: getTx.confirmations,
              coin: coin,
              txHash: tx,
            };
          }
        } else {
          console.log("not found in this tranasctio");
        }
      } else if (coin === "BNB") {
        const rpcURL =
          keys.dex_env.key == "development" || keys.env.key == "test"
            ? keys.QUICKNODE_BNB_TEST.key
            : keys.QUICKNODE_BNB_MAIN.key;

        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let getTx = await rpcProvider.getTransaction(tx);

        console.log(getTx?.data.substring(0, 9));
        console.log("not token transfer");
        if (getTx.to === address) {
          const confs = await getConfirmations(tx, blockchain);
          if (confs >= 3) {
            console.log("Transaction confirmed");
            return {
              function_name: "",
              from: getTx.from,
              to: getTx.to,
              transferedAmount: Number(getTx.value) / Math.pow(10, 18),
              confirmations: getTx.confirmations,
              coin: coin,
              txHash: tx,
            };
          }
        } else {
          console.log("not found in this tranasctio");
        }
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
        let decodedData: any;
        if (getTx?.data.startsWith("0xa9059cbb")) {
          console.log("token transfer");
          const iface = new ethers.utils.Interface(Indexx500tokenABI);
          console.log(iface, iface)
          decodedData = iface.parseTransaction({
            data: getTx?.data,
            value: getTx?.value,
          });
          if (decodedData?.args[0] === address) {
            console.log(
              Number(decodedData.args[1]) / Math.pow(10, 18),
              "value"
            );
            const confs = await getConfirmations(tx, blockchain);
            if (confs >= 3) {
              console.log("Transaction confirmed");
              // Return Decoded Transaction
              return {
                function_name: decodedData.name,
                from: getTx.from,
                to: decodedData.args[0],
                transferedAmount:
                  Number(decodedData.args[1]) / Math.pow(10, 18),
                confirmations: confs,
                coin: coin,
                txHash: tx,
              };
            }
          } else {
            console.log("not found in this tranasctio");
          }
        } else {
          console.log(getTx?.data.substring(0, 9));
          console.log("not token transfer");
        }
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
        let decodedData: any;
        if (getTx?.data.startsWith("0xa9059cbb")) {
          console.log("token transfer");
          const iface = new ethers.utils.Interface(IndexxExtokenABI);
          decodedData = iface.parseTransaction({
            data: getTx?.data,
            value: getTx?.value,
          });
          if (decodedData?.args[0] === address) {
            console.log(
              Number(decodedData.args[1]) / Math.pow(10, 18),
              "value"
            );
            const confs = await getConfirmations(tx, blockchain);
            if (confs >= 3) {
              console.log("Transaction confirmed");
              // Return Decoded Transaction
              return {
                function_name: decodedData.name,
                from: getTx.from,
                to: decodedData.args[0],
                transferedAmount:
                  Number(decodedData.args[1]) / Math.pow(10, 18),
                confirmations: confs,
                coin: coin,
                txHash: tx,
              };
            }
          } else {
            console.log("not found in this tranasctio");
          }
        } else {
          console.log(getTx?.data.substring(0, 9));
          console.log("not token transfer");
        }
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
        let decodedData: any;
        if (getTx?.data.startsWith("0xa9059cbb")) {
          console.log("token transfer");
          const iface = new ethers.utils.Interface(IndexxUSDPtokenABI);
          decodedData = iface.parseTransaction({
            data: getTx?.data,
            value: getTx?.value,
          });
          if (decodedData?.args[0] === address) {
            console.log(
              Number(decodedData.args[1]) / Math.pow(10, 18),
              "value"
            );
            const confs = await getConfirmations(tx, blockchain);
            if (confs >= 3) {
              console.log("Transaction confirmed");
              // Return Decoded Transaction
              return {
                function_name: decodedData.name,
                from: getTx.from,
                to: decodedData.args[0],
                transferedAmount:
                  Number(decodedData.args[1]) / Math.pow(10, 18),
                confirmations: confs,
                coin: coin,
                txHash: tx,
              };
            }
          } else {
            console.log("not found in this tranasctio");
          }
        } else {
          console.log(getTx?.data.substring(0, 9));
          console.log("not token transfer");
        }
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
        let decodedData: any;
        if (getTx?.data.startsWith("0xa9059cbb")) {
          console.log("token transfer");
          const iface = new ethers.utils.Interface(IndexxCryptotokenABI);
          decodedData = iface.parseTransaction({
            data: getTx?.data,
            value: getTx?.value,
          });
          if (decodedData?.args[0] === address) {
            console.log(
              Number(decodedData.args[1]) / Math.pow(10, 18),
              "value"
            );
            const confs = await getConfirmations(tx, blockchain);
            if (confs >= 3) {
              console.log("Transaction confirmed");
              // Return Decoded Transaction
              return {
                function_name: decodedData.name,
                from: getTx.from,
                to: decodedData.args[0],
                transferedAmount:
                  Number(decodedData.args[1]) / Math.pow(10, 18),
                confirmations: confs,
                coin: coin,
                txHash: tx,
              };
            }
          } else {
            console.log("not found in this tranasctio");
          }
        } else {
          console.log(getTx?.data.substring(0, 9));
          console.log("not token transfer");
        }
      } else if (coin === "FTT") {
        const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
        let rpcURL =
          keys.env.key == "development"
            ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
        console.log("rpcURL", rpcURL);

        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let decodedData: any;
        let getTx = await rpcProvider.getTransaction(tx);
        if (getTx?.data.startsWith("0xa9059cbb")) {
          console.log("token transfer");
          const iface = new ethers.utils.Interface(TestFTTTokenABI);
          decodedData = iface.parseTransaction({
            data: getTx?.data,
            value: getTx?.value,
          });
          if (decodedData?.args[0] === address) {
            console.log(
              Number(decodedData.args[1]) / Math.pow(10, 18),
              "value"
            );
            const confs = await getConfirmations(tx, blockchain);
            if (confs >= 3) {
              console.log("Transaction confirmed");
              // Return Decoded Transaction
              return {
                function_name: decodedData.name,
                from: getTx.from,
                to: decodedData.args[0],
                transferedAmount:
                  Number(decodedData.args[1]) / Math.pow(10, 18),
                confirmations: confs,
                coin: coin,
                txHash: tx,
              };
            }
          } else {
            console.log("not found in this tranasctio");
          }
        } else {
          console.log(getTx?.data.substring(0, 9));
          console.log("not token transfer");
        }
      }
    } else {
      return false;
    }
  } catch (err) {
    console.log(err);
    console.log("err in subscribe getTx");
  }
}

async function getConfirmations(transactionHash: string, blockchain: string) {
  let wsURL = "";
  if (blockchain === "Ethereum") {
    if (keys.dex_env.key === "test" || keys.dex_env.key == "development") {
      wsURL = keys.ETH_MAIN_WS_URL.key;
    } else if (keys.dex_env.key == "prod") {
      wsURL = keys.ETH_TEST_WS_URL.key;
    }
  } else if (blockchain === "Binance") {
    if (keys.dex_env.key === "test" || keys.dex_env.key == "development") {
      wsURL = keys.BSC_TEST_WS_URL.key;
    } else if (keys.dex_env.key == "prod") {
      wsURL = keys.BSC_MAIN_WS_URL.key;
    }
  }
  console.log(wsURL, "wsURL");
  // Create a new web3 instance and connect to the Infura API endpoint for the Ethereum mainnet
  const web3 = new Web3(new Web3.providers.WebsocketProvider(wsURL));
  let confirmations = 0;
  while (confirmations <= 3) {
    const receipt = await web3.eth.getTransactionReceipt(transactionHash);
    const currentBlockNumber = await web3.eth.getBlockNumber();
    confirmations = currentBlockNumber - receipt.blockNumber + 1;
  }
  console.log(`Transaction has ${confirmations} confirmations`);
  return confirmations;
}

export async function checkandUpdateTx(checkStatus: any, orderId: string) {
  try {
    let getCoreWallet = await coreWalletService.findOne({
      coin: checkStatus.coin,
    });
    let orderDetails = await orderService.findOne({
      orderId: orderId,
    });
    console.log(checkStatus, "checkStatus in checkandUpdateTX");
    if (
      checkStatus &&
      checkStatus.confirmations >= 3 &&
      checkStatus.transferedAmount != 0 &&
      checkStatus.transferedAmount == orderDetails.breakdown.inAmount &&
      String(getCoreWallet.coinAddress).toLocaleLowerCase ===
        String(checkStatus.to).toLocaleLowerCase
    ) {
      const newTx = await txService.create({
        email: orderDetails.user.email,
        userWalletAddress: checkStatus.from,
        orderId: orderId,
        extRef: "",
        txId: checkStatus.txHash,
        from: checkStatus.from,
        to: checkStatus.to,
        amount: checkStatus.transferedAmount,
        info: "Deposit crypto by user",
        status: OrderStatus.ReceivedDeposit,
        currencyRef: checkStatus.coin,
        exchangeName: "DEX",
        walletType: "CORE WALLET",
        transactionType: "DEPOSIT_CRYPTO",
        txDate: new Date(),
        benificaryAddress: ""
      });
      //get orderDetails
      let getOrderDetails = await orderService.findOne({
        orderId: orderId,
        exchangeName: orderDetails.exchangeName,
      });

      let createOrderTX = {
        currency: getOrderDetails.breakdown.inCurrenyName,
        amount: getOrderDetails.breakdown.inAmount,
        trnReference: "",
        trnHash: checkStatus.txHash,
        walletAddress: getCoreWallet.coinAddress,
        created: new Date(),
        status: "Completed",
      } as OrderTransaction;

      //update user DEX order
      const order = await orderService.updatePart(
        {
          orderId: orderId,
          exchangeName: orderDetails.exchangeName,
        },
        {
          $set: {
            status: OrderStatus.ReceivedDeposit,
            orderCompletedOn: new Date(),
            transactions: getOrderDetails.transactions?.concat(createOrderTX),
          },
        }
      );
    }
    console.log("Transaction updated successfully and closing this function");
    return {
      status: 200,
      data: {
        message: "Transaction updated successfully",
      },
    };
  } catch (err) {
    return {
      status: 500,
      data: {
        message: "Transaction failed to update",
      },
    };
  }
}

async function confirmExchange(orderId: string) {
  try {
    let checkOrder = await orderService.findOne({
      orderId: orderId,
    });
    console.log("checkOrder", checkOrder);
    let getTX = await txService.findOne({
      orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
                orderCompletedOn: new Date(),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
              orderId: orderId,
            },
            {
              $set: {
                orderCompletedOn: new Date(),
                status: OrderStatus.Completed,
                transactions: checkOrder.transactions?.concat(createOrderTX),
              },
            }
          );

          //update tx
          const txUpdate = await txService.updatePart(
            {
              orderId: orderId,
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
      return { status: 400, data: { message: "Order not completed" } };
    }
  } catch (err) {
    return { status: 500, data: err };
  }
}
//subscribeToTransactions("0x35EAd16cbd74AB6380aB9ad91266dc407149652f");
/*
import Web3 from 'web3';

const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/YOUR_INFURA_API_KEY'));

const transactionHash = '0x1234567890...';

let receipt: Web3.TransactionReceipt | null = null;

async function subscribe(): Promise<void> {
  let subscription: Web3.Eth.Subscription<any>;
  while (!subscription || !subscription.closed) {
    subscription = web3.eth.subscribe('newBlockHeaders', function(error, result){
      if (error) return console.error(error);
      console.log(result);
    })
    .on('data', async function(blockHeader){
      console.log(`New block detected: #${blockHeader.number}`);
      receipt = await web3.eth.getTransactionReceipt(transactionHash);
      const currentBlockNumber = await web3.eth.getBlockNumber();
      const confirmations = currentBlockNumber - receipt.blockNumber + 1;
      if (confirmations > 3) {
        console.log(`Transaction has ${confirmations} confirmations, cancelling subscription`);
        await subscription.unsubscribe((error, success) => {
          if (error) return console.error(error);
          console.log(success

*/
