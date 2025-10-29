# Implementación de Persistencia de Datos Offline Global

## Resumen General
Este documento describe la implementación de persistencia de datos offline integral en toda la aplicación para asegurar que los datos permanezcan disponibles al navegar entre secciones sin conectividad a internet.

## Declaración del Problema
La aplicación tenía soporte parcial offline, pero varios problemas críticos permanecían:

1. **Pérdida de Datos al Navegar**: Al cambiar entre tabs/secciones offline, los datos previamente cargados desaparecían
2. **Estado de Carga en Dashboard**: El dashboard mostraba "Loading live activity..." indefinidamente cuando estaba offline
3. **Pérdida de Selecciones en Time-Tracking**: Las selecciones de cliente, rancho, bloque y tarea se perdían al navegar offline
4. **Datos Parciales en Historia**: El historial mostraba solo marcas de tiempo sin información de empleado, tarea o cliente cuando estaba offline

## Arquitectura de la Solución

### 1. Hook `useCollection` Mejorado con Caché Automático

**Archivo**: `/src/firebase/firestore/use-collection.tsx`

**Cambios Clave**:
- Agregado caché basado en sessionStorage para todas las consultas de Firestore
- El caché se puebla automáticamente cuando los datos se obtienen exitosamente online
- El caché se carga automáticamente al montar el componente si está disponible
- Los datos persisten en caché incluso cuando las consultas de Firestore fallan offline
- La clave de caché se deriva de la ruta de la colección/consulta para consistencia

**Detalles de Implementación**:
```typescript
interface CacheEntry<T> {
  data: WithId<T>[];
  timestamp: number;
}
```

- Las entradas de caché se almacenan en sessionStorage con claves como `firestore_cache_clients`, `firestore_cache_tasks`, etc.
- Al montar, los datos en caché se cargan si están disponibles (antes de que Firestore responda)
- En una obtención exitosa de Firestore, el caché se actualiza
- En error de Firestore, los datos existentes se retienen (no se borran) si tenemos datos en caché

**Beneficios**:
- Cero cambios de código requeridos en componentes que usan `useCollection`
- Caché automático para todas las consultas de Firestore
- Transiciones online/offline fluidas

### 2. Caché Mejorado en LiveActivity del Dashboard

**Archivo**: `/src/app/(app)/dashboard/live-activity.tsx`

**Cambios Clave**:
- Modificado para usar datos en caché de empleados, tareas y clientes cuando la obtención falla
- Carga datos de búsqueda desde el caché de sessionStorage antes de intentar obtener de Firestore
- Maneja fallos de obtención con gracia manteniendo los datos de actividad existentes
- Solo limpia la actividad cuando verdaderamente no hay datos disponibles Y está online

**Detalles de Implementación**:
```typescript
// Intentar cargar del caché primero
if (typeof window !== "undefined") {
  const cachedEmployees = sessionStorage.getItem("firestore_cache_employees");
  const cachedTasks = sessionStorage.getItem("firestore_cache_tasks");
  const cachedClients = sessionStorage.getItem("firestore_cache_clients");
  // ... poblar mapas desde caché
}
```

**Beneficios**:
- El dashboard muestra datos de actividad en caché cuando está offline
- No más estado infinito de "Loading live activity..."
- Información completa de empleado, tarea y cliente mostrada desde caché

### 3. Persistencia de Estado en Time-Tracking

**Archivo**: `/src/app/(app)/time-tracking/page.tsx`

**Cambios Clave**:
- Las selecciones de cliente, rancho, bloque y tarea ahora persisten en sessionStorage
- El estado se restaura al cargar/refrescar la página
- El estado se actualiza en sessionStorage en cada cambio

**Detalles de Implementación**:
```typescript
const [selectedClient, setSelectedClient] = useState<string>(() => {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("time_tracking_selected_client") || "";
  }
  return "";
});

useEffect(() => {
  if (typeof window !== "undefined") {
    if (selectedClient) {
      sessionStorage.setItem("time_tracking_selected_client", selectedClient);
    } else {
      sessionStorage.removeItem("time_tracking_selected_client");
    }
  }
}, [selectedClient]);
```

**Beneficios**:
- Las selecciones persisten a través de la navegación de páginas
- Los usuarios pueden cambiar de tabs y regresar sin perder su trabajo
- Los formularios permanecen usables offline con todas las opciones de dropdown disponibles

### 4. Visualización de Datos en Tab de Historia

**Cambios**: No se requirieron cambios de código

**Cómo Funciona**:
- El tab de historia usa `activeEmployees`, `allTasks`, y `clients` de `useCollection`
- Con el caché mejorado en `useCollection`, todos los datos de búsqueda están automáticamente disponibles
- Los registros de time entries y piecework también están en caché
- La información completa del registro (nombres de empleados, detalles de tareas, nombres de clientes) se muestra desde caché

