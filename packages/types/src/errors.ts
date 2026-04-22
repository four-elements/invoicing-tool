export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message = 'Nicht authentifiziert') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class PermissionDeniedError extends Error {
  readonly statusCode = 403;
  readonly permission: string;
  constructor(permission: string) {
    super(`Keine Berechtigung: ${permission}`);
    this.name = 'PermissionDeniedError';
    this.permission = permission;
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(resource: string, id?: string) {
    super(id ? `${resource} nicht gefunden: ${id}` : `${resource} nicht gefunden`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Standardisiertes Server-Action-Rückgabeformat
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
