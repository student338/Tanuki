/** Jest globalTeardown — stops the Next.js server after all tests finish. */

import { ChildProcess } from 'child_process';

declare global {
  // eslint-disable-next-line no-var
  var __NEXT_SERVER__: ChildProcess | undefined;
}

export default async function globalTeardown(): Promise<void> {
  const server: ChildProcess | undefined = global.__NEXT_SERVER__;
  if (server && server.pid) {
    server.kill('SIGTERM');
    // Give it a moment to exit cleanly
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    try {
      process.kill(server.pid, 0); // still alive?
      server.kill('SIGKILL');
    } catch {
      // already dead
    }
  }
}
