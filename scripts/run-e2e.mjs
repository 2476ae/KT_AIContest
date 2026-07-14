import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const startupTimeoutMs = 30_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => (error ? reject(error) : resolve(String(port))));
    });
  });
}

async function waitForServer(baseUrl) {
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

function waitForExit(child, timeoutMs = 2_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(timeoutMs),
  ]);
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid) {
    return;
  }

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    await waitForExit(child);
    if (child.exitCode === null && child.signalCode === null) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 5_000,
        windowsHide: true,
      });
    }
  } else {
    child.kill("SIGTERM");
  }

  await waitForExit(child);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

async function run() {
  const port = process.env.MONEY_ROUTINE_E2E_PORT ?? await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
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

  const stopServer = () => void stopProcessTree(server);

  process.once("SIGINT", stopServer);
  process.once("SIGTERM", stopServer);

  try {
    await waitForServer(baseUrl);

    const testProcess = spawnNode(["./node_modules/@playwright/test/cli.js", "test"], {
      env: {
        ...process.env,
        MONEY_ROUTINE_E2E_BASE_URL: baseUrl,
        MONEY_ROUTINE_E2E_EXTERNAL_SERVER: "1",
      },
    });

    const exitCode = await new Promise((resolve) => {
      testProcess.once("exit", (code) => resolve(code ?? 1));
    });

    process.exitCode = exitCode;
  } finally {
    process.removeListener("SIGINT", stopServer);
    process.removeListener("SIGTERM", stopServer);
    await stopProcessTree(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
