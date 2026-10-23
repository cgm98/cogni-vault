export class DomainError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Datos de entrada inválidos') {
    super(message, 422);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflicto de entidad') {
    super(message, 409);
  }
}
