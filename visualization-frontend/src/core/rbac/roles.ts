export const Role = {
  Owner: "owner",
  Admin: "admin",
  Editor: "editor",
  Viewer: "viewer",
} as const

export type Role = (typeof Role)[keyof typeof Role]
