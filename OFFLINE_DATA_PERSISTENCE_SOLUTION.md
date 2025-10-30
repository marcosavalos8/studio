# Implementación de Carga y Persistencia de Datos Offline

## Problema Resuelto

El usuario reportaba que cuando navegaba a las secciones de clients, tasks, etc., no aparecían los datos. La aplicación debería:
1. **Primera carga (online)**: Cargar TODOS los datos una sola vez
2. **Navegación offline**: Mantener los datos cargados, permitir navegar sin recargar
3. **Disponibilidad offline**: Mostrar los datos ya descargados aunque no haya conexión

## Cambios Implementados

### 1. Hook `useCollection` con Cache Automático

**Archivo**: `/src/firebase/firestore/use-collection.tsx`

**Problema anterior**: 
- El hook no tenía implementado el cache en sessionStorage
- Al perder conexión, los datos se borraban (setData(null))
- Al navegar offline, las secciones quedaban vacías

**Solución implementada**:
```typescript
interface CacheEntry<T> {
  data: WithId<T>[];
  timestamp: number;
}
```

**Flujo del cache**:
1. **Al montar el componente**: Carga datos desde sessionStorage si existen
2. **Al recibir datos de Firestore**: Actualiza el cache en sessionStorage
3. **Al fallar Firestore (offline)**: Mantiene los datos en cache, NO los borra

**Clave de cache**: `firestore_cache_{collection_path}` 
- Ejemplo: `firestore_cache_clients`, `firestore_cache_tasks`

**Código clave**:
```typescript
// Cargar del cache al montar
if (typeof window !== "undefined") {
  const cachedData = sessionStorage.getItem(cacheKey);
  if (cachedData) {
    const cacheEntry: CacheEntry<T> = JSON.parse(cachedData);
    setData(cacheEntry.data);
  }
}

// Guardar en cache cuando hay éxito
sessionStorage.setItem(cacheKey, JSON.stringify({
  data: results,
  timestamp: Date.now(),
}));

// NO borrar datos cuando hay error (offline)
setData((currentData) => {
  if (currentData && currentData.length > 0) {
    return currentData; // Mantener datos en cache
  }
  return null;
});
```

### 2. Componente DataPrecacher

**Archivo**: `/src/components/data-precacher.tsx` (nuevo)

**Propósito**: Pre-cargar TODAS las colecciones importantes al iniciar la app

**Colecciones pre-cargadas**:
- clients
- tasks
- employees
- time_entries
- piecework
- payroll

**Comportamiento**:
1. Se ejecuta 2 segundos después de cargar la app (no bloquea UI)
2. Carga todas las colecciones en paralelo usando `getDocs`
3. Guarda cada colección en sessionStorage
4. Registra logs en consola para debugging

**Código principal**:
```typescript
const fetchPromises = collections.map(async (collectionName) => {
  const collectionRef = collection(firestore, collectionName);
  const snapshot = await getDocs(collectionRef);
  
  const cacheKey = `firestore_cache_${collectionName}`;
  const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  
  sessionStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now(),
  }));
});

await Promise.all(fetchPromises);
```

**Logs de consola esperados**:
```
Starting data pre-fetch for offline support...
Pre-fetched and cached: clients (5 items)
Pre-fetched and cached: tasks (12 items)
Pre-fetched and cached: employees (8 items)
...
All data pre-fetched successfully - app is ready for offline use
```

### 3. Integración en App Layout

**Archivo**: `/src/app/(app)/layout.tsx`

**Cambio**:
```typescript
import { DataPrecacher } from '@/components/data-precacher'

// En el componente
<NetworkStatusIndicator />
<PagePrecacher />
<DataPrecacher />  // ← NUEVO
```

**Orden de ejecución**:
1. Usuario carga la app
2. Se autentica (anonymous sign-in)
3. Se monta el layout
4. PagePrecacher pre-cachea las páginas (1 segundo después)
5. DataPrecacher pre-carga los datos (2 segundos después)
6. App lista para uso offline

### 4. Mejora en Persistencia de Firebase

**Archivo**: `/src/firebase/index.ts`

**Cambio**: De `enableIndexedDbPersistence` a `enableMultiTabIndexedDbPersistence`

**Beneficio**:
- Permite múltiples tabs abiertos simultáneamente
- Mejor para PWAs
- Sincronización automática entre tabs

**Código**:
```typescript
enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Firestore persistence failed: Multiple tabs open");
  } else if (err.code === "unimplemented") {
    console.warn("Firestore persistence not supported in this browser");
  }
});
```

## Arquitectura de Almacenamiento

### Doble Capa de Cache

**1. IndexedDB (Firebase Firestore)**
- Gestionado automáticamente por Firebase
- Almacena documentos completos
- Sincronización bidireccional
- Persiste entre sesiones (no se borra al cerrar tab)

**2. SessionStorage (Nuestra implementación)**
- Cache explícito para acceso rápido
- Se borra al cerrar la tab
- Backup cuando Firestore falla
- Formato: JSON serializado

### ¿Por qué dos capas?

**IndexedDB solo** no es suficiente porque:
- onSnapshot puede no responder rápido cuando está offline
- El hook podía setear data a null antes de que IndexedDB respondiera
- Necesitamos garantizar datos instantáneos al navegar

**SessionStorage + IndexedDB** proporciona:
- ✅ Datos instantáneos al cargar componente (sessionStorage)
- ✅ Datos persistentes entre sesiones (IndexedDB)
- ✅ Sincronización automática (IndexedDB)
- ✅ Navegación offline fluida (sessionStorage)

## Flujo Completo del Usuario

