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
import { Settings as SettingsIcon, Palette, Moon, Sun, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
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
            Personaliza tu experiencia en la aplicación (funcionalidades en desarrollo)
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
              <Select defaultValue="light" disabled>
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

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="dark-mode" className="text-sm font-medium">
                  Modo Oscuro
                </Label>
                <p className="text-sm text-muted-foreground">
                  Activa el modo oscuro para reducir el brillo de la pantalla
                </p>
              </div>
              <Switch id="dark-mode" disabled />
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
              <Select defaultValue="blue" disabled>
                <SelectTrigger id="color-scheme" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-blue-600" />
                      Azul (Predeterminado)
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
              <Switch id="high-contrast" disabled />
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
              <Select defaultValue="medium" disabled>
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
              <Switch id="compact-mode" disabled />
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
              <Switch id="animations" defaultChecked disabled />
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
              <Select defaultValue="left" disabled>
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

          {/* Language Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-green-500" />
              <h3 className="text-base font-semibold">Idioma y Región</h3>
            </div>
            <Separator />

            {/* Language */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="language" className="text-sm font-medium">
                  Idioma
                </Label>
                <p className="text-sm text-muted-foreground">
                  Selecciona el idioma de la interfaz
                </p>
              </div>
              <Select defaultValue="es" disabled>
                <SelectTrigger id="language" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar idioma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Format */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="date-format" className="text-sm font-medium">
                  Formato de Fecha
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cambia cómo se muestran las fechas
                </p>
              </div>
              <Select defaultValue="mm-dd-yyyy" disabled>
                <SelectTrigger id="date-format" className="w-[180px]">
                  <SelectValue placeholder="Seleccionar formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Funcionalidad en Desarrollo
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Las opciones de configuración mostradas aquí están actualmente deshabilitadas
                  y serán implementadas en futuras actualizaciones. Estas incluirán personalización
                  de temas, modo oscuro, esquemas de colores personalizados, tamaños de fuente,
                  y más opciones de visualización para mejorar tu experiencia.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button (disabled for now) */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled>
              Restablecer
            </Button>
            <Button disabled>
              Guardar Cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
