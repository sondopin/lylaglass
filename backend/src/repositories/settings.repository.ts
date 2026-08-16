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
  update: (data: Record<string, unknown>) =>
    SettingsModel.findOneAndUpdate({ key: "store" }, data, { new: true, upsert: true, runValidators: true }).lean(),
};
