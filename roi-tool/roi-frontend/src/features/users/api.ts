export type AppUser = { id: string; name: string };

export async function listUsers(): Promise<AppUser[]> {
  // TEMP mock until backend users endpoint is ready
  return [
    { id: "u-001", name: "Aisha Khan" },
    { id: "u-002", name: "Marco Lee" },
    { id: "u-003", name: "Shivam Shukla" },
    { id: "u-004", name: "Priya Patel" },
  ];
}