### Primera Visita (Online)

```
1. Usuario abre app → Login anonymous
2. App se carga → Layout monta componentes
3. DataPrecacher inicia (después de 2s)
4. Se cargan TODAS las colecciones en paralelo
5. Datos se guardan en:
   - IndexedDB (por Firebase)
   - SessionStorage (por DataPrecacher)
6. Usuario navega a /clients → Datos aparecen INMEDIATAMENTE
7. Usuario navega a /tasks → Datos aparecen INMEDIATAMENTE
```

**Resultado**: ✅ Todos los datos cargados y cacheados

### Navegación Offline

```
1. Usuario pierde conexión (o activa modo offline)
2. Usuario navega a /clients
   ├─ useCollection se monta
   ├─ Carga datos desde sessionStorage INMEDIATAMENTE
   ├─ setData(cachedData) → UI muestra clientes
   ├─ onSnapshot intenta conectar a Firestore
   ├─ onSnapshot falla (offline)
   └─ Error handler MANTIENE los datos en cache (no borra)
3. Usuario ve todos los clientes (del cache)
4. Usuario navega a /tasks
   ├─ Mismo flujo que arriba
   └─ Usuario ve todas las tareas (del cache)
```

**Resultado**: ✅ Navegación fluida como si estuviera online

### Reconexión

```
1. Usuario recupera conexión
2. onSnapshot recibe actualizaciones de Firestore
3. Datos se actualizan en:
   - Estado del componente (setData)
   - SessionStorage (cache actualizado)
   - IndexedDB (automático por Firebase)
4. Usuario ve datos más recientes
```

**Resultado**: ✅ Sincronización automática

## Verificación de Implementación

### Cómo probar en DevTools

**1. Verificar cache en SessionStorage**:
```
1. Abrir app en Chrome
2. F12 → Application tab → Session Storage → [tu-dominio]
3. Buscar claves:
   - firestore_cache_clients
   - firestore_cache_tasks
   - firestore_cache_employees
   - firestore_cache_time_entries
   - firestore_cache_piecework
4. Hacer click en cada clave → Ver datos en JSON
```

**2. Verificar persistencia en IndexedDB**:
```
1. F12 → Application tab → IndexedDB
2. Expandir firebaseLocalStorageDb
3. Ver colecciones cacheadas por Firebase
```

**3. Simular modo offline**:
```
1. Cargar app (online) → Esperar 5 segundos (para pre-carga)
2. F12 → Network tab → Throttling: Offline
3. Navegar a /clients → ✅ Deben aparecer clientes
4. Navegar a /tasks → ✅ Deben aparecer tareas
5. Navegar a /employees → ✅ Deben aparecer empleados
6. Network tab → Throttling: Online
7. Verificar sincronización
```

**4. Verificar logs en consola**:
```javascript
// Al cargar la app, deberías ver:
Starting data pre-fetch for offline support...
Pre-fetched and cached: clients (X items)
Pre-fetched and cached: tasks (X items)
Pre-fetched and cached: employees (X items)
Pre-fetched and cached: time_entries (X items)
Pre-fetched and cached: piecework (X items)
Pre-fetched and cached: payroll (X items)
All data pre-fetched successfully - app is ready for offline use
```

## Archivos Modificados

1. **`src/firebase/firestore/use-collection.tsx`**
   - ✅ Agregado interface CacheEntry
   - ✅ Agregado carga de cache al montar
   - ✅ Agregado guardado de cache en onSnapshot success
   - ✅ Modificado error handler para mantener datos en cache

2. **`src/firebase/index.ts`**
   - ✅ Cambiado a enableMultiTabIndexedDbPersistence
   - ✅ Mejorado manejo de errores

3. **`src/app/(app)/layout.tsx`**
   - ✅ Importado DataPrecacher
   - ✅ Agregado <DataPrecacher /> al JSX

4. **`src/components/data-precacher.tsx`** (NUEVO)
   - ✅ Componente completo para pre-carga de datos

## Beneficios de la Solución

✅ **Carga inicial rápida**: Datos se pre-cargan en background
✅ **Navegación instantánea**: Datos disponibles desde cache inmediatamente
✅ **Offline-first**: App funciona completamente sin conexión
✅ **Sincronización automática**: Firebase maneja la sincronización
✅ **Sin cambios en componentes**: Todo funciona transparentemente
✅ **Multi-tab support**: Varias tabs pueden estar abiertas
✅ **Logs informativos**: Fácil debugging con console logs

## Limitaciones

⚠️ **Primera carga offline**: Si nunca se abrió la app online, no hay datos en cache
⚠️ **Tamaño de sessionStorage**: Limitado a ~5-10MB (suficiente para la mayoría de casos)
⚠️ **Cache por sesión**: Se pierde al cerrar la tab (pero IndexedDB persiste)

## Mejoras Futuras Posibles

1. **Service Worker adicional**: Para cache de red más agresivo
2. **Indicador visual de pre-carga**: Mostrar progreso de carga inicial
3. **TTL en cache**: Expiración automática de datos viejos
4. **Cache selectivo**: Permitir usuario elegir qué pre-cargar
5. **Compresión de cache**: Reducir tamaño en sessionStorage

## Conclusión

La implementación resuelve completamente el problema reportado:

✅ **Primera carga**: Todos los datos se cargan automáticamente
✅ **Navegación offline**: Datos persisten y se muestran correctamente
✅ **Disponibilidad de datos offline**: sessionStorage + IndexedDB garantizan disponibilidad

La app ahora es una verdadera PWA offline-first, lista para usar en campo sin conexión.
