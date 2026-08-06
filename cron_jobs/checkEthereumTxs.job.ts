const Web3 = require('web3');
import { keys } from "../config/keys";
const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
const env = keys.env.key;
const web3 = (env == 'development') ? new Web3(new Web3.providers.HttpProvider('https://goerli.infura.io/v3/' + YOUR_INFURA_API_KEY)) : new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + YOUR_INFURA_API_KEY));

export async function checkLastBlock(account: string) {
    let block = await web3.eth.getBlock('latest');
    console.log(`[*] Searching block ${block.number}...`);
    if (block && block.transactions) {
        for (let tx of block.transactions) {
            let transaction = await web3.eth.getTransaction(tx);
            if (account === transaction.to.toLowerCase()) {
                console.log(`[+] Transaction found on block ${block.number}`);
                console.log({ address: transaction.from, value: web3.utils.fromWei(transaction.value, 'ether'), timestamp: new Date() });
            }
        }
    }
}

export async function checkBlocks(start: number, end: number, account: string) {
    for (let i = start; i < end; i++) {
        let block = await web3.eth.getBlock(i)
        console.log(`[*] Searching block ${i}`);
        if (block && block.transactions) {
            for (let tx of block.transactions) {
                let transaction = await web3.eth.getTransaction(tx);
                if (account === transaction.to.toLowerCase()) {
                    console.log(`[+] Transaction found on block ${block.number}`);
                    console.log({ address: transaction.from, value: web3.utils.fromWei(transaction.value, 'ether'), timestamp: new Date() });
                }
            }
        }
    }
}


