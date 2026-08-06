import { ServiceBase } from "./base";
import AuditLogSchema, { AuditLogModel } from "../models/auditLog";
import AmbassadorSchema, { AmbassadorModel } from "../models/ambassador";
import { Ambassador } from "../data/ambassador";

export class AmbassadorSevice extends ServiceBase<Ambassador, AmbassadorModel> {
    constructor() {
        super(AmbassadorSchema, "Ambassador");
    }

    // add extra methods here
    test() { };
}