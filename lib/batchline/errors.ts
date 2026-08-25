/**
 * Unified Batchline error formatter
 * Safely extracts human-readable error messages from various Batchline API response shapes:
 * - { error: { detail: "...", message: "...", title: "..." } }
 * - { detail: "..." } or { detail: [...] }
 * - { errors: [...] } or { errors: { ... } }
 * - { message: "..." }
 * - string responses
 * - HTTP status code fallbacks
 */
export function formatBatchlineErrorDetail(data: unknown, fallbackStatus?: number): string {
  if (!data && fallbackStatus) return `HTTP ${fallbackStatus}`;
  if (typeof data === "string" && data.trim()) return data.trim();

  if (typeof data === "object" && data !== null) {
    const obj = (data as Record<string, any>).error && typeof (data as Record<string, any>).error === "object"
      ? (data as Record<string, any>).error
      : (data as Record<string, any>);

    const parts: string[] = [];

    // 1. Nested detail
    if (typeof obj.detail === "string" && obj.detail.trim()) {
      parts.push(obj.detail.trim());
    } else if (Array.isArray(obj.detail)) {
      parts.push(
        ...obj.detail
          .map((d: unknown) => (typeof d === "string" ? d.trim() : typeof d === "object" && d !== null ? JSON.stringify(d) : String(d)))
          .filter(Boolean)
      );
    }

    // 2. Specific message
    if (typeof obj.message === "string" && obj.message.trim() && !parts.includes(obj.message.trim())) {
      parts.push(obj.message.trim());
    }

    // 3. Validation errors array/object
    if (Array.isArray(obj.errors)) {
      parts.push(
        ...obj.errors
          .map((e: unknown) => (typeof e === "string" ? e.trim() : typeof e === "object" && e !== null ? JSON.stringify(e) : String(e)))
          .filter(Boolean)
      );
    } else if (typeof obj.errors === "object" && obj.errors !== null) {
      try {
        parts.push(JSON.stringify(obj.errors));
      } catch {
        /* ignore */
      }
    }

    // 4. String error field
    if (typeof obj.error === "string" && obj.error.trim() && !parts.includes(obj.error.trim())) {
      parts.push(obj.error.trim());
    }

    if (parts.length > 0) {
      return parts.join(" — ");
    }

    // 5. Title fallback
    if (typeof obj.title === "string" && obj.title.trim()) {
      return obj.title.trim();
    }

    // 6. Status string fallback
    if (typeof obj.status === "string" && obj.status.trim()) {
      return obj.status.trim();
    }
  }

  return fallbackStatus ? `HTTP ${fallbackStatus}` : "Batchline API returned an error";
}
