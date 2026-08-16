import multer from "multer";
import { ApiError } from "@/utils/ApiError";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(ApiError.badRequest("Chỉ chấp nhận ảnh JPEG, PNG, WEBP hoặc AVIF"));
    }
    cb(null, true);
  },
}).single("image");
