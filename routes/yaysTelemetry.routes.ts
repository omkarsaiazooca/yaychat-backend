import { NextFunction, Request, Response, Router } from "express";
import { YaysTelemetryController } from "../controllers/yaysTelemetryAPI";
import { JwtAuthUtil } from "../platform/jwt.operations";

const yaysTelemetryRouter: Router = Router();
const controller = new YaysTelemetryController();
const jwtUtil = new JwtAuthUtil();

/**
 * Attach the user when a valid bearer token is present, but never reject.
 *
 * Onboarding and crash telemetry are most valuable exactly where there is no
 * session — a crash on the sign-in screen, a sign-up that never completed.
 * Requiring auth here would blind the pipeline to those cases. An invalid or
 * expired token is treated as anonymous rather than as an error, so a client
 * whose session lapsed mid-batch still reports its crash.
 */
function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = String(req.headers["authorization"] || "");
  if (!header.startsWith("Bearer ")) {
    return next();
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return next();
  }
  jwtUtil
    .verifyToken(token)
    .then((decoded) => {
      if (decoded) {
        (req as any).user = decoded;
      }
      next();
    })
    .catch(() => next());
}

yaysTelemetryRouter.get("/catalog", controller.getCatalog);
yaysTelemetryRouter.post("/events", optionalAuth, controller.ingestEvents);
yaysTelemetryRouter.post("/crashes", optionalAuth, controller.reportCrash);

export { yaysTelemetryRouter };
