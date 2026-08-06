import { Router } from 'express';
import { KYCController } from "../controllers/kycAPI";

const kycRouter: Router = Router();
const kycController: KYCController = new KYCController();

kycRouter.post('/updateKYCStatus', kycController.getKYCStatus);
kycRouter.post('/getKYCStatus', kycController.updateKYCStatus);
kycRouter.post('/createUserKYC', kycController.createKYC);
kycRouter.post('/webhook', kycController.webhook);

export const userkycRoutes = kycRouter;