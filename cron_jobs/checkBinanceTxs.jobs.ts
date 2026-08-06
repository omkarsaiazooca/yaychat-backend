const axios = require('axios');
import { keys } from '../config/keys';
const env = keys.env.key;
const YourApiKeyToken = keys.BSCSCAN_KEY.key;
let baseUrl = (env == "development") ? 'https://api-testnet.bscscan.com' : 'https://api.bscscan.com';


export async function AccountTransfer(account: string) {
    let block = await axios.get(`${baseUrl}/api?module=account&action=txlist&address=` + account + '&startblock=0&endblock=99999999&sort=asc&apikey=' + YourApiKeyToken);
    console.log(block.data.result);
    if (block.data.result) {
        for (let tx of block.data.result) {
            console.log(tx);
        }
    }
}

export async function IndexxTokensTransfer(account: string, contractAddress: string) {
    let block = await axios.get(`${baseUrl}/api?module=account&action=tokentx&contractaddress=` + contractAddress + '&address=' + account + '&startblock=0&endblock=99999999&sort=asc&apikey=' + YourApiKeyToken);
    console.log(block.data.result);
    if (block.data.result) {
        for (let tx of block.data.result) {
            console.log(tx);
        }
    }
}

export async function GetBNBBalancebyAddress(account: string) {
    let block = await axios.get(`${baseUrl}/api?module=account&action=balance&address=` + account + '&apikey=' + YourApiKeyToken);
    console.log(block.data.result);
    return block.data.result;
}