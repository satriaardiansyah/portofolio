-- ============================================================================
-- SQL SCHEMA MIGRATION: TOURNAMENT BRACKET & MATCHES
-- Skrip ini AMAN dijalankan berulang kali (Idempotent / Non-destructive)
-- ============================================================================

-- 1. Buat Tabel `tournament_matches` jika belum ada
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id TEXT PRIMARY KEY,                       -- contoh: 'pi-1', 'qf-1', 'sf-1', 'final', 'bronze'
    round TEXT NOT NULL,                      -- 'playin', 'quarter', 'semi', 'final'
    match_number INTEGER NOT NULL,            -- 1, 2, 3, etc.
    title TEXT NOT NULL,                      -- contoh: 'Play-In #1', 'Quarter Final #1'
    team1_id TEXT,                            -- ID peserta / ID tim (dari tournament_registrations)
    team1_name TEXT,                          -- Nama Tim 1
    team1_seed TEXT,                          -- Label slot asal (misal: 'SLOT #01', 'MENANG SF-1')
    team2_id TEXT,                            -- ID peserta / ID tim
    team2_name TEXT,                          -- Nama Tim 2
    team2_seed TEXT,                          -- Label slot asal (misal: 'SLOT #02')
    score1 INTEGER DEFAULT 0,                 -- Skor Tim 1
    score2 INTEGER DEFAULT 0,                 -- Skor Tim 2
    winner_id TEXT,                           -- ID tim pemenang
    winner_name TEXT,                         -- Nama tim pemenang
    next_match_id TEXT,                       -- Match ID tujuan pemenang (contoh: 'final')
    next_match_slot INTEGER,                  -- Slot tujuan di match berikutnya (1 atau 2)
    loser_match_id TEXT,                      -- Match ID tujuan tim kalah (contoh: 'bronze' untuk Semi Final)
    loser_match_slot INTEGER,                 -- Slot tujuan di match perebutan juara 3 (1 atau 2)
    status TEXT DEFAULT 'MENUNGGU',           -- 'MENUNGGU', 'MATCH READY', 'BERLANGSUNG', 'SELESAI'
    custom_notes TEXT,                        -- Catatan wasit / info tambahan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Pastikan kolom baru untuk Juara 3 (Bronze Match) terpasang jika tabel sudah ada sebelumnya
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS loser_match_id TEXT;
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS loser_match_slot INTEGER;

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- 4. Setup Policy Keamanan RLS (Drop dulu jika sudah ada agar tidak error saat re-run)
DROP POLICY IF EXISTS "Public read access for tournament_matches" ON public.tournament_matches;
CREATE POLICY "Public read access for tournament_matches"
ON public.tournament_matches
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public insert access for tournament_matches" ON public.tournament_matches;
CREATE POLICY "Public insert access for tournament_matches"
ON public.tournament_matches
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public update access for tournament_matches" ON public.tournament_matches;
CREATE POLICY "Public update access for tournament_matches"
ON public.tournament_matches
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 5. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_matches_round ON public.tournament_matches(round);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.tournament_matches(status);

-- 6. Realtime Enable (Untuk update live antar layar penonton & admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
  END IF;
END $$;

