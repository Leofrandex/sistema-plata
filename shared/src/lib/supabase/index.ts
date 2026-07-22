/**
 * Punto de entrada del módulo Supabase.
 *
 * - `client.ts`     → cliente para componentes/hooks del browser
 * - `server.ts`     → cliente para Server Components / Server Actions / Route Handlers
 * - `middleware.ts` → refresca la sesión en cada request (lo usa `src/middleware.ts`)
 *
 * Los tipos de la BD (`Database`, `Tables<>`, `Enums<>`) viven en `database.types.ts`
 * y se regeneran con: `supabase gen types typescript --project-id xqqnthyipkdkwyknbtnw > src/lib/supabase/database.types.ts`
 */

export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './database.types'
