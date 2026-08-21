import type { AdminDashboardStats } from "../models/dashboard";

export interface DashboardRepository {
  getStats(token: string): Promise<AdminDashboardStats>;
}
