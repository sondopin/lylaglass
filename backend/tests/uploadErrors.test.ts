import { MulterError } from "multer";
import { describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import mongoose from "mongoose";

/**
 * Upload failures must reach the admin as something actionable.
 *
 * Before this mapping existed, an oversized file and a misnamed form field both
 * surfaced as a generic 500 "vui lòng thử lại sau" — advice that can never work,
 * because retrying a 40MB file fails identically every time.
 */

vi.mock("@/config/env", () => ({
  env: { isProduction: false, nodeEnv: "test" },
}));

vi.mock("@/config/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { errorHandler } = await import("@/middlewares/errorHandler");
const { ApiError } = await import("@/utils/ApiError");

/** Minimal Express response double capturing the status and JSON body. */
function mockResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function handle(err: unknown) {
  const res = mockResponse();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorHandler(err, {} as any, res as any, vi.fn() as any);
  return { status: res.statusCode, body: res.body as { success: boolean; error: { message: string } } };
}

describe("upload error mapping", () => {
  it("reports an oversized file as 413 with the actual limit", () => {
    const { status, body } = handle(new MulterError("LIMIT_FILE_SIZE", "image"));

    expect(status).toBe(413);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain("5MB");
  });

  it("reports a misnamed form field as 400 naming the expected field", () => {
    const { status, body } = handle(new MulterError("LIMIT_UNEXPECTED_FILE", "avatar"));

    expect(status).toBe(400);
    expect(body.error.message).toContain("image");
  });

  it("reports too many files as 400", () => {
    expect(handle(new MulterError("LIMIT_FILE_COUNT", "image")).status).toBe(400);
  });

  it("falls back to 400 — not 500 — for an unclassified upload error", () => {
    // Any MulterError is a rejected upload, so even an unmapped code is the
    // client's problem rather than a server fault.
    const { status, body } = handle(new MulterError("LIMIT_FIELD_KEY", "image"));

    expect(status).toBe(400);
    expect(body.error.message).toBe("Tải tệp lên thất bại");
  });

  it("never leaks multer's internal wording to the client", () => {
    const { body } = handle(new MulterError("LIMIT_FILE_SIZE", "image"));

    expect(body.error.message).not.toContain("LIMIT_");
    expect(body.error.message).not.toContain("Unexpected");
  });
});

describe("other error kinds still map as before", () => {
  it("keeps an ApiError's own status", () => {
    expect(handle(ApiError.badRequest("Vui lòng chọn một tệp ảnh")).status).toBe(400);
  });

  it("maps a Zod failure to 400 with field details", () => {
    let zodError: ZodError;
    try {
      z.object({ url: z.string().url() }).parse({ url: "not-a-url" });
      throw new Error("expected a ZodError");
    } catch (err) {
      zodError = err as ZodError;
    }

    const { status, body } = handle(zodError!);
    expect(status).toBe(400);
    expect((body as unknown as { error: { details: unknown[] } }).error.details).toHaveLength(1);
  });

  it("maps a duplicate key to 409", () => {
    expect(handle({ code: 11000 }).status).toBe(409);
  });

  it("maps a malformed ObjectId to 400", () => {
    const castError = new mongoose.Error.CastError("ObjectId", "abc", "_id");
    expect(handle(castError).status).toBe(400);
  });

  it("still returns 500 for a genuinely unexpected failure", () => {
    const { status, body } = handle(new Error("ổ đĩa bốc cháy"));

    expect(status).toBe(500);
    // The real cause never reaches the client.
    expect(body.error.message).not.toContain("ổ đĩa");
  });
});
