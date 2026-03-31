import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rnbolrhsrhipljoaiwuw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYm9scmhzcmhpcGxqb2Fpd3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzQ3MjgsImV4cCI6MjA5MDQxMDcyOH0.105xmarhEYsmVkgCL0WloInOWGnsuopesVbmG3uenqU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
