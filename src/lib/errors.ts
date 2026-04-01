// src/lib/errors.ts

export class ScopeGuardError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ScopeGuardError';
  }
}

export class InvalidRequestError extends ScopeGuardError {
  constructor(message: string) {
    super('INVALID_REQUEST', message, 400);
  }
}

export class UnregisteredAgentError extends ScopeGuardError {
  constructor(message = 'Request must come from a registered agent identity') {
    super('UNREGISTERED_AGENT', message, 401);
  }
}

export class InvalidTokenError extends ScopeGuardError {
  constructor(message = 'Agent token is invalid or expired') {
    super('IDENTITY_REJECTED', message, 401);
  }
}

export class RevokedAgentError extends ScopeGuardError {
  constructor(agentId: string) {
    super('AGENT_REVOKED', `Agent ${agentId} has been revoked`, 403);
  }
}

export class HardConstraintError extends ScopeGuardError {
  constructor(public violations: string[]) {
    super('HARD_CONSTRAINT_VIOLATION', 'Action blocked by security policy', 403);
  }
}

export class StepUpDeniedError extends ScopeGuardError {
  constructor() {
    super('STEPUP_DENIED', 'User denied this action', 403);
  }
}

export class StepUpTimeoutError extends ScopeGuardError {
  constructor() {
    super('STEPUP_TIMEOUT', 'User did not respond within time limit', 408);
  }
}