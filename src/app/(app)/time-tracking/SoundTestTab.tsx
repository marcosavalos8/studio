"use client";
import {
  AVAILABLE_SOUNDS,
  SoundSettings,
  SoundOption,
} from "../../../lib/types";

import React, { useState, useCallback, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FirebaseContext } from "@/firebase/provider";
import { SoundSettingsService } from "@/services/SoundSettingsService";

interface SoundTestTabProps {
  audioContext: AudioContext | null;
  onSettingsSaved?: () => void;
  username?: string;
}

export default function SoundTestTab({ audioContext, onSettingsSaved, username: propUsername }: SoundTestTabProps) {
  const { user } = useContext(FirebaseContext);
  const { toast } = useToast();

  // Use prop username if provided, otherwise fall back to user.displayName, then "default"
  const username = propUsername || user?.displayName || "default";
  
  console.log("SoundTestTab username:", username);
  console.log("propUsername:", propUsername);
  console.log("user?.displayName:", user?.displayName);

  const [settings, setSettings] = useState<SoundSettings>(
    SoundSettingsService.getSoundSettings(username)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track when settings change to show unsaved indicator
  const handleSettingsChange = useCallback((newSettings: Partial<SoundSettings>) => {
    console.log("Settings changed:", newSettings);
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      console.log("Updated settings:", updated);
      return updated;
    });
    setHasUnsavedChanges(true);
    console.log("hasUnsavedChanges set to true");
  }, []);

  // Save button handler
  const handleSave = useCallback(() => {
    console.log("Save button clicked");
    console.log("Username being used:", username);
    console.log("Settings to save:", settings);
    console.log("hasUnsavedChanges:", hasUnsavedChanges);
    
    try {
      SoundSettingsService.updateSoundSettings(username, settings);
      setHasUnsavedChanges(false);
      
      console.log("Settings saved successfully to key:", `sound_settings_${username}`);
      
      toast({
        title: "Configuración Guardada",
        description: "Tu configuración de sonido se ha guardado correctamente.",
        duration: 2000,
      });

      // Notify parent that settings were saved
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la configuración. Revisa la consola para más detalles.",
        duration: 3000,
      });
    }
  }, [settings, username, toast, onSettingsSaved, hasUnsavedChanges]);

  const playSound = useCallback(
    (soundId: string, customVolume?: number) => {
      if (!audioContext) {
        toast({
          variant: "destructive",
          title: "Audio Not Available",
          description: "Click anywhere on the page first to enable audio.",
        });
        return;
      }

      const soundOption = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
      if (!soundOption) return;

      // Crear y reproducir el sonido
      let currentTime = audioContext.currentTime;

      soundOption.frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(freq, currentTime);
        oscillator.type = soundOption.waveType;

        const volume =
          customVolume !== undefined ? customVolume : settings.volume;
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.01);

        const duration = soundOption.durations[index] || 0.2;
        const gap = soundOption.gaps[index] || 0.1;

        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + duration
        );

        currentTime += duration + gap;
      });

      // Vibración
      if (settings.vibrationEnabled && soundOption.vibrationPattern) {
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(soundOption.vibrationPattern);
          }
        } catch (e) {
          console.debug("Vibration not supported:", e);
        }
      }
    },
    [audioContext, settings, toast]
  );

  const getSoundOptionById = (id: string) =>
    AVAILABLE_SOUNDS.find((s) => s.id === id);

  const groupedSounds = AVAILABLE_SOUNDS.reduce((acc, sound) => {
    if (!acc[sound.category]) {
      acc[sound.category] = [];
    }
    acc[sound.category].push(sound);
    return acc;
  }, {} as Record<string, SoundOption[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔊 Sound Control Center
        </CardTitle>
        <CardDescription>
          Configura los sonidos de producción y prueba diferentes opciones. Haz clic en "Guardar Configuración" para guardar tus cambios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Production Settings */}
        <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50 dark:bg-blue-950/20">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-800 dark:text-blue-200">
            ⚙️ Production Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Clock In Sound */}
            <div className="space-y-3">
              <Label htmlFor="clock-in-sound" className="text-sm font-medium">
                🟢 Clock In Sound
              </Label>
              <div className="flex gap-2">
                <Select
                  value={settings.clockInSound}
                  onValueChange={(value) =>
                    handleSettingsChange({ clockInSound: value })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SOUNDS.map((sound) => (
                      <SelectItem key={sound.id} value={sound.id}>
                        {sound.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => playSound(settings.clockInSound)}
                >
                  ▶️
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {getSoundOptionById(settings.clockInSound)?.description}
              </p>
            </div>

            {/* Clock Out Sound */}
            <div className="space-y-3">
              <Label htmlFor="clock-out-sound" className="text-sm font-medium">
                🔴 Clock Out Sound
              </Label>
              <div className="flex gap-2">
                <Select
                  value={settings.clockOutSound}
                  onValueChange={(value) =>
                    handleSettingsChange({ clockOutSound: value })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SOUNDS.map((sound) => (
                      <SelectItem key={sound.id} value={sound.id}>
                        {sound.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => playSound(settings.clockOutSound)}
                >
                  ▶️
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {getSoundOptionById(settings.clockOutSound)?.description}
              </p>
            </div>

            {/* Piecework Sound */}
            <div className="space-y-3">
              <Label htmlFor="piecework-sound" className="text-sm font-medium">
                📦 Piecework Sound
              </Label>
              <div className="flex gap-2">
                <Select
                  value={settings.pieceworkSound}
                  onValueChange={(value) =>
                    handleSettingsChange({ pieceworkSound: value })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SOUNDS.map((sound) => (
                      <SelectItem key={sound.id} value={sound.id}>
                        {sound.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => playSound(settings.pieceworkSound)}
                >
                  ▶️
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {getSoundOptionById(settings.pieceworkSound)?.description}
              </p>
            </div>

            {/* Volume Control */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                🔊 Master Volume: {Math.round(settings.volume * 100)}%
              </Label>
              <Slider
                value={[settings.volume]}
                onValueChange={([value]) =>
                  handleSettingsChange({ volume: value })
                }
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => playSound(settings.clockInSound, 0.3)}
                >
                  🔉 Test Low
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => playSound(settings.clockInSound)}
                >
                  🔊 Test Current
                </Button>
              </div>
            </div>
          </div>

          {/* Vibration Setting */}
          <div className="flex items-center space-x-2 mt-4">
            <Switch
              id="vibration"
              checked={settings.vibrationEnabled}
              onCheckedChange={(checked) =>
                handleSettingsChange({ vibrationEnabled: checked })
              }
            />
            <Label htmlFor="vibration">
              📱 Enable Vibration (Mobile devices)
            </Label>
          </div>

          {/* Save Settings Button */}
          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="flex-1"
            >
              💾 Guardar Configuración
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                console.log("Reset button clicked");
                console.log("Username being used:", username);
                try {
                  SoundSettingsService.clearSoundSettings(username);
                  const defaultSettings = SoundSettingsService.getSoundSettings(username);
                  console.log("Default settings loaded:", defaultSettings);
                  setSettings(defaultSettings);
                  setHasUnsavedChanges(false);
                  toast({
                    title: "Configuración Restablecida",
                    description: "La configuración de sonido se ha restablecido a los valores predeterminados.",
                  });
                  // Notify parent to reload settings
                  if (onSettingsSaved) {
                    onSettingsSaved();
                  }
                } catch (error) {
                  console.error("Error resetting settings:", error);
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se pudo restablecer la configuración.",
                    duration: 3000,
                  });
                }
              }}
            >
              🔄 Restablecer
            </Button>
          </div>
        </div>

        {/* Sound Browser by Category */}
        {Object.entries(groupedSounds).map(([category, sounds]) => (
          <div key={category} className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-4 capitalize flex items-center gap-2">
              {category === "notification" && "🔔"}
              {category === "alarm" && "🚨"}
              {category === "musical" && "🎵"}
              {category === "nature" && "🌿"}
              {category === "industrial" && "⚙️"}
              {category} Sounds
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sounds.map((sound) => (
                <Button
                  key={sound.id}
                  variant="outline"
                  className="h-auto p-3 text-left justify-start"
                  onClick={() => playSound(sound.id)}
                >
                  <div>
                    <div className="font-medium">{sound.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sound.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        ))}

        {/* Instructions */}
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-900/20">
          <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
            💡 How to Use
          </h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>
              • <strong>Test Sounds:</strong> Click any sound button to hear it
            </li>
            <li>
              • <strong>Configure:</strong> Select sounds for each action
            </li>
            <li>
              • <strong>Auto-Save:</strong> Settings are saved automatically in
              your browser
            </li>
            <li>
              • <strong>Volume:</strong> Adjust master volume and test different
              levels
            </li>
            <li>
              • <strong>Mobile:</strong> Enable vibration for mobile feedback
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
