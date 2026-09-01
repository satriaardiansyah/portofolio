/**
 * TOURNAMENT BRACKET MODULE - YABIDEV
 * Mengelola sistem Dynamic Single Elimination Tournament Bracket (4, 6, 8, 10, 12, 16, 32 Tim),
 * penyesuaian babak otomatis, auto-seeding saat tim bertambah, sinkronisasi Supabase & LocalStorage,
 * kalkulasi pemenang otomatis/manual, propagasi babak berikutnya, SVG connecting lines dinamis,
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
  const STORAGE_FORMAT_KEY = 'yabidev_bracket_format_v1';

  let supabaseClient = null;
  let isMatchesTableAvailable = true;

  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);
      console.log('⚡ Supabase Client initialized for Dynamic Bracket');
    } catch (err) {
      console.warn('⚠️ Supabase init error:', err);
    }
  }

  // --- STATE MANAGEMENT ---
  let participantsList = [];
  let matchesState = {};
  let selectedFormat = localStorage.getItem(STORAGE_FORMAT_KEY) || 'auto';
  let activeBracketConfig = null;
  let currentZoom = 1;
  let activeEditingMatchId = null;

  // Mock Fallback Participants
  const defaultFallbackParticipants = [
    { id: 'p-1', teamName: 'CYBER VIPERS', playerNames: 'Satria (C), Vanya' },
    { id: 'p-2', teamName: 'NEON PROTOCOL', playerNames: 'Farhan (C), Brian' },
    { id: 'p-3', teamName: 'SHADOW APEX', playerNames: 'Aldo (C), Cindy' },
    { id: 'p-4', teamName: 'ROYAL TITANS', playerNames: 'Rian (C), Sheila' },
    { id: 'p-5', teamName: 'PHANTOM SQUAD', playerNames: 'Bima (C), Aurel' },
    { id: 'p-6', teamName: 'DRAGON VOID', playerNames: 'Kevin (C), Nabila' },
    { id: 'p-7', teamName: 'AURORA GLITCH', playerNames: 'Daffa (C), Putri' },
    { id: 'p-8', teamName: 'MYSTIC FALCON', playerNames: 'Zaki (C), Tari' },
    { id: 'p-9', teamName: 'VALKYRIE X', playerNames: 'Gavin (C), Jessica' },
    { id: 'p-10', teamName: 'ZERO GRAVITY', playerNames: 'Rangga (C), Tiara' },
    { id: 'p-11', teamName: 'SOLAR ECLIPSE', playerNames: 'Fajar (C), Diana' },
    { id: 'p-12', teamName: 'QUANTUM FORCE', playerNames: 'Arga (C), Melisa' },
    { id: 'p-13', teamName: 'NEXUS LEGENDS', playerNames: 'Rizky (C), Clara' },
    { id: 'p-14', teamName: 'INFINITY STORM', playerNames: 'Danu (C), Bella' },
    { id: 'p-15', teamName: 'BLAZE RUNNERS', playerNames: 'Haikal (C), Tasya' },
    { id: 'p-16', teamName: 'OMEGA PROTOCOL', playerNames: 'Geri (C), Nadia' }
  ];

  // --- DYNAMIC BRACKET ENGINE GENERATOR ---
  function determineAutoBracketSize(count) {
    if (count <= 4) return 4;
    if (count <= 6) return 6;
    if (count <= 8) return 8;
    if (count <= 10) return 10;
    if (count <= 12) return 12;
    if (count <= 16) return 16;
    return 32;
  }

  function getActiveBracketSize() {
    if (selectedFormat === 'auto' || !selectedFormat) {
      return determineAutoBracketSize(participantsList.length);
    }
    return parseInt(selectedFormat, 10) || 10;
  }

  function generateBracketStructure(size) {
    const numSize = Number(size);

    const bronzeMatchDef = {
      id: 'bronze',
      round: 'final',
      match_number: 2,
      title: 'Perebutan Juara 3 🥉',
      team1_seed: 'KALAH SF-1',
      team2_seed: 'KALAH SF-2',
      slot1_index: null,
      slot2_index: null,
      next_match_id: 'champion',
      next_match_slot: 2,
      isBronze: true
    };

    switch (numSize) {
      case 4:
        return {
          totalTeams: 4,
          formatName: '4 Tim (Semi Final)',
          stages: [
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [
            { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: '', team2_seed: '', slot1_index: 0, slot2_index: 3, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
            { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: '', team2_seed: '', slot1_index: 1, slot2_index: 2, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 },
            { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 },
            bronzeMatchDef
          ]
        };

      case 6:
        return {
          totalTeams: 6,
          formatName: '6 Tim (Play-In + SF)',
          stages: [
            { id: 'playin', title: 'Play-In', subtitle: '2 Pertandingan', matchIds: ['pi-1', 'pi-2'] },
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [
            { id: 'pi-1', round: 'playin', match_number: 1, title: 'Play-In #1', team1_seed: '', team2_seed: '', slot1_index: 3, slot2_index: 4, next_match_id: 'sf-1', next_match_slot: 2 },
            { id: 'pi-2', round: 'playin', match_number: 2, title: 'Play-In #2', team1_seed: '', team2_seed: '', slot1_index: 2, slot2_index: 5, next_match_id: 'sf-2', next_match_slot: 2 },
            { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: '', team2_seed: 'MENANG PI-1', slot1_index: 0, slot2_index: null, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
            { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: '', team2_seed: 'MENANG PI-2', slot1_index: 1, slot2_index: null, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 },
            { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 },
            bronzeMatchDef
          ]
        };

      case 8:
        return {
          totalTeams: 8,
          formatName: '8 Tim (Quarter Final)',
          stages: [
            { id: 'quarter', title: 'Quarter Final', subtitle: '4 Pertandingan', matchIds: ['qf-1', 'qf-2', 'qf-3', 'qf-4'] },
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [
            { id: 'qf-1', round: 'quarter', match_number: 1, title: 'Quarter Final #1', team1_seed: '', team2_seed: '', slot1_index: 0, slot2_index: 7, next_match_id: 'sf-1', next_match_slot: 1 },
            { id: 'qf-2', round: 'quarter', match_number: 2, title: 'Quarter Final #2', team1_seed: '', team2_seed: '', slot1_index: 3, slot2_index: 4, next_match_id: 'sf-1', next_match_slot: 2 },
            { id: 'qf-3', round: 'quarter', match_number: 3, title: 'Quarter Final #3', team1_seed: '', team2_seed: '', slot1_index: 2, slot2_index: 5, next_match_id: 'sf-2', next_match_slot: 1 },
            { id: 'qf-4', round: 'quarter', match_number: 4, title: 'Quarter Final #4', team1_seed: '', team2_seed: '', slot1_index: 1, slot2_index: 6, next_match_id: 'sf-2', next_match_slot: 2 },
            { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: 'MENANG QF-1', team2_seed: 'MENANG QF-2', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
            { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: 'MENANG QF-3', team2_seed: 'MENANG QF-4', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 },
            { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 },
            bronzeMatchDef
          ]
        };

      case 12:
        return {
          totalTeams: 12,
          formatName: '12 Tim (Play-In + QF)',
          stages: [
            { id: 'playin', title: 'Play-In', subtitle: '4 Pertandingan', matchIds: ['pi-1', 'pi-2', 'pi-3', 'pi-4'] },
            { id: 'quarter', title: 'Quarter Final', subtitle: '4 Pertandingan', matchIds: ['qf-1', 'qf-2', 'qf-3', 'qf-4'] },
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [
            { id: 'pi-1', round: 'playin', match_number: 1, title: 'Play-In #1', team1_seed: '', team2_seed: '', slot1_index: 7, slot2_index: 8, next_match_id: 'qf-1', next_match_slot: 2 },
            { id: 'pi-2', round: 'playin', match_number: 2, title: 'Play-In #2', team1_seed: '', team2_seed: '', slot1_index: 4, slot2_index: 11, next_match_id: 'qf-2', next_match_slot: 2 },
            { id: 'pi-3', round: 'playin', match_number: 3, title: 'Play-In #3', team1_seed: '', team2_seed: '', slot1_index: 5, slot2_index: 10, next_match_id: 'qf-3', next_match_slot: 2 },
            { id: 'pi-4', round: 'playin', match_number: 4, title: 'Play-In #4', team1_seed: '', team2_seed: '', slot1_index: 6, slot2_index: 9, next_match_id: 'qf-4', next_match_slot: 2 },
            { id: 'qf-1', round: 'quarter', match_number: 1, title: 'Quarter Final #1', team1_seed: '', team2_seed: 'MENANG PI-1', slot1_index: 0, slot2_index: null, next_match_id: 'sf-1', next_match_slot: 1 },
            { id: 'qf-2', round: 'quarter', match_number: 2, title: 'Quarter Final #2', team1_seed: '', team2_seed: 'MENANG PI-2', slot1_index: 3, slot2_index: null, next_match_id: 'sf-1', next_match_slot: 2 },
            { id: 'qf-3', round: 'quarter', match_number: 3, title: 'Quarter Final #3', team1_seed: '', team2_seed: 'MENANG PI-3', slot1_index: 2, slot2_index: null, next_match_id: 'sf-2', next_match_slot: 1 },
            { id: 'qf-4', round: 'quarter', match_number: 4, title: 'Quarter Final #4', team1_seed: '', team2_seed: 'MENANG PI-4', slot1_index: 1, slot2_index: null, next_match_id: 'sf-2', next_match_slot: 2 },
            { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: 'MENANG QF-1', team2_seed: 'MENANG QF-2', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
            { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: 'MENANG QF-3', team2_seed: 'MENANG QF-4', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 },
            { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 },
            bronzeMatchDef
          ]
        };

      case 16:
        return {
          totalTeams: 16,
          formatName: '16 Tim (Round of 16)',
          stages: [
            { id: 'r16', title: 'Round of 16', subtitle: '8 Pertandingan', matchIds: ['r16-1', 'r16-2', 'r16-3', 'r16-4', 'r16-5', 'r16-6', 'r16-7', 'r16-8'] },
            { id: 'quarter', title: 'Quarter Final', subtitle: '4 Pertandingan', matchIds: ['qf-1', 'qf-2', 'qf-3', 'qf-4'] },
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [
            { id: 'r16-1', round: 'r16', match_number: 1, title: 'R16 #1', team1_seed: '', team2_seed: '', slot1_index: 0, slot2_index: 15, next_match_id: 'qf-1', next_match_slot: 1 },
            { id: 'r16-2', round: 'r16', match_number: 2, title: 'R16 #2', team1_seed: '', team2_seed: '', slot1_index: 7, slot2_index: 8, next_match_id: 'qf-1', next_match_slot: 2 },
            { id: 'r16-3', round: 'r16', match_number: 3, title: 'R16 #3', team1_seed: '', team2_seed: '', slot1_index: 3, slot2_index: 12, next_match_id: 'qf-2', next_match_slot: 1 },
            { id: 'r16-4', round: 'r16', match_number: 4, title: 'R16 #4', team1_seed: '', team2_seed: '', slot1_index: 4, slot2_index: 11, next_match_id: 'qf-2', next_match_slot: 2 },
            { id: 'r16-5', round: 'r16', match_number: 5, title: 'R16 #5', team1_seed: '', team2_seed: '', slot1_index: 2, slot2_index: 13, next_match_id: 'qf-3', next_match_slot: 1 },
            { id: 'r16-6', round: 'r16', match_number: 6, title: 'R16 #6', team1_seed: '', team2_seed: '', slot1_index: 5, slot2_index: 10, next_match_id: 'qf-3', next_match_slot: 2 },
            { id: 'r16-7', round: 'r16', match_number: 7, title: 'R16 #7', team1_seed: '', team2_seed: '', slot1_index: 1, slot2_index: 14, next_match_id: 'qf-4', next_match_slot: 1 },
            { id: 'r16-8', round: 'r16', match_number: 8, title: 'R16 #8', team1_seed: '', team2_seed: '', slot1_index: 6, slot2_index: 9, next_match_id: 'qf-4', next_match_slot: 2 },
            { id: 'qf-1', round: 'quarter', match_number: 1, title: 'Quarter Final #1', team1_seed: 'MENANG R16-1', team2_seed: 'MENANG R16-2', slot1_index: null, slot2_index: null, next_match_id: 'sf-1', next_match_slot: 1 },
            { id: 'qf-2', round: 'quarter', match_number: 2, title: 'Quarter Final #2', team1_seed: 'MENANG R16-3', team2_seed: 'MENANG R16-4', slot1_index: null, slot2_index: null, next_match_id: 'sf-1', next_match_slot: 2 },
            { id: 'qf-3', round: 'quarter', match_number: 3, title: 'Quarter Final #3', team1_seed: 'MENANG R16-5', team2_seed: 'MENANG R16-6', slot1_index: null, slot2_index: null, next_match_id: 'sf-2', next_match_slot: 1 },
            { id: 'qf-4', round: 'quarter', match_number: 4, title: 'Quarter Final #4', team1_seed: 'MENANG R16-7', team2_seed: 'MENANG R16-8', slot1_index: null, slot2_index: null, next_match_id: 'sf-2', next_match_slot: 2 },
            { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: 'MENANG QF-1', team2_seed: 'MENANG QF-2', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
            { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: 'MENANG QF-3', team2_seed: 'MENANG QF-4', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 },
            { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 },
            bronzeMatchDef
          ]
        };

      case 32: {
        const r32Matches = [];
        for (let i = 1; i <= 16; i++) {
          const nextR16 = Math.ceil(i / 2);
          const nextSlot = (i % 2 === 1) ? 1 : 2;
          r32Matches.push({
            id: `r32-${i}`,
            round: 'r32',
            match_number: i,
            title: `R32 #${i}`,
            team1_seed: '',
            team2_seed: '',
            slot1_index: i - 1,
            slot2_index: 32 - i,
            next_match_id: `r16-${nextR16}`,
            next_match_slot: nextSlot
          });
        }
        const r16Matches = [];
        for (let i = 1; i <= 8; i++) {
          const nextQf = Math.ceil(i / 2);
          const nextSlot = (i % 2 === 1) ? 1 : 2;
          r16Matches.push({
            id: `r16-${i}`,
            round: 'r16',
            match_number: i,
            title: `R16 #${i}`,
            team1_seed: `MENANG R32-${i * 2 - 1}`,
            team2_seed: `MENANG R32-${i * 2}`,
            slot1_index: null,
            slot2_index: null,
            next_match_id: `qf-${nextQf}`,
            next_match_slot: nextSlot
          });
        }
        const qfMatches = [];
        for (let i = 1; i <= 4; i++) {
          const nextSf = Math.ceil(i / 2);
          const nextSlot = (i % 2 === 1) ? 1 : 2;
          qfMatches.push({
            id: `qf-${i}`,
            round: 'quarter',
            match_number: i,
            title: `Quarter #${i}`,
            team1_seed: `MENANG R16-${i * 2 - 1}`,
            team2_seed: `MENANG R16-${i * 2}`,
            slot1_index: null,
            slot2_index: null,
            next_match_id: `sf-${nextSf}`,
            next_match_slot: nextSlot
          });
        }
        const sfMatches = [
          { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: 'MENANG QF-1', team2_seed: 'MENANG QF-2', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
          { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: 'MENANG QF-3', team2_seed: 'MENANG QF-4', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 }
        ];
        const finalMatch = { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 };
        return {
          totalTeams: 32,
          formatName: '32 Tim (Round of 32)',
          stages: [
            { id: 'r32', title: 'Round of 32', subtitle: '16 Pertandingan', matchIds: r32Matches.map((m) => m.id) },
            { id: 'r16', title: 'Round of 16', subtitle: '8 Pertandingan', matchIds: r16Matches.map((m) => m.id) },
            { id: 'quarter', title: 'Quarter Final', subtitle: '4 Pertandingan', matchIds: qfMatches.map((m) => m.id) },
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [...r32Matches, ...r16Matches, ...qfMatches, ...sfMatches, finalMatch, bronzeMatchDef]
        };
      }

      case 10:
      default:
        return {
          totalTeams: 10,
          formatName: '10 Tim (Play-In + QF)',
          stages: [
            { id: 'playin', title: 'Play-In', subtitle: '2 Pertandingan', matchIds: ['pi-1', 'pi-2'] },
            { id: 'quarter', title: 'Quarter Final', subtitle: '4 Pertandingan', matchIds: ['qf-1', 'qf-2', 'qf-3', 'qf-4'] },
            { id: 'semi', title: 'Semi Final', subtitle: '2 Pertandingan', matchIds: ['sf-1', 'sf-2'] },
            { id: 'final', title: 'Grand Final & Juara 3', subtitle: 'Perebutan Juara 1 & 3', isFinal: true, matchIds: ['final', 'bronze'] }
          ],
          matches: [
            { id: 'pi-1', round: 'playin', match_number: 1, title: 'Play-In #1', team1_seed: '', team2_seed: '', slot1_index: 7, slot2_index: 8, next_match_id: 'qf-1', next_match_slot: 2 },
            { id: 'pi-2', round: 'playin', match_number: 2, title: 'Play-In #2', team1_seed: '', team2_seed: '', slot1_index: 6, slot2_index: 9, next_match_id: 'qf-4', next_match_slot: 2 },
            { id: 'qf-1', round: 'quarter', match_number: 1, title: 'Quarter Final #1', team1_seed: '', team2_seed: 'MENANG PI-1', slot1_index: 0, slot2_index: null, next_match_id: 'sf-1', next_match_slot: 1 },
            { id: 'qf-2', round: 'quarter', match_number: 2, title: 'Quarter Final #2', team1_seed: '', team2_seed: '', slot1_index: 3, slot2_index: 4, next_match_id: 'sf-1', next_match_slot: 2 },
            { id: 'qf-3', round: 'quarter', match_number: 3, title: 'Quarter Final #3', team1_seed: '', team2_seed: '', slot1_index: 2, slot2_index: 5, next_match_id: 'sf-2', next_match_slot: 1 },
            { id: 'qf-4', round: 'quarter', match_number: 4, title: 'Quarter Final #4', team1_seed: '', team2_seed: 'MENANG PI-2', slot1_index: 1, slot2_index: null, next_match_id: 'sf-2', next_match_slot: 2 },
            { id: 'sf-1', round: 'semi', match_number: 1, title: 'Semi Final #1', team1_seed: 'MENANG QF-1', team2_seed: 'MENANG QF-2', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 1, loser_match_id: 'bronze', loser_match_slot: 1 },
            { id: 'sf-2', round: 'semi', match_number: 2, title: 'Semi Final #2', team1_seed: 'MENANG QF-3', team2_seed: 'MENANG QF-4', slot1_index: null, slot2_index: null, next_match_id: 'final', next_match_slot: 2, loser_match_id: 'bronze', loser_match_slot: 2 },
            { id: 'final', round: 'final', match_number: 1, title: 'Grand Final 🏆', team1_seed: 'MENANG SF-1', team2_seed: 'MENANG SF-2', slot1_index: null, slot2_index: null, next_match_id: 'champion', next_match_slot: 1 },
            bronzeMatchDef
          ]
        };
    }
  }

  // --- DATA ACCESS LAYER ---

  // 1. Fetch Peserta dari Supabase / LocalStorage
  async function loadParticipants() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from(PARTICIPANTS_TABLE)
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          participantsList = data.map((item) => ({
            id: String(item.id),
            teamName: item.team_name || 'Tim Tanpa Nama',
            playerNames: item.player_names || '-',
            gameId: item.game_id || '-',
            discordTag: item.discord_tag || '-',
            status: item.status || 'Terverifikasi'
          }));
          console.log(`⚡ Loaded ${participantsList.length} participants from Supabase`);
          return;
        }
      } catch (err) {
        console.warn('Gagal membaca peserta dari Supabase:', err);
      }
    }

    // Fallback LocalStorage
    try {
      const localP = localStorage.getItem(STORAGE_PARTICIPANTS_KEY);
      if (localP) {
        const parsed = JSON.parse(localP);
        if (Array.isArray(parsed) && parsed.length > 0) {
          participantsList = parsed.slice().reverse().map((item) => ({
            id: String(item.id),
            teamName: item.teamName || item.team_name || 'Tim Tanpa Nama',
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
    participantsList = defaultFallbackParticipants.slice(0, 10);
  }

  // 2. Fetch State Pertandingan dari Supabase / LocalStorage
  async function loadBracketMatches() {
    const activeSize = getActiveBracketSize();
    activeBracketConfig = generateBracketStructure(activeSize);

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
        } else if (error && error.message && error.message.includes('Could not find the table')) {
          isMatchesTableAvailable = false;
        }
      } catch (err) {
        console.warn('Supabase matches query error:', err);
      }
    }

    if (!loadedFromDb) {
      try {
        const localData = localStorage.getItem(STORAGE_MATCHES_KEY);
        if (localData) {
          matchesState = JSON.parse(localData);
          console.log('⚡ Loaded tournament matches from LocalStorage');
        }
      } catch (e) {}
    }

    // Inisialisasi struktur dalam memori TANPA memicu write kembali ke database
    initializeDynamicMatches(activeBracketConfig, false);
  }

  // Inisialisasi dynamic matches berdasarkan struktur aktif dan list tim peserta
  function initializeDynamicMatches(config, shouldSyncToDb = false) {
    if (!config || !config.matches) return;

    const newMatchesState = {};

    config.matches.forEach((def) => {
      const existing = matchesState[def.id];

      let team1_name = null;
      let team1_id = null;
      let team2_name = null;
      let team2_id = null;

      // 1. Cek apakah match sudah memiliki data Tim 1 tersimpan (dari Supabase / LocalStorage / Edit Admin)
      const existingT1Valid = existing && existing.team1_name && 
        !existing.team1_name.startsWith('Menunggu') && 
        !existing.team1_name.startsWith('[SLOT') &&
        !existing.team1_name.startsWith('[MENANG') &&
        !existing.team1_name.startsWith('[KALAH');

      if (existingT1Valid) {
        team1_name = existing.team1_name;
        team1_id = existing.team1_id;
      } else if (def.slot1_index !== null && def.slot1_index !== undefined) {
        // Fallback auto-seeding awal hanya jika belum ada data tim kustom tersimpan
        const p1 = participantsList[def.slot1_index];
        if (p1) {
          team1_name = p1.teamName;
          team1_id = p1.id;
        } else {
          team1_name = def.team1_seed ? `[${def.team1_seed}]` : 'Menunggu Tim';
        }
      } else {
        team1_name = def.team1_seed ? `[${def.team1_seed}]` : 'Menunggu Tim';
      }

      // 2. Cek apakah match sudah memiliki data Tim 2 tersimpan (dari Supabase / LocalStorage / Edit Admin)
      const existingT2Valid = existing && existing.team2_name && 
        !existing.team2_name.startsWith('Menunggu') && 
        !existing.team2_name.startsWith('[SLOT') &&
        !existing.team2_name.startsWith('[MENANG') &&
        !existing.team2_name.startsWith('[KALAH');

      if (existingT2Valid) {
        team2_name = existing.team2_name;
        team2_id = existing.team2_id;
      } else if (def.slot2_index !== null && def.slot2_index !== undefined) {
        // Fallback auto-seeding awal hanya jika belum ada data tim kustom tersimpan
        const p2 = participantsList[def.slot2_index];
        if (p2) {
          team2_name = p2.teamName;
          team2_id = p2.id;
        } else {
          team2_name = def.team2_seed ? `[${def.team2_seed}]` : 'Menunggu Tim';
        }
      } else {
        team2_name = def.team2_seed ? `[${def.team2_seed}]` : 'Menunggu Tim';
      }

      // Pastikan ID tim terisi jika namanya cocok dengan daftar peserta
      if (team1_name && !team1_id) {
        const p1 = participantsList.find((p) => p.teamName && p.teamName.trim().toLowerCase() === team1_name.trim().toLowerCase());
        if (p1) team1_id = p1.id;
      }
      if (team2_name && !team2_id) {
        const p2 = participantsList.find((p) => p.teamName && p.teamName.trim().toLowerCase() === team2_name.trim().toLowerCase());
        if (p2) team2_id = p2.id;
      }

      let status = 'MENUNGGU';
      if (team1_name && team2_name && 
          !team1_name.startsWith('Menunggu') && !team2_name.startsWith('Menunggu') && 
          !team1_name.startsWith('[') && !team2_name.startsWith('[')) {
        status = 'MATCH READY';
      }

      newMatchesState[def.id] = {
        ...def,
        team1_name: team1_name || (def.team1_seed ? `[${def.team1_seed}]` : 'Menunggu Tim'),
        team1_id: team1_id,
        team2_name: team2_name || (def.team2_seed ? `[${def.team2_seed}]` : 'Menunggu Tim'),
        team2_id: team2_id,
        score1: existing ? Number(existing.score1 || 0) : 0,
        score2: existing ? Number(existing.score2 || 0) : 0,
        winner_id: existing ? existing.winner_id : null,
        winner_name: existing ? existing.winner_name : null,
        status: existing && existing.status ? existing.status : status
      };
    });

    matchesState = newMatchesState;

    try {
      localStorage.setItem(STORAGE_MATCHES_KEY, JSON.stringify(matchesState));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    if (shouldSyncToDb) {
      saveMatchesState();
    }
  }

  // 3. Simpan State Pertandingan ke Supabase & LocalStorage
  async function saveMatchesState() {
    try {
      localStorage.setItem(STORAGE_MATCHES_KEY, JSON.stringify(matchesState));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

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
          loser_match_id: m.loser_match_id || null,
          loser_match_slot: m.loser_match_slot || null,
          status: m.status || 'MENUNGGU',
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabaseClient
          .from(MATCHES_TABLE)
          .upsert(rows, { onConflict: 'id' });

        if (error) {
          if (error.message && error.message.includes('Could not find the table')) {
            isMatchesTableAvailable = false;
          } else {
            console.warn('Supabase upsert error:', error);
          }
        }
      } catch (err) {
        console.warn('Gagal sync ke Supabase:', err);
      }
    }
  }

  // --- LOGIKA PROPAGASI PEMENANG & KALAH (NEXT ROUND & JUARA 3) ---
  function resolveMatchWinner(matchId, winnerType, customWinnerName = null, customWinnerId = null) {
    const match = matchesState[matchId];
    if (!match) return;

    let winId = null;
    let winName = null;
    let loseId = null;
    let loseName = null;

    if (winnerType === 'team1') {
      winId = match.team1_id || 'team1';
      winName = match.team1_name;
      loseId = match.team2_id || 'team2';
      loseName = match.team2_name;
    } else if (winnerType === 'team2') {
      winId = match.team2_id || 'team2';
      winName = match.team2_name;
      loseId = match.team1_id || 'team1';
      loseName = match.team1_name;
    } else if (winnerType === 'custom') {
      winId = customWinnerId || 'custom';
      winName = customWinnerName;
      loseId = null;
      loseName = null;
    } else if (winnerType === 'none') {
      winId = null;
      winName = null;
      loseId = null;
      loseName = null;
    }

    match.winner_id = winId;
    match.winner_name = winName;

    if (winName) {
      match.status = 'SELESAI';
    } else {
      match.status = (match.team1_id && match.team2_id) ? 'MATCH READY' : 'MENUNGGU';
    }

    // 1. Propagasi Pemenang ke Match Berikutnya (Grand Final / Babak Lanjutan)
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

        if (nextMatch.team1_id && nextMatch.team2_id && nextMatch.status === 'MENUNGGU') {
          nextMatch.status = 'MATCH READY';
        } else if ((!nextMatch.team1_id || !nextMatch.team2_id) && nextMatch.status !== 'SELESAI') {
          nextMatch.status = 'MENUNGGU';
        }
      }
    }

    // 2. Propagasi Tim Kalah (untuk Perebutan Juara 3 dari Semi Final)
    if (match.loser_match_id) {
      const loserMatch = matchesState[match.loser_match_id];
      if (loserMatch) {
        if (match.loser_match_slot === 1) {
          loserMatch.team1_name = loseName || `[${loserMatch.team1_seed}]`;
          loserMatch.team1_id = loseId;
        } else if (match.loser_match_slot === 2) {
          loserMatch.team2_name = loseName || `[${loserMatch.team2_seed}]`;
          loserMatch.team2_id = loseId;
        }

        if (loserMatch.team1_id && loserMatch.team2_id && loserMatch.status === 'MENUNGGU') {
          loserMatch.status = 'MATCH READY';
        } else if ((!loserMatch.team1_id || !loserMatch.team2_id) && loserMatch.status !== 'SELESAI') {
          loserMatch.status = 'MENUNGGU';
        }
      }
    }

    saveMatchesState();
    renderBracket();
  }

  // --- RENDER DYNAMIC BRACKET & UI ---

  function renderBracket() {
    const stagesGrid = document.getElementById('bracketStagesGrid');
    if (!stagesGrid) return;

    const activeSize = getActiveBracketSize();
    if (!activeBracketConfig || activeBracketConfig.totalTeams !== activeSize) {
      activeBracketConfig = generateBracketStructure(activeSize);
    }

    let stagesHtml = '';

    // Render setiap kolom babak pertandingan
    activeBracketConfig.stages.forEach((stage) => {
      const matchCardsHtml = stage.matchIds
        .map((id) => renderMatchCardHtml(matchesState[id], stage.isFinal))
        .join('');

      stagesHtml += `
        <div class="bracket-stage-col stage-${stage.id}">
          <div class="stage-header ${stage.isFinal ? 'final-header' : ''}">
            <div class="stage-title" ${stage.isFinal ? 'style="color:var(--amber);"' : ''}>${escapeHtml(stage.title)}</div>
            <div class="stage-subtitle" ${stage.isFinal ? 'style="color:#ffd180;"' : ''}>${escapeHtml(stage.subtitle)}</div>
          </div>
          <div class="stage-matches-container" id="stageMatches_${stage.id}">
            ${matchCardsHtml}
          </div>
        </div>
      `;
    });

    // Render Kolom Podium Juara (Champion Showcase & Top 3 Standings)
    stagesHtml += `
      <div class="bracket-stage-col stage-champion">
        <div class="stage-header" style="border-color:rgba(255, 184, 77, 0.5); background:rgba(255, 184, 77, 0.15);">
          <div class="stage-title" style="color:var(--amber);">🏆 Podium Juara</div>
          <div class="stage-subtitle">Hasil Akhir Turnamen</div>
        </div>
        <div class="stage-matches-container" id="stageChampionShowcase">
          ${renderChampionPodiumHtml()}
        </div>
      </div>
    `;

    stagesGrid.innerHTML = stagesHtml;

    // Attach Champion Event
    const podiumCard = document.getElementById('championPodiumCard');
    if (podiumCard) {
      podiumCard.addEventListener('click', () => openChampionCelebration());
      podiumCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openChampionCelebration();
        }
      });
    }

    // Update Top Header Stats & Badges
    updateHeaderStats();

    // Attach Click Events to Match Cards
    attachCardEventListeners();

    // Re-draw Connecting Lines
    requestAnimationFrame(() => {
      drawConnectorLines();
    });
  }

  // --- HELPER NAMA PEMAIN / ROSTER TIM ---
  function getTeamPlayerNames(teamName, teamId) {
    if (!teamName || teamName.startsWith('[') || teamName.startsWith('Menunggu') || teamName.startsWith('KALAH')) {
      return '';
    }

    // 1. Cari berdasarkan ID peserta
    if (teamId) {
      const byId = participantsList.find((p) => String(p.id) === String(teamId));
      if (byId && byId.playerNames && byId.playerNames !== '-') {
        return byId.playerNames;
      }
    }

    // 2. Cari berdasarkan nama tim (case-insensitive)
    const normalized = teamName.trim().toLowerCase();
    const byName = participantsList.find((p) => p.teamName && p.teamName.trim().toLowerCase() === normalized);
    if (byName && byName.playerNames && byName.playerNames !== '-') {
      return byName.playerNames;
    }

    return '';
  }

  function renderMatchCardHtml(match, isFinal = false) {
    if (!match) return '';

    const isLive = match.status === 'BERLANGSUNG';
    const isFinished = match.status === 'SELESAI';
    const isBronze = match.id === 'bronze' || match.round === 'bronze' || match.isBronze;
    const team1IsWinner = match.winner_name && match.winner_name === match.team1_name;
    const team2IsWinner = match.winner_name && match.winner_name === match.team2_name;

    const t1Placeholder = !match.team1_id && (!match.team1_name || match.team1_name.startsWith('[') || match.team1_name.startsWith('Menunggu') || match.team1_name.startsWith('KALAH'));
    const t2Placeholder = !match.team2_id && (!match.team2_name || match.team2_name.startsWith('[') || match.team2_name.startsWith('Menunggu') || match.team2_name.startsWith('KALAH'));

    const t1Players = getTeamPlayerNames(match.team1_name, match.team1_id);
    const t2Players = getTeamPlayerNames(match.team2_name, match.team2_id);

    const showT1Seed = t1Placeholder && match.team1_seed && (match.team1_seed.startsWith('MENANG') || match.team1_seed.startsWith('KALAH'));
    const showT2Seed = t2Placeholder && match.team2_seed && (match.team2_seed.startsWith('MENANG') || match.team2_seed.startsWith('KALAH'));

    let winnerLabelPrefix = '🏆 Pemenang:';
    if (match.id === 'final') winnerLabelPrefix = '🥇 Juara 1:';
    if (match.id === 'bronze') winnerLabelPrefix = '🥉 Juara 3:';

    return `
      <div class="match-card ${isLive ? 'is-live' : ''} ${isFinished ? 'is-finished' : ''} ${isFinal && !isBronze ? 'is-grand-final' : ''} ${isBronze ? 'is-bronze-card' : ''}" 
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
              ${showT1Seed ? `<span class="team-seed-pill ${team1IsWinner ? 'winner-seed' : ''}">${escapeHtml(match.team1_seed)}</span>` : ''}
              <div class="team-info-col">
                <span class="team-name-text ${t1Placeholder ? 'placeholder' : ''}" title="${escapeHtml(match.team1_name || '')}">
                  ${escapeHtml(match.team1_name || 'Menunggu Tim')}
                </span>
                ${t1Players ? `
                  <span class="team-players-text" title="Pemain: ${escapeHtml(t1Players)}">
                    <span class="players-icon">👥</span> ${escapeHtml(t1Players)}
                  </span>
                ` : ''}
              </div>
            </div>
            <span class="team-score-badge ${team1IsWinner ? 'winner-score' : ''}">
              ${match.score1 !== undefined ? match.score1 : 0}
            </span>
          </div>

          <!-- Tim 2 -->
          <div class="team-slot-row ${team2IsWinner ? 'winner' : ''} ${team1IsWinner ? 'loser' : ''} ${t2Placeholder ? 'empty-slot' : ''}">
            <div class="team-meta-left">
              ${showT2Seed ? `<span class="team-seed-pill ${team2IsWinner ? 'winner-seed' : ''}">${escapeHtml(match.team2_seed)}</span>` : ''}
              <div class="team-info-col">
                <span class="team-name-text ${t2Placeholder ? 'placeholder' : ''}" title="${escapeHtml(match.team2_name || '')}">
                  ${escapeHtml(match.team2_name || 'Menunggu Tim')}
                </span>
                ${t2Players ? `
                  <span class="team-players-text" title="Pemain: ${escapeHtml(t2Players)}">
                    <span class="players-icon">👥</span> ${escapeHtml(t2Players)}
                  </span>
                ` : ''}
              </div>
            </div>
            <span class="team-score-badge ${team2IsWinner ? 'winner-score' : ''}">
              ${match.score2 !== undefined ? match.score2 : 0}
            </span>
          </div>
        </div>

        <div class="match-card-foot">
          <span class="match-hint-foot">
            ${team1IsWinner ? `${winnerLabelPrefix} <b>${escapeHtml(match.team1_name)}</b>` : team2IsWinner ? `${winnerLabelPrefix} <b>${escapeHtml(match.team2_name)}</b>` : 'Klik untuk edit skor'}
          </span>
          <span class="quick-edit-hint">
            <span>⚙️</span> Edit Skor
          </span>
        </div>
      </div>
    `;
  }

  function renderChampionPodiumHtml() {
    const finalMatch = matchesState['final'];
    const bronzeMatch = matchesState['bronze'];

    const championName = finalMatch ? finalMatch.winner_name : null;
    let runnerUpName = null;
    if (championName && finalMatch) {
      if (championName === finalMatch.team1_name) {
        runnerUpName = finalMatch.team2_name;
      } else if (championName === finalMatch.team2_name) {
        runnerUpName = finalMatch.team1_name;
      }
    }

    const thirdPlaceName = bronzeMatch ? bronzeMatch.winner_name : null;

    let championRoster = 'Pemenang Grand Final akan dinobatkan sebagai Juara 1 Turnamen.';
    if (championName) {
      const roster = getTeamPlayerNames(championName);
      if (roster) {
        championRoster = `Lineup: <b>${escapeHtml(roster)}</b>`;
      } else {
        championRoster = 'Selamat kepada tim juara atas kemenangan spektakuler!';
      }
    }

    const runnerUpRoster = runnerUpName ? getTeamPlayerNames(runnerUpName) : '';
    const thirdPlaceRoster = thirdPlaceName ? getTeamPlayerNames(thirdPlaceName) : '';

    return `
      <div class="champion-showcase-card" id="championPodiumCard" role="button" tabindex="0" title="Klik untuk Merayakan Kemenangan Juara 1!">
        <div class="trophy-glow-wrap">
          <div class="trophy-glow-ring"></div>
          <div class="trophy-icon">🏆</div>
        </div>
        <span class="champion-tag"><span>👑</span> JUARA 1 TOURNAMENT</span>
        <h2 class="champion-team-title">
          ${championName ? escapeHtml(championName) : '<span style="color:var(--muted-2); font-size:18px;">Belum Ditentukan</span>'}
        </h2>
        <p class="champion-members">
          ${championRoster}
        </p>
        <div class="champion-celebrate-hint">
          <span>🎉</span> Rayakan Kemenangan Juara!
        </div>
      </div>

      <!-- Top 3 Tournament Standings Podium -->
      <div class="podium-rankings-box">
        <div class="podium-rank-header">
          <span>🏅</span> PODIUM HASIL AKHIR
        </div>
        
        <div class="podium-rank-list">
          <!-- Juara 1 -->
          <div class="podium-rank-item rank-gold ${championName ? 'has-winner' : ''}">
            <div class="rank-badge rank-badge-gold">🥇 1st</div>
            <div class="rank-team-info">
              <span class="rank-label">JUARA 1</span>
              <span class="rank-team-name">${championName ? escapeHtml(championName) : 'Menunggu Grand Final'}</span>
              ${championName && getTeamPlayerNames(championName) ? `<span class="rank-roster-text">👥 ${escapeHtml(getTeamPlayerNames(championName))}</span>` : ''}
            </div>
            <span class="rank-status-tag gold" style="color:var(--amber);background:rgba(255,184,77,0.15);border:1px solid rgba(255,184,77,0.35);">Gold</span>
          </div>

          <!-- Juara 2 -->
          <div class="podium-rank-item rank-silver ${runnerUpName ? 'has-winner' : ''}">
            <div class="rank-badge rank-badge-silver">🥈 2nd</div>
            <div class="rank-team-info">
              <span class="rank-label">JUARA 2 (RUNNER-UP)</span>
              <span class="rank-team-name">${runnerUpName ? escapeHtml(runnerUpName) : 'Menunggu Grand Final'}</span>
              ${runnerUpRoster ? `<span class="rank-roster-text">👥 ${escapeHtml(runnerUpRoster)}</span>` : ''}
            </div>
            <span class="rank-status-tag">Silver</span>
          </div>

          <!-- Juara 3 -->
          <div class="podium-rank-item rank-bronze ${thirdPlaceName ? 'has-winner' : ''}" id="podiumBronzeRow">
            <div class="rank-badge rank-badge-bronze">🥉 3rd</div>
            <div class="rank-team-info">
              <span class="rank-label">JUARA 3 (BRONZE)</span>
              <span class="rank-team-name">${thirdPlaceName ? escapeHtml(thirdPlaceName) : 'Menunggu Match Juara 3'}</span>
              ${thirdPlaceRoster ? `<span class="rank-roster-text">👥 ${escapeHtml(thirdPlaceRoster)}</span>` : ''}
            </div>
            <span class="rank-status-tag bronze">Bronze</span>
          </div>
        </div>
      </div>
    `;
  }

  function updateHeaderStats() {
    const activeSize = getActiveBracketSize();
    const config = activeBracketConfig || generateBracketStructure(activeSize);

    const totalMatches = config.matches ? config.matches.length : Object.keys(matchesState).length;
    const completedMatches = Object.values(matchesState).filter((m) => m.status === 'SELESAI').length;
    const liveMatches = Object.values(matchesState).filter((m) => m.status === 'BERLANGSUNG').length;

    const bStatCompleted = document.getElementById('bStatCompleted');
    const bStatLive = document.getElementById('bStatLive');
    const bStatRegistered = document.getElementById('bStatRegistered');
    const bStatFormat = document.getElementById('bStatFormat');
    const seasonTagFormat = document.getElementById('seasonTagFormat');
    const bracketSizeSelect = document.getElementById('bracketSizeSelect');

    if (bStatCompleted) bStatCompleted.textContent = `${completedMatches} / ${totalMatches} Match`;
    if (bStatLive) bStatLive.textContent = `${liveMatches} Pertandingan`;
    if (bStatRegistered) bStatRegistered.textContent = `${participantsList.length} / ${activeSize} Tim`;
    if (bStatFormat) bStatFormat.textContent = config.formatName || `${activeSize} Tim Single Elimination`;
    if (seasonTagFormat) seasonTagFormat.textContent = `${activeSize} TIM SINGLE ELIMINATION`;

    if (bracketSizeSelect && bracketSizeSelect.value !== selectedFormat) {
      bracketSizeSelect.value = selectedFormat;
    }
  }

  // --- SVG CONNECTING LINES DYNAMIC RENDERING ---
  function drawConnectorLines() {
    const svg = document.getElementById('bracketSvg');
    const canvas = document.getElementById('bracketCanvas');
    if (!svg || !canvas || !activeBracketConfig) return;

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

    // 1. Koneksi Jalur Pemenang (Next Match)
    activeBracketConfig.matches.forEach((mDef) => {
      const matchData = matchesState[mDef.id];
      if (!matchData) return;

      const fromEl = document.getElementById(`card-${mDef.id}`);
      if (!fromEl) return;

      // Jalur Pemenang
      if (mDef.next_match_id) {
        let toEl = null;
        let targetSlot = mDef.next_match_slot || 1;

        if (mDef.next_match_id === 'champion') {
          toEl = document.getElementById('championPodiumCard');
        } else {
          toEl = document.getElementById(`card-${mDef.next_match_id}`);
        }

        if (toEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          const startX = (fromRect.right - canvasRect.left) / scale;
          const startY = (fromRect.top + fromRect.height / 2 - canvasRect.top) / scale;

          const endX = (toRect.left - canvasRect.left) / scale;
          const targetOffsetY = (mDef.next_match_id === 'champion')
            ? toRect.height / 2
            : (targetSlot === 1 ? toRect.height * 0.38 : toRect.height * 0.62);
          const endY = (toRect.top + targetOffsetY - canvasRect.top) / scale;

          const deltaX = Math.abs(endX - startX) * 0.55;
          const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', pathD);

          const hasWinner = Boolean(matchData.winner_name);
          if (hasWinner) {
            path.setAttribute('class', 'connector-path active winner-path');
          } else {
            path.setAttribute('class', 'connector-path');
          }

          svg.appendChild(path);
        }
      }

      // Jalur Tim Kalah (Semi Final -> Perebutan Juara 3)
      if (mDef.loser_match_id) {
        const toEl = document.getElementById(`card-${mDef.loser_match_id}`);
        if (toEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          const startX = (fromRect.right - canvasRect.left) / scale;
          const startY = (fromRect.top + fromRect.height / 2 - canvasRect.top) / scale;

          const endX = (toRect.left - canvasRect.left) / scale;
          const targetSlot = mDef.loser_match_slot || 1;
          const targetOffsetY = targetSlot === 1 ? toRect.height * 0.38 : toRect.height * 0.62;
          const endY = (toRect.top + targetOffsetY - canvasRect.top) / scale;

          const deltaX = Math.abs(endX - startX) * 0.55;
          const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', pathD);

          const isSfFinished = Boolean(matchData.winner_name);
          if (isSfFinished) {
            path.setAttribute('class', 'connector-path active');
          } else {
            path.setAttribute('class', 'connector-path');
          }

          svg.appendChild(path);
        }
      }
    });
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

  let modalSelectedWinnerType = 'auto';

  // --- ENGINE VALIDASI & ALOKASI TIM TURNAMEN PADA BRACKET ---

  function isValidRealTeam(name) {
    if (!name) return false;
    const t = String(name).trim();
    if (!t || t.startsWith('[') || t.startsWith('Menunggu') || t.startsWith('KALAH')) {
      return false;
    }
    return true;
  }

  function getBracketAllocationStatus(currentMatchId) {
    const assignedMap = {}; // { 'nama tim': 'Play-In #1' }
    Object.values(matchesState).forEach((m) => {
      if (m.id !== currentMatchId) {
        if (isValidRealTeam(m.team1_name)) {
          assignedMap[m.team1_name.trim().toLowerCase()] = m.title || m.id;
        }
        if (isValidRealTeam(m.team2_name)) {
          assignedMap[m.team2_name.trim().toLowerCase()] = m.title || m.id;
        }
      }
    });

    const availableTeams = [];
    const assignedTeams = [];

    participantsList.forEach((p) => {
      const key = p.teamName ? p.teamName.trim().toLowerCase() : '';
      if (!key) return;
      if (assignedMap[key]) {
        assignedTeams.push({ ...p, assignedMatch: assignedMap[key] });
      } else {
        availableTeams.push(p);
      }
    });

    return { assignedMap, availableTeams, assignedTeams };
  }

  function openEditModal(matchId) {
    activeEditingMatchId = matchId;
    const match = matchesState[matchId];
    if (!match) return;

    if (modalMatchTitle) modalMatchTitle.textContent = `Edit Skor: ${match.title}`;
    if (modalMatchSubtitle) modalMatchSubtitle.textContent = `Babak: ${(match.round || '').toUpperCase()} • Kelola tim & skor`;

    const { assignedMap } = getBracketAllocationStatus(matchId);

    // Isi Dropdown Tim dengan pengelompokan Tim Tersedia vs Sudah di Bracket
    populateTeamDropdown(editTeam1Select, match.team1_name, assignedMap);
    populateTeamDropdown(editTeam2Select, match.team2_name, assignedMap);

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

    // Render chips status alokasi tim
    updateModalAllocationUI(matchId);

    if (editModal) editModal.classList.add('open');
  }

  function populateTeamDropdown(selectEl, currentTeamName, assignedMap = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Pilih Tim / Peserta --';
    selectEl.appendChild(defaultOpt);

    const availableGroup = document.createElement('optgroup');
    availableGroup.label = '🟢 TIM TERSEDIA (BELUM MASUK BRACKET)';

    const assignedGroup = document.createElement('optgroup');
    assignedGroup.label = '⚠️ TIM SUDAH MASUK BRACKET (MATCH LAIN)';

    let hasAvailable = false;
    let hasAssigned = false;

    participantsList.forEach((p) => {
      const key = p.teamName ? p.teamName.trim().toLowerCase() : '';
      const isAssignedElsewhere = assignedMap[key] && (!currentTeamName || p.teamName.trim().toLowerCase() !== currentTeamName.trim().toLowerCase());
      const rosterInfo = p.playerNames && p.playerNames !== '-' ? ` (${p.playerNames})` : '';

      const opt = document.createElement('option');
      opt.value = p.teamName;

      if (p.teamName === currentTeamName) {
        opt.selected = true;
      }

      if (isAssignedElsewhere) {
        opt.textContent = `⚠️ ${p.teamName}${rosterInfo} — [Sudah di ${assignedMap[key]}]`;
        assignedGroup.appendChild(opt);
        hasAssigned = true;
      } else {
        opt.textContent = `${p.teamName}${rosterInfo}`;
        availableGroup.appendChild(opt);
        hasAvailable = true;
      }
    });

    if (hasAvailable) {
      selectEl.appendChild(availableGroup);
    }
    if (hasAssigned) {
      selectEl.appendChild(assignedGroup);
    }

    if (currentTeamName && isValidRealTeam(currentTeamName) && !participantsList.some((p) => p.teamName === currentTeamName)) {
      const customOpt = document.createElement('option');
      customOpt.value = currentTeamName;
      customOpt.textContent = currentTeamName;
      customOpt.selected = true;
      selectEl.appendChild(customOpt);
    }
  }

  function updateModalAllocationUI(matchId) {
    const countBadge = document.getElementById('allocationCountBadge');
    const chipsWrap = document.getElementById('allocationChipsWrap');

    if (!chipsWrap) return;

    const { assignedMap, availableTeams } = getBracketAllocationStatus(matchId);
    const currentMatch = matchesState[matchId];

    if (countBadge) {
      if (availableTeams.length > 0) {
        countBadge.textContent = `${availableTeams.length} Tim Belum Masuk Bracket`;
        countBadge.classList.remove('all-assigned');
      } else {
        countBadge.textContent = `Semua Tim Telah Masuk Bracket`;
        countBadge.classList.add('all-assigned');
      }
    }

    chipsWrap.innerHTML = '';

    if (participantsList.length === 0) {
      chipsWrap.innerHTML = '<span style="font-size:11px; color:var(--muted);">Belum ada peserta terdaftar.</span>';
      return;
    }

    participantsList.forEach((p) => {
      const key = p.teamName ? p.teamName.trim().toLowerCase() : '';
      const isCurrentTeam1 = currentMatch && currentMatch.team1_name === p.teamName;
      const isCurrentTeam2 = currentMatch && currentMatch.team2_name === p.teamName;
      const isCurrentMatch = isCurrentTeam1 || isCurrentTeam2;
      const assignedMatchTitle = assignedMap[key];

      const chip = document.createElement('span');
      chip.className = 'allocation-chip';

      if (isCurrentMatch) {
        chip.classList.add('current-match');
        chip.innerHTML = `<span>⚔️</span> <b>${escapeHtml(p.teamName)}</b> <small style="opacity:0.75;">(Match Ini)</small>`;
        chip.title = `Tim ini sedang dipasang di pertandingan ini`;
      } else if (assignedMatchTitle) {
        chip.classList.add('assigned');
        chip.innerHTML = `<span>⚠️</span> ${escapeHtml(p.teamName)} <small style="opacity:0.75;">(${escapeHtml(assignedMatchTitle)})</small>`;
        chip.title = `Sudah dipasang di ${assignedMatchTitle}. Klik untuk memasang ke match ini (memindahkan tim).`;
        chip.addEventListener('click', () => {
          assignTeamToCurrentModal(p.teamName);
        });
      } else {
        chip.classList.add('available');
        chip.innerHTML = `<span>🟢</span> <b>${escapeHtml(p.teamName)}</b> <small style="color:var(--cyan); font-weight:600;">+ Pasang</small>`;
        chip.title = `Belum masuk bracket. Klik untuk memasang ke pertandingan ini!`;
        chip.addEventListener('click', () => {
          assignTeamToCurrentModal(p.teamName);
        });
      }

      chipsWrap.appendChild(chip);
    });

    validateModalTeamSelection();
  }

  function assignTeamToCurrentModal(teamName) {
    if (!editTeam1Select || !editTeam2Select) return;

    if (!editTeam1Select.value || !isValidRealTeam(editTeam1Select.value)) {
      editTeam1Select.value = teamName;
      if (btnWinTeam1) btnWinTeam1.textContent = `🏆 ${teamName}`;
    } else if (!editTeam2Select.value || !isValidRealTeam(editTeam2Select.value)) {
      editTeam2Select.value = teamName;
      if (btnWinTeam2) btnWinTeam2.textContent = `🏆 ${teamName}`;
    } else {
      if (editTeam1Select.value !== teamName) {
        editTeam2Select.value = teamName;
        if (btnWinTeam2) btnWinTeam2.textContent = `🏆 ${teamName}`;
      } else {
        editTeam1Select.value = teamName;
        if (btnWinTeam1) btnWinTeam1.textContent = `🏆 ${teamName}`;
      }
    }

    validateModalTeamSelection();
  }

  function validateModalTeamSelection() {
    const warningMsg = document.getElementById('allocationWarningMsg');
    const btnSave = document.getElementById('btnSaveMatchEdit');
    if (!warningMsg) return true;

    const t1 = editTeam1Select ? editTeam1Select.value.trim() : '';
    const t2 = editTeam2Select ? editTeam2Select.value.trim() : '';

    if (t1 && t2 && t1.toLowerCase() === t2.toLowerCase() && isValidRealTeam(t1)) {
      warningMsg.innerHTML = `⚠️ <b>Validasi Gagal:</b> Tim 1 dan Tim 2 tidak boleh memilih tim yang sama (<b>${escapeHtml(t1)}</b>). Silakan pilih dua tim yang berbeda!`;
      warningMsg.style.display = 'block';
      warningMsg.style.background = 'rgba(255, 92, 138, 0.15)';
      warningMsg.style.borderColor = 'rgba(255, 92, 138, 0.4)';
      warningMsg.style.color = '#ff94b8';
      if (btnSave) btnSave.disabled = true;
      return false;
    }

    const { assignedMap } = getBracketAllocationStatus(activeEditingMatchId);
    const warnings = [];

    if (t1 && assignedMap[t1.toLowerCase()]) {
      warnings.push(`Tim 1 (<b>${escapeHtml(t1)}</b>) saat ini terdaftar di ${escapeHtml(assignedMap[t1.toLowerCase()])}`);
    }
    if (t2 && assignedMap[t2.toLowerCase()]) {
      warnings.push(`Tim 2 (<b>${escapeHtml(t2)}</b>) saat ini terdaftar di ${escapeHtml(assignedMap[t2.toLowerCase()])}`);
    }

    if (warnings.length > 0) {
      warningMsg.innerHTML = `ℹ️ <b>Info Pemindahan:</b> ${warnings.join(' & ')}. Tim akan dialokasikan ke match ini saat disimpan.`;
      warningMsg.style.display = 'block';
      warningMsg.style.background = 'rgba(155, 107, 255, 0.12)';
      warningMsg.style.borderColor = 'rgba(155, 107, 255, 0.35)';
      warningMsg.style.color = '#d8b4fe';
      if (btnSave) btnSave.disabled = false;
      return true;
    }

    warningMsg.style.display = 'none';
    if (btnSave) btnSave.disabled = false;
    return true;
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

  // Update dinamis tombol pilihan pemenang & validasi saat dropdown tim diganti
  if (editTeam1Select) {
    editTeam1Select.addEventListener('change', () => {
      const val = editTeam1Select.value;
      if (btnWinTeam1) btnWinTeam1.textContent = `🏆 ${val || 'Tim 1'}`;
      validateModalTeamSelection();
    });
  }
  if (editTeam2Select) {
    editTeam2Select.addEventListener('change', () => {
      const val = editTeam2Select.value;
      if (btnWinTeam2) btnWinTeam2.textContent = `🏆 ${val || 'Tim 2'}`;
      validateModalTeamSelection();
    });
  }

  // Simpan Perubahan Modal
  if (btnSaveMatchEdit) {
    btnSaveMatchEdit.addEventListener('click', async () => {
      if (!activeEditingMatchId) return;
      const match = matchesState[activeEditingMatchId];
      if (!match) return;

      const valid = validateModalTeamSelection();
      if (!valid) {
        showToast('⚠️ Gagal menyimpan: Tim 1 dan Tim 2 tidak boleh sama!');
        return;
      }

      const score1 = Math.max(0, parseInt(editScore1Input ? editScore1Input.value : 0) || 0);
      const score2 = Math.max(0, parseInt(editScore2Input ? editScore2Input.value : 0) || 0);
      const status = editMatchStatus ? editMatchStatus.value : 'SELESAI';

      const team1Name = editTeam1Select ? editTeam1Select.value : match.team1_name;
      const team2Name = editTeam2Select ? editTeam2Select.value : match.team2_name;

      match.team1_name = team1Name || match.team1_name;
      match.team2_name = team2Name || match.team2_name;
      match.score1 = score1;
      match.score2 = score2;
      match.status = status;

      const p1 = participantsList.find((p) => p.teamName === match.team1_name);
      if (p1) match.team1_id = p1.id;
      const p2 = participantsList.find((p) => p.teamName === match.team2_name);
      if (p2) match.team2_id = p2.id;

      if (modalSelectedWinnerType === 'auto') {
        if (score1 > score2) {
          resolveMatchWinner(activeEditingMatchId, 'team1');
        } else if (score2 > score1) {
          resolveMatchWinner(activeEditingMatchId, 'team2');
        } else {
          resolveMatchWinner(activeEditingMatchId, 'none');
        }
      } else {
        resolveMatchWinner(activeEditingMatchId, modalSelectedWinnerType);
      }

      closeEditModal();
      showToast(`✅ Skor pertandingan ${match.title} berhasil diperbarui!`);

      if (activeEditingMatchId === 'final' && matchesState['final']?.winner_name) {
        setTimeout(() => {
          openChampionCelebration(true);
        }, 500);
      } else if (activeEditingMatchId === 'bronze' && matchesState['bronze']?.winner_name) {
        showToast(`🥉 Selamat kepada ${matchesState['bronze'].winner_name} sebagai Juara 3 Turnamen!`);
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
    gameId: ''
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

      if (celebrationTeamTitle) celebrationTeamTitle.textContent = championName.toUpperCase();
      if (celebrationLineupNames) celebrationLineupNames.innerHTML = `Lineup: <b>${escapeHtml(currentChampionData.lineup)}</b>`;
      if (celebrationStatusBadge) celebrationStatusBadge.innerHTML = `🔥 Status: <b>Grand Champion</b>`;
      if (celebrationPrizeVal) celebrationPrizeVal.textContent = '';
    } else {
      // Demo / Preview Mode jika belum ada juara
      currentChampionData.teamName = 'WOWOK LOVE TEDDY';
      currentChampionData.lineup = 'whisper (C), kayi';
      currentChampionData.discord = 'whisper#1337';
      currentChampionData.gameId = 'WhisperGod, KayiChan';

      if (celebrationTeamTitle) celebrationTeamTitle.textContent = 'WOWOK LOVE TEDDY';
      if (celebrationLineupNames) celebrationLineupNames.innerHTML = `Lineup: <b>whisper (C), kayi</b> (Simulasi Juara)`;
      if (celebrationStatusBadge) celebrationStatusBadge.innerHTML = `🔥 Status: <b>Simulasi Juara Turnamen</b>`;
      if (celebrationPrizeVal) celebrationPrizeVal.textContent = '';
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
      const shareText = `🏆 JUARA 1 TURNAMEN SAMBUNG KATA 2 VS 2 — YABI DEV 🏆\n\n👑 Tim Pemenang: ${currentChampionData.teamName}\n👥 Lineup: ${currentChampionData.lineup}\n⚡ Turnamen: Roblox Sambung Kata Komunitas Yabi Dev\n\nSelamat kepada para pemenang turnamen! 🎉🔥`;

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

  // --- ACTIONS, SELECTOR & TOAST ---
  const bracketSizeSelect = document.getElementById('bracketSizeSelect');
  const btnSyncParticipants = document.getElementById('btnSyncParticipants');
  const btnResetBracket = document.getElementById('btnResetBracket');
  const btnDownloadBracketImg = document.getElementById('btnDownloadBracketImg');

  // --- EXPORT BRACKET TO ULTRA HD IMAGE (PNG) ---
  async function exportBracketAsHDImage() {
    const btn = document.getElementById('btnDownloadBracketImg');
    const originalHtml = btn ? btn.innerHTML : '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Merender HD...';
    }

    showToast('📸 Sedang merender bagan bracket dalam resolusi Ultra HD...');

    try {
      // 1. Pastikan html2canvas dimuat
      if (typeof html2canvas === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Gagal memuat library pembuat gambar (html2canvas).'));
          document.head.appendChild(script);
        });
      }

      const sourceCanvas = document.getElementById('bracketCanvas');
      if (!sourceCanvas) throw new Error('Elemen bagan bracket tidak ditemukan.');

      // Simpan level zoom saat ini dan reset sementara ke 1 (100%) agar kalkulasi SVG tepat
      const prevZoom = currentZoom;
      currentZoom = 1;
      if (bracketCanvas) bracketCanvas.style.transform = 'scale(1)';
      if (zoomBadge) zoomBadge.textContent = '100%';
      drawConnectorLines();

      // Beri jeda 150ms agar rendering SVG lines stabil
      await new Promise((r) => setTimeout(r, 150));

      // 2. Buat container poster turnamen profesional
      const poster = document.createElement('div');
      poster.style.position = 'fixed';
      poster.style.top = '-99999px';
      poster.style.left = '-99999px';
      poster.style.zIndex = '-9999';
      poster.style.background = 'radial-gradient(ellipse at 50% 0%, #171233 0%, #080614 100%)';
      poster.style.padding = '44px 50px';
      poster.style.borderRadius = '24px';
      poster.style.boxSizing = 'border-box';
      poster.style.fontFamily = "'Inter', sans-serif";
      poster.style.color = '#fff';
      poster.style.display = 'inline-block';
      poster.style.minWidth = 'max-content';

      // Header Poster
      const activeSize = getActiveBracketSize();
      const formatTitle = activeBracketConfig ? activeBracketConfig.formatName : `${activeSize} Tim Single Elimination`;
      const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      let completedCount = 0;
      let totalMatches = activeBracketConfig ? activeBracketConfig.matches.length : 0;
      Object.values(matchesState).forEach((m) => {
        if (m.status === 'SELESAI' || m.winner_name) completedCount++;
      });

      const headerBox = document.createElement('div');
      headerBox.style.display = 'flex';
      headerBox.style.alignItems = 'center';
      headerBox.style.justifyContent = 'space-between';
      headerBox.style.borderBottom = '1px solid rgba(255, 255, 255, 0.12)';
      headerBox.style.paddingBottom = '22px';
      headerBox.style.marginBottom = '32px';
      headerBox.style.gap = '30px';

      headerBox.innerHTML = `
        <div>
          <div style="font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:800; letter-spacing:2px; color:#45e8d4; margin-bottom:6px; text-transform:uppercase;">
            🎮 YABI DEV ESPORTS TOURNAMENT
          </div>
          <div style="font-family:'Space Grotesk',sans-serif; font-size:26px; font-weight:800; color:#fff; line-height:1.2; letter-spacing:-0.5px;">
            BAGAN TURNAMEN SAMBUNG KATA 2 VS 2
          </div>
          <div style="font-size:13px; color:#94a3b8; margin-top:6px;">
            Format: <b style="color:#e2e8f0;">${escapeHtml(formatTitle)}</b> • Tanggal: <b>${escapeHtml(dateStr)}</b> • Status: <b style="color:#45e8d4;">${completedCount}/${totalMatches} Match Selesai</b>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block; padding:6px 14px; border-radius:8px; background:rgba(69, 232, 212, 0.12); border:1px solid rgba(69, 232, 212, 0.35); font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; color:#45e8d4;">
            OFFICIAL BRACKET
          </div>
          <div style="font-size:11px; color:#64748b; margin-top:6px; font-family:'JetBrains Mono',monospace;">
            yabi.dev/bracket.html
          </div>
        </div>
      `;
      poster.appendChild(headerBox);

      // Klon Konten Bracket Canvas
      const clone = sourceCanvas.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.margin = '0 auto';
      clone.style.position = 'relative';

      // Pastikan SVG garis terklon dengan sempurna
      const origSvg = sourceCanvas.querySelector('#bracketSvg');
      const cloneSvg = clone.querySelector('#bracketSvg');
      if (origSvg && cloneSvg) {
        cloneSvg.innerHTML = origSvg.innerHTML;
        cloneSvg.style.width = '100%';
        cloneSvg.style.height = '100%';
      }

      poster.appendChild(clone);

      // Footer Poster
      const footerBox = document.createElement('div');
      footerBox.style.display = 'flex';
      footerBox.style.alignItems = 'center';
      footerBox.style.justifyContent = 'space-between';
      footerBox.style.borderTop = '1px solid rgba(255, 255, 255, 0.08)';
      footerBox.style.paddingTop = '20px';
      footerBox.style.marginTop = '32px';
      footerBox.style.fontSize = '12px';
      footerBox.style.color = '#64748b';

      footerBox.innerHTML = `
        <div>Diselenggarakan secara resmi oleh <b>Komunitas Yabi Dev</b> • Single Elimination System</div>
        <div>Generated at ${new Date().toLocaleTimeString('id-ID')} • Official Website: yabi.dev</div>
      `;
      poster.appendChild(footerBox);

      document.body.appendChild(poster);

      // Render menggunakan html2canvas (Skala 2.5x untuk resolusi Ultra HD jernih saat di-zoom/share)
      const renderedCanvas = await html2canvas(poster, {
        scale: 2.5,
        backgroundColor: '#080614',
        useCORS: true,
        logging: false,
        allowTaint: true
      });

      // Hapus elemen clone sementara
      document.body.removeChild(poster);

      // Kembalikan zoom asli
      currentZoom = prevZoom;
      if (bracketCanvas) bracketCanvas.style.transform = `scale(${currentZoom})`;
      if (zoomBadge) zoomBadge.textContent = `${Math.round(currentZoom * 100)}%`;
      drawConnectorLines();

      // Download file PNG
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const filename = `bracket-turnamen-sambung-kata-${timestamp}.png`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = renderedCanvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('🎉 Bagan Bracket Ultra HD berhasil di-download!');
    } catch (err) {
      console.error('Error saat download bagan HD:', err);
      showToast('⚠️ Gagal membuat gambar: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  }

  if (btnDownloadBracketImg) {
    btnDownloadBracketImg.addEventListener('click', exportBracketAsHDImage);
  }

  if (bracketSizeSelect) {
    bracketSizeSelect.value = selectedFormat;
    bracketSizeSelect.addEventListener('change', async () => {
      selectedFormat = bracketSizeSelect.value;
      try {
        localStorage.setItem(STORAGE_FORMAT_KEY, selectedFormat);
      } catch (e) {}

      const activeSize = getActiveBracketSize();
      activeBracketConfig = generateBracketStructure(activeSize);
      initializeDynamicMatches(activeBracketConfig, false);
      renderBracket();

      const formatLabel = bracketSizeSelect.options[bracketSizeSelect.selectedIndex]?.text || `${activeSize} Tim`;
      showToast(`⚡ Format bracket diubah ke: ${formatLabel}`);
    });
  }

  if (btnSyncParticipants) {
    btnSyncParticipants.addEventListener('click', async () => {
      btnSyncParticipants.disabled = true;
      btnSyncParticipants.innerHTML = '<span>⏳</span> Memuat Peserta...';

      try {
        await loadParticipants();
        const activeSize = getActiveBracketSize();
        activeBracketConfig = generateBracketStructure(activeSize);
        initializeDynamicMatches(activeBracketConfig, true);
        renderBracket();
        showToast(`🔄 Bracket berhasil disinkronkan (${participantsList.length} tim terdaftar)!`);
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
      const confirmReset = confirm('⚠️ Apakah Anda yakin ingin mereset seluruh skor dan pertandingan bracket ke posisi awal?');
      if (confirmReset) {
        try {
          matchesState = {};
          try {
            localStorage.removeItem(STORAGE_MATCHES_KEY);
          } catch (e) {}
          const activeSize = getActiveBracketSize();
          activeBracketConfig = generateBracketStructure(activeSize);
          initializeDynamicMatches(activeBracketConfig, true);
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

  // Realtime update listener dengan debouncing untuk mencegah request storm
  let realtimeMatchesTimer = null;
  let isFetchingMatches = false;

  async function handleRealtimeMatchesUpdate() {
    if (isFetchingMatches) return;
    if (realtimeMatchesTimer) clearTimeout(realtimeMatchesTimer);

    realtimeMatchesTimer = setTimeout(async () => {
      try {
        isFetchingMatches = true;
        console.log('⚡ Realtime update: Sinkronisasi data pertandingan dari Supabase...');
        await loadBracketMatches();
        renderBracket();
      } catch (err) {
        console.error('Error saat menangani realtime matches update:', err);
      } finally {
        isFetchingMatches = false;
      }
    }, 300);
  }

  let realtimeParticipantsTimer = null;
  let isFetchingParticipants = false;

  async function handleRealtimeParticipantsUpdate() {
    if (isFetchingParticipants) return;
    if (realtimeParticipantsTimer) clearTimeout(realtimeParticipantsTimer);

    realtimeParticipantsTimer = setTimeout(async () => {
      try {
        isFetchingParticipants = true;
        console.log('⚡ Realtime update: Sinkronisasi peserta dari Supabase...');
        await loadParticipants();
        const activeSize = getActiveBracketSize();
        activeBracketConfig = generateBracketStructure(activeSize);
        initializeDynamicMatches(activeBracketConfig, false);
        renderBracket();
      } catch (err) {
        console.error('Error saat menangani realtime participants update:', err);
      } finally {
        isFetchingParticipants = false;
      }
    }, 300);
  }

  if (supabaseClient) {
    try {
      supabaseClient
        .channel('public:tournament_matches')
        .on('postgres_changes', { event: '*', schema: 'public', table: MATCHES_TABLE }, () => {
          handleRealtimeMatchesUpdate();
        })
        .subscribe();

      supabaseClient
        .channel('public:tournament_registrations')
        .on('postgres_changes', { event: '*', schema: 'public', table: PARTICIPANTS_TABLE }, () => {
          handleRealtimeParticipantsUpdate();
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
