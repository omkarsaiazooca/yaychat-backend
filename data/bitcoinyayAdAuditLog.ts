import { IModel } from "./base";

export interface BitcoinyayAdAuditLog extends IModel {
  adUnitId: string;
  adFormat: string;
  errorCode: string;
  errorMessage: string;
  locale?: string;
  timestamp: Date;
  requestId?: string;
  vpnDetected?: boolean;
  networkStatus?: string;
  userId?: string;
  sessionId?: string;
  userCountry?: string;
  deviceInfo?: string;
  appVersion?: string;
  networkCarrier?: string;
  userAgent?: string;
  userIp?: string;
  extraInfo?: Record<string, any>;
  source?: string;
  createdAt?: Date;
}
