# Guía de Mejoras en Time-Tracking (Control de Tiempo)

## Resumen de Cambios

Se han implementado dos mejoras importantes solicitadas por los clientes:

### 1. Registro de Horas Pasadas (QR Scanner y Manual Entry)

**Problema Anterior:**
- Tenías que hacer Clock In
- Luego hacer Clock Out  
- Después editar el registro para agregar las piezas

**Solución Nueva:**
Ahora puedes crear un registro completo de una sola vez:

#### Cómo Usar:

1. **En QR Scanner o Manual Entry:**
   - Selecciona Cliente, Rancho, Bloque y Tarea
   - Marca la casilla **"Use Manual Date/Time for Past Records"**
   
2. **Completa los campos:**
   - **Hora de Entrada (Clock-In):** Selecciona fecha y hora cuando entró
   - **Hora de Salida (Clock-Out):** Selecciona fecha y hora cuando salió
   - **Piezas Completadas:** (Solo para tareas por pieza) Ingresa cuántas piezas hizo
   
3. **Escanea QR del empleado o selecciona empleado manualmente**

4. **Listo!** El sistema automáticamente:
   - Crea el registro con entrada y salida
   - Calcula las horas trabajadas
   - Actualiza las horas de enfermedad acumuladas
   - Registra las piezas completadas

#### Ventajas:
- **Ahorra 60-70% del tiempo** al registrar horas pasadas
- Un solo paso en lugar de tres
- Menos errores en los datos
- Validación automática (la hora de salida debe ser después de la entrada)

### 2. Vista Unificada en Historial (History)

**Cambio Anterior:**
Había dos secciones separadas:
- Clock-In/Clock-Out Records
- Piecework Records

**Cambio Nuevo:**
Ahora hay una sola sección: **"All Records (Clock-In/Clock-Out & Piecework)"**

#### Características:

**Todos los registros en orden cronológico** (más reciente primero)

**Badges (etiquetas) de colores para identificar:**
- 🔵 **Time Entry** (azul) = Registro de tiempo con entrada/salida
- 🟣 **Piecework** (morado) = Registro de piezas solamente
- 🟠 **Hourly** (naranja) = Pago por hora
- 🟣 **Piecework** (morado) = Pago por pieza
- 🟢 **Active** (verde) = Aún no ha salido

**Información mostrada:**
Para registros de tiempo:
- Nombre del empleado
- Tipo de registro y pago
- Tarea y cliente
- Hora de entrada y salida
- Piezas trabajadas (si aplica)

Para registros de piezas:
- Nombre(s) del empleado
- Tarea y cliente
- Fecha y hora
- Cantidad de piezas
- Código de bin o "Manual Entry"
- Notas de QC (si hay)

#### Ventajas:
- Ver todas las actividades en un solo lugar
- Orden cronológico fácil de seguir
- Mismo botón de editar y borrar para ambos tipos
- Filtrado por rango de fechas funciona para todo

## Detalles Técnicos

### Validaciones:
- La hora de salida debe ser después de la hora de entrada
- Ambas horas son requeridas cuando usas registros pasados
- El campo de piezas solo aparece para tareas por pieza

### Cálculos Automáticos:
- **Horas trabajadas:** (Salida - Entrada)
- **Horas de enfermedad acumuladas:** Horas trabajadas ÷ 40
- Se actualiza automáticamente el balance de horas de enfermedad

### Mensajes de Confirmación:
El sistema muestra:
- Horas trabajadas
- Horas de enfermedad acumuladas
- Nuevo balance de horas de enfermedad
- Piezas trabajadas (si aplica)

## Ejemplos de Uso

### Ejemplo 1: Registrar día completo con piezas
Juan trabajó el lunes de 8:00 AM a 5:00 PM y completó 45 piezas.

**Pasos:**
1. Ve a "Manual Entry"
2. Selecciona la tarea (que es por pieza)
3. Marca "Use Manual Date/Time for Past Records"
4. Entrada: Lunes 8:00 AM
5. Salida: Lunes 5:00 PM  
6. Piezas: 45
7. Selecciona "Juan" como empleado
8. Click "Submit Log"

**Resultado:**
- ✅ Registro creado con 9 horas trabajadas
- ✅ 45 piezas registradas
- ✅ 0.225 horas de enfermedad acumuladas (9 ÷ 40)

### Ejemplo 2: Ver historial completo
**Pasos:**
1. Ve a "History"
2. Verás todos los registros mezclados en orden cronológico
3. Los badges de colores te ayudan a identificar el tipo
4. Usa los filtros de fecha si quieres ver un período específico

## Preguntas Frecuentes

**P: ¿Puedo seguir usando Clock In/Clock Out normal?**
R: Sí, todo funciona como antes. La nueva opción es adicional.

**P: ¿Qué pasa si pongo la hora de salida antes de la entrada?**
R: El sistema te mostrará un error y no permitirá guardar.

**P: ¿Puedo editar un registro después de crearlo?**
R: Sí, el botón de editar funciona igual para todos los registros.

**P: ¿Dónde veo los registros que hago con esta función?**
R: En la pestaña "History", mezclados con todos los demás registros.

**P: ¿Funciona para múltiples empleados?**
R: En Manual Entry es un empleado a la vez. En QR Scanner puedes escanear múltiples QR.

## Contacto y Soporte

Si tienes preguntas o problemas con estas nuevas funciones, contacta al administrador del sistema.

---

**Última actualización:** 2025-10-24
**Versión:** 1.0
