import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";
import * as schema from "./schema";

let queryClient: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!database) {
    const { DATABASE_URL } = getEnv();
    queryClient = postgres(DATABASE_URL, { max: 1, prepare: false });
    database = drizzle(queryClient, { schema });
  }

  return database;
}

export async function checkDatabase(): Promise<void> {
  await getDb().execute(sql`select 1`);
}
