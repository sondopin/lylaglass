import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendCreated } from "@/utils/apiResponse";
import { ApiError } from "@/utils/ApiError";
import { uploadImageBuffer } from "@/config/cloudinary";

export const uploadProductImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("Vui lòng chọn một tệp ảnh");
  const result = await uploadImageBuffer(req.file.buffer, "products");
  sendCreated(res, result);
});
