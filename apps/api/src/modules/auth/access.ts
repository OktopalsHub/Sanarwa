import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  apiKey: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    apiKey: ["create", "read", "update", "delete"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    apiKey: ["create", "read", "update", "delete"],
  }),
  member: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    apiKey: [],
  }),
  viewer: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    apiKey: [],
  }),
};
