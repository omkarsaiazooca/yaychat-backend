import { Router } from 'express';
import { XNFTController } from '../controllers/XNFTAPI';

const xnftRouter: Router = Router();
const xnftController: XNFTController = new XNFTController();

xnftRouter.post('/getAllnfts', xnftController.getAllNftsByAddress);
xnftRouter.get('/getAllNFTData', xnftController.getAllNftsByAddress);
xnftRouter.post('/swap', xnftController.swapXnftForCrypto);
xnftRouter.post('/swapinex', xnftController.swapINEXForCrypto);
xnftRouter.post('/swapinexValidate', xnftController.swapINEXForCryptoValidate);
xnftRouter.post('/updateProfile', xnftController.xnftProfileUpdate);
xnftRouter.post('/getProfile', xnftController.getXnftProfile);

export const xNFTRoutes = xnftRouter;
