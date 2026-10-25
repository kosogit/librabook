import "./config.js";
import { resolve } from "node:path";
import { createBackend } from "./app.js";

export function backendPlugin() {
  let middleware;
  const install = (server) => {
    middleware ||= createBackend();
    server.middlewares.use(middleware);
  };
  return {
    name: "librabook-api",
    config: () => ({
      server: {
        fs: {
          deny: [
            ".env",
            ".env.*",
            "*.{crt,pem}",
            "**/.git/**",
            "**/data/**",
            resolve(process.env.LIBRA_DATA_FILE || "data/workspace.json"),
            `${resolve(process.env.LIBRA_DATA_FILE || "data/workspace.json")}.tmp`,
          ],
        },
      },
    }),
    configureServer: install,
    configurePreviewServer: install,
  };
}
