import { Router } from 'express';
import { TxController } from "../controllers/txAPI";

const txRouter: Router = Router();
const txController: TxController = new TxController();

txRouter.post('/createTx', txController.createTransaction);
txRouter.post('/createFiatDeposit', txController.registerFiatDeposit);
txRouter.post('/createFiatDepositForApy', txController.registerFiatDeposit);
txRouter.post('/createFiatDepositForOrder', txController.registerFiatDepositForOrder);
txRouter.post(
  '/createCryptoWithdraw',
  txController.registerCryptoWithdrawRequest
);
txRouter.post('/createFiatWithdraw', txController.registerFiatWithdraw);
txRouter.post('/updateTx', txController.updateTransaction);
txRouter.post('/sendTxByEmail', txController.sendCryptoByEmail);
txRouter.post('/sendTxByUsername', txController.sendCryptoByUserName);


export const transactionRoutes = txRouter;