**Beneficios**:
- El historial muestra información completa offline
- No más "Unknown Employee" o nombres de tarea/cliente faltantes
- Funcionalidad completa mantenida sin internet

## Arquitectura Técnica

### Estrategia de Almacenamiento de Caché

**Ubicación de Almacenamiento**: `sessionStorage` (almacenamiento de sesión del navegador)

**¿Por qué sessionStorage?**:
- Persiste a través de la navegación de páginas dentro de la misma sesión
- Se limpia automáticamente cuando se cierra la pestaña del navegador
- Sin conflictos entre diferentes pestañas del navegador
- Más seguro que localStorage (alcance de sesión)
- Adecuado para soporte offline temporal

**Claves de Caché**:
- Patrón: `firestore_cache_{ruta_colección}`
- Ejemplos:
  - `firestore_cache_employees`
  - `firestore_cache_tasks`
  - `firestore_cache_clients`
  - `firestore_cache_time_entries`
  - `firestore_cache_piecework`

**Estructura de Entrada de Caché**:
```typescript
{
  data: Array<WithId<T>>,  // Array de documentos con IDs
  timestamp: number         // Cuando se creó el caché
}
```

### Detección Online/Offline

**Mecanismo**:
- API nativa del navegador `navigator.onLine`
- Listeners de eventos para eventos `online` y `offline`
- Seguimiento basado en Ref para evitar re-renders

**Integración**:
- Hook `useNetworkStatus` proporciona estado global online/offline
- `useCollection` rastrea el estado de red internamente para decisiones de caché
- Los componentes pueden reaccionar a cambios de red vía el hook

### Flujo de Datos

#### Escenario Online:
1. El componente se monta
2. `useCollection` verifica el caché y lo carga (si está disponible)
3. La consulta de Firestore se ejecuta
4. Se reciben resultados
5. Estado actualizado con datos frescos
6. Caché actualizado en sessionStorage

#### Escenario Offline:
1. El componente se monta
2. `useCollection` verifica el caché y lo carga
3. La consulta de Firestore intenta ejecutarse
4. La consulta falla (offline)
5. El manejador de errores verifica si existen datos
6. Si existen datos (del caché), mantenerlos y dejar de cargar
7. Si no hay datos, mostrar error (raro - necesitaría ser primera carga offline)

#### Escenario de Navegación (Offline):
1. El usuario navega de Tab A a Tab B
2. Los componentes de Tab B se montan
3. `useCollection` carga datos en caché desde sessionStorage
4. La UI se renderiza inmediatamente con datos en caché
5. Las consultas de Firestore fallan (offline)
6. Los datos en caché se retienen (no se borran)
7. El usuario ve todos los datos como si estuviera online

## Estrategia de Invalidación de Caché

### Implementación Actual:
- Caché actualizado en cada obtención exitosa de Firestore
- Sin TTL (Time To Live) - el caché está fresco mientras exista la sesión
- Caché limpiado cuando se cierra la pestaña del navegador (comportamiento de sessionStorage)

### Mejoras Futuras (No Implementadas):
- Agregar TTL a entradas de caché
- Implementar actualización de caché al reconectar
- Agregar límites de tamaño de caché
- Implementar limpieza selectiva de caché

## Recomendaciones de Pruebas

### Pruebas Manuales:
1. **Carga Inicial Online**:
   - Abrir app con conexión a internet
   - Navegar a través de todos los tabs (Dashboard, Time Tracking, etc.)
   - Verificar que todos los datos carguen correctamente
   - Abrir DevTools del navegador > Application > Session Storage
   - Verificar que se crean entradas de caché

2. **Navegación Offline**:
   - Con la app abierta y datos cargados, abrir DevTools
   - Ir a tab Network, habilitar modo "Offline"
   - Navegar entre tabs (Dashboard ↔ Time Tracking ↔ etc.)
   - Verificar que los datos persisten y se muestran correctamente
   - Verificar que las selecciones en Time Tracking se mantienen

3. **Clock-in/Clock-out Offline**:
   - Permanecer offline
   - Realizar operación de clock-in
   - Navegar al Dashboard
   - Verificar que la actividad en vivo muestra el clock-in
   - Navegar al tab de Historia
   - Verificar que la entrada aparece con información completa

4. **Reconexión**:
   - Deshabilitar modo offline en DevTools
   - Verificar que los datos se sincronizan/actualizan
   - Verificar que se obtienen nuevos datos y el caché se actualiza

### Verificaciones en DevTools del Navegador:

