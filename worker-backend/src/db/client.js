import { drizzle } from 'drizzle-orm/d1';
import { runRead, runWrite, runBatchWrite } from '../utils/db.js';

/**
 * Creates a wrapped DB client that executes Drizzle ORM queries through
 * our custom replication & caching layers (runRead and runWrite).
 * 
 * @param {object} env - Cloudflare Worker environment bindings
 * @param {object} request - Current HTTP request context (for x-read-db override headers)
 * @returns {object} Drizzle ORM DB client instance
 */
export function getDrizzleDb(env, request = null) {
  // Create a custom D1Database proxy wrapper
  const wrappedD1 = {
    prepare(sql) {
      const sqlTrimLower = sql.trim().toLowerCase();
      const isSelect = sqlTrimLower.startsWith("select") || sqlTrimLower.startsWith("with");

      const createStatement = (params = []) => {
        return {
          sql,
          params,
          // Support executing single query returning rows
          async all() {
            if (isSelect) {
              return await runRead(env, sql, params, request);
            } else {
              return await runWrite(env, sql, params);
            }
          },
          // Support executing single command returning metadata
          async run() {
            if (isSelect) {
              return await runRead(env, sql, params, request);
            } else {
              return await runWrite(env, sql, params);
            }
          },
          // Support executing single row helper
          async first(column) {
            if (isSelect) {
              const res = await runRead(env, sql, params, request);
              const row = res.results && res.results[0];
              if (!row) return null;
              if (column) return row[column];
              return row;
            } else {
              return await runWrite(env, sql, params);
            }
          },
          async raw() {
            const res = await this.all();
            if (!res) return [];
            const results = res.results || [];
            if (results.length === 0) return [];
            return results.map(row => Object.values(row));
          },
          async values() {
            return await this.raw();
          },
          // Drizzle calls bind to substitute parameters
          bind(...newParams) {
            return createStatement(newParams);
          }
        };
      };

      return createStatement([]);
    },

    async batch(statements) {
      // Check if there are any write statements in the batch
      const hasWrite = statements.some(s => {
        const sqlTrimLower = (s.sql || "").trim().toLowerCase();
        return !sqlTrimLower.startsWith("select") && !sqlTrimLower.startsWith("with");
      });

      if (hasWrite) {
        // Run as replicated batch write
        return await runBatchWrite(env, statements);
      } else {
        // Execute sequentially through runRead
        const results = [];
        for (const stmt of statements) {
          results.push(await stmt.all());
        }
        return results;
      }
    },

    async exec(sql) {
      const sqlTrimLower = sql.trim().toLowerCase();
      const isSelect = sqlTrimLower.startsWith("select") || sqlTrimLower.startsWith("with");
      if (isSelect) {
        return await runRead(env, sql, [], request);
      } else {
        return await runWrite(env, sql, []);
      }
    }
  };

  return drizzle(wrappedD1);
}
