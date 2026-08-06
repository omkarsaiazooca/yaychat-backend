// // import axios from "axios";
// // import { keys } from "../config/keys";
// // import Bitcoin from "bitcoinjs-lib";
// // const NetworkType = Bitcoin.networks.testnet;
// // const FS = require("fs");
// // const request = require("request");

// // function generateKeyPair(file: any) {
// //   let keyPair = Bitcoin.ECPair.makeRandom({ network: NetworkType });
// //   let privateKey = keyPair.toWIF();
// //   const { address } = Bitcoin.payments.p2pkh({
// //     pubkey: keyPair.publicKey,
// //     network: NetworkType,
// //   });

// //   FS.writeFileSync(file, privateKey, function (error: any) {
// //     if (error) {
// //       console.log(error);
// //       return false;
// //     } else {
// //       console.log("success");
// //       return true;
// //     }
// //   });
// // }

// // function getKeyPairFromWIF(file: any) {
// //   let data = FS.readFileSync(file, "utf8", function (error: any, data: any) {
// //     return data;
// //   });

// //   var restoredPair = Bitcoin.ECPair.fromWIF(data, NetworkType);
// //   const { address } = Bitcoin.payments.p2pkh({
// //     pubkey: restoredPair.publicKey,
// //     network: NetworkType,
// //   });
// //   return { keyPair: restoredPair, address: address };
// // }

// // // 查询余额
// // function getBalance(address: any) {
// //   var getbalance_url = "https://api.blockcypher.com/v1/btc/test3/addrs";
// //   var url = getbalance_url + "/" + address + "/balance";
// //   request(url, function (error: any, response: any, body: any) {
// //     if (!error && response.statusCode == 200) {
// //       console.log(body);
// //     } else {
// //       console.log(error);
// //     }
// //   });
// // }

// // //查询交易记录
// // function getTxRecords(address: any) {
// //   var getTxRecords_url = "https://api.blockcypher.com/v1/btc/test3/addrs/";
// //   let url = getTxRecords_url + address;
// //   console.log("TxRecordsUrl", url);
// //   request(url, function (error: any, response: any, body: any) {
// //     if (!error && response.statusCode == 200) {
// //       console.log(body);
// //     } else {
// //       console.log(error);
// //     }
// //   });
// // }

// // export function newTx(toAddress: any, value: any) {
// //   var bitcoinKeys = Bitcoin.ECPair.fromPrivateKey(keys.BITCOIN_PRIVATE_KEY.key);
// //   var newTx = {
// //     inputs: [{ addresses: [keys.BITCOIN_PUBLIC_KEY.key] }],
// //     outputs: [{ addresses: [toAddress], value: value }],
// //   };

// //   axios
// //     .post(
// //       "https://api.blockcypher.com/v1/btc/test3/txs/new",
// //       JSON.stringify(newTx)
// //     )
// //     .then(function (tmptx) {
// //       tmptx.data.pubkeys = [];
// //       tmptx.data.signatures = tmptx.data.tosign.map(function (
// //         tosign: any,
// //         n: any
// //       ) {
// //         tmptx.data.pubkeys.push(bitcoinKeys.publicKey.toString("hex"));
// //         return Bitcoin.script.signature
// //           .encode(bitcoinKeys.sign(Buffer.from(tosign, "hex")), 0x01)
// //           .toString("hex")
// //           .slice(0, -2);
// //       });

// //       const getCircularReplacer = () => {
// //         const seen = new WeakSet();
// //         return (key: any, value: any) => {
// //           if (typeof value === "object" && value !== null) {
// //             if (seen.has(value)) {
// //               return;
// //             }
// //             seen.add(value);
// //           }
// //           return value;
// //         };
// //       };
// //       axios
// //         .post(
// //           "https://api.blockcypher.com/v1/btc/test3/txs/send",
// //           JSON.stringify(tmptx.data, getCircularReplacer())
// //         )
// //         .then(function (finaltx) {
// //           console.log(finaltx);
// //         })
// //         .catch(function (xhr) {
// //           console.log(xhr.response.data);
// //         });
// //     })
// //     .catch(function (error) {
// //       console.log(error);
// //     });
// // }

// // module.exports = {
// //   generateKeyPair,
// //   getKeyPairFromWIF,
// //   getBalance,
// //   getTxRecords,
// //   newTx,
// // };


// import bitcoin from 'bitcoinjs-lib'
// import request from 'request'
// const bitcoinNetwork = bitcoin.networks.testnet;

// /**
//  * Send bitcoin in testnet using BlockCypher
//  * @param {number} amount - Bitcoin amount in BTC
//  * @param {string} to - output Bitcoin wallet address
//  * @param {string} from - input Bitcoin wallet address
//  * @param {string} wif 
//  */
// const sendBitcoin = function (amount : any, to :any, from :any, wif :any) {
//   let keys = bitcoin.ECPair.fromWIF(wif, bitcoinNetwork);
//   return new Promise(function (resolve, reject) {
//     // create tx skeleton
//     request.post({
//       url: 'https://api.blockcypher.com/v1/btc/test3/txs/new',
//         body: JSON.stringify({
//           inputs: [{ addresses: [ from ] }],
//           // convert amount from BTC to Satoshis
//           outputs: [{ addresses: [ to ], value: amount * Math.pow(10, 8) }]
//         }),
//       },
//       function (err, res, body) {
//         if (err) {
//           reject(err);        
//         } else {
//           let tmptx = JSON.parse(body);
          
//           // signing each of the hex-encoded string required to finalize the transaction
//           tmptx.pubkeys = [];
//           tmptx.signatures = tmptx.tosign.map(function (tosign, n) {
//             tmptx.pubkeys.push(keys.getPublicKeyBuffer().toString('hex'));
//             return keys.sign(new Buffer(tosign, 'hex')).toDER().toString('hex');
//           });

//           // sending back the transaction with all the signatures to broadcast
//           request.post({
//             url: 'https://api.blockcypher.com/v1/btc/test3/txs/send',
//               body: JSON.stringify(tmptx),
//             },
//             function (err, res, body) {
//               if (err) {
//                 reject(err);
//               } else {
//                 // return tx hash as feedback
//                 let finaltx = JSON.parse(body);                
//                 resolve(finaltx.tx.hash);
//               }
//             }
//           );
//         }
//       }
//     );
//   });
// }