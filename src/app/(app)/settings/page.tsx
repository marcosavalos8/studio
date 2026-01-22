"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Palette, Moon, Sun, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/contexts/settings-context";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Configuración guardada",
      description: "Tus preferencias han sido actualizadas exitosamente.",
    });
  };

  const handleReset = () => {
    resetSettings();
    toast({
      title: "Configuración restablecida",
      description: "Se han restaurado los valores predeterminados.",
    });
  };

  return (
    <div className="grid gap-3 md:gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg md:text-xl">
              Configuración
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Personaliza tu experiencia en la aplicación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Appearance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-blue-500" />
              <h3 className="text-base font-semibold">Apariencia</h3>
            </div>
            <Separator />
            
            {/* Theme Selection */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="theme-mode" className="text-sm font-medium">
                  Tema de Color
                </Label>
                <p className="text-sm text-muted-foreground">
                  Selecciona el tema de color de la aplicación
                </p>
              </div>
              <Select
                value={settings.themeMode}
                onValueChange={(value) =>
                  updateSetting("themeMode", value as "light" | "dark" | "system")
                }
              >
                <SelectTrigger id="theme-mode" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Claro
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Oscuro
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      Sistema
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color Scheme */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="color-scheme" className="text-sm font-medium">
                  Esquema de Colores
                </Label>
                <p className="text-sm text-muted-foreground">
                  Personaliza los colores principales de la interfaz
                </p>
              </div>
              <Select
                value={settings.colorScheme}
                onValueChange={(value) =>
                  updateSetting("colorScheme", value as "blue" | "green" | "purple" | "orange")
                }
              >
                <SelectTrigger id="color-scheme" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-blue-600" />
                      Azul
                    </div>
                  </SelectItem>
                  <SelectItem value="green">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-green-600" />
                      Verde
                    </div>
                  </SelectItem>
                  <SelectItem value="purple">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-purple-600" />
                      Morado
                    </div>
                  </SelectItem>
                  <SelectItem value="orange">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-orange-600" />
                      Naranja
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="high-contrast" className="text-sm font-medium">
                  Alto Contraste
                </Label>
                <p className="text-sm text-muted-foreground">
                  Aumenta el contraste para mejor visibilidad
                </p>
              </div>
              <Switch
                id="high-contrast"
                checked={settings.highContrast}
                onCheckedChange={(checked) =>
                  updateSetting("highContrast", checked)
                }
              />
            </div>

            {/* Font Size */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="font-size" className="text-sm font-medium">
                  Tamaño de Fuente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ajusta el tamaño del texto en la aplicación
                </p>
              </div>
              <Select
                value={settings.fontSize}
                onValueChange={(value) =>
                  updateSetting("fontSize", value as "small" | "medium" | "large" | "xlarge")
                }
              >
                <SelectTrigger id="font-size" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Pequeño</SelectItem>
                  <SelectItem value="medium">Mediano</SelectItem>
                  <SelectItem value="large">Grande</SelectItem>
                  <SelectItem value="xlarge">Extra Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Display Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-purple-500" />
              <h3 className="text-base font-semibold">Visualización</h3>
            </div>
            <Separator />

            {/* Compact Mode */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="compact-mode" className="text-sm font-medium">
                  Modo Compacto
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reduce el espaciado entre elementos para ver más información
                </p>
              </div>
              <Switch
                id="compact-mode"
                checked={settings.compactMode}
                onCheckedChange={(checked) =>
                  updateSetting("compactMode", checked)
                }
              />
            </div>

            {/* Show Animations */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="animations" className="text-sm font-medium">
                  Animaciones
                </Label>
                <p className="text-sm text-muted-foreground">
                  Activa o desactiva las animaciones de la interfaz
                </p>
              </div>
              <Switch
                id="animations"
                checked={settings.animations}
                onCheckedChange={(checked) =>
                  updateSetting("animations", checked)
                }
              />
            </div>

            {/* Sidebar Position */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="sidebar-position" className="text-sm font-medium">
                  Posición del Menú
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cambia la posición del menú lateral
                </p>
              </div>
              <Select
                value={settings.sidebarPosition}
                onValueChange={(value) =>
                  updateSetting("sidebarPosition", value as "left" | "right")
                }
              >
                <SelectTrigger id="sidebar-position" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar posición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Izquierda</SelectItem>
                  <SelectItem value="right">Derecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex gap-3">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Configuración Activa
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Todas las opciones de configuración están ahora activas y funcionales.
                  Los cambios se aplican inmediatamente y se guardan automáticamente en tu navegador.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset}>
              Restablecer
            </Button>
            <Button onClick={handleSave}>
              Guardar Cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
