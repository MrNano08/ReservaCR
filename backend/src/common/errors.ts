import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { Response } from "express";

// Additive response contract; messages and HTTP semantics remain unchanged.
export const coded = (code: string, message: string) => ({ code, message });

export function errorResponse(error: unknown) {
  const e = error as { code?: string; stack?: string } | null;
  const statusCode = error instanceof HttpException ? error.getStatus() : e?.code === "ER_DUP_ENTRY" ? 409 : 500;
  const detail = error instanceof HttpException ? error.getResponse() : null;
  const data = typeof detail === "object" && detail !== null ? detail as { code?: string; message?: string | string[]; fieldErrors?: unknown } : null;
  const message = typeof detail === "string" ? detail : data?.message;
  const fallback: Record<number, string> = {
    400: "VALIDATION_ERROR", 401: "AUTH_UNAUTHORIZED", 403: "AUTH_FORBIDDEN",
    404: "RESOURCE_NOT_FOUND", 409: "RESOURCE_CONFLICT", 413: "OWNER_IMAGE_TOO_LARGE",
    429: "RATE_LIMITED", 503: "SERVICE_UNAVAILABLE",
  };
  return {
    statusCode,
    code: statusCode === 500 ? "INTERNAL_ERROR" : data?.code || fallback[statusCode] || "UNKNOWN_ERROR",
    message: statusCode === 500 ? "No se pudo completar la operación. Inténtalo de nuevo." : message || "Ya existe un registro con esos datos.",
    ...(statusCode !== 500 && data?.fieldErrors ? { fieldErrors: data.fieldErrors } : {}),
  };
}

@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const body = errorResponse(error);
    if (body.statusCode === 500) Logger.error(error instanceof Error ? error.stack : "Error interno", "API");
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
