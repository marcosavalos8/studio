# Funcionamiento Offline (Modo Sin Conexión)

## Descripción General

La aplicación ahora funciona completamente sin conexión a internet. Todas las operaciones (clock-in, clock-out, registro de piezas, etc.) se pueden realizar sin conexión y se sincronizarán automáticamente cuando la conexión se restablezca.

## Características Principales

### 🔄 Sincronización Automática
- **Todas las operaciones se guardan localmente** cuando no hay internet
- **Sincronización automática** cuando la conexión regresa
- **No se pierde ningún dato** - todo está guardado de forma segura en el dispositivo

### 📶 Indicador de Estado de Red
- **Icono verde "Online"**: Conectado a internet
- **Icono naranja parpadeante "Offline"**: Sin conexión a internet
- El indicador aparece en la esquina superior derecha de todas las páginas

### 💬 Notificaciones Inteligentes
- **Al perder conexión**: Notificación informando que estás en modo offline
- **Al recuperar conexión**: Notificación confirmando que se están sincronizando los cambios
- **En cada operación offline**: Se indica "(Guardado localmente - se sincronizará cuando esté online)"

## Operaciones Soportadas sin Internet

Todas las siguientes operaciones funcionan completamente offline:

### ⏰ Gestión de Tiempo
- ✅ Clock-in (individual y masivo)
- ✅ Clock-out (individual y masivo)
- ✅ Registro de descansos
- ✅ Creación de registros pasados
- ✅ Edición de entradas de tiempo
- ✅ Eliminación de entradas de tiempo

### 📦 Trabajo a Destajo (Piecework)
- ✅ Escaneo de bins/piezas con QR
- ✅ Registro manual de piezas
- ✅ Registro de piezas compartidas (múltiples trabajadores)
- ✅ Edición de registros de piezas
- ✅ Eliminación de registros de piezas

### 🏥 Horas de Enfermedad
- ✅ Registro de ausencias por enfermedad
- ✅ Uso de horas de enfermedad acumuladas

## Cómo Funciona

### Escenario 1: Clock-in sin Internet
1. **7:00 AM**: Trabajador escanea QR para clock-in
2. **Sin internet detectado**: App guarda localmente
3. **Notificación**: "Clocked in [Nombre]. (Guardado localmente - se sincronizará cuando esté online)"
4. **Trabajador continúa trabajando**: Todas las operaciones siguen funcionando normalmente

### Escenario 2: Recuperación de Conexión
1. **Internet regresa**: App detecta automáticamente
2. **Notificación**: "Back Online - Connection restored. Syncing your changes..."
3. **Sincronización automática**: Todos los cambios locales se envían al servidor
4. **Confirmación**: Operaciones completadas sin intervención del usuario

### Escenario 3: Múltiples Operaciones Offline
1. Clock-in de varios trabajadores
2. Registro de múltiples bins de piezas
3. Clock-out al final del día
4. Todo se guarda localmente en orden
5. Al recuperar internet, todo se sincroniza en el orden correcto

## Limitaciones y Consideraciones

### ⚠️ Importante Saber

1. **Múltiples Pestañas**: 
   - Solo funciona offline en una pestaña a la vez
   - Si abres múltiples pestañas, solo la primera tendrá persistencia offline
   - Mensaje de advertencia en consola si esto ocurre

2. **Navegadores Soportados**:
   - ✅ Chrome/Edge (totalmente soportado)
   - ✅ Firefox (totalmente soportado)
   - ✅ Safari (totalmente soportado)
   - ❌ Navegadores muy antiguos podrían no soportar IndexedDB

3. **Almacenamiento Local**:
   - Los datos offline se guardan en IndexedDB del navegador
   - No borrar los datos del navegador mientras haya operaciones sin sincronizar
   - El navegador puede limitar el espacio disponible (generalmente suficiente para miles de registros)

4. **Consultas en Tiempo Real**:
   - Al estar offline, verás los datos cargados previamente
   - Nuevos registros de otros usuarios no aparecerán hasta recuperar conexión
   - Los datos propios se actualizan inmediatamente de forma local

## Resolución de Problemas

### ❓ No veo el indicador de estado
- Actualiza la página (F5)
- Verifica que no estés en modo incógnito

### ❓ Las operaciones offline no se sincronizan
- Espera unos segundos después de recuperar conexión
- Verifica tu conexión a internet
- Revisa la consola del navegador (F12) por errores

### ❓ Mensaje "Multiple tabs open"
- Cierra las pestañas duplicadas de la aplicación
- Mantén solo una pestaña abierta para operaciones offline

### ❓ Perdí la conexión en medio de una operación
- No te preocupes, la operación se completó localmente
- Se sincronizará automáticamente cuando la conexión regrese
- Puedes continuar con otras operaciones sin problemas

## Recomendaciones para Mejor Experiencia

1. **Mantén la pestaña abierta**: No cierres el navegador si tienes operaciones sin sincronizar
2. **Verifica el indicador**: Observa el estado de la conexión antes de operaciones críticas
3. **Sincronización regular**: Si es posible, conecta a internet periódicamente para sincronizar
4. **Una pestaña a la vez**: Usa solo una pestaña de la aplicación para evitar conflictos
5. **Espera la confirmación**: Observa las notificaciones para confirmar que las operaciones se guardaron

## Soporte Técnico

Si experimentas problemas con el modo offline:
- Reporta el problema con detalles específicos
- Incluye el navegador y versión que estás usando
- Describe los pasos que causaron el problema
- Incluye cualquier mensaje de error que veas

---

**Nota**: Esta funcionalidad usa tecnología de vanguardia (IndexedDB y Firestore Offline Persistence) para garantizar que ningún dato se pierda, incluso en áreas con conexión inestable.
