import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { keys } from '../config/keys';

export interface IAPIOperations {
}

export class BaseAPIOperations implements IAPIOperations {
    get userId(): any {
        let claims = this.getclaims();
        return claims ? claims.email : undefined;
    }

    get role(): any {
        let claims = this.getclaims();
        return claims ? claims.role : undefined;
    }

    private claims: any;
    private req: Request;
    private res: Response;

    constructor(req: Request, res: Response) {
        this.req = req;      
        this.res = res;  
    }

    getclaims(): any {
        if (this.claims) {
            return this.claims;
        }

        if (this.req.headers && this.req.headers.authorization) {
            let authHeader = this.req.headers.authorization;
            // Extract token from "Bearer <token>" format
            let token = authHeader.startsWith('Bearer ') 
                ? authHeader.substring(7) 
                : authHeader;
            this.claims = jwt.decode(token);
            return this.claims;
        }
        
        return undefined;
    }
}