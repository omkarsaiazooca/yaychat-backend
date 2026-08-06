import { Router } from 'express';
import { CountryController } from '../controllers/countryAPI';

const countryRouter: Router = Router();
const countryController: CountryController = new CountryController();

countryRouter.post('/updateCountry/:countryId', countryController.updateCountry);
countryRouter.post('/getCountries', countryController.getCountries);
countryRouter.post('/addCountry', countryController.addCountry);
countryRouter.post('/getCountry/:countryId', countryController.getCountry);

export const countryRoute = countryRouter;