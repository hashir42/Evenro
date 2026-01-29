// Rate limiting and request throttling utilities for API calls
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries periodically
    setInterval(() => this.cleanup(), this.windowMs / 4);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(
        timestamp => now - timestamp < this.windowMs
      );
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps
    const validTimestamps = timestamps.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }

  getRemainingTime(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) return 0;

    const now = Date.now();
    const oldestRequest = Math.min(...timestamps);
    const timeUntilReset = this.windowMs - (now - oldestRequest);

    return Math.max(0, timeUntilReset);
  }
}

// Global rate limiter instances
export const globalRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute
export const authRateLimiter = new RateLimiter(300000, 5); // 5 auth attempts per 5 minutes
export const apiRateLimiter = new RateLimiter(60000, 50); // 50 API calls per minute

// Request throttling for expensive operations
export const throttleRequest = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  delay: number = 100
) => {
  let lastCall = 0;
  let pendingCall: Promise<R> | null = null;

  return (...args: T): Promise<R> => {
    const now = Date.now();

    if (pendingCall) {
      return pendingCall;
    }

    if (now - lastCall < delay) {
      const remainingTime = delay - (now - lastCall);
      return new Promise((resolve) => {
        setTimeout(() => {
          pendingCall = fn(...args);
          pendingCall.then(resolve).finally(() => {
            pendingCall = null;
            lastCall = Date.now();
          });
        }, remainingTime);
      });
    }

    lastCall = now;
    return fn(...args);
  };
};

// Debounced requests for search/autocomplete
export const debounceRequest = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
};

// Request queue for handling concurrent requests
class RequestQueue {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processing = false;
  private concurrency = 3; // Process 3 requests concurrently

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    const workers = Array.from({ length: this.concurrency }, async () => {
      while (this.queue.length > 0) {
        const { fn, resolve, reject } = this.queue.shift()!;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    });

    await Promise.allSettled(workers);
    this.processing = false;
  }
}

export const requestQueue = new RequestQueue();

// Enhanced Supabase client wrapper with rate limiting
export class ScalableSupabaseClient {
  private rateLimiter: RateLimiter;
  private userId?: string;

  constructor(rateLimiter: RateLimiter = apiRateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  private getRateLimitKey(operation: string): string {
    return this.userId ? `${this.userId}:${operation}` : `anonymous:${operation}`;
  }

  private async checkRateLimit(operation: string): Promise<void> {
    const key = this.getRateLimitKey(operation);
    if (!this.rateLimiter.isAllowed(key)) {
      const remainingTime = this.rateLimiter.getRemainingTime(key);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(remainingTime / 1000)} seconds.`);
    }
  }

  async query<T>(
    operation: string,
    queryFn: () => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    await this.checkRateLimit(`query:${operation}`);

    try {
      return await requestQueue.add(queryFn);
    } catch (error) {
      console.error(`Query failed for operation: ${operation}`, error);
      throw error;
    }
  }

  async mutation<T>(
    operation: string,
    mutationFn: () => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    await this.checkRateLimit(`mutation:${operation}`);

    try {
      return await mutationFn();
    } catch (error) {
      console.error(`Mutation failed for operation: ${operation}`, error);
      throw error;
    }
  }
}

// Export a default instance
export const scalableSupabase = new ScalableSupabaseClient();
