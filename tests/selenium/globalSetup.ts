/**
 * Jest globalSetup — builds (if needed) and starts the Next.js server on
 * port 3999 before any Selenium tests run.
 */

import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as path from 'path';

const PORT = 3999;
const ROOT = path.resolve(__dirname, '..', '..');

declare global {
  // eslint-disable-next-line no-var
  var __NEXT_SERVER__: ChildProcess | undefined;
}

function waitForServer(url: string, retries = 40, initialDelay = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = (delay: number) => {
      http
        .get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry(delay);
          }
        })
        .on('error', () => retry(delay));
    };
    const retry = (prevDelay: number) => {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`Server at ${url} did not start after ${retries} attempts`));
        return;
      }
      // Exponential back-off capped at 4 seconds
      const nextDelay = Math.min(prevDelay * 2, 4000);
      setTimeout(() => check(nextDelay), nextDelay);
    };
    check(initialDelay);
  });
}

export default async function globalSetup(): Promise<void> {
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: ROOT,
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Use in-memory defaults so no real data directory is needed
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin123',
      STUDENT_USERNAME: 'student',
      STUDENT_PASSWORD: 'student123',
      SESSION_SECRET: 'selenium-test-secret',
    },
    detached: false,
  });

  global.__NEXT_SERVER__ = server;

  server.stdout?.on('data', (d: Buffer) => process.stdout.write(d));
  server.stderr?.on('data', (d: Buffer) => process.stderr.write(d));

  await waitForServer(`http://localhost:${PORT}`);
  process.env.TEST_BASE_URL = `http://localhost:${PORT}`;
}
