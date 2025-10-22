# Sick Hours Feature - User Guide (Spanish/Español)

## Resumen del Anexo de Horas de Enfermedad

Este sistema implementa el seguimiento automático de horas de enfermedad según lo solicitado:
- **Cada 40 horas trabajadas** = **1 hora de enfermedad acumulada**
- Las horas se acumulan automáticamente
- Aparecen en los reportes de nómina (payroll)
- Se actualizan cada vez que se procesan las nóminas
- Los empleados pueden usar estas horas cuando faltan al trabajo
- Las horas usadas se descuentan del balance del empleado
- Todo aparece en la sección de Employees

---

## 1. Cómo se Acumulan las Horas de Enfermedad

### Proceso Automático en el Payroll

1. **Generar Reporte de Nómina**
   - Ir a: Payroll → Seleccionar período → Generate Report
   - El sistema calcula automáticamente: `Horas Trabajadas ÷ 40 = Horas de Enfermedad`

2. **Revisar las Horas Acumuladas**
   - En cada resumen semanal aparece: **"Sick Hours Accrued"** (en verde)
   - Al final del resumen del empleado: **"Total Sick Hours Accrued"** y **"New Sick Hours Balance"**

3. **Guardar las Horas al Sistema**
   - Hacer clic en el botón: **"Save Sick Hours"**
   - Esto actualiza los registros de todos los empleados en la base de datos
   - El botón cambia a **"Sick Hours Saved"** con un check verde

### Ejemplo de Cálculo
```
Empleado trabajó 80 horas en el período
80 ÷ 40 = 2 horas de enfermedad acumuladas
```

---

## 2. Ver el Balance de Horas de Enfermedad

### En la Página de Employees

**Ubicación:** Menú principal → Employees

**Columnas de la Tabla:**
| Name | Role | Status | **Sick Hours** | QR Code | Actions |
|------|------|--------|----------------|---------|---------|
| Juan Pérez | Worker | Active | **24.50 hrs** | ... | ... |

- La columna **"Sick Hours"** muestra el balance actual de cada empleado
- Formato: `XX.XX hrs` (ejemplo: `24.50 hrs`)
- Si un empleado no tiene horas registradas, muestra: `0.00 hrs`
- **Nota:** Esta columna es visible en pantallas grandes (hidden lg:table-cell)

---

## 3. Usar Horas de Enfermedad (Registrar Ausencias)

### Ubicación: Time Tracking → Manual Entry

Después de las secciones de "Bulk Clock In" y "Bulk Clock Out", hay una nueva sección:

### **"Log Sick Leave"** (Registrar Ausencia por Enfermedad)

**Pasos:**

1. **Buscar al Empleado**
   - Escribir el nombre en el campo de búsqueda
   - Los resultados muestran: `Nombre - XX.XX sick hrs available`
   - Hacer clic en el empleado para seleccionarlo

2. **Revisar Información**
   - Se muestra un recuadro con:
     - **Selected Employee:** [Nombre del empleado]
     - **Available Sick Hours:** [Horas disponibles en verde]

3. **Ingresar Horas a Usar**
   - Campo: **"Hours to Use"**
   - Puede ingresar incrementos de 0.5 (ejemplo: 4, 4.5, 8)
   - El sistema no permite ingresar más horas de las disponibles

4. **Seleccionar Fecha de Ausencia**
   - Campo: **"Date of Absence"**
   - Seleccionar el día que faltó al trabajo

5. **Notas Opcionales**
   - Campo: **"Notes (Optional)"**
   - Puede agregar: razón de ausencia, nota médica, etc.

6. **Registrar la Ausencia**
   - Hacer clic en: **"Log Sick Leave"**
   - El sistema:
     - Crea un registro de tiempo marcado como sick leave
     - Descuenta las horas del balance del empleado
     - Actualiza inmediatamente la base de datos
   - Mensaje de confirmación muestra el nuevo balance

### Validaciones del Sistema

El sistema verifica:
- ✅ Que haya un empleado seleccionado
- ✅ Que las horas sean un número válido y mayor a 0
- ✅ Que el empleado tenga suficientes horas disponibles
- ✅ Que se haya seleccionado una fecha

Si algo falta, muestra un mensaje de error explicativo.

---

## 4. Cómo Aparece en el Reporte de Nómina

### En el Resumen Semanal

Para cada semana, después de las horas trabajadas y ajustes, aparece:

```
Week Summary & Adjustments
├── Total Hours Worked: 40.00
├── Raw Task Earnings: $651.20
├── Minimum Wage Top-Up: + $0.00
├── Paid Rest Breaks: + $16.28
└── Sick Hours Accrued (1hr / 40hrs): + 1.00 hrs  [EN VERDE]

Total Weekly Pay: $667.48
```

