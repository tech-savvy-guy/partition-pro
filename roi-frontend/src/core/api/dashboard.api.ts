import { http } from "@/core/api/http";
import { Endpoints } from "../config";

export type ChangelogItem = {
  id: string;
  heading: string;
  description: string;
  created_on: string;
  created_by: string;
};

export const ChangelogApi = {
  getAll: async (): Promise<ChangelogItem[]> => {
    const res = await http.get<{ results: ChangelogItem[] }>(
      Endpoints.changelogs.root
    );
    return res.results;
  },
};
