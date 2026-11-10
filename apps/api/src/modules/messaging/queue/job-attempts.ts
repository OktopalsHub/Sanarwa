import { Job } from "bullmq";

// BullMQ emits `failed` on every attempt. Only the last one is terminal, and only the
// terminal one belongs in the dead letter queue.
export function isFinalAttempt(job: Job): boolean {
  const attempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
  return job.attemptsMade >= attempts;
}
