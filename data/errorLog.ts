import { IModel } from "./base";

export interface ErrorLog extends IModel {
  email?: string;
  timestamp: Date;
  apiCalled: string; // Full API endpoint (method + path)
  detailedLog: string; // Complete error details as string
  statusCode?: number;
  errorCode?: string;
  method?: string;
  url?: string;
  requestBody?: any;
  requestQuery?: any;
  requestParams?: any;
  stackTrace?: string;
}

