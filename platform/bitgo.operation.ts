// import { keys } from '../config/keys'
// import * as axios from 'axios';
// //import { AuditLogSevice } from '../services/auditLog.service';

// //const auditLog: AuditLogSevice = new AuditLogSevice();

// export class BitgoAPIWrapper {

//     constructor() {
//     }

//     public async getAPI(url : string, options : any) {
//         const response = await axios.default.get(url, options
//         ).then(async (response) => {
//             const result = JSON.stringify(response.data);
//             // let auditLogData = AuditData('Bitgo Response', '', 200, response.data);
//             // let createLog = await auditLog.create(auditLogData);
//             return { data: result, status: 200 };
//         }).catch(async (error) => {
//             // let auditLogData = AuditData('Bitgo Error Response', '', 500, error);
//             // let createLog = await auditLog.create(auditLogData);
//             return { data: error.response.data, status: 500 };
//         })
//         return response;
//     }

//     public async postAPI(url: string, options: any, postData: any) {
//         const response = axios.default.post(url, postData, options
//         ).then(async (response) => {
//             const result = JSON.stringify(response.data);
//             // let auditLogData = AuditData(keys.BitgoResponse, '', 200, response.data);
//             // let createLog = await auditLog.create(auditLogData);
//             return { data: result, status: 200 };
//         }).catch(async (error) => {
//             // let auditLogData = AuditData(keys.BitgoErrorResponse, '', 500, error);
//             // let createLog = await auditLog.create(auditLogData);
//             return { data: error, status: 500 };
//         })
//         return response;
//     }

// }