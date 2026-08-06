import { UserOperations } from "../platform/user.operations";
import { JwtAuthUtil } from '../platform/jwt.operations';
import { CountryOperations } from '../platform/country.operations';


export class CountryController {

    constructor() {
    }

    async getCountry(res: any, req: any) {
    }

    async updateCountry(res: any, req: any) {
        try {
            const countryOps: CountryOperations = new CountryOperations(req, res);
            const dataResults = await countryOps.updateCountry(req, res);
            if (dataResults) {
                res.statusCode = dataResults.status;
                res.send(dataResults);
            } else {
                res.statusCode = 500;
                res.send({ status: 500, data: "Internal Server Error" });
            }
        }
        catch (err) {
            console.log(err);
        }
    }

    async getCountries(req: any, res: any) {
        try {
            console.log("get countries");
            const countryOps: CountryOperations = new CountryOperations(req, res);
            const dataResults = await countryOps.getCountries(req, res);
            if (dataResults) {
                res.statusCode = dataResults.status;
                res.send(dataResults);
            } else {
                res.statusCode = 500;
                res.send({ status: 500, data: "Internal Server Error" });
            }

        } catch (err) {
            console.log(err);
        }
    }

    async addCountry(req: any, res: any) {
        try {
            const countryOps: CountryOperations = new CountryOperations(req, res);
            const dataResults = await countryOps.addCountry(req, res);
            if (dataResults) {
                res.statusCode = dataResults.status;
                res.send(dataResults);
            } else {
                res.statusCode = 500;
                res.send({ status: 500, data: "Internal Server Error" });
            }
        } catch (err) {
            console.log(err);
        }
    }
}