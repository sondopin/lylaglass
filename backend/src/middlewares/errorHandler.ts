import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { MulterError } from "multer";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import { env } from "@/config/env";

/**
 * Upload failures the client can actually fix, phrased for the person doing the
 * uploading. Anything not listed is a genuine server problem.
 */
const MULTER_MESSAGES: Record<string, { status: number; message: string }> = {
  LIMIT_FILE_SIZE: { status: 413, message: "Ảnh vượt quá dung lượng tối đa 5MB" },
  LIMIT_UNEXPECTED_FILE: { status: 400, message: 'Tệp phải được gửi ở trường "image"' },
  LIMIT_FILE_COUNT: { status: 400, message: "Chỉ được tải lên một ảnh mỗi lần" },
  LIMIT_PART_COUNT: { status: 400, message: "Biểu mẫu tải lên có quá nhiều phần" },
};

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

  // Multer rejects an oversized or misnamed upload with its own error type,
  // which is a client mistake rather than a server fault — without this it fell
  // through to a generic 500 and the uploader was told to "try again later" for
  // a file that will never be accepted.
  if (err instanceof MulterError) {
    const known = MULTER_MESSAGES[err.code];
    if (known) {
      return res.status(known.status).json({ success: false, error: { message: known.message } });
    }
    logger.warn({ err }, "Lỗi upload chưa được phân loại");
    return res.status(400).json({ success: false, error: { message: "Tải tệp lên thất bại" } });
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
