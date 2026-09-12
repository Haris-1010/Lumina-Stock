import "dotenv/config";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js uses .env.local for local overrides; load it so Prisma CLI
// picks up the same local DATABASE_URL / DIRECT_URL in development.
config({ path: ".env.local", override: true });

// DIRECT_URL is set locally (.env) for migrations via session pooler.
// On Vercel it is not required — DATABASE_URL (transaction pooler) handles runtime.
const datasource = process.env.DIRECT_URL
  ? { url: process.env.DATABASE_URL!, directUrl: process.env.DIRECT_URL }
  : { url: process.env.DATABASE_URL! };

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource,
});
