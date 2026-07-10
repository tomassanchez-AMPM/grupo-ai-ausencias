import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y completa los valores.',
  )
}

export const supabase = createClient(url, anonKey)

// Solo en desarrollo: expone el cliente para pruebas E2E desde la consola.
if (import.meta.env.DEV) {
  ;(window as unknown as { supabase: typeof supabase }).supabase = supabase
}
