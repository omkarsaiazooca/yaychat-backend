import { Request, Response } from "express";
import { WhitelistService } from "../services/whitelist.service";
import { UserService } from "../services/user.service";
import { UserRoleTypes } from "../data/user";

const whitelistService = new WhitelistService();
const userService = new UserService();

/**
 * Helper function to check if user is admin
 */
async function isAdmin(req: Request): Promise<boolean> {
  try {
    // First try from req.user (when auth middleware is active)
    const role = (req.user as any)?.role;
    if (role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin) {
      return true;
    }

    // If not in req.user, extract from request body or query
    const email = req.body?.email || req.query?.email || (req.user as any)?.email;
    if (!email) {
      return false;
    }

    // Get user from database to check role
    const user = await userService.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return false;
    }

    const userRole = (user as any).role;
    return userRole === UserRoleTypes.Admin || userRole === UserRoleTypes.SuperAdmin;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

export class WhitelistController {
  constructor() {
    this.addEmail = this.addEmail.bind(this);
    this.getAllEmails = this.getAllEmails.bind(this);
    this.updateEmail = this.updateEmail.bind(this);
    this.deleteEmail = this.deleteEmail.bind(this);
  }

  /**
   * POST /api/v1/whitelist
   * Add an email to the whitelist (Admin only)
   */
  async addEmail(req: Request, res: Response) {
    try {
      // Check admin authorization
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({
          status: 403,
          message: "Access denied. Admin role required.",
          data: null
        });
      }

      const { email, notes } = req.body;
      const adminEmail = (req.user as any)?.email || req.body?.adminEmail || "system";

      if (!email) {
        return res.status(400).json({
          status: 400,
          message: "Email is required",
          data: null
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: 400,
          message: "Invalid email format",
          data: null
        });
      }

      const whitelistEntry = await whitelistService.addEmail(
        email,
        String(adminEmail).toLowerCase(),
        notes
      );

      return res.status(201).json({
        status: 201,
        message: "Email added to whitelist successfully",
        data: whitelistEntry
      });
    } catch (error: any) {
      console.error("Error adding email to whitelist:", error);
      if (error.message === "Email already exists in whitelist") {
        return res.status(409).json({
          status: 409,
          message: error.message,
          data: null
        });
      }
      return res.status(500).json({
        status: 500,
        message: "Failed to add email to whitelist",
        data: { error: error.message }
      });
    }
  }

  /**
   * GET /api/v1/whitelist
   * Get all whitelisted emails (Admin only)
   */
  async getAllEmails(req: Request, res: Response) {
    try {
      // Check admin authorization
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({
          status: 403,
          message: "Access denied. Admin role required.",
          data: null
        });
      }

      const emails = await whitelistService.getAllEmails();

      return res.status(200).json({
        status: 200,
        message: "Whitelist retrieved successfully",
        data: emails,
        count: emails.length
      });
    } catch (error: any) {
      console.error("Error retrieving whitelist:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to retrieve whitelist",
        data: { error: error.message }
      });
    }
  }

  /**
   * PUT /api/v1/whitelist
   * Update a whitelist entry (Admin only)
   */
  async updateEmail(req: Request, res: Response) {
    try {
      // Check admin authorization
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({
          status: 403,
          message: "Access denied. Admin role required.",
          data: null
        });
      }

      const { oldEmail, newEmail, notes } = req.body;

      if (!oldEmail || !newEmail) {
        return res.status(400).json({
          status: 400,
          message: "Both oldEmail and newEmail are required",
          data: null
        });
      }

      // Validate new email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({
          status: 400,
          message: "Invalid email format",
          data: null
        });
      }

      const updatedEntry = await whitelistService.updateEmail(oldEmail, newEmail, notes);

      return res.status(200).json({
        status: 200,
        message: "Whitelist entry updated successfully",
        data: updatedEntry
      });
    } catch (error: any) {
      console.error("Error updating whitelist entry:", error);
      if (error.message === "New email already exists in whitelist") {
        return res.status(409).json({
          status: 409,
          message: error.message,
          data: null
        });
      }
      return res.status(500).json({
        status: 500,
        message: "Failed to update whitelist entry",
        data: { error: error.message }
      });
    }
  }

  /**
   * DELETE /api/v1/whitelist/:email
   * Remove an email from the whitelist (Admin only)
   */
  async deleteEmail(req: Request, res: Response) {
    try {
      // Check admin authorization
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({
          status: 403,
          message: "Access denied. Admin role required.",
          data: null
        });
      }

      const email = req.params.email || req.body.email;

      if (!email) {
        return res.status(400).json({
          status: 400,
          message: "Email is required",
          data: null
        });
      }

      const deleted = await whitelistService.removeEmail(email);

      if (!deleted) {
        return res.status(404).json({
          status: 404,
          message: "Email not found in whitelist",
          data: null
        });
      }

      return res.status(200).json({
        status: 200,
        message: "Email removed from whitelist successfully",
        data: { email }
      });
    } catch (error: any) {
      console.error("Error deleting email from whitelist:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to remove email from whitelist",
        data: { error: error.message }
      });
    }
  }

  /**
   * GET /api/v1/whitelist/check/:email
   * Check if an email is whitelisted (Admin only, or can be public if needed)
   */
  async checkEmail(req: Request, res: Response) {
    try {
      const emailInput = req.params.email || req.query.email;
      const email = String(emailInput || "").trim();

      if (!email) {
        return res.status(400).json({
          status: 400,
          message: "Email is required",
          data: null
        });
      }

      const isWhitelisted = await whitelistService.isEmailWhitelisted(email);

      return res.status(200).json({
        status: 200,
        message: "Whitelist check completed",
        data: {
          email,
          whitelisted: isWhitelisted
        }
      });
    } catch (error: any) {
      console.error("Error checking whitelist:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to check whitelist",
        data: { error: error.message }
      });
    }
  }
}


