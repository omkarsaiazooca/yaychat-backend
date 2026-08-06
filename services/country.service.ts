import { Country } from "../data/country";
import countrySchema, { CountryModel } from "../models/country";
import { UserService } from '../services/user.service';
import { ServiceBase } from "./base";

const uservice: UserService = new UserService();

export class CountryService extends ServiceBase<Country, CountryModel> {
    constructor() {
        super(countrySchema, "Country");
    }
}