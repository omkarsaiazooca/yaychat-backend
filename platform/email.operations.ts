import { Lottery, Ticket } from "../data/lottery";
import { OrderStatus } from "../data/order";
import { keys } from "../config/keys";
import { generatePDF } from "../helpers/generatePDF";
const path = require("path");
const axios = require("axios");
import fs from "fs";
var SibApiV3Sdk = require("sib-api-v3-sdk");
import { routedTransactionalEmailsApi } from "../services/transactionalEmailProvider";
import archiver from "archiver";

// Keep existing transactional email templates while routing sends through the
// provider selected by EMAIL_PROVIDER. Brevo reporting stays Brevo-backed.
SibApiV3Sdk.TransactionalEmailsApi = routedTransactionalEmailsApi(
    SibApiV3Sdk.TransactionalEmailsApi
);


type TeamClaimEmail = {
    claimantEmail: string;
    type: "crypto" | "paypal";            // which flow
    matchedOrderId?: string | null;       // if we were able to find a likely order
    amount?: number | null;
    paidAt?: string | null;

    // crypto specifics
    coin?: "USDT" | "USDC";
    blockchain?: "Ethereum" | "Solana";
    txHash?: string;

    // paypal/card specifics
    paymentMethod?: "PayPal" | "USD";
    paypalTxnId?: string;
    processorTxnId?: string;
    proofUrl?: string;                    // screenshot URL
};

type AccountsOrderEmail = {
    userEmail: string;
    orderId: string;
    orderType: string;
    paymentType?: string;
    inAmount?: number;
    inCurrency?: string;
    outAmount?: number;
    outCurrency?: string;
    status?: string;
    exchangeName?: string;
    blockchainName?: string;
    createdAt?: Date | string;
    completedAt?: Date | string;
    notes?: string;
};

type BtcySellOrderUserEmail = {
    userEmail: string;
    userName?: string;
    orderId?: string;
    btcyAmount: number;
    usdtAmount: number;
    walletAddress: string;
    submittedAt?: Date | string;
    completedAt?: Date | string;
    transactionHash?: string;
};

type BrevoTransactionalEmailLog = {
    date?: string;
    email?: string;
    messageId?: string;
    subject?: string;
    uuid?: string;
    templateId?: number;
};

type BrevoEmailEventLog = {
    date?: string;
    email?: string;
    event?: string;
    messageId?: string;
};

type BrevoDateWindow = {
    startDate?: string;
    endDate?: string;
};

type BrevoOpenedRecipientSummary = {
    email: string;
    sendCount: number;
    openCount: number;
    firstSentAt: string | null;
    lastSentAt: string | null;
    firstOpenedAt: string | null;
    lastOpenedAt: string | null;
    messageIds: string[];
};

type BrevoOpenedRecipientsBySubjectReport = {
    subject: string;
    startDate: string | null;
    endDate: string | null;
    matchingEmailsCount: number;
    matchingOpenedEventsCount: number;
    uniqueOpenedRecipientsCount: number;
    recipients: BrevoOpenedRecipientSummary[];
};

// Default BCC emails for all outgoing emails
const DEFAULT_BCC_EMAILS = [
    { email: "accounts@azooca.com" },
    { email: "omkar@azooca.com" },
    { email: "Kashir@azooca.com" },
    // { email: "marketing@indexx.ai" }
];
const BTCY_SELL_APPROVAL_BCC_EMAILS = [
    ...DEFAULT_BCC_EMAILS,
    { email: "omkar@azooca.com" },
];
const LEGACY_BREVO_API_KEY =
    process.env.BREVO_API_KEY;

export class SendEmail {
    private static readonly SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    private static readonly BREVO_MIN_REQUEST_INTERVAL_MS = 650;
    private brevoLastRequestAt = 0;

    private escapeHtml(value: any): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    private formatEmailAmount(value: number): string {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "-";
        return amount.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 12,
        });
    }

    private formatEmailDate(value?: Date | string): string {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return new Date().toLocaleString("en-US");
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    private buildBtcySellOrderEmailHtml(input: {
        title: string;
        greetingName?: string;
        intro: string;
        detailsTitle: string;
        rows: { label: string; value: string }[];
        bodyAfterDetails: string;
        closing: string;
    }) {
        const currentYear = new Date().getFullYear();
        const greetingName = this.escapeHtml(input.greetingName || "there");
        const rowsHtml = input.rows
            .map(
                (row) => `
                    <tr>
                        <td style="padding: 9px 0; color: #666; width: 42%; font-size: 14px;">${this.escapeHtml(row.label)}</td>
                        <td style="padding: 9px 0; color: #221f1f; font-size: 14px; font-weight: 700; word-break: break-word;">${this.escapeHtml(row.value)}</td>
                    </tr>`
            )
            .join("");

        return `
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; color: #1c1c1c; background-color: #f7f7f7; margin: 0; padding: 0;">
                <div style="max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);">
                    <div style="padding: 26px 32px; text-align: center; background: #ffffff;">
                        <a href="https://bitcoin-yay.com" style="display: inline-block; text-decoration: none;">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="BTCY Powered by Indexx" width="240" style="display: block; margin: 0 auto; border: 0; outline: none; text-decoration: none;" />
                        </a>
                    </div>

                    <div style="padding: 0 32px 28px;">
                        <h2 style="color: #221f1f; margin: 6px 0 14px; font-size: 24px; font-weight: 700;">
                            ${this.escapeHtml(input.title)}
                        </h2>
                        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
                            Hi ${greetingName},
                        </p>
                        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
                            ${this.escapeHtml(input.intro)}
                        </p>
                        <div style="background: #fafafa; border: 1px solid #eeeeee; border-radius: 8px; padding: 16px 18px; margin: 18px 0;">
                            <h3 style="margin: 0 0 8px; color: #221f1f; font-size: 17px;">${this.escapeHtml(input.detailsTitle)}</h3>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
                                ${rowsHtml}
                            </table>
                        </div>
                        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
                            ${this.escapeHtml(input.bodyAfterDetails)}
                        </p>
                        <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                            ${this.escapeHtml(input.closing)}
                            <br /><br />
                            Best regards,<br />
                            The Bitcoin Yay Team
                        </p>
                    </div>

                    <div style="background: #f1f1f1; padding: 22px 32px; text-align: center;">
                        <p style="margin: 0 0 12px; font-size: 15px;">Stay connected with the Bitcoin Yay community:</p>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0 6px;"><a href="https://t.me/bitcoinyay" style="text-decoration: none; display: inline-block;"><img src="https://img.icons8.com/color/1200/telegram-app--v5.jpg" alt="Telegram" width="34" style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;" /></a></td>
                                <td style="padding: 0 6px;"><a href="https://x.com/bitcoin_YAY" style="text-decoration: none; display: inline-block;"><img src="https://img.icons8.com/color/1200/twitterx--v1.jpg" alt="X (Twitter)" width="34" style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;" /></a></td>
                                <td style="padding: 0 6px;"><a href="https://www.instagram.com/bitcoin.yay/" style="text-decoration: none; display: inline-block;"><img src="https://img.icons8.com/color/1200/instagram-new--v1.jpg" alt="Instagram" width="34" style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;" /></a></td>
                                <td style="padding: 0 6px;"><a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" style="text-decoration: none; display: inline-block;"><img src="https://img.icons8.com/color/1200/facebook-new.jpg" alt="Facebook" width="34" style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;" /></a></td>
                                <td style="padding: 0 6px;"><a href="https://www.youtube.com/@BitcoinYay" style="text-decoration: none; display: inline-block;"><img src="https://img.icons8.com/color/1200/youtube-play.jpg" alt="YouTube" width="34" style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;" /></a></td>
                            </tr>
                        </table>
                        <p style="margin: 16px 0 0; font-size: 13px; color: #666;">
                            © ${currentYear} Bitcoin Yay. All rights reserved.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    public isEmailValid(rawEmail: string): boolean {
        const email = String(rawEmail ?? "").trim().toLowerCase();
        if (!email || email.length > 254) {
            return false;
        }
        if (!SendEmail.SIMPLE_EMAIL_REGEX.test(email)) {
            return false;
        }
        const [localPart, domain] = email.split("@");
        if (!localPart || !domain) {
            return false;
        }
        if (localPart.length > 64) {
            return false;
        }
        if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
            return false;
        }
        if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
            return false;
        }
        return true;
    }

    private getBrevoApiKey(): string {
        const apiKey =
            process.env.SENDINBLUE_API_KEY ||
            process.env.BREVO_API_KEY ||
            LEGACY_BREVO_API_KEY;

        if (!apiKey) {
            throw new Error("SENDINBLUE_API_KEY is not configured");
        }

        return apiKey;
    }

    private getBrevoTransactionalApi() {
        SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
            this.getBrevoApiKey();
        return new SibApiV3Sdk.TransactionalEmailsApi();
    }

    private normalizeBrevoEmail(email: string | undefined): string {
        return String(email ?? "").trim().toLowerCase();
    }

    private normalizeBrevoMessageId(messageId: string | undefined): string {
        return String(messageId ?? "").trim();
    }

    private parseBrevoDate(value?: string | Date | null): Date | null {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private formatBrevoDate(value: Date): string {
        return value.toISOString().slice(0, 10);
    }

    private async waitForBrevoRateLimit() {
        const elapsed = Date.now() - this.brevoLastRequestAt;
        const waitMs = SendEmail.BREVO_MIN_REQUEST_INTERVAL_MS - elapsed;
        if (waitMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        this.brevoLastRequestAt = Date.now();
    }

    private async runBrevoRequest<T>(label: string, action: () => Promise<T>, attempt = 1): Promise<T> {
        await this.waitForBrevoRateLimit();

        try {
            return await action();
        } catch (error: any) {
            const status = Number(error?.status ?? error?.response?.status ?? 0);
            const shouldRetry = (status === 429 || status >= 500) && attempt < 5;
            if (!shouldRetry) {
                throw error;
            }

            const backoffMs = Math.min(4000, attempt * 1000);
            console.warn(`[Brevo] ${label} failed with status ${status}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/5).`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            return this.runBrevoRequest(label, action, attempt + 1);
        }
    }

    private buildBrevoEmailWindows(input: {
        startDate?: string;
        endDate?: string;
        days?: number;
    }): BrevoDateWindow[] {
        if (input.startDate || input.endDate) {
            if (!input.startDate || !input.endDate) {
                throw new Error("Both startDate and endDate are required together");
            }

            const start = this.parseBrevoDate(input.startDate);
            const end = this.parseBrevoDate(input.endDate);
            if (!start || !end) {
                throw new Error("Invalid startDate or endDate");
            }
            if (start > end) {
                throw new Error("startDate must be before or equal to endDate");
            }

            const windows: BrevoDateWindow[] = [];
            let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
            const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

            while (cursor <= endUtc) {
                const windowStart = new Date(cursor);
                const windowEnd = new Date(cursor);
                windowEnd.setUTCDate(windowEnd.getUTCDate() + 29);
                if (windowEnd > endUtc) {
                    windowEnd.setTime(endUtc.getTime());
                }

                windows.push({
                    startDate: this.formatBrevoDate(windowStart),
                    endDate: this.formatBrevoDate(windowEnd),
                });

                cursor = new Date(windowEnd);
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }

            return windows;
        }

        if (input.days != null) {
            const days = Number(input.days);
            if (!Number.isInteger(days) || days < 1) {
                throw new Error("days must be a positive integer");
            }

            const end = new Date();
            const start = new Date();
            start.setUTCDate(start.getUTCDate() - (days - 1));

            return this.buildBrevoEmailWindows({
                startDate: this.formatBrevoDate(start),
                endDate: this.formatBrevoDate(end),
            });
        }

        return [{}];
    }

    private async fetchBrevoTransactionalEmailsForRecipient(
        email: string,
        window: BrevoDateWindow
    ): Promise<BrevoTransactionalEmailLog[]> {
        const transactionalApi = this.getBrevoTransactionalApi();
        const limit = 1000;
        const records: BrevoTransactionalEmailLog[] = [];
        let offset = 0;

        while (true) {
            const response: any = await this.runBrevoRequest(
                `getTransacEmailsList:${email}:${offset}`,
                () => transactionalApi.getTransacEmailsList({
                    email,
                    ...(window.startDate ? { startDate: window.startDate } : {}),
                    ...(window.endDate ? { endDate: window.endDate } : {}),
                    sort: "asc",
                    limit,
                    offset,
                })
            );

            const pageItems = Array.isArray(response?.transactionalEmails)
                ? response.transactionalEmails
                : [];

            if (!pageItems.length) {
                break;
            }

            records.push(...pageItems);

            const totalCount = Number(response?.count ?? 0);
            offset += pageItems.length;
            if ((totalCount > 0 && offset >= totalCount) || pageItems.length < limit) {
                break;
            }
        }

        return records;
    }

    private async fetchBrevoOpenedEvents(input: {
        startDate?: string;
        endDate?: string;
        days?: number;
    }): Promise<BrevoEmailEventLog[]> {
        const transactionalApi = this.getBrevoTransactionalApi();
        const limit = 5000;
        const events: BrevoEmailEventLog[] = [];
        let offset = 0;

        while (true) {
            const response: any = await this.runBrevoRequest(
                `getEmailEventReport:opened:${offset}`,
                () => transactionalApi.getEmailEventReport({
                    ...(input.startDate ? { startDate: input.startDate } : {}),
                    ...(input.endDate ? { endDate: input.endDate } : {}),
                    ...(input.days != null && !input.startDate && !input.endDate ? { days: input.days } : {}),
                    event: "opened",
                    sort: "asc",
                    limit,
                    offset,
                })
            );

            const pageItems = Array.isArray(response?.events) ? response.events : [];
            if (!pageItems.length) {
                break;
            }

            events.push(...pageItems);

            offset += pageItems.length;
            if (pageItems.length < limit) {
                break;
            }
        }

        return events;
    }

    async getOpenedRecipientsByTransactionalSubject(input: {
        subject: string;
        startDate?: string;
        endDate?: string;
        days?: number;
    }): Promise<BrevoOpenedRecipientsBySubjectReport> {
        const normalizedSubject = String(input.subject ?? "").trim();
        if (!normalizedSubject) {
            throw new Error("subject is required");
        }

        const windows = this.buildBrevoEmailWindows({
            startDate: input.startDate,
            endDate: input.endDate,
            days: input.days,
        });

        const openedEvents = await this.fetchBrevoOpenedEvents({
            startDate: windows[0]?.startDate,
            endDate: windows[windows.length - 1]?.endDate,
            ...(windows.length === 1 && !windows[0]?.startDate && !windows[0]?.endDate && input.days != null
                ? { days: input.days }
                : {}),
        });

        const openedEmails = Array.from(
            new Set(
                openedEvents
                    .map((event) => this.normalizeBrevoEmail(event.email))
                    .filter(Boolean)
            )
        ).sort();

        console.log(`[Brevo] Found ${openedEvents.length} opened events across ${openedEmails.length} recipient emails. Resolving subject matches...`);

        const matchingEmails: BrevoTransactionalEmailLog[] = [];
        for (let index = 0; index < openedEmails.length; index++) {
            const email = openedEmails[index];
            if ((index + 1) % 25 === 0 || index === 0 || index + 1 === openedEmails.length) {
                console.log(`[Brevo] Checking transactional logs for recipient ${index + 1}/${openedEmails.length}: ${email}`);
            }

            for (const window of windows) {
                const records = await this.fetchBrevoTransactionalEmailsForRecipient(email, window);
                for (const record of records) {
                    if (String(record?.subject ?? "").trim() === normalizedSubject) {
                        matchingEmails.push(record);
                    }
                }
            }
        }

        const trackedMessageKeys = new Set<string>();
        const sentSummaryByEmail = new Map<string, {
            sendCount: number;
            firstSentAt: Date | null;
            lastSentAt: Date | null;
            messageIds: Set<string>;
        }>();

        for (const record of matchingEmails) {
            const email = this.normalizeBrevoEmail(record.email);
            const messageId = this.normalizeBrevoMessageId(record.messageId);
            if (!email || !messageId) {
                continue;
            }

            const compositeKey = `${email}::${messageId}`;
            trackedMessageKeys.add(compositeKey);

            const sentAt = this.parseBrevoDate(record.date);
            const summary = sentSummaryByEmail.get(email) || {
                sendCount: 0,
                firstSentAt: null,
                lastSentAt: null,
                messageIds: new Set<string>(),
            };

            summary.sendCount += 1;
            summary.messageIds.add(messageId);
            if (sentAt && (!summary.firstSentAt || sentAt < summary.firstSentAt)) {
                summary.firstSentAt = sentAt;
            }
            if (sentAt && (!summary.lastSentAt || sentAt > summary.lastSentAt)) {
                summary.lastSentAt = sentAt;
            }

            sentSummaryByEmail.set(email, summary);
        }

        let matchingOpenedEventsCount = 0;
        const openedSummaryByEmail = new Map<string, {
            openCount: number;
            firstOpenedAt: Date | null;
            lastOpenedAt: Date | null;
            messageIds: Set<string>;
        }>();

        for (const event of openedEvents) {
            const email = this.normalizeBrevoEmail(event.email);
            const messageId = this.normalizeBrevoMessageId(event.messageId);
            if (!email || !messageId) {
                continue;
            }

            const compositeKey = `${email}::${messageId}`;
            if (!trackedMessageKeys.has(compositeKey)) {
                continue;
            }

            matchingOpenedEventsCount += 1;
            const openedAt = this.parseBrevoDate(event.date);
            const summary = openedSummaryByEmail.get(email) || {
                openCount: 0,
                firstOpenedAt: null,
                lastOpenedAt: null,
                messageIds: new Set<string>(),
            };

            summary.openCount += 1;
            summary.messageIds.add(messageId);
            if (openedAt && (!summary.firstOpenedAt || openedAt < summary.firstOpenedAt)) {
                summary.firstOpenedAt = openedAt;
            }
            if (openedAt && (!summary.lastOpenedAt || openedAt > summary.lastOpenedAt)) {
                summary.lastOpenedAt = openedAt;
            }

            openedSummaryByEmail.set(email, summary);
        }

        const recipients: BrevoOpenedRecipientSummary[] = Array.from(openedSummaryByEmail.entries())
            .map(([email, openedSummary]) => {
                const sentSummary = sentSummaryByEmail.get(email);
                return {
                    email,
                    sendCount: sentSummary?.sendCount ?? 0,
                    openCount: openedSummary.openCount,
                    firstSentAt: sentSummary?.firstSentAt?.toISOString() ?? null,
                    lastSentAt: sentSummary?.lastSentAt?.toISOString() ?? null,
                    firstOpenedAt: openedSummary.firstOpenedAt?.toISOString() ?? null,
                    lastOpenedAt: openedSummary.lastOpenedAt?.toISOString() ?? null,
                    messageIds: Array.from(openedSummary.messageIds).sort(),
                };
            })
            .sort((a, b) => {
                if (b.openCount !== a.openCount) {
                    return b.openCount - a.openCount;
                }
                return a.email.localeCompare(b.email);
            });

        return {
            subject: normalizedSubject,
            startDate: windows[0]?.startDate ?? null,
            endDate: windows[windows.length - 1]?.endDate ?? null,
            matchingEmailsCount: matchingEmails.length,
            matchingOpenedEventsCount,
            uniqueOpenedRecipientsCount: recipients.length,
            recipients,
        };
    }

    /**
     * Helper function to fetch image from URL and convert to base64 data URL
     * This ensures images load in email clients that block external images
     */
    private async fetchImageAsBase64(url: string): Promise<string> {
        try {
            const response = await axios.get(url, {
                responseType: "arraybuffer",
            });
            const base64 = Buffer.from(response.data, "binary").toString("base64");
            // Detect content type from URL or default to png
            const contentType = url.toLowerCase().endsWith('.png') ? 'image/png' :
                url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                    url.toLowerCase().endsWith('.gif') ? 'image/gif' :
                        url.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.error(`Error fetching image from ${url}:`, error);
            // Return original URL as fallback
            return url;
        }
    }

    async sendReviewEmail20(
        email: string,
        name: string,
        code: string,
        type: string = "",
        actionType: string = "",
        website: string = ""
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(email, name);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Exchange Login",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                // htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for registering on Indexx Exchange. Please use this code ${code} to proceed further.<br> <br>
                //         Thanks, <br>
                //         Indexx Exchange Team
                //         </h1></body></html>`,
                htmlContent: `<!DOCTYPE html>
        <html>
            <head>
                <title>Page Title</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        
        <style>
        .main#main {
        width:600px;
        margin:auto;
        }
        
        @media only screen and (max-width: 600px) {
        .main#main {
        width:96%;
        }
        }
        </style>
            </head>
            <body>
        
                <table  slign="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px;" cellspacing="0"
                                        cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="border-bottom:1px solid #e6e6e6;font-size:18px;padding:20px 0">
                                                    <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td style=" font-size:
                                                                    20px;">Dear ${type ===
                        "HoneyBeeRegister"
                        ? "Honey Bee User, "
                        : "User, "
                    }Please
                                                                    confirm your
                                                                    registration
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">You're almost there!<br>
                                                    Activate your account now by
                                                    entering the following code: <br>
                                                    <span style="padding:5px
                                                        0;font-size:30px;font-weight:bolder;color:#F66036">
                                                        ${code}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr><td style="padding:20px 0 20px
                                                    0;line-height:26px;color:#666;font-size:17px;">Once
                                                    you've activated your account, <a
                                                        style="color:#F66036" href="#"
                                                        target="_blank">complete basic
                                                        verification </a> and you'll be
                                                    ready to trade!</td>
        
                                            </tr></tbody></table>
                                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                                <tbody>
                                                <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/ > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                                
                                            </td></tr>
                                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                           
                                    
                                                        <td style="padding:20px 0;color: #221F1F;">indexx Limited, CUB Financial Centre
                                                           ,<br/>
                                                            <br/>
                                                           GF6, Lyford Cay, Nassau, Bahamas.
                                                           <br/>
                                                            <br/><br/>550 Newport Center Drive
                                                           <br/>
                                                            <br/>Newport Beach,
                                                           <br/>
                                                            <br/>CA 92660 United State
                                                           <br/><br/><br/>Copyright © 2022 All Rights Reserved byIndexx.
                                                       </td>
                                                 
                                       </tr>
                                                </tbody>
                                            </table>
                                </div>
                            </td>
                        </tr>
                       
                        </tbody>
                    </table>
        
                </body>
            </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendReviewEmail2(
        email: string,
        name: string,
        code: string,
        type: string = "",
        actionType: string = "",
        website: string = ""
    ) {
        console.log('Email params:', { email, name, code, type, actionType, website });

        const normalizedEmail = String(email ?? "").trim().toLowerCase();
        if (!this.isEmailValid(normalizedEmail)) {
            console.warn("Invalid email for sendReviewEmail2:", email);
            return { status: 400, message: "Invalid email address" };
        }

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // ✅ Determine logo based on website - ensure case sensitivity
            const isBitcoinYay = website.trim().toUpperCase() === "BTCY-MOBLIE-APP";
            const logoURL = isBitcoinYay
                ? "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png"
                : "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";

            // ✅ Determine email content based on actionType - ensure exact string matching
            let greetingLine = "";
            let mainMessage = "";
            let followupAction = "";
            const currentYear = new Date().getFullYear();

            // Trim and normalize actionType for comparison
            const normalizedActionType = actionType.trim();

            if (normalizedActionType === "New Register") {
                greetingLine = `Welcome ${name},`;
                mainMessage = `Thank you for registering on ${isBitcoinYay ? 'Bitcoin Yay' : 'Indexx Exchange'}. Please use the verification code below to activate your account.`;
                followupAction = `Once your account is activated, you can log in and begin exploring our platform.`;
            } else if (normalizedActionType === "Forgot Password") {
                greetingLine = `Hi ${name},`;
                mainMessage = `We received a request to reset your ${isBitcoinYay ? 'Bitcoin Yay' : 'Indexx Exchange'} password. Use the code below to complete the process.`;
                followupAction = `If you didn't request a password reset, please ignore this email.`;
            } else {
                greetingLine = type === "HoneyBeeRegister" ? "Dear Honey Bee User," : "Dear User,";
                mainMessage = `You're almost there! Activate your account now by entering the following code:`;
                followupAction = `Once you've activated your account, complete basic verification and you'll be ready to trade!`;
            }

            // Determine subject line
            let emailSubject = "";
            if (isBitcoinYay) {
                emailSubject = normalizedActionType === "New Register"
                    ? "Bitcoin Yay Register"
                    : normalizedActionType === "Forgot Password"
                        ? "Bitcoin Yay Password Reset"
                        : "Bitcoin Yay Verification";
            } else {
                emailSubject = normalizedActionType === "New Register"
                    ? "Indexx Exchange Login"
                    : normalizedActionType === "Forgot Password"
                        ? "Indexx Exchange Password Reset"
                        : "Indexx Exchange Verification";
            }

            const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>${isBitcoinYay ? 'Bitcoin Yay' : 'Indexx'}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
              </head>
              <body>
                <table border="0" cellspacing="0" class="main" id="main" style="max-width: 600px; margin: auto;">
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="https://indexx.ai/" target="_blank">
                      <img src="${logoURL}" alt="${isBitcoinYay ? 'Bitcoin Yay' : 'Indexx'} Logo" style="width: ${isBitcoinYay ? '200px' : '150px'}; max-width: 80%; height: auto;" />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 30px; background: #fff;">
                      <table width="100%" style="border:1px solid #f0f0f0; border-radius: 5px; padding: 0 30px;" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding: 20px 0; font-size: 20px; border-bottom: 1px solid #e6e6e6;">
                            ${greetingLine}<br/><br/>
                            ${mainMessage}
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 30px; font-weight: bold; color: #F66036; padding: 20px 0;">
                            ${code}
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 16px; line-height: 26px; color: #666; padding: 20px 0;">
                            ${followupAction}
                          </td>
                        </tr>
                      </table>
                      <table width="100%" style="margin-top: 50px; text-align: center;">
                        <tr>
                          <td>
                            <a href="https://twitter.com/Indexx_ai" target="_blank">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                            </a>
                            <a href="https://www.instagram.com/indexx_ai/" target="_blank" style="margin: 0 10px;">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram"/>
                            </a>
                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" style="margin: 0 10px;">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube"/>
                            </a>
                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook"/>
                            </a>
                          </td>
                        </tr>
                        <tr style="background: #E4E4E4; text-align: center; font-size: 10px;">
                          <td style="padding: 20px; color: #221F1F;">
                            indexx Limited, CUB Financial Centre<br/>
                            GF6, Lyford Cay, Nassau, Bahamas.<br/><br/>
                            550 Newport Center Drive<br/>
                            Newport Beach, CA 92660, United States<br/><br/>
                            Copyright © ${currentYear} All Rights Reserved by Indexx.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            `;

            const senderName = isBitcoinYay ? "Bitcoin Yay" : "Indexx.ai";

            let send = await sendInMail.sendTransacEmail({
                subject: emailSubject,
                sender: { name: senderName, email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: senderName },
                to: [{ email: normalizedEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent,
                params: { bodyMessage: "Made just for you!" },
            });

            console.log("Email sent successfully:", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Failed to send email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendOtpForPasswordReset(email: string, otp: string) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Exchange Password Reset",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Password Reset</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
              .main#main { width: 600px; margin: auto; }
              @media only screen and (max-width: 600px) {
                .main#main { width: 96%; }
              }
            </style>
          </head>
          <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
              <tbody>
                <tr>
                  <td align="center" valign="middle" style="padding: 33px 0">
                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style="padding: 0 30px; background: #fff">
                      <table width="100%" style="border: 1px solid #f0f0f0; border-radius: 5px; padding: 0 30px;" cellspacing="0" cellpadding="0">
                        <tbody>
                          <tr>
                            <td style="border-bottom: 1px solid #e6e6e6; font-size: 18px; padding: 20px 0">
                              <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td style="font-size: 20px;">Dear User,</td>
                                  </tr>
                                  <tr>
                                    <td style="font-size: 20px;">Password Reset Request</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                              We received a request to reset your password. Use the following OTP to reset your password: <br>
                              <span style="padding: 5px 0; font-size: 30px; font-weight: bolder; color: #F66036">${otp}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 20px 0 20px 0; line-height: 26px; color: #666; font-size: 17px;">
                              If you did not request a password reset, please ignore this email or contact support if you have any questions.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <table width="100%" style="margin-top: 50px; padding: 20px 0;">
                        <tbody>
                          <tr>
                            <td align="center" style="margin-bottom: 20px; display: block">
                              <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                              </a>
                              <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;"/>
                              </a>
                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;"/>
                              </a>
                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                              </a>
                            </td>
                          </tr>
                          <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                            <td style="padding: 20px 0; color: #221F1F;">
                              indexx Limited, CUB Financial Centre,<br/>
                              GF6, Lyford Cay, Nassau, Bahamas.<br/><br/>
                              550 Newport Center Drive, Newport Beach, CA 92660 United States.<br/><br/>
                              Copyright © ${currentYear} All Rights Reserved by Indexx.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendLinkedAccountOtp(toEmail: string, mainEmail: string, otp: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const htmlContent = `
            <html>
            <body
                style="
                font-family: Arial, sans-serif;
                color: #1c1c1c;
                background-color: #f7f7f7;
                margin: 0;
                padding: 0;
                "
            >
                <div
                style="
                    max-width: 560px;
                    margin: 32px auto;
                    background: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
                "
                >
                <!-- TOP LOGO ONLY (NO HEADER) -->
                <div style="padding: 26px 32px; text-align: center; background: #ffffff;">
                    <a href="https://bitcoin-yay.com" style="display: inline-block; text-decoration: none;">
                    <img
                        src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png"
                        alt="BTCY Powered by Indexx"
                        width="240"
                        style="display: block; margin: 0 auto; border: 0; outline: none; text-decoration: none;"
                    />
                    </a>
                </div>

                <!-- CONTENT -->
                <div style="padding: 0 32px 28px;">
                    <h2 style="color: #221f1f; margin: 6px 0 14px; font-size: 24px; font-weight: 700;">
                    Confirm Your Linked Mining Account
                    </h2>

                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
                    <strong>${mainEmail}</strong> has requested to link this BTCY mining account to their network in order to enable
                    shared mining bonuses.
                    </p>

                    <p style="margin: 0 0 16px; font-size: 16px;">
                    Please enter the one-time code below to approve the link:
                    </p>

                    <p
                    style="
                        font-size: 34px;
                        letter-spacing: 10px;
                        font-weight: bold;
                        margin: 24px 0;
                        text-align: center;
                        color: #ff7f00;
                    "
                    >
                    ${otp}
                    </p>

                    <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">
                    This code expires in <strong>10 minutes</strong>. For security, do not share it with anyone.
                    </p>

                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                    If you did not request this, you can safely ignore this email.
                    </p>
                </div>

                <!-- FOOTER + SOCIAL (CENTERED) -->
                <div style="background: #f1f1f1; padding: 22px 32px; text-align: center;">
                    <p style="margin: 0 0 12px; font-size: 15px;">Stay connected with the Bitcoin Yay community:</p>

                    <!-- Centering wrapper table (best practice for email clients) -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0 6px;">
                        <a href="https://t.me/bitcoinyay" style="text-decoration: none; display: inline-block;">
                            <img
                            src="https://img.icons8.com/color/1200/telegram-app--v5.jpg"
                            alt="Telegram"
                            width="34"
                            style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;"
                            />
                        </a>
                        </td>

                        <td style="padding: 0 6px;">
                        <a href="https://x.com/bitcoin_YAY" style="text-decoration: none; display: inline-block;">
                            <img
                            src="https://img.icons8.com/color/1200/twitterx--v1.jpg"
                            alt="X (Twitter)"
                            width="34"
                            style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;"
                            />
                        </a>
                        </td>

                        <td style="padding: 0 6px;">
                        <a href="https://www.instagram.com/bitcoin.yay/" style="text-decoration: none; display: inline-block;">
                            <img
                            src="https://img.icons8.com/color/1200/instagram-new--v1.jpg"
                            alt="Instagram"
                            width="34"
                            style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;"
                            />
                        </a>
                        </td>

                        <td style="padding: 0 6px;">
                        <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" style="text-decoration: none; display: inline-block;">
                            <img
                            src="https://img.icons8.com/color/1200/facebook-new.jpg"
                            alt="Facebook"
                            width="34"
                            style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;"
                            />
                        </a>
                        </td>

                        <td style="padding: 0 6px;">
                        <a href="https://www.youtube.com/@BitcoinYay" style="text-decoration: none; display: inline-block;">
                            <img
                            src="https://img.icons8.com/color/1200/youtube-play.jpg"
                            alt="YouTube"
                            width="34"
                            style="display: block; border: 0; outline: none; text-decoration: none; border-radius: 8px;"
                            />
                        </a>
                        </td>
                    </tr>
                    </table>

                    <p style="margin: 16px 0 0; font-size: 13px; color: #666;">
                    © ${new Date().getFullYear()} Bitcoin Yay. All rights reserved.
                    </p>
                </div>
                </div>
            </body>
            </html>

          `;

            await sendInMail.sendTransacEmail({
                subject: "Confirm Linked BTCY Mining Account",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { name: "Bitcoin Yay", email: "wallet@indexx.ai" },
                to: [{ email: toEmail }],
                htmlContent,
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending linked account OTP", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendAcademyAccountEmail(email: string, user: any, baseUrl: string) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            console.log("user in email academy", user);
            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "Confirm Your Email Address",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="x-apple-disable-message-reformatting">
                <title></title>
                <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">
                <style>
                    html,
                    body {
                        margin: 0 auto !important;
                        padding: 0 !important;
                        height: 100% !important;
                        width: 100% !important;
                        background: #f1f1f1;
                    }

                    * {
                        -ms-text-size-adjust: 100%;
                        -webkit-text-size-adjust: 100%;
                    }

                    div[style*="margin: 16px 0"] {
                        margin: 0 !important;
                    }

                    table,
                    td {
                        mso-table-lspace: 0pt !important;
                        mso-table-rspace: 0pt !important;
                    }

                    table {
                        border-spacing: 0 !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        margin: 0 auto !important;
                    }

                    img {
                        -ms-interpolation-mode: bicubic;
                    }

                    a {
                        text-decoration: none;
                    }

                    *[x-apple-data-detectors],
                    .unstyle-auto-detected-links *,
                    .aBn {
                        border-bottom: 0 !important;
                        cursor: default !important;
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }

                    .a6S {
                        display: none !important;
                        opacity: 0.01 !important;
                    }

                    .im {
                        color: inherit !important;
                    }

                    img.g-img+div {
                        display: none !important;
                    }

                    @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                        u~div .email-container {
                            min-width: 320px !important;
                        }
                    }

                    @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                        u~div .email-container {
                            min-width: 375px !important;
                        }
                    }

                    @media only screen and (min-device-width: 414px) {
                        u~div .email-container {
                            min-width: 414px !important;
                        }
                    }

                    .primary {
                        background: #30e3ca;
                    }

                    .bg_white {
                        background: #ffffff;
                    }

                    .bg_light {
                        background: #fafafa;
                    }

                    .bg_black {
                        background: #000000;
                    }

                    .bg_dark {
                        background: rgba(0, 0, 0, .8);
                    }

                    .email-section {
                        padding: 2.5em;
                    }

                    .btn {
                        padding: 10px 15px;
                        display: inline-block;
                    }

                    .btn.btn-primary {
                        border-radius: 5px;
                        background: #3056de !important;
                        color: #ffffff;
                        transition: .5s;
                    }

                    .btn.btn-primary:hover {
                        background: #5b77db !important;
                        color: #ffffff;
                    }

                    .btn.btn-white {
                        border-radius: 5px;
                        background: #ffffff;
                        color: #000000;
                    }

                    .btn.btn-white-outline {
                        border-radius: 5px;
                        background: transparent;
                        border: 1px solid #fff;
                        color: #fff;
                    }

                    .btn.btn-black-outline {
                        border-radius: 0px;
                        background: transparent;
                        border: 2px solid #000;
                        color: #000;
                        font-weight: 700;
                    }

                    h1,
                    h2,
                    h3,
                    h4,
                    h5,
                    h6 {
                        font-family: 'Lato', sans-serif;
                        color: #000000;
                        margin-top: 0;
                        font-weight: 400;
                    }

                    body {
                        font-family: 'Lato', sans-serif;
                        font-weight: 400;
                        font-size: 15px;
                        line-height: 1.8;
                        color: rgba(0, 0, 0, .4);
                    }

                    a {
                        color: #30e3ca;
                    }

                    .logo h1 {
                        margin: 0;
                    }

                    .logo h1 a {
                        color: #30e3ca;
                        font-size: 24px;
                        font-weight: 700;
                        font-family: 'Lato', sans-serif;
                    }

                    .hero {
                        position: relative;
                        z-index: 0;
                    }

                    .hero .text h2 {
                        color: #000;
                        font-size: 40px;
                        margin-bottom: 0;
                        font-weight: 400;
                        line-height: 1.4;
                    }

                    .hero .text h3 {
                        font-size: 20px;
                        font-weight: 300;
                        margin-top: 10px;
                    }

                    .hero .text h2 span {
                        font-weight: 600;
                        color: #30e3ca;
                    }

                    .heading-section h2 {
                        color: #000000;
                        font-size: 28px;
                        margin-top: 0;
                        line-height: 1.4;
                        font-weight: 400;
                    }

                    .heading-section .subheading {
                        margin-bottom: 20px !important;
                        display: inline-block;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: rgba(0, 0, 0, .4);
                        position: relative;
                    }

                    .heading-section .subheading::after {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: -10px;
                        content: '';
                        width: 100%;
                        height: 2px;
                        background: #30e3ca;
                        margin: 0 auto;
                    }

                    .heading-section-white {
                        color: rgba(255, 255, 255, .8);
                    }

                    .heading-section-white h2 {
                        line-height: 1;
                        padding-bottom: 0;
                    }

                    .heading-section-white h2 {
                        color: #ffffff;
                    }

                    .heading-section-white .subheading {
                        margin-bottom: 0;
                        display: inline-block;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: rgba(255, 255, 255, .4);
                    }

                    ul.social {
                        padding: 0;
                    }

                    ul.social li {
                        display: inline-block;
                        margin-right: 10px;
                    }
                </style>
            </head>

            <body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
                <center style="width: 100%; background-color: #f1f1f1;">
                    <div style="display: none; font-size: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                        &nbsp;
                    </div>
                    <div style="max-width: 600px; margin: 0 auto;" class="email-container">
                        <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                            <tr>
                                <td valign="middle" class="hero bg_white" style="padding: 2em 0 4em 0;">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center" valign="middle" style="padding: 33px 0">
                                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <div class="text" style="padding: 0 2.5em; text-align: left;">
                                                    <h4>Dear ${user.first_name},</h4>
                                                    <p>Thanks for registering on the Indexx Academy! Please click the below link to verify your email address and activate your account.</p>
                                                    <p><a href="${baseUrl}/confirm-email?token=${user.reset_password_token}&email=${user.email}" style="text-decoration: underline;">Confirm My Email Address</a></p>
                                                    <p>Regards,<br />Indexx Academy Support Team</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <table width="100%" style="margin-top: 50px; padding: 20px 0;" role="presentation">
                                        <tr>
                                            <td align="center" style="margin-bottom: 20px; display: block;">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <br />
                                        <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                                            <td style="padding: 20px 0; color: #221F1F;">
                                                Indexx Limited, CUB Financial Centre,<br />GF6, Lyford Cay, Nassau, Bahamas.<br /><br />550 Newport Center Drive, Newport Beach, CA 92660 United States.<br /><br />Copyright © 2024 All Rights Reserved by Indexx.
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </div>
                </center>
            </body>

            </html>`,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendAcademyResendAccountEmail(
        email: string,
        user: any,
        baseUrl: string
    ) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "Confirm Your Email Address",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
            <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

            <head>
                <meta charset="utf-8">
                <!-- utf-8 works for most cases -->
                <meta name="viewport" content="width=device-width">
                <!-- Forcing initial-scale shouldn't be necessary -->
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!-- Use the latest (edge) version of IE rendering engine -->
                <meta name="x-apple-disable-message-reformatting">
                <!-- Disable auto-scale in iOS 10 Mail entirely -->
                <title></title>
                <!-- The title tag shows in email notifications, like Android 4.4. -->

                <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">

                <!-- CSS Reset : BEGIN -->
                <style>
                    /* What it does: Remove spaces around the email design added by some email clients. */

                    /* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */

                    html,
                    body {
                        margin: 0 auto !important;
                        padding: 0 !important;
                        height: 100% !important;
                        width: 100% !important;
                        background: #f1f1f1;
                    }

                    /* What it does: Stops email clients resizing small text. */

                    * {
                        -ms-text-size-adjust: 100%;
                        -webkit-text-size-adjust: 100%;
                    }

                    /* What it does: Centers email on Android 4.4 */

                    div[style*="margin: 16px 0"] {
                        margin: 0 !important;
                    }

                    /* What it does: Stops Outlook from adding extra spacing to tables. */

                    table,
                    td {
                        mso-table-lspace: 0pt !important;
                        mso-table-rspace: 0pt !important;
                    }

                    /* What it does: Fixes webkit padding issue. */

                    table {
                        border-spacing: 0 !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        margin: 0 auto !important;
                    }

                    /* What it does: Uses a better rendering method when resizing images in IE. */

                    img {
                        -ms-interpolation-mode: bicubic;
                    }

                    /* What it does: Prevents Windows 10 Mail from underlining links despite inline CSS. Styles for underlined links should be inline. */

                    a {
                        text-decoration: none;
                    }

                    /* What it does: A work-around for email clients meddling in triggered links. */

                    *[x-apple-data-detectors],
                    /* iOS */

                    .unstyle-auto-detected-links *,
                    .aBn {
                        border-bottom: 0 !important;
                        cursor: default !important;
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }

                    /* What it does: Prevents Gmail from displaying a download button on large, non-linked images. */

                    .a6S {
                        display: none !important;
                        opacity: 0.01 !important;
                    }

                    /* What it does: Prevents Gmail from changing the text color in conversation threads. */

                    .im {
                        color: inherit !important;
                    }

                    /* If the above doesn't work, add a .g-img class to any image in question. */

                    img.g-img+div {
                        display: none !important;
                    }

                    /* What it does: Removes right gutter in Gmail iOS app: https://github.com/TedGoas/Cerberus/issues/89  */

                    /* Create one of these media queries for each additional viewport size you'd like to fix */

                    /* iPhone 4, 4S, 5, 5S, 5C, and 5SE */

                    @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                        u~div .email-container {
                            min-width: 320px !important;
                        }
                    }

                    /* iPhone 6, 6S, 7, 8, and X */

                    @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                        u~div .email-container {
                            min-width: 375px !important;
                        }
                    }

                    /* iPhone 6+, 7+, and 8+ */

                    @media only screen and (min-device-width: 414px) {
                        u~div .email-container {
                            min-width: 414px !important;
                        }
                    }
                </style>

                <!-- CSS Reset : END -->

                <!-- Progressive Enhancements : BEGIN -->
                <style>
                    .primary {
                        background: #30e3ca;
                    }

                    .bg_white {
                        background: #ffffff;
                    }

                    .bg_light {
                        background: #fafafa;
                    }

                    .bg_black {
                        background: #000000;
                    }

                    .bg_dark {
                        background: rgba(0, 0, 0, .8);
                    }

                    .email-section {
                        padding: 2.5em;
                    }

                    /*BUTTON*/

                    .btn {
                        padding: 10px 15px;
                        display: inline-block;
                    }

                    .btn.btn-primary {
                        border-radius: 5px;
                        background: #3056de !important;
                        color: #ffffff;
                        transition: .5s;
                    }

                    .btn.btn-primary:hover {
                        background: #5b77db !important;
                        color: #ffffff;
                    }

                    .btn.btn-white {
                        border-radius: 5px;
                        background: #ffffff;
                        color: #000000;
                    }

                    .btn.btn-white-outline {
                        border-radius: 5px;
                        background: transparent;
                        border: 1px solid #fff;
                        color: #fff;
                    }

                    .btn.btn-black-outline {
                        border-radius: 0px;
                        background: transparent;
                        border: 2px solid #000;
                        color: #000;
                        font-weight: 700;
                    }

                    h1,
                    h2,
                    h3,
                    h4,
                    h5,
                    h6 {
                        font-family: 'Lato', sans-serif;
                        color: #000000;
                        margin-top: 0;
                        font-weight: 400;
                    }

                    body {
                        font-family: 'Lato', sans-serif;
                        font-weight: 400;
                        font-size: 15px;
                        line-height: 1.8;
                        color: rgba(0, 0, 0, .4);
                    }

                    a {
                        color: #30e3ca;
                    }

                    /*LOGO*/

                    .logo h1 {
                        margin: 0;
                    }

                    .logo h1 a {
                        color: #30e3ca;
                        font-size: 24px;
                        font-weight: 700;
                        font-family: 'Lato', sans-serif;
                    }

                    /*HERO*/

                    .hero {
                        position: relative;
                        z-index: 0;
                    }

                    .hero .text h2 {
                        color: #000;
                        font-size: 40px;
                        margin-bottom: 0;
                        font-weight: 400;
                        line-height: 1.4;
                    }

                    .hero .text h3 {
                        font-size: 20px;
                        font-weight: 300;
                        margin-top: 10px;
                    }

                    .hero .text h2 span {
                        font-weight: 600;
                        color: #30e3ca;
                    }

                    /*HEADING SECTION*/

                    .heading-section h2 {
                        color: #000000;
                        font-size: 28px;
                        margin-top: 0;
                        line-height: 1.4;
                        font-weight: 400;
                    }

                    .heading-section .subheading {
                        margin-bottom: 20px !important;
                        display: inline-block;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: rgba(0, 0, 0, .4);
                        position: relative;
                    }

                    .heading-section .subheading::after {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: -10px;
                        content: '';
                        width: 100%;
                        height: 2px;
                        background: #30e3ca;
                        margin: 0 auto;
                    }

                    .heading-section-white {
                        color: rgba(255, 255, 255, .8);
                    }

                    .heading-section-white h2 {
                        line-height: 1;
                        padding-bottom: 0;
                    }

                    .heading-section-white h2 {
                        color: #ffffff;
                    }

                    .heading-section-white .subheading {
                        margin-bottom: 0;
                        display: inline-block;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: rgba(255, 255, 255, .4);
                    }

                    ul.social {
                        padding: 0;
                    }

                    ul.social li {
                        display: inline-block;
                        margin-right: 10px;
                    }
                </style>

            </head>

            <body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
                <center style="width: 100%; background-color: #f1f1f1;">
                    <div style="display: none; font-size: 1px;max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                    </div>
                    <div style="max-width: 600px; margin: 0 auto;" class="email-container">
                        <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                            <tr>
                                <td valign="middle" class="hero bg_white" style="padding: 2em 0 4em 0;">
                                    <table>
                                        <tr>
                                            <td align="center" valign="middle" style="padding: 33px 0">
                                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                                </a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <tr>
                                                <td>
                                                    <div class="text" style="padding: 0 2.5em; text-align: left;">
                                                        <h4>Dear ${user.first_name},</h4>
                                                        <p>Thanks for registering on the Indexx Academy! Please click the below link to verify your email address and activate your account.</p>
                                                        <p><a href="${baseUrl}/confirm-email?token=${user.reset_password_token}&email=${user.email}" style="text-decoration: underline;">Confirm My Email Address</a></p>

                                                        <p>
                                                            Regards, <br /> Indexx Academy Support Team
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                    </table>
                                </td>
                                </tr>
                                <tr>
                                    <td>
                                        <table width="100%" style="margin-top: 50px; padding: 20px 0;" role="presentation">
                                            <tr>
                                                <td align="center" style="margin-bottom: 20px; display: block;">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                            </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;" />
                                                            </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;" />
                                                            </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                            </a>
                                                </td>
                                            </tr>
                                            <br />
                                            <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                                                <td style="padding: 20px 0; color: #221F1F;">
                                                    Indexx Limited, CUB Financial Centre,<br />GF6, Lyford Cay, Nassau, Bahamas.<br /><br />550 Newport Center Drive, Newport Beach, CA 92660 United States.<br /><br />Copyright © 2024 All Rights Reserved by Indexx.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                        </table>
                    </div>
                </center>
            </body>

            </html>`,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendAcademyInstructorRequest(
        email: string,
        user: any,
        baseUrl: string
    ) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "New Instructor Request",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `<!DOCTYPE html>
            <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

            <head>
                <meta charset="utf-8">
                <!-- utf-8 works for most cases -->
                <meta name="viewport" content="width=device-width">
                <!-- Forcing initial-scale shouldn't be necessary -->
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <!-- Use the latest (edge) version of IE rendering engine -->
                <meta name="x-apple-disable-message-reformatting">
                <!-- Disable auto-scale in iOS 10 Mail entirely -->
                <title></title>
                <!-- The title tag shows in email notifications, like Android 4.4. -->

                <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">

                <!-- CSS Reset : BEGIN -->
                <style>
                    /* What it does: Remove spaces around the email design added by some email clients. */

                    /* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */

                    html,
                    body {
                        margin: 0 auto !important;
                        padding: 0 !important;
                        height: 100% !important;
                        width: 100% !important;
                        background: #f1f1f1;
                    }

                    /* What it does: Stops email clients resizing small text. */

                    * {
                        -ms-text-size-adjust: 100%;
                        -webkit-text-size-adjust: 100%;
                    }

                    /* What it does: Centers email on Android 4.4 */

                    div[style*="margin: 16px 0"] {
                        margin: 0 !important;
                    }

                    /* What it does: Stops Outlook from adding extra spacing to tables. */

                    table,
                    td {
                        mso-table-lspace: 0pt !important;
                        mso-table-rspace: 0pt !important;
                    }

                    /* What it does: Fixes webkit padding issue. */

                    table {
                        border-spacing: 0 !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        margin: 0 auto !important;
                    }

                    /* What it does: Uses a better rendering method when resizing images in IE. */

                    img {
                        -ms-interpolation-mode: bicubic;
                    }

                    /* What it does: Prevents Windows 10 Mail from underlining links despite inline CSS. Styles for underlined links should be inline. */

                    a {
                        text-decoration: none;
                    }

                    /* What it does: A work-around for email clients meddling in triggered links. */

                    *[x-apple-data-detectors],
                    /* iOS */

                    .unstyle-auto-detected-links *,
                    .aBn {
                        border-bottom: 0 !important;
                        cursor: default !important;
                        color: inherit !important;
                        text-decoration: none !important;
                        font-size: inherit !important;
                        font-family: inherit !important;
                        font-weight: inherit !important;
                        line-height: inherit !important;
                    }

                    /* What it does: Prevents Gmail from displaying a download button on large, non-linked images. */

                    .a6S {
                        display: none !important;
                        opacity: 0.01 !important;
                    }

                    /* What it does: Prevents Gmail from changing the text color in conversation threads. */

                    .im {
                        color: inherit !important;
                    }

                    /* If the above doesn't work, add a .g-img class to any image in question. */

                    img.g-img+div {
                        display: none !important;
                    }

                    /* What it does: Removes right gutter in Gmail iOS app: https://github.com/TedGoas/Cerberus/issues/89  */

                    /* Create one of these media queries for each additional viewport size you'd like to fix */

                    /* iPhone 4, 4S, 5, 5S, 5C, and 5SE */

                    @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                        u~div .email-container {
                            min-width: 320px !important;
                        }
                    }

                    /* iPhone 6, 6S, 7, 8, and X */

                    @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                        u~div .email-container {
                            min-width: 375px !important;
                        }
                    }

                    /* iPhone 6+, 7+, and 8+ */

                    @media only screen and (min-device-width: 414px) {
                        u~div .email-container {
                            min-width: 414px !important;
                        }
                    }
                </style>

                <!-- CSS Reset : END -->

                <!-- Progressive Enhancements : BEGIN -->
                <style>
                    .primary {
                        background: #30e3ca;
                    }

                    .bg_white {
                        background: #ffffff;
                    }

                    .bg_light {
                        background: #fafafa;
                    }

                    .bg_black {
                        background: #000000;
                    }

                    .bg_dark {
                        background: rgba(0, 0, 0, .8);
                    }

                    .email-section {
                        padding: 2.5em;
                    }

                    /*BUTTON*/

                    .btn {
                        padding: 10px 15px;
                        display: inline-block;
                    }

                    .btn.btn-primary {
                        border-radius: 5px;
                        background: #3056de !important;
                        color: #ffffff;
                        transition: .5s;
                    }

                    .btn.btn-primary:hover {
                        background: #5b77db !important;
                        color: #ffffff;
                    }

                    .btn.btn-white {
                        border-radius: 5px;
                        background: #ffffff;
                        color: #000000;
                    }

                    .btn.btn-white-outline {
                        border-radius: 5px;
                        background: transparent;
                        border: 1px solid #fff;
                        color: #fff;
                    }

                    .btn.btn-black-outline {
                        border-radius: 0px;
                        background: transparent;
                        border: 2px solid #000;
                        color: #000;
                        font-weight: 700;
                    }

                    h1,
                    h2,
                    h3,
                    h4,
                    h5,
                    h6 {
                        font-family: 'Lato', sans-serif;
                        color: #000000;
                        margin-top: 0;
                        font-weight: 400;
                    }

                    body {
                        font-family: 'Lato', sans-serif;
                        font-weight: 400;
                        font-size: 15px;
                        line-height: 1.8;
                        color: rgba(0, 0, 0, .4);
                    }

                    a {
                        color: #30e3ca;
                    }

                    /*LOGO*/

                    .logo h1 {
                        margin: 0;
                    }

                    .logo h1 a {
                        color: #30e3ca;
                        font-size: 24px;
                        font-weight: 700;
                        font-family: 'Lato', sans-serif;
                    }

                    /*HERO*/

                    .hero {
                        position: relative;
                        z-index: 0;
                    }

                    .hero .text h2 {
                        color: #000;
                        font-size: 40px;
                        margin-bottom: 0;
                        font-weight: 400;
                        line-height: 1.4;
                    }

                    .hero .text h3 {
                        font-size: 20px;
                        font-weight: 300;
                        margin-top: 10px;
                    }

                    .hero .text h2 span {
                        font-weight: 600;
                        color: #30e3ca;
                    }

                    /*HEADING SECTION*/

                    .heading-section h2 {
                        color: #000000;
                        font-size: 28px;
                        margin-top: 0;
                        line-height: 1.4;
                        font-weight: 400;
                    }

                    .heading-section .subheading {
                        margin-bottom: 20px !important;
                        display: inline-block;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: rgba(0, 0, 0, .4);
                        position: relative;
                    }

                    .heading-section .subheading::after {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: -10px;
                        content: '';
                        width: 100%;
                        height: 2px;
                        background: #30e3ca;
                        margin: 0 auto;
                    }

                    .heading-section-white {
                        color: rgba(255, 255, 255, .8);
                    }

                    .heading-section-white h2 {
                        line-height: 1;
                        padding-bottom: 0;
                    }

                    .heading-section-white h2 {
                        color: #ffffff;
                    }

                    .heading-section-white .subheading {
                        margin-bottom: 0;
                        display: inline-block;
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: rgba(255, 255, 255, .4);
                    }

                    ul.social {
                        padding: 0;
                    }

                    ul.social li {
                        display: inline-block;
                        margin-right: 10px;
                    }
                </style>

            </head>

            <body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
                <center style="width: 100%; background-color: #f1f1f1;">
                    <div style="display: none; font-size: 1px;max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                    </div>
                    <div style="max-width: 600px; margin: 0 auto;" class="email-container">
                        <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                            <tr>
                                <td valign="middle" class="hero bg_white" style="padding: 2em 0 4em 0;">
                                    <table>
                                        <tr>
                                            <td align="center" valign="middle" style="padding: 33px 0">
                                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                                        </a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <tr>
                                                <td>
                                                    <div class="text" style="padding: 0 2.5em; text-align: left;">
                                                        <h4>Dear Admin,</h4>
                                                        <p>Instructor First Name: ${user?.instructor_first_name}</p>
                                                        <p>Instructor Email: ${user?.instructor_email}</p>
                                                        <p>Instructor Subject: ${user?.instructor_subject}</p>
                                                        <p>Instructor Description: ${user?.instructor_description}</p>
                                                        <p><a href="${baseUrl}/admin/instructor/" style="text-decoration: underline;">Check in the website</a></p>

                                                        <p>
                                                            Regards, <br /> Indexx Academy Support Team <br />
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                    </table>
                                </td>
                                </tr>
                                <tr>
                                    <td>
                                        <table width="100%" style="margin-top: 50px; padding: 20px 0;" role="presentation">
                                            <tr>
                                                <td align="center" style="margin-bottom: 20px; display: block;">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                            </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;" />
                                                            </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;" />
                                                            </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                            </a>
                                                </td>
                                            </tr>
                                            <br />
                                            <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                                                <td style="padding: 20px 0; color: #221F1F;">
                                                    Indexx Limited, CUB Financial Centre,<br />GF6, Lyford Cay, Nassau, Bahamas.<br /><br />550 Newport Center Drive, Newport Beach, CA 92660 United States.<br /><br />Copyright © 2024 All Rights Reserved by Indexx.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                        </table>
                    </div>
                </center>
            </body>

            </html>`,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async subscribeEmail(email: string, website: string) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "Contact Message",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="x-apple-disable-message-reformatting">
            <title>Thank You for Subscribing</title>

            <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">

            <style>
                html,
                body {
                    margin: 0 auto !important;
                    padding: 0 !important;
                    height: 100% !important;
                    width: 100% !important;
                    background: #f1f1f1;
                }

                * {
                    -ms-text-size-adjust: 100%;
                    -webkit-text-size-adjust: 100%;
                }

                div[style*="margin: 16px 0"] {
                    margin: 0 !important;
                }

                table,
                td {
                    mso-table-lspace: 0pt !important;
                    mso-table-rspace: 0pt !important;
                }

                table {
                    border-spacing: 0 !important;
                    border-collapse: collapse !important;
                    table-layout: fixed !important;
                    margin: 0 auto !important;
                }

                img {
                    -ms-interpolation-mode: bicubic;
                }

                a {
                    text-decoration: none;
                }

                *[x-apple-data-detectors],
                .unstyle-auto-detected-links *,
                .aBn {
                    border-bottom: 0 !important;
                    cursor: default !important;
                    color: inherit !important;
                    text-decoration: none !important;
                    font-size: inherit !important;
                    font-family: inherit !important;
                    font-weight: inherit !important;
                    line-height: inherit !important;
                }

                .a6S {
                    display: none !important;
                    opacity: 0.01 !important;
                }

                .im {
                    color: inherit !important;
                }

                img.g-img+div {
                    display: none !important;
                }

                @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                    u~div .email-container {
                        min-width: 320px !important;
                    }
                }

                @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                    u~div .email-container {
                        min-width: 375px !important;
                    }
                }

                @media only screen and (min-device-width: 414px) {
                    u~div .email-container {
                        min-width: 414px !important;
                    }
                }

                .primary {
                    background: #30e3ca;
                }

                .bg_white {
                    background: #ffffff;
                }

                .bg_light {
                    background: #fafafa;
                }

                .bg_black {
                    background: #000000;
                }

                .bg_dark {
                    background: rgba(0, 0, 0, .8);
                }

                .email-section {
                    padding: 2.5em;
                }

                .btn {
                    padding: 10px 15px;
                    display: inline-block;
                }

                .btn.btn-primary {
                    border-radius: 5px;
                    background: #3056de !important;
                    color: #ffffff;
                    transition: .5s;
                }

                .btn.btn-primary:hover {
                    background: #5b77db !important;
                    color: #ffffff;
                }

                .btn.btn-white {
                    border-radius: 5px;
                    background: #ffffff;
                    color: #000000;
                }

                .btn.btn-white-outline {
                    border-radius: 5px;
                    background: transparent;
                    border: 1px solid #fff;
                    color: #fff;
                }

                .btn.btn-black-outline {
                    border-radius: 0px;
                    background: transparent;
                    border: 2px solid #000;
                    color: #000;
                    font-weight: 700;
                }

                h1,
                h2,
                h3,
                h4,
                h5,
                h6 {
                    font-family: 'Lato', sans-serif;
                    color: #000000;
                    margin-top: 0;
                    font-weight: 400;
                }

                body {
                    font-family: 'Lato', sans-serif;
                    font-weight: 400;
                    font-size: 15px;
                    line-height: 1.8;
                    color: rgba(0, 0, 0, .4);
                }

                a {
                    color: #30e3ca;
                }

                .logo h1 {
                    margin: 0;
                }

                .logo h1 a {
                    color: #30e3ca;
                    font-size: 24px;
                    font-weight: 700;
                    font-family: 'Lato', sans-serif;
                }

                .hero {
                    position: relative;
                    z-index: 0;
                }

                .hero .text h2 {
                    color: #000;
                    font-size: 40px;
                    margin-bottom: 0;
                    font-weight: 400;
                    line-height: 1.4;
                }

                .hero .text h3 {
                    font-size: 20px;
                    font-weight: 300;
                    margin-top: 10px;
                }

                .hero .text h2 span {
                    font-weight: 600;
                    color: #30e3ca;
                }

                .heading-section h2 {
                    color: #000000;
                    font-size: 28px;
                    margin-top: 0;
                    line-height: 1.4;
                    font-weight: 400;
                }

                .heading-section .subheading {
                    margin-bottom: 20px !important;
                    display: inline-block;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: rgba(0, 0, 0, .4);
                    position: relative;
                }

                .heading-section .subheading::after {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: -10px;
                    content: '';
                    width: 100%;
                    height: 2px;
                    background: #30e3ca;
                    margin: 0 auto;
                }

                .heading-section-white {
                    color: rgba(255, 255, 255, .8);
                }

                .heading-section-white h2 {
                    line-height: 1;
                    padding-bottom: 0;
                }

                .heading-section-white h2 {
                    color: #ffffff;
                }

                .heading-section-white .subheading {
                    margin-bottom: 0;
                    display: inline-block;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: rgba(255, 255, 255, .4);
                }

                ul.social {
                    padding: 0;
                }

                ul.social li {
                    display: inline-block;
                    margin-right: 10px;
                }
            </style>
        </head>

        <body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
            <center style="width: 100%; background-color: #f1f1f1;">
                <div style="display: none; font-size: 1px;max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                </div>
                <div style="max-width: 600px; margin: 0 auto;" class="email-container">
                    <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                        <tr>
                            <td valign="middle" class="hero bg_white" style="padding: 2em 0 4em 0;">
                                <table>
                                    <tr>
                                        <td align="center" valign="middle" style="padding: 33px 0">
                                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                                            </a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div class="text" style="padding: 0 2.5em; text-align: left;">
                                                <h4>Dear Subscriber,</h4>
                                                <p>Thank you for subscribing to ${website}!</p>
                                                <p>We are excited to have you with us. Stay tuned for updates and new content.</p>
                                                <p>
                                                    Regards, <br /> Indexx Team <br />
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <table width="100%" style="margin-top: 50px; padding: 20px 0;" role="presentation">
                                    <tr>
                                        <td align="center" style="margin-bottom: 20px; display: block;">
                                            <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                            </a>
                                            <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;" />
                                            </a>
                                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;" />
                                            </a>
                                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                            </a>
                                        </td>
                                    </tr>
                                    <br />
                                    <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                                        <td style="padding: 20px 0; color: #221F1F;">
                                            Indexx Limited, CUB Financial Centre,<br />GF6, Lyford Cay, Nassau, Bahamas.<br /><br />550 Newport Center Drive, Newport Beach, CA 92660 United States.<br /><br />Copyright © 2024 All Rights Reserved by Indexx.
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>
            </center>
        </body>

        </html>`,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendAcademyContactFormEmail(email: string, user: any) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "Contact Message",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

        <head>
            <meta charset="utf-8">
            <!-- utf-8 works for most cases -->
            <meta name="viewport" content="width=device-width">
            <!-- Forcing initial-scale shouldn't be necessary -->
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <!-- Use the latest (edge) version of IE rendering engine -->
            <meta name="x-apple-disable-message-reformatting">
            <!-- Disable auto-scale in iOS 10 Mail entirely -->
            <title></title>
            <!-- The title tag shows in email notifications, like Android 4.4. -->

            <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">

            <!-- CSS Reset : BEGIN -->
            <style>
                /* What it does: Remove spaces around the email design added by some email clients. */

                /* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */

                html,
                body {
                    margin: 0 auto !important;
                    padding: 0 !important;
                    height: 100% !important;
                    width: 100% !important;
                    background: #f1f1f1;
                }

                /* What it does: Stops email clients resizing small text. */

                * {
                    -ms-text-size-adjust: 100%;
                    -webkit-text-size-adjust: 100%;
                }

                /* What it does: Centers email on Android 4.4 */

                div[style*="margin: 16px 0"] {
                    margin: 0 !important;
                }

                /* What it does: Stops Outlook from adding extra spacing to tables. */

                table,
                td {
                    mso-table-lspace: 0pt !important;
                    mso-table-rspace: 0pt !important;
                }

                /* What it does: Fixes webkit padding issue. */

                table {
                    border-spacing: 0 !important;
                    border-collapse: collapse !important;
                    table-layout: fixed !important;
                    margin: 0 auto !important;
                }

                /* What it does: Uses a better rendering method when resizing images in IE. */

                img {
                    -ms-interpolation-mode: bicubic;
                }

                /* What it does: Prevents Windows 10 Mail from underlining links despite inline CSS. Styles for underlined links should be inline. */

                a {
                    text-decoration: none;
                }

                /* What it does: A work-around for email clients meddling in triggered links. */

                *[x-apple-data-detectors],
                /* iOS */

                .unstyle-auto-detected-links *,
                .aBn {
                    border-bottom: 0 !important;
                    cursor: default !important;
                    color: inherit !important;
                    text-decoration: none !important;
                    font-size: inherit !important;
                    font-family: inherit !important;
                    font-weight: inherit !important;
                    line-height: inherit !important;
                }

                /* What it does: Prevents Gmail from displaying a download button on large, non-linked images. */

                .a6S {
                    display: none !important;
                    opacity: 0.01 !important;
                }

                /* What it does: Prevents Gmail from changing the text color in conversation threads. */

                .im {
                    color: inherit !important;
                }

                /* If the above doesn't work, add a .g-img class to any image in question. */

                img.g-img+div {
                    display: none !important;
                }

                /* What it does: Removes right gutter in Gmail iOS app: https://github.com/TedGoas/Cerberus/issues/89  */

                /* Create one of these media queries for each additional viewport size you'd like to fix */

                /* iPhone 4, 4S, 5, 5S, 5C, and 5SE */

                @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                    u~div .email-container {
                        min-width: 320px !important;
                    }
                }

                /* iPhone 6, 6S, 7, 8, and X */

                @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                    u~div .email-container {
                        min-width: 375px !important;
                    }
                }

                /* iPhone 6+, 7+, and 8+ */

                @media only screen and (min-device-width: 414px) {
                    u~div .email-container {
                        min-width: 414px !important;
                    }
                }
            </style>

            <!-- CSS Reset : END -->

            <!-- Progressive Enhancements : BEGIN -->
            <style>
                .primary {
                    background: #30e3ca;
                }

                .bg_white {
                    background: #ffffff;
                }

                .bg_light {
                    background: #fafafa;
                }

                .bg_black {
                    background: #000000;
                }

                .bg_dark {
                    background: rgba(0, 0, 0, .8);
                }

                .email-section {
                    padding: 2.5em;
                }

                /*BUTTON*/

                .btn {
                    padding: 10px 15px;
                    display: inline-block;
                }

                .btn.btn-primary {
                    border-radius: 5px;
                    background: #3056de !important;
                    color: #ffffff;
                    transition: .5s;
                }

                .btn.btn-primary:hover {
                    background: #5b77db !important;
                    color: #ffffff;
                }

                .btn.btn-white {
                    border-radius: 5px;
                    background: #ffffff;
                    color: #000000;
                }

                .btn.btn-white-outline {
                    border-radius: 5px;
                    background: transparent;
                    border: 1px solid #fff;
                    color: #fff;
                }

                .btn.btn-black-outline {
                    border-radius: 0px;
                    background: transparent;
                    border: 2px solid #000;
                    color: #000;
                    font-weight: 700;
                }

                h1,
                h2,
                h3,
                h4,
                h5,
                h6 {
                    font-family: 'Lato', sans-serif;
                    color: #000000;
                    margin-top: 0;
                    font-weight: 400;
                }

                body {
                    font-family: 'Lato', sans-serif;
                    font-weight: 400;
                    font-size: 15px;
                    line-height: 1.8;
                    color: rgba(0, 0, 0, .4);
                }

                a {
                    color: #30e3ca;
                }

                /*LOGO*/

                .logo h1 {
                    margin: 0;
                }

                .logo h1 a {
                    color: #30e3ca;
                    font-size: 24px;
                    font-weight: 700;
                    font-family: 'Lato', sans-serif;
                }

                /*HERO*/

                .hero {
                    position: relative;
                    z-index: 0;
                }

                .hero .text h2 {
                    color: #000;
                    font-size: 40px;
                    margin-bottom: 0;
                    font-weight: 400;
                    line-height: 1.4;
                }

                .hero .text h3 {
                    font-size: 20px;
                    font-weight: 300;
                    margin-top: 10px;
                }

                .hero .text h2 span {
                    font-weight: 600;
                    color: #30e3ca;
                }

                /*HEADING SECTION*/

                .heading-section h2 {
                    color: #000000;
                    font-size: 28px;
                    margin-top: 0;
                    line-height: 1.4;
                    font-weight: 400;
                }

                .heading-section .subheading {
                    margin-bottom: 20px !important;
                    display: inline-block;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: rgba(0, 0, 0, .4);
                    position: relative;
                }

                .heading-section .subheading::after {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: -10px;
                    content: '';
                    width: 100%;
                    height: 2px;
                    background: #30e3ca;
                    margin: 0 auto;
                }

                .heading-section-white {
                    color: rgba(255, 255, 255, .8);
                }

                .heading-section-white h2 {
                    line-height: 1;
                    padding-bottom: 0;
                }

                .heading-section-white h2 {
                    color: #ffffff;
                }

                .heading-section-white .subheading {
                    margin-bottom: 0;
                    display: inline-block;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: rgba(255, 255, 255, .4);
                }

                ul.social {
                    padding: 0;
                }

                ul.social li {
                    display: inline-block;
                    margin-right: 10px;
                }
            </style>

        </head>

        <body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
            <center style="width: 100%; background-color: #f1f1f1;">
                <div style="display: none; font-size: 1px;max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                </div>
                <div style="max-width: 600px; margin: 0 auto;" class="email-container">
                    <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                        <tr>
                            <td valign="middle" class="hero bg_white" style="padding: 2em 0 4em 0;">
                                <table>
                                    <tr>
                                        <td align="center" valign="middle" style="padding: 33px 0">
                                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                                    </a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <tr>
                                            <td>
                                                <div class="text" style="padding: 0 2.5em; text-align: left;">
                                                    <h4>Name: ${user.name}</h4>
                                                    <h4>Email: ${user.email}</h4>
                                                    <h4>Phone: ${user.phone}</h4>
                                                    <h4>Subject: ${user.subject}</h4>
                                                    <h4>Message: ${user.message}</h4>

                                                    <p>
                                                        Regards, <br /> Indexx Academy Support Team <br /> All Rights Reserved by indexx.ai
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                </table>
                            </td>
                            </tr>
                            <tr>
                                <td>
                                    <table width="100%" style="margin-top: 50px; padding: 20px 0;" role="presentation">
                                        <tr>
                                            <td align="center" style="margin-bottom: 20px; display: block;">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                        </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;" />
                                                        </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;" />
                                                        </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                        </a>
                                            </td>
                                        </tr>
                                        <br />
                                        <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                                            <td style="padding: 20px 0; color: #221F1F;">
                                                Indexx Limited, CUB Financial Centre,<br />GF6, Lyford Cay, Nassau, Bahamas.<br /><br />550 Newport Center Drive, Newport Beach, CA 92660 United States.<br /><br />Copyright © 2024 All Rights Reserved by Indexx.
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                    </table>
                </div>
            </center>
        </body>

        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendAcademyCheckOutEmail(email: string, user: any, baseUrl: string) {
        try {
            // Set the API key for Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            // Log the email and name for debugging purposes
            console.log(email);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            // Initialize the Sendinblue API client
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Create the email content
            let send = await sendInMail.sendTransacEmail({
                subject: "Contact Message",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

          <head>
              <meta charset="utf-8">
              <!-- utf-8 works for most cases -->
              <meta name="viewport" content="width=device-width">
              <!-- Forcing initial-scale shouldn't be necessary -->
              <meta http-equiv="X-UA-Compatible" content="IE=edge">
              <!-- Use the latest (edge) version of IE rendering engine -->
              <meta name="x-apple-disable-message-reformatting">
              <!-- Disable auto-scale in iOS 10 Mail entirely -->
              <title></title>
              <!-- The title tag shows in email notifications, like Android 4.4. -->

              <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">

              <!-- CSS Reset : BEGIN -->
              <style>
                  /* What it does: Remove spaces around the email design added by some email clients. */

                  /* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */

                  html,
                  body {
                      margin: 0 auto !important;
                      padding: 0 !important;
                      height: 100% !important;
                      width: 100% !important;
                      background: #f1f1f1;
                  }

                  /* What it does: Stops email clients resizing small text. */

                  * {
                      -ms-text-size-adjust: 100%;
                      -webkit-text-size-adjust: 100%;
                  }

                  /* What it does: Centers email on Android 4.4 */

                  div[style*="margin: 16px 0"] {
                      margin: 0 !important;
                  }

                  /* What it does: Stops Outlook from adding extra spacing to tables. */

                  table,
                  td {
                      mso-table-lspace: 0pt !important;
                      mso-table-rspace: 0pt !important;
                  }

                  /* What it does: Fixes webkit padding issue. */

                  table {
                      border-spacing: 0 !important;
                      border-collapse: collapse !important;
                      table-layout: fixed !important;
                      margin: 0 auto !important;
                  }

                  /* What it does: Uses a better rendering method when resizing images in IE. */

                  img {
                      -ms-interpolation-mode: bicubic;
                  }

                  /* What it does: Prevents Windows 10 Mail from underlining links despite inline CSS. Styles for underlined links should be inline. */

                  a {
                      text-decoration: none;
                  }

                  /* What it does: A work-around for email clients meddling in triggered links. */

                  *[x-apple-data-detectors],
                  /* iOS */

                  .unstyle-auto-detected-links *,
                  .aBn {
                      border-bottom: 0 !important;
                      cursor: default !important;
                      color: inherit !important;
                      text-decoration: none !important;
                      font-size: inherit !important;
                      font-family: inherit !important;
                      font-weight: inherit !important;
                      line-height: inherit !important;
                  }

                  /* What it does: Prevents Gmail from displaying a download button on large, non-linked images. */

                  .a6S {
                      display: none !important;
                      opacity: 0.01 !important;
                  }

                  /* What it does: Prevents Gmail from changing the text color in conversation threads. */

                  .im {
                      color: inherit !important;
                  }

                  /* If the above doesn't work, add a .g-img class to any image in question. */

                  img.g-img+div {
                      display: none !important;
                  }

                  /* What it does: Removes right gutter in Gmail iOS app: https://github.com/TedGoas/Cerberus/issues/89  */

                  /* Create one of these media queries for each additional viewport size you'd like to fix */

                  /* iPhone 4, 4S, 5, 5S, 5C, and 5SE */

                  @media only screen and (min-device-width: 320px) and (max-device-width: 374px) {
                      u~div .email-container {
                          min-width: 320px !important;
                      }
                  }

                  /* iPhone 6, 6S, 7, 8, and X */

                  @media only screen and (min-device-width: 375px) and (max-device-width: 413px) {
                      u~div .email-container {
                          min-width: 375px !important;
                      }
                  }

                  /* iPhone 6+, 7+, and 8+ */

                  @media only screen and (min-device-width: 414px) {
                      u~div .email-container {
                          min-width: 414px !important;
                      }
                  }
              </style>

              <!-- CSS Reset : END -->

              <!-- Progressive Enhancements : BEGIN -->
              <style>
                  .primary {
                      background: #30e3ca;
                  }

                  .bg_white {
                      background: #ffffff;
                  }

                  .bg_light {
                      background: #fafafa;
                  }

                  .bg_black {
                      background: #000000;
                  }

                  .bg_dark {
                      background: rgba(0, 0, 0, .8);
                  }

                  .email-section {
                      padding: 2.5em;
                  }

                  /*BUTTON*/

                  .btn {
                      padding: 10px 15px;
                      display: inline-block;
                  }

                  .btn.btn-primary {
                      border-radius: 5px;
                      background: #3056de !important;
                      color: #ffffff;
                      transition: .5s;
                  }

                  .btn.btn-primary:hover {
                      background: #5b77db !important;
                      color: #ffffff;
                  }

                  .btn.btn-white {
                      border-radius: 5px;
                      background: #ffffff;
                      color: #000000;
                  }

                  .btn.btn-white-outline {
                      border-radius: 5px;
                      background: transparent;
                      border: 1px solid #fff;
                      color: #fff;
                  }

                  .btn.btn-black-outline {
                      border-radius: 0px;
                      background: transparent;
                      border: 2px solid #000;
                      color: #000;
                      font-weight: 700;
                  }

                  h1,
                  h2,
                  h3,
                  h4,
                  h5,
                  h6 {
                      font-family: 'Lato', sans-serif;
                      color: #000000;
                      margin-top: 0;
                      font-weight: 400;
                  }

                  body {
                      font-family: 'Lato', sans-serif;
                      font-weight: 400;
                      font-size: 15px;
                      line-height: 1.8;
                      color: rgba(0, 0, 0, .4);
                  }

                  a {
                      color: #30e3ca;
                  }

                  /*LOGO*/

                  .logo h1 {
                      margin: 0;
                  }

                  .logo h1 a {
                      color: #30e3ca;
                      font-size: 24px;
                      font-weight: 700;
                      font-family: 'Lato', sans-serif;
                  }

                  /*HERO*/

                  .hero {
                      position: relative;
                      z-index: 0;
                  }

                  .hero .text h2 {
                      color: #000;
                      font-size: 40px;
                      margin-bottom: 0;
                      font-weight: 400;
                      line-height: 1.4;
                  }

                  .hero .text h3 {
                      font-size: 20px;
                      font-weight: 300;
                      margin-top: 10px;
                  }

                  .hero .text h2 span {
                      font-weight: 600;
                      color: #30e3ca;
                  }

                  /*HEADING SECTION*/

                  .heading-section h2 {
                      color: #000000;
                      font-size: 28px;
                      margin-top: 0;
                      line-height: 1.4;
                      font-weight: 400;
                  }

                  .heading-section .subheading {
                      margin-bottom: 20px !important;
                      display: inline-block;
                      font-size: 13px;
                      text-transform: uppercase;
                      letter-spacing: 2px;
                      color: rgba(0, 0, 0, .4);
                      position: relative;
                  }

                  .heading-section .subheading::after {
                      position: absolute;
                      left: 0;
                      right: 0;
                      bottom: -10px;
                      content: '';
                      width: 100%;
                      height: 2px;
                      background: #30e3ca;
                      margin: 0 auto;
                  }

                  .heading-section-white {
                      color: rgba(255, 255, 255, .8);
                  }

                  .heading-section-white h2 {
                      line-height: 1;
                      padding-bottom: 0;
                  }

                  .heading-section-white h2 {
                      color: #ffffff;
                  }

                  .heading-section-white .subheading {
                      margin-bottom: 0;
                      display: inline-block;
                      font-size: 13px;
                      text-transform: uppercase;
                      letter-spacing: 2px;
                      color: rgba(255, 255, 255, .4);
                  }

                  ul.social {
                      padding: 0;
                  }

                  ul.social li {
                      display: inline-block;
                      margin-right: 10px;
                  }
              </style>

          </head>

          <body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
              <center style="width: 100%; background-color: #f1f1f1;">
                  <div style="display: none; font-size: 1px;max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
                  </div>
                  <div style="max-width: 600px; margin: 0 auto;" class="email-container">
                      <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                          <tr>
                              <td valign="middle" class="hero bg_white" style="padding: 2em 0 4em 0;">
                                  <table>
                                      <tr>
                                          <td align="center" valign="middle" style="padding: 33px 0">
                                              <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                              </a>
                                          </td>
                                      </tr>
                                      <tr>
                                          <tr>
                                              <td>
                                                  <div class="text" style="padding: 0 2.5em; text-align: left;">
                                                      <h4>Name: ${user.name}</h4>
                                                      <h4>Email: ${user.email}</h4>
                                                      <h4>Phone: ${user.phone}</h4>
                                                      <h4>Subject: ${user.subject}</h4>
                                                      <h4>Message: ${user.message}</h4>

                                                      <p>
                                                          Regards, <br /> Indexx Academy Support Team <br /> All Rights Reserved by indexx.ai
                                                      </p>
                                                  </div>
                                              </td>
                                          </tr>
                                  </table>
                              </td>
                              </tr>
                      </table>
                      <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
                          <tr>
                              <td valign="middle" class="bg_light footer email-section">
                                  <table>
                                      <tr>
                                          <td valign="top" width="33.333%" style="padding-top: 20px;text-align: center;">
                                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                  <tr>
                                                      <td style="text-align: center; padding-right: 0;">
                                                          <p style="text-align: center; margin-bottom: 0; margin-top: 5px">
                                                              <a href="http://indexx.ai/" target="_blank" style="color: #3056de">www.indexx.ai</a>
                                                          </p>
                                                      </td>
                                                  </tr>
                                              </table>
                                          </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td class="bg_light" style="text-align: center;">
                                  <p>&copy;2024 Indexx.ai Support</p>
                              </td>
                          </tr>
                      </table>

                  </div>
              </center>
          </body>

          </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });

            // Log the result for debugging purposes
            console.log("send", send);

            // Return a success message
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            // Log the error for debugging purposes
            console.error("Error sending email", err);

            // Return an error message
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendOrderCreated(
        email: string,
        name: string,
        orderAmount: number,
        orderCurrency: string,
        orderType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Order Created",
                sender: { email: "omkar@indexx.ai", name: "Omkar" },
                replyTo: { email: `wallet@indexx.ai`, name: "Sendinblue" },
                to: [{ name: "John Doe", email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for order on Indexx Exchange. Please find below your order details.<br> <br>
                Order Amount: ${orderAmount} ${orderCurrency}<br>
                Order Status: ${OrderStatus.Quoted}
                Order Type: ${orderType}
                Thanks, <br>
                Indexx Exchange Team
                </h1></body></html>`,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendBtcySellOrderReceived(details: BtcySellOrderUserEmail) {
        try {
            const toEmail = String(details.userEmail || "").trim().toLowerCase();
            if (!this.isEmailValid(toEmail)) {
                console.warn("Invalid email for sendBtcySellOrderReceived:", details.userEmail);
                return { status: 400, message: "Invalid email" };
            }

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: "BTCY Sell Order Received - Processing Within 3 Business Days",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { name: "Bitcoin Yay", email: "wallet@indexx.ai" },
                to: [{ email: toEmail }],
                bcc: BTCY_SELL_APPROVAL_BCC_EMAILS,
                htmlContent: this.buildBtcySellOrderEmailHtml({
                    title: "BTCY Sell Order Received",
                    greetingName: details.userName,
                    intro:
                        "Thank you for submitting your BTCY sell order. We have received your request and it is now being reviewed and processed manually by our team.",
                    detailsTitle: "Order Details",
                    rows: [
                        {
                            label: "BTCY Amount Sold",
                            value: `${this.formatEmailAmount(details.btcyAmount)} BTCY`,
                        },
                        {
                            label: "USDT Amount to Receive",
                            value: `${this.formatEmailAmount(details.usdtAmount)} USDT`,
                        },
                        {
                            label: "Wallet Address",
                            value: details.walletAddress,
                        },
                        {
                            label: "Submitted On",
                            value: this.formatEmailDate(details.submittedAt),
                        },
                    ],
                    bodyAfterDetails:
                        "Your USDT payment will be delivered to your provided wallet address within 3 business days. Please note that the amount you receive is based on the rate at the time your sell order was submitted.",
                    closing:
                        "We will notify you by email once the payment has been completed. Thank you for your patience and for being part of the Bitcoin Yay community.",
                }),
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Error sending BTCY sell order received email:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }

    async sendBtcySellOrderCompleted(details: BtcySellOrderUserEmail) {
        try {
            const toEmail = String(details.userEmail || "").trim().toLowerCase();
            if (!this.isEmailValid(toEmail)) {
                console.warn("Invalid email for sendBtcySellOrderCompleted:", details.userEmail);
                return { status: 400, message: "Invalid email" };
            }

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: "BTCY Sell Order Completed - USDT Sent",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { name: "Bitcoin Yay", email: "wallet@indexx.ai" },
                to: [{ email: toEmail }],
                bcc: BTCY_SELL_APPROVAL_BCC_EMAILS,
                htmlContent: this.buildBtcySellOrderEmailHtml({
                    title: "BTCY Sell Order Completed",
                    greetingName: details.userName,
                    intro: "Your BTCY sell order has been successfully completed.",
                    detailsTitle: "Payment Details",
                    rows: [
                        {
                            label: "BTCY Amount Sold",
                            value: `${this.formatEmailAmount(details.btcyAmount)} BTCY`,
                        },
                        {
                            label: "USDT Amount Sent",
                            value: `${this.formatEmailAmount(details.usdtAmount)} USDT`,
                        },
                        {
                            label: "Wallet Address",
                            value: details.walletAddress,
                        },
                        {
                            label: "Transaction ID / Hash",
                            value: details.transactionHash || "-",
                        },
                        {
                            label: "Completed On",
                            value: this.formatEmailDate(details.completedAt),
                        },
                    ],
                    bodyAfterDetails:
                        "The USDT has now been sent to your wallet. Depending on network activity, it may take a short time to appear in your wallet balance.",
                    closing:
                        "Thank you for using the BTCY sell feature. We appreciate your patience as we continue improving and automating this process.",
                }),
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Error sending BTCY sell order completed email:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }


    async sendCompromisedAccountReport(
        email: string,
        name: string,
        additionalDetails: string,
        website: string = ""
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const logoURL =
                website === "BTCY-MOBLIE-APP"
                    ? "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png"
                    : "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx.ai - Compromised Account Report`,
                sender: { name: "Indexx.ai Support", email: "support@indexx.ai" },
                replyTo: { email: "support@indexx.ai", name: "Indexx.ai Support" },
                to: [{ email: email }],
                bcc: [...DEFAULT_BCC_EMAILS, { email: "support@indexx.ai" }],
                htmlContent: `<!DOCTYPE html>
        <html>
          <head>
              <title>Compromised Account Report</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body{ font-family: Arial, Helvetica, sans-serif; }
                .main#main { width:600px; margin:auto; }
                @media only screen and (max-width: 600px) { .main#main { width:96%; } }
              </style>
          </head>
          <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
              <tbody>
                <tr>
                  <td align="center" valign="middle" style="padding:33px 0">
                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> 
                        <img src="${logoURL}" alt="IndexIcon" style="width: ${website === 'BTCY-MOBLIE-APP' ? '200px' : '150px'}; max-width: 80%; height: auto;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style="padding:0 30px;background:#fff">
                      <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                        <tbody>
                          <tr>
                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                              <strong>Hello ${name},</strong><br><br>
                              We've received your report about a potentially compromised account. Our security team has been notified and will contact you shortly to help secure your account.
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #5f5f5f;">
                              <br/>
                              <strong>Details you provided:</strong><br>
                              ${additionalDetails || 'No additional details provided'}
                              <br/><br/>
                              If you didn't initiate this request, please contact our support team immediately at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size:12px;color:#666;">
                              <br/>
                              This is an automated message. Please do not reply.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <!-- Footer content same as order completed email -->
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>`,
                params: { bodyMessage: "Security Alert" },
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }

    async sendFakeAccountReport(
        email: string,
        name: string,
        currentUsername: string,
        realUsername: string,
        website: string = ""
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            const logoURL =
                website === "BTCY-MOBLIE-APP"
                    ? "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png"
                    : "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";

            const currentYear = new Date().getFullYear();

            const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Fake Account Report</title>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; background-color: #f9f9f9; padding: 0; margin: 0; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; }
                  .header { text-align: center; margin-bottom: 20px; }
                  .logo { margin-bottom: 20px; }
                  .content { margin-bottom: 30px; }
                  .details { background: #f5f5f5; padding: 15px; border-radius: 5px; }
                  .footer { font-size: 12px; color: #777; text-align: center; margin-top: 40px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="logo" style="text-align:center;">
                       <img src="${logoURL}" alt="IndexIcon" style="width: ${website === 'BTCY-MOBLIE-APP' ? '200px' : '150px'}; max-width: 80%; height: auto;" />
                  </div>
                  <div class="header">
                    <h2>Fake Account Self-Report</h2>
                  </div>
                  <div class="content">
                    <p>Hello ${name},</p>
                    <p>We've received your report about a potentially fake account.</p>
                    <div class="details">
                      <h3>Report Details:</h3>
                      <p><strong>Account to deactivate:</strong> ${currentUsername}</p>
                      <p><strong>Real account to keep:</strong> ${realUsername}</p>
                    </div>
                    <p>Our fraud team will review this report and contact you if additional 
                    information is needed.</p>
                    <p>If you didn't initiate this request, please contact our support team 
                    immediately at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.</p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message. Please do not reply directly.</p>
                    <p>&copy; ${currentYear} Indexx.ai. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const send = await sendInMail.sendTransacEmail({
                subject: `Indexx.ai - Fake Account Report`,
                sender: { name: "Indexx.ai Support", email: "support@indexx.ai" },
                replyTo: { email: "support@indexx.ai", name: "Indexx.ai Support" },
                to: [{ email }],
                bcc: [...DEFAULT_BCC_EMAILS, { email: "support@indexx.ai" }],
                htmlContent,
                params: {
                    name,
                    currentUsername,
                    realUsername,
                },
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }


    async sendOrderCompleted(
        email: string,
        name: string,
        orderAmount: number,
        orderCurrency: string,
        orderType: string,
        priceInUSD: number,
        amountInUSD: number,
        notes: string = "",
        orderId: string = ""
    ) {
        try {
            console.log("Starting email send process for order:", orderId);
            console.log("Email recipient:", email);

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            console.log("API Key configured:", process.env.SENDINBLUE_API_KEY ? "Yes (key exists)" : "No (key missing)");

            // Fetch all images as base64 to ensure they load in email clients
            const imageUrls = {
                logo: "https://indexx-exchange-new.s3.us-east-1.amazonaws.com/indexx_email_logo.png",
                twitter: "https://indexx-exchange-new.s3.us-east-1.amazonaws.com/Twitter.png",
                instagram: "https://indexx-exchange-new.s3.us-east-1.amazonaws.com/Insta.png",
                youtube: "https://indexx-exchange-new.s3.us-east-1.amazonaws.com/Youtube.png",
                facebook: "https://indexx-exchange-new.s3.us-east-1.amazonaws.com/FaceBook.png"
            };

            // Fetch all images in parallel
            const [logoBase64, twitterBase64, instagramBase64, youtubeBase64, facebookBase64] = await Promise.all([
                this.fetchImageAsBase64(imageUrls.logo),
                this.fetchImageAsBase64(imageUrls.twitter),
                this.fetchImageAsBase64(imageUrls.instagram),
                this.fetchImageAsBase64(imageUrls.youtube),
                this.fetchImageAsBase64(imageUrls.facebook)
            ]);

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx Exchange ${orderCurrency} ${orderType} ${orderId} Order Completed`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Page Title</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

          <style>
            body{
                font-family: Arial, Helvetica, sans-serif;
            }
          .main#main {
          width:600px;
          margin:auto;
          }

          @media only screen and (max-width: 600px) {
          .main#main {
          width:96%;
          }
          }
          </style>
            </head>
            <body>

                <table  slign="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                                    </td>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px 30px;" cellspacing="0"
                                        cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">Thank you for ordering on Indexx Exchange. Below, are the details of your order <br>
                                                    <span style="padding:5px
                                                        0;font-size:30px;font-weight:bolder;color:#F66036">
                                                      
                                                    </span>
                                                </td>
                                               <tr>
                                                <td style="color: #5f5f5f;">
                                                    <br/ >
                                                    Order Amount:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    ${Math.floor(
                    orderAmount * 1000
                ) / 1000
                    } ${orderCurrency}
                                                    </b>
                                                    <br/>
                                                    Order Id:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    ${orderId}
                                                    </b>
                                                    <br/>
                                                    Order Status:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    Completed
                                                    </b>
                                                    <br/>
                                                    Order Type:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    ${orderType}
                                                    </b>
                                                    <br/>
                                                    Price in USD:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    $${priceInUSD < 1
                        ? priceInUSD.toFixed(5)
                        : priceInUSD.toLocaleString(
                            undefined,
                            {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            }
                        )
                    }
                                                    </b>
                                                    <br/>
                                                    Amount in USD:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    $${amountInUSD.toLocaleString(
                        undefined,
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        }
                    )}
                                                    </b>
                                                    <br/>
                                                    ${(orderCurrency ===
                        "WIBS" ||
                        orderCurrency ===
                        "DaCrazy") &&
                        orderType === "Buy" &&
                        notes
                        ? `<br/><strong>This order has </strong> ${notes}`
                        : ""
                    }
                                                      
                                                </td>
                                            </tr>
                                            </tr>
                                            <br/>
                                            <br/>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">This is an automated message. Please do not reply.
                                                <br/>
                                            </td>
                                            </tr>
                                        </tbody></table>
                                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                                <tbody>
                                                <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/ > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td></tr>
                                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                            
                                    
                                                        <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                            <br/>
                                                            <br/>
                                                            <br/><br/>550 Newport Center Drive
                                                            <br/>
                                                            <br/>Newport Beach,
                                                            <br/>
                                                            <br/>CA 92660 United State
                                                            <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                                        </td>
                                                  
                                        </tr>
                                                </tbody>
                                            </table>
                                </div>
                            </td>
                        </tr>
                        
                        </tbody>
                    </table>

                </body>
            </html>`,
                params: { bodyMessage: "Made just for you!" },
            });

            console.log("Email service response:", JSON.stringify(send));
            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }

    async sendDepositReceived(
        email: string,
        name: string,
        depositAmount: number,
        assetCurrency: string,                  // e.g., BTC, ETH, USDT
        usdValue: number,                       // deposit value in USD
        previousBalance?: number,               // prior wallet balance in asset
        newBalance?: number,                    // post-credit wallet balance in asset
    ) {
        try {
            console.log("Starting email send process for deposit:", { email, assetCurrency, depositAmount });

            // Configure Sendinblue API key
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey = process.env.SENDINBLUE_API_KEY;
            console.log("API Key configured:", process.env.SENDINBLUE_API_KEY ? "Yes (key exists)" : "No (key missing)");

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Helpers
            const fmtAsset = (v: number) =>
                v < 0.000001 ? v.toFixed(8) : Math.floor(v * 1e8) / 1e8; // avoid scientific notation; trim to 8dp
            const fmtUSD = (v: number) =>
                v < 1
                    ? v.toFixed(5)
                    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const balanceLines =
                typeof previousBalance === "number" && typeof newBalance === "number"
                    ? `
          <br/>Previous Balance:
          <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
            ${fmtAsset(previousBalance)} ${assetCurrency}
          </b>
          <br/>New Balance:
          <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
            ${fmtAsset(newBalance)} ${assetCurrency}
          </b>
        `
                    : "";


            const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <title>Deposit Received</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{ font-family: Arial, Helvetica, sans-serif; }
      .main#main { width:600px; margin:auto; }
      @media only screen and (max-width: 600px) {
        .main#main { width:96%; }
      }
      a { color: #F66036; }
    </style>
  </head>
  <body>
    <table slign="center" border="0" cellspacing="0" class="main" id="main">
      <tbody>
        <tr>
          <td align="center" valign="middle" style="padding:33px 0">
            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
            </a>
          </td>
        </tr>
        <tr>
          <td>
            <div style="padding:0 30px;background:#fff">
              <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                <tbody>
                  <tr>
                    <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                      Hi ${name || "there"},
                      <br/><br/>
                      Great news — your deposit has been <strong>received</strong> and your asset wallet has been <strong>credited</strong>.
                      Below are the details of your deposit:
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#5f5f5f;">
                      <br/>
                      Deposit Amount:
                      <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                        ${fmtAsset(depositAmount)} ${assetCurrency}
                      </b>
                      <br/>
                      Amount in USD:
                      <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                        $${fmtUSD(usdValue)}
                      </b>
                      ${balanceLines}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#666;padding-top:20px;">
                      This is an automated message. Please do not reply.
                    </td>
                  </tr>
                </tbody>
              </table>

              <table width="100%" style="margin-top:50px;padding:20px 0;">
                <tbody>
                  <tr>
                    <td align="center" style="margin-bottom:20px;display:block">
                      <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                      </a>
                      <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/>
                      </a>
                      <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/>
                      </a>
                      <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                      </a>
                    </td>
                  </tr>
                  <tr style="background:#E4E4E4;text-align:center;font-size:10px;" align="center">
                    <td style="padding:20px 0;color:#221F1F;">
                      indexx.ai
                      <br/><br/><br/><br/>550 Newport Center Drive
                      <br/><br/>Newport Beach,
                      <br/><br/>CA 92660 United State
                      <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

            const send = await sendInMail.sendTransacEmail({
                subject: `Indexx Exchange ${assetCurrency} Deposit Received – Wallet Credited`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent,
                params: { bodyMessage: "Made just for you!" },
            });

            console.log("Email service response:", JSON.stringify(send));
            return { status: 200, message: "Deposit email sent successfully" };
        } catch (err: any) {
            console.error("Deposit email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }


    async sendPaymentClaimReminderToTeam(payload: TeamClaimEmail) {
        try {
            const { claimantEmail, type } = payload;

            // Configure API key once per process
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY as string;

            const api = new SibApiV3Sdk.TransactionalEmailsApi();

            const fmt = (v: any) => (v === undefined || v === null || v === "" ? "—" : String(v));
            const pairs: Array<[string, string]> = [
                ["Claim Type", type.toUpperCase()],
                ["User Email", fmt(claimantEmail)],
                ["Matched OrderId", fmt(payload.matchedOrderId)],
                ["Amount", payload.amount != null ? String(payload.amount) : "—"],
                ["Paid At (user provided)", fmt(payload.paidAt)],
            ];

            if (type === "crypto") {
                pairs.push(
                    ["Coin", fmt(payload.coin)],
                    ["Blockchain", fmt(payload.blockchain)],
                    ["Tx Hash", fmt(payload.txHash)]
                );
            } else {
                pairs.push(
                    ["Payment Method", fmt(payload.paymentMethod)],
                    ["PayPal Txn Id", fmt(payload.paypalTxnId)],
                    ["Processor Txn Id", fmt(payload.processorTxnId)],
                    ["Proof (screenshot URL)", fmt(payload.proofUrl)]
                );
            }

            const rows = pairs
                .map(
                    ([k, v]) =>
                        `<tr><td style="padding:6px 10px;border:1px solid #eee;"><b>${k}</b></td><td style="padding:6px 10px;border:1px solid #eee;">${v}</td></tr>`
                )
                .join("");

            const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color:#222; }
      .box { border:1px solid #f0f0f0; border-radius:8px; padding:16px; }
      a { color:#F66036; }
    </style>
  </head>
  <body>
    <div class="box">
      <h2 style="margin:0 0 12px;">🔔 Payment Claim Submitted (Already Paid)</h2>
      <p style="margin:0 0 12px;">A user submitted an <b>Already Paid</b> claim without orderId. Please review and reconcile.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; margin-top:10px;">
        ${rows}
      </table>
      <p style="margin-top:14px; font-size:12px; color:#666;">
        This is an automated notice for the ops team.
      </p>
    </div>
  </body>
</html>`;

            await api.sendTransacEmail({
                subject: `[Indexx] Already-Paid Claim – ${type.toUpperCase()} – ${payload.claimantEmail}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { name: "Indexx.ai", email: "wallet@indexx.ai" },
                to: [
                    { email: "omkar@azooca.com", name: "Omkar" },
                    { email: "bz@azooca.com", name: "BZ" },
                    { email: "lili@azooca.com", name: "Lili" },
                ],
                htmlContent,
            });

            return { ok: true };
        } catch (err: any) {
            console.error("sendPaymentClaimReminderToTeam error:", err?.message || err);
            return { ok: false, error: err?.message || "mail-failed" };
        }
    }

    async sendWithdrawRequestEmail(
        email: string,
        name: string,
        requestAmount: number,
        approvedAmount: number,
        withdrawalMethod: string,
        requestId: string,
        statusLabel: string = "Pending Approval",
        details: {
            amountCurrency?: string;
            walletAddress?: string;
            network?: string;
            txHash?: string;
            reason?: string;
            bodyMessage?: string;
            subjectStatus?: string;
            emailType?: "miningStation" | "cryptoWithdrawal";
        } = {}
    ) {
        try {
            const emailType = details.emailType || "miningStation";
            const isCryptoWithdrawalEmail = emailType === "cryptoWithdrawal";
            const subjectPrefix = isCryptoWithdrawalEmail
                ? "Indexx Crypto Withdrawal"
                : "Bitcoin Yay Mining Station Withdrawal";
            const logoLink = isCryptoWithdrawalEmail
                ? "https://indexx.ai/"
                : "https://bitcoin-yay.com/";
            const logoSrc = isCryptoWithdrawalEmail
                ? "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png"
                : "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png";
            const logoAlt = isCryptoWithdrawalEmail ? "Indexx.ai" : "Bitcoin Yay";
            const logoWidth = isCryptoWithdrawalEmail ? 150 : 240;
            const amountCurrency = String(details.amountCurrency || withdrawalMethod || "BTCY").toUpperCase();
            const walletAddress = String(details.walletAddress || "").trim();
            const network = String(details.network || "").trim();
            const txHash = String(details.txHash || "").trim();
            const reason = String(details.reason || "").trim();
            const bodyMessage = String(details.bodyMessage || "Your withdrawal request has been received. Below are the details of your request:");
            const subjectStatus = String(details.subjectStatus || "").trim();
            const footerMessage = statusLabel === "Approved"
                ? "Your withdrawal has been approved."
                : statusLabel === "Rejected"
                    ? "Your withdrawal request was rejected. If you have questions, please contact support."
                    : "Your request is being processed and you will receive an update once the withdrawal is approved.";
            const optionalDetailRows = [
                walletAddress
                    ? `
                                                    <br/>
                                                    Withdrawal Address:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036; word-break:break-all;">
                                                      ${this.escapeHtml(walletAddress)}
                                                    </b>`
                    : "",
                network
                    ? `
                                                    <br/>
                                                    Network:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                      ${this.escapeHtml(network)}
                                                    </b>`
                    : "",
                txHash
                    ? `
                                                    <br/>
                                                    Transaction Hash:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036; word-break:break-all;">
                                                      ${this.escapeHtml(txHash)}
                                                    </b>`
                    : "",
                reason
                    ? `
                                                    <br/>
                                                    Reason:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                      ${this.escapeHtml(reason)}
                                                    </b>`
                    : "",
            ].join("");

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `${subjectPrefix}${subjectStatus ? ` ${subjectStatus}` : ""} - ${requestId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Withdrawal Request</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                  body {
                      font-family: Arial, Helvetica, sans-serif;
                  }
                  .main#main {
                    width:600px;
                    margin:auto;
                  }
                  @media only screen and (max-width: 600px) {
                    .main#main {
                      width:96%;
                    }
                  }
                </style>
            </head>
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                              <a href="${logoLink}" target="_blank" rel="noopener noreferrer"> 
                                <img src="${logoSrc}" alt="${logoAlt}" width="${logoWidth}"/> 
                              </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
	                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
		                                                  Hi ${this.escapeHtml(name)}, <br>
		                                                  ${this.escapeHtml(bodyMessage)}<br>
	                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #5f5f5f;">
                                                    <br/>
	                                                    Request Amount:
	                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
		                                                      ${requestAmount.toLocaleString()} ${this.escapeHtml(amountCurrency)}
	                                                    </b>
	                                                    <br/>
	                                                    Approved Amount (After Fee):
	                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
		                                                      ${approvedAmount.toLocaleString()} ${this.escapeHtml(amountCurrency)}
	                                                    </b>
                                                    <br/>
                                                    Withdrawal Method:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
		                                                      ${this.escapeHtml(withdrawalMethod)}
	                                                    </b>
                                                    ${optionalDetailRows}
	                                                    <br/>
	                                                    Request ID:
                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
	                                                      ${this.escapeHtml(requestId)}
                                                    </b>
                                                    <br/>
	                                                    Status:
	                                                    <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
		                                                      ${this.escapeHtml(statusLabel)}
	                                                    </b>
                                                </td>
                                            </tr>
                                            <br/>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
	                                                  ${this.escapeHtml(footerMessage)}
                                                </td>
                                            </tr>
                                            <br/>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                  This is an automated message. Please do not reply.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/>
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/>
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                    <br/><br/>550 Newport Center Drive
                                                    <br/><br/>Newport Beach,
                                                    <br/><br/>CA 92660 United States
                                                    <br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
          </html>`,
                params: { bodyMessage: "Withdrawal Request Received" },
            });

            console.log("Withdrawal Request Email Sent:", send);
            return { status: 200, message: "Withdrawal request email sent successfully" };
        } catch (err) {
            console.error("Error sending withdrawal request email:", err);
            return { status: 500, message: "Failed to send withdrawal request email" };
        }
    }


    async sendFreeTrialSuccessEmail(email: string, selectedPackage: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx Smart Crypto Free Trial Activated!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
            <title>Indexx Smart Crypto Free Trial</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main {
                        width: 96%;
                    }
                }
            </style>
            </head>

            <body>
            <table align="center" border="0" cellspacing="0" class="main">
                <tbody>
                    <tr>
                        <td align="center" style="padding: 33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexxIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding: 0 30px; background: #fff">
                                <table width="100%" style="border: 1px solid #f0f0f0; border-radius: 5px; padding: 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                <h2>Welcome to Indexx Smart Crypto!</h2>
                                                <p>Dear User,</p>
                                                <p>Congratulations! Your Smart Crypto Free Trial has been successfully activated.</p>
                                                <p>You have received $500 (test funds) in your account to explore our Smart Crypto Free Trial.</p>
                                                <br />
                                                <b>Your Free Trial Details:</b>
                                                <ul>
                                                    <li><b>Initial Test Funds:</b> $500 (Non-withdrawable)</li>
                                                    <li><b>Investment Plan:</b> ${selectedPackage}</li>
                                                    <li><b>Track Your Portfolio:</b> Monitor performance in your Asset Wallet ➡️ Demo Investment.</li>
                                                    <li><b>Withdraw Profits:</b> Deposit a minimum of $2,500 to unlock your earnings.</li>
                                                </ul>
                                                <br />
                                                <h3>🚀 Next Steps:</h3>
                                                <p><b>1.</b> Log in to your <a href="https://indexx.ai/auth/login" target="_blank">Indexx.ai account</a>.</p>
                                                <p><b>2.</b> Monitor your portfolio and let Smart Crypto work for you.</p>
                                                <p><b>3.</b> Deposit at least $2,500 to withdraw profits from your trial investments.</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top: 50px; padding: 20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4; text-align: center; font-size: 10px;">
                                            <td style="padding: 20px 0; color: #221F1F;">
                                                Indexx.ai<br /><br />
                                                550 Newport Center Drive<br />
                                                Newport Beach, CA 92660, United States<br /><br />
                                                Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            </body>

            </html>`,
                params: { bodyMessage: "Your Free Trial is Live!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendConvertOrderCompleted(
        email: string,
        name: string,
        orderAmount: number,
        orderCurrency: string,
        orderType: string,
        priceInUSD: number,
        amountInUSD: number,
        orderId: string = "",
        exchangeFees: number = 0,
        paymentType: string = "",
        exchangeName: string = "",
        blockchainName: string = "",
        notes: string = ""
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx Exchange Convert Order ${orderId} Completed`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Convert Order Completed</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                  body {
                    font-family: Arial, Helvetica, sans-serif;
                  }
                  .main {
                    width: 600px;
                    margin: auto;
                  }
                  @media only screen and (max-width: 600px) {
                    .main {
                      width: 96%;
                    }
                  }
                </style>
            </head>
            <body>
              <table align="center" border="0" cellspacing="0" class="main">
                  <tbody>
                      <tr>
                          <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                            </a>
                          </td>
                      </tr>
                      <tr>
                          <td>
                              <div style="padding:0 30px;background:#fff">
                                  <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;">
                                      <tbody>
                                          <tr>
                                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                Thank you for using Indexx Exchange. Your convert order has been successfully completed.<br>
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="color: #5f5f5f;">
                                                  <br/>
                                                  Order ID:
                                                  <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">${orderId}</b>
                                                  <br/>
                                                  Order Type:
                                                  <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">${orderType}</b>
                                                  <br/>
                                                  Order Amount:
                                                  <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">${orderAmount} ${orderCurrency}</b>
                                                  <br/>
                                                  Exchange Fees:
                                                  <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">${exchangeFees}%</b>
                                                  <br/>
                                                  Price in USD:
                                                  <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    $${priceInUSD.toLocaleString(
                    undefined,
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                )}
                                                  </b>
                                                  <br/>
                                                  Amount in USD:
                                                  <b style="padding:5px; font-size:17px; font-weight:bolder; color:#F66036">
                                                    $${amountInUSD.toLocaleString(
                    undefined,
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                )}
                                                  </b>
                                                  <br/>
                                                  ${notes
                        ? `<br/><strong>Notes:</strong> ${notes}`
                        : ""
                    }
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                                <br/>
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                                  <table width="100%" style="margin-top:50px;padding:20px 0;">
                                      <tbody>
                                      <tr>
                                          <td align="center">
                                              <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                                              </a>
                                              <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/>
                                              </a>
                                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/>
                                              </a>
                                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                                              </a>
                                          </td>
                                      </tr>
                                      <tr style="background: #E4E4E4;text-align: center;font-size:10px;">
                                          <td style="padding:20px 0;color: #221F1F;">
                                            indexx.ai
                                            <br/>
                                            550 Newport Center Drive, Newport Beach, CA 92660, United States
                                            <br/>
                                            Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                          </td>
                                      </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </td>
                      </tr>
                  </tbody>
              </table>
            </body>
          </html>`,
                params: { bodyMessage: "Made just for you!" },
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendCongratulationsEmail(
        email: string,
        purchasedPlan: string,
        amount: string,
        category: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Congratulations on Purchasing ${purchasedPlan}!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Congratulations!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    background-color: #f4f4f4;
                }

                .main {
                    width: 600px;
                    margin: auto;
                    background: #fff;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.1);
                }

                .header {
                    text-align: center;
                    padding: 20px;
                }

                .header img {
                    width: 150px;
                }

                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    margin: 10px;
                    font-size: 16px;
                    border-radius: 5px;
                    text-decoration: none;
                    text-align: center;
                }

                .yellow {
                    background-color: #FEBA00;
                    color: black;
                    border: 1px solid #FEBA00;
                }

                .blue {
                    background-color: #07A6FC;
                    color: black;
                    border: 1px solid #07A6FC;
                }

                .footer {
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                    margin-top: 20px;
                }
            </style>
        </head>

        <body>
            <div class="main">
                <div class="header">
                    <a href="https://indexx.ai/" target="_blank">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx.ai Logo" />
                    </a>
                </div>
                <div style="text-align: center;">
                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/smartCryptoLogo.png" alt="Congratulations" width="120" />
                    <h2>Congratulations, on purchasing the Smart Crypto!</h2>
                    <p>You've successfully purchased <strong>${purchasedPlan}</strong> worth <strong>$${amount}</strong>.</p>
                    <p>You can view your purchase in your asset wallet.</p>
                    <a href="https://cex.indexx.ai/smart-crypto" class="button ${category === "x-Bitcoin" ? "yellow" : "blue"
                    }">Explore Smart Crypto</a>
                    <a href="https://cex.indexx.ai/wallet/smart-crypto" class="button ${category === "x-Bitcoin" ? "yellow" : "blue"
                    }">View Asset Wallet</a>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>If you have any queries, feel free to contact our support team at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.</p>
                    <p>Follow us on:
                        <a href="https://twitter.com/Indexx_ai">Twitter</a> |
                        <a href="https://www.instagram.com/indexx_ai/">Instagram</a> |
                        <a href="https://www.facebook.com/profile.php?id=100086225564460">Facebook</a>
                    </p>
                    <p>&copy; 2025 Indexx.ai. All Rights Reserved.</p>
                    <p>550 Newport Center Drive, Newport Beach, CA 92660, USA</p>
                </div>
            </div>
        </body>

        </html>
`,
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendPlanChangedEmail(
        email: string,
        oldPlan: string,
        newPlan: string,
        category: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your Plan Has Been Updated to ${newPlan}!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "accounts@indexx.ai", name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: [...DEFAULT_BCC_EMAILS, { email: "bz@indexx.ai" }],
                htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Plan Updated</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            background-color: #f4f4f4;
                        }
                        .main {
                            width: 600px;
                            margin: auto;
                            background: #fff;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            padding: 20px;
                        }
                        .header img {
                            width: 150px;
                        }
                        .button {
                            display: inline-block;
                            padding: 10px 20px;
                            margin: 10px;
                            font-size: 16px;
                            border-radius: 5px;
                            text-decoration: none;
                            text-align: center;
                        }
                        .yellow {
                            background-color: #FEBA00;
                            color: black;
                            border: 1px solid #FEBA00;
                        }
                        .blue {
                            background-color: #07A6FC;
                            color: black;
                            border: 1px solid #07A6FC;
                        }
                        .footer {
                            text-align: center;
                            font-size: 12px;
                            color: #666;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="main">
                        <div class="header">
                            <a href="https://indexx.ai/" target="_blank">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx.ai Logo" />
                            </a>
                        </div>
                        <div style="text-align: center;">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/smartCryptoLogo.png" alt="Updated Plan" width="120" />
                            <h2>Your Plan Has Been Successfully Updated!</h2>
                            <p>Your previous plan <strong>${oldPlan}</strong> has been upgraded to <strong>${newPlan}</strong>.</p>
                            <p>You can explore your new benefits and features now.</p>
                            <a href="https://cex.indexx.ai/wallet/smart-crypto" class="button ${category === "x-Bitcoin" ? "yellow" : "blue"}">View in Wallet</a>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply.</p>
                            <p>If you have any questions, reach out to our support team at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.</p>
                            <p>Follow us on:
                                <a href="https://twitter.com/Indexx_ai">Twitter</a> |
                                <a href="https://www.instagram.com/indexx_ai/">Instagram</a> |
                                <a href="https://www.facebook.com/profile.php?id=100086225564460">Facebook</a>
                            </p>
                            <p>&copy; 2025 Indexx.ai. All Rights Reserved.</p>
                            <p>550 Newport Center Drive, Newport Beach, CA 92660, USA</p>
                        </div>
                    </div>
                </body>
                </html>
      `,
            });

            console.log("send", send);
            return { status: 200, message: "Plan change email sent successfully" };
        } catch (err) {
            console.log("Err", err)
            return { status: 500, message: "Email not sent" };
        }
    }


    async sendUSDToIUSDOrderCompleted(
        email: string,
        name: string,
        orderAmount: number,
        lockInPeriod: string,
        conversionRate: number,
        totalIUSD: number,
        stakingDetails: any,
        orderId: string
    ) {
        try {
            // Authenticate with Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Format staking details for the email
            const formattedStakingDetails = `
    <ul>
      <li>Staked Amount: <b>${stakingDetails.stakedAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${stakingDetails.coin}</b></li>
      <li>Reward Amount: <b>${stakingDetails.rewardAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${stakingDetails.rewardCoin}</b></li>
      <li>Final Amount: <b>${stakingDetails.finalAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${stakingDetails.rewardCoin}</b></li>
      <li>Percentage: <b>${(stakingDetails.percentage * 100).toFixed(
                0
            )}%</b></li>
      <li>Duration: <b>${stakingDetails.duration}</b></li>
    </ul>
  `;

            // Send transactional email
            const response = await sendInMail.sendTransacEmail({
                subject: `Indexx Exchange USD to IUSD+ Order Completed (${orderId})`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: Arial, Helvetica, sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f8f8f8;
                }
                .container {
                  max-width: 600px;
                  margin: 20px auto;
                  background: #ffffff;
                  border-radius: 8px;
                  padding: 20px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                  text-align: center;
                  padding-bottom: 20px;
                }
                .header img {
                  width: 150px;
                }
                .content {
                  font-size: 14px;
                  line-height: 1.6;
                  color: #333;
                }
                .highlight {
                  color: #F66036;
                  font-weight: bold;
                }
                .footer {
                  text-align: center;
                  font-size: 12px;
                  color: #888;
                  margin-top: 20px;
                }
                .social-icons img {
                  margin: 0 10px;
                  width: 20px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <a href="https://indexx.ai/">
                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx Logo" />
                  </a>
                </div>
                <div class="content">
                  <p>Hello <b>${name}</b>,</p>
                  <p>Thank you for your investment in Indexx Smart APY. Your funds have been successfully converted to IUSD+ and staked. Below are the details of your transaction:</p>
                  <ul>
                    <li>Order ID: <span class="highlight">${orderId}</span></li>
                    <li>Order Amount: <span class="highlight">$${orderAmount.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )} USD</span></li>
                    <li>Conversion Rate: <span class="highlight">1 USD = ${conversionRate.toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )} IUSD+</span></li>
                    <li>Total IUSD+: <span class="highlight">${totalIUSD.toFixed(
                    2
                )} IUSD+</span></li>
                    <li>Lock-In Period: <span class="highlight">${lockInPeriod}</span></li>
                  </ul>
                 <p>Staking Details:</p>
                ${formattedStakingDetails}
                  <p>Note: Early withdrawal may incur penalties as per the platform's terms and conditions.</p>
                  <p>If you have any questions, please feel free to contact us at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.</p>
                </div>
                <div class="footer">
                  <p>Stay connected:</p>
                  <div class="social-icons">
                    <a href="https://twitter.com/Indexx_ai" target="_blank">
                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                    </a>
                    <a href="https://www.instagram.com/indexx_ai/" target="_blank">
                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" />
                    </a>
                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank">
                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                    </a>
                  </div>
                  <p>
                    Indexx.ai<br>
                    550 Newport Center Drive<br>
                    Newport Beach, CA 92660<br>
                    United States<br>
                    <br>
                    © 2023 Indexx.ai. All Rights Reserved.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
            });

            console.log("Email sent successfully:", response);
            return { status: 200, message: "Email sent successfully" };
        } catch (error) {
            console.error("Failed to send email:", error);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendReceivedCoins(
        email: string,
        orderAmount: number,
        orderCurrency: string,
        coinPrice: number
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            // Determine the number of decimal places based on the coin price
            const formatOptions = {
                minimumFractionDigits: 2,
                maximumFractionDigits: coinPrice < 1 ? 8 : 2,
            };
            let send = await sendInMail.sendTransacEmail({
                subject: "Received Coins",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Page Title</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

          <style>
            body{
                font-family: Arial, Helvetica, sans-serif;
            }
          .main#main {
          width:600px;
          margin:auto;
          }

          @media only screen and (max-width: 600px) {
          .main#main {
          width:96%;
          }
          }
          </style>
            </head>
            <body>

                <table  align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                                    </td>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px 30px;" cellspacing="0"
                                        cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                  Greetings from Indexx Exchange,<br><br>
                                                  We are pleased to confirm that your wallet has been credited successfully. <br />
                                                  Here are the transaction details for your reference:<br><br>
                                                  <b>Amount Received:</b> ${new Intl.NumberFormat().format(
                    Math.floor(
                        orderAmount * 1000
                    ) / 1000
                )} ${orderCurrency}<br />
                                                  <b>Total Value:</b> $${new Intl.NumberFormat().format(
                    orderAmount * coinPrice
                )}<br />
                                                  <b>Current Coin Price:</b> $${new Intl.NumberFormat(
                    "en-US",
                    formatOptions
                ).format(
                    coinPrice
                )} per ${orderCurrency}<br />
                                            </tr>
                                            <br/>
                                            <br/>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">This is an automated message. Please do not reply.
                                                <br/>
                                            </td>
                                            </tr>
                                        </tbody></table>
                                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                                <tbody>
                                                <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/ > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td></tr>
                                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                            
                                    
                                                        <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                            <br/>
                                                            <br/>
                                                            <br/><br/>550 Newport Center Drive
                                                            <br/>
                                                            <br/>Newport Beach,
                                                            <br/>
                                                            <br/>CA 92660 United State
                                                            <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                                        </td>
                                                  
                                        </tr>
                                                </tbody>
                                            </table>
                                </div>
                            </td>
                        </tr>
                        
                        </tbody>
                    </table>

                </body>
            </html>`,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendReinvestmentConfirmation(
        email: string,
        name: string,
        previousInvestment: any,
        newInvestment: any
    ) {
        try {
            // Authenticate with Sendinblue
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // Format investment details for the email
            const formattedReinvestmentDetails = `
        <ul>
            <li>Previous Staked Amount: <b>${previousInvestment.stakedAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${previousInvestment.coin}</b></li>
            <li>Previous Reward Amount: <b>${previousInvestment.rewardAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${previousInvestment.rewardCoin}</b></li>
            <li>Previous End Date: <b>${new Date(
                previousInvestment.endDate
            ).toLocaleDateString()}</b></li>
            <li>New Staked Amount: <b>${newInvestment.stakedAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${newInvestment.coin}</b></li>
            <li>New Reward Amount: <b>${newInvestment.rewardAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${newInvestment.rewardCoin}</b></li>
            <li>New Final Amount: <b>${newInvestment.finalAmount.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} ${newInvestment.rewardCoin}</b></li>
            <li>New APY Percentage: <b>${(
                    newInvestment.percentage * 100
                ).toFixed(0)}%</b></li>
            <li>New Duration: <b>${newInvestment.duration}</b></li>
            <li>New Start Date: <b>${new Date(
                    newInvestment.startDate
                ).toLocaleDateString()}</b></li>
            <li>New End Date: <b>${new Date(
                    newInvestment.endDate
                ).toLocaleDateString()}</b></li>
        </ul>
        `;

            // Send transactional email
            const response = await sendInMail.sendTransacEmail({
                subject: `Indexx Exchange Reinvestment Confirmation`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            margin: 0;
                            padding: 0;
                            background-color: #f8f8f8;
                        }
                        .container {
                            max-width: 600px;
                            margin: 20px auto;
                            background: #ffffff;
                            border-radius: 8px;
                            padding: 20px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            padding-bottom: 20px;
                        }
                        .header img {
                            width: 150px;
                        }
                        .content {
                            font-size: 14px;
                            line-height: 1.6;
                            color: #333;
                        }
                        .highlight {
                            color: #F66036;
                            font-weight: bold;
                        }
                        .footer {
                            text-align: center;
                            font-size: 12px;
                            color: #888;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <a href="https://indexx.ai/">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx Logo" />
                            </a>
                        </div>
                        <div class="content">
                            <p>Hello <b>${name}</b>,</p>
                            <p>We are pleased to inform you that your reinvestment into the Indexx Smart APY has been successfully processed.</p>
                            <p>Here are the details of your reinvestment:</p>
                            ${formattedReinvestmentDetails}
                            <p>Thank you for continuing your journey with Indexx.ai. Your investment continues to grow with us.</p>
                            <p>If you have any questions, feel free to contact us at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.</p>
                        </div>
                        <div class="footer">
                            <p>Indexx.ai<br>
                            550 Newport Center Drive<br>
                            Newport Beach, CA 92660<br>
                            United States<br>
                            <br>
                            © 2023 Indexx.ai. All Rights Reserved.</p>
                        </div>
                    </div>
                </body>
            </html>
            `,
            });

            console.log("Reinvestment Email sent successfully:", response);
            return { status: 200, message: "Reinvestment Email sent successfully" };
        } catch (error) {
            console.error("Failed to send reinvestment email:", error);
            return { status: 500, message: "Reinvestment email not sent" };
        }
    }

    async sendServiceIssueNotification(email: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            let send = await sendInMail.sendTransacEmail({
                subject: "Service Update: Access Issues for Frontier ISP Users",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `support@indexx.ai`, name: "Indexx.ai Support" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Service Notification</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body {
                    font-family: Arial, Helvetica, sans-serif;
                  }
                  .main#main {
                    width: 600px;
                    margin: auto;
                  }
                  @media only screen and (max-width: 600px) {
                    .main#main {
                      width: 96%;
                    }
                  }
                </style>
            </head>
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding: 33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding: 0 30px; background: #fff;">
                                    <table width="100%" style="border: 1px solid #f0f0f0; border-radius: 5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                    <b>Dear Valued User,</b><br><br>
                                                    We hope this message finds you well.<br><br>
                                                    We want to inform you that we are currently experiencing temporary accessibility issues with <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"><b>Indexx.ai</b></a> for users in the United States who are using the <b>Frontier</b> internet service provider. This issue is specific to the network provider and is currently under investigation.<br><br>
                                                    Our team is actively working to resolve this matter as quickly as possible. We are in communication with the necessary parties to restore full access soon.<br><br>
                                                    <b>We sincerely apologize for any inconvenience this may cause and appreciate your patience during this time.</b><br><br>
                                                    In the meantime, if you require urgent assistance or have any questions, please feel free to contact our support team at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.<br><br>
                                                    We will provide further updates as soon as we have more information.<br><br>
                                                    <b>Thank you for your understanding and continued support.</b><br><br>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 12px; color: #666;">
                                                    This is an automated message. Please do not reply.<br/>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top: 50px; padding: 20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center">
                                                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">Visit our website</a>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="margin-bottom: 20px; display: block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding: 0 20px;"/>
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right: 20px;"/>
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4; text-align: center; font-size: 10px;" align="center">
                                                <td style="padding: 20px 0; color: #221F1F;">
                                                    indexx.ai<br/><br/>
                                                    550 Newport Center Drive<br/><br/>
                                                    Newport Beach, CA 92660, United States<br/><br/>
                                                    Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
          </html>`,
                params: { bodyMessage: "Service Update" },
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendServiceIssueNotification2(email: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            let send = await sendInMail.sendTransacEmail({
                subject: "Service Update: Scheduled Infrastructure Upgrade",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `support@indexx.ai`, name: "Indexx.ai Support" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
           <!DOCTYPE html>
            <html>

            <head>
                <title>Service Notification</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        width: 600px;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>

                        <tr>
                            <td>
                                <div style="padding: 0 30px; background: #fff;">
                                    <table width="100%" style="border: 1px solid #f0f0f0; border-radius: 5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                    <b>Dear Valued User,</b><br><br>
                                                    We want to inform you that we are currently performing an <b>infrastructure upgrade</b> on Indexx.ai to improve our platform's performance, scalability, and security.<br><br>
                                                    During this upgrade, some services may experience temporary unavailability. Please rest assured that <b>all user assets remain safe and secure</b>.<br><br>
                                                    Our team is working diligently to minimize downtime and complete the upgrade as quickly as possible.<br><br>
                                                    If you require any assistance or have any questions, please contact our support team at <a href="mailto:support@indexx.ai">support@indexx.ai</a>.<br><br>
                                                    <b>Thank you for your understanding and continued support.</b><br><br>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 12px; color: #666;">
                                                    This is an automated message. Please do not reply.<br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top: 50px; padding: 20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center">
                                                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">Visit our website</a>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>

            </html>
          `,
                params: { bodyMessage: "Service Update" },
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async contactUs(
        email: string,
        message: string,
        website: string,
        subject: string,
        name: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const logoURL =
                website === "BTCY-MOBLIE-APP"
                    ? "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png"
                    : "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";
            let websiteUrl = website === "BTCY-MOBLIE-APP" ? "bitcoinyay.com" : "indexx.ai";
            let emailSubject = "";
            if (website === "BTCY-MOBLIE-APP") {
                emailSubject = "Bitcoin Yay Support";
            } else {
                emailSubject = "Indexx.ai Indexx.ai Support";
            }
            const currentYear = new Date().getFullYear();
            let send = await sendInMail.sendTransacEmail({
                subject: subject ? subject : "Contact Us Response",
                sender: { name: website === "BTCY-MOBLIE-APP" ? "Bitcoin Yay Support" : "Indexx.ai Support", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: website === "BTCY-MOBLIE-APP" ? "Bitcoin Yay Support" : "Indexx.ai Support" },
                to: [{ email: email }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
                <!DOCTYPE html>
                <html>
                
                <head>
                    <title>Contact Us Response</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                        }
                
                        .main {
                            width: 600px;
                            margin: auto;
                        }
                
                        @media only screen and (max-width: 600px) {
                            .main {
                                width: 96%;
                            }
                        }
                    </style>
                </head>
                
                <body>
                    <table align="center" border="0" cellspacing="0" class="main" id="main">
                        <tbody>
                            <tr>
                                <td align="center" valign="middle" style="padding:33px 0">
                                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> 
                                            <img src="${logoURL}" alt="IndexIcon" 
                                                    style="width: ${website === 'BTCY-MOBLIE-APP' ? '200px' : '150px'}; max-width: 80%; height: auto;" />
                                            </a>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style="padding:0 30px;background:#fff">
                                        <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                            <tbody>
                                                <tr>
                                                    <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                        Hello ${name},<br><br> Thank you for reaching out to us! Here's a copy of your message:<br><br>
                                                        <blockquote>${message}</blockquote>
                                                        <br>We will review your message and get back to you shortly. If you have any more questions, please feel free to contact us at any time.
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size:12px;color:#666;">
                                                        This is an automated message. Please do not reply.
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                
                                        <table width="100%" style="margin-top:50px;padding:20px 0;">
                                            <tbody>
                                                <tr>
                                                    <td align="center" style="margin-bottom:20px;display:block">
                                                        <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                        <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"> </a>
                                                        <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                        <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                                    </td>
                                                </tr>
                                                <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                
                
                                                    <td style="padding:20px 0;color: #221F1F;">${websiteUrl}
                                                        <br/>
                                                        <br/>
                                                        <br/><br/>550 Newport Center Drive
                                                        <br/>
                                                        <br/>Newport Beach,
                                                        <br/>
                                                        <br/>CA 92660 United State
                                                        <br/><br/><br/>Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                                    </td>
                
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </body>
                
                </html>`,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    //First email (10TH OF EVERY MONTH)
    async sendSubscriptionFirstReminder(emailAddresses: string[]) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            // Add the specific email addresses to the BCC list
            const additionalEmails = [
                "omkar@indexx.ai",
                "bz@indexx.ai",
                "lili@indexx.ai",
                "kamal@indexx.ai",
                "accounts@indexx.ai",
            ];

            let send: any = await sendInMail.sendTransacEmail({
                subject:
                    "Secure Your Captain Bee Status: Monthly Subscription Required! 🚀",
                sender: { name: "Indexx Hive Team", email: "accounts@indexx.ai" },
                replyTo: { email: `accounts@indexx.ai`, name: "Indexx Hive Team" },
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Subscription Renewal Reminder</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid
                                      #f0f0f0;border-radius:5px;
                                      padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Captain Bee,
                                                <br> To maintain your esteemed Captain Bee status and safeguard your earnings within the Hive, it's crucial to renew your subscription promptly.
                                                <br>
                                                <br> Subscription Cost: $300 Monthly
                                                <br>
                                                <br> Action Required:
                                                <ol>
                                                    <li> To renew, kindly log in to your Captain Bee account by clicking <a href="https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login">here</a> for the Captain Bee Login. </li>
                                                    <li> Once logged in, proceed to the <a href="https://cex.indexx.ai/indexx-exchange/dashboard">Dashboard</a> on our subscription portal.</li>
                                                    <li> Choose your preferred payment method (Venmo, Wire Transfer, Zelle, or PayPal) and include proof of payment for swift identification.</li>
                                                </ol>
                                                Consequences of Non-Renewal:
                                                <li> Failure to renew may result in a decrease in your Captain Bee rank, impacting your earnings.
                                                </li>
                                                <li> Prolonged non-payment may lead to the removal of your Captain Bee status.
                                                </li>

                                                <br> Need assistance? Contact our Accounting Department at accounts@indexx.ai.
                                                <br> Thank you for being a valued part of the Indexx Hive community.
                                                <br> Best,
                                                <br> Indexx Hive Team
                                            </td>
                                        </tr>

                                        <tr>
                                            <td style="font-size:12px;color:#666;">This is an automated message. Please do not reply.
                                                <br/>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" /> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>

                </tbody>
            </table>

        </body>


        </html>`,
                params: { bodyMessage: "Subscription Reminder" },
            });
            console.log("send", send);

            return { status: 200, message: "Emails sent successfully" };
        } catch (err) {
            return { status: 500, message: "Emails not sent" };
        }
    }

    //Second email (15TH OF EVERY MONTH)
    async sendSubscriptionSecondReminder(emailAddresses: string[]) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            // Add the specific email addresses to the BCC list
            const additionalEmails = [
                "omkar@indexx.ai",
                "bz@indexx.ai",
                "lili@indexx.ai",
                "kamal@indexx.ai",
                "accounts@indexx.ai",
            ];

            let send: any = await sendInMail.sendTransacEmail({
                subject:
                    "Important: Second Reminder for Captain Bee Monthly Subscription Renewal 🚨",
                sender: { name: "Indexx Hive Team", email: "accounts@indexx.ai" },
                replyTo: { email: `accounts@indexx.ai`, name: "Indexx Hive Team" },
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Subscription Renewal Reminder</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid
                                      #f0f0f0;border-radius:5px;
                                      padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Captain Bee,
                                                <br> I trust this message finds you in good health.
                                                <br> We are writing to remind you of the upcoming renewal deadline for your Captain Bee monthly subscription. It is crucial to maintain your esteemed Captain Bee status and safeguard your earnings within the Indexx Hive.
                                                <br>
                                                <br> Subscription Cost: $300 Monthly
                                                <br>
                                                <br> Action Required:
                                                <ol>
                                                    <li> To renew, kindly log in to your Captain Bee account by clicking <a href="https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login">here</a> for the Captain Bee Login. </li>
                                                    <li> Once logged in, proceed to the <a href="https://cex.indexx.ai/indexx-exchange/dashboard">Dashboard</a> on our subscription portal.</li>
                                                    <li> Choose your preferred payment method (Venmo, Wire Transfer, Zelle, or PayPal) and include proof of payment for swift identification.</li>
                                                </ol>
                                                Consequences of Non-Renewal:
                                                <li> Failure to renew may result in a decrease in your Captain Bee rank, impacting your earnings.
                                                </li>
                                                <li> Prolonged non-payment may lead to the removal of your Captain Bee status.
                                                </li>

                                                <br> For any assistance or inquiries regarding the renewal process, please feel free to contact our dedicated Accounting Department at accounts@indexx.ai.
                                                <br> 
                                                <br> Your prompt attention to this matter is highly appreciated. Thank you for your continued dedication to the Indexx Hive community.
                                                <br> Best,
                                                <br> Indexx Hive Team
                                            </td>
                                        </tr>

                                        <tr>
                                            <td style="font-size:12px;color:#666;">This is an automated message. Please do not reply.
                                                <br/>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" /> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>

                </tbody>
            </table>

        </body>


        </html>`,
                params: { bodyMessage: "Subscription Reminder" },
            });
            console.log("send", send);

            return { status: 200, message: "Emails sent successfully" };
        } catch (err) {
            return { status: 500, message: "Emails not sent" };
        }
    }

    async sendAirdropAnnouncement(email: string, usertype: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const captainBeeUrl =
                "https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login";
            const webWalletUrl = "https://wallet.indexx.ai/login/sign-in";

            // Determine the correct URL based on usertype
            const loginUrl =
                usertype === "CaptainBee" ||
                    usertype === "HoneyBee" ||
                    usertype === "Indexx Exchange"
                    ? captainBeeUrl
                    : webWalletUrl;

            let send = await sendInMail.sendTransacEmail({
                subject: "Congratulations! Enjoy Your INEX Tokens 🎉",
                sender: { name: "Indexx Team", email: "accounts@indexx.ai" },
                replyTo: { email: "accounts@indexx.ai", name: "Indexx Team" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            
            <head>
                <title>Airdrop Announcement</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }
            
                    .main#main {
                        width: 600px;
                        margin: auto;
                    }
            
                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
                <script>
                    function getLoginUrl(userType) {
                        if (userType === 'CaptainBee' || userType === 'HoneyBee' || userType === "Indexx Exchange") {
                            return 'https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login';
                        } else {
                            return 'https://wallet.indexx.ai/login/sign-in'; // Replace with the actual URL for 'Web Wallet'
                        }
                    }
                </script>
            </head>
            
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                    Dear Valued ${usertype},<br><br> We are thrilled to announce that the airdrop for registered users has been successfully completed! As a part of our commitment to our community, we have airdropped INEX tokens to
                                                    your wallet.<br> Congratulations! 🚀<br><br> To fully enjoy your newly acquired INEX tokens, we invite you to check your wallet at midnight. This is when your tokens will be visible and ready for you to explore
                                                    the exciting possibilities within the Indexx ecosystem. You can go the login page from <a href="${loginUrl}">here</a>.<br><br> We appreciate your
                                                    continued support and participation in the Indexx community. If you have any questions or need assistance, feel free to reach out to our support team.<br><br> Thank you for being an essential part of the Indexx
                                                    journey. Enjoy your INEX tokens!<br><br> Best Regards,<br> Indexx Team<br> Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            
            </html>`,
                params: { bodyMessage: "Airdrop Announcement" },
            });

            console.log("send", send);
            return {
                status: 200,
                message: "Airdrop announcement emails sent successfully",
            };
        } catch (err) {
            return {
                status: 500,
                message: "Airdrop announcement emails not sent" + err,
            };
        }
    }

    async sendDacrazyAirdropAnnouncement(email: string, usertype: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const captainBeeUrl =
                "https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login";
            const webWalletUrl = "https://wallet.indexx.ai/login/sign-in";

            // Determine the correct URL based on usertype
            const loginUrl =
                usertype === "CaptainBee" ||
                    usertype === "HoneyBee" ||
                    usertype === "Indexx Exchange"
                    ? captainBeeUrl
                    : webWalletUrl;

            let send = await sendInMail.sendTransacEmail({
                subject: "Congratulations! Enjoy Your DaCrazy Tokens 🎉",
                sender: { name: "Indexx Team", email: "accounts@indexx.ai" },
                replyTo: { email: "accounts@indexx.ai", name: "Indexx Team" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            
            <head>
                <title>Airdrop Announcement</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }
            
                    .main#main {
                        width: 600px;
                        margin: auto;
                    }
            
                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
                <script>
                    function getLoginUrl(userType) {
                        if (userType === 'CaptainBee' || userType === 'HoneyBee' || userType === "Indexx Exchange") {
                            return 'https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login';
                        } else {
                            return 'https://wallet.indexx.ai/login/sign-in'; // Replace with the actual URL for 'Web Wallet'
                        }
                    }
                </script>
            </head>
            
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                    Dear Valued ${usertype},<br><br> We are thrilled to announce that the airdrop for registered users has been successfully completed! As a part of our commitment to our community, we have airdropped DaCrazy tokens to
                                                    your wallet.<br> Congratulations! 🚀<br><br> To fully enjoy your newly acquired DaCrazy tokens, we invite you to check your wallet at midnight. This is when your tokens will be visible and ready for you to explore
                                                    the exciting possibilities within the Indexx ecosystem. You can go the login page from <a href="${loginUrl}">here</a>.<br><br> We appreciate your
                                                    continued support and participation in the Indexx community. If you have any questions or need assistance, feel free to reach out to our support team.<br><br> Thank you for being an essential part of the Indexx
                                                    journey. Enjoy your DaCrazy tokens!<br><br> Best Regards,<br> Indexx Team<br> Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            
            </html>`,
                params: { bodyMessage: "Airdrop Announcement" },
            });

            console.log("send", send);
            return {
                status: 200,
                message: "Airdrop announcement emails sent successfully",
            };
        } catch (err) {
            return {
                status: 500,
                message: "Airdrop announcement emails not sent" + err,
            };
        }
    }

    async sendWIBSAirdropAnnouncement(email: string, usertype: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const captainBeeUrl =
                "https://cex.indexx.ai/indexx-exchange/buy-sell/login";
            const indexxExchangeUrl = "https://cex.indexx.ai/auth/login/";
            const webWalletUrl = "https://wallet.indexx.ai/login/sign-in";

            // Determine the correct URL based on usertype
            const loginUrl =
                usertype === "Indexx Exchange"
                    ? indexxExchangeUrl
                    : usertype === "CaptainBee" || usertype === "HoneyBee"
                        ? captainBeeUrl
                        : webWalletUrl;

            let send = await sendInMail.sendTransacEmail({
                subject: "Congratulations! Enjoy Your WIBS Tokens 🎉",
                sender: { name: "Indexx Team", email: "accounts@indexx.ai" },
                replyTo: { email: "accounts@indexx.ai", name: "Indexx Team" },
                to: [{ email: `${email}` }],
                bcc: [...DEFAULT_BCC_EMAILS, { email: "omkar@indexx.ai" }],
                htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                <title>WIBS Distribution Completed Today</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f7f7f7; }
                    .main#main { width: 600px; margin: auto; }
                    @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                    .card { border:1px solid #f0f0f0; border-radius:5px; background:#fff; padding: 0 30px 30px; }
                    .cta-btn { display:inline-block; padding:12px 20px; text-decoration:none; background:#0b72ff; color:#fff; border-radius:4px; font-weight:bold; }
                    .muted { color:#666; }
                </style>
                </head>
                <body>
                <table align="center" border="0" cellspacing="0" cellpadding="0" class="main" id="main" role="presentation" style="background:#f7f7f7;">
                    <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                        <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="IndexIcon" width="150"/>
                        </a>
                        </td>
                    </tr>

                    <tr>
                        <td>
                        <div style="padding:0 30px;">
                            <table width="100%" class="card" cellspacing="0" cellpadding="0" role="presentation">
                            <tbody>
                                <tr>
                                <td class="muted" style="font-size:17px; line-height:30px; padding:20px 0;">
                                    <strong>Dear Valued User,</strong><br><br>

                                    We’re delighted to inform you that the <strong>WIBS distribution to Indexx Wallet</strong>,
                                    originally scheduled for <strong>September 29, 2025</strong>, has been <strong>completed today, October 11, 2025</strong>. 🎉<br><br>

                                    Please sign in to your account to view your WIBS balance. If you don’t see it immediately, kindly allow some time for all accounts to reflect the update.<br><br>

                                    <a href="{{loginUrl}}" class="cta-btn" target="_blank" rel="noopener noreferrer">Go to Login</a><br><br>

                                    Thank you for your continued support of the Indexx community. If you have any questions, our support team is here to help.<br><br>

                                    Best Regards,<br>
                                    Bitcoin Yay Team<br>
                                    <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">bitcoinyay.com</a>
                                </td>
                                </tr>
                            </tbody>
                            </table>
                        </div>
                        </td>
                    </tr>

                    <tr><td style="height:40px;"></td></tr>
                    </tbody>
                </table>
                </body>
                </html>
        `,
                params: { bodyMessage: "Airdrop Announcement" },
            });

            console.log("send", send);
            return {
                status: 200,
                message: "Airdrop announcement emails sent successfully",
            };
        } catch (err) {
            return {
                status: 500,
                message: "Airdrop announcement emails not sent" + err,
            };
        }
    }

    async sendWIBSCorrectionEmail() { }

    async sendKycVerifiedEmail(email: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx Exchange KYC Verification Successful`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `support@indexx.ai`, name: "Indexx.ai Support" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
              <head>
                  <title>KYC Verification Successful</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
                    .main { width:600px; margin:auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); }
                    @media only screen and (max-width: 600px) {
                      .main { width: 96%; padding: 20px; }
                    }
                    .header { text-align: center; padding: 20px 0; }
                    .content { padding: 20px 30px; }
                    .footer { font-size: 12px; color: #666; text-align: center; padding: 20px 0; background: #E4E4E4; }
                    .highlight { font-weight: bold; color: #F66036; }
                    .button { background: #F66036; color: white; text-decoration: none; padding: 12px 25px; border-radius: 5px; display: inline-block; margin-top: 15px; }
                  </style>
              </head>
              <body>
    
                  <table align="center" border="0" cellspacing="0" class="main">
                      <tbody>
                          <tr>
                              <td class="header">
                                  <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx Logo" width="150"/>
                                  </a>
                              </td>
                          </tr>
                          <tr>
                              <td class="content">
                                  <p style="font-size: 18px; color: #333;">Dear User,</p>
                                  <p>We are pleased to inform you that your <b>KYC (Know Your Customer) verification</b> has been successfully completed on <b>Indexx Exchange</b>. You now have full access to withdraw both <b>fiat</b> and <b>crypto</b> from your account.</p>
    
                                  <h3 style="color: #F66036;">Need Assistance?</h3>
                                  <p>If you have any questions or require assistance, feel free to contact our support team at <a href="mailto:support@indexx.ai" style="color: #F66036;">support@indexx.ai</a>.</p>
    
                                  <p>Thank you for choosing <b>Indexx Exchange</b>. We appreciate your trust and look forward to serving you!</p>
                                  
                                  <p>Best Regards,</p>
                                  <p><b>Indexx.ai Compliance Team</b></p>
                              </td>
                          </tr>
                          <tr>
                              <td class="footer">
                                  <p>Indexx.ai | 550 Newport Center Drive, Newport Beach, CA 92660, United States</p>
                                  <p>Follow us on: 
                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">Twitter</a> | 
                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">Instagram</a> | 
                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">Facebook</a>
                                  </p>
                                  <p>Copyright © 2025 All Rights Reserved Indexx.ai</p>
                              </td>
                          </tr>
                      </tbody>
                  </table>
    
              </body>
            </html>`,
                params: { bodyMessage: "Your KYC verification is now complete!" },
            });

            console.log("KYC Email Sent", send);
            return {
                status: 200,
                message: "KYC verification email sent successfully",
            };
        } catch (err) {
            console.error("Error sending KYC email:", err);
            return { status: 500, message: "KYC verification email not sent" };
        }
    }

    async sendKycRejectedEmail(email: string, reason: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const sanitizedReason = reason || "Please provide additional documentation so we can continue processing your application.";

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `KYC Application Rejected - Indexx.ai`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `support@indexx.ai`, name: "Indexx.ai Support" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
              <head>
                  <title>KYC Application Rejected</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
                    .main { width:600px; margin:auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); }
                    @media only screen and (max-width: 600px) {
                      .main { width: 96%; padding: 20px; }
                    }
                    .header { text-align: center; padding: 20px 0; }
                    .content { padding: 20px 30px; }
                    .footer { font-size: 12px; color: #666; text-align: center; padding: 20px 0; background: #E4E4E4; }
                    .highlight { font-weight: bold; color: #F66036; }
                  </style>
              </head>
              <body>

                  <table align="center" border="0" cellspacing="0" class="main">
                      <tbody>
                          <tr>
                              <td class="header">
                                  <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx Logo" width="150"/>
                                  </a>
                              </td>
                          </tr>
                          <tr>
                              <td class="content">
                                  <p style="font-size: 18px; color: #333;">Dear User,</p>
                                  <p>We regret to inform you that your <b>KYC (Know Your Customer) application</b> was not approved at this time.</p>
                                  <p><strong>Reason:</strong> ${sanitizedReason}</p>
                                  <p>Please review the explanation above and resubmit your application with the required documentation or any clarifications.</p>
                                  <p>If you have questions, reach out to our support team at <a href="mailto:support@indexx.ai" style="color: #F66036;">support@indexx.ai</a>.</p>
                                  <p>Best Regards,<br/><b>Indexx.ai Compliance Team</b></p>
                              </td>
                          </tr>
                          <tr>
                              <td class="footer">
                                  <p>Indexx.ai | 550 Newport Center Drive, Newport Beach, CA 92660, United States</p>
                                  <p>Follow us on: 
                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">Twitter</a> | 
                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">Instagram</a> | 
                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">Facebook</a>
                                  </p>
                                  <p>Copyright © 2025 All Rights Reserved Indexx.ai</p>
                              </td>
                          </tr>
                      </tbody>
                  </table>

              </body>
            </html>`,
                params: { bodyMessage: "KYC verification has been rejected" },
            });

            console.log("KYC Rejection Email Sent", send);
            return {
                status: 200,
                message: "KYC rejection email sent successfully",
            };
        } catch (err) {
            console.error("Error sending KYC rejection email:", err);
            return { status: 500, message: "KYC rejection email not sent" };
        }
    }

    async sendLotteryWinEmail(ticket: Ticket, lottery: Lottery) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const prizeNotificationMessage =
                lottery.type === "crypto"
                    ? `Congratulations! You are the lucky winner of our ${lottery.name} lottery, and you have won ${lottery.price}. The winning amount has been automatically deposited into your wallet.`
                    : `Congratulations! You've won a ${lottery.prizePool} valued prize in our ${lottery.name} lottery. Please reply to this email with your shipping details to claim your prize.`;

            let emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Lottery Win Announcement</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
          <style>
              body {
                  font-family: Arial, Helvetica, sans-serif;
              }
              .main {
                  width: 600px;
                  margin: auto;
              }
              @media only screen and (max-width: 600px) {
                  .main {
                      width: 96%;
                  }
              }
          </style>
      </head>
      <body>
          <table align="center" border="0" cellspacing="0" class="main">
              <tbody>
                  <tr>
                      <td align="center" valign="middle" style="padding:33px 0">
                          <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                      </td>
                  </tr>
                  <tr>
                      <td>
                          <div style="padding:0 30px;background:#fff">
                              <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                  <tbody>
                                      <tr>
                                          <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                              Dear User,<br><br>
                                              ${prizeNotificationMessage}<br><br>
                                              Your winning ticket numbers are: ${ticket.ticketNumbers
                    .map((tn) => tn.ticketNumbers)
                    .join(", ")}.  <br><br>
                                              We are excited to see you enjoy your prize. For any further assistance or questions, please do not hesitate to reach out to our support team.<br><br>
                                              Thank you for participating in our lottery.<br><br>
                                              Best Regards,<br> 
                                              Indexx Team<br> 
                                              Indexx.ai
                                          </td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </td>
                  </tr>
              </tbody>
          </table>
      </body>
      </html>`;

            let send = await sendInMail.sendTransacEmail({
                subject: `You're a Winner in the ${lottery.name} Lottery! 🎉`,
                sender: { name: "Your Company Team", email: "support@yourcompany.com" },
                replyTo: {
                    email: "support@yourcompany.com",
                    name: "Your Company Support",
                },
                to: [{ email: `${ticket.email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: emailContent,
                params: { bodyMessage: "Lottery Win Announcement" },
            });

            console.log("send", send);
            return {
                status: 200,
                message: "Lottery win announcement email sent successfully",
            };
        } catch (err) {
            console.error("Error sending lottery win announcement email:", err);
            return {
                status: 500,
                message: "Lottery win announcement email not sent",
            };
        }
    }

    async sendCommissionPayoutEmail(email: string, payoutDetails: any) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Commission Payout Processed",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Page Title</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

          <style>
            body{
                font-family: Arial, Helvetica, sans-serif;
            }
          .main#main {
          width:600px;
          margin:auto;
          }

          @media only screen and (max-width: 600px) {
          .main#main {
          width:96%;
          }
          }
          </style>
            </head>
            <body>

                <table  align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                                    </td>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px 30px;" cellspacing="0"
                                        cellpadding="0">
                                        <tbody>
                                            <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                            Greetings from Indexx Hive Exchange,<br><br>
                                            Your recent payout has been processed successfully and the amount has been added to your exchange wallet. Please check your wallet to confirm. Here are the details:<br><br>
                                            <b>Payout Amount:</b> ${payoutDetails.amount} ${payoutDetails.method}<br />
                                            <b>Payout Date:</b> ${payoutDetails.date}<br />
                                            <b>Payout Method:</b> ${payoutDetails.method}<br />
                                            <b>Status:</b> ${payoutDetails.status}<br />
                                            <b>Notes:</b> ${payoutDetails.notes}<br /><br>
                                          </td>
                                            </tr>
                                            <br/>
                                            <br/>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">This is an automated message. Please do not reply.
                                                <br/>
                                            </td>
                                            </tr>
                                        </tbody></table>
                                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                                <tbody>
                                                <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/ > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td></tr>
                                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                            
                                    
                                                        <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                            <br/>
                                                            <br/>
                                                            <br/><br/>550 Newport Center Drive
                                                            <br/>
                                                            <br/>Newport Beach,
                                                            <br/>
                                                            <br/>CA 92660 United State
                                                            <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                                        </td>
                                                  
                                        </tr>
                                                </tbody>
                                            </table>
                                </div>
                            </td>
                        </tr>
                        
                        </tbody>
                    </table>

                </body>
            </html>`,
                params: { bodyMessage: "Your commission payout details" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for February 14th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} INEX <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                We're conducting this  airdrop to give away free tokens to our community. Your participation is crucial, and we appreciate your added interest. The tokens will be automatically added to your wallet on February 14th, so be sure to check on that date. <br /> <br />
                                                Stay tuned for more updates and details about the airdrop. We look forward to your continued engagement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendNewRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for February 29th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} INEX <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                We're also excited to announce the upcoming launch of Indexx Lotto, where you can use your free tokens to participate and stand a chance to win amazing prizes, including a Ferrari. Get ready to use your INEX tokens for a shot at these incredible rewards! <br /> <br />
                                                Stay tuned for further updates and details about the airdrop and the Indexx Lotto launch. We're thrilled about your continued involvement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendNewAirdropRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for May 05th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} WISB <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                Stay tuned for further updates and details about the airdrop. We're thrilled about your continued involvement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendNewAirdropRegistrationConfirmationMay27(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for May 27th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} WISB <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                Stay tuned for further updates and details about the airdrop. We're thrilled about your continued involvement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendNewAirdropRegistrationConfirmationJun16(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for June 16th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} WISB <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                Stay tuned for further updates and details about the airdrop. We're thrilled about your continued involvement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendNewAirdropRegistrationConfirmationForDaCrazy(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "DaCrazy Token Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for December 08th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} DaCrazy <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                Stay tuned for further updates and details about the airdrop. We're thrilled about your continued involvement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendNewAirdropRegistrationConfirmationForBTCY(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Bitcoin Yay Token Airdrop Registration Confirmation",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Bitcoin Yay!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled on 4th July. Thank you for expressing your interest and becoming a part of the Bitcoin Yay community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Stay tuned for further updates and details about the airdrop. We're thrilled about your continued involvement with Bitcoin Yay.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Bitcoin Yay Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendBtcyLoyaltyAirdropRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();



            let send = await sendInMail.sendTransacEmail({
                subject: "Bitcoin Yay BTCY Loyalty Airdrop Registration Confirmation",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Bitcoin Yay!<br><br> We're thrilled to confirm your successful registration for the BTCY Loyalty Airdrop. Thank you for expressing your interest and becoming a part of the Bitcoin Yay community.<br
                                                /><br /> Registered Wallet Address ${userIdentifier}<br /><br />
                                                Distribution is scheduled for February 9, 2026. Stay tuned for further updates and details about the airdrop. We're thrilled about your continued involvement with Bitcoin Yay.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Bitcoin Yay Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendBtcySocialPostAirdropRegistrationConfirmation(
        userEmail: string,
        name: string,
        postLink: string,
        walletAddress: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const safeName = String(name || "Participant");
            const safePostLink = String(postLink || "");
            const safeWalletAddress = String(walletAddress || "");

            const send = await sendInMail.sendTransacEmail({
                subject: "Bitcoin Yay BTCY Social Post Airdrop Registration Confirmation",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>BTCY Social Post Airdrop Confirmation</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) {
                    .main#main { width: 96%; }
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="IndexIcon" width="150"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 28px; padding: 20px 0; color: #666">
                                                Dear ${safeName},
                                                <br><br>
                                                Greetings from Bitcoin Yay.
                                                <br><br>
                                                Your registration for the BTCY Social Post Airdrop has been received successfully.
                                                <br><br>
                                                Registered Email: ${userEmail}
                                                <br>
                                                Submitted Post Link: <a href="${safePostLink}" target="_blank" rel="noopener noreferrer">${safePostLink}</a>
                                                <br>
                                                Wallet Address (USDT on Ethereum): ${safeWalletAddress}
                                                <br><br>
                                                We will review your submission and share updates through official channels.
                                                <br><br>
                                                Best Regards,<br />
                                                The Bitcoin Yay Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/></a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"></a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/></a>
                                                <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/></a>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>
        </html>`,
            });

            console.log("BTCY social post airdrop email sent", send);
            return {
                status: 200,
                message: "BTCY social post airdrop registration email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY social post airdrop email", err);
            return {
                status: 500,
                message: "Failed to send BTCY social post airdrop registration email",
            };
        }
    }

    async sendBtcyNewYearAirdropWinnersEmail(userEmail: string, firstName: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const displayName = String(firstName || "").trim() || "there";
            const iosLink = "https://apps.apple.com/ph/app/bitcoin-yay/id6744868017";
            const androidLink = "https://play.google.com/store/apps/details?id=com.yaysapp&hl=en&pli=1";
            const iosQr = "https://bitcoinyay.com/_next/static/media/apple-qr.d6c8ae74.webp";
            const androidQr = "https://bitcoinyay.com/_next/static/media/playstore-qr.c6a63e0a.webp";

            const send = await sendInMail.sendTransacEmail({
                subject: "Winners Decided - Check Your BTCY Airdrop Result in the App",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>BTCY Airdrop Winners</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) {
                    .main#main { width: 96%; }
                }
                .cta {
                    display: inline-block;
                    background: #0f6fff;
                    color: #fff;
                    text-decoration: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .qr {
                    width: 140px;
                    height: auto;
                    display: block;
                    margin: 10px auto 0;
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; padding: 20px 0; color: #444">
                                                Hi ${displayName},<br><br>
                                                Winners for the BTCY New Year Airdrop have been decided. Thank you for registering!<br><br>
                                                To see your result:
                                                <ol style="margin: 10px 0 0 20px; padding: 0;">
                                                    <li>Download the Bitcoin Yay app (if you have not already): <a href="${iosLink}" target="_blank" rel="noopener noreferrer">iOS</a> | <a href="${androidLink}" target="_blank" rel="noopener noreferrer">Android</a>.</li>
                                                    <li>Sign up or log in.</li>
                                                    <li>You will see a popup with your reward.</li>
                                                </ol>
                                                <br>
                                                Even if you did not win BTCY this time, we have prepared a special surprise for every registrant. Please log in to the app to claim it.<br><br>
                                                Download now to claim!
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
                                    <tbody>
                                        <tr>
                                            <td width="50%" style="padding: 10px; vertical-align: top;">
                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:12px; text-align:center;">
                                                    <div style="font-weight:bold; margin-bottom:8px;">iOS</div>
                                                    <a href="${iosLink}" target="_blank" rel="noopener noreferrer" class="cta">App Store</a>
                                                    <img src="${iosQr}" alt="Apple QR code" class="qr" />
                                                </div>
                                            </td>
                                            <td width="50%" style="padding: 10px; vertical-align: top;">
                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:12px; text-align:center;">
                                                    <div style="font-weight:bold; margin-bottom:8px;">Android</div>
                                                    <a href="${androidLink}" target="_blank" rel="noopener noreferrer" class="cta">Google Play</a>
                                                    <img src="${androidQr}" alt="Google Play QR code" class="qr" />
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table width="100%" style="margin-top: 18px;">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; color: #444;">
                                                Thanks,<br>
                                                On behalf of Bitcoin Yay
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>
        </html>`,
            });

            console.log("BTCY New Year airdrop winners email sent", send);
            return {
                status: 200,
                message: "BTCY New Year airdrop winners email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY New Year airdrop winners email", err);
            return {
                status: 500,
                message: "Failed to send BTCY New Year airdrop winners email",
            };
        }
    }

    async sendNuclearReactivation7dEmail(userEmail: string, firstName: string = "") {
        const normalizedEmail = String(userEmail ?? "").trim().toLowerCase();
        if (!this.isEmailValid(normalizedEmail)) {
            console.warn("Invalid email for sendNuclearReactivation7dEmail:", userEmail);
            return { status: 400, message: "Invalid email address" };
        }

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const displayName = String(firstName || "").trim() || "there";
            const subject = "We saved your progress — enjoy 7 days of FREE Nuclear Mining ⚡";
            const iosLink = "https://apps.apple.com/ph/app/bitcoin-yay/id6744868017";
            const androidLink = "https://play.google.com/store/apps/details?id=com.yaysapp&hl=en&pli=1";
            const iosQr = "https://bitcoinyay.com/_next/static/media/apple-qr.d6c8ae74.webp";
            const androidQr = "https://bitcoinyay.com/_next/static/media/playstore-qr.c6a63e0a.webp";

            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: normalizedEmail }],
                //bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${subject}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .cta {
                    display: inline-block;
                    background: #0f6fff;
                    color: #fff !important;
                    text-decoration: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .qr {
                    width: 140px;
                    height: auto;
                    display: block;
                    margin: 4px auto 0;
                }
                .muted { color: #666; }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; padding: 20px 0; color: #444">
                                                Hey ${displayName},<br><br>
                                                Hey — team BTCY here 👋<br>
                                                We noticed something and wanted to reach out personally.<br><br>
                                                You’ve already put in real effort mining BTCY — whether it was showing up consistently or building up your balance — and we didn’t want all that progress to sit idle.<br><br>
                                                Life gets busy. It happens.<br><br>
                                                So we unlocked something special for you to help you jump back in:<br>
                                                <strong>⚡ FREE Nuclear Mining for 7 Days ⚡</strong><br><br>
                                                No payment. No commitment. Just pure boosted mining.<br><br>
                                                All you need to do is open the Bitcoin-Yay app and start mining again. Your Nuclear boost is already waiting.<br><br>
                                                Let’s get you back to where you left off — and push even further this time 🚀<br><br>
                                                <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer" class="cta">Open Bitcoin-Yay &amp; Start Free Nuclear Mining</a>
                                                <br><br>
                                                <span class="muted">Download the app:</span>
                                                <a href="${iosLink}" target="_blank" rel="noopener noreferrer">iOS</a>
                                                |
                                                <a href="${androidLink}" target="_blank" rel="noopener noreferrer">Android</a>
                                                <br>
                                                <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 4px;">
                                                    <tbody>
                                                        <tr>
                                                            <td width="50%" style="padding: 6px; vertical-align: top;">
                                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:8px; text-align:center;">
                                                                    <div style="font-weight:bold; margin-bottom:8px;">iOS</div>
                                                                    <a href="${iosLink}" target="_blank" rel="noopener noreferrer" class="cta">App Store</a>
                                                                    <img src="${iosQr}" alt="Apple QR code" class="qr" />
                                                                </div>
                                                            </td>
                                                            <td width="50%" style="padding: 6px; vertical-align: top;">
                                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:8px; text-align:center;">
                                                                    <div style="font-weight:bold; margin-bottom:8px;">Android</div>
                                                                    <a href="${androidLink}" target="_blank" rel="noopener noreferrer" class="cta">Google Play</a>
                                                                    <img src="${androidQr}" alt="Google Play QR code" class="qr" />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                                — Team Bitcoin-Yay 💛<br>
                                                Your progress is still there. Your next mining cycle is ready to begin.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `,
            });

            console.log("BTCY nuclear reactivation email sent", send);
            return {
                status: 200,
                message: "BTCY nuclear reactivation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY nuclear reactivation email", err);
            return {
                status: 500,
                message: "Failed to send BTCY nuclear reactivation email",
            };
        }
    }

    async sendFreeNuclearMiningWaitingEmail(userEmail: string, firstName: string = "") {
        const normalizedEmail = String(userEmail ?? "").trim().toLowerCase();
        if (!this.isEmailValid(normalizedEmail)) {
            console.warn("Invalid email for sendFreeNuclearMiningWaitingEmail:", userEmail);
            return { status: 400, message: "Invalid email address" };
        }

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const displayName = String(firstName || "").trim() || "there";
            const subject = "Your FREE Nuclear Mining is waiting ⚡";
            const appLink = "https://bitcoinyay.com/";
            const iosLink = "https://apps.apple.com/ph/app/bitcoin-yay/id6744868017";
            const androidLink = "https://play.google.com/store/apps/details?id=com.yaysapp&hl=en&pli=1";
            const iosQr = "https://bitcoinyay.com/_next/static/media/apple-qr.d6c8ae74.webp";
            const androidQr = "https://bitcoinyay.com/_next/static/media/playstore-qr.c6a63e0a.webp";

            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: normalizedEmail }],
                //bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${subject}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .cta {
                    display: inline-block;
                    background: #0f6fff;
                    color: #fff !important;
                    text-decoration: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .qr {
                    width: 140px;
                    height: auto;
                    display: block;
                    margin: 4px auto 0;
                }
                .label { color: #666; }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; padding: 20px 0; color: #444">
                                                Hey ${displayName},<br><br>
                                                Just checking in — team BTCY here again 👋<br>
                                                Your FREE 7-day Nuclear Mining is already unlocked and waiting for you in the app.<br><br>
                                                You’ve done this before — you know how it works:<br>
                                                Open the app<br>
                                                Tap Mine<br>
                                                Let Nuclear mining do the heavy lifting ⚡<br><br>
                                                No setup. No payment. Just faster mining for the next 7 days.<br><br>
                                                Sometimes all it takes is one tap to get back into the rhythm.<br><br>
                                                <a href="${appLink}" target="_blank" rel="noopener noreferrer" class="cta">Open Bitcoin-Yay &amp; Activate Free Nuclear Mining</a>
                                                <br><br>
                                                <span class="label">Download the app:</span>
                                                <a href="${iosLink}" target="_blank" rel="noopener noreferrer">iOS</a>
                                                |
                                                <a href="${androidLink}" target="_blank" rel="noopener noreferrer">Android</a>
                                                <br>
                                                <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 4px;">
                                                    <tbody>
                                                        <tr>
                                                            <td width="50%" style="padding: 6px; vertical-align: top;">
                                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:8px; text-align:center;">
                                                                    <div style="font-weight:bold; margin-bottom:8px;">iOS</div>
                                                                    <a href="${iosLink}" target="_blank" rel="noopener noreferrer" class="cta">App Store</a>
                                                                    <img src="${iosQr}" alt="Apple QR code" class="qr" />
                                                                </div>
                                                            </td>
                                                            <td width="50%" style="padding: 6px; vertical-align: top;">
                                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:8px; text-align:center;">
                                                                    <div style="font-weight:bold; margin-bottom:8px;">Android</div>
                                                                    <a href="${androidLink}" target="_blank" rel="noopener noreferrer" class="cta">Google Play</a>
                                                                    <img src="${androidQr}" alt="Google Play QR code" class="qr" />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                                <br><br>
                                                — Team Bitcoin-Yay 💛<br>
                                                Your miner is powered up. All that’s missing is you.
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx Limited, CUB Financial Centre
                                                <br />GF6, Lyford Cay, Nassau, Bahamas.
                                                <br /><br />550 Newport Center Drive
                                                <br />Newport Beach, CA 92660 United States
                                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `,
            });

            console.log("BTCY free nuclear mining waiting email sent", send);
            return {
                status: 200,
                message: "BTCY free nuclear mining waiting email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY free nuclear mining waiting email", err);
            return {
                status: 500,
                message: "Failed to send BTCY free nuclear mining waiting email",
            };
        }
    }

    async sendBtcyLoyaltyAirdropNonWinnerEmail(userEmail: string, firstName: string = "") {
        const normalizedEmail = String(userEmail ?? "").trim().toLowerCase();
        if (!this.isEmailValid(normalizedEmail)) {
            console.warn("Invalid email for sendBtcyLoyaltyAirdropNonWinnerEmail:", userEmail);
            return { status: 400, message: "Invalid email address" };
        }

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const displayName = String(firstName || "").trim();
            const subject = "BTCY Loyalty Reward Activated";
            const iosLink = "https://apps.apple.com/ph/app/bitcoin-yay/id6744868017";
            const androidLink = "https://play.google.com/store/apps/details?id=com.yaysapp&hl=en&pli=1";
            const iosQr = "https://bitcoinyay.com/_next/static/media/apple-qr.d6c8ae74.webp";
            const androidQr = "https://bitcoinyay.com/_next/static/media/playstore-qr.c6a63e0a.webp";

            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: normalizedEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${subject}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .card { background:#f9fbfc; max-width:650px; width:100%; margin:0 auto; border-radius:12px; padding:32px; line-height:1.6; box-shadow:0 6px 24px rgba(0,0,0,0.06); }
                ul { margin:0 0 16px 20px; padding:0; }
                li { margin-bottom:12px; }
                .btn-a { display:inline-block; width:260px; background:#F87E1E; color:#FFFFFF; text-decoration:none; padding:12px 0; border-radius:30px; font-weight:bold; font-size:15px; font-family:Arial, Helvetica, sans-serif; text-align:center; }
                .btn-a-green { display:inline-block; width:260px; background:#11BE6A; color:#FFFFFF; text-decoration:none; padding:12px 0; border-radius:30px; font-weight:bold; font-size:15px; font-family:Arial, Helvetica, sans-serif; text-align:center; }
                @media only screen and (max-width:480px) {
                    .card { padding:20px !important; border-radius:10px !important; }
                    h2 { font-size:20px !important; line-height:1.3 !important; }
                    .btn-wrap { width:100% !important; }
                    .btn-a, .btn-a-green { display:block !important; width:100% !important; padding:14px 16px !important; font-size:16px !important; }
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; padding: 20px 0; color: #444">
                                                <div class="card">
                                                    <div style="text-align:center; padding-bottom:20px;">
                                                        <h2 style="margin:10px 0 0 0; font-size:22px; line-height:1.3; color:#000000; font-weight:bold;">
                                                            BTCY Loyalty Reward Activated
                                                        </h2>
                                                    </div>

                                                    <p style="font-size:15px; font-weight:bold; margin:0 0 16px 0;">
                                                        ${displayName ? `Hello ${displayName},` : "Hello,"}
                                                    </p>

                                                    <p style="font-size:15px; margin:0 0 16px 0;">
                                                        Thank you for participating in the <strong>BTCY Loyalty Airdrop</strong>.
                                                    </p>

                                                    <p style="font-size:15px; margin:0 0 16px 0;">
                                                        While you were not selected among the final airdrop winners this time, we’re happy to let you know that
                                                        <strong>7 Days of Turbo Power</strong> has already been successfully credited to your account as part of our loyalty rewards.
                                                    </p>

                                                    <h3 style="font-size:16px; font-weight:bold; margin:24px 0 12px 0; color:#000000;">
                                                        What this means for you
                                                    </h3>

                                                    <ul style="font-size:15px; color:#222222;">
                                                        <li>⚡ Faster mining speed</li>
                                                        <li>⏱️ Longer mining sessions</li>
                                                        <li>🚀 Better earning potential for the next 7 days</li>
                                                    </ul>

                                                    <p style="font-size:15px; margin:0 0 16px 0;">
                                                        You can start using your Turbo Power immediately by opening the <strong>Bitcoin-YAY app</strong> and continuing your mining activity.
                                                    </p>

                                                    <p style="font-size:15px; margin:0 0 16px 0;">
                                                        We truly appreciate your support and participation. More campaigns, rewards, and opportunities are coming soon — so stay active and stay connected.
                                                    </p>

                                                    <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
                                                        <tbody>
                                                            <tr>
                                                                <td width="50%" style="padding: 10px; vertical-align: top;">
                                                                    <div style="border:1px solid #f0f0f0; border-radius:6px; padding:12px; text-align:center;">
                                                                        <div style="font-weight:bold; margin-bottom:8px;">iOS</div>
                                                                        <a href="${iosLink}" target="_blank" rel="noopener noreferrer" class="btn-a">App Store</a>
                                                                        <img src="${iosQr}" alt="Apple QR code" class="qr" style="width:120px; height:auto; display:block; margin:10px auto 0;" />
                                                                    </div>
                                                                </td>
                                                                <td width="50%" style="padding: 10px; vertical-align: top;">
                                                                    <div style="border:1px solid #f0f0f0; border-radius:6px; padding:12px; text-align:center;">
                                                                        <div style="font-weight:bold; margin-bottom:8px;">Android</div>
                                                                        <a href="${androidLink}" target="_blank" rel="noopener noreferrer" class="btn-a">Google Play</a>
                                                                        <img src="${androidQr}" alt="Google Play QR code" class="qr" style="width:120px; height:auto; display:block; margin:10px auto 0;" />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table width="100%" style="margin-top: 18px;">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; color: #444;">
                                                Thanks,<br>
                                                On behalf of Bitcoin Yay
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>
        </html>`,
            });

            console.log("BTCY Loyalty non-winner email sent", send);
            return {
                status: 200,
                message: "BTCY Loyalty non-winner email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY Loyalty non-winner email", err);
            return {
                status: 500,
                message: "Failed to send BTCY Loyalty non-winner email",
            };
        }
    }

    async sendBtcyReferralChallengeEmail({
        userEmail,
        firstName = "",
        referralCode,
        referralLink,
        ccEmails = [],
        bccEmails = [],
    }: {
        userEmail: string;
        firstName?: string;
        referralCode: string;
        referralLink: string;
        ccEmails?: string[];
        bccEmails?: string[];
    }) {
        const normalizedEmail = String(userEmail ?? "").trim().toLowerCase();
        const normalizedReferralCode = String(referralCode ?? "").trim();
        const normalizedReferralLink = String(referralLink ?? "").trim();

        if (!this.isEmailValid(normalizedEmail)) {
            console.warn("Invalid email for sendBtcyReferralChallengeEmail:", userEmail);
            return { status: 400, message: "Invalid email address" };
        }

        if (!normalizedReferralCode || !normalizedReferralLink) {
            console.warn("Missing referral data for sendBtcyReferralChallengeEmail:", {
                userEmail,
                referralCode,
                referralLink,
            });
            return { status: 400, message: "Missing referral code or referral link" };
        }

        try {
            const apiKey =
                process.env.SENDINBLUE_API_KEY ||
                process.env.BREVO_API_KEY ||
                LEGACY_BREVO_API_KEY;
            if (!apiKey) {
                throw new Error("SENDINBLUE_API_KEY is not configured");
            }

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey = apiKey;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const displayName = String(firstName || "").trim() || "Miner";
            const currentYear = new Date().getFullYear();
            const subject = "A Special Challenge Just for You — Earn 7 Days Nuclear Power";

            const normalizedCcEmails = Array.from(
                new Set(
                    ccEmails
                        .map((email) => String(email ?? "").trim().toLowerCase())
                        .filter((email) => email && email !== normalizedEmail && this.isEmailValid(email))
                )
            );

            const bccList = [...DEFAULT_BCC_EMAILS];
            for (const email of bccEmails) {
                const normalized = String(email ?? "").trim().toLowerCase();
                if (!normalized || normalized === normalizedEmail || !this.isEmailValid(normalized)) {
                    continue;
                }
                if (!bccList.find((entry) => entry.email === normalized)) {
                    bccList.push({ email: normalized });
                }
            }

            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: normalizedEmail }],
                cc: normalizedCcEmails.length ? normalizedCcEmails.map((email) => ({ email })) : undefined,
                bcc: bccList.length ? bccList : undefined,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${subject}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .card {
                    background:#f9fbfc;
                    max-width:650px;
                    width:100%;
                    margin:0 auto;
                    border-radius:12px;
                    padding:32px;
                    line-height:1.6;
                    box-shadow:0 6px 24px rgba(0,0,0,0.06);
                }
                .section-box {
                    background:#ffffff;
                    border:1px solid #ececec;
                    border-radius:12px;
                    padding:18px 20px;
                    margin:18px 0;
                }
                .label {
                    display:block;
                    font-size:13px;
                    letter-spacing:0.04em;
                    text-transform:uppercase;
                    color:#888;
                    margin-bottom:8px;
                }
                .value {
                    font-size:18px;
                    font-weight:bold;
                    color:#221f1f;
                }
                .btn-a {
                    display:inline-block;
                    background:#F87E1E;
                    color:#FFFFFF !important;
                    text-decoration:none;
                    padding:12px 20px;
                    border-radius:30px;
                    font-weight:bold;
                    font-size:15px;
                    font-family:Arial, Helvetica, sans-serif;
                    text-align:center;
                }
                .info-link {
                    word-break: break-all;
                    color:#0f6fff;
                }
                @media only screen and (max-width:480px) {
                    .card { padding:20px !important; border-radius:10px !important; }
                    h2 { font-size:20px !important; line-height:1.3 !important; }
                    .btn-a { display:block !important; width:100% !important; padding:14px 16px !important; font-size:16px !important; }
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <div class="card">
                                    <h2 style="margin:0 0 16px; color:#221f1f;">A Special Challenge Just for You</h2>
                                    <p style="margin:0 0 16px; color:#444;">
                                        Hello ${displayName},
                                    </p>
                                    <p style="margin:0 0 16px; color:#444;">
                                        Thank you for being a consistent BTCY miner. Your activity and dedication have not gone unnoticed.
                                        We’ve selected you for a special, limited-time challenge with an exclusive reward.
                                    </p>

                                    <div class="section-box">
                                        <span class="label">Your Challenge</span>
                                        <div class="value">Refer 3 new users between March 23, 2026 and March 30, 2026</div>
                                    </div>

                                    <div class="section-box">
                                        <span class="label">Your Reward</span>
                                        <div class="value">7 Days of Nuclear Power</div>
                                    </div>

                                    <div class="section-box">
                                        <span class="label">How To Participate</span>
                                        <p style="margin:0 0 14px; color:#444;">
                                            Use your personal referral link below and invite new users to sign up and start mining.
                                            Only users who sign up using your referral will count toward your progress.
                                        </p>
                                        <p style="margin:0 0 16px;">
                                            <a href="${normalizedReferralLink}" target="_blank" rel="noopener noreferrer" class="btn-a">
                                                Share My Referral Link
                                            </a>
                                        </p>
                                        <p style="margin:0 0 10px; color:#444;">
                                            <strong>Your Referral Link:</strong><br>
                                            <a href="${normalizedReferralLink}" target="_blank" rel="noopener noreferrer" class="info-link">${normalizedReferralLink}</a>
                                        </p>
                                        <p style="margin:0; color:#444;">
                                            <strong>Your Referral Code:</strong> ${normalizedReferralCode}
                                        </p>
                                    </div>

                                    <p style="margin:0 0 16px; color:#444;">
                                        This challenge is exclusively offered to you based on your activity. Take advantage of it and maximize your mining potential.
                                    </p>
                                    <p style="margin:0 0 16px; color:#444;">
                                        <strong>Reward Distribution:</strong> March 31, 2026
                                    </p>
                                    <p style="margin:0; color:#444;">
                                        Thank you for being a valuable part of the Bitcoin Yay community.<br>
                                        Good luck, and keep mining.<br><br>
                                        — Bitcoin Yay Team
                                    </p>
                                </div>

                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background:#E4E4E4;text-align:center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color:#221F1F;">
                                                indexx Limited, CUB Financial Centre
                                                <br />GF6, Lyford Cay, Nassau, Bahamas.
                                                <br /><br />550 Newport Center Drive
                                                <br />Newport Beach, CA 92660 United States
                                                <br /><br />Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `,
            });

            console.log("BTCY referral challenge email sent", send);
            return {
                status: 200,
                message: "BTCY referral challenge email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY referral challenge email", err);
            return {
                status: 500,
                message: "Failed to send BTCY referral challenge email",
            };
        }
    }

    async sendBtcyReferralChallengeBroadcastEmail({
        toEmail = "accounts@indexx.ai",
        ccEmails = [],
        recipientEmails = [],
        bccEmails = [],
    }: {
        toEmail?: string;
        ccEmails?: string[];
        recipientEmails?: string[];
        bccEmails?: string[];
    }) {
        const normalizedToEmail = String(toEmail ?? "").trim().toLowerCase();
        if (!this.isEmailValid(normalizedToEmail)) {
            console.warn("Invalid toEmail for sendBtcyReferralChallengeBroadcastEmail:", toEmail);
            return { status: 400, message: "Invalid to email address" };
        }

        try {
            const apiKey =
                process.env.SENDINBLUE_API_KEY ||
                process.env.BREVO_API_KEY ||
                LEGACY_BREVO_API_KEY;
            if (!apiKey) {
                throw new Error("SENDINBLUE_API_KEY is not configured");
            }

            const normalizedCcEmails = Array.from(
                new Set(
                    ccEmails
                        .map((email) => String(email ?? "").trim().toLowerCase())
                        .filter((email) => email && email !== normalizedToEmail && this.isEmailValid(email))
                )
            );

            const rawRecipientEmails = recipientEmails.length ? recipientEmails : bccEmails;
            const blockedEmails = new Set([normalizedToEmail, ...normalizedCcEmails]);
            const normalizedBccEmails = Array.from(
                new Set(
                    rawRecipientEmails
                        .map((email) => String(email ?? "").trim().toLowerCase())
                        .filter((email) => email && !blockedEmails.has(email) && this.isEmailValid(email))
                )
            );

            if (!normalizedBccEmails.length) {
                return { status: 400, message: "No valid recipients provided" };
            }

            const totalRecipients = 1 + normalizedCcEmails.length + normalizedBccEmails.length;
            if (totalRecipients > 99) {
                return {
                    status: 400,
                    message: `Too many recipients for one transactional email: ${totalRecipients}. Brevo allows max 99 total recipients across to, cc, and bcc.`,
                };
            }

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey = apiKey;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            const subject = "A Special Challenge Just for You — Earn 7 Days Nuclear Power";
            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${subject}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .card {
                    background:#f9fbfc;
                    max-width:650px;
                    width:100%;
                    margin:0 auto;
                    border-radius:12px;
                    padding:32px;
                    line-height:1.6;
                    box-shadow:0 6px 24px rgba(0,0,0,0.06);
                }
                .section-box {
                    background:#ffffff;
                    border:1px solid #ececec;
                    border-radius:12px;
                    padding:18px 20px;
                    margin:18px 0;
                }
                .label {
                    display:block;
                    font-size:13px;
                    letter-spacing:0.04em;
                    text-transform:uppercase;
                    color:#888;
                    margin-bottom:8px;
                }
                .value {
                    font-size:18px;
                    font-weight:bold;
                    color:#221f1f;
                }
                @media only screen and (max-width:480px) {
                    .card { padding:20px !important; border-radius:10px !important; }
                    h2 { font-size:20px !important; line-height:1.3 !important; }
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <div class="card">
                                    <h2 style="margin:0 0 16px; color:#221f1f;">A Special Challenge Just for You</h2>
                                    <p style="margin:0 0 16px; color:#444;">
                                        Hello,
                                    </p>
                                    <p style="margin:0 0 16px; color:#444;">
                                        Thank you for being a consistent BTCY miner. Your activity and dedication have not gone unnoticed.
                                        We’ve selected you for a special, limited-time challenge with an exclusive reward.
                                    </p>

                                    <div class="section-box">
                                        <span class="label">Your Challenge</span>
                                        <div class="value">Refer 3 new users between March 23, 2026 and March 30, 2026</div>
                                    </div>

                                    <div class="section-box">
                                        <span class="label">Your Reward</span>
                                        <div class="value">7 Days of Nuclear Power</div>
                                    </div>

                                    <div class="section-box">
                                        <span class="label">How To Participate</span>
                                        <p style="margin:0 0 14px; color:#444;">
                                            Invite 3 new users to sign up and start mining during the challenge window.
                                            Only successful new user referrals will count toward your progress.
                                        </p>
                                        <p style="margin:0;">
                                            Open Bitcoin Yay and use your referral tools to share your invite with new miners.
                                        </p>
                                    </div>

                                    <p style="margin:0 0 16px; color:#444;">
                                        This challenge is exclusively offered to you based on your activity. Take advantage of it and maximize your mining potential.
                                    </p>
                                    <p style="margin:0 0 16px; color:#444;">
                                        <strong>Reward Distribution:</strong> March 31, 2026
                                    </p>
                                    <p style="margin:0; color:#444;">
                                        Thank you for being a valuable part of the Bitcoin Yay community.<br>
                                        Good luck, and keep mining.<br><br>
                                        &mdash; Bitcoin Yay Team &#128640;
                                    </p>
                                </div>

                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background:#E4E4E4;text-align:center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color:#221F1F;">
                                                indexx Limited, CUB Financial Centre
                                                <br />GF6, Lyford Cay, Nassau, Bahamas.
                                                <br /><br />550 Newport Center Drive
                                                <br />Newport Beach, CA 92660 United States
                                                <br /><br />Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `;

            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: normalizedToEmail }],
                cc: normalizedCcEmails.length ? normalizedCcEmails.map((email) => ({ email })) : undefined,
                bcc: normalizedBccEmails.length ? normalizedBccEmails.map((email) => ({ email })) : undefined,
                htmlContent,
            });

            console.log("BTCY referral challenge broadcast email sent", send);
            return {
                status: 200,
                message: "BTCY referral challenge broadcast email sent successfully",
                data: send,
            };
        } catch (err) {
            console.error("Error sending BTCY referral challenge broadcast email", err);
            return {
                status: 500,
                message: "Failed to send BTCY referral challenge broadcast email",
            };
        }
    }

    async sendFreeNuclearMiningFinalReminderEmail(userEmail: string, firstName: string = "") {
        const normalizedEmail = String(userEmail ?? "").trim().toLowerCase();
        if (!this.isEmailValid(normalizedEmail)) {
            console.warn("Invalid email for sendFreeNuclearMiningFinalReminderEmail:", userEmail);
            return { status: 400, message: "Invalid email address" };
        }

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const displayName = String(firstName || "").trim() || "there";
            const subject = "Last reminder — don’t miss your 7 days of Nuclear Mining ⚡";
            const appLink = "https://bitcoinyay.com/";
            const iosLink = "https://apps.apple.com/ph/app/bitcoin-yay/id6744868017";
            const androidLink = "https://play.google.com/store/apps/details?id=com.yaysapp&hl=en&pli=1";
            const iosQr = "https://bitcoinyay.com/_next/static/media/apple-qr.d6c8ae74.webp";
            const androidQr = "https://bitcoinyay.com/_next/static/media/playstore-qr.c6a63e0a.webp";

            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Bitcoin Yay" },
                to: [{ email: normalizedEmail }],
                //bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${subject}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .cta {
                    display: inline-block;
                    background: #0f6fff;
                    color: #fff !important;
                    text-decoration: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .qr {
                    width: 140px;
                    height: auto;
                    display: block;
                    margin: 4px auto 0;
                }
                .label { color: #666; }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://bitcoinyay.com/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="170"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 16px; line-height: 26px; padding: 20px 0; color: #444">
                                                Hey ${displayName},<br><br>
                                                One last note from us — promise 😊<br><br>
                                                Your <strong>FREE 7-day Nuclear Mining</strong> is still available, but it won’t stay unlocked forever.<br>
                                                Your BTCY is currently idle — and it could be growing faster than ever with Nuclear mining.<br><br>
                                                If you’ve been waiting for the right moment, this is it.<br>
                                                Just open the app, start mining, and let the boost take over.<br><br>
                                                <a href="${appLink}" target="_blank" rel="noopener noreferrer" class="cta">Start My Free Nuclear Mining Now</a>
                                                <br><br>
                                                <span class="label">Download the app:</span>
                                                <a href="${iosLink}" target="_blank" rel="noopener noreferrer">iOS</a>
                                                |
                                                <a href="${androidLink}" target="_blank" rel="noopener noreferrer">Android</a>
                                                <br>
                                                <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 4px;">
                                                    <tbody>
                                                        <tr>
                                                            <td width="50%" style="padding: 6px; vertical-align: top;">
                                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:8px; text-align:center;">
                                                                    <div style="font-weight:bold; margin-bottom:8px;">iOS</div>
                                                                    <a href="${iosLink}" target="_blank" rel="noopener noreferrer" class="cta">App Store</a>
                                                                    <img src="${iosQr}" alt="Apple QR code" class="qr" />
                                                                </div>
                                                            </td>
                                                            <td width="50%" style="padding: 6px; vertical-align: top;">
                                                                <div style="border:1px solid #f0f0f0; border-radius:6px; padding:8px; text-align:center;">
                                                                    <div style="font-weight:bold; margin-bottom:8px;">Android</div>
                                                                    <a href="${androidLink}" target="_blank" rel="noopener noreferrer" class="cta">Google Play</a>
                                                                    <img src="${androidQr}" alt="Google Play QR code" class="qr" />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                                <br>
                                                Thanks for being part of the Bitcoin-Yay community.<br>
                                                — Team Bitcoin-Yay 💛<br>
                                                Final reminder — your miner is ready whenever you are.
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center">
                                                <a href="https://x.com/bitcoin_YAY" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.youtube.com/@BitcoinYay" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx Limited, CUB Financial Centre
                                                <br />GF6, Lyford Cay, Nassau, Bahamas.
                                                <br /><br />550 Newport Center Drive
                                                <br />Newport Beach, CA 92660 United State
                                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `,
            });

            console.log("BTCY nuclear final reminder email sent", send);
            return {
                status: 200,
                message: "BTCY nuclear final reminder email sent successfully",
            };
        } catch (err) {
            console.error("Error sending BTCY nuclear final reminder email", err);
            return {
                status: 500,
                message: "Failed to send BTCY nuclear final reminder email",
            };
        }
    }

    async sendTurboPowerAirdropConfirmationEmail(
        userEmail: string,
        userIdentifier: string, // email or wallet address
        airdropAmount: number,  // 5 (days) for Turbo Power
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType = userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "🎉 Turbo Mining Power Granted — Your 5 Days Are Ready!",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bitcoin Yay Turbo Power Airdrop Confirmation</title>
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; }
                    .main { width: 600px; margin: auto; }
                    @media only screen and (max-width: 600px) { .main { width: 96%; } }
                </style>
            </head>
            <body>
                <table align="center" class="main">
                    <tr>
                        <td align="center" style="padding:30px 0">
                            <a href="https://bitcoinyay.com/" target="_blank">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="150"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px; background:#fff;">
                            <table width="100%" style="border:1px solid #f0f0f0; border-radius:5px; padding:30px;">
                                <tr>
                                    <td style="font-size:16px; color:#333;">
                                        Dear Participant,<br/><br/>
                                        Thank you for registering for our Turbo Mining Power airdrop! 🎉<br/><br/>
                                        As promised, we are pleased to deliver <strong>5 DAYS of Turbo Mining Power</strong> to your account.<br/><br/>
                                        <strong>How it works:</strong><br/>
                                        - If you are currently mining, the Turbo boost will automatically activate <strong>after your current cycle ends</strong>.<br/>
                                        - If you are not mining now, you can start a new mining session anytime.<br/><br/>
                                        Thank you for being part of the Bitcoin Yay community. We’re excited to help you supercharge your mining rewards! ⚡<br/><br/>
                                        Best regards,<br/>
                                        The Bitcoin Yay Team
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" style="margin-top:40px; text-align:center;">
                                <tr>
                                    <td>
                                        <a href="https://x.com/bitcoin_YAY" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/></a>
                                        <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" style="margin:0 10px;"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram"/></a>
                                        <a href="https://www.youtube.com/@BitcoinYay" target="_blank" style="margin:0 10px;"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube"/></a>
                                        <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook"/></a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `,
            });

            console.log("Turbo Power Airdrop Confirmation Email sent", send);
            return { status: 200, message: "Turbo power airdrop confirmation email sent successfully" };
        } catch (err) {
            console.error("Error sending Turbo Power email", err);
            return { status: 500, message: "Failed to send Turbo power airdrop confirmation email" };
        }
    }

    async sendTurboPowerRepostCampaignConfirmationEmail(
        userEmail: string,
        userIdentifier: string, // email or wallet address
        airdropAmount: number,  // 5 (days) for Turbo Power
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType = userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Turbo Power Reward Credited - 5 Days from Repost Campaign",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bitcoin Yay Turbo Power Campaign Reward</title>
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; }
                    .main { width: 600px; margin: auto; }
                    @media only screen and (max-width: 600px) { .main { width: 96%; } }
                </style>
            </head>
            <body>
                <table align="center" class="main">
                    <tr>
                        <td align="center" style="padding:30px 0">
                            <a href="https://bitcoinyay.com/" target="_blank">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="150"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px; background:#fff;">
                            <table width="100%" style="border:1px solid #f0f0f0; border-radius:5px; padding:30px;">
                                <tr>
                                    <td style="font-size:16px; color:#333;">
                                        Dear Participant,<br/><br/>
                                        Thank you for taking part in our repost campaign.<br/><br/>
                                        We recently started a repost campaign. We announced that any user who reposts our post will receive 5 days of Turbo Power.<br/><br/>
                                        As promised, <strong>${airdropAmount} DAYS of Turbo Mining Power</strong> has been credited to your account.<br/><br/>
                                        <strong>Registered ${identifierType}:</strong> ${userIdentifier}<br/><br/>
                                        <strong>How it works:</strong><br/>
                                        - If you are currently mining, the Turbo boost will activate after your current cycle ends.<br/>
                                        - If you are not mining now, you can start a new mining session anytime.<br/><br/>
                                        <strong>Note:</strong> If your mining is already active, your Turbo Power will start in the next mining cycle.<br/><br/>
                                        Thank you for supporting Bitcoin Yay.<br/><br/>
                                        Best regards,<br/>
                                        The Bitcoin Yay Team
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" style="margin-top:40px; text-align:center;">
                                <tr>
                                    <td>
                                        <a href="https://x.com/bitcoin_YAY" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/></a>
                                        <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" style="margin:0 10px;"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram"/></a>
                                        <a href="https://www.youtube.com/@BitcoinYay" target="_blank" style="margin:0 10px;"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube"/></a>
                                        <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook"/></a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `,
            });

            console.log("Turbo Power repost campaign email sent", send);
            return { status: 200, message: "Turbo power repost campaign email sent successfully" };
        } catch (err) {
            console.error("Error sending Turbo Power repost campaign email", err);
            return { status: 500, message: "Failed to send Turbo power repost campaign email" };
        }
    }

    async sendNewAirdropRegistrationConfirmationForLotto(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address
        userReferralCode: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let send = await sendInMail.sendTransacEmail({
                subject: "Lotto Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                to: [{ email: userEmail }],
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                htmlContent: `
                <!DOCTYPE html>
                <html>

                <head>
                    <title>Lotto Airdrop Confirmation</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                        }

                        .main#main {
                            width: 600px;
                            margin: auto;
                        }

                        @media only screen and (max-width: 600px) {
                            .main#main {
                                width: 96%;
                            }
                        }

                        .cta-button {
                            display: inline-block;
                            background-color: #28a745;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 5px;
                            margin-top: 10px;
                        }
                    </style>
                </head>

                <body>
                    <table align="center" border="0" cellspacing="0" class="main" id="main">
                        <tbody>
                            <tr>
                                <td align="center" style="padding:30px 0">
                                    <a href="https://bitcoinyay.com/" target="_blank">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="150" />
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style="padding:0 30px;background:#fff">
                                        <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                            <tbody>
                                                <tr>
                                                    <td style="font-size: 17px; line-height: 28px; padding: 20px 0; color: #666">
                                                        Dear Participant,
                                                        <br><br> 🎉 Thank you for registering for the Bitcoin Yay Lotto Airdrop!
                                                        <br><br>
                                                        We’re excited to have you join us.
                                                        <br><br>
                                                        📅 <strong>Registration Period:</strong> 21 July – 1 August
                                                        <br> 🎟️ <strong>Reward Distribution:</strong> 1 August (credited to your Lotto Account)
                                                        <br><br>
                                                        💥 <strong>Want more tickets?</strong><br>
                                                        Invite 10 or more friends using your referral link below and earn <strong>+4 bonus Lotto tickets!</strong>

                                                        <br><br>
                                                        <a href="https://bitcoinyay.com/referral=${userReferralCode}" target="_blank" class="cta-button">
                                                            📣 Share Your Referral Link
                                                        </a>
                                                        <br><br>
                                                        Thank you for being part of the Bitcoin Yay community. Stay tuned for further updates.
                                                        <br><br>
                                                        Best regards,<br />
                                                        The Bitcoin Yay Team
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <table width="100%" style="margin-top:50px;padding:20px 0;">
                                            <tbody>
                                                <tr>
                                                    <td align="center">
                                                        <a href="https://x.com/Indexx_Lotto" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                        </a>
                                                        <a href="https://www.instagram.com/indexx.lotto/" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;">
                                                        </a>
                                                        <a href="https://www.youtube.com/@IndexxLotto" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube" style="padding-right:20px;" />
                                                        </a>
                                                        <a href="https://www.facebook.com/IndexxLotto/" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                        </a>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                    </table>
                </body>

                </html>
`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Lotto airdrop registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send lotto airdrop registration confirmation email",
            };
        }
    }

    async sendNewAirdropRegistrationConfirmationForWIBS(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let send = await sendInMail.sendTransacEmail({
                subject: "WIBS Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                to: [{ email: userEmail }],
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                htmlContent: `
                <!DOCTYPE html>
                <html>

                <head>
                    <title>WIBS Airdrop Confirmation</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                        }

                        .main#main {
                            width: 600px;
                            margin: auto;
                        }

                        @media only screen and (max-width: 600px) {
                            .main#main {
                                width: 96%;
                            }
                        }

                        .cta-button {
                            display: inline-block;
                            background-color: #28a745;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 5px;
                            margin-top: 10px;
                        }
                    </style>
                </head>

                <body>
                    <table align="center" border="0" cellspacing="0" class="main" id="main">
                        <tbody>
                            <tr>
                                <td align="center" style="padding:30px 0">
                                    <a href="https://indexx.ai/" target="_blank">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-logo.png" alt="Indexx.ai" width="150" />
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style="padding:0 30px;background:#fff">
                                        <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                            <tbody>
                                                <tr>
                                                    <td style="font-size: 17px; line-height: 28px; padding: 20px 0; color: #666">
                                                        Dear Participant,
                                                        <br><br> 🎉 Thank you for registering for the WIBS Airdrop!
                                                        <br><br>
                                                        We're excited to have you join us in this exclusive airdrop event.
                                                        <br><br>
                                                        📅 <strong>Registration Period:</strong> Live until 28 September 2025
                                                        <br> 🎁 <strong>Airdrop Distribution:</strong> 29 September 2025
                                                        <br><br>
                                                        Your WIBS tokens will be distributed directly to your registered wallet address on the distribution date.
                                                        <br><br>
                                                        Thank you for being part of the Indexx.ai community. Stay tuned for further updates.
                                                        <br><br>
                                                        Best regards,<br />
                                                        The Indexx.ai Team
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <table width="100%" style="margin-top:50px;padding:20px 0;">
                                            <tbody>
                                                <tr>
                                                    <td align="center">
                                                        <a href="https://x.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                        </a>
                                                        <a href="https://www.instagram.com/indexx.ai/" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;">
                                                        </a>
                                                        <a href="https://www.youtube.com/@IndexxAI" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube" style="padding-right:20px;" />
                                                        </a>
                                                        <a href="https://www.facebook.com/IndexxAI/" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                        </a>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                    </table>
                </body>

                </html>
`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "WIBS airdrop registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send WIBS airdrop registration confirmation email",
            };
        }
    }




    async sendTurboPowerAirdropConfirmationEmailForLouis(
        userEmail: string,
        userIdentifier: string, // email or wallet address
        airdropAmount: number,  // 9 (days) for Turbo Power
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType = userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "🎉 Louis, You’ve Earned 9 Days of Turbo Mining Power!",
                sender: { name: "Bitcoin Yay", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Bitcoin Yay" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bitcoin Yay Turbo Power Airdrop Confirmation</title>
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; }
                    .main { width: 600px; margin: auto; }
                    @media only screen and (max-width: 600px) { .main { width: 96%; } }
                </style>
            </head>
            <body>
                <table align="center" class="main">
                    <tr>
                        <td align="center" style="padding:30px 0">
                            <a href="https://bitcoinyay.com/" target="_blank">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png" alt="Bitcoin Yay" width="150"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px; background:#fff;">
                            <table width="100%" style="border:1px solid #f0f0f0; border-radius:5px; padding:30px;">
                                <tr>
                                    <td style="font-size:16px; color:#333;">
                                        Dear Louis,<br/><br/>
                                        🎉 Congratulations! You’ve just been awarded a total of <strong>9 DAYS of Turbo Mining Power</strong> on your Bitcoin Yay account.<br/><br/>
                                        Here’s how you earned it:<br/>
                                        - <strong>2 days</strong> for successfully referring <strong>4 new users</strong> to Bitcoin Yay.<br/>
                                        - <strong>7 days</strong> as a valued investor in the platform.<br/><br/>
                                        <strong>How it works:</strong><br/>
                                        - If you’re currently mining, your Turbo boost will automatically activate <strong>after your current cycle ends</strong>.<br/>
                                        - If you’re not mining right now, start a new mining session anytime to enjoy your bonus.<br/><br/>
                                        Thank you for being a key part of the Bitcoin Yay community. We’re thrilled to reward your contributions and help you maximize your mining potential! ⚡<br/><br/>
                                        Best wishes,<br/>
                                        The Bitcoin Yay Team
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" style="margin-top:40px; text-align:center;">
                                <tr>
                                    <td>
                                        <a href="https://x.com/bitcoin_YAY" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/></a>
                                        <a href="https://www.instagram.com/bitcoin.yay/" target="_blank" style="margin:0 10px;"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram"/></a>
                                        <a href="https://www.youtube.com/@BitcoinYay" target="_blank" style="margin:0 10px;"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="YouTube"/></a>
                                        <a href="https://www.facebook.com/people/Bitcoin-YAY/61574910722200/" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook"/></a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `,
            });

            console.log("Turbo Power Airdrop Confirmation Email sent", send);
            return { status: 200, message: "Turbo power airdrop confirmation email sent successfully" };
        } catch (err) {
            console.error("Error sending Turbo Power email", err);
            return { status: 500, message: "Failed to send Turbo power airdrop confirmation email" };
        }
    }

    async sendIUSDPRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for February 10th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} IUSD+ <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                We're conducting this  airdrop to give away free tokens to our community. Your participation is crucial, and we appreciate your added interest. The tokens will be automatically added to your wallet on February 14th, so be sure to check on that date. <br /> <br />
                                                Stay tuned for more updates and details about the airdrop. We look forward to your continued engagement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendBTCRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for March 18th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} BTC <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                We're conducting this airdrop to give away free tokens to our community. Your participation is crucial, and we appreciate your added interest. The tokens will be automatically added to your wallet on March 22th, 2024 so be sure to check on that date. <br /> <br />
                                                Stay tuned for more updates and details about the airdrop. We look forward to your continued engagement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendIUSDPSuperBallRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for February 11th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} IUSD+ <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                We're conducting this  airdrop to give away free tokens to our community. Your participation is crucial, and we appreciate your added interest. The tokens will be automatically added to your wallet on February 14th, so be sure to check on that date. <br /> <br />
                                                Stay tuned for more updates and details about the airdrop. We look forward to your continued engagement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendIUSDPSaintPatrickRegistrationConfirmation(
        userEmail: string,
        userIdentifier: string, // Could be either email or wallet address,
        airdropAmount: number,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let identifierType =
                userEmail === userIdentifier ? "Email" : "Wallet Address";

            let send = await sendInMail.sendTransacEmail({
                subject: "Airdrop Registration Confirmation",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear Participant,
                                                <br><br> Greetings from Indexx Exchange!<br><br> We're thrilled to confirm your successful registration for our upcoming Airdrop scheduled for March 17th, 2024 at 12:00 AM PST. Thank you for expressing your interest and becoming a part of the Indexx community.<br
                                                /><br /> Registered ${identifierType}: ${userIdentifier}<br /><br /> 
                                                Airdrop amount: ${airdropAmount} IUSD+ <br /><br />
                                                Registered as: ${userType} <br /><br />
                                                We're conducting this  airdrop to give away free tokens to our community. Your participation is crucial, and we appreciate your added interest. The tokens will be automatically added to your wallet on March 19th, 2024 so be sure to check on that date. <br /> <br />
                                                Stay tuned for more updates and details about the airdrop. We look forward to your continued engagement with Indexx.<br /><br /> 
                                                Thank you for being an integral part of our community.<br /><br /> Best Regards,<br />                                        
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
            </table>
        </body>

        </html>`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendDracrazyAirdropNotification(userEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let send = await sendInMail.sendTransacEmail({
                subject:
                    "🚀 Free Airdrop Alert! Don't Miss Out on 10,000 DaCrazy Tokens!",
                sender: { name: "Indexx.ai", email: "wallet@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>DaCrazy Coins Airdrop Alert</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
                .main#main {
                    width: 600px;
                    margin: auto;
                }
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear User,
                                                <br><br> We have an exciting offer just for you! <br><br>
                                                <strong>Free Airdrop Alert!</strong>
                                                <br><br>
                                                Get ready for the DaCrazy Coins airdrop—10,000 tokens up for grabs, courtesy of 
                                                <a href="https://x.com/DACRAZYHAWAIIAN" target="_blank" style="color: #008CBA;">@DACRAZYHAWAIIAN</a>. 
                                                This is your chance to claim your share of a unique crypto opportunity. Don't miss out—register now and secure your free tokens before it's too late!
                                                <br><br>
                                                To register, click on the link below:
                                                <br><br>
                                                <a href="https://indexx.ai/airdrop-dacrazy" style="color: #008CBA;">https://indexx.ai/airdrop-dacrazy</a>
                                                <br><br>
                                                Thank you for being an integral part of our community.<br><br>
                                                Best Regards,<br>
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;">
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/>
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br/><br/>
                                                550 Newport Center Drive
                                                <br/>Newport Beach, CA 92660 United States
                                                <br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>

        </html>
`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Registration confirmation email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send registration confirmation email",
            };
        }
    }

    async sendDracrazyAirdropNotificationLastChance(userEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let send = await sendInMail.sendTransacEmail({
                subject:
                    "🚀 Last Chance Alert! Claim Your 10,000 DaCrazy Tokens Before Time Runs Out!",
                sender: { name: "Indexx.ai", email: "wallet@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>DaCrazy Coins Airdrop - Final Chance</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
                .main#main {
                    width: 600px;
                    margin: auto;
                }
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/>
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear User,
                                                <br><br> This is your <strong>LAST CHANCE</strong> to claim your free airdrop of DaCrazy Tokens! 
                                                <br><br>
                                                <strong>Airdrop Deadline:</strong> 
                                                <span style="color: red;">December 9th, 2024, 12:00 AM PST</span>
                                                <br><br>
                                                Don't miss out on the opportunity to grab <strong>10,000 DaCrazy Coins</strong>, courtesy of 
                                                <a href="https://x.com/DACRAZYHAWAIIAN" target="_blank" style="color: #008CBA;">@DACRAZYHAWAIIAN</a>.
                                                <br><br>
                                                <strong>Act Now!</strong> Register before time runs out and secure your share of this incredible giveaway.
                                                <br><br>
                                                To register, click on the link below:
                                                <br><br>
                                                <a href="https://indexx.ai/airdrop-dacrazy" style="color: #008CBA;">https://indexx.ai/airdrop-dacrazy</a>
                                                <br><br>
                                                Thank you for being an integral part of our community.<br><br>
                                                Best Regards,<br>
                                                The Indexx Exchange Team
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/>
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;">
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/>
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/>
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br/><br/>
                                                550 Newport Center Drive
                                                <br/>Newport Beach, CA 92660 United States
                                                <br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>

        </html>
`,
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Airdrop notification email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send airdrop notification email",
            };
        }
    }

    async greetingCardEmail(
        userEmail: string,
        captainName: string,
        referralLink: string,
        bonusAmount: number,
        greetingMessage: string,
        imageUrl: string,
        receiverName: string,
        userType: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let send = await sendInMail.sendTransacEmail({
                subject:
                    "🎄Exclusive Festive Bonus: Join Our Hive as a Captain Bee or Honeybee! 🐝🎁",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Holiday Cheers</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
                .main {
                    width: 600px;
                    margin: auto;
                }
                @media only screen and (max-width: 600px) {
                    .main {
                        width: 96%;
                    }
                }
                .responsive-image {
                  max-width: 100%;  /* Adjust max-width as per your layout */
                  max-height: 300px; /* Adjust max-height for portrait images */
                  width: auto;
                  height: auto;
                  object-fit: contain;
                  display: block;
                  margin: 0 auto; /* Centers the image */
              }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px; padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                     <br> <br>
                                      <tr>
                                          <td align="center" style="padding-bottom: 20px; padding-top: 20px;">
                                              <img src="${imageUrl}" alt="Greeting Image" class="responsive-image" />
                                          </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size: 17px; line-height: 30px; padding: 20px 0; color: #666">
                                                Dear ${receiverName},<br><br>

                                                ${greetingMessage} <br> <br>
                                                Wishing you joy this season! 🎅🎉 Join our hive and enjoy an exclusive festive bonus:<br><br>
                                                🌟 Register with <a href="${referralLink}" target="_blank">Referral Link</a><br>                                            
                                                💰 Instant bonus in your wallet of ${bonusAmount} INEX<br>
                                                🎊 How to Claim:<br>
                                                <ol style="padding-left: 55px; margin: 0; color: #666;">
                                                  <li>Click <a href="${referralLink}" target="_blank">the link</a>.</li>
                                                  <li>Fill the Signup Form.</li>
                                                  <li>Verify your email.</li>
                                                </ol>
                                                Enjoy your instant bonus!<br>
                                                Dive into the hive as a ${userType === "captainbee"
                        ? "Captain Bee"
                        : "Honey Bee"
                    } for growth, connections, and perks. Here's to a sweet and successful festive season!<br><br>
                                                Learn more about Indexx Hive here: https://hive.indexx.ai<br><br>
                                                Best,<br>
                                                Captain Bee ${captainName}<br>
                                                Indexx Hive
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">


                                            <td style="padding:20px 0;color: #221F1F;">indexx.ai
                                                <br/>
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>

                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>`,
                // ... remaining email setup
            });

            console.log("Email sent", send);
            return {
                status: 200,
                message: "Holiday cheers email sent successfully",
            };
        } catch (err) {
            console.error("Error sending email", err);
            return {
                status: 500,
                message: "Failed to send holiday cheers email",
            };
        }
    }

    async sendFiatWithdrawNotification(
        email: string,
        beneficiaryName: string,
        accountNumber: string,
        routingNumber: string,
        bankName: string,
        swiftCode: string,
        addressLine1: string,
        city: string,
        state: string,
        country: string,
        zipCode: string,
        amount: string,
        currency: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Withdraw Creation Details",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        
        <head>
            <title>Fiat USD Withdrawal Notification</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
        
                .main#main {
                    width: 600px;
                    margin: auto;
                }
        
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
        
            </style>
        </head>
        
        <body>
        
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px 30px;" cellspacing="0"
                                        cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">We've received your request to withdraw USD. Below are the details for the withdrawal:
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="color: #5f5f5f;">
                                                Beneficiary Name: <b>${beneficiaryName}</b><br/>
                                                Amount: <b>${amount}  ${currency}</b><br/>
                                                Account Number: <b>${accountNumber}</b><br/>
                                                Bank Name: <b>${bankName}</b><br/>
                                                Routing Number: <b>${routingNumber}</b><br/>
                                                SWIFT Code: <b>${swiftCode}</b><br/>
                                                Address Line 1: <b>${addressLine1}</b><br/>
                                                City: <b>${city}</b><br/>
                                                State: <b>${state}</b><br/>
                                                Country: <b>${country}</b><br/>
                                                Zip Code: <b>${zipCode}</b><br/>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">Please note that your withdrawal will be processed within 2-5 business days.
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                                <br />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br />
                                                <br />
                                                <br /><br />550 Newport Center Drive
                                                <br />
                                                <br />Newport Beach,
                                                <br />
                                                <br />CA 92660 United State
                                                <br /><br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
        
                </tbody>
            </table>
        
        </body>
        
        </html>
        `,
                // htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for ordering on Indexx Exchange. Please find below your order details.<br>
                //         Order Amount: ${orderAmount} ${orderCurrency}<br>
                //         Order Status: ${OrderStatus.Completed} <br>
                //         Order Type: ${orderType} <br> <br>
                //         Thanks, <br>
                //         Indexx Exchange Team
                //         </h1></body></html>`,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendFiatDepositNotification(
        email: string,
        orderId: string,
        amount: number,
        fromDetails: string,
        toDetails: string,
        paymentReceiptUrl: string,
        website: string = ""
    ) {
        try {
            const from = JSON.parse(fromDetails);
            const to = JSON.parse(toDetails);
            const logoURL =
                website === "BTCY-MOBLIE-APP"
                    ? "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png"
                    : "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";

            const currentYear = new Date().getFullYear();
            let emailSubject = "";
            if (website === "BTCY-MOBLIE-APP") {
                emailSubject = "Bitcoin Yay Deposit Notification";
            } else {
                emailSubject = "Indexx Deposit Notification";
            }
            let websiteUrl = website === "BTCY-MOBLIE-APP" ? "bitcoinyay.com" : "indexx.ai";
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: emailSubject,
                sender: { name: website === "BTCY-MOBLIE-APP" ? "Bitcoin Yay" : "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: website === "BTCY-MOBLIE-APP" ? "Bitcoin Yay" : "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
                <!DOCTYPE html>
                <html>
        
                <head>
                    <title>Fiat USD Deposit Notification</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                        }
        
                        .main#main {
                            width: 600px;
                            margin: auto;
                        }
        
                        @media only screen and (max-width: 600px) {
                            .main#main {
                                width: 96%;
                            }
                        }
        
                    </style>
                </head>
        
                <body>
        
                    <table align="center" border="0" cellspacing="0" class="main" id="main">
                        <tbody>
                            <tr>
                                <td align="center" valign="middle" style="padding:33px 0">
                                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                        <img src="${logoURL}" alt="IndexIcon" style="width: ${website === 'BTCY-MOBLIE-APP' ? '200px' : '150px'}; max-width: 80%; height: auto;" />
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style="padding:0 30px;background:#fff">
                                        <table width="100%" style="border:1px solid
                                                #f0f0f0;border-radius:5px;
                                                padding: 0 30px 30px;" cellspacing="0"
                                                cellpadding="0">
                                            <tbody>
                                                <tr>
                                                    <td style="font-size:17px;line-height:30px;padding:20px
                                                            0;color:#666">Dear User,
                                                            <br/>
                                                            We've received your request to deposit USD. Below are the details for the deposit:
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #5f5f5f;">
                                                        Order Id: <b>${orderId}</b><br/>
                                                        <br/>
                                                        Amount: <b>${amount}</b><br/>
                                                        <br/>
                                                        <b>From Details:</b><br/>
                                                        Name: <b>${from.name}</b><br/>
                                                        Bank Name: <b>${from.bankName
                    }</b><br/>
                                                        Bank Account Number: <b>${from.bankAccountNumber
                    }</b><br/>
                                                        Address: <b>${from.address
                    }</b><br/>
                                                        Phone Number: <b>${from.phoneNumber
                    }</b><br/>
                                                        <br/>
                                                        <b>To Details:</b><br/>
                                                        Recipient Name: <b>${to.recipientName
                    }</b><br/>
                                                        Recipient Address: <b>${to.recipientAddress
                    }</b><br/>
                                                        Bank Name: <b>${to.bankName
                    }</b><br/>
                                                        Bank Account Number: <b>${to.bankAccountNumber
                    }</b><br/>
                                                        Bank Address: <b>${to.bankAddress
                    }</b><br/>
                                                        Wire Routing Number: <b>${to.wireRoutingNumber
                    }</b><br/>
                                                        SWIFT Code: <b>${to.swiftCode
                        ? to.swiftCode
                        : "NA"
                    }</b><br/>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size:17px;line-height:30px;padding:20px
                                                            0;color:#666">Please note that your deposit will be processed within 2-5 business days.
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size:17px;line-height:30px;padding:20px
                                                            0;color:#666">Payment Receipt:
                                                        <br/>
                                                        <img src="${paymentReceiptUrl}" alt="Payment Receipt" width="500" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size:12px;color:#666;">
                                                        This is an automated message. Please do not reply.
                                                        <br />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <table width="100%" style="margin-top:50px;padding:20px 0;">
                                            <tbody>
                                                <tr>
                                                    <td align="center" style="margin-bottom:20px;display:block">
                                                        <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                        </a>
                                                        <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                        </a>
                                                        <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                        </a>
                                                        <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                        </a>
                                                    </td>
                                                </tr>
                                                <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                    <td style="padding:20px 0;color: #221F1F;">
                                                        ${websiteUrl}
                                                        <br />
                                                        <br />
                                                        <br /><br />550 Newport Center Drive
                                                        <br />
                                                        <br />Newport Beach,
                                                        <br />
                                                        <br />CA 92660 United States
                                                        <br /><br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
        
                        </tbody>
                    </table>
        
                </body>
        
                </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendToUserNotification(
        email: string,
        fromEmail: string,
        amount: number,
        coin: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Crypto Received Notification",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Crypto Received Notification</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
                .main#main {
                    width: 600px;
                    margin: auto;
                }
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                Dear User, You've received ${amount} ${coin} from ${fromEmail}.
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                                <br />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br />
                                                550 Newport Center Drive
                                                <br />Newport Beach,
                                                <br />CA 92660 United States
                                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendFromUserNotification(
        email: string,
        toEmail: string,
        amount: number,
        coin: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Crypto Sent Notification",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Crypto Sent Notification</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
                .main#main {
                    width: 600px;
                    margin: auto;
                }
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>
        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                Dear User, You've sent ${amount} ${coin} to ${email}.
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                                <br />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br />
                                                550 Newport Center Drive
                                                <br />Newport Beach,
                                                <br />CA 92660 United States
                                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendGiftCardNotification(
        email: string,
        toEmail: string,
        giftcardType: string,
        senderName: string,
        giftToken: string,
        giftTokenAmount: number,
        messageFromSender: string,
        redeemCode: string,
        imageUrl: string,
        amountInUsd: number
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `You've Received a ${giftToken}-${giftcardType} from ${senderName}!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>You've Received a ${giftToken} - ${giftcardType} from ${senderName}!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }
                    .main#main {
                        width: 600px;
                        margin: auto;
                    }
                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br />
                                                    You have been sent a ${giftcardType} from ${senderName}! 🎉
                                                    <br /><br />
                                                     ${imageUrl
                        ? `<img src="${imageUrl}" alt="Gift Card Image" style="max-width: 100%; height: auto;" />`
                        : ""
                    }
                                                    <br /><br />
                                                    Here are the details of your gift:
                                                    <br />
                                                    <strong>Gift Card Type:</strong> ${giftcardType}
                                                    <br />
                                                    <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                        "en-US",
                        {
                            style: "decimal",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                        }
                    ).format(amountInUsd)}
                                                    <br />
                                                    <strong>Token Amount:</strong> ${giftTokenAmount} ${giftToken}
                                                    <br /><br />
                                                    Message from ${senderName}: ${messageFromSender}
                                                    <br /><br />
                                                    To redeem your gift card, please follow these instructions:
                                                   <br />
                                                    <strong>1. Sign Up or Login:</strong> If you don't have an account with Indexx, <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=exchange" target="_blank" rel="noopener noreferrer">Sign Up</a> and create your account. If you are already signed up, <a href="https://indexx.ai/auth/login?redirectWebsiteLink=exchange" target="_blank" rel="noopener noreferrer">Log In</a>.
                                                    <br />
                                                    <strong>2. Redeem Your Code:</strong> Click on this link to redeem your gift card: <a href="https://cex.indexx.ai/redeem" target="_blank" rel="noopener noreferrer">Redeem Link</a>.
                                                    <br />
                                                    <strong>3. Paste Your Code:</strong> Copy and paste the Redeem Code below into the Redeem Code Box, then click on 'redeem'.
                                                    <br /><br />
                                                    <strong>Redeem Code:</strong> ${redeemCode}
                                                    <br /><br />
                                                    Enjoy Your Gift! Congratulations, you are now a cryptocurrency owner. Have fun with it!
                                                    <br /><br />
                                                    If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br />
                                                    550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendSelfGiftCardNotification(
        toEmail: string,
        giftcardType: string,
        giftToken: string[],
        giftTokenAmount: number,
        redeemCode: string,
        imageUrl: string,
        amountInUsd: number,
        messageFromSender: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your ${giftcardType} Gift Card is Ready!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Your ${giftcardType} Gift Card is Ready!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        width: 600px;
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3 !important;
                        /* Change button color to specified blue */
                        color: white !important;
                        /* Make the text inside the button white */
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        /* Set fixed width for all buttons */
                        border: none;
                        /* Remove borders */
                        border-radius: 0;
                        /* Make buttons square with no border radius */
                    }

                    .button-container {
                        text-align: center;
                        /* Center the buttons */
                        margin-top: 20px;
                    }

                    .signature {
                        font-size: 16px;
                        color: #666;
                        margin-top: 30px;
                    }

                    img.seminar-image {
                        width: 75%;
                        /* Make seminar image smaller */
                        height: auto;
                        /* Keep aspect ratio */
                        display: block;
                        /* Ensure block display */
                        margin: auto;
                        /* Center image horizontally */
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                            </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br /> 🎉Congratulations on purchasing your ${giftcardType} gift card! 
                                                    <br /><br /> ${imageUrl
                        ? `<img src="${imageUrl}" alt="Gift Card Image" style="max-width: 100%; height: auto;" />`
                        : ""
                    }
                                                    <br /><br /> Personalized Message: ${messageFromSender}
                                                    <br /><br /> Here are the details of your gift card:
                                                    <br />
                                                    <strong>Gift Card Type:</strong> ${giftcardType}
                                                    <br />
                                                    <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                        "en-US",
                        {
                            style: "decimal",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                        }
                    ).format(amountInUsd)}
                                                    <br /> To redeem your gift card, please follow these instructions:
                                                    <br />
                                                    <strong>1. Sign Up or Login:</strong>
                                                    <br /> If you don't have an account with Indexx,
                                                    <div class="button-container">
                                                        <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=exchange" target="_blank" class="button">Sign Up</a>
                                                        <a href="https://indexx.ai/auth/login?redirectWebsiteLink=exchange" target="_blank" class="button">Login</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>2. Redeem Your Code:</strong>
                                                    <br />
                                                    <div class="button-container">
                                                        <a href="https://cex.indexx.ai/redeem" target="_blank" class="button">Redeem Gift</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>3. Paste Your Code:</strong>
                                                    <br /> Copy and paste the Redeem Code below into the Redeem Code Box, then click on 'redeem'.
                                                    <br /><br />
                                                    <strong>Redeem Code:</strong> <b> ${redeemCode}</b>
                                                    <br /><br />
                                                    <strong>4. Congratulations on starting your journey with cryptocurrency.</strong> We hope you grow and prosper with Indexx.ai. If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                    <br /><br /> Enjoy your gift! Congratulations, you are now a cryptocurrency owner. Have fun with it!
                                                    <br /><br /> If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                                </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                                </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                                </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                                </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br /> 550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>

            </html>
            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendGenericEmail({
        toEmail,
        subject,
        bodyContent,
        senderName = "Indexx.ai",
        senderEmail = "accounts@indexx.ai",
        replyToEmail = "wallet@indexx.ai",
        bccEmails = [],
        bannerUrl = "",
        logoUrl = "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png",
        logoLink = "https://indexx.ai/",
    }: {
        toEmail: string;
        subject: string;
        bodyContent: string;
        senderName?: string;
        senderEmail?: string;
        replyToEmail?: string;
        bccEmails?: string[];
        bannerUrl?: string;
        logoUrl?: string;
        logoLink?: string;
    }) {
        try {
            // Authenticate Sendinblue client
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                keys.sendInBlueKey.key;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            // HTML email content with placeholders for dynamic data
            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${subject}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
          <style>
            body { font-family: Arial, Helvetica, sans-serif; }
            .main { width: 600px; margin: auto; }
            .button { background-color: #004DB3; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; font-size: 16px; margin: 4px 2px; cursor: pointer; width: 180px; border: none; }
            .button-container { text-align: center; margin-top: 20px; }
            .signature { font-size: 16px; color: #666; margin-top: 30px; }
            img.banner-image { width: 100%; height: auto; display: block; margin: auto; }
            @media only screen and (max-width: 600px) { .main { width: 96%; } }
          </style>
        </head>
        <body>
          <table align="center" border="0" cellspacing="0" class="main">
            <tbody>
              <tr>
                <td align="center" style="padding:33px 0">
                  <a href="${logoLink}" target="_blank">
                    <img src="${logoUrl}" alt="Header Logo" width="150" />
                  </a>
                </td>
              </tr>
              ${bannerUrl
                    ? `<tr>
                <td align="center" style="padding:0 30px 20px;">
                  <img src="${bannerUrl}" alt="Banner" class="banner-image" />
                </td>
              </tr>`
                    : ""}
              <tr>
                <td>
                  <div style="padding:0 30px;background:#fff">
                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                      <tbody>
                        <tr>
                          <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                            ${bodyContent} <!-- Insert dynamic body content here -->
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#666;">
                            This is an automated message. Please do not reply.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                      <tbody>
                        <tr>
                          <td align="center">
                            <a href="https://twitter.com/Indexx_ai" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" /></a>
                            <a href="https://www.instagram.com/indexx_ai/" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;" /></a>
                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" /></a>
                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" /></a>
                          </td>
                        </tr>
                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                          <td style="padding:20px 0;color: #221F1F;">
                            indexx.ai
                            <br /> 550 Newport Center Drive
                            <br />Newport Beach, CA 92660 United States
                            <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

            // Combine default BCC emails with any additional ones passed in
            const bccList = [...DEFAULT_BCC_EMAILS];
            if (bccEmails && bccEmails.length > 0) {
                bccEmails.forEach(email => {
                    if (!bccList.find(bcc => bcc.email === email)) {
                        bccList.push({ email });
                    }
                });
            }

            // Send email with Sendinblue
            const send = await sendInMail.sendTransacEmail({
                subject,
                sender: { name: senderName, email: senderEmail },
                replyTo: { email: replyToEmail, name: senderName },
                to: [{ email: toEmail }],
                bcc: bccList,
                htmlContent,
                params: { bodyMessage: "Made just for you!" },
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendPriceIncreaseNotification(
        toEmail: string,
        coinSymbol: string,
        latestPrice: number,
        updatedOn: Date
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();
            const send = await sendInMail.sendTransacEmail({
                subject: `INEX Price Increase Notification`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
              <title>INEX Price Update</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                  body { font-family: Arial, Helvetica, sans-serif; }
                  .main#main { width: 600px; margin: auto; }
                  .button { background-color: #004DB3; color: white; padding: 10px 20px; text-align: center; display: inline-block; font-size: 16px; border: none; border-radius: 0; }
                  .button-container { text-align: center; margin-top: 20px; }
                  img.banner-image { width: 100%; height: auto; }
                  @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
              </style>
          </head>
          <body>
              <table align="center" border="0" cellspacing="0" class="main" id="main">
                  <tbody>
                      <tr>
                          <td align="center" style="padding:33px 0">
                              <a href="https://indexx.ai/" target="_blank">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                              </a>
                          </td>
                      </tr>
                      <tr>
                          <td>
                              <div style="padding:0 30px;background:#fff">
                                  <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;">
                                      <tbody>
                                          <tr>
                                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                  Hi there,<br /><br />
                                                  We wanted to inform you that the price of <strong>${coinSymbol}</strong> has increased by $0.25.<br /><br />
                                                  <strong>Latest Price:</strong> $${latestPrice}<br />
                                                  <strong>Updated On:</strong> ${updatedOn.toDateString()}
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                                  <table width="100%" style="margin-top:50px;padding:20px 0;">
                                      <tbody>
                                          <tr>
                                              <td align="center">
                                                  <a href="https://indexx.ai/" target="_blank">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                  </a>
                                                  <a href="https://www.instagram.com/indexx_ai/" target="_blank" style="padding:0 20px;">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                  </a>
                                              </td>
                                          </tr>
                                          <tr style="background: #E4E4E4; text-align: center; font-size:10px;" align="center">
                                              <td style="padding:20px 0; color: #221F1F;">
                                                  indexx.ai<br /> 550 Newport Center Drive, Newport Beach, CA 92660 United States<br />
                                                  Copyright © ${currentYear} All Rights Reserved Indexx.ai
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </body>
          </html>
        `,
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }


    async sendMiningHalvingReminder(toEmail: string, userName: string, effectiveDate: Date) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const currentYear = new Date().getFullYear();

            const send = await sendInMail.sendTransacEmail({
                subject: `⛏️ Mining Halving Notice`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: toEmail }],
                bcc: [{ email: "mining@indexx.ai" }],
                htmlContent: `
                <html>
                <body style="font-family: Arial, sans-serif;">
                    <div style="max-width: 600px; margin: auto;">
                        <h2>⛏️ Indexx Mining Halving</h2>
                        <p>Dear ${userName || "User"},</p>
                        <p>This is a reminder that your mining rate has been halved as part of our scheduled halving event.</p>
                        <p><strong>Effective From:</strong> ${effectiveDate.toDateString()}</p>
                        <p>Thank you for being a part of our mining community. Keep mining and earning!</p>
                        <br/>
                        <p>— Team Indexx.ai</p>
                        <hr/>
                        <small style="color: #777;">© ${currentYear} Indexx.ai | All Rights Reserved</small>
                    </div>
                </body>
                </html>
            `,
            });

            console.log(`✅ Halving reminder sent to ${toEmail}`);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("❌ Email send error:", err);
            return { status: 500, message: "Failed to send halving email" };
        }
    }


    async sendInexSponsorshipReport(
        toEmail: string,
        payload: {
            monthLabel: string;
            price: number;
            usdAmount: number;
            tokens: number;
            tokensAdded: number;
            usdAdded: number;
            transactionCreated: boolean;
            txId?: string;
            beforeSnapshot: {
                coinBalance: number;
                coinStakedBalance: number;
                amountInvested: number;
                coinPrice: number;
                lastUsedISO: string;
            };
            afterSnapshot: {
                coinBalance: number;
                coinStakedBalance: number;
                amountInvested: number;
                coinPrice: number;
                lastUsedISO: string;
            };
        }
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const formatTokens = (value: number) =>
                value.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
            const formatUSD = (value: number) =>
                `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const htmlContent = `
            <html>
              <body style="font-family: Arial, sans-serif; color: #222;">
                <div style="max-width: 640px; margin: 0 auto;">
                  <h2 style="color: #ff7f00; margin-bottom: 8px;">INEX Sponsorship Summary &ndash; ${payload.monthLabel}</h2>
                  <p style="margin-top: 0;">Monthly allocation processed for <strong>${payload.monthLabel}</strong>.</p>

                  <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 24px 0;">
                    <thead>
                      <tr style="background: #f4f4f4;">
                        <th align="left" style="border: 1px solid #ddd;">Metric</th>
                        <th align="right" style="border: 1px solid #ddd;">Before</th>
                        <th align="right" style="border: 1px solid #ddd;">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style="border: 1px solid #ddd;">Wallet Balance (INEX)</td>
                        <td align="right" style="border: 1px solid #ddd;">${formatTokens(payload.beforeSnapshot.coinBalance)}</td>
                        <td align="right" style="border: 1px solid #ddd;">${formatTokens(payload.afterSnapshot.coinBalance)}</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #ddd;">Staked Balance (INEX)</td>
                        <td align="right" style="border: 1px solid #ddd;">${formatTokens(payload.beforeSnapshot.coinStakedBalance)}</td>
                        <td align="right" style="border: 1px solid #ddd;">${formatTokens(payload.afterSnapshot.coinStakedBalance)}</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #ddd;">Amount Invested (USD)</td>
                        <td align="right" style="border: 1px solid #ddd;">${formatUSD(payload.beforeSnapshot.amountInvested)}</td>
                        <td align="right" style="border: 1px solid #ddd;">${formatUSD(payload.afterSnapshot.amountInvested)}</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #ddd;">Recorded Coin Price (USD)</td>
                        <td align="right" style="border: 1px solid #ddd;">${payload.beforeSnapshot.coinPrice.toFixed(2)}</td>
                        <td align="right" style="border: 1px solid #ddd;">${payload.afterSnapshot.coinPrice.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <p style="margin: 0;"><strong>Grant Details</strong></p>
                  <ul style="margin-top: 8px;">
                    <li>Monthly USD value: ${formatUSD(payload.usdAmount)}</li>
                    <li>Applied INEX price: $${payload.price.toFixed(2)}</li>
                    <li>Calculated tokens: ${formatTokens(payload.tokens)}</li>
                    <li>Tokens staked this run: ${formatTokens(payload.tokensAdded)}</li>
                    <li>USD added this run: ${formatUSD(payload.usdAdded)}</li>
                    <li>Transaction status: ${payload.transactionCreated ? `Created (${payload.txId})` : "Already existed"}</li>
                  </ul>

                  <p style="font-size: 12px; color: #666; margin-top: 24px;">
                    Wallet last used before run: ${payload.beforeSnapshot.lastUsedISO}<br/>
                    Wallet last used after run: ${payload.afterSnapshot.lastUsedISO}
                  </p>

                  <p style="margin-top: 24px;">Regards,<br/>Indexx Automation</p>
                </div>
              </body>
            </html>
          `;

            const send = await sendInMail.sendTransacEmail({
                subject: `INEX Sponsorship - ${payload.monthLabel}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: toEmail }],
                htmlContent,
            });

            console.log(`[email] Sent INEX sponsorship summary for ${payload.monthLabel} to ${toEmail}`);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending sponsorship email:", err);
            return { status: 500, message: "Failed to send sponsorship email" };
        }
    }


    async sendShopNewProductLaunchEmail(toEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx Shop is Live with a Free $50 Gift Card Offer!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
            <html>

            <head>
                <title>Welcome to Indexx Shop! Get Your Free $50 Gift Card</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        width: 600px;
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3 !important;
                        color: white !important;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        border: none;
                        border-radius: 0;
                    }

                    .button-container {
                        text-align: center;
                        margin-top: 20px;
                    }

                    .signature {
                        font-size: 16px;
                        color: #666;
                        margin-top: 30px;
                    }

                    img.banner-image {
                        width: 100%;
                        height: auto;
                        display: block;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <!-- Header with Logo -->
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>

                        <!-- Main Content -->
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <!-- Clickable Banner Image -->
                                    <a href="https://shop.indexx.ai" target="_blank">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Shop_Registered_User_Prompt.jpeg" alt="Indexx Shop Banner" class="banner-image" />
                                    </a>

                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br /> We're thrilled to announce the launch of Indexx Shop!To celebrate, we are offering you a free $50 gift card on your first purchase! 🎉
                                                    <br /><br />
                                                    <strong>How It Works:</strong>
                                                    <br />
                                                    <ul>
                                                        <li>Visit <a href="https://shop.indexx.ai" target="_blank">Indexx Shop</a> and explore our exclusive products.</li>
                                                        <li>Make your first purchase.</li>
                                                        <li>After your purchase, you'll receive a $50 gift card in your email to use on future orders!</li>
                                                    </ul>

                                                    <br />
                                                    <strong>1. Sign Up or Login:</strong>
                                                    <br /> If you don't have an account with Indexx,
                                                    <div class="button-container">
                                                        <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=shop" target="_blank" class="button">Sign Up</a>
                                                        <a href="https://indexx.ai/auth/login?redirectWebsiteLink=shop" target="_blank" class="button">Login</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>2. Start Shopping:</strong>
                                                    <br />
                                                    <div class="button-container">
                                                        <a href="https://shop.indexx.ai" target="_blank" class="button">Visit Indexx Shop</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>3. Get Your Free Gift:</strong>
                                                    <br /> Make your first purchase, and we'll send you your $50 gift card!
                                                    <br /><br /> If you need any assistance, feel free to reach out to our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                    <br /><br /> Enjoy your shopping experience at Indexx Shop! Don't miss out on this special offer!
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <!-- Footer -->
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br /> 550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>

            </html>
            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    // Updated email function to send full Medium post email with complete template
    async sendMediumPostEmail({
        toEmail,
        imageUrl,
        title,
        description,
        url,
    }: {
        toEmail: string;
        imageUrl: string;
        title: string;
        description: string;
        url: string;
    }) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                "YOUR_API_KEY"; // Replace with your Sendinblue API key

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const send = await sendInMail.sendTransacEmail({
                subject: `Check Out Our Latest Medium Post: ${title}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: toEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>New Medium Post</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            <style>
              body { font-family: Arial, Helvetica, sans-serif; }
              .main { width: 600px; margin: auto; }
              .button { background-color: #004DB3; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; font-size: 16px; margin: 4px 2px; cursor: pointer; width: 180px; border: none; }
              .button-container { text-align: center; margin-top: 20px; }
              .signature { font-size: 16px; color: #666; margin-top: 30px; }
              img.banner-image { width: 100%; height: auto; display: block; margin: auto; }
              @media only screen and (max-width: 600px) { .main { width: 96%; } }
            </style>
          </head>
          <body>
            <table align="center" border="0" cellspacing="0" class="main">
              <tbody>
                <!-- Header with Logo -->
                <tr>
                  <td align="center" valign="middle" style="padding:33px 0">
                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexxIcon" width="150" />
                    </a>
                  </td>
                </tr>
  
                <!-- Main Content -->
                <tr>
                  <td>
                    <div style="padding:0 30px;background:#fff">
                      <!-- Clickable Banner Image -->
                      <a href="${url}" target="_blank">
                        <img src="${imageUrl}" alt="Post Image" class="banner-image" />
                      </a>
  
                      <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                        <tbody>
                          <tr>
                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                              Hi there,
                              <br /><br />
                              We have published a new article on Medium, "<strong>${title}</strong>."
                              <br /><br />
                              <p>${description}</p>
                              <br />
                              <div class="button-container">
                                <a href="${url}" target="_blank" class="button">Read Full Article</a>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size:12px;color:#666;">
                              This is an automated message. Please do not reply.
                              <br />
                            </td>
                          </tr>
                        </tbody>
                      </table>
  
                      <!-- Footer -->
                      <table width="100%" style="margin-top:50px;padding:20px 0;">
                        <tbody>
                          <tr>
                            <td align="center" style="margin-bottom:20px;display:block">
                              <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                              </a>
                              <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;" />
                              </a>
                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                              </a>
                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                              </a>
                            </td>
                          </tr>
                          <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                            <td style="padding:20px 0;color: #221F1F;">
                              indexx.ai
                              <br /> 550 Newport Center Drive
                              <br />Newport Beach,
                              <br />CA 92660 United States
                              <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
          </html>
        `,
            });

            console.log("Email sent:", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendDaCrazyTokenPromotionEmail(toEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Indexx Exclusive Offer: Buy 1 DaCrazy Token, Get 9 Free!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>

            <head>
                <title>DaCrazy Token Buy 1 Get 9 FREE Offer</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        width: 600px;
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3 !important;
                        color: white !important;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        border: none;
                        border-radius: 0;
                    }

                    .button-container {
                        text-align: center;
                        margin-top: 20px;
                    }

                    .signature {
                        font-size: 16px;
                        color: #666;
                        margin-top: 30px;
                    }

                    img.banner-image {
                        width: 100%;
                        height: auto;
                        display: block;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <!-- Header with Logo -->
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>

                        <!-- Main Content -->
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <!-- Clickable Banner Image -->
                                    <a href="https://cex.indexx.ai/update/home?buyToken=DaCrazy" target="_blank">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Dacrazy_promotion_2.jpeg" alt="DaCrazy Token Promotion Banner" class="banner-image" />
                                    </a>

                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br /> We're excited to announce an exclusive offer on DaCrazy Token! For a limited time, when you buy 1 DaCrazy Token, you'll get 9 more for FREE! 🎉
                                                    <br /><br />
                                                    <strong>How It Works:</strong>
                                                    <br />
                                                    <ul>
                                                        <li>Visit <a href="https://cex.indexx.ai/update/home?buyToken=DaCrazy" target="_blank">Indexx Exchange</a> and purchase 1 DaCrazy Token.</li>
                                                        <li>Get 9 additional tokens automatically credited to your account.</li>
                                                        <li>Enjoy boosting your holdings!</li>
                                                    </ul>

                                                    <br />
                                                    <strong>1. Sign Up or Login:</strong>
                                                    <br /> If you don't have an account with Indexx,
                                                    <div class="button-container">
                                                        <a href="https://indexx.ai/auth/signup-email" target="_blank" class="button">Sign Up</a>
                                                        <a href="https://indexx.ai/auth/login" target="_blank" class="button">Login</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>2. Get Your DaCrazy Tokens:</strong>
                                                    <br />
                                                    <div class="button-container">
                                                        <a href="https://cex.indexx.ai/update/home?buyToken=DaCrazy" target="_blank" class="button">Buy DaCrazy Tokens</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>3. Enjoy Your Bonus:</strong>
                                                    <br /> For every 1 DaCrazy Token you purchase, 9 more will be added to your account automatically!
                                                    <br /><br /> If you need any assistance, feel free to reach out to our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                    <br /><br /> Don't miss out on this incredible offer. Start boosting your DaCrazy Token holdings today!
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <!-- Footer -->
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Instagram" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="Facebook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br /> 550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>

            </html>
            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendSelfFreeGiftCardNotification(
        toEmail: string,
        giftcardType: string,
        giftToken: string[],
        giftTokenAmount: number,
        redeemCode: string,
        imageUrl: string,
        amountInUsd: number
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your Free ${giftcardType} Gift Card is Ready!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>

            <head>
                <title>Your ${giftcardType} Gift Card is Ready!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        width: 600px;
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3 !important;
                        color: white !important;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        border: none;
                        border-radius: 0;
                    }

                    .button-container {
                        text-align: center;
                        margin-top: 20px;
                    }

                    .signature {
                        font-size: 16px;
                        color: #666;
                        margin-top: 30px;
                    }

                    img.seminar-image {
                        width: 75%;
                        height: auto;
                        display: block;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br /> Congratulations on your first purchase from Indexx Shop! As a token of our appreciation, we're excited to present you with your free ${giftcardType} gift card! 🎉
                                                    <br /><br />
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/50--.png" alt="Gift Card Image" style="max-width: 100%; height: auto;" />
                                                    <br /><br /> Here are the details of your gift card:
                                                    <br />
                                                    <strong>Gift Card Type:</strong> ${giftcardType}
                                                    <br />
                                                    <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                    "en-US",
                    {
                        style: "decimal",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    }
                ).format(amountInUsd)}
                                                    <br /> To redeem your gift card, please follow these steps:
                                                    <br />
                                                    <strong>1. Sign Up or Login:</strong>
                                                    <br /> If you don't have an account with Indexx,
                                                    <div class="button-container">
                                                        <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=exchange" target="_blank" class="button">Sign Up</a>
                                                        <a href="https://indexx.ai/auth/login?redirectWebsiteLink=exchange" target="_blank" class="button">Login</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>2. Redeem Your Code:</strong>
                                                    <br />
                                                    <div class="button-container">
                                                        <a href="https://cex.indexx.ai/redeem" target="_blank" class="button">Redeem Gift</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>3. Paste Your Code:</strong>
                                                    <br /> Copy and paste the Redeem Code below into the Redeem Code Box, then click on 'redeem'.
                                                    <br /><br />
                                                    <strong>Redeem Code:</strong><b>${redeemCode}</b>
                                                    <br /><br />
                                                    <strong>4. Congratulations on starting your journey with cryptocurrency.</strong> We hope you grow and prosper with Indexx.ai. If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.

                                                    <br /><br /> Enjoy your gift and happy shopping at Indexx Shop! You're now a proud owner of cryptocurrency—have fun exploring its potential!
                                                    <br /><br /> If you need any assistance, feel free to reach out to our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br /> 550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>

            </html>
            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendSelfFreeGiftCardForNewSignUpNotification(
        toEmail: string,
        giftcardType: string,
        giftToken: string[],
        giftTokenAmount: number,
        redeemCode: string,
        imageUrl: string,
        amountInUsd: number
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your Free ${giftcardType} Gift Card is Ready!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>

            <head>
                <title>Your Free Gift Card is Ready!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        width: 600px;
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3 !important;
                        color: white !important;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        border: none;
                        border-radius: 0;
                    }

                    .button-container {
                        text-align: center;
                        margin-top: 20px;
                    }

                    .signature {
                        font-size: 16px;
                        color: #666;
                        margin-top: 30px;
                    }

                    img.giftcard-image {
                        width: 75%;
                        height: auto;
                        display: block;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br /> Congratulations on signing up with Indexx.ai! 🎉
                                                    <br /><br /> As a token of our appreciation, we're excited to present you with a free gift card for your first step into the world of cryptocurrency! 💸
                                                    <br /><br />
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/50--.png" alt="Gift Card Image" style="max-width: 100%; height: auto;" />
                                                    <br /><br /> Here are the details of your gift card:
                                                    <br />
                                                    <strong>Gift Card Type:</strong> ${giftcardType}
                                                    <br />
                                                    <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                    "en-US",
                    {
                        style: "decimal",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    }
                ).format(amountInUsd)}
                                                    <br /><br />
                                                    To redeem your gift card, please follow these steps:
                                                    <br /><br />
                                                    <strong>1. Sign Up or Login:</strong>
                                                    <br /> If you haven't yet, complete your account with Indexx:
                                                    <div class="button-container">
                                                        <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=exchange" target="_blank" class="button">Sign Up</a>
                                                        <a href="https://indexx.ai/auth/login?redirectWebsiteLink=exchange" target="_blank" class="button">Login</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>2. Redeem Your Code:</strong>
                                                    <br />
                                                    <div class="button-container">
                                                        <a href="https://cex.indexx.ai/redeem" target="_blank" class="button">Redeem Gift</a>
                                                    </div>
                                                    <br /><br />
                                                    <strong>3. Paste Your Code:</strong>
                                                    <br /> Copy and paste the Redeem Code below into the Redeem Code Box, then click on 'redeem'.
                                                    <br /><br />
                                                    <strong>Redeem Code:</strong><b>${redeemCode}</b>
                                                    <br /><br />
                                                    <strong>4. Congratulations on starting your journey with cryptocurrency.</strong> We hope you grow and prosper with Indexx.ai. If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                    <br /><br /> Enjoy your gift and happy exploring at Indexx.ai!
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br /> 550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>                                         

            </html> 

            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendWelcomeEmail(
        toEmail: string,
        temporaryPassword: string,
        loginUrl: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Welcome to Indexx Exchange!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: [...DEFAULT_BCC_EMAILS, { email: "bz@indexx.ai" }, { email: "omkar@indexx.ai" }],
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Welcome to Indexx Exchange!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main {
                    width: 600px;
                    margin: auto;
                }

                .button {
                    background-color: #004DB3;
                    color: black;
                    padding: 10px 20px;
                    text-align: center;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                    margin: 4px 2px;
                    cursor: pointer;
                    width: 180px;
                    border: none;
                    border-radius: 0;
                }

                .button-container {
                    text-align: center;
                    margin-top: 20px;
                }

                img.logo {
                    width: 150px;
                    display: block;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <div class="main">
                <table align="center" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td align="center">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx Logo" class="logo" />
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <h2>Welcome to Indexx Exchange!</h2>
                            <p>Hi there,</p>
                            <p>Below are your login details:</p>
                            <p><strong>Email:</strong> ${toEmail}</p>
                            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                            <p>To get started, please use the login link below:</p>
                            <div class="button-container" style="text-align:center;margin-top:20px;">
                                <table border="0" cellspacing="0" cellpadding="0" align="center">
                                    <tr>
                                        <td align="center" bgcolor="#004DB3" style="border-radius:0;padding:0;">
                                            <a href="${loginUrl}" target="_blank" style="font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:20px;color:#FFFFFF;text-decoration:none;padding:12px 36px;display:inline-block;">Login Now</a>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <br />
                            <h3>Instructions to Change Your Password:</h3>
                            <ol>
                                <li>Login to Indexx Exchange using the details above.</li>
                                <li>After successfully logging in, navigate to the Exchange / Buy Crypto.</li>
                                <li>
                                    Hover your mouse over the email address on the top-right corner, click on
                                    <strong>Account & Settings</strong>, then go to the <strong>Security</strong> tab.
                                </li>
                                <li>Click on <strong>Change Password</strong> button.</li>
                                <li>Enter your old password, then input a new password to update it.</li>
                            </ol>
                            <p>If you have any questions or need further assistance, feel free to contact our support team at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.</p>
                            <p>Thank you for choosing Indexx Exchange!</p>
                            <p>The Indexx.ai Team</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="font-size:12px;color:#666;text-align:center;">
                            This is an automated message. Please do not reply.
                        </td>
                    </tr>
                </table>
                <table width="100%" style="margin-top:50px;padding:20px 0;">
                    <tbody>
                        <tr>
                            <td align="center" style="margin-bottom:20px;display:block">
                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                            </a>
                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                            </a>
                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                            </a>
                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                            </a>
                            </td>
                        </tr>
                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                            <td style="padding:20px 0;color: #221F1F;">
                                indexx.ai
                                <br /> 550 Newport Center Drive
                                <br />Newport Beach,
                                <br />CA 92660 United States
                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </body>

        </html>
        `,
            });
            console.log("send", send);
            return { status: 200, message: "Welcome email sent successfully" };
        } catch (err) {
            console.error("Error sending welcome email:", err);
            return { status: 500, message: "Welcome email not sent" };
        }
    }

    async sendWelcomeEmail2(
        toEmail: string,
        temporaryPassword: string,
        loginUrl: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your Email Address Has Been Updated - Welcome to Indexx Exchange!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>

            <head>
                <title>Your Email Address Has Been Updated!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main {
                        width: 600px;
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3;
                        color: white;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        border: none;
                        border-radius: 5px;
                    }

                    .button-container {
                        text-align: center;
                        margin-top: 20px;
                    }

                    img.logo {
                        width: 150px;
                        display: block;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <div class="main">
                    <table align="center" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx Logo" class="logo" />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <h2>Your Email Has Been Updated!</h2>
                                <p>Hi there,</p>
                                <p>We wanted to inform you that your email address on Indexx Exchange has been successfully updated.</p>
                                <p><strong>Previous Email:</strong> Lshore66@gmail.com</p>
                                <p><strong>New Email:</strong> shore.lauren@yahoo.com</p>
                                <p>For security reasons, your password has been temporarily reset.</p>
                                <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                                <p>Please log in using the button below and update your password as soon as possible.</p>
                                <div class="button-container" style="text-align:center;margin-top:20px;">
                                    <table border="0" cellspacing="0" cellpadding="0" align="center">
                                        <tr>
                                            <td align="center" bgcolor="#004DB3" style="border-radius:0;padding:0;">
                                                <a href="${loginUrl}" target="_blank" style="font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:20px;color:#FFFFFF;text-decoration:none;padding:12px 36px;display:inline-block;">Login Now</a>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                                <br />
                                <h3>Instructions to Change Your Password:</h3>
                                <ol>
                                    <li>Log in to Indexx Exchange using your new email and the temporary password above.</li>
                                    <li>Once logged in, go to the <strong>Account & Settings</strong> section.</li>
                                    <li>Navigate to the <strong>Security</strong> tab.</li>
                                    <li>Click on <strong>Change Password</strong> and set a new password of your choice.</li>
                                </ol>
                                <p>If you did not request this change, or if you have any questions, please contact our support team immediately at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.</p>
                                <p>Thank you for choosing Indexx Exchange!</p>
                                <p>The Indexx.ai Team</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="font-size:12px;color:#666;text-align:center;">
                                This is an automated message. Please do not reply.
                            </td>
                        </tr>
                    </table>
                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                        <tbody>
                            <tr>
                                <td align="center" style="margin-bottom:20px;display:block">
                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                    </a>
                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                    </a>
                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                    </a>
                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                    </a>
                                </td>
                            </tr>
                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                <td style="padding:20px 0;color: #221F1F;">
                                    indexx.ai
                                    <br /> 550 Newport Center Drive
                                    <br />Newport Beach,
                                    <br />CA 92660 United States
                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </body>

            </html>
            `,
            });

            console.log("Email sent successfully:", send);
            return { status: 200, message: "Welcome email sent successfully" };
        } catch (err) {
            console.error("Error sending welcome email:", err);
            return { status: 500, message: "Welcome email not sent" };
        }
    }

    async sendRefundEmailToUser(data: any) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your refund for ${data.tracking_number} is in progress`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${data.toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Your Refund for ${data.tracking_number
                    } Is In Progress</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                  body {
                      font-family: Arial, Helvetica, sans-serif;
                  }
                  .main#main {
                      width: 600px;
                      margin: auto;
                  }
                  @media only screen and (max-width: 600px) {
                      .main#main {
                          width: 96%;
                      }
                  }
              </style>
          </head>
          <body>
              <table align="center" border="0" cellspacing="0" class="main" id="main">
                  <tbody>
                      <tr>
                          <td align="center" valign="middle" style="padding:33px 0">
                              <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                              </a>
                          </td>
                      </tr>
                      <tr>
                          <td>
                              <div style="padding:0 30px;background:#fff">
                                  <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                      <tbody>
                                          <tr>
                                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                  Hi ${data.toEmail},
                                                  <br /><br />
                                                  Your refund for the product <strong>${data.giftcardType
                    }</strong> is currently being processed.
                                                  <br /><br />
                                                  <strong>Product:</strong> ${data.giftcardType
                    }
                                                  <br />
                                                  <strong>Tracking Number:</strong> ${data.tracking_number
                    }
                                                  <br />
                                                  <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                        "en-US",
                        {
                            style: "decimal",
                            minimumFractionDigits: 2,
                        }
                    ).format(data.amountInUsd)}
                                                  <br />
                                                  <strong>Payment Gateway:</strong> ${data.paymentGateway
                    }
                                                  <br /><br />
                                                  Please note that the refund process may take <strong>5-7 working days</strong> to complete. If you have any further questions, feel free to contact us at: 
                                                  <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="font-size:12px;color:#666;">
                                                  This is an automated message. Please do not reply.
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                                  <table width="100%" style="margin-top:50px;padding:20px 0;">
                                      <tbody>
                                          <tr>
                                              <td align="center">
                                                  <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                  </a>
                                                  <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                  </a>
                                              </td>
                                          </tr>
                                          <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br />
                                                    550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </body>
          </html>
        `,
            });
            return { status: 200, message: "Email sent to user successfully" };
        } catch (err) {
            console.error("Error sending email to user:", err);
            return { status: 500, message: "Email to user not sent" };
        }
    }

    async sendProfitTakenEmail(data: any) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Profit Taken from ${data.userEmail} in ${data.currencyRef}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${data.profitAccountEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Profit Taken from ${data.userEmail}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                  body {
                      font-family: Arial, Helvetica, sans-serif;
                  }
                  .main#main {
                      width: 600px;
                      margin: auto;
                  }
                  @media only screen and (max-width: 600px) {
                      .main#main {
                          width: 96%;
                      }
                  }
              </style>
          </head>
          <body>
              <table align="center" border="0" cellspacing="0" class="main" id="main">
                  <tbody>
                      <tr>
                          <td align="center" valign="middle" style="padding:33px 0">
                              <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                              </a>
                          </td>
                      </tr>
                      <tr>
                          <td>
                              <div style="padding:0 30px;background:#fff">
                                  <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                      <tbody>
                                          <tr>
                                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                  Hi,
                                                  <br /><br />
                                                  A profit has been taken from <strong>${data.userEmail
                    }</strong>.
                                                  <br /><br />
                                                  <strong>Currency:</strong> ${data.currencyRef
                    }
                                                  <br />
                                                  <strong>Profit in Crypto:</strong> ${data.profitToTakeInCrypto.toFixed(
                        8
                    )} ${data.currencyRef}
                                                  <br />
                                                  <strong>Profit in USD:</strong> $${data.profitToTakeInUsd.toFixed(
                        2
                    )}
                                                  <br />
                                                  <strong>Original Investment:</strong> $${data.originalInvestment.toFixed(
                        2
                    )}
                                                  <br />
                                                  <strong>Current Value:</strong> $${data.currentValue.toFixed(
                        2
                    )}
                                                  <br />
                                                  <strong>Transaction Date:</strong> ${data.txDate
                    }
                                                  <br /><br />
                                                  The profit has been transferred to: <strong>wallet@indexx.ai</strong>.
                                                  If you have any questions, feel free to reach out to us at: 
                                                  <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="font-size:12px;color:#666;">
                                                  This is an automated message. Please do not reply.
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                                  <table width="100%" style="margin-top:50px;padding:20px 0;">
                                      <tbody>
                                          <tr>
                                              <td align="center">
                                                  <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                  </a>
                                                  <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                  </a>
                                              </td>
                                          </tr>
                                          <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br />
                                                    550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </body>
          </html>
        `,
            });
            console.log("send", send);

            return { status: 200, message: "Profit email sent successfully" };
        } catch (err) {
            console.error("Error sending profit email:", err);
            return { status: 500, message: "Profit email not sent" };
        }
    }

    async sendAccountsOrderCreated(details: AccountsOrderEmail) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const toEmail = "accounts@azooca.com";
            const safe = (value: any) =>
                value === undefined || value === null || value === "" ? "-" : String(value);
            const fmtAmount = (value?: number) =>
                typeof value === "number"
                    ? value.toLocaleString("en-US", { maximumFractionDigits: 8 })
                    : "-";
            const createdAt = details.createdAt
                ? new Date(details.createdAt).toISOString()
                : "-";

            const bcc = DEFAULT_BCC_EMAILS.filter(
                (addr) => String(addr.email).toLowerCase() !== toEmail
            );

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `Order Created: ${safe(details.orderType)} ${safe(details.orderId)}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: toEmail }],
                // bcc: bcc.length ? bcc : undefined,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .label { color: #666; }
              </style>
            </head>
            <body>
              <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                  <tr>
                    <td align="center" valign="middle" style="padding:33px 0">
                      <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div style="padding:0 30px;background:#fff">
                        <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                <strong>New order created</strong>
                                <br /><br />
                                <span class="label">User:</span> ${safe(details.userEmail)}<br />
                                <span class="label">Order Id:</span> ${safe(details.orderId)}<br />
                                <span class="label">Order Type:</span> ${safe(details.orderType)}<br />
                                <span class="label">Status:</span> ${safe(details.status || "Quoted")}<br />
                                <span class="label">Payment Type:</span> ${safe(details.paymentType)}<br />
                                <span class="label">In Amount:</span> ${fmtAmount(details.inAmount)} ${safe(details.inCurrency)}<br />
                                <span class="label">Out Amount:</span> ${fmtAmount(details.outAmount)} ${safe(details.outCurrency)}<br />
                                <span class="label">Exchange:</span> ${safe(details.exchangeName)}<br />
                                <span class="label">Blockchain:</span> ${safe(details.blockchainName)}<br />
                                <span class="label">Created At:</span> ${createdAt}<br />
                                <span class="label">Notes:</span> ${safe(details.notes)}
                              </td>
                            </tr>
                            <tr>
                              <td style="font-size:12px;color:#666;">
                                This is an automated message. Please do not reply.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table width="100%" style="margin-top:50px;padding:20px 0;">
                          <tbody>
                            <tr>
                              <td align="center">
                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                </a>
                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                </a>
                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                </a>
                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                </a>
                              </td>
                            </tr>
                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                              <td style="padding:20px 0;color: #221F1F;">
                                indexx Limited, CUB Financial Centre
                                <br />GF6, Lyford Cay, Nassau, Bahamas.
                                <br /><br />550 Newport Center Drive
                                <br />Newport Beach, CA 92660 United States
                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </body>
          </html>
        `,
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("sendAccountsOrderCreated error:", err?.message || err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendAccountsOrderCompleted(details: AccountsOrderEmail) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            const toEmail = "accounts@azooca.com";
            const safe = (value: any) =>
                value === undefined || value === null || value === "" ? "-" : String(value);
            const fmtAmount = (value?: number) =>
                typeof value === "number"
                    ? value.toLocaleString("en-US", { maximumFractionDigits: 8 })
                    : "-";
            const completedAt = details.completedAt
                ? new Date(details.completedAt).toISOString()
                : "-";

            const bcc = DEFAULT_BCC_EMAILS.filter(
                (addr) => String(addr.email).toLowerCase() !== toEmail
            );

            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `Order Completed: ${safe(details.orderType)} ${safe(details.orderId)}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: toEmail }],
                // bcc: bcc.length ? bcc : undefined,
                htmlContent: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                .main#main { width: 600px; margin: auto; }
                @media only screen and (max-width: 600px) { .main#main { width: 96%; } }
                .label { color: #666; }
              </style>
            </head>
            <body>
              <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                  <tr>
                    <td align="center" valign="middle" style="padding:33px 0">
                      <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div style="padding:0 30px;background:#fff">
                        <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                          <tbody>
                            <tr>
                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                <strong>Order completed</strong>
                                <br /><br />
                                <span class="label">User:</span> ${safe(details.userEmail)}<br />
                                <span class="label">Order Id:</span> ${safe(details.orderId)}<br />
                                <span class="label">Order Type:</span> ${safe(details.orderType)}<br />
                                <span class="label">Status:</span> ${safe(details.status || "Completed")}<br />
                                <span class="label">Payment Type:</span> ${safe(details.paymentType)}<br />
                                <span class="label">In Amount:</span> ${fmtAmount(details.inAmount)} ${safe(details.inCurrency)}<br />
                                <span class="label">Out Amount:</span> ${fmtAmount(details.outAmount)} ${safe(details.outCurrency)}<br />
                                <span class="label">Exchange:</span> ${safe(details.exchangeName)}<br />
                                <span class="label">Blockchain:</span> ${safe(details.blockchainName)}<br />
                                <span class="label">Completed At:</span> ${completedAt}<br />
                                <span class="label">Notes:</span> ${safe(details.notes)}
                              </td>
                            </tr>
                            <tr>
                              <td style="font-size:12px;color:#666;">
                                This is an automated message. Please do not reply.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table width="100%" style="margin-top:50px;padding:20px 0;">
                          <tbody>
                            <tr>
                              <td align="center">
                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                </a>
                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                </a>
                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                </a>
                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                </a>
                              </td>
                            </tr>
                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                              <td style="padding:20px 0;color: #221F1F;">
                                indexx Limited, CUB Financial Centre
                                <br />GF6, Lyford Cay, Nassau, Bahamas.
                                <br /><br />550 Newport Center Drive
                                <br />Newport Beach, CA 92660 United States
                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </body>
          </html>
        `,
            });

            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("sendAccountsOrderCompleted error:", err?.message || err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendRefundEmailToAdmin(data: any) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Refund In Progress for ${data.tracking_number}!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${data.adminEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Refund In Progress for ${data.tracking_number}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }
                    .main#main {
                        width: 600px;
                        margin: auto;
                    }
                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Dear Admin,
                                                    <br /><br />
                                                    A refund for the product <strong>${data.giftcardType
                    }</strong> is currently in progress.
                                                    <br /><br />
                                                    <strong>Product:</strong> ${data.giftcardType
                    }
                                                    <br />
                                                    <strong>Tracking Number:</strong> ${data.tracking_number
                    }
                                                    <br />
                                                    <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                        "en-US",
                        {
                            style: "decimal",
                            minimumFractionDigits: 2,
                        }
                    ).format(data.amountInUsd)}
                                                    <br />
                                                    <strong>Payment Gateway:</strong> ${data.paymentGateway
                    }
                                                    <br />
                                                    <strong>User Email:</strong> ${data.toEmail
                    }
                                                    <br /><br />
                                                    Please note that the refund may take <strong>5-7 working days</strong> to complete. Kindly ensure that all necessary steps are followed to finalize this refund.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                      <tbody>
                                          <tr>
                                              <td align="center">
                                                  <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                  </a>
                                                  <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                  </a>
                                              </td>
                                          </tr>
                                          <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br />
                                                    550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                      </tbody>
                                  </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
          `,
            });
            return { status: 200, message: "Email sent to admin successfully" };
        } catch (err) {
            console.error("Error sending email to admin:", err);
            return { status: 500, message: "Email to admin not sent" };
        }
    }

    async sendMonthlyReportEmailWithZip(
        email: string,
        startDate: Date,
        endDate: Date,
        filePath: string
    ) {
        try {
            // Define the path for the zip file
            const zipFilePath = path.join(
                path.dirname(filePath),
                `${path.basename(filePath, ".pdf")}.zip`
            );

            // Create a file to stream archive data to.
            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver("zip", {
                zlib: { level: 9 }, // Sets the compression level.
            });

            // Listen for all archive data to be written.
            await new Promise<void>((resolve, reject) => {
                // Resolve once and with no args to match the event signature
                output.once("close", () => resolve());
                archive.on("error", reject);

                // Pipe archive data to the file.
                archive.pipe(output);

                // Append the PDF file to the archive.
                archive.file(filePath, { name: path.basename(filePath) });

                // Finalize the archive (i.e., we are done appending files but streams have to finish yet).
                archive.finalize();
            });

            // Read the ZIP file as a base64 string for attachment
            const zipFile = fs.readFileSync(zipFilePath, { encoding: "base64" });

            // Set up the Sendinblue API key
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            let send = await sendInMail.sendTransacEmail({
                subject: `Your Monthly Transaction Report - ${startDate.toLocaleString(
                    "en-US",
                    { month: "long", year: "numeric" }
                )}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Your Monthly Transaction Report</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
              body {
                  font-family: Arial, Helvetica, sans-serif;
              }
              .main {
                  width: 600px;
                  margin: auto;
              }
              @media only screen and (max-width: 600px) {
                  .main {
                  width: 96%;
                  }
              }
              </style>
          </head>
          <body>
              <table align="center" border="0" cellspacing="0" class="main">
              <tbody>
                  <tr>
                  <td align="center" valign="middle" style="padding:33px 0">
                      <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx.ai" width="150" />
                      </a>
                  </td>
                  </tr>
                  <tr>
                  <td style="padding:0 30px;background:#fff">
                      <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                      <tbody>
                          <tr>
                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                    Dear User,
                                    <br /><br />
                                    Please find attached your transaction report for the period from ${startDate.toLocaleString(
                    "en-US",
                    {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                    }
                )} to ${endDate.toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                })}.
                                    <br /><br />
                                    You can use this report to track your transaction history and inform your tax obligations. For any assistance, feel free to reach out to us at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                    <br /><br />
                                    Best regards,
                                    <br />
                                    The Indexx.ai Team
                                    <div class="custom-report-button">
                                        <a href="https://cex.indexx.ai/indexx-exchange/buy-sell/transaction-history" target="_blank" rel="noopener noreferrer">Generate Custom Report</a>
                                    </div>
                                </td>
                          </tr>
                      </tbody>
                      </table>
                      <table width="100%" style="margin-top:50px;padding:20px 0;">
                      <tbody>
                          <tr>
                          <td align="center" style="margin-bottom:20px;display:block">
                              <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                              </a>
                              <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                              </a>
                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                              </a>
                              <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                              <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                              </a>
                          </td>
                          </tr>
                          <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                          <td style="padding:20px 0;color: #221F1F;"> indexx.ai <br /> 550 Newport Center Drive <br />Newport Beach, <br />CA 92660 United States <br />
                              <br />Copyright © 2025 All Rights Reserved Indexx.ai
                          </td>
                          </tr>
                      </tbody>
                      </table>
                  </td>
                  </tr>
              </tbody>
              </table>
          </body>
          </html>
        `,
                params: { bodyMessage: "Monthly Transaction Report" },
                attachment: [
                    {
                        name: "Transaction_Report.zip", // Change the file name to indicate it's a zip file
                        content: zipFile, // Attach the compressed zip file
                    },
                ],
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendMonthlyReportEmail(
        email: string,
        startDate: Date,
        endDate: Date,
        filePath: string
    ) {
        try {
            // Read the PDF file as a base64 string for attachment
            const pdfFile = fs.readFileSync(filePath, { encoding: "base64" });

            // Set up the Sendinblue API key
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const options: Intl.DateTimeFormatOptions = {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
            };

            const formattedStartDate = new Intl.DateTimeFormat(
                "en-US",
                options
            ).format(startDate);
            const formattedEndDate = new Intl.DateTimeFormat("en-US", options).format(
                endDate
            );
            let send = await sendInMail.sendTransacEmail({
                subject: `Your Monthly Transaction Report - ${startDate.toLocaleString(
                    "en-US",
                    { month: "long", year: "numeric" }
                )}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Your Monthly Transaction Report</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main {
                        width: 96%;
                    }
                }

                .custom-report-button {
                    text-align: center;
                    margin-top: 20px;
                }

                .custom-report-button a {
                    background-color: black;
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    display: inline-block;
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx.ai" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px;background:#fff">
                            <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                <tbody>
                                    <tr>
                                        <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                            Dear User,
                                            <br /><br /> Please find attached your transaction report for the period from ${formattedStartDate} to ${formattedEndDate}.
                                            <br /><br /> You can use this report to track your transaction history and inform your tax obligations. For any assistance, feel free to reach out to us at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                            <br /><br /> Best regards,
                                            <br /> The Indexx.ai Team
                                            <div class="custom-report-button">
                                                <a href="https://cex.indexx.ai/indexx-exchange/buy-sell/transaction-history" target="_blank" rel="noopener noreferrer">Generate Custom Report</a>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                <tbody>
                                    <tr>
                                        <td align="center" style="margin-bottom:20px;display:block">
                                            <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                    </a>
                                            <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                    </a>
                                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                    </a>
                                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                    </a>
                                        </td>
                                    </tr>
                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                        <td style="padding:20px 0;color: #221F1F;"> indexx.ai <br /> 550 Newport Center Drive <br />Newport Beach, <br />CA 92660 United States <br />
                                            <br />Copyright © 2025 All Rights Reserved Indexx.ai
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>

        </html>
        `,
                params: { bodyMessage: "Monthly Transaction Report" },
                attachment: [
                    {
                        name: path.basename(filePath), // Name of the attached PDF file
                        content: pdfFile, // Attach the PDF file directly
                    },
                ],
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendWeeklyReportEmail(
        email: string,
        startDate: Date,
        endDate: Date,
        filePath: string
    ) {
        try {
            // Read the PDF file as a base64 string for attachment
            const pdfFile = fs.readFileSync(filePath, { encoding: "base64" });

            // Set up the Sendinblue API key
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const options: Intl.DateTimeFormatOptions = {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
            };

            const formattedStartDate = new Intl.DateTimeFormat(
                "en-US",
                options
            ).format(startDate);
            const formattedEndDate = new Intl.DateTimeFormat("en-US", options).format(
                endDate
            );
            let send = await sendInMail.sendTransacEmail({
                subject: `${email} Weekly Transaction Report - ${startDate.toLocaleString(
                    "en-US",
                    { month: "long", year: "numeric" }
                )}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `marketing@indexx.ai` }],
                bcc: [...DEFAULT_BCC_EMAILS, { email: "omkar@indexx.ai" }],
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>Your Weekly Transaction Report</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main {
                    width: 600px;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main {
                        width: 96%;
                    }
                }

                .custom-report-button {
                    text-align: center;
                    margin-top: 20px;
                }

                .custom-report-button a {
                    background-color: black;
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    display: inline-block;
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="Indexx.ai" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px;background:#fff">
                            <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                <tbody>
                                    <tr>
                                        <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                            Dear User,
                                            <br /><br /> Please find attached your transaction report for the period from ${formattedStartDate} to ${formattedEndDate}.
                                            <br /><br /> You can use this report to track your transaction history and inform your tax obligations. For any assistance, feel free to reach out to us at <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                            <br /><br /> Best regards,
                                            <br /> The Indexx.ai Team
                                            <div class="custom-report-button">
                                                <a href="https://cex.indexx.ai/indexx-exchange/buy-sell/transaction-history" target="_blank" rel="noopener noreferrer">Generate Custom Report</a>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                <tbody>
                                    <tr>
                                        <td align="center" style="margin-bottom:20px;display:block">
                                            <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                    </a>
                                            <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                    </a>
                                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                    </a>
                                            <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                    </a>
                                        </td>
                                    </tr>
                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                        <td style="padding:20px 0;color: #221F1F;"> indexx.ai <br /> 550 Newport Center Drive <br />Newport Beach, <br />CA 92660 United States <br />
                                            <br />Copyright © 2025 All Rights Reserved Indexx.ai
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>

        </html>
        `,
                params: { bodyMessage: "Weekly Transaction Report" },
                attachment: [
                    {
                        name: path.basename(filePath), // Name of the attached PDF file
                        content: pdfFile, // Attach the PDF file directly
                    },
                ],
            });

            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }
    async sendCaptainBeeRequestNotificationToAdmin(
        captainBeeName: string,
        captainBeeEmail: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `New Captain Bee Request Received from ${captainBeeName}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `wallet@indexx.ai` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>New Captain Bee Request Received</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }
                    .main#main {
                        width: 600px;
                        margin: auto;
                    }
                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hello Admin,
                                                    <br /><br />
                                                    A new Captain Bee request has been received from ${captainBeeName} (${captainBeeEmail}).
                                                    <br /><br />
                                                    Please review the request and take the necessary actions.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br />
                                                    550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
            `,
                params: { bodyMessage: "New Captain Bee Request Notification" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendCaptainBeeRequestStatusNotification(
        toEmail: string,
        userName: string,
        status: string,
        reason: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `Your Captain Bee Request has been ${status}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Your Captain Bee Request has been ${status}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                  body {
                      font-family: Arial, Helvetica, sans-serif;
                  }
                  .main#main {
                      width: 600px;
                      margin: auto;
                  }
                  @media only screen and (max-width: 600px) {
                      .main#main {
                          width: 96%;
                      }
                  }
              </style>
          </head>
          <body>
              <table align="center" border="0" cellspacing="0" class="main" id="main">
                  <tbody>
                      <tr>
                          <td align="center" valign="middle" style="padding:33px 0">
                              <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                              </a>
                          </td>
                      </tr>
                      <tr>
                          <td>
                              <div style="padding:0 30px;background:#fff">
                                  <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                      <tbody>
                                          <tr>
                                              <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                  Hi ${userName},
                                                  <br /><br />
                                                  Your Captain Bee request has been <strong>${status}</strong>.
                                                  <br /><br />
                                                  ${status === "rejected"
                        ? `<strong>Reason:</strong> ${reason}<br /><br />Please contact support for further details.`
                        : `Congratulations! You are now a Captain Bee.`
                    }
                                                  <br /><br />
                                                  Regards,
                                                  <br />
                                                  Indexx.ai Team
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="font-size:12px;color:#666;">
                                                  This is an automated message. Please do not reply.
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                                  <table width="100%" style="margin-top:50px;padding:20px 0;">
                                      <tbody>
                                          <tr>
                                              <td align="center" style="margin-bottom:20px;display:block">
                                                  <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                  </a>
                                                  <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                  </a>
                                                  <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                      <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                  </a>
                                              </td>
                                          </tr>
                                          <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                              <td style="padding:20px 0;color: #221F1F;">
                                                  indexx.ai
                                                  <br />
                                                  550 Newport Center Drive
                                                  <br />Newport Beach,
                                                  <br />CA 92660 United States
                                                  <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                              </td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </body>
          </html>
          `,
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendGiftCardNotificationBrian(
        email: string,
        toEmail: string,
        giftcardType: string,
        giftToken: string,
        giftTokenAmount: number,
        redeemCode: string,
        amountInUsd: number
    ) {
        const senderName = "Brian Zheng";
        const messageFromSender = `Thank you for participating in the recent Pickleball Tournament, proudly sponsored by Indexx.ai, a leading cryptocurrency platform. We appreciate your enthusiasm and sportsmanship at the event.
  
  As a token of our appreciation, I am excited to offer you an exclusive crypto gift card, personally sent from me. You can claim your gift on our exchange by following the instructions below.
  
  We look forward to your continued engagement with <a href="https://indexx.ai" target="_blank" rel="noopener noreferrer">Indexx.ai</a>.`;
        const imageUrl =
            "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/New+GC/New+GC/-gc2.png";

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `You've Received a ${giftcardType} from ${senderName}!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                cc: [{ email: "bz@indexx.ai" }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <title>You've Received a ${giftcardType} from ${senderName}!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }
                    .main#main {
                        width: 600px;
                        margin: auto;
                    }
                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>
            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    Hi there,
                                                    <br /><br />
                                                    You have been sent a ${giftcardType} from ${senderName}! 🎉
                                                    <br /><br />
                                                     ${imageUrl
                        ? `<img src="${imageUrl}" alt="Gift Card Image" style="max-width: 100%; height: auto;" />`
                        : ""
                    }
                                                    <br /><br />
                                                    Here are the details of your gift:
                                                    <br />
                                                    <strong>Gift Card Type:</strong> ${giftcardType}
                                                    <br />
                                                    <strong>Amount in USD:</strong> $${new Intl.NumberFormat(
                        "en-US",
                        {
                            style: "decimal",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                        }
                    ).format(amountInUsd)}
                                                    <br />
                                                    <strong>Token Amount:</strong> ${giftTokenAmount} ${giftToken}
                                                    <br /><br />
                                                    Message from ${senderName}: ${messageFromSender}
                                                    <br /><br />
                                                    To redeem your gift card, please follow these instructions:
                                                   <br />
                                                    <strong>1. Sign Up or Login:</strong> If you don't have an account with Indexx, <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=exchange" target="_blank" rel="noopener noreferrer">Sign Up</a> and create your account. If you are already signed up, <a href="https://indexx.ai/auth/login?redirectWebsiteLink=exchange" target="_blank" rel="noopener noreferrer">Log In</a>.
                                                    <br />
                                                    <strong>2. Redeem Your Code:</strong> Click on this link to redeem your gift card: <a href="https://cex.indexx.ai/redeem" target="_blank" rel="noopener noreferrer">Redeem Link</a>.
                                                    <br />
                                                    <strong>3. Paste Your Code:</strong> Copy and paste the Redeem Code below into the Redeem Code Box, then click on 'redeem'.
                                                    <br /><br />
                                                    <strong>Redeem Code:</strong> <b> ${redeemCode}</b>
                                                    <br /><br />
                                                    Enjoy Your Gift! Congratulations, you are now a cryptocurrency owner. Have fun with it!
                                                    <br /><br />
                                                    If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br />
                                                    550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
            `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendGiftCardNotificationBrian2(
        email: string,
        toEmail: string,
        giftcardType: string,
        giftToken: string,
        giftTokenAmount: number,
        redeemCode: string,
        amountInUsd: number
    ) {
        const senderName = "Brian Zheng";
        const messageFromSender = `
      Dear Future Investors,
      <br /><br />
      On behalf of Indexx.ai, we sincerely appreciate your participation in our recent crypto seminar. Your presence and engagement made the event a great success, and we are grateful for the time and resources you invested to join us. At Indexx.ai, we are dedicated to equipping individuals with the knowledge and tools needed to navigate the evolving world of cryptocurrency and financial technologies.
      <br /><br />
      As promised, we have attached a gift card worth $100 of INEX to this email. Please follow the instructions below to redeem the gift card on your Indexx exchange now!
      <br /><br />
      Thank you again for attending, and we look forward to supporting your crypto journey in the future.
    `;

        const imageUrl1 =
            "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/seminar_pic_1.jpeg";
        const imageUrl2 =
            "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/New+GC/New+GC/-gc2.png";

        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `You've Received a $${amountInUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })} ${giftcardType} from ${senderName}!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                cc: [{ email: "bz@indexx.ai" }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>

        <head>
            <title>You've Received a $${amountInUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })} ${giftcardType} from ${senderName}!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }

                .main#main {
                    margin: auto;
                }

                .button {
                    background-color: #004DB3 !important;
                    color: white !important;
                    padding: 10px 20px;
                    text-align: center;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                    margin: 4px 2px;
                    cursor: pointer;
                    width: 180px;
                    border: none;
                    border-radius: 0;
                }

                .button-container {
                    text-align: center;
                    margin-top: 20px;
                }

                .signature {
                    font-size: 16px;
                    color: #666;
                    margin-top: 30px;
                }

                img.seminar-image {
                    width: 75%;
                    height: auto;
                    display: block;
                    margin: auto;
                }

                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
            </style>
        </head>

        <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/seminar_pic_1.jpeg" alt="Seminar Image" class="seminar-image" />
                                                <br /><br /> ${messageFromSender}
                                                <br /><br /> Here are the details of your gift card:
                                                <br />
                                                <strong>Gift Card Type:</strong> ${giftcardType}
                                                <br />
                                                <strong>Amount in USD:</strong> $${amountInUsd.toLocaleString(
                    undefined,
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                )}
                                                <br />
                                                <strong>Token Amount:</strong> ${giftTokenAmount} ${giftToken}
                                                <br /><br />
                                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/New+GC/New+GC/-gc2.png" alt="Gift Card Image" style="max-width: 75%; height: auto;  display: block;
                    margin: auto;" /> To redeem your gift card, please follow these instructions:
                                                <br /><br />
                                                <strong>1. Sign Up or Login:</strong>
                                                <br /> If you don't have an account with Indexx,
                                                <div class="button-container">
                                                    <a href="https://indexx.ai/auth/signup-email?redirectWebsiteLink=exchange" target="_blank" class="button">Sign Up</a>
                                                    <a href="https://indexx.ai/auth/login?redirectWebsiteLink=exchange" target="_blank" class="button">Login</a>
                                                </div>
                                                <br /><br />
                                                <strong>2. Redeem Your Code:</strong>
                                                <br />
                                                <div class="button-container">
                                                    <a href="https://cex.indexx.ai/redeem" target="_blank" class="button">Redeem Gift</a>
                                                </div>
                                                <br /><br />
                                                <strong>3. Paste Your Code:</strong>
                                                <br /> Copy and paste the Redeem Code below into the Redeem Code Box, then click on 'redeem'.
                                                <br /><br />
                                                <strong>Redeem Code:</strong> <b> ${redeemCode}</b>
                                                <br /><br />
                                                <strong>4. Congratulations on starting your journey with cryptocurrency.</strong> We hope you grow and prosper with Indexx.ai. If you need any assistance, feel free to contact our official support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                <br /><br />
                                                <!-- Signature -->
                                                <div class="signature">
                                                    Best regards,<br />
                                                    <strong>Brian Zheng</strong><br /> CEO, Indexx.ai
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                                <br />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br /> 550 Newport Center Drive
                                                <br />Newport Beach,
                                                <br />CA 92660 United States
                                                <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>

        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendLaunchEmail(toEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: `🎉 Introducing Indexx Shop! Get $50 FREE with Your First Purchase Today on Indexx Shop!`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${toEmail}` }],
                cc: [{ email: "bz@indexx.ai" }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
           <!DOCTYPE html>
            <html>

            <head>
                <title>Indexx.ai Launches New Product - Indexx Shop!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                    }

                    .main#main {
                        margin: auto;
                    }

                    .button {
                        background-color: #004DB3 !important;
                        color: white !important;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        width: 180px;
                        border: none;
                        border-radius: 0;
                    }

                    .button-container {
                        text-align: center;
                        margin-top: 20px;
                    }

                    .signature {
                        font-size: 16px;
                        color: #666;
                        margin-top: 30px;
                    }

                    img.product-image {
                        width: 75%;
                        height: auto;
                        display: block;
                        margin: auto;
                    }

                    @media only screen and (max-width: 600px) {
                        .main#main {
                            width: 96%;
                        }
                    }
                </style>
            </head>

            <body>
                <table align="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">
                                <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Shop+Banner.jpeg" alt="Product Image" class="product-image" />
                                                    <br /><br />Dear Valued Customer,
                                                    <br /><br /> We are excited to announce the launch of our brand new product: <strong>Indexx Shop</strong>! 🎉
                                                    <br /><br /> Indexx Shop offers a wide variety of cards, including gift, crypto, greeting, birthday and seasonal cards, perfect for any occasion.
                                                    <br /><br /> As part of this launch, we have an exclusive offer for you:
                                                    <br /><br />
                                                    <strong>Get $50 FREE when you buy a Crypto Gift Card today!</strong>
                                                    <br /><br /> Explore our new shop now and take advantage of this limited-time offer.
                                                    <br /><br />
                                                    <div class="button-container">
                                                        <a href="https://shop.indexx.ai" target="_blank" class="button">Visit Indexx Shop</a>
                                                    </div>
                                                    <br /><br /> Thank you for being part of the Indexx community. We are excited for you to explore our latest offerings and enjoy this special promotion!
                                                    <br /><br /> If you need any assistance, feel free to contact our support team at: <a href="mailto:accounts@indexx.ai">accounts@indexx.ai</a>.
                                                    <br /><br />
                                                    <!-- Signature -->
                                                    <div class="signature">
                                                        Best regards,<br />
                                                        <strong>Brian Zheng</strong><br /> CEO, Indexx.ai
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:12px;color:#666;">
                                                    This is an automated message. Please do not reply.
                                                    <br />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                            <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                    <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                    </a>
                                                    <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                    </a>
                                                    <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                        <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                    </a>
                                                </td>
                                            </tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                                <td style="padding:20px 0;color: #221F1F;">
                                                    indexx.ai
                                                    <br /> 550 Newport Center Drive
                                                    <br />Newport Beach,
                                                    <br />CA 92660 United States
                                                    <br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>

            </html>                                                                                                                      
          `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendFiatWithdrawCompletedNotification(
        email: string,
        beneficiaryName: string,
        accountNumber: string,
        routingNumber: string,
        bankName: string,
        swiftCode: string,
        addressLine1: string,
        city: string,
        state: string,
        country: string,
        zipCode: string,
        amount: string,
        currency: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Withdraw Creation Details",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
        
        <head>
            <title>Fiat USD Withdrawal Completed Notification</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                }
        
                .main#main {
                    width: 600px;
                    margin: auto;
                }
        
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
        
            </style>
        </head>
        
        <body>
        
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px 30px;" cellspacing="0"
                                        cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">We've completed your request to withdraw USD. Below are the details for the withdrawal:
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="color: #5f5f5f;">
                                                Beneficiary Name: <b>${beneficiaryName}</b><br/>
                                                Amount: <b>${amount}  ${currency}</b><br/>
                                                Account Number: <b>${accountNumber}</b><br/>
                                                Bank Name: <b>${bankName}</b><br/>
                                                Routing Number: <b>${routingNumber}</b><br/>
                                                SWIFT Code: <b>${swiftCode}</b><br/>
                                                Address Line 1: <b>${addressLine1}</b><br/>
                                                City: <b>${city}</b><br/>
                                                State: <b>${state}</b><br/>
                                                Country: <b>${country}</b><br/>
                                                Zip Code: <b>${zipCode}</b><br/>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">Please note that your withdrawal has now completed to above provided details. 
                                                    Please email to wallet@indexx.ai for any queries
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message. Please do not reply.
                                                <br />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter" />
                                                </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;" />
                                                </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">
                                                    <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook" />
                                                </a>
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                                            <td style="padding:20px 0;color: #221F1F;">
                                                indexx.ai
                                                <br />
                                                <br />
                                                <br /><br />550 Newport Center Drive
                                                <br />
                                                <br />Newport Beach,
                                                <br />
                                                <br />CA 92660 United State
                                                <br /><br /><br />Copyright © 2025 All Rights Reserved Indexx.ai
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
        
                </tbody>
            </table>
        
        </body>
        
        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendFiatWithdrawNotificationToAdmin(
        email: string,
        beneficiaryName: string,
        accountNumber: string,
        routingNumber: string,
        bankName: string,
        swiftCode: string,
        addressLine1: string,
        city: string,
        state: string,
        country: string,
        zipCode: string,
        amount: string,
        currency: string
    ) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Withdraw Process Request",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
            <head>
            <title>Start Withdrawal Process</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
            body {
                font-family: Arial, Helvetica, sans-serif;
            }

            .main#main {
                width: 600px;
                margin: auto;
            }

            @media only screen and (max-width: 600px) {
                .main#main {
                    width: 96%;
                }
            }
            </style>
            </head>

            <body>

            <table align="center" border="0" cellspacing="0" class="main" id="main">
            <tbody>
                <tr>
                    <td align="center" valign="middle" style="padding:33px 0">
                        <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                            <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                        </a>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div style="padding:0 30px;background:#fff">
                            <table width="100%" style="border:1px solid
                                    #f0f0f0;border-radius:5px;
                                    padding: 0 30px 30px;" cellspacing="0"
                                    cellpadding="0">
                                <tbody>
                                    <tr>
                                        <td style="font-size:17px;line-height:30px;padding:20px
                                                0;color:#666">Dear Admin, <br/>

                                            A new withdrawal request has been received. Please initiate the withdrawal process as soon as possible.
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #5f5f5f;">
                                            User email: <b>${email}</b><br/>
                                            Amount: <b>${amount}  ${currency}</b><br/>
                                            Beneficiary Name: <b>${beneficiaryName}</b><br/>
                                            Account Number: <b>${accountNumber}</b><br/>
                                            Routing Number: <b>${routingNumber}</b><br/>
                                            Bank Name: <b>${bankName}</b><br/>
                                            SWIFT Code: <b>${swiftCode}</b><br/>
                                            Address Line 1: <b>${addressLine1}</b><br/>
                                            City: <b>${city}</b><br/>
                                            State: <b>${state}</b><br/>
                                            Country: <b>${country}</b><br/>
                                            Zip Code: <b>${zipCode}</b><br/>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="font-size:12px;color:#666;">
                                            This is an automated message. Please take prompt action withdrawal request need to processed within 2-5 business days.
                                            <br />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            </tbody>
            </table>

            </body>

            </html>
        `,
                // htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for ordering on Indexx Exchange. Please find below your order details.<br>
                //         Order Amount: ${orderAmount} ${orderCurrency}<br>
                //         Order Status: ${OrderStatus.Completed} <br>
                //         Order Type: ${orderType} <br> <br>
                //         Thanks, <br>
                //         Indexx Exchange Team
                //         </h1></body></html>`,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            return { status: 500, message: "Email not sent" };
        }
    }

    async sendCourseAttachmentToUser(
        userEmail: string,
        customerName: string,
        packName: string,
        tokens: number
    ) {
        try {
            const powerPackPrices: any = {
                "Starter Pack": "$300",
                "Excel Pack": "$500",
                "Pro Pack": "$700",
                "Captain Pack": "$1,500",
                "Copper Pack": "$3,500",
                "Gold Pack": "$5,500",
                "Platinum Pack": "$9,000",
                "Royal Pack": "$15,000",
            };

            const allProductFeatures = [
                {
                    name: "Starter Pack",
                    features: ["Crypto Beginner Ebooks"],
                },
                {
                    name: "Excel Pack",
                    features: ["Crypto Beginner Ebooks", "Crypto Advanced Ebooks"],
                },
                {
                    name: "Pro Pack",
                    features: [
                        "Crypto Beginner Ebook",
                        "Crypto Advanced Ebook",
                        "Stocks Beginner Ebook",
                        "Educational Crypto Courses (Exclusive to Indexx Academy)",
                    ],
                },
                {
                    name: "Captain Pack",
                    features: [
                        "Indexx Hive Academy Level-1",
                        "Crypto Beginner Ebooks",
                        "Crypto Advanced Ebooks",
                        "Educational Crypto Courses (Exclusive to Indexx Academy)",
                        "Private Hive Walkthrough",
                    ],
                },
                {
                    name: "Copper Pack",
                    features: [
                        "Indexx Hive Academy Level-2",
                        "Crypto Beginner Ebooks",
                        "Crypto Advanced Ebooks",
                        "Educational Crypto Course",
                        "Indexx Exchange Course",
                        "Indexx Swap Course (Exclusive to Indexx Academy)",
                        "Private Hive Walkthrough",
                        "Discount on Indexx Shop Product",
                    ],
                },
                {
                    name: "Gold Pack",
                    features: [
                        "Indexx Hive Academy Level-3",
                        "Crypto Beginner Ebooks",
                        "Crypto Advanced Ebooks",
                        "Educational Crypto Course",
                        "Indexx Exchange Course",
                        "Indexx Swap Course (Exclusive to Indexx Academy)",
                        "Private Hive Walkthrough",
                        "Private Coaching and Guidance",
                        "Discount on Indexx Shop Products",
                    ],
                },
                {
                    name: "Platinum Pack",
                    features: [
                        "Indexx Hive Academy Level-4",
                        "Crypto Beginner Ebooks",
                        "Crypto Advanced Ebooks",
                        "Educational Crypto Course",
                        "Indexx Exchange Course",
                        "Indexx Swap Course (Exclusive to Indexx Academy)",
                        "Private Hive Walkthrough",
                        "Private Coaching and Guidance",
                        "Discount on Indexx Shop Products",
                        "Free XNFT Gifts",
                        "Premium Support (1 on 1)",
                        "MLM %Commission",
                    ],
                },
                {
                    name: "Royal Pack",
                    features: [
                        "Indexx Hive Academy Level-5",
                        "Crypto Beginner Ebooks",
                        "Crypto Advanced Ebooks",
                        "Educational Crypto Course",
                        "Indexx Exchange Course",
                        "Indexx Swap Course (Exclusive to Indexx Academy)",
                        "Private Hive Walkthrough",
                        "Private Coaching and Guidance",
                        "Discount on Indexx Shop Products",
                        "Free XNFT Gifts",
                        "Premium Support (1 on 1)",
                        "MLM %Commission",
                    ],
                },
            ];

            const powerPackDetails: any = {
                "Royal Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Black+Pack/Ultimate+Guide+for+Black.pdf",
                        name: "Ultimate Guide for Black.pdf",
                    },
                ],
                "Captain Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Captain+Pack/Ultimate+Guide+for+Captain.pdf",
                        name: "Ultimate Guide for Captain.pdf",
                    },
                ],
                "Copper Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Copper+Pack/Ultimate+Guide+for+Copper.pdf",
                        name: "Ultimate Guide for Copper.pdf",
                    },
                ],
                "Excel Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Excel+Pack/Ultimate+Guide+for+Excel.pdf",
                        name: "Ultimate Guide for Excel.pdf",
                    },
                ],
                "Gold Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Gold+Pack/Ultimate+Guide+for+Gold.pdf",
                        name: "Ultimate Guide for Gold.pdf",
                    },
                ],
                "Platinum Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Platinum+Pack/Ultimate+Guide+for+Platinum.pdf",
                        name: "Ultimate Guide for Platinum.pdf",
                    },
                ],
                "Pro Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Pro+Pack/Ultimate+Guide+for+Pro.pdf",
                        name: "Ultimate Guide for Pro.pdf",
                    },
                ],
                "Starter Pack": [
                    {
                        url: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/PowerPacks_New/Starter+Pack/Ultimate+Guide+for+Starter.pdf",
                        name: "Ultimate Guide for Starter.pdf",
                    },
                ],
            };

            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            const fetchAttachment = async (url: any) => {
                const response = await axios.get(url.url, {
                    responseType: "arraybuffer",
                });
                return {
                    content: Buffer.from(response.data, "binary").toString("base64"),
                    name: path.basename(new URL(url.url).pathname),
                };
            };

            const attachments = await Promise.all(
                powerPackDetails[packName].map((url: any) => fetchAttachment(url))
            );

            const price = powerPackPrices[packName];
            const featueres = allProductFeatures.find(
                (x) => x.name === packName
            ) as any;
            console.log("features", featueres);
            const emailContent = `
        <!DOCTYPE html>
        <html>
            <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

            <style>
            body {
                font-family: Arial, Helvetica, sans-serif;
            }

            .main#main {
                width: 600px;
                margin: auto;
            }

            @media only screen and (max-width: 600px) {
                .main#main {
                    width: 96%;
                }
            }
            </style>
            </head>

            <body>
            <table align="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">
                                <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150" />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid #f0f0f0;border-radius:5px;padding: 0 30px 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="font-size:17px;line-height:30px;padding:20px 0;color:#666">
                                                Dear ${customerName},
                                                <br/>
                                                <br/>
                                                We are thrilled to welcome you to the IndexxEcosystem family! Thank you for choosing Indexx.ai and for your recent purchase of the ${packName} for ${price}.
                                                <br/>
                                                <br/>
                                                Your journey with Indexx.ai is about to get even more exciting, and we can't wait to guide you through the world of possibilities that our Power Packs offer. Get ready to unlock incredible features and benefits designed to empower your cryptocurrency and investment experience.
                                                <br/>
                                                <br/>
        
                                                Here's a quick overview of what your ${packName} includes the following features:
                                                <br/>
                                                ${featueres.features
                    .map(
                        (feature: any) =>
                            `<li>${feature}</li>`
                    )
                    .join("")}
                                                <br>
                                                  
                                                But that's not all! In addition to these fantastic features, you'll also receive a bonus of ${tokens} INEX matched with your purchase:
                                                <br/>
                                                ${tokens} INEX x $2 each
                                                <br/>
                                                <br/>
        
                                                Please note that this exclusive offer is available from October 1st to December 31st, 2023, so make the most of it during this limited time.
                                                <br/>
                                                <br/>
                                                We're here to support you every step of the way. If you have any questions or need assistance, feel free to reach out to our dedicated support team.
                                                <br/>
                                                <br/>
                                                Once again, congratulations on joining Indexx.ai and taking the first step toward achieving your financial goals. We look forward to being part of your success story!
                                                <br/><br/>
                                                Best regards,
                                                <br/>
                                                The Indexx.ai Team
                                                <br/><br/>
                                                P.S. Don't forget to explore the Indexx Academy for exclusive educational content and resources to boost your cryptocurrency and investment knowledge.
                                                <br /><br />
                                                <a href="https://cex.indexx.ai/indexx-exchange/buy-sell/hive-login" style="color: #007bff; text-decoration: none; font-weight: bold;">Explore Indexx Exchange</a><br />
                                                <a href="https://academy.indexx.ai/authentication/" style="color: #007bff; text-decoration: none; font-weight: bold;">Explore Indexx Academy</a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size:12px;color:#666;">
                                                This is an automated message.
                                                <br />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        

            </html>
      `;

            let send = await sendInMail.sendTransacEmail({
                subject: "Congratulations on Your Indexx.ai Power Pack Purchase!",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: userEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: emailContent,
                attachment: attachments,
            });

            console.log("Email sent: ", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err) {
            console.error("Error sending email:", err);
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.BREVO_API_KEY;

            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();

            try {
                await sendInMail.sendTransacEmail({
                    subject: "Error Sending Email via SES",
                    sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                    replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                    to: [{ email: "omkar@indexx.ai" }],
                    htmlContent: `<p>Dear User,</p><p>We faced an issue while sending you an email via our primary service. 
              "USEREMAIL":${userEmail}
              "CUSTOMER NAME":${customerName}
              "PACKAGE NAME":${packName}
              "TOKENS": ${tokens}
            We are looking into it and will get back to you soon.</p><p>Regards,<br>Indexx.ai Team</p>`,
                });
            } catch (sibError) {
                console.error("Error sending email via SendinBlue:", sibError);
            }

            return { status: 500, message: "Email not sent" };
        }
    }

    async getPermissionsFromHoneyBee(
        captainEmail: string,
        captainName: string,
        honeyBeeEmail: string,
        honeyBeeName: string,
        requestType: string
    ) {
        console.log(
            captainEmail,
            captainName,
            honeyBeeEmail,
            honeyBeeName,
            requestType
        );
        if (!captainName && captainEmail) {
            captainName = captainEmail.split("@")[0];
        }

        if (!honeyBeeName && honeyBeeEmail) {
            honeyBeeName = honeyBeeEmail.split("@")[0];
        }

        console.log(
            "after",
            captainEmail,
            captainName,
            honeyBeeEmail,
            honeyBeeName,
            requestType
        );
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Exchange Get Permissions from Honey Bee",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                to: [{ email: `${honeyBeeEmail}` }],
                cc: [{ email: `${captainEmail}` }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent: `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Page Title</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

        <style>
            body{
                font-family: Arial, Helvetica, sans-serif;
            }
        .main#main {
        width:600px;
        margin:auto;
        }

        @media only screen and (max-width: 600px) {
        .main#main {
        width:96%;
        }
        }
        </style>
    </head>
    <body>

        <table  slign="center" border="0" cellspacing="0" class="main" id="main">
            <tbody>
                <tr>
                    <td align="center" valign="middle" style="padding:33px 0">                    
                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                            </td>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div style="padding:0 30px;background:#fff">
                            <table width="100%" style="border:1px solid
                                #f0f0f0;border-radius:5px;
                                padding: 0 30px 30px;" cellspacing="0"
                                cellpadding="0">
                                <tbody>
                                    <tr>
                                        <td style="font-size:17px;line-height:30px;padding:20px
                                            0;color:#666">
                                            Dear Honey Bee ${honeyBeeName}, <br>
                                            I ${captainName} as your captain bee would like to get permission to <b>${requestType}</b> orders on your account. Below are the details of your request:<br>
                                        </td>                                        
                                    </tr>
                                    <tr>
                                    <td style="font-size:17px;line-height:30px;padding:20px
                                    0;color:#666">
                                        Request Type: <b style="padding:5px;font-size:17px;font-weight:bolder;color:#F66036">${requestType}</b><br/>
                                        Captain Bee: <b style="padding:5px;font-size:17px;font-weight:bolder;color:#F66036">${captainName}</b><br/>
                                        Please go to your dashboard on indexx exchange and approve the above request.
                                    </td>
                                    </tr>
                                    <br/>
                                    <br/>
                                    <tr>
                                        <td style="font-size:12px;color:#666;">This is an automated message. Please do not reply.
                                        <br/>
                                    </td>
                                    </tr>
                                </tbody>
                                </table>
                                    <table width="100%" style="margin-top:50px;padding:20px 0;">
                                        <tbody>
                                        <tr>
                                        <td align="center" style="margin-bottom:20px;display:block">
                                        <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                        <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/ > </a>
                                        <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                        <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                    </td></tr>
                                            <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                   
                            
                                                <td style="padding:20px 0;color: #221F1F;
">indexx.ai
                                                   <br/>
                                                   <br/>
                                                    <br/><br/>550 Newport Center Drive
                                                   <br/>
                                                    <br/>Newport Beach,
                                                   <br/>
                                                    <br/>CA 92660 United State
                                                   <br/><br/><br/>Copyright © 2025 All Rights Reserved Indexx.ai
                                               </td>
                                         
                               </tr>
                                        </tbody>
                                    </table>
                        </div>
                    </td>
                </tr>
               
                </tbody>
            </table>

        </body>
    </html>`,
                // htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for ordering on Indexx Exchange. Please find below your order details.<br>
                //         Order Amount: ${orderAmount} ${orderCurrency}<br>
                //         Order Status: ${OrderStatus.Completed} <br>
                //         Order Type: ${orderType} <br> <br>
                //         Thanks, <br>
                //         Indexx Exchange Team
                //         </h1></body></html>`,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }

    async sendWithdrawalRequestNotification(params: {
        userEmail: string;
        coin: string;
        amount: number;
        address: string;
        chain?: string;
        statusCode: number;
        responseBody: any;
    }) {
        try {
            const { userEmail, coin, amount, address, chain, statusCode, responseBody } = params;
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const htmlContent = `
                <html>
                  <body>
                    <h3>Withdrawal Request Activity</h3>
                    <p><strong>User:</strong> ${userEmail}</p>
                    <p><strong>Coin:</strong> ${coin}</p>
                    <p><strong>Amount:</strong> ${amount}</p>
                    <p><strong>Address:</strong> ${address}</p>
                    <p><strong>Chain:</strong> ${chain || "N/A"}</p>
                    <p><strong>Status Code:</strong> ${statusCode}</p>
                    <pre style="background:#f4f4f4;padding:8px;border-radius:4px;">${JSON.stringify(
                responseBody,
                null,
                2
            )}</pre>
                  </body>
                </html>`;
            await sendInMail.sendTransacEmail({
                subject: `[Indexx] Withdrawal request status ${statusCode}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: "accounts@indexx.ai" }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent,
            });
            return { status: 200, message: "Withdrawal notification sent" };
        } catch (err) {
            console.error("Error sending withdrawal notification:", err);
            return { status: 500, message: "Failed to send withdrawal notification" };
        }
    }

    async sendBryanInvestmentSetupEmail(recipientEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const htmlContent = `
                <html>
                  <body>
                    <p>Hello,</p>
                    <p>This is a Bryan investment setup notification.</p>
                    <p>Regards,<br/>Indexx.ai Ops</p>
                  </body>
                </html>`;
            await sendInMail.sendTransacEmail({
                subject: "Bryan Investment Setup Notification",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: recipientEmail }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent,
            });
            return { status: 200, message: "Bryan investment setup email sent" };
        } catch (err) {
            console.error("Error sending Bryan investment setup email:", err);
            return { status: 500, message: "Failed to send Bryan investment setup email" };
        }
    }

    async sendAlchemyExternalWalletRequest(payload: {
        userEmail: string;
        amount: number;
        network: string;
        withdrawalAddress: string;
        sessionId: string;
        withdrawalType: string;
    }) {
        try {
            const { userEmail, amount, network, withdrawalAddress, sessionId, withdrawalType } = payload;
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            const htmlContent = `
                <html>
                  <body>
                    <h3>Alchemy External Wallet Request</h3>
                    <p><strong>User:</strong> ${userEmail}</p>
                    <p><strong>Amount:</strong> ${amount}</p>
                    <p><strong>Network:</strong> ${network}</p>
                    <p><strong>Withdrawal Address:</strong> ${withdrawalAddress}</p>
                    <p><strong>Session ID:</strong> ${sessionId}</p>
                    <p><strong>Type:</strong> ${withdrawalType}</p>
                  </body>
                </html>`;
            await sendInMail.sendTransacEmail({
                subject: "[Indexx] Alchemy external wallet request",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: "wallet@indexx.ai", name: "Indexx.ai" },
                to: [{ email: "accounts@azooca.com" }],
                bcc: DEFAULT_BCC_EMAILS,
                htmlContent,
            });
            return { status: 200, message: "Alchemy external wallet notification sent" };
        } catch (err) {
            console.error("Error sending Alchemy external wallet request email:", err);
            return { status: 500, message: "Failed to send Alchemy external wallet request email" };
        }
    }

    async sendAlchemySessionCompletedEmail(payload: {
        toEmail: string;
        sessionId: string;
        inputAmount: number;
        resultAmount: number;
        inputUnit?: string;
        paymentCoin?: string;
        userType?: string;
        multiplier?: number;
        version?: string;
        startedAt?: Date | string;
        completedAt?: Date | string;
        durationMinutes?: number;
        withdrawalType?: string;
        targetNetwork?: string;
        withdrawalAddress?: string;
    }) {
        try {
            const {
                toEmail,
                sessionId,
                inputAmount,
                resultAmount,
                inputUnit = "BTCY",
                paymentCoin = "BTCY",
                multiplier = 1,
                startedAt,
                completedAt,
                withdrawalType = "indexx",
                targetNetwork = "Ying Yang Chain",
                withdrawalAddress = "",
            } = payload;

            const formatDate = (value?: Date | string) => {
                if (!value) return "N/A";
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toUTCString();
            };

            const safeInputAmount = Number(inputAmount || 0);
            const safeResultAmount = Number(resultAmount || 0);
            const normalizedInputUnit = String(inputUnit || "")
                .toLowerCase()
                .trim();
            const inputAmountUnitLabel = normalizedInputUnit.includes("nugget")
                ? "BTCY Nuggets"
                : `${inputUnit} Tokens`;
            const payoutAmountUnitLabel = `${paymentCoin} Tokens`;
            const destinationText = withdrawalType === "indexx"
                ? `${targetNetwork} wallet on Indexx`
                : `external ${targetNetwork} wallet`;

            const bodyContent = `
                <p>Hi,</p>
                <p>Your Alchemy session has been completed successfully.</p>
                <p><strong>Session Details:</strong></p>
                <ul>
                    <li><strong>Session ID:</strong> ${sessionId}</li>
                    <li><strong>Status:</strong> Completed</li>
                    <li><strong>Input Amount:</strong> ${safeInputAmount} ${inputAmountUnitLabel}</li>
                    <li><strong>Payout Amount:</strong> ${safeResultAmount} ${payoutAmountUnitLabel}</li>
                    <li><strong>Multiplier:</strong> ${multiplier}x</li>
                    <li><strong>Destination:</strong> ${destinationText}</li>
                    <li><strong>Started At (UTC):</strong> ${formatDate(startedAt)}</li>
                    <li><strong>Completed At (UTC):</strong> ${formatDate(completedAt)}</li>
                    ${withdrawalAddress ? `<li><strong>Withdrawal Address:</strong> ${withdrawalAddress}</li>` : ""}
                </ul>
                <p>If you did not perform this action, please contact support immediately.</p>
                <p>Regards,<br/>Bitcoin Yay Team</p>
            `;

            return await this.sendGenericEmail({
                toEmail,
                subject: "Alchemy Session Completed - Indexx Exchange",
                bodyContent,
                senderName: "Bitcoin Yay",
                senderEmail: "accounts@indexx.ai",
                replyToEmail: "wallet@indexx.ai",
                bccEmails: ["omkar@azooca.com"],
                logoUrl:
                    "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png",
                logoLink: "https://bitcoinyay.com/",
            });
        } catch (err: any) {
            console.error("Error sending Alchemy session completion email:", err);
            return { status: 500, message: "Failed to send Alchemy completion email" };
        }
    }

    async sendNuggetTransferSuccessEmail(payload: {
        toEmail: string;
        direction: "sent" | "received";
        counterpartyEmail: string;
        amount: number;
        source?: "mined" | "withdrawn";
        transactionId: string;
        completedAt?: Date | string;
    }) {
        try {
            const {
                toEmail,
                direction,
                counterpartyEmail,
                amount,
                source = "mined",
                transactionId,
                completedAt,
            } = payload;

            const safeAmount = this.formatEmailAmount(Number(amount || 0));
            const completedAtLabel = this.formatEmailDate(completedAt);
            const sourceLabel = source === "withdrawn" ? "Withdrawn Balance" : "Mined Balance";
            const action = direction === "sent" ? "sent" : "received";
            const title = direction === "sent"
                ? "Nugget Transfer Sent"
                : "Nugget Transfer Received";
            const counterpartyLabel = direction === "sent" ? "Recipient" : "Sender";

            const bodyContent = `
                <p>Hi,</p>
                <p>Your BTCY Nugget transfer has been completed successfully.</p>
                <p><strong>Transfer Details:</strong></p>
                <ul>
                    <li><strong>Status:</strong> Completed</li>
                    <li><strong>Action:</strong> ${action}</li>
                    <li><strong>Amount:</strong> ${safeAmount} BTCY Nuggets</li>
                    <li><strong>Source:</strong> ${sourceLabel}</li>
                    <li><strong>${counterpartyLabel}:</strong> ${this.escapeHtml(counterpartyEmail)}</li>
                    <li><strong>Transaction ID:</strong> ${this.escapeHtml(transactionId)}</li>
                    <li><strong>Completed At:</strong> ${this.escapeHtml(completedAtLabel)}</li>
                </ul>
                <p>If you did not perform or expect this action, please contact support immediately.</p>
                <p>Regards,<br/>Bitcoin Yay Team</p>
            `;

            return await this.sendGenericEmail({
                toEmail,
                subject: `${title} - Bitcoin Yay`,
                bodyContent,
                senderName: "Bitcoin Yay",
                senderEmail: "accounts@indexx.ai",
                replyToEmail: "wallet@indexx.ai",
                bccEmails: ["omkar@azooca.com"],
                logoUrl:
                    "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png",
                logoLink: "https://bitcoinyay.com/",
            });
        } catch (err: any) {
            console.error("Error sending Nugget transfer success email:", err);
            return { status: 500, message: "Failed to send Nugget transfer success email" };
        }
    }

    async forgotPassWordEmail(email: string, name: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            console.log(email, name);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Exchange Forgot Password",
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                // htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for registering on Indexx Exchange. Please use this code ${code} to proceed further.<br> <br>
                //         Thanks, <br>
                //         Indexx Exchange Team
                //         </h1></body></html>`,
                htmlContent: `<!DOCTYPE html>
        <html>
            <head>
                <title>Page Title</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        
        <style>
        .main#main {
        width:600px;
        margin:auto;
        }
        
        @media only screen and (max-width: 600px) {
        .main#main {
        width:96%;
        }
        }
        </style>
            </head>
            <body>
        
                <table  slign="center" border="0" cellspacing="0" class="main" id="main">
                    <tbody>
                        <tr>
                            <td align="center" valign="middle" style="padding:33px 0">                        
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png" alt="IndexIcon" width="150"/> </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div style="padding:0 30px;background:#fff">
                                    <table width="100%" style="border:1px solid
                                        #f0f0f0;border-radius:5px;
                                        padding: 0 30px;" cellspacing="0"
                                        cellpadding="0">
                                        <tbody>
                                            <tr>
                                                <td style="border-bottom:1px solid #e6e6e6;font-size:18px;padding:20px 0">
                                                    <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td style=" font-size:
                                                                    20px;">Please
                                                                    use below link for resetting the password
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:17px;line-height:30px;padding:20px
                                                    0;color:#666">You recently requested to reset your password for indexx.ai account. <br>
                                                    Use the link to reset it. This password reset is only valid for the next 24 hours.
                                                    
                                                </td>
                                            </tr>
                                            <tr><td style="padding:20px 0 20px
                                                    0;line-height:26px;color:#666;font-size:17px;">Click here to <a
                                                        style="color:#F66036" href="https://cex.indexx.ai/indexx-exchange/buy-sell/login/reset-password?email=${email.toString()}"
                                                        target="_blank">complete reset password </a></td>
        
                                            </tr>
                                            </tbody></table>
                                            <table width="100%" style="margin-top:50px;padding:20px 0;">
                                                <tbody>
                                                <tr>
                                                <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/> </a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/ > </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/> </a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/> </a>
                                                
                                            </td></tr>
                                                    <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
                           
                                    
                                                        <td style="padding:20px 0;color: #221F1F;
        ">indexx Limited, CUB Financial Centre
                                                           ,<br/>
                                                            <br/>
                                                           GF6, Lyford Cay, Nassau, Bahamas.
                                                           <br/>
                                                            <br/><br/>550 Newport Center Drive
                                                           <br/>
                                                            <br/>Newport Beach,
                                                           <br/>
                                                            <br/>CA 92660 United State
                                                           <br/><br/><br/>Copyright © 2022 All Rights Reserved byIndexx.
                                                       </td>
                                                 
                                       </tr>
                                                </tbody>
                                            </table>
                                </div>
                            </td>
                        </tr>
                       
                        </tbody>
                    </table>
        
                </body>
            </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }

    async sendWalletWelcomeEmail(email: string, name: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            console.log(email, name);
            console.log(
                "process.env.SENDINBLUE_API_KEY",
                process.env.SENDINBLUE_API_KEY
            );
            let sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            let send = await sendInMail.sendTransacEmail({
                subject: "Indexx Wallet Register",
                sender: { name: "wallet.indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "wallet.indexx.ai" },
                to: [{ email: `${email}` }],
                bcc: DEFAULT_BCC_EMAILS,
                // htmlContent: `<html><body><h1>­Hi ${name},<br><br> Thank you for registering on Indexx Exchange. Please use this code ${code} to proceed further.<br> <br>
                //         Thanks, <br>
                //         Indexx Exchange Team
                //         </h1></body></html>`,
                htmlContent: `<!DOCTYPE html>
        <html>
        
        <head>
            <title>Page Title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
        
            <style>
                .main#main {
                    width: 600px;
                    margin: auto;
                }
        
                @media only screen and (max-width: 600px) {
                    .main#main {
                        width: 96%;
                    }
                }
        
                .banner-image img {
                    width: 100%;
                    /* Make the image fully responsive */
                    height: auto;
                    /* Maintain aspect ratio */
                    border-radius: 5px;
                    /* Optional: For rounded corners */
                }
            </style>
        </head>
        
        <body>
        
            <table slign="center" border="0" cellspacing="0" class="main" id="main">
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style="padding:33px 0">
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/web3.png" alt="WalletIndexIcon" width="80"> </a> <br/>
                            <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer"> <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx.ai_blue.png" alt="IndexIcon" width="150" /> </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div style="padding:0 30px;background:#fff">
                                <table width="100%" style="border:1px solid
                                                #f0f0f0;border-radius:5px;
                                                padding: 0 30px;" cellspacing="0" cellpadding="0">
                                    <tbody>
                                        <tr>
                                            <td style="border-bottom:1px solid #e6e6e6;font-size:18px;padding:20px 0">
                                                <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                                    <tbody>
                                                        <tr>
                                                            <td align="center" valign="middle" style="padding:33px 0">
                                                                <div class="banner-image">
                                                                    <a href="https://indexx.ai/" target="_blank" rel="noopener noreferrer">  <img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/wallet_header.png" alt="WalletIndexIcon" width="100"> </a>
                                                                </div><br/>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style=" font-size:
                                                                            20px;">Hello, Welcome to Indexx Wallet. We are glad to have you as our new user!
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
        
                                    </tbody>
                                </table>
                                <table width="100%" style="margin-top:50px;padding:20px 0;">
                                    <tbody>
                                        <tr>
                                            <td align="center" style="margin-bottom:20px;display:block">
                                                <a href="https://twitter.com/Indexx_ai" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Twitter.png" alt="Twitter"/></a>
                                                <a href="https://www.instagram.com/indexx_ai/" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Insta.png" alt="Insta" style="padding:0 20px;"/></a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Youtube.png" alt="Youtube" style="padding-right:20px;"/></a>
                                                <a href="https://www.facebook.com/profile.php?id=100086225564460" target="_blank" rel="noopener noreferrer"><img src="https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/FaceBook.png" alt="FaceBook"/></a>
        
                                            </td>
                                        </tr>
                                        <tr style="background: #E4E4E4;text-align: center;font-size:10px;" align="center">
        
        
                                            <td style="padding:20px 0;color: #221F1F;
                ">indexx Limited, CUB Financial Centre ,
                                                <br/>
                                                <br/> GF6, Lyford Cay, Nassau, Bahamas.
                                                <br/>
                                                <br/><br/>550 Newport Center Drive
                                                <br/>
                                                <br/>Newport Beach,
                                                <br/>
                                                <br/>CA 92660 United State
                                                <br/><br/><br/>Copyright © 2022 All Rights Reserved by Indexx.
                                            </td>
        
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
        
                </tbody>
            </table>
        
        </body>
        
        </html>
        `,
                params: { bodyMessage: "Made just for you!" },
            });
            console.log("send", send);
            return { status: 200, message: "Email sent successfully" };
        } catch (err: any) {
            console.error("Email sending error:", err);
            return { status: 500, message: "Email not sent", error: err.message };
        }
    }

    // P2P Trading Email Methods
    async sendP2POfferCreatedEmail(email: string, offerId: string, offerType: string, cryptoCurrency: string, fiatCurrency: string, pricePerUnit: number, availableAmount: number) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `P2P Offer Created - ${offerType} ${cryptoCurrency}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>P2P Offer Created Successfully</h2><p>Your ${offerType} offer has been created. Offer ID: ${offerId}<br>Currency: ${cryptoCurrency} for ${fiatCurrency}<br>Price: ${pricePerUnit}<br>Amount: ${availableAmount}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P offer created email:", error);
        }
    }

    async sendP2PTradeCreatedEmail(email: string, tradeId: string, offerType: string, cryptoAmount: number, cryptoCurrency: string, fiatAmount: number, fiatCurrency: string, buyerEmail: string, sellerEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `New P2P Trade Created - ${tradeId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>New P2P Trade Created</h2><p>Trade ID: ${tradeId}<br>Type: ${offerType}<br>Amount: ${cryptoAmount} ${cryptoCurrency} for ${fiatAmount} ${fiatCurrency}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P trade created email:", error);
        }
    }

    async sendP2PTradeCompletedEmail(email: string, tradeId: string, offerType: string, cryptoAmount: number, cryptoCurrency: string, fiatAmount: number, fiatCurrency: string, buyerEmail: string, sellerEmail: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `P2P Trade Completed - ${tradeId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>P2P Trade Completed Successfully</h2><p>Trade ID: ${tradeId}<br>Amount: ${cryptoAmount} ${cryptoCurrency} for ${fiatAmount} ${fiatCurrency}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P trade completed email:", error);
        }
    }

    async sendP2PPaymentSentEmail(email: string, tradeId: string, fiatAmount: number, fiatCurrency: string, paymentMethod: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `Payment Sent - Trade ${tradeId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>Payment Sent to Escrow</h2><p>Trade ID: ${tradeId}<br>Amount: ${fiatAmount} ${fiatCurrency}<br>Payment Method: ${paymentMethod}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P payment sent email:", error);
        }
    }

    async sendP2PCryptoSentEmail(email: string, tradeId: string, cryptoAmount: number, cryptoCurrency: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `Crypto Sent - Trade ${tradeId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>Crypto Sent to Escrow</h2><p>Trade ID: ${tradeId}<br>Amount: ${cryptoAmount} ${cryptoCurrency}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P crypto sent email:", error);
        }
    }

    async sendP2PTradeCancelledEmail(email: string, tradeId: string, cancelReason: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `Trade Cancelled - ${tradeId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>Trade Cancelled</h2><p>Trade ID: ${tradeId}<br>Reason: ${cancelReason}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P trade cancelled email:", error);
        }
    }

    async sendP2PDisputeCreatedEmail(email: string, disputeId: string, tradeId: string, reason: string) {
        try {
            SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
                process.env.SENDINBLUE_API_KEY;
            const sendInMail = new SibApiV3Sdk.TransactionalEmailsApi();
            await sendInMail.sendTransacEmail({
                subject: `P2P Dispute Created - ${disputeId}`,
                sender: { name: "Indexx.ai", email: "accounts@indexx.ai" },
                replyTo: { email: `wallet@indexx.ai`, name: "Indexx.ai" },
                to: [{ email }],
                htmlContent: `<h2>Dispute Created</h2><p>Dispute ID: ${disputeId}<br>Trade ID: ${tradeId}<br>Reason: ${reason}</p>`,
            });
        } catch (error) {
            console.error("Error sending P2P dispute created email:", error);
        }
    }
}
