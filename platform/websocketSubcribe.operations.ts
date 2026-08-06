import WebSocket from "ws";


// Set the API key and Ethereum address that you want to listen for transactions on
const API_KEY = 'YOUR_API_KEY';
const ETH_ADDRESS = '0x123456...';
// Set the duration of the subscriptions (in milliseconds)
const SUBSCRIPTION_DURATION = 2 * 60 * 1000;
// Connect to the Alchemy WebSocket API
const ws = new WebSocket(`wss://eth.alchemyapi.io/v1/ws?api_key=${API_KEY}`);

export async function subscribe(address: string) {
  // Subscribe to events for the Ethereum address
  ws.send(JSON.stringify({
    event: 'eth_subscribe',
    params: {
      address: ETH_ADDRESS
    }
  }));
}

ws.on('open', () => {
  subscribe(ETH_ADDRESS);
});

ws.on('message', (data: string) => {
  // Parse the data as JSON
  const message = JSON.parse(data);

  // Check for new transactions on the Ethereum address
  if (message.event === 'eth_new_transaction') {
    console.log('New transaction on address', ETH_ADDRESS);
    // Send a notification
    sendNotification();
  }

  // Unsubscribe after the specified duration
  setTimeout(unsubscribe, SUBSCRIPTION_DURATION);
});

function sendNotification() {
  // Send a notification using your preferred method (e.g. email, SMS, push notification, etc.)
}

// Unsubscribe from events when you are done
function unsubscribe() {
  ws.send(JSON.stringify({
    event: 'eth_unsubscribe',
    params: {
      address: ETH_ADDRESS
    }
  }));
}

// Subscribe when the program starts
//subscribe(ETH_ADDRESS);