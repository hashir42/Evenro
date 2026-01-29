import { supabase } from '@/integrations/supabase/client';
import { logger, performanceMonitor } from './logger';

// Enhanced query builder with optimizations
export class OptimizedQueryBuilder {
  private table: string;
  private query: any;

  constructor(table: string) {
    this.table = table;
    this.query = (supabase as any).from(table);
  }

  // Select with field optimization
  select(fields: string = '*') {
    this.query = this.query.select(fields);
    return this;
  }

  // Filter with proper indexing
  eq(column: string, value: any) {
    this.query = this.query.eq(column, value);
    return this;
  }

  neq(column: string, value: any) {
    this.query = this.query.neq(column, value);
    return this;
  }

  gt(column: string, value: any) {
    this.query = this.query.gt(column, value);
    return this;
  }

  gte(column: string, value: any) {
    this.query = this.query.gte(column, value);
    return this;
  }

  lt(column: string, value: any) {
    this.query = this.query.lt(column, value);
    return this;
  }

  lte(column: string, value: any) {
    this.query = this.query.lte(column, value);
    return this;
  }

  like(column: string, value: string) {
    this.query = this.query.like(column, value);
    return this;
  }

  ilike(column: string, value: string) {
    this.query = this.query.ilike(column, value);
    return this;
  }

  in(column: string, values: any[]) {
    this.query = this.query.in(column, values);
    return this;
  }

  // Ordering for consistent results
  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.query = this.query.order(column, options);
    return this;
  }

  // Pagination for large datasets
  range(from: number, to: number) {
    this.query = this.query.range(from, to);
    return this;
  }

  // Limit results
  limit(count: number) {
    this.query = this.query.limit(count);
    return this;
  }

  // Execute with performance monitoring
  async execute() {
    const endTimer = performanceMonitor.startMeasurement(`query:${this.table}`);

    try {
      const { data, error, count } = await this.query;

      endTimer();

      if (error) {
        logger.error(`Database query failed for table: ${this.table}`, {
          error: error.message,
          code: error.code,
          details: error.details,
        });
        throw error;
      }

      logger.debug(`Query executed successfully for table: ${this.table}`, {
        recordCount: data?.length || 0,
        hasCount: !!count,
      });

      return { data, error: null, count };
    } catch (error) {
      endTimer();
      logger.error(`Query execution error for table: ${this.table}`, error);
      throw error;
    }
  }

  // Single record query
  async single() {
    const endTimer = performanceMonitor.startMeasurement(`query:${this.table}:single`);

    try {
      const { data, error } = await this.query.single();

      endTimer();

      if (error) {
        logger.error(`Single record query failed for table: ${this.table}`, {
          error: error.message,
          code: error.code,
        });
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      endTimer();
      logger.error(`Single record query error for table: ${this.table}`, error);
      throw error;
    }
  }
}

// Paginated query helper
export class PaginatedQuery {
  private queryBuilder: OptimizedQueryBuilder;
  private pageSize: number;
  private currentPage: number = 0;

  constructor(table: string, pageSize: number = 20) {
    this.queryBuilder = new OptimizedQueryBuilder(table);
    this.pageSize = pageSize;
  }

  // Set filters
  where(condition: (builder: OptimizedQueryBuilder) => OptimizedQueryBuilder) {
    this.queryBuilder = condition(this.queryBuilder);
    return this;
  }

  // Set ordering
  orderBy(column: string, ascending: boolean = true) {
    this.queryBuilder.order(column, { ascending });
    return this;
  }

  // Get current page
  async getPage(page: number = 0) {
    this.currentPage = page;

    const endTimer = logger.startTimer(`pagination:${this.queryBuilder['table']}:page${page}`);

    try {
      const from = page * this.pageSize;
      const to = from + this.pageSize - 1;

      const { data, error, count } = await this.queryBuilder
        .range(from, to)
        .execute();

      endTimer();

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / this.pageSize);
      const hasNextPage = page < totalPages - 1;
      const hasPrevPage = page > 0;

      logger.info(`Paginated query executed`, {
        table: this.queryBuilder['table'],
        page,
        pageSize: this.pageSize,
        totalRecords: count,
        returnedRecords: data?.length || 0,
        totalPages,
      });

      return {
        data: data || [],
        pagination: {
          page,
          pageSize: this.pageSize,
          totalCount: count || 0,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      endTimer();
      logger.error(`Paginated query failed`, {
        table: this.queryBuilder['table'],
        page,
        error,
      });
      throw error;
    }
  }

  // Get next page
  async nextPage() {
    return this.getPage(this.currentPage + 1);
  }

  // Get previous page
  async prevPage() {
    return this.getPage(Math.max(0, this.currentPage - 1));
  }
}

// Cached query helper for frequently accessed data
export class CachedQuery {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  async query<T>(
    key: string,
    queryFn: () => Promise<{ data: T; error: any }>,
    ttl: number = this.defaultTTL
  ): Promise<{ data: T; error: any; fromCache: boolean }> {
    const cached = this.cache.get(key);

    // Check if cache is valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      logger.debug(`Cache hit for key: ${key}`);
      return { data: cached.data, error: null, fromCache: true };
    }

    // Execute query
    const endTimer = performanceMonitor.startMeasurement(`cached-query:${key}`);

    try {
      const { data, error } = await queryFn();

      endTimer();

      if (error) {
        logger.error(`Cached query failed for key: ${key}`, error);
        throw error;
      }

      // Cache the result
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      });

      logger.debug(`Query cached for key: ${key}`, {
        recordCount: Array.isArray(data) ? data.length : 1,
        ttl: `${ttl / 1000}s`,
      });

      return { data, error: null, fromCache: false };
    } catch (error) {
      endTimer();
      logger.error(`Cached query error for key: ${key}`, error);
      throw error;
    }
  }

  // Clear specific cache entry
  invalidate(key: string) {
    this.cache.delete(key);
    logger.debug(`Cache invalidated for key: ${key}`);
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    logger.info('All cache cleared');
  }

  // Get cache stats
  getStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([_, value]) => now - value.timestamp < value.ttl).length,
      expiredEntries: entries.filter(([_, value]) => now - value.timestamp >= value.ttl).length,
    };
  }
}

// Export singleton instances
export const cachedQuery = new CachedQuery();

// Helper functions for common queries
export const createQueryBuilder = (table: string) => new OptimizedQueryBuilder(table);
export const createPaginatedQuery = (table: string, pageSize?: number) =>
  new PaginatedQuery(table, pageSize);

// Batch operations for bulk updates
export class BatchOperations {
  private operations: Array<{ table: string; operation: any }> = [];

  addUpdate(table: string, updates: Record<string, any>, filter: Record<string, any>) {
    this.operations.push({
      table,
      operation: { type: 'update', updates, filter },
    });
  }

  addInsert(table: string, data: Record<string, any>) {
    this.operations.push({
      table,
      operation: { type: 'insert', data },
    });
  }

  async execute() {
    const endTimer = logger.startTimer('batch-operations');

    try {
      const results = await Promise.allSettled(
        this.operations.map(async ({ table, operation }) => {
          switch (operation.type) {
            case 'update':
              return (supabase as any).from(table).update(operation.updates).match(operation.filter);
            case 'insert':
              return (supabase as any).from(table).insert(operation.data);
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }
        })
      );

      endTimer();

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      logger.info('Batch operations completed', {
        total: this.operations.length,
        successful,
        failed,
      });

      this.operations = []; // Clear operations

      return results;
    } catch (error) {
      endTimer();
      logger.error('Batch operations failed', error);
      throw error;
    }
  }
}

export const batchOperations = new BatchOperations();
