import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "../common/config";
import { entities } from "./entities";
import { Initial1790000000000 } from "./migrations/Initial";
export const db = new DataSource({
  type: "mariadb",
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USERNAME,
  password: config.DB_PASSWORD,
  database: config.DB_DATABASE,
  charset: "utf8mb4",
  timezone: "Z",
  entities,
  migrations: [Initial1790000000000],
  synchronize: true,
  logging: false,
  extra: { connectionLimit: 15 },
});
