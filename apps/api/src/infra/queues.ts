import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export const QUEUE_NAMES = {
  alertTimers: "alert-timers",
  notifications: "notifications",
} as const;

export type AlertTimerJob =
  | { kind: "claim-timeout"; alertId: string; claimId: string }
  | { kind: "alert-expiry"; alertId: string }
  | { kind: "conversation-inactivity"; conversationId: string };

export type NotificationJob = { kind: "alert-fanout"; alertId: string };

export interface Queues {
  alertTimers: Queue<AlertTimerJob>;
  notifications: Queue<NotificationJob>;
  close: () => Promise<void>;
}

/** IDs deterministas para poder cancelar timers (BullMQ no acepta ':' en IDs propios). */
export const jobIds = {
  claimTimeout: (claimId: string) => `claim-timeout_${claimId}`,
  alertExpiry: (alertId: string) => `alert-expiry_${alertId}`,
  inactivity: (conversationId: string, at: number) => `inactivity_${conversationId}_${at}`,
  fanout: (alertId: string) => `fanout_${alertId}`,
};

const defaultJobOptions = {
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
};

export function createQueues(redis: Redis): Queues {
  const connection = redis.duplicate();
  const alertTimers = new Queue<AlertTimerJob>(QUEUE_NAMES.alertTimers, {
    connection,
    defaultJobOptions,
  });
  const notifications = new Queue<NotificationJob>(QUEUE_NAMES.notifications, {
    connection,
    defaultJobOptions,
  });
  return {
    alertTimers,
    notifications,
    close: async () => {
      await alertTimers.close();
      await notifications.close();
      connection.disconnect();
    },
  };
}
