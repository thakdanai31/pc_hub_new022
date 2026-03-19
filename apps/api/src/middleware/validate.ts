import type { Request, Response, NextFunction } from "express";
import type { z } from "zod/v4";

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

function formatFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_root";
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

function sendValidationError(
  res: Response,
  message: string,
  error: z.ZodError,
): void {
  res.status(400).json({
    success: false,
    message,
    code: "VALIDATION_ERROR",
    fieldErrors: formatFieldErrors(error),
  });
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        sendValidationError(res, "Validation failed", result.error);
        return;
      }
      req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        sendValidationError(res, "Invalid parameters", result.error);
        return;
      }
      // Re-assign parsed data to req.params to ensure controllers receive coerced types
      req.params = result.data as Record<string, string>;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        sendValidationError(res, "Invalid query parameters", result.error);
        return;
      }
      // Re-assign parsed data to req.query to ensure controllers receive coerced types
      req.query = result.data as typeof req.query;
    }

    next();
  };
}
