var Mnemonic = require("bitcore-mnemonic");
import { BncClient } from "@binance-chain/javascript-sdk";


const env = 'test';//process.env.NODE_ENV ? process.env.NODE_ENV.trim() : "prod";

export class GenerateMnemonic {
    private api: string = '';
    private network: any = '';

    constructor() {
        if (env.localeCompare('test') == 0) {
            this.api = 'https://testnet-dex.binance.org/';
            this.network = 'testnet';
        } else if (env.localeCompare('prod') == 0) {
            this.api = 'https://dex.binance.org/';
            this.network = 'mainnet';
        }
    }

    public async createNewMnemonic() {
        var code = new Mnemonic();
        var privateKey = code.toHDPrivateKey();
        return { privateKey: privateKey.toString(), mnemonic: code.toString() };
    }

    public async createAccountNew(userPassword: string) {
        const client = new BncClient(this.api);
        client.chooseNetwork(this.network); 
        const res1 = client.createAccountWithKeystore(userPassword);
        console.log(res1);
    }

    public async getBalanceByAddress(address: string) {
        const client = new BncClient(this.api);
        client.chooseNetwork(this.network); 
        const res = client.getBalance(address);
        return res;
    }

}
