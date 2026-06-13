/**
 * In-memory representation of a single crawl log entry.
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp of when the action occurred.
 * @property {string} url - Target URL that was processed or crawled.
 * @property {number|string} status - HTTP response status code, or error flag/code.
 * @property {number} durationMs - Request-response roundtrip duration in milliseconds.
 * @property {string} notes - Contextual information or diagnostic messages.
 */

class CrawlLogger {
  constructor() {
    /** @type {LogEntry[]} */
    this.logs = [];
  }

  /**
   * Appends a new event or request details to the crawler log.
   * @param {string} url - The URL processed.
   * @param {number|string} status - HTTP status (e.g. 200, 404) or 'ERR' / 'TIMEOUT'.
   * @param {number} durationMs - Elapsed duration for the operation.
   * @param {string} [notes=""] - Optional context or error description.
   */
  add(url, status, durationMs, notes = "") {
    try {
      this.logs.push({
        timestamp: new Date().toISOString(),
        url: url || "UNKNOWN",
        status: status !== undefined ? status : "N/A",
        durationMs: typeof durationMs === "number" ? durationMs : 0,
        notes: notes || ""
      });
    } catch (e) {
      console.error("Failed to append to crawl logs", e);
    }
  }

  /**
   * Returns all accumulated logs.
   * @returns {LogEntry[]} List of logs.
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Resets the logs array. Useful before starting a new crawl execution.
   */
  clear() {
    this.logs = [];
  }
}

const instance = new CrawlLogger();

/**
 * Returns the global singleton instance of the CrawlLogger.
 * All modules share this instance to record trace history in a unified manner.
 * 
 * @returns {CrawlLogger} The shared logger instance.
 */
export default function getLogger() {
  return instance;
}