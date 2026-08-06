export interface userOtps {
    emailVerified?: boolean;
    emailVerifiedOn?: Date;
    emailCode?: string;
    emailCodeExpiry?: Date;
    email?: string;
    phone?: string;  
    phoneVerified?: boolean;
    phoneVerifiedOn?: Date;
    phoneCode?: string;
    phoneCodeExpiry?: Date;
    forgotPasswordCode?: string;
    forgotPasswordCodeExpiry?: Date;
    authMethod?: 'email' | 'phone';
}