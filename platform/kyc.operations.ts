import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";

export class KYCOperations extends BaseAPIOperations {
    constructor(req: Request, res: Response) {
        super(req, res);
    }


    async getKYCStatus(req: any, res: any) {
    }

    async updateKYCStatus(req: any, res: any) {
        // try{
        //     const kycId = req.body.kycId;
        //     const status = req.body.status;
        //     const kycRes = await kycService.updateOne({ _id: kycId }, { status: status });
        //     if (kycRes) {
        //         return { status: 200, data: kycRes };
        //     } else {
        //         return { status: 500, data: {} as KYC };
        //     }
        // } catch(err) {
        // }
    }

    async createKYC(req: any, res: any) {
    }
}