### En el Resumen del Empleado

Al final del reporte de cada empleado:

```
Employee Pay Summary for Period
├── Total Sick Hours Accrued: 2.50 hrs     [EN VERDE]
├── New Sick Hours Balance: 27.50 hrs      [EN VERDE]
└── Final Pay: $1,334.96
```

---

## 5. Flujo Completo de Ejemplo

### Escenario: Juan Pérez trabaja y luego se enferma

**Semana 1-2: Acumulando Horas**
1. Juan trabaja 80 horas en dos semanas
2. Al generar el payroll, el sistema calcula: 80 ÷ 40 = 2 horas de enfermedad
3. El reporte muestra las 2 horas acumuladas
4. El supervisor hace clic en "Save Sick Hours"
5. Juan ahora tiene 2.00 horas en su balance

**Semana 3: Usando las Horas**
1. Juan se enferma el lunes (8 horas de ausencia)
2. El supervisor va a: Time Tracking → Manual Entry → Log Sick Leave
3. Selecciona a Juan (muestra: "2.00 sick hrs available")
4. Ingresa: 2 horas a usar (no tiene las 8 completas)
5. Selecciona la fecha del lunes
6. Hace clic en "Log Sick Leave"
7. El balance de Juan ahora es: 0.00 horas
8. Las 2 horas cubren parte de su ausencia

**Importante:** Las horas de sick leave:
- NO cuentan como horas trabajadas en el payroll
- NO generan más horas de enfermedad
- Aparecen en el historial pero marcadas como "Sick Leave"

---

## 6. Consideraciones Importantes

### ¿Qué pasa si el empleado no tiene suficientes horas?

Si Juan falta 8 horas pero solo tiene 2 horas de enfermedad:
- Puede usar sus 2 horas disponibles
- Las otras 6 horas no están cubiertas por sick hours
- Esto se refleja en el payroll como horas no trabajadas

### ¿Las horas expiran?

Actualmente NO hay expiración implementada. Las horas se acumulan indefinidamente hasta que se usen.

### ¿Se pueden usar horas parciales?

Sí, el sistema permite incrementos de 0.5 horas (30 minutos).
Ejemplos válidos: 0.5, 1.0, 1.5, 2.0, 4.5, 8.0

### ¿Quién puede registrar sick leave?

Cualquier usuario con acceso a "Time Tracking" puede registrar sick leave para los empleados.

---

## 7. Reportes y Seguimiento

### Dónde Ver la Información

1. **Employees Page**
   - Balance actual de cada empleado
   - Vista rápida de quién tiene más/menos horas

2. **Payroll Reports**
   - Horas acumuladas en cada período
   - Balance actualizado después de cada payroll
   - Histórico de acumulación

3. **Time Tracking History**
   - Registros de cuándo se usaron las horas
   - Fechas de ausencias
   - Notas asociadas a cada uso

---

## 8. Preguntas Frecuentes

**P: ¿Cómo sé si las horas ya fueron guardadas?**
R: Después de generar el payroll, el botón "Save Sick Hours" cambia a "Sick Hours Saved" con un check verde.

**P: ¿Puedo corregir un registro de sick leave?**
R: Actualmente se debe eliminar el registro desde Time Tracking → History y volver a ingresarlo.

**P: ¿El sistema notifica cuando un empleado usa todas sus horas?**
R: No automáticamente, pero al intentar registrar más horas de las disponibles, muestra un error.

**P: ¿Las horas de sick leave aparecen diferente en el historial?**
R: Sí, están marcadas como "Sick Leave" y no cuentan en los cálculos de payroll.

**P: ¿Qué pasa si genero el payroll dos veces sin guardar?**
R: Las horas se calculan cada vez, pero NO se duplican. Solo se guardan cuando haces clic en "Save Sick Hours".

---

## 9. Soporte Técnico

Si encuentras algún problema:

1. **Revisar** que el empleado tenga status "Active"
2. **Verificar** que las horas fueron guardadas después del último payroll
3. **Consultar** el archivo `SICK_HOURS_IMPLEMENTATION.md` para detalles técnicos
4. **Revisar** la consola del navegador para errores (F12)

---

## 10. Próximas Mejoras Sugeridas

Ideas para futuras versiones:
- [ ] Límite máximo de horas acumulables
- [ ] Notificaciones cuando las horas son bajas
- [ ] Aprobación de supervisor para usar sick hours
- [ ] Reporte específico de uso de sick hours
- [ ] Política de expiración de horas
- [ ] Vista de calendario para ausencias
- [ ] Integración con sistema de aprobaciones

---

**Versión del Sistema:** v1.0.0  
**Fecha de Implementación:** 2025-10-22  
**Desarrollado por:** GitHub Copilot Agent
