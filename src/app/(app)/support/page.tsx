"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, Info, AlertCircle, Zap } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="grid gap-3 md:gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg md:text-xl">
              Soporte y Preguntas Frecuentes
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Encuentra respuestas sobre cómo funciona la aplicación, sus
            características y cómo aprovecharla al máximo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)] pr-4">
            <Accordion type="multiple" className="w-full space-y-2">
              {/* Descripción General */}
              <AccordionItem value="item-1" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold">
                      ¿Qué es FieldTack WA?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>FieldTack WA</strong> es una aplicación web
                    profesional (PWA) diseñada para gestionar el trabajo a
                    destajo y la nómina de empleados, cumpliendo con las leyes
                    laborales de Washington.
                  </p>
                  <p>
                    La aplicación permite rastrear tiempo, registrar piezas
                    trabajadas, calcular nóminas automáticamente y generar
                    facturas para clientes, todo mientras se trabaja online u
                    offline.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md mt-2">
                    <p className="text-sm">
                      <strong>Características principales:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Rastreo de tiempo con códigos QR</li>
                      <li>Registro de trabajo a destajo (piecework)</li>
                      <li>Funcionamiento offline completo</li>
                      <li>Cálculo automático de nómina</li>
                      <li>Generación de facturas e informes</li>
                      <li>Cumplimiento con leyes laborales de WA</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Secciones de la App */}
              <AccordionItem value="item-2" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">
                      ¿Qué secciones tiene la aplicación?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      📊 Dashboard
                    </h4>
                    <p>
                      Panel principal con resumen de actividad en tiempo real,
                      estadísticas de empleados activos, piezas registradas hoy
                      y clima local.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      ⏰ Time Tracking
                    </h4>
                    <p>
                      Rastrea entradas/salidas de empleados mediante códigos QR.
                      Permite clock-in, clock-out, registro de descansos y
                      gestión de tiempo pasado.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      👥 Employees
                    </h4>
                    <p>
                      Gestión completa de empleados: agregar, editar, eliminar y
                      generar códigos QR únicos para cada trabajador.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      🏢 Clients
                    </h4>
                    <p>
                      Administración de clientes con tarifas personalizadas (por
                      hora o por pieza) para facturación precisa.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      📋 Tasks
                    </h4>
                    <p>
                      Define tareas específicas asociadas a clientes con tarifas
                      configurables para empleados y clientes.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      💰 Payroll
                    </h4>
                    <p>
                      Genera reportes de nómina automáticos con cálculos de
                      horas trabajadas, pago a destajo, ajustes de salario
                      mínimo y cumplimiento con WA labor laws. Usa IA para
                      garantizar precisión.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      📄 Labor Report (Admin)
                    </h4>
                    <p>
                      Reportes detallados de mano de obra por cliente, con
                      desglose diario de tareas, costos laborales, compensación
                      por salario mínimo y primas de tiempo extra.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      🧾 Invoicing
                    </h4>
                    <p>
                      Sistema de facturación que calcula costos según tarifas de
                      cliente, genera PDFs profesionales y exporta CSVs
                      detallados.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      👤 User Management (Admin)
                    </h4>
                    <p>
                      Gestión de usuarios con roles (Admin/User) y control de
                      acceso a funciones administrativas.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Cálculos Labor Report */}
              <AccordionItem value="item-3" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-purple-500" />
                    <span className="font-semibold">
                      ¿Cómo funcionan los cálculos en Labor Report?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    El Labor Report genera informes detallados de costos
                    laborales para clientes, cumpliendo con las leyes laborales
                    de Washington State. El proceso de cálculo incluye:
                  </p>

                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      1. Costo Laboral Base
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        Suma de todas las horas trabajadas multiplicadas por la
                        tarifa del empleado
                      </li>
                      <li>
                        Suma de todas las piezas completadas multiplicadas por
                        la tarifa por pieza
                      </li>
                    </ul>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      2. Ajuste de Salario Mínimo (Minimum Wage Top-Up)
                    </h4>
                    <p>
                      Si el pago a destajo es menor que el salario mínimo de WA
                      ($16.28/hora en 2024), se agrega la diferencia para
                      cumplir con la ley.
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      3. Descansos Pagados (Paid Rest Breaks)
                    </h4>
                    <p>
                      Washington requiere descansos pagados de 10 minutos por
                      cada 4 horas trabajadas. Se calcula y agrega este costo.
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      4. Prima de Tiempo Extra (Overtime Premium)
                    </h4>
                    <p>
                      Para horas trabajadas más allá de 40 horas semanales, se
                      aplica una prima del 50% adicional (tiempo y medio).
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      5. Subtotal y Comisión
                    </h4>
                    <p>
                      Se suma todo (labor + ajustes + descansos + overtime) para
                      obtener el subtotal. Luego se aplica la comisión del
                      cliente (típicamente 15-20%) para el total final.
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md mt-3">
                    <p className="text-sm font-semibold">
                      💡 Los reportes incluyen:
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>Desglose diario por tarea</li>
                      <li>Detalle por empleado con horas y piezas</li>
                      <li>Resumen de todos los ajustes y costos</li>
                      <li>Exportación a Excel para análisis</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Modo Offline */}
              <AccordionItem value="item-4" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold">
                      ¿Cómo funciona el modo offline?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    La aplicación funciona completamente sin conexión a
                    internet. Todas las operaciones se guardan localmente y se
                    sincronizan automáticamente cuando la conexión regresa.
                  </p>

                  <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      ✅ Operaciones Soportadas Offline:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Clock-in / Clock-out (individual y masivo)</li>
                      <li>Registro de descansos</li>
                      <li>Escaneo y registro de piezas (piecework)</li>
                      <li>Registro de piezas compartidas</li>
                      <li>Edición y eliminación de entradas</li>
                      <li>Registro de horas de enfermedad</li>
                    </ul>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      🔄 Sincronización Automática:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        Todas las operaciones se guardan en IndexedDB local
                      </li>
                      <li>
                        Al recuperar internet, los cambios se sincronizan
                        automáticamente
                      </li>
                      <li>No se pierde ningún dato durante la desconexión</li>
                      <li>
                        Notificaciones visuales confirman el estado de
                        sincronización
                      </li>
                    </ul>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      📶 Indicador de Estado:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <strong>Verde "Online":</strong> Conectado a internet
                      </li>
                      <li>
                        <strong>Naranja parpadeante "Offline":</strong> Sin
                        conexión
                      </li>
                      <li>Ubicado en la esquina superior derecha</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md mt-3">
                    <p className="text-sm">
                      <strong>⚠️ Importante:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>
                        Solo funciona en una pestaña del navegador a la vez
                      </li>
                      <li>
                        No borres los datos del navegador con operaciones sin
                        sincronizar
                      </li>
                      <li>
                        Los datos offline se almacenan en IndexedDB del
                        navegador
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Caché y Actualizaciones */}
              <AccordionItem value="item-5" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="font-semibold">
                      ¿Qué necesito saber sobre la caché y actualizaciones?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    La aplicación usa Service Workers y caché del navegador para
                    funcionar offline. Aquí te explicamos cómo mantenerla
                    actualizada:
                  </p>

                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      🔄 Actualizaciones de la App:
                    </h4>
                    <p className="mb-2">
                      Cada vez que se actualiza la aplicación, es{" "}
                      <strong>CRÍTICO</strong> limpiar la caché para evitar
                      problemas:
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>
                        <strong>Chrome/Edge:</strong> Presiona Ctrl+Shift+Del
                        (Windows) o Cmd+Shift+Del (Mac)
                      </li>
                      <li>
                        Selecciona "Caché e imágenes" y "Datos de sitios"
                      </li>
                      <li>Haz clic en "Borrar datos"</li>
                      <li>Recarga la página (F5 o Ctrl+R)</li>
                    </ol>
                  </div>

                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      🧹 Limpieza Manual de Caché:
                    </h4>
                    <p className="mb-2">
                      Si experimentas problemas (pantallas en blanco, errores,
                      funciones que no cargan):
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Abre DevTools (F12)</li>
                      <li>Ve a la pestaña "Application" (Aplicación)</li>
                      <li>Selecciona "Clear storage" (Borrar almacenamiento)</li>
                      <li>
                        Marca todas las casillas (Cache, IndexedDB, Local
                        Storage)
                      </li>
                      <li>Haz clic en "Clear site data"</li>
                      <li>Recarga la página</li>
                    </ol>
                  </div>

                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      📱 PWA (Progressive Web App):
                    </h4>
                    <p className="mb-2">
                      Si instalaste la app en tu dispositivo móvil o escritorio:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        Las actualizaciones se descargan automáticamente en
                        segundo plano
                      </li>
                      <li>Cierra y abre la app para aplicar actualizaciones</li>
                      <li>
                        Si hay problemas, desinstala y reinstala la PWA desde el
                        navegador
                      </li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md mt-3">
                    <p className="text-sm">
                      <strong>⚠️ Antes de borrar caché:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>
                        Asegúrate de estar ONLINE para que se sincronicen datos
                        pendientes
                      </li>
                      <li>
                        Verifica que el indicador muestre "Online" (verde)
                      </li>
                      <li>
                        Espera a ver el mensaje de "Sincronización completa"
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Requisitos del Sistema */}
              <AccordionItem value="item-6" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold">
                      ¿Qué necesito para usar la aplicación?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <div className="bg-cyan-50 dark:bg-cyan-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      💻 Navegadores Soportados:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Google Chrome (recomendado)</li>
                      <li>Microsoft Edge</li>
                      <li>Mozilla Firefox</li>
                      <li>Safari (iOS y macOS)</li>
                      <li>
                        Versiones recientes (últimos 2 años) para mejor
                        rendimiento
                      </li>
                    </ul>
                  </div>

                  <div className="bg-cyan-50 dark:bg-cyan-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      📱 Dispositivos:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Computadoras de escritorio (Windows, Mac, Linux)</li>
                      <li>Tablets (iPad, Android tablets)</li>
                      <li>Teléfonos móviles (iPhone, Android)</li>
                      <li>Diseño totalmente responsive</li>
                    </ul>
                  </div>

                  <div className="bg-cyan-50 dark:bg-cyan-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      🔧 Requisitos Técnicos:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Conexión a internet (para sincronización)</li>
                      <li>
                        Soporte de IndexedDB (incluido en navegadores modernos)
                      </li>
                      <li>Cámara para escanear códigos QR</li>
                      <li>JavaScript habilitado</li>
                      <li>Cookies y almacenamiento local habilitados</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Resolución de Problemas */}
              <AccordionItem value="item-7" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold">
                      Problemas comunes y soluciones
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <div className="space-y-3">
                    <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                      <h4 className="font-semibold text-foreground mb-1">
                        ❓ La app no carga o muestra pantalla en blanco
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Borra la caché del navegador (ver sección arriba)</li>
                        <li>Verifica tu conexión a internet</li>
                        <li>Intenta con modo incógnito</li>
                        <li>Actualiza tu navegador a la última versión</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                      <h4 className="font-semibold text-foreground mb-1">
                        ❓ Los datos no se sincronizan después de estar offline
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Espera 30 segundos después de recuperar conexión</li>
                        <li>Verifica que el indicador muestre "Online" (verde)</li>
                        <li>Revisa la consola del navegador (F12) por errores</li>
                        <li>No cierres la pestaña hasta ver confirmación</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                      <h4 className="font-semibold text-foreground mb-1">
                        ❓ El escáner QR no funciona
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Permite acceso a la cámara cuando lo solicite</li>
                        <li>Verifica permisos de cámara en configuración del navegador</li>
                        <li>Asegúrate de tener buena iluminación</li>
                        <li>Limpia la lente de la cámara</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                      <h4 className="font-semibold text-foreground mb-1">
                        ❓ Los reportes no se generan
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Verifica que haya datos en el rango de fechas seleccionado</li>
                        <li>Asegúrate de estar online (usa internet para IA)</li>
                        <li>Intenta con un rango de fechas más pequeño</li>
                        <li>Revisa que el cliente tenga tareas asignadas</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                      <h4 className="font-semibold text-foreground mb-1">
                        ❓ Mensaje "Multiple tabs open"
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Cierra todas las pestañas de la app excepto una</li>
                        <li>El modo offline solo funciona en una pestaña</li>
                        <li>Recarga la pestaña que deseas mantener</li>
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Mejores Prácticas */}
              <AccordionItem value="item-8" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">
                      Mejores prácticas y recomendaciones
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      ✨ Para mejor rendimiento:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Mantén solo una pestaña abierta de la aplicación</li>
                      <li>Sincroniza datos regularmente conectándote a internet</li>
                      <li>Cierra otras aplicaciones pesadas mientras usas la app</li>
                      <li>Usa Chrome o Edge para mejor compatibilidad</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      🔒 Para seguridad de datos:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Cierra sesión al terminar tu turno</li>
                      <li>No compartas credenciales de acceso</li>
                      <li>Verifica que los datos se sincronizaron antes de cerrar</li>
                      <li>Mantén el navegador actualizado</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      📊 Para mejores reportes:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Registra datos en tiempo real, no al final del día</li>
                      <li>Verifica que empleados hagan clock-out correctamente</li>
                      <li>Revisa descansos registrados para cumplimiento legal</li>
                      <li>Exporta reportes regularmente para respaldo</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
                    <h4 className="font-semibold text-foreground mb-2">
                      📱 Para trabajo de campo:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Instala la PWA en dispositivos móviles</li>
                      <li>Prepara códigos QR de empleados impresos como respaldo</li>
                      <li>Mantén el dispositivo cargado durante el día</li>
                      <li>Ten buena iluminación para escaneo de QR</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
