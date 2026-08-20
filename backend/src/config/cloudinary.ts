import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";
import { logger } from "./logger";
import { ApiError } from "@/utils/ApiError";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

export { cloudinary };

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
}

export function uploadImageBuffer(buffer: Buffer, folder: string): Promise<UploadedImage> {
  if (!isCloudinaryConfigured()) {
    throw ApiError.internal("Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `lylaglass/${folder}`,
        resource_type: "image",
        // Server-side guard: the mime check in the upload middleware trusts the
        // client's Content-Type, so restrict what Cloudinary will accept too.
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
      },
      (error, result) => {
        if (error || !result) {
          // Cloudinary rejects with a plain `{ message, http_code }` object, not
          // an Error — logging it raw produced a useless "[object Object]"
          // stack, so it is normalised before it leaves this module.
          const detail =
            error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
          logger.error({ cloudinary: detail || error }, "Cloudinary upload thất bại");
          return reject(ApiError.internal("Tải ảnh lên thất bại, vui lòng thử lại"));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Removes an image from Cloudinary. Failures are swallowed: an orphaned asset
 * is a storage cost, whereas a failed delete that propagated would block the
 * product edit the admin actually asked for.
 */
export async function deleteImageByPublicId(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured() || !publicId) return false;
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return result.result === "ok" || result.result === "not found";
  } catch (err) {
    logger.warn({ err, publicId }, "Không xoá được ảnh trên Cloudinary");
    return false;
  }
}
