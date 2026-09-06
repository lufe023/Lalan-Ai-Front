# Instrucciones de integración del parche

## Archivos generados en este parche

### Frontend

| Archivo | Descripción |
|---|---|
| `src/context/AppContext.tsx` | Versión completa actualizada — incluye tipos PriceList/PriceListRule, estado `priceLists`, y funciones CRUD/asignación |
| `src/screens/CatalogScreen.tsx` | Pantalla de catálogo con modales de servicio y producto, emoji picker, categorías |
| `src/screens/PriceListsScreen.tsx` | Pantalla de listas de precios — CRUD de listas, editor de reglas, asignación a clientes |

### Backend

| Archivo | Descripción |
|---|---|
| `backend/schema.prisma` | Schema Prisma con PriceList, PriceListRule, CategoryConfig |
| `backend/price-lists/` | Módulo NestJS completo (controller, service, dto, module) |
| `backend/categories/` | Módulo NestJS completo (controller, service, dto, module) |
| `backend/app.module.patch.ts` | Instrucciones de integración en AppModule |

---

## Pasos para aplicar

### 1. Backend

```bash
# Agregar en backend/src/app.module.ts:
# import { CategoriesModule }  from './categories/categories.module';
# import { PriceListsModule }  from './price-lists/price-lists.module';
# ...y ambos en el array imports de @Module

# Correr migración Prisma:
npx prisma migrate dev --name add_category_configs_price_lists
```

### 2. Frontend — AppContext

Reemplazar el archivo existente `src/context/AppContext.tsx` con la versión del parche.

**Nuevos campos en AppContextType:**
- `priceLists: PriceList[]`
- `isLoadingPriceLists: boolean`
- `loadPriceLists(): Promise<void>`
- `createPriceList(dto): Promise<PriceList>`
- `updatePriceList(id, dto): Promise<void>`
- `deletePriceList(id): Promise<void>`
- `assignPriceList(priceListId, clientId): Promise<void>`
- `unassignPriceList(clientId): Promise<void>`

**Nota:** El campo `priceListId` también se espera en el tipo `Client` para que `AssignPanel` funcione. Agrega `priceListId?: string` al tipo `Client` en `src/types.ts`.

### 3. Frontend — Navegación

En tu componente de navegación principal (Sidebar / BottomNav), agrega una entrada para `'price-lists'`:

```tsx
import { PriceListsScreen } from '../screens/PriceListsScreen';

// En el switch de pantallas:
case 'price-lists':
  return <PriceListsScreen />;

// En el menú lateral:
{ screen: 'price-lists', label: 'Precios', icon: '🏷️' }
```

### 4. Frontend — Client type

En `src/types.ts`, agregar el campo opcional en la interfaz `Client`:

```ts
export interface Client {
  // ... campos existentes ...
  priceListId?: string;  // lista de precios asignada (undefined = usa la default)
}
```

---

## API endpoints disponibles (price-lists)

| Método | Ruta | Descripción |
|---|---|---|
| GET | /price-lists | Listar todas las listas del tenant |
| GET | /price-lists/:id | Detalle con reglas y clientes asignados |
| POST | /price-lists | Crear lista con reglas |
| PATCH | /price-lists/:id | Actualizar lista (reemplaza reglas) |
| DELETE | /price-lists/:id | Eliminar lista |
| POST | /price-lists/:id/assign/:clientId | Asignar lista a cliente |
| DELETE | /price-lists/unassign/:clientId | Desasignar (vuelve a default) |
| POST | /price-lists/compute-price | Calcular precio efectivo para cliente+servicio/producto |
