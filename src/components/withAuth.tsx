"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const PASSWORD_KEY = "secure_page_access_granted";

type WithAuthOptions = {
  askEveryVisit?: boolean; // pedir siempre (no recordar)
  ttlMs?: number; // no se usa cuando askEveryVisit=true
  key?: string;
};

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: WithAuthOptions
) {
  const WithAuthComponent: React.FC<P> = (props) => {
    const pathname = usePathname();
    const router = useRouter();

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [correctPassword, setCorrectPassword] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Estados para cerrar/reabrir el diálogo y bloquear acceso
    const [isDialogOpen, setIsDialogOpen] = useState(true);
    const [denied, setDenied] = useState(false);

    const storageKey = options?.key ?? `${PASSWORD_KEY}:${pathname}`;
    const shouldRemember = !options?.askEveryVisit;

    useEffect(() => {
      const envPassword = process.env.NEXT_PUBLIC_PAYROLL_PASSWORD;
      setCorrectPassword(envPassword || "4321");

      if (shouldRemember) {
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { grantedAt?: number };
            if (
              !options?.ttlMs ||
              (parsed.grantedAt &&
                Date.now() - parsed.grantedAt < options.ttlMs)
            ) {
              setIsAuthorized(true);
              setIsDialogOpen(false);
            } else {
              sessionStorage.removeItem(storageKey);
            }
          }
        } catch {
          // ignore
        }
      }

      setIsLoading(false);
    }, [storageKey, shouldRemember, options?.ttlMs]);

    const handlePasswordSubmit = () => {
      if (password === correctPassword) {
        if (shouldRemember) {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({ grantedAt: Date.now() })
          );
        }
        setIsAuthorized(true);
        setDenied(false);
        setIsDialogOpen(false);
        setError("");
      } else {
        setError("Contraseña incorrecta. Intenta de nuevo.");
        setPassword("");
      }
    };

    const handleCloseDialog = () => {
      setIsDialogOpen(false);
      setDenied(true); // bloquea la sección
    };

    if (isLoading) {
      return (
        <div className="flex h-64 w-full items-center justify-center bg-background rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Si cerró sin autenticarse, bloquea con mensaje
    if (!isAuthorized && denied) {
      return (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-lg font-semibold">
              No tienes permiso para ver esta sección
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingresa la contraseña para continuar.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Volver al dashboard
              </Button>
              <Button
                onClick={() => {
                  setDenied(false);
                  setIsDialogOpen(true);
                  setPassword("");
                  setError("");
                }}
              >
                Ingresar contraseña
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Si está autorizado, renderiza la página
    if (isAuthorized) {
      return <WrappedComponent {...props} />;
    }

    // Diálogo de contraseña (con botón Cerrar)
    return (
      <Dialog
        open={isDialogOpen && !isAuthorized}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Autorización requerida</DialogTitle>
            <DialogDescription>
              Ingresa la contraseña de acceso.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password-input" className="text-right">
                Contraseña
              </Label>
              <Input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                className="col-span-3"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive col-span-4 text-center">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" type="button" onClick={handleCloseDialog}>
              Cerrar
            </Button>
            <Button type="button" onClick={handlePasswordSubmit}>
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  WithAuthComponent.displayName = `WithAuth(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithAuthComponent;
}
