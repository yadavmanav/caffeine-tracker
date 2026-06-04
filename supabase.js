import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jksnfavntsbkabbgtte.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprc25mYXZudHNia2FiYmpndHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjI0MDYsImV4cCI6MjA5NjA5ODQwNn0.x0Ica1IclJkDoHbDTRvI2NeXR_nBBhW33_BZG_hh-UI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
