/**
 * Error handling and logging utilities
 * 
 * Provides consistent error codes, audit trail, and recovery strategies
 */

// Error code enumeration
export const ERROR_CODES = {
  // CRITICAL
  ERR_INVALID_URL: 'ERR_INVALID_URL',
  ERR_ROBOTS_FETCH_FAILED: 'ERR_ROBOTS_FETCH_FAILED',
  ERR_CRAWL_TIMEOUT: 'ERR_CRAWL_TIMEOUT',
  ERR_UNKNOWN_VERTICAL: 'ERR_UNKNOWN_VERTICAL',

  // MAJOR
  ERR_PAGE_NOT_FOUND: 'ERR_PAGE_NOT_FOUND',
  ERR_HTML_PARSE_FAILED: 'ERR_HTML_PARSE_FAILED',
  ERR_SCHEMA_PARSE_FAILED: 'ERR_SCHEMA_PARSE_FAILED',
  ERR_REDIRECT_LIMIT: 'ERR_REDIRECT_LIMIT',

  // MINOR
  ERR_EXTRACTION_TIMEOUT: 'ERR_EXTRACTION_TIMEOUT',
  ERR_REGEX_NO_MATCH: 'ERR_REGEX_NO_MATCH',
  ERR_NULL_FIELD: 'ERR_NULL_FIELD',
  ERR_FIELD_EXTRACTION_FAILED: 'ERR_FIELD_EXTRACTION_FAILED',

  // WARN
  ERR_ENCODING_MISMATCH: 'ERR_ENCODING_MISMATCH',
  ERR_CLASSIFICATION_AMBIGUOUS: 'ERR_CLASSIFICATION_AMBIGUOUS',
};

// Severity levels
export const SEVERITY = {
  CRITICAL: 'CRITICAL',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  WARN: 'WARN',
};

// Recovery actions
export const RECOVERY_ACTION = {
  ABORT_CRAWL: 'ABORT_CRAWL',
  SKIP_PAGE: 'SKIP_PAGE',
  SKIP_FIELD: 'SKIP_FIELD',
  USE_FALLBACK: 'USE_FALLBACK',
  CONTINUE: 'CONTINUE',
  RETRY: 'RETRY',
};

// Map error codes to severity
const ERROR_SEVERITY_MAP = {
  [ERROR_CODES.ERR_INVALID_URL]: SEVERITY.CRITICAL,
  [ERROR_CODES.ERR_ROBOTS_FETCH_FAILED]: SEVERITY.CRITICAL,
  [ERROR_CODES.ERR_CRAWL_TIMEOUT]: SEVERITY.CRITICAL,
  [ERROR_CODES.ERR_PAGE_NOT_FOUND]: SEVERITY.MAJOR,
  [ERROR_CODES.ERR_HTML_PARSE_FAILED]: SEVERITY.MAJOR,
  [ERROR_CODES.ERR_SCHEMA_PARSE_FAILED]: SEVERITY.MAJOR,
  [ERROR_CODES.ERR_REDIRECT_LIMIT]: SEVERITY.MAJOR,
  [ERROR_CODES.ERR_EXTRACTION_TIMEOUT]: SEVERITY.MINOR,
  [ERROR_CODES.ERR_REGEX_NO_MATCH]: SEVERITY.MINOR,
  [ERROR_CODES.ERR_NULL_FIELD]: SEVERITY.MINOR,
  [ERROR_CODES.ERR_FIELD_EXTRACTION_FAILED]: SEVERITY.MINOR,
  [ERROR_CODES.ERR_ENCODING_MISMATCH]: SEVERITY.WARN,
  [ERROR_CODES.ERR_CLASSIFICATION_AMBIGUOUS]: SEVERITY.WARN,
};

// Map error codes to default recovery
const ERROR_RECOVERY_MAP = {
  [ERROR_CODES.ERR_INVALID_URL]: RECOVERY_ACTION.ABORT_CRAWL,
  [ERROR_CODES.ERR_ROBOTS_FETCH_FAILED]: RECOVERY_ACTION.RETRY,
  [ERROR_CODES.ERR_CRAWL_TIMEOUT]: RECOVERY_ACTION.SKIP_PAGE,
  [ERROR_CODES.ERR_PAGE_NOT_FOUND]: RECOVERY_ACTION.SKIP_PAGE,
  [ERROR_CODES.ERR_HTML_PARSE_FAILED]: RECOVERY_ACTION.SKIP_PAGE,
  [ERROR_CODES.ERR_SCHEMA_PARSE_FAILED]: RECOVERY_ACTION.USE_FALLBACK,
  [ERROR_CODES.ERR_REDIRECT_LIMIT]: RECOVERY_ACTION.SKIP_PAGE,
  [ERROR_CODES.ERR_EXTRACTION_TIMEOUT]: RECOVERY_ACTION.SKIP_FIELD,
  [ERROR_CODES.ERR_REGEX_NO_MATCH]: RECOVERY_ACTION.CONTINUE,
  [ERROR_CODES.ERR_NULL_FIELD]: RECOVERY_ACTION.SKIP_FIELD,
  [ERROR_CODES.ERR_FIELD_EXTRACTION_FAILED]: RECOVERY_ACTION.SKIP_FIELD,
  [ERROR_CODES.ERR_ENCODING_MISMATCH]: RECOVERY_ACTION.CONTINUE,
  [ERROR_CODES.ERR_CLASSIFICATION_AMBIGUOUS]: RECOVERY_ACTION.CONTINUE,
};

