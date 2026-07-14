import { spawn } from "node:child_process";

const port = process.env.MONEY_ROUTINE_E2E_PORT ?? "5173";
const baseUrl = `http://127.0.0.1:${port}`;
const startupTimeoutMs = 30_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
}

async function run() {
  const server = spawnNode(
    [
      "./node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      port,
      "--strictPort",
    ],
    {
      env: {
        ...process.env,
        VITE_AI_PROVIDER: "openai-proxy",
      },
    },
  );

  const stopServer = () => {
    if (!server.killed) {
      server.kill();
    }
  };

  process.once("SIGINT", stopServer);
  process.once("SIGTERM", stopServer);

  try {
    await waitForServer();

    const testProcess = spawnNode(["./node_modules/@playwright/test/cli.js", "test"], {
      env: {
        ...process.env,
        MONEY_ROUTINE_E2E_EXTERNAL_SERVER: "1",
      },
    });

    const exitCode = await new Promise((resolve) => {
      testProcess.once("exit", (code) => resolve(code ?? 1));
    });

    process.exitCode = exitCode;
  } finally {
    stopServer();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
