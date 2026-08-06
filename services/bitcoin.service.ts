import { keys } from "../config/keys";
import { WalletUserService } from "./walletUser.service";
const CryptoAccount = require("send-crypto");
import ECPairFactory from "ecpair";
import * as ecc from "tiny-secp256k1";
import axios from "axios";
const bitcoin = require("bitcoinjs-lib");

const env = keys.env.key;
export class BitcoinService {
  constructor() {}

  // async sendBitcoinTransaction(fromAddress: string, toAddress: string, amount: number, privateKey: string) {
  //     if (env === 'test') {
  //         const insight = new Insight('testnet');
  //         const privateKeyObj = new bitcore.PrivateKey(privateKey);
  //         const address = privateKeyObj.toAddress();
  //         const transaction = new bitcore.Transaction()
  //             .from(address)
  //             .to(toAddress, amount)
  //             .change(fromAddress)
  //             .sign(privateKeyObj)
  //             .fee(10000)
  //             .serialize();
  //         return insight.broadcast(transaction);
  //     } else {
  //         const insight = new Insight();
  //         const privateKeyObj = new bitcore.PrivateKey(privateKey);
  //         const address = privateKeyObj.toAddress();
  //         const transaction = new bitcore.Transaction()
  //             .from(address)
  //             .to(toAddress, amount)
  //             .change(fromAddress)
  //             .sign(privateKeyObj)
  //             .fee(10000)
  //             .serialize();
  //         return insight.broadcast(transaction);
  //     }
  // }

  // async sendBitcoinTransaction(fromAddress: string, toAddress: string, amount: number, privateKey: string) {
  //     try {
  //         let NETWORK = bitcoin.networks.testnet;
  //         let txb = bitcoin.TransactionBuilder(NETWORK);

  //         //get unspent output details
  //         let txid = ""; //transaction id
  //         let outn = 0;  // n out

  //         //add input
  //         txb.addInput(txid, outn);

  //         //add output
  //         txb.addOutput(toAddress, amount); //first argument is address that will receive the funds, the second is the value to send in satoshis after deducting the mining fees. In this example there are 5000 satoshis in mining fees (40000-35000=5000)

  //         //signing
  //         let WIF = privateKey; //private key of the address associated with this unspent output
  //         let keypair = bitcoin.ECPair.fromWIF(WIF, NETWORK);
  //         txb.sign(0, keypair);
  //         let tx = txb.build();
  //         let txhex = tx.toHex();

  //         console.log("txhex", txhex);
  //     } catch (err) {
  //         console.log(err);
  //     }
  // }

  async sendBitcoinTransaction(toAddress: string, amount: number) {
    try {
      const account = new CryptoAccount({
        coin: "BTC",
        network: "testnet",
        privateKey: keys.BITCOIN_PRIVATE_KEY.key,
      });
      const tx = await account.send({
        to: toAddress,
        amount: amount,
      });

      return tx;
    } catch (err) {
      console.log(err);
    }
  }

  async sendBitcoinTransaction1(toAddress: string, amount: number, fromAddress: string, privateKey: string) {
    try {
      const ECPair = ECPairFactory(ecc);
      const TESTNET = bitcoin.networks.testnet;
      const keyPair = ECPair.fromWIF(privateKey, TESTNET);

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
      unsignedTx.signatures = unsignedTx.tosign.map((tosign: any, n: any) => {
        unsignedTx.pubkeys.push(keyPair.publicKey.toString("hex"));
        let signature = keyPair.sign(Buffer.from(tosign, "hex"));
        let encodedSignature = bitcoin.script.signature.encode(
          signature,
          bitcoin.Transaction.SIGHASH_ALL
        );
        let hexStr = encodedSignature.toString("hex")
        .slice(0, -2);
        return hexStr;
      });
      const signedTx = await axios.post(
        `https://api.blockcypher.com/v1/btc/main/txs/send`,
        JSON.stringify(unsignedTx)
      );

      console.log("signedTx", JSON.stringify(signedTx.data));
      return { status: 200, data: signedTx.data.tx.hash };
    } catch (err: any) {
      console.log("err", JSON.stringify(err));
      return { status: 500, data: "Failed to transfer" as any };
    }
  }
}
