import Web3 from 'web3';

// Connect to the Ethereum network
const web3 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws/v3/YOUR-API-KEY'));

// Set the address that you want to listen for transactions on
const address = "0x123456...";

// Create a new subscription for new transactions on the address
const subscription = web3.eth.subscribe(
  "newBlockHeaders",
  (error: any, result: any) => {
    if (error) {
      console.error(error);
    } else {
      // Check for new transactions on the address
      web3.eth.getTransactionCount(address).then((transactionCount: any) => {
        // If there are new transactions, send a notification
        if (transactionCount > 0) {
          sendNotification();
        }
      });
    }
  }
);

function sendNotification() {
  // Send a notification using your preferred method (e.g. email, SMS, push notification, etc.)
}

// Unsubscribe from the subscription when you are done
subscription.unsubscribe((error:any, success :any) => {
  if (error) {
    console.error(error);
  } else {
    console.log("Successfully unsubscribed!");
  }
});
