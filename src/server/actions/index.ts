// Barrel re-export — all domain actions from a single import path
// Consumers use: import { fetchEntities, ... } from "@/server/actions"
// which resolves to src/server/actions.ts → re-exports from here

export * from "./compliance";
export * from "./team";
export * from "./user";
export * from "./billing";
export * from "./workforce";
export * from "./supplier-portal";
export * from "./secretariat";
export * from "./training";
export * from "./admin";
export * from "./market";
