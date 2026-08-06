// middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { JwtAuthUtil } from "../platform/jwt.operations";
import { WhitelistService } from "../services/whitelist.service";
import { UserService } from "../services/user.service";
import { ErrorLogService } from "../services/errorLog.service";

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export function validateAuthHeader(req: any, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token' });
    }

    const jwtUtil = new JwtAuthUtil();
    jwtUtil.verifyToken(token).then((decoded) => {
        if (!decoded) {
            return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
        }
        req.user = decoded;
        next();
    }).catch((error) => {
        return res.status(401).json({ message: 'Unauthorized: Token verification failed' });
    });
}

export function validateAdminRole(req: any, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Missing token' });
    }

    const jwtUtil = new JwtAuthUtil();
    jwtUtil.verifyToken(token).then((decoded) => {
        if (!decoded) {
            return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
        }
        const role = String((decoded as any)?.role || '');
        if (role !== 'Admin' && role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }
        req.user = decoded;
        next();
    }).catch(() => {
        return res.status(401).json({ message: 'Unauthorized: Token verification failed' });
    });
}

/**
 * Middleware to add whitelisted field to user responses
 * This middleware checks if the user's email is in the whitelist
 * and adds a whitelisted: true/false field to the response
 */
export function addWhitelistStatus(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json.bind(res);
    const whitelistService = new WhitelistService();

    const patchedJson = async function (data: any) {
        try {
            // Extract email from various possible locations
            let email: string | null = null;

            // Try to get email from response data (for login responses, email is in data.data.email)
            if (data?.data?.email) {
                email = data.data.email;
            } else if (data?.email) {
                email = data.email;
            } else if (req.params?.email) {
                email = req.params.email;
            } else if (req.body?.email) {
                email = req.body.email;
            } else if (req.query?.email) {
                email = req.query.email as string;
            } else if ((req.user as any)?.email) {
                email = (req.user as any).email;
            }

            // If we have an email, check whitelist status
            if (email) {
                const normalizedEmail = String(email).toLowerCase().trim();
                const isWhitelisted = await whitelistService.isEmailWhitelisted(normalizedEmail);

                // Add whitelisted field to response
                if (data?.data) {
                    // If response has a data property, add whitelisted there
                    if (typeof data.data === 'object' && !Array.isArray(data.data)) {
                        data.data.whitelisted = isWhitelisted;
                    } else if (Array.isArray(data.data)) {
                        // If data is an array, add whitelisted to each item that has an email
                        // Note: This is synchronous, so we'll add whitelisted asynchronously
                        // For arrays, we'll process them but it's better to handle in controller
                        // For now, we'll just add to the first matching item
                        const firstItem = data.data.find((item: any) => item?.email);
                        if (firstItem) {
                            const itemEmail = firstItem.email || normalizedEmail;
                            if (itemEmail) {
                                const itemWhitelisted = await whitelistService.isEmailWhitelisted(itemEmail);
                                firstItem.whitelisted = itemWhitelisted;
                            }
                        }
                    }
                } else if (typeof data === 'object' && !Array.isArray(data)) {
                    // If response is a direct object, add whitelisted field
                    data.whitelisted = isWhitelisted;
                }
            }

            return originalJson(data);
        } catch (error) {
                console.error("Error in whitelist middleware:", error);
                // If there's an error, just return the original response
                return originalJson(data);
            }
    };
    (res.json as any) = patchedJson;

    next();
}

/**
 * Middleware specifically for login endpoints
 * Checks if user email is whitelisted and adds whitelisted field to login response
 * Works for all user types (Standard, Admin, etc.)
 * Handles both email-based and phone-based logins
 */
