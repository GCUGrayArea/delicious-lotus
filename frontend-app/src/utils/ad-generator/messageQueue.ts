/**
 * Message Queue for Offline Handling
 * FIFO queue for queuing messages when WebSocket is offline
 */

/**
 * Queued message interface
 */
export interface QueuedMessage {
  /** Unique message identifier */
  id: string;
  /** Timestamp when message was queued */
  timestamp: Date;
  /** Event type */
  event: string;
  /** Event data */
  data: unknown;
  /** Number of retry attempts */
  retries: number;
}

/**
 * Message queue configuration
 */
export interface MessageQueueConfig {
  /** Maximum number of messages to store (default: 100) */
  maxSize?: number;
  /** Maximum retry attempts per message (default: 3) */
  maxRetries?: number;
  /** Maximum message age in ms before auto-removal (default: 3600000 / 1 hour) */
  maxAge?: number;
  /** Enable localStorage persistence (default: true) */
  persist?: boolean;
}

/**
 * Message queue for offline message handling
 * Implements FIFO queue with retry tracking and persistence
 */
export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private maxSize: number;
  private maxRetries: number;
  private maxAge: number;
  private persist: boolean;
  private storageKey = 'websocket_message_queue';

  constructor(config: MessageQueueConfig = {}) {
    this.maxSize = config.maxSize ?? 100;
    this.maxRetries = config.maxRetries ?? 3;
    this.maxAge = config.maxAge ?? 3600000; // 1 hour
    this.persist = config.persist ?? true;

    // Load persisted messages
    if (this.persist) {
      this.loadFromStorage();
    }
  }

  /**
   * Add message to queue
   * @param event - Event type
   * @param data - Event data
   * @returns Message ID
   */
  enqueue(event: string, data: unknown): string {
    const id = this.generateId();
    const message: QueuedMessage = {
      id,
      timestamp: new Date(),
      event,
      data,
      retries: 0,
    };

    // Enforce size limit - remove oldest if full
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }

    this.queue.push(message);
    this.saveToStorage();
    return id;
  }

  /**
   * Remove and return oldest message
   * @returns Oldest message or null if queue is empty
   */
  dequeue(): QueuedMessage | null {
    const message = this.queue.shift() ?? null;
    if (message) {
      this.saveToStorage();
    }
    return message;
  }

  /**
   * View oldest message without removing
   * @returns Oldest message or null if queue is empty
   */
  peek(): QueuedMessage | null {
    return this.queue[0] ?? null;
  }

  /**
   * Remove specific message by ID
   * @param id - Message ID
   * @returns True if message was removed
   */
  remove(id: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((msg) => msg.id !== id);
    const removed = this.queue.length < initialLength;
    if (removed) {
      this.saveToStorage();
    }
    return removed;
  }

  /**
   * Clear entire queue
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Get queue size
   * @returns Number of messages in queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Increment retry count for a message
   * @param id - Message ID
   * @returns False if max retries exceeded, true otherwise
   */
  incrementRetries(id: string): boolean {
    const message = this.queue.find((msg) => msg.id === id);
    if (!message) {
      return false;
    }

    message.retries++;
    this.saveToStorage();

    // Return false if max retries exceeded
    return message.retries < this.maxRetries;
  }

  /**
   * Get all messages in queue
   * @returns Array of all messages
   */
  getAll(): QueuedMessage[] {
    return [...this.queue];
  }

  /**
   * Remove messages older than specified age
   * @param maxAge - Maximum age in milliseconds
   */
  removeOldMessages(maxAge: number = this.maxAge): void {
    const now = new Date().getTime();
    const initialLength = this.queue.length;

    this.queue = this.queue.filter((msg) => {
      const age = now - msg.timestamp.getTime();
      return age < maxAge;
    });

    if (this.queue.length < initialLength) {
      this.saveToStorage();
    }
  }

  /**
   * Get messages that have exceeded retry limit
   * @returns Array of failed messages
   */
  getFailedMessages(): QueuedMessage[] {
    return this.queue.filter((msg) => msg.retries >= this.maxRetries);
  }

  /**
   * Remove all messages that have exceeded retry limit
   */
  removeFailedMessages(): void {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((msg) => msg.retries < this.maxRetries);

    if (this.queue.length < initialLength) {
      this.saveToStorage();
    }
  }

  /**
   * Generate unique ID for message
   * @returns UUID v4
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (!this.persist || typeof window === 'undefined') {
      return;
    }

    try {
      const serialized = JSON.stringify(
        this.queue.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        }))
      );
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      console.error('[MessageQueue] Failed to save to localStorage:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      this.queue = parsed.map((msg: { id: string; timestamp: string; event: string; data: unknown; retries: number }) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      // Clean up old messages on load
      this.removeOldMessages();
    } catch (error) {
      console.error('[MessageQueue] Failed to load from localStorage:', error);
      this.queue = [];
    }
  }
}
