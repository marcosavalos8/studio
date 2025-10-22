# Guía del Usuario: Sistema Automatizado de Horas de Enfermedad

## Resumen
El sistema ahora calcula y guarda automáticamente las horas de enfermedad en tiempo real cuando los empleados hacen clock-in y clock-out. No es necesario guardar manualmente las horas de enfermedad en el módulo de nómina.

## Características Principales

### 1. Cálculo Automático al Hacer Clock-Out
Cuando un empleado hace clock-out, el sistema automáticamente:
- ✅ Calcula las horas trabajadas en esa sesión
- ✅ Actualiza el total de horas trabajadas del empleado (`totalHoursWorked`)
- ✅ Calcula las horas de enfermedad acumuladas (1 hora por cada 40 horas trabajadas)
- ✅ Actualiza el saldo de horas de enfermedad del empleado (`sickHoursBalance`)

### 2. Nueva Opción: Usar Horas de Enfermedad como Pago
Al hacer clock-in, ahora hay una casilla de verificación que permite marcar el turno para ser pagado usando horas de enfermedad:

**Ubicación**: 
- Pestaña "QR Scanner" → Solo aparece cuando el modo de escaneo es "Clock In"
- Pestaña "Manual Entry" → Solo aparece cuando el tipo de registro es "Clock In"

**Cómo funciona**:
1. Al hacer clock-in, marca la casilla "Use Sick Hours for Payment"
2. El empleado trabaja su turno normalmente
3. Al hacer clock-out, las horas trabajadas se deducen del saldo de horas de enfermedad
4. El sistema valida que el empleado tenga suficientes horas disponibles

### 3. Información Solo para Consulta
Las horas de enfermedad que se muestran en los siguientes lugares son **solo informativas**:
- **Módulo de Empleados**: Muestra el saldo actual de horas de enfermedad
- **Reportes de Nómina**: Muestra las horas acumuladas durante el período

⚠️ **Importante**: El botón "Save Sick Hours" ha sido eliminado del módulo de nómina porque las horas ya se guardan automáticamente.

## Flujos de Trabajo

### Flujo 1: Trabajo Normal (Acumulando Horas de Enfermedad)

1. **Clock-In**
   - Escanea el código QR del empleado o búscalo manualmente
   - La casilla "Use Sick Hours for Payment" debe estar **desmarcada**
   - Confirma el clock-in

2. **Durante el Turno**
   - El empleado trabaja normalmente

3. **Clock-Out**
   - Escanea el código QR del empleado o búscalo manualmente
   - Confirma el clock-out

4. **Actualización Automática**
   - ✅ Sistema calcula: 8 horas trabajadas
   - ✅ Sistema actualiza: `totalHoursWorked = [total anterior] + 8`
   - ✅ Sistema calcula: 8 ÷ 40 = 0.20 horas de enfermedad acumuladas
   - ✅ Sistema actualiza: `sickHoursBalance = [saldo anterior] + 0.20`

5. **Notificación**
   - Mensaje: "Clocked out Juan Pérez. Worked 8.00 hrs. Accrued 0.20 sick hrs. New balance: 5.20 hrs."

### Flujo 2: Usando Horas de Enfermedad como Pago

1. **Clock-In con Casilla Marcada**
   - Escanea el código QR del empleado
   - ✅ **Marca** la casilla "Use Sick Hours for Payment"
   - Aparece advertencia: "⚠️ The hours worked in this shift will be deducted from the employee's sick hours balance when they clock out."
   - Confirma el clock-in

2. **Durante el Turno**
   - El empleado trabaja normalmente

3. **Clock-Out**
   - Escanea el código QR del empleado
   - Confirma el clock-out

4. **Validación y Actualización Automática**
   - ✅ Sistema verifica que el empleado tenga suficientes horas de enfermedad
   - ✅ Sistema calcula: 8 horas trabajadas
   - ✅ Sistema actualiza: `totalHoursWorked = [total anterior] + 8`
   - ✅ Sistema **deduce**: `sickHoursBalance = [saldo anterior] - 8`
   - ❌ **NO** se acumulan nuevas horas de enfermedad

5. **Notificación**
   - Mensaje: "Clocked out Juan Pérez. Worked 8.00 hrs. Used sick hours for payment. New balance: 2.00 hrs."

### Flujo 3: Consultar Horas de Enfermedad

