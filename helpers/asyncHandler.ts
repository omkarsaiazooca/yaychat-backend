import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Async Handler Utility
 * Wraps async route handlers to automatically catch errors and forward them to error middleware
 * 
 * @param fn - Express route handler function
 * @returns Wrapped handler that catches async errors
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.findAll();
 *   res.json(users);
 * }));
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

