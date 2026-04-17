"use client";

import { UserRole } from "@/types/models";

const ROLE_KEY = "mock_role";

export const mockAuth = {
  setRole: (role: UserRole) => {
    localStorage.setItem(ROLE_KEY, role);
  },
  getRole: (): UserRole | null => {
    const value = localStorage.getItem(ROLE_KEY);
    if (value === "admin") {
      return value;
    }
    return null;
  },
  clearRole: () => {
    localStorage.removeItem(ROLE_KEY);
  },
};
