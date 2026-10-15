/**
 * The position of an action inside the pending queue. position is 1-based, or
 * -1 when the id is not queued. Pure and deterministic.
 */
export interface QueuePosition {
  readonly position: number;
  readonly total: number;
  readonly found: boolean;
}

/**
 * Computes where an action sits in the pending-actions queue (used when
 * Telegram is failing and work is buffered). Returns a 1-based position, the
 * queue size, and whether the id was found. Pure and deterministic.
 */
export const computeQueuePosition = (
  queue: readonly string[],
  id: string,
): QueuePosition => {
  const index = queue.indexOf(id);
  return {
    position: index === -1 ? -1 : index + 1,
    total: queue.length,
    found: index !== -1,
  };
};
