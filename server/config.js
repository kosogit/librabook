import { existsSync } from "node:fs";
// Node 22+ loads server secrets without exposing them as VITE_ browser variables.
if (existsSync(".env")) process.loadEnvFile(".env");
