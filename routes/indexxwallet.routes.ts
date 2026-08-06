import { Router } from 'express';
import { WalletController } from '../controllers/walletAPI';

const indexxwalletRounter: Router = Router();
const walletController: WalletController = new WalletController();

indexxwalletRounter.post('/create/:email', walletController.createAllWallet);
indexxwalletRounter.post('/:coin/:email', walletController.getWallet);
indexxwalletRounter.get('/getUserPerformance/:email', walletController.getUserPerformance);
indexxwalletRounter.post('/withdrawCrypto', walletController.sendCrypto);
indexxwalletRounter.post('/verify/:coin', walletController.verifyWallet);
indexxwalletRounter.post('/createuser', walletController.createUser);
indexxwalletRounter.get('/getUserWallets/:email', walletController.getUserWallets);
indexxwalletRounter.get('/getUserWallets/:coinName/:email', walletController.getUserSpecificWallet);
indexxwalletRounter.get('/getUserWalletsKey/:coinName/:email', walletController.getUserSpecificWalletKey);
indexxwalletRounter.get('/getUserTransactions/:email', walletController.getUserTransactions);
indexxwalletRounter.get('/getUserDetails/:email', walletController.getUserDetails);
indexxwalletRounter.post('/updatePersonalDetails', walletController.updatePersonalDetails);
indexxwalletRounter.post('/updateBankDetails/:email', walletController.updateBankDetails);
indexxwalletRounter.post('/sendCrypto', walletController.sendCryptoFromWalletUser);
indexxwalletRounter.post('/addAccount', walletController.addAccount);
indexxwalletRounter.post('/addBridgeCoins', walletController.addBridgeCoins);
indexxwalletRounter.post('/updateBridgeCoins', walletController.updateBridgeCoins);
indexxwalletRounter.get('/findBridgeCoins', walletController.findBridgeCoins);
indexxwalletRounter.post('/createChainExchange', walletController.createChainExchange);
indexxwalletRounter.get('/bridgeTx/:txId', walletController.getBridgeTxDetails);
indexxwalletRounter.post('/sendCryptoForBridge', walletController.sendCryptoForFromWalletUser);
indexxwalletRounter.post('/saveUserMnemonic', walletController.saveUserMnemonic);
indexxwalletRounter.post('/getUserByMnemonic', walletController.getUserByMnemonic);

export const indexxWalletRoute = indexxwalletRounter;