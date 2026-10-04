import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

export type APIConfig = {
  fileserverHits: number;
  port: number;
  platform: string;
  jwtSecret: string;
  polkaKey: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

export type Config = {
  api: APIConfig;
  db: DBConfig;
};

export const config: Config = {
  api: {
    port: Number(process.env.PORT) || 8080,
    fileserverHits: 0,
    jwtSecret: process.env.JWT_SECRET || "default_secret",
    polkaKey: process.env.POLKA_KEY || "", 
    platform: process.env.PLATFORM || "dev",
  },

  db: {
    url: envOrThrow("DB_URL"),
    migrationConfig: {
      migrationsFolder: "./src/db/migrations",
    },
  },
};
