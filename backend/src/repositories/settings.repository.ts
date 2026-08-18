import { SettingsModel } from "@/models/Settings.model";

export const settingsRepository = {
  async get() {
    const settings = await SettingsModel.findOneAndUpdate(
      { key: "store" },
      { $setOnInsert: { key: "store" } },
      { upsert: true, new: true }
    ).lean();
    return settings;
  },

  /**
   * Read-only settings lookup for the hot path (every checkout computes a
   * shipping fee).
   *
   * `get()` upserts, which turns one shared document into a write hotspot that
   * every concurrent checkout contends on — and inside a transaction that
   * becomes a write conflict rather than just contention. Reading instead, and
   * falling back to the schema defaults when the singleton has not been seeded
   * yet, keeps checkout free of writes it does not need.
   */
  async read() {
    const settings = await SettingsModel.findOne({ key: "store" }).lean();
    return settings ?? (new SettingsModel({ key: "store" }).toObject() as NonNullable<typeof settings>);
  },
  update: (data: Record<string, unknown>) =>
    SettingsModel.findOneAndUpdate({ key: "store" }, data, { new: true, upsert: true, runValidators: true }).lean(),
};
