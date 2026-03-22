export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "RepositoryError";
    this.cause = options?.cause;
  }
}

export class ItemAlreadyExistsError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ItemAlreadyExistsError";
  }
}

export class ItemNotFoundError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ItemNotFoundError";
  }
}
