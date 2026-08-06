// import { AuditData } from '../config/common';
// import { keys } from '../config/keys';
// import { BitgoData } from '../data/keys';
// import { Totp } from '../platform/totp.operations';
// import { AuditLogSevice } from '../services/auditLog.service';
// import { decryptData } from '../services/crypto.service';
// import { BitgoAPIWrapper } from './bitgo.operation';

// let totpGenerate: Totp = new Totp();
// const auditLog: AuditLogSevice = new AuditLogSevice();
// const env = 'test';//process.env.NODE_ENV ? process.env.NODE_ENV.trim() : "prod";

// var Bitgo: BitgoData;
// if (keys.bitGo.isEncrypted) {
//     Bitgo = decryptData(keys.bitGo.key);
// }

// export class BitgoOperations {
//     private walletId: any;
//     private bitgo: BitgoAPIWrapper;
//     private baseUrl;

//     constructor() {
//         if (env.localeCompare('test') == 0) {
//             this.walletId = Bitgo.testWalletIds;
//             this.baseUrl = Bitgo.testUrl;
//         } else if (env.localeCompare('prod') == 0) {
//             this.walletId = Bitgo.mainWalletIds;
//             this.baseUrl = Bitgo.prodUrl;
//         }
//         this.bitgo = new BitgoAPIWrapper();
//     }

//     public async getBitgoDetails() {
//         console.log('bitgo details', Bitgo);
//         return Bitgo;
//     }

//     //GetWalletDetails
//     public async getWalletDetails(coin: string, userId?: string) {
//         let url;
//         let walletId = this.getWalletId(coin);
//         let userCoin = this.getCoin(coin);
//         url = this.baseUrl + userCoin + '/wallet/' + walletId;
//         const options = this.getHeader();
//         const walletDetails = await this.bitgo.getAPI(url, options);
//         if (walletDetails.status == 200) {
//             let auditLogData = AuditData('Bitgo getWalletDetails response', userId, walletDetails.status, JSON.parse(walletDetails.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: walletDetails.status, data: JSON.parse(walletDetails.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo getWalletDetails error response', userId, walletDetails.status, walletDetails.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: walletDetails.status, data: walletDetails.data };
//         }
//     }

//     //GetWalletByAdddress
//     public async getWalletByAddress(coin: string, address: string, userId: string) {
//         let url;
//         let userCoin = this.getCoin(coin);
//         url = this.baseUrl + userCoin + '/wallet/address/' + address;
//         const options = this.getHeader();
//         const walletDetails = await this.bitgo.getAPI(url, options);
//         if (walletDetails.status == 200) {
//             let data = walletDetails.data;
//             let auditLogData = AuditData('Bitgo getWalletByAddress response', userId, walletDetails.status, JSON.parse(walletDetails.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { data: data };
//         } else {
//             let data = walletDetails.data;
//             let auditLogData = AuditData('Bitgo getWalletByAddress error response', userId, walletDetails.status, data);
//             let createLog = await auditLog.create(auditLogData);
//             return { data: data };
//         }
//     }

//     //CreateWalletAddress
//     public async createWalletAddress(coin: string, count: number = 1, label: string = '', userId?: string) {
//         let url;
//         let walletId = this.getWalletId(coin);
//         let userCoin = this.getCoin(coin);
//         url = this.baseUrl + userCoin + '/wallet/' + walletId + '/address';
        
//         const options = this.getHeader()
//         const postData = {
//             count: count,
//             label: label
//         }
//         const walletAddress = await this.bitgo.postAPI(url, options, postData);
//         if (walletAddress.status == 200) {
//             let auditLogData = AuditData('Bitgo createWalletAddress response', userId, walletAddress.status, JSON.parse(walletAddress.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: walletAddress.status, data: JSON.parse(walletAddress.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo createWalletAddress error response', userId, walletAddress.status, walletAddress.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: walletAddress.status, data: walletAddress.data };
//         }
//     }

//     //Session
//     public async getSession() {
//         const url = this.baseUrl + 'user/session';
//         const options = this.getHeader();
//         const sessionResponse = await this.bitgo.getAPI(url, options);
//         if (sessionResponse.status == 200) {
//             let auditLogData = AuditData('Bitgo getSession response', '', sessionResponse.status, JSON.parse(sessionResponse.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: sessionResponse.status, data: JSON.parse(sessionResponse.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo getSession error response', '', sessionResponse.status, sessionResponse.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: sessionResponse.status, data: sessionResponse.data };
//         }
//     }


//     //Unlock
//     public async unlock() {
//         const url = this.baseUrl + 'user/unlock';
//         const options = this.getHeader();
//         const otp = totpGenerate.generateTOTP(Bitgo.totpKey);
//         const postData = {
//             otp: otp.toString()
//         }
//         const unlockResponse = await this.bitgo.postAPI(url, options, postData);
//         if (unlockResponse.status == 200) {
//             let auditLogData = AuditData('Bitgo unlock response', '', unlockResponse.status, JSON.parse(unlockResponse.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: unlockResponse.status, data: JSON.parse(unlockResponse.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo unlock error response', '', unlockResponse.status, unlockResponse.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: unlockResponse.status, data: unlockResponse.data };
//         }
//     }

