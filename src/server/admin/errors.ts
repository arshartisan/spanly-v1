import "server-only";

/**
 * Typed guard failure shared across admin services (docs 16/17). Routes translate
 * `.status` into the HTTP response code. Originally defined in `admin/users.ts`;
 * extracted here so the billing service reuses the exact same shape.
 */
export class AdminActionError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
  }
}
