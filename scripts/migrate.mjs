import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: [".env.local", ".env"] });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run migrations");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied");
} finally {
  await client.end();
}