//     //GetTransaction
//     public async getTransaction(coin: string, txHash: string, userId?: string) {
//         let url;
//         let walletId = this.getWalletId(coin);
//         let userCoin = this.getCoin(coin);
//         url = this.baseUrl + userCoin + '/wallet/' + walletId + "/tx/" + txHash;
//         const options = this.getHeader()
//         const getTransaction = await this.bitgo.getAPI(url, options);
//         if (getTransaction.status == 200) {
//             let auditLogData = AuditData('Bitgo getTransaction response', userId, getTransaction.status, JSON.parse(getTransaction.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: getTransaction.status, data: JSON.parse(getTransaction.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo getTransaction error response', userId, getTransaction.status, getTransaction.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: getTransaction.status, data: (getTransaction.data) };
//         }
//     }

//     //SendCoins send coins to address from a specific address
//     public async sendCoins(coin: string, amount: number, minConfirm: number, walletAddress: string, userId?: string) {
//         let url;
//         let walletId = this.getWalletId(coin);
//         let userCoin = this.getCoin(coin);
//         url = this.baseUrl + userCoin + '/wallet/' + walletId + '/sendcoins';
//         const options = this.postHeader();
//         const postData = {
//             amount: amount,
//             minConfirm: minConfirm,
//             walletPassphrase: Bitgo.walletPassphrase,
//             address: walletAddress
//         }
//         const sendCoins = await this.bitgo.postAPI(url, options, postData);
//         if (sendCoins.status == 200) {
//             let auditLogData = AuditData('Bitgo sendCoins response', userId, sendCoins.status, JSON.parse(sendCoins.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: sendCoins.status, data: JSON.parse(sendCoins.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo sendCoins error response', userId, sendCoins.status, sendCoins.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: sendCoins.status, data: (sendCoins.data) };
//         }
//     }

//     //getRates
//     public async getRates(coin: string, userId: string) {
//         let url;
//         //let userCoin = this.getCoin(coin);
//         //for temparory fix following same method as Monni app followed
//         let userCoin = coin.toLowerCase();
//         url = "https://www.bitgo.com/api/v2/" + userCoin + '/market/latest';
//         const options = this.getHeader();
//         const ratesRespone = await this.bitgo.getAPI(url, options);
//         if (ratesRespone.status == 200) {
//             let auditLogData = AuditData('Bitgo getRates response', userId, ratesRespone.status, JSON.parse(ratesRespone.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: ratesRespone.status, data: JSON.parse(ratesRespone.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo getRates error response', userId, ratesRespone.status, ratesRespone.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: ratesRespone.status, data: (ratesRespone.data) };
//         }
//     }

//     //getWebhooks
//     public async getWebhooks(coin: string, userId: string) {
//         let url;
//         let walletId = this.getWalletId(coin);
//         let userCoin = this.getCoin(coin);
//         url = this.baseUrl + userCoin + '/wallet/' + walletId + '/webhooks';
//         const options = this.getHeader();
//         const bitGoResponse = await this.bitgo.getAPI(url, options);
//         if (bitGoResponse.status == 200) {
//             let auditLogData = AuditData('Bitgo getWebhooks response', userId, bitGoResponse.status, JSON.parse(bitGoResponse.data));
//             let createLog = await auditLog.create(auditLogData);
//             return { status: bitGoResponse.status, data: JSON.parse(bitGoResponse.data) };
//         } else {
//             let auditLogData = AuditData('Bitgo getWebhooks error response', userId, bitGoResponse.status, bitGoResponse.data);
//             let createLog = await auditLog.create(auditLogData);
//             return { status: bitGoResponse.status, data: (bitGoResponse.data) };
//         }
//     }

//     private getHeader() {
//         const options = {
//             "headers": {
//                 'Authorization': "Bearer " + Bitgo.accessToken,
//             }
//         };
//         return options;
//     }

//     private postHeader() {
//         const options = {
//             "headers": {
//                 'Authorization': "Bearer " + Bitgo.accessToken,
//             },
//         }
//         return options;
//     }

//     private getWalletId(coin: string) {
//         let walletId;
//         switch (coin) {
//             case 'BTC':
//                 walletId = this.walletId.btc;
//                 break;
//             case 'LTC':
//                 walletId = this.walletId.ltc;
//                 break;
//             case 'BCH':
//                 walletId = this.walletId.bch;
//                 break;
//             default:
//                 throw 'Coin not supported';
//         }
//         return walletId;
//     }

//     private getCoin(coin: string) {
//         switch (coin) {
//             case 'BTC':
//                 coin = env.localeCompare('test') == 0 ? 'tbtc' : 'btc'
//                 break;
//             case 'LTC':
//                 coin = env.localeCompare('test') == 0 ? 'tltc' : 'ltc'
//                 break;
//             case 'BCH':
//                 coin = env.localeCompare('test') == 0 ? 'tbch' : 'bch'
//                 break;
//             default:
//                 throw 'Coin not supported';
//         }

//         return coin;
//     }

// }