#### En la Página de Empleados
1. Ve a "Employees"
2. Busca la columna "Sick Hours"
3. El saldo mostrado siempre está actualizado (se actualiza en cada clock-out)

#### En el Reporte de Nómina
1. Ve a "Payroll"
2. Genera un reporte para el período deseado
3. En cada semana verás: "Sick Hours Accrued: + X.XX hrs" (en verde)
4. En el resumen del empleado verás:
   - "Total Sick Hours Accrued": Total acumulado en el período
   - "New Sick Hours Balance": Saldo proyectado después del período

⚠️ Esta información es solo para consulta. No hay botones para guardar porque ya se guardó automáticamente.

## Casos Especiales

### Caso 1: Horas Insuficientes
**Situación**: El empleado intenta usar horas de enfermedad pero no tiene suficientes.

**Qué pasa**:
1. Al hacer clock-out, el sistema detecta que el saldo es insuficiente
2. Se cancela el clock-out
3. Aparece mensaje de error: "Employee only has 2.50 sick hours available. Cannot use sick hours for payment."
4. El administrador debe desmarcar la casilla de horas de enfermedad y volver a hacer clock-in

### Caso 2: Múltiples Sesiones Activas
**Situación**: Un empleado tiene varios clock-ins sin clock-out.

**Qué pasa**:
1. Al hacer clock-out, todas las sesiones activas se cierran
2. Se calculan las horas de cada sesión y se suman
3. La actualización al registro del empleado es una sola operación atómica

### Caso 3: Primer Uso del Sistema
**Situación**: Empleado nuevo o empleado que nunca ha hecho clock-out antes.

**Qué pasa**:
1. El sistema trata los campos vacíos como 0
2. Primer clock-out inicializa `totalHoursWorked` y `sickHoursBalance`
3. A partir de ese momento, los cálculos funcionan normalmente

## Validaciones del Sistema

### ✅ Validaciones Automáticas
1. **Tiempo de Clock-Out**: No puede ser anterior al clock-in
2. **Saldo de Horas**: Debe tener suficientes horas para usar como pago
3. **Cálculos**: Siempre usa la fórmula 1:40 (1 hora de enfermedad por cada 40 trabajadas)
4. **Precisión**: Todos los cálculos se redondean a 2 decimales

### ⚠️ Mensajes de Error Comunes
- "No active clock-in found": El empleado no ha hecho clock-in
- "Clock-out time cannot be before clock-in time": Verifica la fecha/hora manual
- "Insufficient Sick Hours": El empleado no tiene suficiente saldo
- "Invalid Scan": El código QR no es válido

## Pantallas e Interfaces

### Pantalla 1: Clock-In con Checkbox (QR Scanner)
```
┌─────────────────────────────────────┐
│ QR Code Scanner                     │
├─────────────────────────────────────┤
│ [Client] [Ranch] [Block] [Task]     │
│                                     │
│ ☐ Use Manual Date/Time              │
│                                     │
│ ✓ Use Sick Hours for Payment        │
│ ⚠️ The hours worked in this shift   │
│    will be deducted from the        │
│    employee's sick hours balance    │
│    when they clock out.             │
│                                     │
│ [Camera View / QR Scanner]          │
└─────────────────────────────────────┘
```

### Pantalla 2: Clock-In con Checkbox (Manual Entry)
```
┌─────────────────────────────────────┐
│ Manual Log Entry                    │
├─────────────────────────────────────┤
│ Log Type: [Clock In ▼]              │
│                                     │
│ ☐ Use Manual Date/Time              │
│                                     │
│ ✓ Use Sick Hours for Payment        │
│ ⚠️ The hours worked in this shift   │
│    will be deducted...              │
│                                     │
│ Employee: [Juan Pérez]              │
│ [Submit Log]                        │
└─────────────────────────────────────┘
```

### Pantalla 3: Empleados con Horas de Enfermedad
```
┌──────────────────────────────────────────────────┐
│ Employees                                        │
├──────┬──────┬────────┬─────────────┬────────────┤
│ Name │ Role │ Status │ Sick Hours  │ QR Code    │
├──────┼──────┼────────┼─────────────┼────────────┤
│ Juan │ Work │ Active │ [5.20 hrs]  │ EMP001     │
│ María│ Work │ Active │ [12.50 hrs] │ EMP002     │
└──────┴──────┴────────┴─────────────┴────────────┘
```

