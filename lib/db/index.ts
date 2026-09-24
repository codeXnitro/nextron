import { getDatabase, JsonDatabaseEngine } from "./engine";
export * from "./types";

export const db = getDatabase();
export { getDatabase, JsonDatabaseEngine };
