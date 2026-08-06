import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { AuditLog } from '../data/auditLog';

export interface AuditLogModel extends IDocumentModel<AuditLog>, AuditLog {
}

var auditLogSchema: Schema = new Schema();
//Auditlog,  source:string,message: Object,error:string
auditLogSchema.add({
    source: String, //Bitgo, openexchangeRates, 
    userId: String, //system id or user id who called a third service
   // orderId: String, //order id who called a third service
    status: Number, //response status
    message: Object, //response from third party
    created: Date
})

export default auditLogSchema;