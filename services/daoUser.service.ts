import { Repository } from "../db/base";
import { DaoUser } from "../data/daoUser";
import daoUserSchema, { DaoUserModel } from "../models/daoUser";
import { MiningService } from "./mining.service";
import { UserService } from "./user.service";

let userService: UserService = new UserService();
let miningService: MiningService = new MiningService();

export class DaoUserService extends Repository<DaoUser, DaoUserModel> {
    constructor() {
        super(daoUserSchema, "DaoUser");
    }

    async getOrCreate(email: string, name = "Unnamed") {
        let user = await this.findOne({ email });

        if (!user) {
            // 1️⃣ Fetch referral count
            const userDoc = await userService.findOneSelect(
                { email: email.toLowerCase() },
                { relationships: 1 }
            );
            const referralCount = userDoc?.relationships?.length || 0;

            // 2️⃣ Fetch mined BTCY
            const miningData = await miningService.getMiningData(email.toLowerCase(), "BTCY");
            const minedBTCY = miningData?.totalMined || 0;

            // 3️⃣ Default role and powers
            const role = "Contributor Gopher";
            const powers = this.getPowersForRole(role);

            // 4️⃣ Create user
            user = await this.create({
                email,
                name,
                role,
                reputation: 0,
                minedBTCY,
                referralCount,
                profileCompletion: 70,
                powers,
                assignedTasks: [],
                recentActivity: [],
                votes: [],
                verifiedTasksCount: 0,
                ledInitiativesCount: 0
            });
        }

        return user;
    }

    private determineRole(user: DaoUser): string {
        const {
            reputation,
            minedBTCY,
            referralCount,
            votes,
            verifiedTasksCount = 0,
            ledInitiativesCount = 0
        } = user;

        const votesCast = votes.length;

        if (
            reputation >= 1000 &&
            minedBTCY >= 100_000 &&
            referralCount >= 100 &&
            votesCast >= 15 &&
            ledInitiativesCount >= 2
        ) return "Leader Gopher";

        if (
            reputation >= 600 &&
            minedBTCY >= 25_500 &&
            referralCount >= 30 &&
            votesCast >= 10 &&
            verifiedTasksCount >= 5
        ) return "Validator Gopher";

        if (
            reputation >= 300 &&
            minedBTCY >= 20_000 &&
            referralCount >= 15 &&
            votesCast >= 5
        ) return "Manager Gopher";

        return "Contributor Gopher";
    }

    private getPowersForRole(role: string): { name: string; status: "completed" }[] {
        const base: { name: string; status: "completed" }[] = [
            { name: "Vote on proposals", status: "completed" }
        ];

        switch (role) {
            case "Leader Gopher":
                return [
                    ...base,
                    { name: "Propose protocol innovations", status: "completed" },
                    { name: "Approve final decisions", status: "completed" },
                    { name: "Manage treasury", status: "completed" },
                    { name: "Promote/demote roles", status: "completed" }
                ];
            case "Validator Gopher":
                return [
                    ...base,
                    { name: "Verify identity/KYC", status: "completed" },
                    { name: "Flag bad actors", status: "completed" },
                    { name: "Validate vote", status: "completed" }
                ];
            case "Manager Gopher":
                return [
                    ...base,
                    { name: "Assign tasks", status: "completed" },
                    { name: "Moderate discussions", status: "completed" },
                    { name: "Vote fully", status: "completed" }
                ];
            default:
                return [
                    ...base,
                    { name: "Claim basic tasks", status: "completed" },
                    { name: "Vote on entry-level proposals", status: "completed" }
                ];
        }
    }


    async evaluateAndUpdateRole(email: string) {
        const user = await this.findOne({ email });
        if (!user) return;

        // 🔒 Bypass role updates for these manually set accounts
        const manualRoles = [
            "sunkuomkarsai12121@gmail.com",
            "issaumer125@gmail.com"
        ];
        if (manualRoles.includes(email.toLowerCase())) {
            return; // Do NOT auto-update role
        }

        const newRole = this.determineRole(user);
        const newPowers = this.getPowersForRole(newRole);

        if (user.role !== newRole) {
            await this.updatePart(
                { email },
                {
                    role: newRole,
                    powers: newPowers
                }
            );
        }
    }


    async recordVote(email: string, proposalId: string, vote: string) {
        await this.updatePart(
            { email },
            {
                $push: {
                    votes: { proposalId, vote, date: new Date() },
                    recentActivity: {
                        name: `Voted ${vote} on proposal ${proposalId}`,
                        status: "completed",
                        date: new Date()
                    }
                }
            }
        );

        await this.evaluateAndUpdateRole(email);
    }

    async addReputation(email: string, points: number) {
        await this.updatePart({ email }, { $inc: { reputation: points } });
        await this.evaluateAndUpdateRole(email);
    }

    async assignTask(email: string, taskId: string, taskName: string) {
        await this.updatePart(
            { email },
            {
                $push: {
                    assignedTasks: { taskId, name: taskName, status: "pending" },
                    recentActivity: {
                        name: `Assigned task: ${taskName}`,
                        status: "completed",
                        date: new Date()
                    }
                }
            }
        );

        await this.evaluateAndUpdateRole(email);
    }

    async updateRole(email: string, newRole: string) {
        const powers = this.getPowersForRole(newRole);
        return this.updatePart({ email }, { role: newRole, powers });
    }

    async getDashboardData(email: string) {
        const user: DaoUser = await this.getOrCreate(email);
        return {
            role: user?.role,
            reputation: user?.reputation,
            maxReputation: 1000,
            profileCompletion: user?.profileCompletion,
            powers: user?.powers,
            assignedTasks: user?.assignedTasks,
            recentActivity: user?.recentActivity,
            totalMined: user?.minedBTCY,
            referrals: user?.referralCount
        };
    }
}
