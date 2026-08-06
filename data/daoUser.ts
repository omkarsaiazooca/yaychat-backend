export interface DaoUser {
  email: string;
  name: string;
  role: string;
  reputation: number;
  profileCompletion: number;
  minedBTCY: number;
  referralCount: number;
  powers: {
    name: string;
    status: "completed" | "pending" | "failed";
  }[];
  assignedTasks: {
    taskId: string;
    name: string;
    status: "completed" | "pending" | "failed";
  }[];
  recentActivity: {
    name: string;
    status: "completed" | "failed";
    date: Date;
  }[];
  votes: {
    proposalId: string;
    vote: "up" | "down";
    date: Date;
  }[];
  verifiedTasksCount?: number;
  ledInitiativesCount?: number;
}
