import { Request, Response } from "express";
import { CountryService } from "../services/country.service";
import { BaseAPIOperations } from "./base.operations";

let countryService: CountryService = new CountryService();
export class CountryOperations extends BaseAPIOperations {
    constructor(req: Request, res: Response) {
        super(req, res);
    }

    async getCountries(req: any, res: any) {
        try {
            const countries = await countryService.find({});
            if (countries.length > 0) {
                return { status: 200, data: countries };
            } else {
                return { status: 500, data: "" };
            }
        } catch (err) {
            console.log(err);
        }
    }

    async updateCountry(req: any, res: any) {
        try {
            const countryId = req.params.countryId;
            const country = req.body;
            const updatedCountry = await countryService.updatePart(countryId, country);
            if (updatedCountry) {
                return { status: 200, data: updatedCountry };
            } else {
                return { status: 500, data: "" };
            }

        } catch (err) {
            console.log(err);
        }
    }

    async addCountry(req: any, res: any) {
        try {
            const country = req.body;
            const newCountry = await countryService.create(country);
            if (newCountry) {
                return { status: 200, data: newCountry };
            } else {
                return { status: 500, data: "" };
            }
        } catch (err) {
            console.log(err);
        }
    }


}