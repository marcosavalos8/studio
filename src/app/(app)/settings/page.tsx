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
import { Settings as SettingsIcon, Palette, Moon, Sun, Check, Key, Eye, EyeOff, Building2, Loader2, RefreshCw } from "lucide-react";
import { forceAppUpdate } from "@/lib/force-update";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    accountingCenter: false,
  });

  const toggleShowPassword = (field: "invoice" | "laborReport" | "payroll" | "accountingCenter") => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleReset = () => {
    resetSettings();
    toast({
      title: "Settings reset",
      description: "Default values have been restored.",
    });
  };

  return (
    <div className="grid gap-3 md:gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg md:text-xl">
              Settings
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Customize your application experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Appearance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-blue-500" />
              <h3 className="text-base font-semibold">Appearance</h3>
            </div>
            <Separator />

            {/* Theme Selection */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="theme-mode" className="text-sm font-medium">
                  Color Theme
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select the application color theme
                </p>
              </div>
              <Select
                value={settings.themeMode}
                onValueChange={(value) =>
                  updateSetting("themeMode", value as "light" | "dark" | "system")
                }
              >
                <SelectTrigger id="theme-mode" className="w-[180px]">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color Scheme */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="color-scheme" className="text-sm font-medium">
                  Color Scheme
                </Label>
                <p className="text-sm text-muted-foreground">
                  Customize the main colors of the interface
                </p>
              </div>
              <Select
                value={settings.colorScheme}
                onValueChange={(value) =>
                  updateSetting("colorScheme", value as "blue" | "green" | "purple" | "orange")
                }
              >
                <SelectTrigger id="color-scheme" className="w-[180px]">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-blue-600" />
                      Blue
                    </div>
                  </SelectItem>
                  <SelectItem value="green">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-green-600" />
                      Green
                    </div>
                  </SelectItem>
                  <SelectItem value="purple">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-purple-600" />
                      Purple
                    </div>
                  </SelectItem>
                  <SelectItem value="orange">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-orange-600" />
                      Orange
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="high-contrast" className="text-sm font-medium">
                  High Contrast
                </Label>
                <p className="text-sm text-muted-foreground">
                  Increase contrast for better visibility
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
                  Font Size
                </Label>
                <p className="text-sm text-muted-foreground">
                  Adjust the text size in the application
                </p>
              </div>
              <Select
                value={settings.fontSize}
                onValueChange={(value) =>
                  updateSetting("fontSize", value as "small" | "medium" | "large" | "xlarge")
                }
              >
                <SelectTrigger id="font-size" className="w-[180px]">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Display Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-purple-500" />
              <h3 className="text-base font-semibold">Display</h3>
            </div>
            <Separator />

            {/* Compact Mode */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="compact-mode" className="text-sm font-medium">
                  Compact Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reduce spacing between elements to show more information
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
                  Animations
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable interface animations
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
                  Menu Position
                </Label>
                <p className="text-sm text-muted-foreground">
                  Change the position of the side menu
                </p>
              </div>
              <Select
                value={settings.sidebarPosition}
                onValueChange={(value) =>
                  updateSetting("sidebarPosition", value as "left" | "right")
                }
              >
                <SelectTrigger id="sidebar-position" className="w-[180px]">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Security / Passwords Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-semibold">Security / Access Passwords</h3>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Set the access passwords for the protected sections of the application.
            </p>

            {/* Invoice Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="invoice-password" className="text-sm font-medium">
                  Password – Invoices
                </Label>
                <p className="text-sm text-muted-foreground">
                  Access password for the Invoicing section
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
                  aria-label={showPasswords.invoice ? "Hide password" : "Show password"}
                >
                  {showPasswords.invoice ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Labor Report Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="labor-report-password" className="text-sm font-medium">
                  Password – Labor Report
                </Label>
                <p className="text-sm text-muted-foreground">
                  Access password for the Labor Report section
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
                  aria-label={showPasswords.laborReport ? "Hide password" : "Show password"}
                >
                  {showPasswords.laborReport ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Payroll Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="payroll-password" className="text-sm font-medium">
                  Password – Payroll
                </Label>
                <p className="text-sm text-muted-foreground">
                  Access password for the Payroll section
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
                  aria-label={showPasswords.payroll ? "Hide password" : "Show password"}
                >
                  {showPasswords.payroll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Accounting Center Password */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="accounting-center-password" className="text-sm font-medium">
                  Password – Accounting Center
                </Label>
                <p className="text-sm text-muted-foreground">
                  Access password for the Accounting Center section
                </p>
              </div>
              <div className="relative w-[180px]">
                <Input
                  id="accounting-center-password"
                  type={showPasswords.accountingCenter ? "text" : "password"}
                  value={settings.accountingCenterPassword}
                  onChange={(e) => updateSetting("accountingCenterPassword", e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleShowPassword("accountingCenter")}
                  aria-label={showPasswords.accountingCenter ? "Hide password" : "Show password"}
                >
                  {showPasswords.accountingCenter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  Active Configuration
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  All configuration options are now active and functional.
                  Changes are applied immediately and saved automatically in your browser.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Updates */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg md:text-xl">App Updates</CardTitle>
          </div>
          <CardDescription className="text-sm">
            If the app looks outdated or a change isn&apos;t showing, use this to
            clear the cache and reload the latest version. No data is lost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Update &amp; clear cache
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Update &amp; clear cache?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear the cached app data and reload the latest
                  version. No data is lost. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => forceAppUpdate()}>
                  Update now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
