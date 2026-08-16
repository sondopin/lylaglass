import { Response } from "express";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, pagination?: Pagination) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
  });
}

export function sendCreated<T>(res: Response, data: T) {
  return sendSuccess(res, data, 201);
}