### Pantalla 4: Reporte de Nómina (Solo Informativo)
```
┌─────────────────────────────────────┐
│ Employee: Juan Pérez                │
├─────────────────────────────────────┤
│ Week 1 (Jan 1 - Jan 7)              │
│   Total Hours: 40.00                │
│   Sick Hours Accrued: + 1.00 hrs    │
│                                     │
│ Total Sick Hours Accrued: 1.00 hrs  │
│ New Sick Hours Balance: 6.20 hrs    │
│                                     │
│ [← Generate New Report] [Print]     │
│ (No Save button - already saved!)   │
└─────────────────────────────────────┘
```

## Beneficios del Sistema Automatizado

### ✅ Ventajas para Administradores
1. **Sin errores manuales**: Los cálculos son automáticos y precisos
2. **Ahorro de tiempo**: No hay que recordar guardar las horas
3. **Información en tiempo real**: Siempre actualizada
4. **Menos pasos**: El proceso de nómina es más simple

### ✅ Ventajas para Empleados
1. **Transparencia**: Pueden ver su saldo en cualquier momento
2. **Confirmación inmediata**: Reciben notificación después de cada clock-out
3. **Flexibilidad**: Pueden elegir usar horas de enfermedad cuando lo necesiten

## Solución de Problemas

### Problema: La casilla no aparece
**Solución**: 
- Verifica que el modo de escaneo esté en "Clock In"
- En manual entry, verifica que el tipo de registro sea "Clock In"
- La casilla solo aparece durante clock-in, no clock-out

### Problema: Las horas no se están actualizando
**Solución**:
- Revisa la consola del navegador para errores
- Verifica los permisos de Firestore
- Asegúrate de que el clock-out se completó exitosamente

### Problema: Cálculos incorrectos
**Solución**:
- Verifica la diferencia de tiempo entre clock-in y clock-out
- Asegúrate de no tener problemas de zona horaria
- Revisa el registro del empleado en Firestore directamente

### Problema: Error al usar horas de enfermedad
**Solución**:
- Verifica el saldo actual del empleado
- Asegúrate de que el empleado tenga suficientes horas
- Si es necesario, desmarca la casilla y haz el clock-in nuevamente

## Preguntas Frecuentes

**P: ¿Tengo que hacer algo especial después de generar el reporte de nómina?**
R: No, las horas de enfermedad ya se guardaron automáticamente durante los clock-outs. El reporte solo muestra información.

**P: ¿Puedo cambiar las horas de enfermedad manualmente?**
R: Actualmente no hay una función para editar manualmente. Las horas se calculan automáticamente basándose en el trabajo realizado.

**P: ¿Qué pasa si me equivoco y marco la casilla por error?**
R: Puedes hacer clock-out del empleado, luego hacer clock-in nuevamente sin marcar la casilla.

**P: ¿Cómo veo el historial de uso de horas de enfermedad?**
R: En la pestaña "History" de Time Tracking puedes ver todas las entradas. Las que usaron horas de enfermedad estarán marcadas con la bandera `useSickHoursForPayment`.

**P: ¿Las horas de enfermedad expiran?**
R: Actualmente no hay política de expiración. Las horas se acumulan indefinidamente.

**P: ¿Puedo hacer clock-in bulk con horas de enfermedad?**
R: No, la función de bulk clock-in no incluye la opción de horas de enfermedad. Usa el clock-in individual para esta función.

## Notas Técnicas

### Fórmulas
- **Acumulación**: `horas_de_enfermedad = horas_trabajadas / 40`
- **Total histórico**: `totalHoursWorked = suma_de_todas_las_sesiones`
- **Saldo actual**: `sickHoursBalance = saldo_anterior + (usando_enfermedad ? -horas_trabajadas : horas_acumuladas)`

### Precisión
- Todos los cálculos se muestran con 2 decimales
- Internamente se almacenan como números de punto flotante
- No hay redondeo hasta la presentación final

### Almacenamiento
- Las actualizaciones se hacen en lote (batch) para garantizar consistencia
- Cada clock-out actualiza el registro del empleado y la entrada de tiempo
- Las operaciones son atómicas (o se completan todas o ninguna)

## Soporte

Para ayuda adicional, consulta:
- Documentación técnica: `SICK_HOURS_AUTOMATION.md`
- Implementación original: `SICK_HOURS_IMPLEMENTATION.md`
- Definiciones de tipos: `src/lib/types.ts`

---

**Última Actualización**: 22 de Octubre, 2025
**Versión**: 2.0 (Sistema Automatizado)
