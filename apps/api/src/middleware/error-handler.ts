import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import multer from "multer";
import { AppError } from "../common/errors.js";
import { env } from "../config/env.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      success: false,
      message: err.message,
      code: err.code,
    };

    if ("invalidItems" in err) {
      body["invalidItems"] = err.invalidItems;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : "_root";
      if (!(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      fieldErrors,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 5MB"
        : `Upload error: ${err.message}`;
    res.status(400).json({
      success: false,
      message,
      code: "UPLOAD_ERROR",
    });
    return;
  }

  if (env.NODE_ENV !== "production") {
    console.error("Unhandled error:", err);
  }

  const message =
    env.NODE_ENV === "production" ? "Internal server error" : err.message;

  res.status(500).json({
    success: false,
    message,
    code: "INTERNAL_ERROR",
  });
}
