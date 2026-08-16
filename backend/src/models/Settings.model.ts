import { Schema, model, InferSchemaType } from "mongoose";

// Singleton document (a single row holding store-wide settings editable from the admin dashboard).
const settingsSchema = new Schema(
  {
    key: { type: String, default: "store", unique: true },
    freeShippingThreshold: { type: Number, default: 490_000 },
    flatShippingFee: { type: Number, default: 30_000 },
    storeName: { type: String, default: "LylaGlass" },
    supportEmail: { type: String, default: "hello@lylaglass.vn" },
    supportPhone: { type: String, default: "1900 636 999" },
  },
  { timestamps: true }
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model("Settings", settingsSchema);
