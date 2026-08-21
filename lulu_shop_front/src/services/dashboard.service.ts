import { dashboardRepository } from "@/lib/container";

export function fetchAdminDashboard(token: string) {
  return dashboardRepository.getStats(token);
}
