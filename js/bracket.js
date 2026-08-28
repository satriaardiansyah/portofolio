/**
 * TOURNAMENT BRACKET MODULE - YABIDEV
 * Mengelola sistem Single Elimination 10 Tim, sinkronisasi Supabase & LocalStorage,
 * kalkulasi pemenang otomatis/manual, propagasi babak berikutnya, SVG connecting lines,
 * serta mode admin edit skor.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- HELPER ESCAPE HTML ---
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- KONFIGURASI SUPABASE & DATABASE ---
  const SUPABASE_PROJECT_URL = 'https://jvhdbzxhmhqmsgjvsylp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_WQnVqx7Oai2ScoW18pZxow_ThBNl9-4';
  const PARTICIPANTS_TABLE = 'tournament_registrations';
  const MATCHES_TABLE = 'tournament_matches';
  const STORAGE_MATCHES_KEY = 'yabidev_bracket_matches_v1';
  const STORAGE_PARTICIPANTS_KEY = 'yabidev_tournament_data_v1';

  let supabaseClient = null;
  let isMatchesTableAvailable = true; // Akan diset false jika table belum dibuat di Supabase

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);
      console.log('⚡ Supabase Client initialized for Bracket');
    } catch (err) {
      console.warn('⚠️ Supabase init error:', err);
    }
  }

  // --- STATE MANAGEMENT ---
  let participantsList = []; // 10 Slots
  let matchesState = {};     // Map by match ID: 'pi-1', 'pi-2', 'qf-1', ..., 'final'
  let currentZoom = 1;
  let activeEditingMatchId = null;

  // Struktur Default 10 Slot Bracket (Single Elimination)
  const INITIAL_MATCH_DEFINITIONS = [
    // 1. Play-In / Babak Pendahuluan
    {
      id: 'pi-1',
      round: 'playin',
      match_number: 1,
      title: 'Play-In #1',
      team1_seed: 'SLOT #07',
      team2_seed: 'SLOT #10',
      slot1_index: 6, // 0-based index slot 7
      slot2_index: 9, // 0-based index slot 10
      next_match_id: 'qf-4',
      next_match_slot: 2,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },
    {
      id: 'pi-2',
      round: 'playin',
      match_number: 2,
      title: 'Play-In #2',
      team1_seed: 'SLOT #08',
      team2_seed: 'SLOT #09',
      slot1_index: 7, // slot 8
      slot2_index: 8, // slot 9
      next_match_id: 'qf-1',
      next_match_slot: 2,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },

    // 2. Quarter Finals (8 Tim)
    {
      id: 'qf-1',
      round: 'quarter',
      match_number: 1,
      title: 'Quarter Final #1',
      team1_seed: 'SLOT #01',
      team2_seed: 'MENANG PI-2',
      slot1_index: 0, // slot 1
      slot2_index: null, // Dari Play-In 2
      next_match_id: 'sf-1',
      next_match_slot: 1,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },
    {
      id: 'qf-2',
      round: 'quarter',
      match_number: 2,
      title: 'Quarter Final #2',
      team1_seed: 'SLOT #04',
      team2_seed: 'SLOT #05',
      slot1_index: 3, // slot 4
      slot2_index: 4, // slot 5
      next_match_id: 'sf-1',
      next_match_slot: 2,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },
    {
      id: 'qf-3',
      round: 'quarter',
      match_number: 3,
      title: 'Quarter Final #3',
      team1_seed: 'SLOT #03',
      team2_seed: 'SLOT #06',
      slot1_index: 2, // slot 3
      slot2_index: 5, // slot 6
      next_match_id: 'sf-2',
      next_match_slot: 1,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },
    {
      id: 'qf-4',
      round: 'quarter',
      match_number: 4,
      title: 'Quarter Final #4',
      team1_seed: 'SLOT #02',
      team2_seed: 'MENANG PI-1',
      slot1_index: 1, // slot 2
      slot2_index: null, // Dari Play-In 1
      next_match_id: 'sf-2',
      next_match_slot: 2,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },

    // 3. Semi Finals (4 Tim)
    {
      id: 'sf-1',
      round: 'semi',
      match_number: 1,
      title: 'Semi Final #1',
      team1_seed: 'MENANG QF-1',
      team2_seed: 'MENANG QF-2',
      slot1_index: null,
      slot2_index: null,
      next_match_id: 'final',
      next_match_slot: 1,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },
    {
      id: 'sf-2',
      round: 'semi',
      match_number: 2,
      title: 'Semi Final #2',
      team1_seed: 'MENANG QF-3',
      team2_seed: 'MENANG QF-4',
      slot1_index: null,
      slot2_index: null,
      next_match_id: 'final',
      next_match_slot: 2,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    },

    // 4. Grand Final
    {
      id: 'final',
      round: 'final',
      match_number: 1,
      title: 'Grand Final 🏆',
      team1_seed: 'MENANG SF-1',
      team2_seed: 'MENANG SF-2',
      slot1_index: null,
      slot2_index: null,
      next_match_id: 'champion',
      next_match_slot: 1,
      score1: 0,
      score2: 0,
      winner_id: null,
      winner_name: null,
      status: 'MENUNGGU'
    }
  ];

  // Mock Peserta jika Supabase belum ada data
  const defaultFallbackParticipants = [
    { id: 'p-1', slot: '#01', teamName: 'CYBER VIPERS', playerNames: 'Satria (C), Vanya' },
    { id: 'p-2', slot: '#02', teamName: 'NEON PROTOCOL', playerNames: 'Farhan (C), Brian' },
    { id: 'p-3', slot: '#03', teamName: 'SHADOW APEX', playerNames: 'Aldo (C), Cindy' },
    { id: 'p-4', slot: '#04', teamName: 'ROYAL TITANS', playerNames: 'Rian (C), Sheila' },
    { id: 'p-5', slot: '#05', teamName: 'PHANTOM SQUAD', playerNames: 'Bima (C), Aurel' },
    { id: 'p-6', slot: '#06', teamName: 'DRAGON VOID', playerNames: 'Kevin (C), Nabila' },
    { id: 'p-7', slot: '#07', teamName: 'AURORA GLITCH', playerNames: 'Daffa (C), Putri' },
    { id: 'p-8', slot: '#08', teamName: 'MYSTIC FALCON', playerNames: 'Zaki (C), Tari' },
    { id: 'p-9', slot: '#09', teamName: 'VALKYRIE X', playerNames: 'Gavin (C), Jessica' },
    { id: 'p-10', slot: '#10', teamName: 'ZERO GRAVITY', playerNames: 'Rangga (C), Tiara' }
  ];

  // --- DATA ACCESS LAYER ---

  // 1. Fetch Peserta dari Supabase / LocalStorage
  async function loadParticipants() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from(PARTICIPANTS_TABLE)
          .select('*')
          .order('created_at', { ascending: true }); // Terdaftar lebih awal dapat slot lebih kecil (#1, #2, dst.)

        if (!error && data && data.length > 0) {
          participantsList = data.map((item, idx) => ({
            id: String(item.id),
            slot: `#${String(idx + 1).padStart(2, '0')}`,
            teamName: item.team_name || `Tim Slot #${idx + 1}`,
            playerNames: item.player_names || '-',
            gameId: item.game_id || '-',
            discordTag: item.discord_tag || '-',
            status: item.status || 'Terverifikasi'
          }));
          console.log(`⚡ Loaded ${participantsList.length} participants from Supabase`);
          return;
        } else if (error) {
          console.info('Supabase participants query note:', error.message);
        }
      } catch (err) {
        console.warn('Gagal membaca peserta dari Supabase:', err);
      }
    }

    // Fallback LocalStorage peserta jika ada
    try {
      const localP = localStorage.getItem(STORAGE_PARTICIPANTS_KEY);
      if (localP) {
        const parsed = JSON.parse(localP);
        if (Array.isArray(parsed) && parsed.length > 0) {
          participantsList = parsed.slice().reverse().map((item, idx) => ({
            id: String(item.id),
            slot: `#${String(idx + 1).padStart(2, '0')}`,
            teamName: item.teamName || item.team_name || `Tim Slot #${idx + 1}`,
            playerNames: item.playerNames || item.player_names || '-',
            gameId: item.gameId || item.game_id || '-',
            discordTag: item.discordTag || item.discord_tag || '-',
            status: item.status || 'Terverifikasi'
          }));
          return;
        }
      }
    } catch (e) {}

    // Fallback Mock data
    participantsList = defaultFallbackParticipants;
  }

  // 2. Fetch State Pertandingan dari Supabase / LocalStorage
  async function loadBracketMatches() {
    let loadedFromDb = false;

    if (supabaseClient && isMatchesTableAvailable) {
      try {
        const { data, error } = await supabaseClient
          .from(MATCHES_TABLE)
          .select('*');

        if (!error && data && data.length > 0) {
          matchesState = {};
          data.forEach((m) => {
            matchesState[m.id] = {
              ...m,
              score1: Number(m.score1 || 0),
              score2: Number(m.score2 || 0)
            };
          });
          loadedFromDb = true;
          console.log('⚡ Loaded tournament matches from Supabase');
        } else if (error) {
          if (error.message && error.message.includes('Could not find the table')) {
            isMatchesTableAvailable = false;
            console.info('ℹ️ Catatan: Tabel public.tournament_matches belum dibuat di Supabase. Sistem menggunakan LocalStorage.');
          }
        }
      } catch (err) {
        console.warn('Supabase matches query error:', err);
      }
    }

    if (!loadedFromDb) {
      // Coba LocalStorage
      try {
        const localData = localStorage.getItem(STORAGE_MATCHES_KEY);
        if (localData) {
          matchesState = JSON.parse(localData);
          console.log('⚡ Loaded tournament matches from LocalStorage');
          return;
        }
      } catch (e) {}

      // Jika belum ada data sama sekali, inisialisasi dari default definisi
      initializeDefaultMatches();
    }
  }

  // Inisialisasi default matches dan pasangkan tim awal
  function initializeDefaultMatches() {
    matchesState = {};
    INITIAL_MATCH_DEFINITIONS.forEach((def) => {
      let team1_name = null;
      let team1_id = null;
      let team2_name = null;
      let team2_id = null;

      // Pasang Tim 1 jika punya slot_index awal
      if (def.slot1_index !== null && def.slot1_index !== undefined) {
        const p1 = participantsList[def.slot1_index];
        if (p1) {
          team1_name = p1.teamName;
          team1_id = p1.id;
        } else {
          team1_name = `Menunggu Peserta (${def.team1_seed})`;
        }
      }

      // Pasang Tim 2 jika punya slot_index awal
      if (def.slot2_index !== null && def.slot2_index !== undefined) {
        const p2 = participantsList[def.slot2_index];
        if (p2) {
          team2_name = p2.teamName;
          team2_id = p2.id;
        } else {
          team2_name = `Menunggu Peserta (${def.team2_seed})`;
        }
      }

      // Status awal
      let status = 'MENUNGGU';
      if (team1_id && team2_id) {
        status = 'MATCH READY';
      }

      matchesState[def.id] = {
        ...def,
        team1_name: team1_name || `[${def.team1_seed}]`,
        team1_id: team1_id,
        team2_name: team2_name || `[${def.team2_seed}]`,
        team2_id: team2_id,
        score1: 0,
        score2: 0,
        winner_id: null,
        winner_name: null,
        status: status
      };
    });

    saveMatchesState();
  }

  // 3. Simpan State Pertandingan ke Supabase & LocalStorage
  async function saveMatchesState() {
    // 1. Simpan ke LocalStorage segera
    try {
      localStorage.setItem(STORAGE_MATCHES_KEY, JSON.stringify(matchesState));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. Simpan ke Supabase jika tersedia dan tabel sudah dibuat
    if (supabaseClient && isMatchesTableAvailable) {
      try {
        const rows = Object.values(matchesState).map((m) => ({
          id: m.id,
          round: m.round,
          match_number: m.match_number,
          title: m.title,
          team1_id: m.team1_id || null,
          team1_name: m.team1_name || null,
          team1_seed: m.team1_seed || null,
          team2_id: m.team2_id || null,
          team2_name: m.team2_name || null,
          team2_seed: m.team2_seed || null,
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          winner_id: m.winner_id || null,
          winner_name: m.winner_name || null,
          next_match_id: m.next_match_id || null,
          next_match_slot: m.next_match_slot || null,
          status: m.status || 'MENUNGGU',
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabaseClient
          .from(MATCHES_TABLE)
          .upsert(rows, { onConflict: 'id' });

        if (error) {
          if (error.message && error.message.includes('Could not find the table')) {
            isMatchesTableAvailable = false;
          }
          console.info('Catatan sync Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Gagal sync ke Supabase:', err);
      }
    }
  }

  // --- LOGIKA PROPAGASI PEMENANG (NEXT ROUND) ---
  function resolveMatchWinner(matchId, winnerType, customWinnerName = null, customWinnerId = null) {
    const match = matchesState[matchId];
    if (!match) return;

    let winId = null;
    let winName = null;

    if (winnerType === 'team1') {
      winId = match.team1_id || 'team1';
      winName = match.team1_name;
    } else if (winnerType === 'team2') {
      winId = match.team2_id || 'team2';
      winName = match.team2_name;
    } else if (winnerType === 'custom') {
      winId = customWinnerId || 'custom';
      winName = customWinnerName;
    } else if (winnerType === 'none') {
      winId = null;
      winName = null;
    }

    match.winner_id = winId;
    match.winner_name = winName;

    if (winName) {
      match.status = 'SELESAI';
    } else {
      match.status = (match.team1_id && match.team2_id) ? 'MATCH READY' : 'MENUNGGU';
    }

    // Propagasi ke Match Berikutnya
    if (match.next_match_id && match.next_match_id !== 'champion') {
      const nextMatch = matchesState[match.next_match_id];
      if (nextMatch) {
        if (match.next_match_slot === 1) {
          nextMatch.team1_name = winName || `[${nextMatch.team1_seed}]`;
          nextMatch.team1_id = winId;
        } else if (match.next_match_slot === 2) {
          nextMatch.team2_name = winName || `[${nextMatch.team2_seed}]`;
          nextMatch.team2_id = winId;
        }

        // Update status match tujuan
        if (nextMatch.team1_id && nextMatch.team2_id && nextMatch.status === 'MENUNGGU') {
          nextMatch.status = 'MATCH READY';
        } else if ((!nextMatch.team1_id || !nextMatch.team2_id) && nextMatch.status !== 'SELESAI') {
          nextMatch.status = 'MENUNGGU';
        }
      }
    }

    saveMatchesState();
    renderBracket();
  }

  // --- RENDER BRACKET & UI ---

  const stagesContainers = {
    playin: document.getElementById('stagePlayinMatches'),
    quarter: document.getElementById('stageQuarterMatches'),
    semi: document.getElementById('stageSemiMatches'),
    final: document.getElementById('stageFinalMatches'),
    champion: document.getElementById('stageChampionShowcase')
  };

  function renderBracket() {
    // 1. Render Play-In Matches
    if (stagesContainers.playin) {
      stagesContainers.playin.innerHTML = ['pi-1', 'pi-2']
        .map((id) => renderMatchCardHtml(matchesState[id]))
        .join('');
    }

    // 2. Render Quarter Finals Matches
    if (stagesContainers.quarter) {
      stagesContainers.quarter.innerHTML = ['qf-1', 'qf-2', 'qf-3', 'qf-4']
        .map((id) => renderMatchCardHtml(matchesState[id]))
        .join('');
    }

    // 3. Render Semi Finals Matches
    if (stagesContainers.semi) {
      stagesContainers.semi.innerHTML = ['sf-1', 'sf-2']
        .map((id) => renderMatchCardHtml(matchesState[id]))
        .join('');
    }

    // 4. Render Grand Final Match
    if (stagesContainers.final) {
      stagesContainers.final.innerHTML = renderMatchCardHtml(matchesState['final'], true);
    }

    // 5. Render Champion Podium
    renderChampionPodium();

    // 6. Update Top Header Stats
    updateHeaderStats();

    // 7. Attach Click Events to Match Cards
    attachCardEventListeners();

    // 8. Re-draw Connecting Lines
    requestAnimationFrame(() => {
      drawConnectorLines();
    });
  }

  function renderMatchCardHtml(match, isFinal = false) {
    if (!match) return '';

    const isLive = match.status === 'BERLANGSUNG';
    const isFinished = match.status === 'SELESAI';
    const team1IsWinner = match.winner_name && match.winner_name === match.team1_name;
    const team2IsWinner = match.winner_name && match.winner_name === match.team2_name;

    const t1Placeholder = !match.team1_id && (!match.team1_name || match.team1_name.startsWith('[') || match.team1_name.startsWith('Menunggu'));
    const t2Placeholder = !match.team2_id && (!match.team2_name || match.team2_name.startsWith('[') || match.team2_name.startsWith('Menunggu'));

    return `
      <div class="match-card ${isLive ? 'is-live' : ''} ${isFinished ? 'is-finished' : ''} ${isFinal ? 'is-grand-final' : ''}" 
           id="card-${match.id}" 
           data-match-id="${match.id}">
        
        <div class="match-top-row">
          <span class="match-id-badge">${escapeHtml(match.title)}</span>
          <span class="match-status-pill status-${(match.status || 'MENUNGGU').replace(/\s+/g, '-')}">${escapeHtml(match.status || 'MENUNGGU')}</span>
        </div>

        <div class="match-teams-list">
          <!-- Tim 1 -->
          <div class="team-slot-row ${team1IsWinner ? 'winner' : ''} ${team2IsWinner ? 'loser' : ''} ${t1Placeholder ? 'empty-slot' : ''}">
            <div class="team-meta-left">
              <span class="team-seed-pill ${team1IsWinner ? 'winner-seed' : ''}">${escapeHtml(match.team1_seed || '#')}</span>
              <span class="team-name-text ${t1Placeholder ? 'placeholder' : ''}" title="${escapeHtml(match.team1_name || '')}">
                ${escapeHtml(match.team1_name || 'Menunggu Peserta')}
              </span>
            </div>
            <span class="team-score-badge ${team1IsWinner ? 'winner-score' : ''}">
              ${match.score1 !== undefined ? match.score1 : 0}
            </span>
          </div>

          <!-- Tim 2 -->
          <div class="team-slot-row ${team2IsWinner ? 'winner' : ''} ${team1IsWinner ? 'loser' : ''} ${t2Placeholder ? 'empty-slot' : ''}">
            <div class="team-meta-left">
              <span class="team-seed-pill ${team2IsWinner ? 'winner-seed' : ''}">${escapeHtml(match.team2_seed || '#')}</span>
              <span class="team-name-text ${t2Placeholder ? 'placeholder' : ''}" title="${escapeHtml(match.team2_name || '')}">
                ${escapeHtml(match.team2_name || 'Menunggu Peserta')}
              </span>
            </div>
            <span class="team-score-badge ${team2IsWinner ? 'winner-score' : ''}">
              ${match.score2 !== undefined ? match.score2 : 0}
            </span>
          </div>
        </div>

        <div class="match-card-foot">
          <span class="match-hint-foot">
            ${team1IsWinner ? `🏆 Pemenang: <b>${escapeHtml(match.team1_name)}</b>` : team2IsWinner ? `🏆 Pemenang: <b>${escapeHtml(match.team2_name)}</b>` : 'Klik untuk edit skor'}
          </span>
          <span class="quick-edit-hint">
            <span>⚙️</span> Edit Skor
          </span>
        </div>
      </div>
    `;
  }

  function renderChampionPodium() {
    if (!stagesContainers.champion) return;

    const finalMatch = matchesState['final'];
    const championName = finalMatch ? finalMatch.winner_name : null;

    let championRoster = 'Pemenang Grand Final akan dinobatkan sebagai Juara 1 Turnamen.';
    if (championName) {
      const matchedTeam = participantsList.find((p) => p.teamName === championName);
      if (matchedTeam && matchedTeam.playerNames) {
        championRoster = `Lineup: <b>${escapeHtml(matchedTeam.playerNames)}</b>`;
      } else {
        championRoster = 'Selamat kepada tim juara atas kemenangan spektakuler!';
      }
    }

    stagesContainers.champion.innerHTML = `
      <div class="champion-showcase-card" id="championPodiumCard" role="button" tabindex="0" title="Klik untuk Merayakan Kemenangan Juara!">
        <div class="trophy-glow-wrap">
          <div class="trophy-glow-ring"></div>
          <div class="trophy-icon">🏆</div>
        </div>
        <span class="champion-tag"><span>👑</span> JUARA TOURNAMENT</span>
        <h2 class="champion-team-title">
          ${championName ? escapeHtml(championName) : '<span style="color:var(--muted-2); font-size:18px;">Belum Ditentukan</span>'}
        </h2>
        <p class="champion-members">
          ${championRoster}
        </p>
        <div class="champion-prize-pill">
          <span>🎁</span> Hadiah: Rp.150.000 + 1.000.000 Koin
        </div>
        <div class="champion-celebrate-hint">
          <span>🎉</span> Rayakan Kemenangan Juara!
        </div>
      </div>
    `;

    const podiumCard = document.getElementById('championPodiumCard');
    if (podiumCard) {
      podiumCard.addEventListener('click', () => {
        openChampionCelebration();
      });
      podiumCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openChampionCelebration();
        }
      });
    }
  }

  function updateHeaderStats() {
    const totalMatches = Object.keys(matchesState).length || 9;
    const completedMatches = Object.values(matchesState).filter((m) => m.status === 'SELESAI').length;
    const liveMatches = Object.values(matchesState).filter((m) => m.status === 'BERLANGSUNG').length;

    const bStatCompleted = document.getElementById('bStatCompleted');
    const bStatLive = document.getElementById('bStatLive');
    const bStatRegistered = document.getElementById('bStatRegistered');

    if (bStatCompleted) bStatCompleted.textContent = `${completedMatches} / ${totalMatches} Match`;
    if (bStatLive) bStatLive.textContent = `${liveMatches} Pertandingan`;
    if (bStatRegistered) bStatRegistered.textContent = `${participantsList.length} / 10 Tim`;
  }

  // --- SVG CONNECTING LINES RENDERING ---
  function drawConnectorLines() {
    const svg = document.getElementById('bracketSvg');
    const canvas = document.getElementById('bracketCanvas');
    if (!svg || !canvas) return;

    // Bersihkan garis lama
    svg.innerHTML = `
      <defs>
        <linearGradient id="grad-connector-active" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#45e8d4" />
          <stop offset="50%" stop-color="#9b6bff" />
          <stop offset="100%" stop-color="#ff5c8a" />
        </linearGradient>
      </defs>
    `;

    const canvasRect = canvas.getBoundingClientRect();
    const scale = currentZoom || 1;

    // Daftar koneksi antar kartu
    const connections = [
      // Play-In -> Quarter
      { from: 'pi-1', to: 'qf-4', fromWinner: matchesState['pi-1']?.winner_name, targetSlot: 2 },
      { from: 'pi-2', to: 'qf-1', fromWinner: matchesState['pi-2']?.winner_name, targetSlot: 2 },

      // Quarter -> Semi
      { from: 'qf-1', to: 'sf-1', fromWinner: matchesState['qf-1']?.winner_name, targetSlot: 1 },
      { from: 'qf-2', to: 'sf-1', fromWinner: matchesState['qf-2']?.winner_name, targetSlot: 2 },
      { from: 'qf-3', to: 'sf-2', fromWinner: matchesState['qf-3']?.winner_name, targetSlot: 1 },
      { from: 'qf-4', to: 'sf-2', fromWinner: matchesState['qf-4']?.winner_name, targetSlot: 2 },

      // Semi -> Final
      { from: 'sf-1', to: 'final', fromWinner: matchesState['sf-1']?.winner_name, targetSlot: 1 },
      { from: 'sf-2', to: 'final', fromWinner: matchesState['sf-2']?.winner_name, targetSlot: 2 }
    ];

    connections.forEach((conn) => {
      const fromEl = document.getElementById(`card-${conn.from}`);
      const toEl = document.getElementById(`card-${conn.to}`);

      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // Titik keluar (kanan tengah dari kartu asal)
      const startX = (fromRect.right - canvasRect.left) / scale;
      const startY = (fromRect.top + fromRect.height / 2 - canvasRect.top) / scale;

      // Titik masuk (kiri kartu tujuan, disesuaikan dengan slot 1 atau 2)
      const endX = (toRect.left - canvasRect.left) / scale;
      const targetOffsetY = conn.targetSlot === 1 ? toRect.height * 0.38 : toRect.height * 0.62;
      const endY = (toRect.top + targetOffsetY - canvasRect.top) / scale;

      // Smooth Bezier Curve
      const deltaX = Math.abs(endX - startX) * 0.55;
      const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);

      if (conn.fromWinner) {
        path.setAttribute('class', 'connector-path active winner-path');
      } else {
        path.setAttribute('class', 'connector-path');
      }

      svg.appendChild(path);
    });

    // Garis dari Final ke Podium Champion jika pemenang sudah ada
    const finalEl = document.getElementById('card-final');
    const champEl = stagesContainers.champion?.querySelector('.champion-showcase-card');
    if (finalEl && champEl) {
      const fRect = finalEl.getBoundingClientRect();
      const cRect = champEl.getBoundingClientRect();

      const startX = (fRect.right - canvasRect.left) / scale;
      const startY = (fRect.top + fRect.height / 2 - canvasRect.top) / scale;
      const endX = (cRect.left - canvasRect.left) / scale;
      const endY = (cRect.top + cRect.height / 2 - canvasRect.top) / scale;

      const deltaX = Math.abs(endX - startX) * 0.5;
      const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);

      const hasChampion = Boolean(matchesState['final']?.winner_name);
      path.setAttribute('class', hasChampion ? 'connector-path active winner-path' : 'connector-path');
      svg.appendChild(path);
    }
  }

  // --- MODAL EDIT SKOR & ADMIN ---
  const editModal = document.getElementById('bracketEditModal');
  const modalCloseBtn = document.getElementById('modalEditClose');
  const modalMatchTitle = document.getElementById('modalMatchTitle');
  const modalMatchSubtitle = document.getElementById('modalMatchSubtitle');

  const editTeam1Select = document.getElementById('editTeam1Select');
  const editTeam2Select = document.getElementById('editTeam2Select');
  const editScore1Input = document.getElementById('editScore1');
  const editScore2Input = document.getElementById('editScore2');
  const score1Minus = document.getElementById('score1Minus');
  const score1Plus = document.getElementById('score1Plus');
  const score2Minus = document.getElementById('score2Minus');
  const score2Plus = document.getElementById('score2Plus');

  const btnWinTeam1 = document.getElementById('btnWinTeam1');
  const btnWinTeam2 = document.getElementById('btnWinTeam2');
  const btnWinAuto = document.getElementById('btnWinAuto');
  const btnWinNone = document.getElementById('btnWinNone');
  const editMatchStatus = document.getElementById('editMatchStatus');
  const btnSaveMatchEdit = document.getElementById('btnSaveMatchEdit');

  let modalSelectedWinnerType = 'auto'; // 'auto', 'team1', 'team2', 'none'

  function openEditModal(matchId) {
    activeEditingMatchId = matchId;
    const match = matchesState[matchId];
    if (!match) return;

    if (modalMatchTitle) modalMatchTitle.textContent = `Edit Skor: ${match.title}`;
    if (modalMatchSubtitle) modalMatchSubtitle.textContent = `Babak: ${(match.round || '').toUpperCase()} • Kelola skor & pemenang`;

    // Isi Dropdown Tim
    populateTeamDropdown(editTeam1Select, match.team1_name);
    populateTeamDropdown(editTeam2Select, match.team2_name);

    // Isi Skor
    if (editScore1Input) editScore1Input.value = match.score1 || 0;
    if (editScore2Input) editScore2Input.value = match.score2 || 0;

    // Isi Status
    if (editMatchStatus) editMatchStatus.value = match.status || 'MENUNGGU';

    // Set Tombol Pemenang
    if (btnWinTeam1) btnWinTeam1.textContent = `🏆 ${match.team1_name || 'Tim 1'}`;
    if (btnWinTeam2) btnWinTeam2.textContent = `🏆 ${match.team2_name || 'Tim 2'}`;

    if (match.winner_name === match.team1_name && match.winner_name) {
      setWinnerSelection('team1');
    } else if (match.winner_name === match.team2_name && match.winner_name) {
      setWinnerSelection('team2');
    } else {
      setWinnerSelection('auto');
    }

    if (editModal) editModal.classList.add('open');
  }

  function populateTeamDropdown(selectEl, currentTeamName) {
    if (!selectEl) return;
    selectEl.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Pilih Tim / Peserta --';
    selectEl.appendChild(defaultOpt);

    participantsList.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.teamName;
      opt.textContent = `${p.slot} - ${p.teamName}`;
      if (p.teamName === currentTeamName) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });

    // Jika custom atau dari pemenang match sebelumnya
    if (currentTeamName && !participantsList.some((p) => p.teamName === currentTeamName)) {
      const customOpt = document.createElement('option');
      customOpt.value = currentTeamName;
      customOpt.textContent = currentTeamName;
      customOpt.selected = true;
      selectEl.appendChild(customOpt);
    }
  }

  function setWinnerSelection(type) {
    modalSelectedWinnerType = type;
    [btnWinTeam1, btnWinTeam2, btnWinAuto, btnWinNone].forEach((b) => {
      if (b) b.classList.remove('selected');
    });

    if (type === 'team1' && btnWinTeam1) btnWinTeam1.classList.add('selected');
    if (type === 'team2' && btnWinTeam2) btnWinTeam2.classList.add('selected');
    if (type === 'auto' && btnWinAuto) btnWinAuto.classList.add('selected');
    if (type === 'none' && btnWinNone) btnWinNone.classList.add('selected');
  }

  function closeEditModal() {
    if (editModal) editModal.classList.remove('open');
    activeEditingMatchId = null;
  }

  // Stepper handlers
  if (score1Plus) score1Plus.addEventListener('click', () => { if (editScore1Input) editScore1Input.value = Math.max(0, parseInt(editScore1Input.value || 0) + 1); });
  if (score1Minus) score1Minus.addEventListener('click', () => { if (editScore1Input) editScore1Input.value = Math.max(0, parseInt(editScore1Input.value || 0) - 1); });
  if (score2Plus) score2Plus.addEventListener('click', () => { if (editScore2Input) editScore2Input.value = Math.max(0, parseInt(editScore2Input.value || 0) + 1); });
  if (score2Minus) score2Minus.addEventListener('click', () => { if (editScore2Input) editScore2Input.value = Math.max(0, parseInt(editScore2Input.value || 0) - 1); });

  if (btnWinTeam1) btnWinTeam1.addEventListener('click', () => setWinnerSelection('team1'));
  if (btnWinTeam2) btnWinTeam2.addEventListener('click', () => setWinnerSelection('team2'));
  if (btnWinAuto) btnWinAuto.addEventListener('click', () => setWinnerSelection('auto'));
  if (btnWinNone) btnWinNone.addEventListener('click', () => setWinnerSelection('none'));

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeEditModal);
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditModal();
    });
  }

  // Simpan Perubahan Modal
  if (btnSaveMatchEdit) {
    btnSaveMatchEdit.addEventListener('click', async () => {
      if (!activeEditingMatchId) return;
      const match = matchesState[activeEditingMatchId];
      if (!match) return;

      const score1 = Math.max(0, parseInt(editScore1Input ? editScore1Input.value : 0) || 0);
      const score2 = Math.max(0, parseInt(editScore2Input ? editScore2Input.value : 0) || 0);
      const status = editMatchStatus ? editMatchStatus.value : 'SELESAI';

      // Tim yang dipilih
      const team1Name = editTeam1Select ? editTeam1Select.value : match.team1_name;
      const team2Name = editTeam2Select ? editTeam2Select.value : match.team2_name;

      match.team1_name = team1Name || match.team1_name;
      match.team2_name = team2Name || match.team2_name;
      match.score1 = score1;
      match.score2 = score2;
      match.status = status;

      // Update ID jika ditemukan di daftar peserta
      const p1 = participantsList.find((p) => p.teamName === match.team1_name);
      if (p1) match.team1_id = p1.id;
      const p2 = participantsList.find((p) => p.teamName === match.team2_name);
      if (p2) match.team2_id = p2.id;

      // Evaluasi pemenang
      if (modalSelectedWinnerType === 'auto') {
        if (score1 > score2) {
          resolveMatchWinner(activeEditingMatchId, 'team1');
        } else if (score2 > score1) {
          resolveMatchWinner(activeEditingMatchId, 'team2');
        } else {
          // Imbang => belum ada pemenang otomatis
          resolveMatchWinner(activeEditingMatchId, 'none');
        }
      } else {
        resolveMatchWinner(activeEditingMatchId, modalSelectedWinnerType);
      }

      closeEditModal();
      showToast(`✅ Skor pertandingan ${match.title} berhasil diperbarui!`);

      // Auto-trigger celebration if Grand Final winner is determined
      if (activeEditingMatchId === 'final' && matchesState['final']?.winner_name) {
        setTimeout(() => {
          openChampionCelebration(true);
        }, 500);
      }
    });
  }

  function attachCardEventListeners() {
    const cards = document.querySelectorAll('.match-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const matchId = card.dataset.matchId;
        if (matchId) openEditModal(matchId);
      });
    });
  }

  // ==========================================================================
  // EPIC CHAMPION VICTORY CELEBRATION ENGINE (WEB AUDIO & CANVAS PARTICLES)
  // ==========================================================================

  // --- 1. Web Audio API Sound Synthesizer (Fanfare & Fireworks) ---
  class CelebrationAudioSynthesizer {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      return !this.isMuted;
    }

    playFanfare() {
      if (this.isMuted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Triumphant Fanfare Arpeggio Notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50), E6 (1318.51)
      const fanfareSequence = [
        { freq: 523.25, time: 0.00, dur: 0.15, gain: 0.25, type: 'triangle' },
        { freq: 659.25, time: 0.15, dur: 0.15, gain: 0.25, type: 'triangle' },
        { freq: 783.99, time: 0.30, dur: 0.20, gain: 0.28, type: 'triangle' },
        // Mid-phrase chord strike
        { freq: 1046.50, time: 0.52, dur: 0.65, gain: 0.32, type: 'sawtooth' },
        { freq: 783.99,  time: 0.52, dur: 0.65, gain: 0.22, type: 'triangle' },
        { freq: 523.25,  time: 0.52, dur: 0.65, gain: 0.25, type: 'triangle' },
        // Quick pickup notes
        { freq: 880.00,  time: 1.15, dur: 0.12, gain: 0.22, type: 'triangle' },
        { freq: 987.77,  time: 1.27, dur: 0.14, gain: 0.24, type: 'triangle' },
        // Grand Final Sustained Victory Chord (Tutti Brass)
        { freq: 1046.50, time: 1.42, dur: 1.40, gain: 0.35, type: 'sawtooth' },
        { freq: 1318.51, time: 1.42, dur: 1.40, gain: 0.28, type: 'sine' },
        { freq: 783.99,  time: 1.42, dur: 1.40, gain: 0.26, type: 'triangle' },
        { freq: 523.25,  time: 1.42, dur: 1.40, gain: 0.30, type: 'triangle' },
        { freq: 261.63,  time: 1.42, dur: 1.40, gain: 0.35, type: 'triangle' },
      ];

      fanfareSequence.forEach((n) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = n.type || 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gainNode.gain.setValueAtTime(0.0001, now + n.time);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, now + n.time + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      });

      // Shimmering Victory Chimes (Bell Sparkles)
      const chimes = [1318.51, 1567.98, 1760.00, 2093.00, 2637.02, 3135.96, 3520.00];
      chimes.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + 0.7 + idx * 0.09;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + 0.55);
      });
    }

    playFirework() {
      if (this.isMuted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Sub-bass thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.32);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);

      // White Noise Crackle Burst
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.14, now + 0.04);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      noise.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now + 0.04);
    }
  }

  const celebrationAudio = new CelebrationAudioSynthesizer();

  // --- 2. High Performance Canvas Particle & Fireworks Physics Engine ---
  class CelebrationParticleEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.confetti = [];
      this.fireworks = [];
      this.embers = [];
      this.isRunning = false;
      this.animationFrameId = null;
      this.width = 0;
      this.height = 0;
      this.colors = [
        '#ffd700', '#ffb84d', '#ff5c8a', '#45e8d4',
        '#9b6bff', '#ffffff', '#ff94b8', '#ffe180'
      ];
      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
    }

    resize() {
      if (!this.canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
    }

    start() {
      this.resize();
      this.isRunning = true;
      this.confetti = [];
      this.fireworks = [];
      this.embers = [];

      // Generate initial lavish confetti blizzard
      for (let i = 0; i < 150; i++) {
        this.confetti.push(this.createConfettiPiece(true));
      }

      // Generate ambient floating embers
      for (let i = 0; i < 40; i++) {
        this.embers.push(this.createEmberPiece(true));
      }

      // Launch 3 initial fireworks
      this.launchTripleFireworks();

      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.loop();
    }

    stop() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
      this.confetti = [];
      this.fireworks = [];
      this.embers = [];
    }

    createConfettiPiece(isInitial = false) {
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      return {
        x: Math.random() * this.width,
        y: isInitial ? Math.random() * this.height : -20 - Math.random() * 50,
        size: Math.random() * 9 + 6,
        aspectRatio: Math.random() * 0.6 + 0.4,
        color: color,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2.5 + 2,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        speedRotX: (Math.random() - 0.5) * 0.1,
        speedRotY: (Math.random() - 0.5) * 0.12,
        speedRotZ: (Math.random() - 0.5) * 0.05,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.random() * 0.06 + 0.02
      };
    }

    createEmberPiece(isInitial = false) {
      return {
        x: Math.random() * this.width,
        y: isInitial ? Math.random() * this.height : this.height + Math.random() * 20,
        radius: Math.random() * 2.5 + 1,
        color: Math.random() > 0.4 ? '#ffd700' : '#ff5c8a',
        vy: -(Math.random() * 1.5 + 0.8),
        vx: (Math.random() - 0.5) * 0.8,
        alpha: Math.random() * 0.6 + 0.3,
        pulseSpeed: Math.random() * 0.04 + 0.02,
        phase: Math.random() * Math.PI * 2
      };
    }

    launchFirework(x, y, palette = null) {
      const colors = palette || this.colors;
      const mainColor = colors[Math.floor(Math.random() * colors.length)];
      const numParticles = Math.floor(Math.random() * 30) + 60;
      const particles = [];

      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 2;
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.25 ? mainColor : '#ffffff',
          radius: Math.random() * 2.6 + 1.2,
          alpha: 1,
          decay: Math.random() * 0.016 + 0.012,
          gravity: 0.09,
          drag: 0.965,
          twinkle: Math.random() > 0.4
        });
      }

      this.fireworks.push({ particles });
      celebrationAudio.playFirework();
    }

    launchTripleFireworks() {
      const centerX = this.width / 2;
      const centerY = this.height * 0.38;

      this.launchFirework(centerX, centerY, ['#ffd700', '#ffe180', '#ffffff']);
      setTimeout(() => {
        if (this.isRunning) {
          this.launchFirework(centerX - this.width * 0.25, centerY + 30, ['#ff5c8a', '#9b6bff', '#ffffff']);
        }
      }, 250);
      setTimeout(() => {
        if (this.isRunning) {
          this.launchFirework(centerX + this.width * 0.25, centerY - 20, ['#45e8d4', '#ffd700', '#ffffff']);
        }
      }, 500);
    }

    loop() {
      if (!this.isRunning || !this.ctx) return;

      this.ctx.clearRect(0, 0, this.width, this.height);

      // 1. Render Confetti
      for (let i = 0; i < this.confetti.length; i++) {
        const c = this.confetti[i];
        c.y += c.vy;
        c.x += c.vx + Math.sin(c.wobble) * 1.2;
        c.wobble += c.wobbleSpeed;
        c.rotX += c.speedRotX;
        c.rotY += c.speedRotY;
        c.rotZ += c.speedRotZ;

        // Reset if off bottom
        if (c.y > this.height + 30) {
          Object.assign(c, this.createConfettiPiece(false));
        }

        const width = c.size * Math.cos(c.rotY);
        const height = (c.size * c.aspectRatio) * Math.sin(c.rotX);

        this.ctx.save();
        this.ctx.translate(c.x, c.y);
        this.ctx.rotate(c.rotZ);
        this.ctx.fillStyle = c.color;
        this.ctx.beginPath();
        this.ctx.fillRect(-width / 2, -height / 2, width, height);
        this.ctx.restore();
      }

      // 2. Render Embers
      for (let i = 0; i < this.embers.length; i++) {
        const e = this.embers[i];
        e.y += e.vy;
        e.x += e.vx + Math.sin(e.phase) * 0.5;
        e.phase += e.pulseSpeed;

        if (e.y < -20) {
          Object.assign(e, this.createEmberPiece(false));
        }

        const currentAlpha = Math.max(0.1, e.alpha * (0.7 + 0.3 * Math.sin(e.phase)));
        this.ctx.save();
        this.ctx.globalAlpha = currentAlpha;
        this.ctx.fillStyle = e.color;
        this.ctx.shadowColor = e.color;
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      // 3. Render Fireworks
      for (let fIdx = this.fireworks.length - 1; fIdx >= 0; fIdx--) {
        const fw = this.fireworks[fIdx];
        let aliveCount = 0;

        for (let pIdx = 0; pIdx < fw.particles.length; pIdx++) {
          const p = fw.particles[pIdx];
          if (p.alpha <= 0.01) continue;

          aliveCount++;
          p.vx *= p.drag;
          p.vy *= p.drag;
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;

          let renderAlpha = p.alpha;
          if (p.twinkle && Math.random() > 0.4) {
            renderAlpha = Math.max(0, p.alpha - 0.25);
          }

          this.ctx.save();
          this.ctx.globalAlpha = Math.max(0, renderAlpha);
          this.ctx.fillStyle = p.color;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
        }

        if (aliveCount === 0) {
          this.fireworks.splice(fIdx, 1);
        }
      }

      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  }

  // Initialize Canvas & Engine
  const celebrationCanvas = document.getElementById('celebrationCanvas');
  const particleEngine = new CelebrationParticleEngine(celebrationCanvas);

  window.addEventListener('resize', () => {
    if (particleEngine && particleEngine.isRunning) {
      particleEngine.resize();
    }
  });

  // --- 3. Champion Celebration UI Controls & Modal Logic ---
  const celebrationModal = document.getElementById('championCelebrationModal');
  const celebrationTeamTitle = document.getElementById('celebrationTeamTitle');
  const celebrationLineupNames = document.getElementById('celebrationLineupNames');
  const celebrationStatusBadge = document.getElementById('celebrationStatusBadge');
  const celebrationPrizeVal = document.getElementById('celebrationPrizeVal');

  const btnCelebrationFirework = document.getElementById('btnCelebrationFirework');
  const btnCelebrationReplayAudio = document.getElementById('btnCelebrationReplayAudio');
  const btnCelebrationShare = document.getElementById('btnCelebrationShare');
  const btnCelebrationClose = document.getElementById('btnCelebrationClose');
  const celebrationCloseIcon = document.getElementById('celebrationCloseIcon');
  const celebrationSoundToggle = document.getElementById('celebrationSoundToggle');
  const celebrationSoundIcon = document.getElementById('celebrationSoundIcon');
  const celebrationSoundText = document.getElementById('celebrationSoundText');

  let currentChampionData = {
    teamName: '',
    lineup: '',
    discord: '',
    gameId: '',
    prize: 'Rp.150.000 + 1.000.000 Koin'
  };

  function openChampionCelebration(isAutoTrigger = false) {
    if (!celebrationModal) return;

    const finalMatch = matchesState['final'];
    const championName = finalMatch ? finalMatch.winner_name : null;

    if (championName) {
      const matchedTeam = participantsList.find((p) => p.teamName === championName);
      currentChampionData.teamName = championName;
      currentChampionData.lineup = matchedTeam && matchedTeam.playerNames ? matchedTeam.playerNames : 'Squad Juara';
      currentChampionData.discord = matchedTeam && matchedTeam.discordTag ? matchedTeam.discordTag : '-';
      currentChampionData.gameId = matchedTeam && matchedTeam.gameId ? matchedTeam.gameId : '-';
      currentChampionData.prize = 'Rp.150.000 + 1.000.000 Koin';

      if (celebrationTeamTitle) celebrationTeamTitle.textContent = championName.toUpperCase();
      if (celebrationLineupNames) celebrationLineupNames.innerHTML = `Lineup: <b>${escapeHtml(currentChampionData.lineup)}</b>`;
      if (celebrationStatusBadge) celebrationStatusBadge.innerHTML = `🔥 Status: <b>Grand Champion</b>`;
      if (celebrationPrizeVal) celebrationPrizeVal.textContent = currentChampionData.prize;
    } else {
      // Demo / Preview Mode jika belum ada juara
      currentChampionData.teamName = 'WOWOK LOVE TEDDY';
      currentChampionData.lineup = 'whisper (C), kayi';
      currentChampionData.discord = 'whisper#1337';
      currentChampionData.gameId = 'WhisperGod, KayiChan';
      currentChampionData.prize = 'Rp.150.000 + 1.000.000 Koin';

      if (celebrationTeamTitle) celebrationTeamTitle.textContent = 'WOWOK LOVE TEDDY';
      if (celebrationLineupNames) celebrationLineupNames.innerHTML = `Lineup: <b>whisper (C), kayi</b> (Simulasi Juara)`;
      if (celebrationStatusBadge) celebrationStatusBadge.innerHTML = `🔥 Status: <b>Simulasi Juara Turnamen</b>`;
      if (celebrationPrizeVal) celebrationPrizeVal.textContent = currentChampionData.prize;
    }

    celebrationModal.classList.add('active');

    // Start Particles & Play Victory Audio
    particleEngine.start();
    celebrationAudio.playFanfare();

    if (isAutoTrigger) {
      showToast(`🏆 Selamat kepada ${currentChampionData.teamName} atas kemenangan Juara 1 Turnamen!`);
    }
  }

  function closeChampionCelebration() {
    if (!celebrationModal) return;
    celebrationModal.classList.remove('active');
    particleEngine.stop();
  }

  // Button Listeners for Celebration Stage
  if (btnCelebrationFirework) {
    btnCelebrationFirework.addEventListener('click', (e) => {
      e.stopPropagation();
      particleEngine.launchTripleFireworks();
    });
  }

  if (btnCelebrationReplayAudio) {
    btnCelebrationReplayAudio.addEventListener('click', (e) => {
      e.stopPropagation();
      celebrationAudio.playFanfare();
      showToast('🎺 Memutar kembali Fanfare Kemenangan!');
    });
  }

  if (btnCelebrationShare) {
    btnCelebrationShare.addEventListener('click', async (e) => {
      e.stopPropagation();
      const shareText = `🏆 JUARA 1 TURNAMEN SAMBUNG KATA 2 VS 2 — YABI DEV 🏆\n\n👑 Tim Pemenang: ${currentChampionData.teamName}\n👥 Lineup: ${currentChampionData.lineup}\n🎁 Total Hadiah: ${currentChampionData.prize}\n⚡ Turnamen: Roblox Sambung Kata Komunitas Yabi Dev\n\nSelamat kepada para pemenang turnamen! 🎉🔥`;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareText);
          showToast('📋 Info kemenangan juara berhasil disalin ke clipboard!');
        } else {
          showToast('📋 ' + shareText);
        }
      } catch (err) {
        showToast('📋 Info Juara: ' + currentChampionData.teamName);
      }
    });
  }

  if (celebrationSoundToggle) {
    celebrationSoundToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isSoundOn = celebrationAudio.toggleMute();
      if (celebrationSoundIcon) celebrationSoundIcon.textContent = isSoundOn ? '🔊' : '🔇';
      if (celebrationSoundText) celebrationSoundText.textContent = isSoundOn ? 'Suara: ON' : 'Suara: MUTED';
      showToast(isSoundOn ? '🔊 Suara Fanfare diaktifkan' : '🔇 Suara Fanfare dimatikan');
    });
  }

  if (btnCelebrationClose) btnCelebrationClose.addEventListener('click', closeChampionCelebration);
  if (celebrationCloseIcon) celebrationCloseIcon.addEventListener('click', closeChampionCelebration);

  // Click on background overlay or canvas spawns interactive firework explosion
  if (celebrationModal) {
    celebrationModal.addEventListener('click', (e) => {
      if (e.target.closest('.celebration-actions-row') || e.target.closest('button')) return;
      if (e.target.closest('.celebration-stage-card') && !e.target.classList.contains('celebration-stage-card')) return;
      
      // Spawn firework at click coordinates
      particleEngine.launchFirework(e.clientX, e.clientY);
    });
  }

  // Keyboard Shortcuts (ESC to close, Space / F to launch fireworks)
  window.addEventListener('keydown', (e) => {
    if (celebrationModal && celebrationModal.classList.contains('active')) {
      if (e.key === 'Escape') {
        closeChampionCelebration();
      } else if (e.key === 'f' || e.key === 'F') {
        particleEngine.launchTripleFireworks();
      }
    }
  });

  // --- ZOOM & PANNING INTERACTION ---
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const zoomBadge = document.getElementById('zoomBadge');
  const bracketCanvas = document.getElementById('bracketCanvas');
  const scrollContainer = document.getElementById('bracketScrollContainer');

  function setZoom(val) {
    currentZoom = Math.min(1.4, Math.max(0.6, val));
    if (bracketCanvas) {
      bracketCanvas.style.transform = `scale(${currentZoom})`;
    }
    if (zoomBadge) {
      zoomBadge.textContent = `${Math.round(currentZoom * 100)}%`;
    }
    drawConnectorLines();
  }

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(currentZoom + 0.1));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(currentZoom - 0.1));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => setZoom(1));

  // Drag to Pan Scroll
  let isDown = false;
  let startX, startY, scrollLeft, scrollTop;

  if (scrollContainer) {
    scrollContainer.addEventListener('mousedown', (e) => {
      if (e.target.closest('.match-card') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
      isDown = true;
      startX = e.pageX - scrollContainer.offsetLeft;
      startY = e.pageY - scrollContainer.offsetTop;
      scrollLeft = scrollContainer.scrollLeft;
      scrollTop = scrollContainer.scrollTop;
    });

    scrollContainer.addEventListener('mouseleave', () => { isDown = false; });
    scrollContainer.addEventListener('mouseup', () => { isDown = false; });

    scrollContainer.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const y = e.pageY - scrollContainer.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      scrollContainer.scrollLeft = scrollLeft - walkX;
      scrollContainer.scrollTop = scrollTop - walkY;
    });
  }

  // --- ACTIONS & TOAST ---
  const btnSyncParticipants = document.getElementById('btnSyncParticipants');
  const btnResetBracket = document.getElementById('btnResetBracket');

  if (btnSyncParticipants) {
    btnSyncParticipants.addEventListener('click', async () => {
      btnSyncParticipants.disabled = true;
      btnSyncParticipants.innerHTML = '<span>⏳</span> Memuat Peserta...';

      try {
        await loadParticipants();
        initializeDefaultMatches();
        renderBracket();
        showToast('🔄 Bracket berhasil disinkronkan dengan data peserta terbaru!');
      } catch (err) {
        console.error('Error saat sinkron peserta:', err);
        showToast('⚠️ Gagal sinkron peserta: ' + err.message);
      } finally {
        btnSyncParticipants.disabled = false;
        btnSyncParticipants.innerHTML = '<span>🔄</span> Sinkron Peserta';
      }
    });
  }

  if (btnResetBracket) {
    btnResetBracket.addEventListener('click', () => {
      const confirmReset = confirm('⚠️ Apakah Anda yakin ingin mereset seluruh skor dan pertandingan bracket?');
      if (confirmReset) {
        try {
          initializeDefaultMatches();
          renderBracket();
          showToast('🗑️ Seluruh pertandingan bracket telah di-reset ke kondisi awal.');
        } catch (err) {
          console.error('Error saat reset bracket:', err);
          showToast('⚠️ Terjadi kendala saat mereset bracket.');
        }
      }
    });
  }

  function showToast(msg) {
    let toast = document.getElementById('bracketToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bracketToast';
      toast.className = 'bracket-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Realtime update listener jika Supabase aktif dan tabel tersedia
  if (supabaseClient) {
    try {
      supabaseClient
        .channel('public:tournament_matches')
        .on('postgres_changes', { event: '*', schema: 'public', table: MATCHES_TABLE }, async () => {
          console.log('⚡ Realtime update: Perubahan data pertandingan di Supabase');
          await loadBracketMatches();
          renderBracket();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime matches listener error:', e);
    }
  }

  // Handle Resize untuk update SVG lines
  window.addEventListener('resize', () => {
    drawConnectorLines();
  });

  // --- INITIALIZATION ---
  async function init() {
    try {
      await loadParticipants();
      await loadBracketMatches();
      renderBracket();
    } catch (err) {
      console.error('Initialization error:', err);
      renderBracket();
    }
  }

  init();
});
