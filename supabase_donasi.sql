-- ============================================================================
-- SQL SCHEMA MIGRATION: DONATION SETTINGS & LEADERBOARD
-- Skrip ini AMAN dijalankan berulang kali (Idempotent / Non-destructive)
-- ============================================================================

-- 1. Buat Tabel `donation_settings` jika belum ada
CREATE TABLE IF NOT EXISTS public.donation_settings (
    id TEXT PRIMARY KEY DEFAULT 'main_config', -- identifier konfigurasi utama
    data JSONB NOT NULL,                       -- menyimpan konfigurasi target goal, leaderboard, & cta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.donation_settings ENABLE ROW LEVEL SECURITY;

-- 3. Setup Policy Keamanan RLS
DROP POLICY IF EXISTS "Public read access for donation_settings" ON public.donation_settings;
CREATE POLICY "Public read access for donation_settings"
ON public.donation_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public insert access for donation_settings" ON public.donation_settings;
CREATE POLICY "Public insert access for donation_settings"
ON public.donation_settings
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public update access for donation_settings" ON public.donation_settings;
CREATE POLICY "Public update access for donation_settings"
ON public.donation_settings
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 4. Inisialisasi Data Default jika tabel masih kosong
INSERT INTO public.donation_settings (id, data, updated_at)
VALUES (
  'main_config',
  '{
    "targetGoal": {
      "enabled": true,
      "title": "Target Goal Donasi Stream & Tooling",
      "currentAmount": 450000,
      "targetAmount": 1000000,
      "percentage": 45,
      "autoCalc": true,
      "customNote": "Rp {current} terkumpul dari target Rp {target} — terima kasih banyak buat semua dukungannya! 🙏"
    },
    "leaderboard": [
      {
        "id": "lb-1",
        "rank": 1,
        "name": "Sambung kata",
        "amount": 300000,
        "initials": "SK",
        "colorTheme": "orange",
        "badgeText": "👑 Top 1"
      },
      {
        "id": "lb-2",
        "rank": 2,
        "name": "Sss",
        "amount": 100000,
        "initials": "SS",
        "colorTheme": "cyan",
        "badgeText": ""
      },
      {
        "id": "lb-3",
        "rank": 3,
        "name": "Vanya",
        "amount": 100000,
        "initials": "VN",
        "colorTheme": "pink",
        "badgeText": ""
      },
      {
        "id": "lb-4",
        "rank": 4,
        "name": "Virgi",
        "amount": 50000,
        "initials": "VG",
        "colorTheme": "gray",
        "badgeText": ""
      }
    ],
    "ctaSettings": {
      "buttonText": "Jadi Donatur Berikutnya ↗",
      "buttonUrl": "https://saweria.co/YabiDev",
      "saweriaUsername": "YabiDev"
    }
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 5. Realtime Enable (Agar update live langsung tersiar ke semua penonton)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'donation_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donation_settings;
  END IF;
END $$;
