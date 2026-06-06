// Sift Supabase project config — both values are public (publishable key is
// designed to be exposed in client code; RLS is what actually protects user
// data). Edit here if the project is migrated.

export const SUPABASE_URL = 'https://vxvvbqobvdgfnejkenkz.supabase.co';
export const SUPABASE_ANON_KEY =
  'sb_publishable_GsrbrlapOgOSRZ5U6IHRYw_fAu7FuNz';

// Storage bucket layout: every object's first path segment is the user's
// auth.uid() — RLS policies on storage.objects enforce this prefix. See the
// sift_storage_bucket migration.
export const PHOTO_BUCKET = 'sift-photos';

// Hard-coded cover presets shipped with the site under /sift/assets/covers/.
// The original express route listed the directory at request time; here we
// inline the list because the SPA serves the assets statically.
export const COVER_PRESETS = [
  { name: 'cover-1.svg', url: './assets/covers/cover-1.svg' },
  { name: 'cover-2.svg', url: './assets/covers/cover-2.svg' },
  { name: 'cover-3.svg', url: './assets/covers/cover-3.svg' },
  { name: 'cover-4.svg', url: './assets/covers/cover-4.svg' },
  { name: 'cover-5.svg', url: './assets/covers/cover-5.svg' },
];
