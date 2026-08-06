import { Router } from 'express';
import { CountryController } from '../controllers/countryAPI';
import {WalletController} from '../controllers/walletAPI';

const walletRounter: Router = Router();
const walletController: WalletController = new WalletController();

walletRounter.post('/create/:coin/:email', walletController.createWallet);
walletRounter.post('/:coin/:email', walletController.getWallet);
walletRounter.post('/withdrawCrypto', walletController.sendCrypto);
walletRounter.post('/verify/:coin', walletController.verifyWallet);
//walletRounter.post('/balance/:coin/:email', walletController.getBalance);

//--CoreWallet
walletRounter.post('/core/create/:coin', walletController.createCoreWallet);
walletRounter.get('/core/:coin', walletController.getCoreWallet);
walletRounter.get('/core/wallet/FTT', walletController.getFTTWallet);

export const walletRoute = walletRounter;