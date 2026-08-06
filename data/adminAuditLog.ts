export interface AdminAuditLog {
    adminEmail: string;
    action: string;
    method: string;
    data?: any;
    timestamp: Date;
}