import { createClient } from '@supabase/supabase-js'

// REPLACE THESE WITH YOUR ACTUAL VALUES FROM SUPABASE
const supabaseUrl = 'https://iyqozzanpaeolpxnskmh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cW96emFucGFlb2xweG5za21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NDU3NzYsImV4cCI6MjA3NTQyMTc3Nn0.oVwEh6RcxXAPRSE2qOpUSEF2DuKD_OgFgmKwvjGDrDg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)