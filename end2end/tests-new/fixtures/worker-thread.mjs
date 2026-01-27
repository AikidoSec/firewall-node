import { isMainThread, Worker } from "worker_threads";

if (isMainThread) {
  console.log("Main thread started");
  const worker = new Worker(new URL(import.meta.url));
} else {
  console.log("Worker thread started");
}