export function validateWhitelistOnLogin(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json.bind(res);
    const whitelistService = new WhitelistService();
    const userService = new UserService();

    const patchedLoginJson = async function (data: any) {
        try {
            // Extract email from request body or response
            let email: string | null = null;

            // Try to get email from request body first (for email-based login)
            if (req.body?.email) {
                email = req.body.email;
            } else if (data?.data?.email) {
                // Fallback to response data if body doesn't have it
                email = data.data.email;
            } else if (data?.email) {
                email = data.email;
            } else if (req.body?.phone) {
                // For phone-based login, look up user's email from phone
                try {
                    // Ensure MongoDB connection before querying
                    const { ensureMongoConnected } = require("../db/connection");
                    const isConnected = await ensureMongoConnected();
                    if (isConnected) {
                        const user = await userService.findOne({ phone: req.body.phone });
                        if (user && user.email) {
                            email = user.email;
                        }
                    } else {
                        console.error("MongoDB not connected, skipping user lookup by phone");
                    }
                } catch (err) {
                    console.error("Error looking up user by phone:", err);
                }
            }

            // If we have an email, check whitelist status
            if (email) {
                const normalizedEmail = String(email).toLowerCase().trim();
                const isWhitelisted = await whitelistService.isEmailWhitelisted(normalizedEmail);

                // Add whitelisted field to login response
                // Login responses typically have structure: { status: 200, data: { access_token, email, ... } }
                if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                    data.data.whitelisted = isWhitelisted;
                } else if (typeof data === 'object' && !Array.isArray(data)) {
                    // If response is direct object, add whitelisted field
                    data.whitelisted = isWhitelisted;
                }
            }

            return originalJson(data);
        } catch (error) {
                console.error("Error in login whitelist middleware:", error);
                // If there's an error, just return the original response
                return originalJson(data);
            }
    };
    (res.json as any) = patchedLoginJson;
    next();
}

/**
 * Extract email from request
 * Tries multiple sources: req.user, JWT token, body, query params
 */
function getEmailFromRequest(req: Request): string | null {
  // Try from req.user (when auth middleware is active)
  if ((req.user as any)?.email) {
    return (req.user as any).email;
  }

  // Try from body
  if (req.body?.email) {
    return req.body.email;
  }

  // Try from query (for GET requests)
  if (req.query?.email) {
    return req.query.email as string;
  }

  // Try to parse JWT token from Authorization header
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      // Decode JWT without verification (just to get email for logging)
      const decoded = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      if (decoded.email) {
        return decoded.email;
      }
    } catch (e) {
      // Ignore JWT parsing errors
    }
  }

  return null;
}

/**
 * Global Error Handling Middleware
 * Must be registered as the last middleware in the Express app
 * 
 * Handles all errors thrown in routes and middleware, providing:
 * - Consistent JSON error responses
 * - Detailed error logging to console
 * - Error logging to MongoDB (non-blocking)
 * - Operational vs programming error distinction
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract error details
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";
  const errorCode = err.errorCode || "INTERNAL_ERROR";
  const isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Extract email from request
  const email = getEmailFromRequest(req);

  // Build API endpoint string
  const apiCalled = `${req.method} ${req.originalUrl || req.url}`;

  // Build detailed log string
  const logParts: string[] = [];
  logParts.push(`[ERROR HANDLER] API Error Occurred`);
  logParts.push(`Method: ${req.method}`);
  logParts.push(`URL: ${req.originalUrl || req.url}`);
  logParts.push(`Status Code: ${statusCode}`);
  logParts.push(`Error Code: ${errorCode}`);
  logParts.push(`Message: ${message}`);
  logParts.push(`Is Operational: ${isOperational}`);
  
  if (err.stack) {
    logParts.push(`Stack Trace: ${err.stack}`);
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    logParts.push(`Request Body: ${JSON.stringify(req.body, null, 2)}`);
  }
  if (req.query && Object.keys(req.query).length > 0) {
    logParts.push(`Request Query: ${JSON.stringify(req.query, null, 2)}`);
  }
  if (req.params && Object.keys(req.params).length > 0) {
    logParts.push(`Request Params: ${JSON.stringify(req.params, null, 2)}`);
  }

  const detailedLog = logParts.join("\n");

  // Log error details to console
  console.error("=".repeat(80));
  console.error(detailedLog);
  console.error("=".repeat(80));

  // Save to MongoDB (non-blocking, fire-and-forget)
  const errorLogService = new ErrorLogService();
  errorLogService.saveErrorLog({
    email: email || undefined,
    timestamp: new Date(),
    apiCalled: apiCalled,
    detailedLog: detailedLog,
    statusCode: statusCode,
    errorCode: errorCode,
    method: req.method,
    url: req.originalUrl || req.url,
    requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    requestQuery: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
    requestParams: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
    stackTrace: err.stack || undefined,
  }).catch((logError) => {
    // Silently fail - don't let logging errors break the error handler
    console.error("[ErrorHandler] Failed to save error log to MongoDB:", logError);
  });

  // Don't send error response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Send consistent error response
  const errorResponse: any = {
    success: false,
    message: message,
    code: errorCode,
  };

  // Include stack trace in development mode only
  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Include additional error details for operational errors in development
  if (process.env.NODE_ENV === "development" && isOperational) {
    errorResponse.statusCode = statusCode;
    errorResponse.isOperational = isOperational;
  }

  res.status(statusCode).json(errorResponse);
}
