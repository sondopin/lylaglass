import { apiClient } from "./client";
import { Settings } from "./types";

export const settingsApi = {
  get: () => apiClient.get<Settings>("/settings", { next: { revalidate: 300 } }),
};
