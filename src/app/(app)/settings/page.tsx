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
import { Settings as SettingsIcon, Palette, Moon, Sun, Check, Key, Eye, EyeOff, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/contexts/settings-context";
import { useCompanyInfo } from "@/hooks/use-company-info";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function SettingsPage() {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { companyInfo, isLoading: loadingCompany, isSaving: savingCompany, saveCompanyInfo } = useCompanyInfo();
  const { toast } = useToast();
  const [companyDraft, setCompanyDraft] = useState<typeof companyInfo | null>(null);
  const company = companyDraft ?? companyInfo;
  const [showPasswords, setShowPasswords] = useState({
    invoice: false,
    laborReport: false,
    payroll: false,
  });

  const toggleShowPassword = (field: "invoice" | "laborReport" | "payroll") => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

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

          {/* Security / Passwords Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-semibold">Seguridad / Contraseñas de Acceso</h3>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Configura las contraseñas de acceso para las secciones protegidas de la aplicación.
            </p>

            {/* Invoice Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="invoice-password" className="text-sm font-medium">
                  Contraseña – Invoices
                </Label>
                <p className="text-sm text-muted-foreground">
                  Contraseña de acceso a la sección de Invoicing
                </p>
              </div>
              <div className="relative w-[180px]">
                <Input
                  id="invoice-password"
                  type={showPasswords.invoice ? "text" : "password"}
                  value={settings.invoicePassword}
                  onChange={(e) => updateSetting("invoicePassword", e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleShowPassword("invoice")}
                  aria-label={showPasswords.invoice ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPasswords.invoice ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Labor Report Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="labor-report-password" className="text-sm font-medium">
                  Contraseña – Labor Report
                </Label>
                <p className="text-sm text-muted-foreground">
                  Contraseña de acceso a la sección de Labor Report
                </p>
              </div>
              <div className="relative w-[180px]">
                <Input
                  id="labor-report-password"
                  type={showPasswords.laborReport ? "text" : "password"}
                  value={settings.laborReportPassword}
                  onChange={(e) => updateSetting("laborReportPassword", e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleShowPassword("laborReport")}
                  aria-label={showPasswords.laborReport ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPasswords.laborReport ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Payroll Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="payroll-password" className="text-sm font-medium">
                  Contraseña – Payroll
                </Label>
                <p className="text-sm text-muted-foreground">
                  Contraseña de acceso a la sección de Payroll
                </p>
              </div>
              <div className="relative w-[180px]">
                <Input
                  id="payroll-password"
                  type={showPasswords.payroll ? "text" : "password"}
                  value={settings.payrollPassword}
                  onChange={(e) => updateSetting("payrollPassword", e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleShowPassword("payroll")}
                  aria-label={showPasswords.payroll ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPasswords.payroll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Company Info Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-semibold">Company Information</h3>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              This information will appear on printed reports (invoices, labor reports and payroll).
            </p>

            {loadingCompany ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="company-name" className="text-sm font-medium">Company Name</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. J&M Agricultural Labor LLC"
                    value={company.companyName}
                    onChange={(e) => setCompanyDraft({ ...company, companyName: e.target.value })}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="company-address" className="text-sm font-medium">Address</Label>
                  <Input
                    id="company-address"
                    placeholder="e.g. 250 Country Heaven Loop, Pasco, WA 99301"
                    value={company.address}
                    onChange={(e) => setCompanyDraft({ ...company, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company-phone" className="text-sm font-medium">Phone</Label>
                  <Input
                    id="company-phone"
                    placeholder="e.g. 509.380.3385"
                    value={company.phone}
                    onChange={(e) => setCompanyDraft({ ...company, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    placeholder="e.g. info@jmagri.com"
                    value={company.email}
                    onChange={(e) => setCompanyDraft({ ...company, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company-ein" className="text-sm font-medium">EIN #</Label>
                  <Input
                    id="company-ein"
                    placeholder="e.g. 33-2236422"
                    value={company.ein}
                    onChange={(e) => setCompanyDraft({ ...company, ein: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company-ubi" className="text-sm font-medium">UBI #</Label>
                  <Input
                    id="company-ubi"
                    placeholder="e.g. 605 650 411"
                    value={company.ubi}
                    onChange={(e) => setCompanyDraft({ ...company, ubi: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    onClick={async () => {
                      await saveCompanyInfo(company);
                      setCompanyDraft(null);
                      toast({ title: "Company information saved", description: "The company details have been updated successfully." });
                    }}
                    disabled={savingCompany}
                    size="sm"
                  >
                    {savingCompany && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Company Info
                  </Button>
                </div>
              </div>
            )}
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
