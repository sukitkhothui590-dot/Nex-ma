import { alerts, customers, dashboardSummary, subscriptions, users, websites } from "@/lib/mock-data/fixtures";

export const dataService = {
  getUsers: async () => users,
  getCustomers: async () => customers,
  getWebsites: async () => websites,
  getAlerts: async () => alerts,
  getSubscriptions: async () => subscriptions,
  getAdminSummary: async () => dashboardSummary,
};
