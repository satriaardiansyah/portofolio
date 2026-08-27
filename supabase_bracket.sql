-- ============================================================================
-- SQL SCHEMA MIGRATION: TOURNAMENT BRACKET & MATCHES (10 TEAMS)
-- Non-destructive migration: Hanya membuat tabel baru jika belum ada.
-- ============================================================================

-- 1. Buat Tabel `tournament_matches`
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id TEXT PRIMARY KEY,                       -- contoh: 'pi-1', 'pi-2', 'qf-1', 'qf-2', 'qf-3', 'qf-4', 'sf-1', 'sf-2', 'final'
    round TEXT NOT NULL,                      -- 'playin', 'quarter', 'semi', 'final'
    match_number INTEGER NOT NULL,            -- 1, 2, 3, etc.
    title TEXT NOT NULL,                      -- contoh: 'Play-In #1', 'Quarter Final #1'
    team1_id TEXT,                            -- ID peserta / ID tim (dari tournament_registrations)
    team1_name TEXT,                          -- Nama Tim 1 (misal: 'CYBER VIPERS' atau 'Slot #07')
    team1_seed TEXT,                          -- Label slot asal (misal: 'SLOT #07', 'MENANG PI-2')
    team2_id TEXT,                            -- ID peserta / ID tim
    team2_name TEXT,                          -- Nama Tim 2
    team2_seed TEXT,                          -- Label slot asal (misal: 'SLOT #10')
    score1 INTEGER DEFAULT 0,                 -- Skor Tim 1
    score2 INTEGER DEFAULT 0,                 -- Skor Tim 2
    winner_id TEXT,                           -- ID tim pemenang
    winner_name TEXT,                         -- Nama tim pemenang
    next_match_id TEXT,                       -- Match ID tujuan pemenang (contoh: 'qf-4')
    next_match_slot INTEGER,                  -- Slot tujuan di match berikutnya (1 atau 2)
    status TEXT DEFAULT 'MENUNGGU',           -- 'MENUNGGU', 'MATCH READY', 'BERLANGSUNG', 'SELESAI'
    custom_notes TEXT,                        -- Catatan wasit / info tambahan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Izinkan publik membaca data pertandingan (SELECT)
CREATE POLICY "Public read access for tournament_matches"
ON public.tournament_matches
FOR SELECT
USING (true);

-- 4. Policy: Izinkan anon key untuk insert data awal (INSERT)
CREATE POLICY "Public insert access for tournament_matches"
ON public.tournament_matches
FOR INSERT
WITH CHECK (true);

-- 5. Policy: Izinkan update skor dan bracket (UPDATE)
CREATE POLICY "Public update access for tournament_matches"
ON public.tournament_matches
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_matches_round ON public.tournament_matches(round);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.tournament_matches(status);

-- 7. Realtime Enable (Opsional tapi direkomendasikan untuk Live Tournament)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
