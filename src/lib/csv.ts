/**
 * Dependency-free CSV parser (RFC 4180-ish) for bulk import (Phase 9 / doc 12 follow-on).
 * Handles quoted fields, embedded commas/newlines, and "" escaped quotes. We avoid a CSV
 * library to keep the dependency surface small — this is the only place we parse CSV.
 */

/** Parse raw CSV text into rows of string cells. Blank trailing lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Normalise newlines so \r\n and \r behave like \n.
  const src = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += ch;
    }
  }

  // Flush the final field/row if the file didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty rows (e.g. a trailing blank line that still produced [""]).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/**
 * Parse CSV with a header row into objects keyed by lowercased, trimmed header name.
 * Returns the detected headers and one record per data row (cells beyond the header
 * count are ignored; missing cells default to "").
 */
export function parseCsvWithHeader(text: string): {
  headers: string[];
  records: Record<string, string>[];
} {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = (cells[idx] ?? "").trim();
    });
    return rec;
  });
  return { headers, records };
}