**Session Storage**:
```
Application > Session Storage > [tu-dominio]
Buscar claves:
- firestore_cache_employees
- firestore_cache_tasks
- firestore_cache_clients
- firestore_cache_time_entries
- firestore_cache_piecework
- time_tracking_selected_client
- time_tracking_selected_ranch
- time_tracking_selected_block
- time_tracking_selected_task
```

**Network**:
```
Network > Modo Offline
Probar toda la funcionalidad mientras está offline
```

## Archivos Modificados

1. `/src/firebase/firestore/use-collection.tsx`
   - Agregada infraestructura de caché
   - Mejorado manejo de errores para escenarios offline
   - Implementada lógica de carga/guardado de caché

2. `/src/app/(app)/dashboard/live-activity.tsx`
   - Mejorado para usar datos de búsqueda en caché
   - Mejorado manejo de errores offline
   - Mantenidos datos existentes cuando está offline

3. `/src/app/(app)/time-tracking/page.tsx`
   - Agregada persistencia de sessionStorage para selecciones
   - Implementada restauración de estado al montar
   - Agregados hooks useEffect para persistir cambios de estado

## Archivos Creados

1. `/src/hooks/use-offline-cache.ts`
   - Hook de caché offline independiente (para uso futuro)
   - Demuestra patrón de caché explícito
   - No usado actualmente pero disponible para necesidades de caché personalizadas

## Resumen de Beneficios

✅ **Cero Pérdida de Datos**: Todos los datos cargados persisten a través de la navegación
✅ **UX Fluido**: Los usuarios no notan cuando están offline (si los datos fueron previamente cargados)
✅ **Persistencia de Estado**: Selecciones de formularios mantenidas a través de sesiones
✅ **Información Completa**: Todos los datos de búsqueda (empleados, tareas, clientes) disponibles offline
✅ **Automático**: No se necesita intervención manual - el caché es transparente
✅ **Compatible hacia Atrás**: Todo el código existente continúa funcionando sin cambios

## Limitaciones Conocidas

1. **Primera Carga Offline**: Si la primera visita del usuario es offline, no existen datos en caché
2. **Tamaño de Caché**: Sin límites en uso de sessionStorage (podría ser problema con grandes conjuntos de datos)
3. **Sin TTL**: El caché no expira hasta que termina la sesión
4. **Solo Sesión**: Caché limpiado cuando se cierra la pestaña del navegador
5. **Sin Resolución de Conflictos**: Si los datos cambian en Firestore mientras está offline, la última escritura gana

## Mejoras Futuras

1. **Migración a IndexedDB**: Usar IndexedDB en lugar de sessionStorage para:
   - Mayor capacidad de almacenamiento
   - Sincronización entre pestañas
   - Mejor rendimiento para grandes conjuntos de datos

2. **Service Worker**: Implementar service worker para:
   - Arquitectura verdadera offline-first
   - Sincronización en segundo plano
   - Notificaciones push para conflictos de datos

3. **Resolución de Conflictos**: Agregar lógica para manejar:
   - Ediciones concurrentes desde múltiples dispositivos
   - Estrategias de fusión para cambios offline
   - Notificaciones de usuario para conflictos

4. **Gestión Inteligente de Caché**:
   - Implementar límites de tamaño de caché
   - Agregar TTL con expiración configurable
   - Limpieza selectiva de caché basada en uso

5. **Actualizaciones Optimistas de UI**:
   - Mostrar operaciones inmediatamente
   - Encolar para sincronización posterior
   - Rollback en fallo de sincronización

## Conclusión

Esta implementación proporciona soporte offline robusto que es transparente para los usuarios y requiere cambios mínimos de código. La estrategia de caché asegura disponibilidad de datos a través de toda la aplicación, haciendo la app usable incluso en áreas con conectividad pobre o nula a internet.

## Solución al Problema Original

**Problema reportado**: 
> "en el history tab si se mostró correctamente, pero en el dashboard solo que se quedaba como Loading live activity... y cuando volví al time-tracking ya no aparecia los datos de los selects del client,ranch,block, y tasks, y en el history solo aparecia mi clockin mi card pero sin mis datos solo la hora y fecha"

**Solución implementada**:
1. ✅ **Dashboard "Loading live activity..."** → Ahora usa datos en caché de empleados/tareas/clientes
2. ✅ **Time-tracking pierde datos de selects** → Selecciones ahora persisten en sessionStorage
3. ✅ **History solo muestra hora y fecha** → Ahora muestra datos completos desde caché
4. ✅ **Modo offline global** → Todo se cachea automáticamente en useCollection

La aplicación ahora funciona completamente offline de manera transversal como se solicitó.
