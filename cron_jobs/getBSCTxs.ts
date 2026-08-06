import { WalletOperations } from "../platform/wallet.operations";

//wss://dawn-twilight-model.bsc-testnet.discover.quiknode.pro/fa432b4f1daf53252e2b478f7064f5c67ddec17f/
//const nodeCron = require("node-cron");

console.log("Running BSC Transaction Job");
const Web3 = require("web3");
const url =
  "wss://dawn-twilight-model.bsc-testnet.discover.quiknode.pro/fa432b4f1daf53252e2b478f7064f5c67ddec17f/";

const options = {
  timeout: 30000,
  clientConfig: {
    maxReceivedFrameSize: 100000000,
    maxReceivedMessageSize: 100000000,
  },
  reconnect: {
    auto: true,
    delay: 5000,
    maxAttempts: 15,
    onTimeout: false,
  },
};

const web3 = new Web3(new Web3.providers.WebsocketProvider(url, options));
const subscription = web3.eth.subscribe(
  "pendingTransactions",
  (err: any, res: any) => {
    if (err) console.error(err);
  }
);

const account1 = "0x9a327efba5e175fb240f1b8b9326bdf10d9297b1"; // Your test address 1
const account2 = "0x098ae960d858add2c268ece1819e8f7545fec5ce"; // A second test address

export async function runBSCTransactionJob() {
  try {
    subscription.on("data", (txHash: any) => {
      setTimeout(async () => {
        try {
          const tx = await web3.eth.getTransaction(txHash);
          if (tx.to === account1) {
            console.log("Receiving some eth for account 1: ", tx);
          } else if (tx.to === account2) {
            console.log("Receiving some eth for account 2: ", tx);
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  } catch (err) {
    console.log(err);
  }
}
