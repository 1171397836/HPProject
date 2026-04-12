import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://rgxulfvkvrxglupdlrhf.supabase.co';
const supabaseKey = 'sb_publishable__3ny_4QSIrmXzQbzaD7GXQ_aGanxBSo';

export const supabase = createClient(supabaseUrl, supabaseKey);
