import { SoundSettings } from "../lib/types";

export class SoundSettingsService {
  private static STORAGE_KEY = "sound_settings";

  static getSoundSettings(username: string): SoundSettings {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${username}`);

      if (stored) {
        return JSON.parse(stored);
      }

      // Return default settings if none exist
      return this.getDefaultSettings(username);
    } catch (error) {
      console.error("Error fetching sound settings from localStorage:", error);
      return this.getDefaultSettings(username);
    }
  }

  static updateSoundSettings(
    username: string,
    settings: Partial<SoundSettings>
  ): void {
    try {
      const currentSettings = this.getSoundSettings(username);
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        userId: username,
        updatedAt: new Date(),
      };

      localStorage.setItem(
        `${this.STORAGE_KEY}_${username}`,
        JSON.stringify(updatedSettings)
      );
    } catch (error) {
      console.error("Error updating sound settings in localStorage:", error);
      throw error;
    }
  }

  static clearSoundSettings(username: string): void {
    try {
      localStorage.removeItem(`${this.STORAGE_KEY}_${username}`);
    } catch (error) {
      console.error("Error clearing sound settings from localStorage:", error);
    }
  }

  private static getDefaultSettings(username: string): SoundSettings {
    return {
      userId: username,
      clockInSound: "musical-success",
      clockOutSound: "notification-chime",
      pieceworkSound: "musical-mario",
      volume: 0.8,
      vibrationEnabled: true,
    };
  }
}
