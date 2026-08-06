import { Router } from 'express';
import { AffiliateController } from '../controllers/affiliate';

const affiliateRouter: Router = Router();
const affiliateController: AffiliateController = new AffiliateController();

affiliateRouter.post('/adduser', affiliateController.addAffiliateuser);
affiliateRouter.post('/addaffiliateuser', affiliateController.addAffiliateuser);
affiliateRouter.post('/getuser', affiliateController.getAffiliateuser);
affiliateRouter.get('/getAllaffiliateUsers', affiliateController.getAllAffiliateUsers);
affiliateRouter.get('/getAllaffiliateUser/:email', affiliateController.getAllAffiliateUser);
affiliateRouter.get('/getAffiliateUserDashbaord/:username/:isPublicProfile', affiliateController.getAllAffiliateDashboardData01);
affiliateRouter.get('/getAffiliateUserDashbaord/:username/:isPublicProfile/:userType', affiliateController.getAllAffiliateDashboardData);
affiliateRouter.post('/updateaffiliateuser', affiliateController.updateAffiliateUser);
affiliateRouter.post('/convertnormalUser', affiliateController.convertNormalUser);
affiliateRouter.post('/shareGreetingCard', affiliateController.shareGreetingCard);


export const affiliateRoute = affiliateRouter;