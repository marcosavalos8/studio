"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ColorScheme = "blue" | "green" | "purple" | "orange";
export type FontSize = "small" | "medium" | "large" | "xlarge";
export type SidebarPosition = "left" | "right";
export type Language = "es" | "en";
export type DateFormat = "mm-dd-yyyy" | "dd-mm-yyyy" | "yyyy-mm-dd";

export interface Settings {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  highContrast: boolean;
  fontSize: FontSize;
  compactMode: boolean;
  animations: boolean;
  sidebarPosition: SidebarPosition;
  language: Language;
  dateFormat: DateFormat;
  invoicePassword: string;
  laborReportPassword: string;
  payrollPassword: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  themeMode: "light",
  colorScheme: "blue",
  highContrast: false,
  fontSize: "medium",
  compactMode: false,
  animations: true,
  sidebarPosition: "left",
  language: "es",
  dateFormat: "mm-dd-yyyy",
  invoicePassword: "4321",
  laborReportPassword: "4321",
  payrollPassword: "4321",
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    
    try {
      const savedSettings = localStorage.getItem("app-settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Failed to parse saved settings:", error);
    }
  }, []);

  // Apply theme changes to document
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const root = document.documentElement;

    // Apply theme mode
    const applyTheme = (theme: "light" | "dark") => {
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (settings.themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mediaQuery.matches ? "dark" : "light");

      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } else {
      applyTheme(settings.themeMode);
    }
  }, [settings.themeMode, mounted]);

  // Apply color scheme
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const schemes = ["blue", "green", "purple", "orange"];
    
    // Remove all scheme classes
    schemes.forEach((scheme) => root.classList.remove(`theme-${scheme}`));
    
    // Add current scheme class
    root.classList.add(`theme-${settings.colorScheme}`);
  }, [settings.colorScheme, mounted]);

  // Apply font size
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const sizes = ["small", "medium", "large", "xlarge"];
    
    // Remove all size classes
    sizes.forEach((size) => root.classList.remove(`text-${size}`));
    
    // Add current size class
    root.classList.add(`text-${settings.fontSize}`);
  }, [settings.fontSize, mounted]);

  // Apply compact mode
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (settings.compactMode) {
      root.classList.add("compact-mode");
    } else {
      root.classList.remove("compact-mode");
    }
  }, [settings.compactMode, mounted]);

  // Apply animations
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (!settings.animations) {
      root.classList.add("no-animations");
    } else {
      root.classList.remove("no-animations");
    }
  }, [settings.animations, mounted]);

  // Apply high contrast
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, [settings.highContrast, mounted]);

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("app-settings", JSON.stringify(newSettings));
        } catch (error) {
          console.error("Failed to save settings:", error);
        }
      }
      return newSettings;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("app-settings", JSON.stringify(defaultSettings));
      } catch (error) {
        console.error("Failed to reset settings:", error);
      }
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
