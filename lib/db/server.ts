import "server-only";

import { getServerDatabase } from "./server-engine";

export const db = getServerDatabase();
