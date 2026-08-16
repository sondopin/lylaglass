import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import { env } from "@/config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { message: `Không tìm thấy route ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Dữ liệu gửi lên không hợp lệ",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, error: { message: "Định dạng ID không hợp lệ" } });
  }

  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({ success: false, error: { message: "Dữ liệu đã tồn tại (trùng lặp)" } });
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({
    success: false,
    error: {
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
      ...(env.isProduction ? {} : { stack: err instanceof Error ? err.stack : String(err) }),
    },
  });
}
