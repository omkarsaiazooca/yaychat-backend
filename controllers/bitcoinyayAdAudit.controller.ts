import { Request, Response } from "express";
import { BitcoinyayAdAuditLog } from "../data/bitcoinyayAdAuditLog";
import { BitcoinyayAdAuditLogService } from "../services/bitcoinyayAdAudit.service";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 40;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export class BitcoinyayAdAuditController {
  private readonly service: BitcoinyayAdAuditLogService;

  constructor(service?: BitcoinyayAdAuditLogService) {
    this.service = service || new BitcoinyayAdAuditLogService();
  }

  async logAdFailure(req: Request, res: Response): Promise<void> {
    try {
      const rateLimitKey = this.resolveRateLimitKey(req);
      const rateLimitResult = this.applyRateLimit(rateLimitKey);
      if (!rateLimitResult.allowed) {
        res.setHeader("Retry-After", String(rateLimitResult.retryAfter ?? 60));
        res.status(429).json({
          success: false,
          error: "Too many requests, please slow down",
        });
        return;
      }

      const {
        adUnitId,
        adFormat,
        errorCode,
        errorMessage,
        locale,
        timestamp,
        requestId,
        vpnDetected,
        networkStatus,
        userId,
        sessionId,
        userCountry,
        deviceInfo,
        appVersion,
        networkCarrier,
        extraInfo,
        source,
      } = req.body;

      if (!adUnitId || !adFormat || !errorCode || !errorMessage) {
        res.status(400).json({
          success: false,
          error:
            "Missing required fields: adUnitId, adFormat, errorCode, and errorMessage are required",
        });
        return;
      }

      const normalizedTimestamp = this.normalizeTimestamp(timestamp);
      const logEntry: BitcoinyayAdAuditLog = {
        adUnitId: String(adUnitId),
        adFormat: String(adFormat),
        errorCode: String(errorCode),
        errorMessage: String(errorMessage),
        locale: locale ? String(locale) : undefined,
        timestamp: normalizedTimestamp,
        requestId: requestId ? String(requestId) : undefined,
        vpnDetected:
          vpnDetected !== undefined
            ? typeof vpnDetected === "boolean"
              ? vpnDetected
              : String(vpnDetected).toLowerCase() === "true"
            : undefined,
        networkStatus: networkStatus ? String(networkStatus) : undefined,
        userId: userId ? String(userId) : undefined,
        sessionId: sessionId ? String(sessionId) : undefined,
        userCountry: userCountry ? String(userCountry) : undefined,
        deviceInfo: deviceInfo ? String(deviceInfo) : undefined,
        appVersion: appVersion ? String(appVersion) : undefined,
        networkCarrier: networkCarrier ? String(networkCarrier) : undefined,
        extraInfo: this.normalizeExtraInfo(extraInfo),
        userAgent: this.getUserAgent(req),
        userIp: this.getClientIp(req),
        source: source ? String(source) : "bitcoinyay-app",
        createdAt: new Date(),
      };

      const savedLog = await this.service.create(logEntry);
      res.status(201).json({ success: true, data: savedLog });
    } catch (error: any) {
      console.error("logAdFailure error:", error);
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        adUnitId,
        adFormat,
        errorCode,
        locale,
        vpnDetected,
        userId,
        sessionId,
        networkStatus,
        from,
        to,
        limit = "25",
        page = "1",
      } = req.query;

      const filters: any = {};
      if (adUnitId) filters.adUnitId = String(adUnitId);
      if (adFormat) filters.adFormat = String(adFormat);
      if (errorCode) filters.errorCode = String(errorCode);
      if (locale) filters.locale = String(locale);
      if (vpnDetected !== undefined) {
        filters.vpnDetected =
          String(vpnDetected).toLowerCase() === "true" ||
          vpnDetected === "1";
      }
      if (userId) filters.userId = String(userId);
      if (sessionId) filters.sessionId = String(sessionId);
      if (networkStatus) filters.networkStatus = String(networkStatus);

      const timestampFilter = this.buildTimestampFilter(String(from), String(to));
      if (timestampFilter) {
        filters.timestamp = timestampFilter;
      }

      const parsedLimit = Math.min(
        Math.max(Number(limit) || 25, 1),
        200
      );
      const parsedPage = Math.max(Number(page) || 1, 1);
      const skip = (parsedPage - 1) * parsedLimit;
      const [logs, total] = await Promise.all([
        this.service.findWithFilters(filters, parsedLimit, skip, {
          timestamp: -1,
        }),
        this.service.countWithFilters(filters),
      ]);

      res.status(200).json({
        success: true,
        page: parsedPage,
        limit: parsedLimit,
        total,
        data: logs,
      });
    } catch (error: any) {
      console.error("getAuditLogs error:", error);
      res
        .status(500)
        .json({ success: false, error: "Unhandled error: " + error?.message });
    }
  }

  private applyRateLimit(key: string): {
    allowed: boolean;
    retryAfter?: number;
  } {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
      return {
        allowed: false,
        retryAfter: Math.ceil(
          (RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000
        ),
      };
    }

    entry.count += 1;
    return { allowed: true };
  }

  private resolveRateLimitKey(req: Request): string {
    const ip = this.getClientIp(req) || "unknown";
    const user = req.headers["x-user-id"]
      ? String(req.headers["x-user-id"])
      : req.headers.authorization
      ? String(req.headers.authorization)
      : "anonymous";
    return `${ip}:${user}`.slice(0, 200);
  }

  private normalizeTimestamp(value: any): Date {
    const when =
      typeof value === "number"
        ? new Date(value)
        : value
        ? new Date(String(value))
        : new Date();
    return Number.isNaN(when.getTime()) ? new Date() : when;
  }

  private buildTimestampFilter(from?: string, to?: string): any | undefined {
    const filter: any = {};
    const fromDate = from ? new Date(from) : undefined;
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      filter.$gte = fromDate;
    }
    const toDate = to ? new Date(to) : undefined;
    if (toDate && !Number.isNaN(toDate.getTime())) {
      filter.$lte = toDate;
    }
    if (Object.keys(filter).length === 0) {
      return undefined;
    }
    return filter;
  }

  private normalizeExtraInfo(value: any): Record<string, any> | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    return { value };
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const forwardedValue = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded;
      return String(forwardedValue).split(",")[0].trim();
    }
    return req.socket?.remoteAddress ?? "unknown";
  }

  private getUserAgent(req: Request): string | undefined {
    const ua = req.headers["user-agent"];
    return ua ? String(ua) : undefined;
  }
}