/**
 * CrawlError - structured error with context
 */
export class CrawlError extends Error {
  constructor(errorCode, message, context = {}) {
    super(message);
    this.name = 'CrawlError';
    this.errorCode = errorCode;
    this.severity = ERROR_SEVERITY_MAP[errorCode] || SEVERITY.WARN;
    this.recoveryAction = ERROR_RECOVERY_MAP[errorCode] || RECOVERY_ACTION.CONTINUE;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      errorCode: this.errorCode,
      message: this.message,
      severity: this.severity,
      recoveryAction: this.recoveryAction,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * AuditTrail - collects all errors and events during crawl
 */
export class AuditTrail {
  constructor() {
    this.entries = [];
    this.startTime = Date.now();
  }

  logError(errorCode, message, context = {}) {
    const error = new CrawlError(errorCode, message, context);
    this.entries.push({
      type: 'error',
      level: error.severity,
      errorCode: error.errorCode,
      message: error.message,
      context: error.context,
      recoveryAction: error.recoveryAction,
      timestamp: error.timestamp,
    });
    return error;
  }

  logWarn(message, context = {}) {
    this.entries.push({
      type: 'warn',
      level: SEVERITY.WARN,
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  logInfo(message, context = {}) {
    this.entries.push({
      type: 'info',
      level: 'INFO',
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  logEvent(eventType, data = {}) {
    this.entries.push({
      type: 'event',
      eventType,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Count errors by severity
   */
  getSummary() {
    const summary = {
      total: this.entries.length,
      critical: 0,
      major: 0,
      minor: 0,
      warn: 0,
      info: 0,
      durationMs: Date.now() - this.startTime,
    };

    for (const entry of this.entries) {
      if (entry.level === SEVERITY.CRITICAL) summary.critical++;
      else if (entry.level === SEVERITY.MAJOR) summary.major++;
      else if (entry.level === SEVERITY.MINOR) summary.minor++;
      else if (entry.level === SEVERITY.WARN) summary.warn++;
      else summary.info++;
    }

    return summary;
  }

  /**
   * Get errors that require action
   */
  getActionableErrors() {
    return this.entries.filter(
      (e) => e.type === 'error' && [SEVERITY.CRITICAL, SEVERITY.MAJOR].includes(e.level)
    );
  }

  toJSON() {
    return {
      summary: this.getSummary(),
      entries: this.entries,
    };
  }
}

/**
 * Safe extractor wrapper - catches failures gracefully
 */
export function safeExtract(name, extractorFn, audit, fallback = null) {
  try {
    const result = extractorFn();
    if (result === undefined || result === null) {
      audit.logWarn(`Extractor "${name}" returned null/undefined`, { extractor: name });
      return fallback;
    }
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    audit.logError(
      ERROR_CODES.ERR_FIELD_EXTRACTION_FAILED,
      `Extractor "${name}" failed: ${errorMsg}`,
      { extractor: name, error: errorMsg, stack: err.stack }
    );
    return fallback;
  }
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout(promise, timeoutMs, timeoutMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new CrawlError(
              ERROR_CODES.ERR_EXTRACTION_TIMEOUT,
              timeoutMsg || `Operation timed out after ${timeoutMs}ms`,
              { timeoutMs }
            )
          ),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Validate URL format
 */
export function validateUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new CrawlError(
        ERROR_CODES.ERR_INVALID_URL,
        `Invalid protocol: ${url.protocol}`,
        { url: urlStr }
      );
    }
    return url;
  } catch (err) {
    if (err instanceof CrawlError) throw err;
    throw new CrawlError(
      ERROR_CODES.ERR_INVALID_URL,
      `URL parsing failed: ${err.message}`,
      { url: urlStr }
    );
  }
}

/**
 * Null-safety check for nested objects
 */
export function safeGet(obj, path, defaultValue = null) {
  try {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return defaultValue;
      current = current[key];
    }
    return current !== undefined ? current : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Detect encoding mismatch
 */
export function detectEncodingIssue(text) {
  if (!text) return null;
  // Check for mojibake patterns (garbled text)
  const suspiciousPatterns = [/[\u0080-\u00FF]{5,}/g, /[\ufffd]{2,}/g];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}
