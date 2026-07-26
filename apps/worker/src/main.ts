import { createWorker } from "./create-worker.js";

const worker = createWorker();
worker.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    worker.stop();
    process.exit(0);
  });
}
