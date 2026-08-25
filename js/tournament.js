/**
 * TOURNAMENT MODULE LOGIC - YABIDEV & SUPABASE
 * Mengelola tab switcher, pendaftaran peserta terintegrasi Supabase,
 * realtime listener, live search filter, slot limiter (Max 8 Tim), dan feedback modal.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- KONFIGURASI SUPABASE & TURNAMEN ---
  const MAX_SLOTS = 8; // Batas maksimal tim turnamen
  const SUPABASE_PROJECT_URL = 'https://jvhdbzxhmhqmsgjvsylp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_WQnVqx7Oai2ScoW18pZxow_ThBNl9-4';
  const TABLE_NAME = 'tournament_registrations';
  const STORAGE_KEY = 'yabidev_tournament_data_v1';

  // Inisialisasi Supabase Client jika SDK CDN tersedia
  let supabaseClient = null;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);
      console.log('⚡ Supabase Client initialized successfully');
    } catch (err) {
      console.warn('⚠️ Gagal inisialisasi Supabase, fallback ke LocalStorage:', err);
    }
  }

  // Mock data cadangan jika tabel Supabase belum dibuat atau koneksi offline
  const defaultFallbackParticipants = [
    {
      id: 'team-1',
      slot: '#01',
      teamName: 'CYBER VIPERS',
      playerNames: 'Satria "Viper" (C), Vanya',
      gameId: 'ViperX#ID1, Vanya77',
      discordTag: 'viper_satria#1337',
      suggestions: 'Semoga turnamennya diadakan rutin tiap bulan dan ada live streaming dengan caster!',
      registeredAt: '18 Agu 2026, 14:20',
      status: 'Terverifikasi'
    },
    {
      id: 'team-2',
      slot: '#02',
      teamName: 'NEON PROTOCOL',
      playerNames: 'Farhan (C), Brian',
      gameId: 'NeonBlade#889, Briann',
      discordTag: 'farhan_neon',
      suggestions: 'Mungkin bisa ditambah sesi fun match antar penonton streaming bang Yabi.',
      registeredAt: '19 Agu 2026, 19:45',
      status: 'Terverifikasi'
    },
    {
      id: 'team-3',
      slot: '#03',
      teamName: 'SHADOW APEX',
      playerNames: 'Aldo "Apex" (C), Cindy',
      gameId: 'ShadowRey#991, CindyX',
      discordTag: 'aldo_apex#5501',
      suggestions: 'Keren banget web portofolio dan sistem daftarnya! Good luck bang Yabi.',
      registeredAt: '20 Agu 2026, 10:15',
      status: 'Terverifikasi'
    }
  ];

  // In-memory cache peserta yang sedang ditampilkan
  let currentParticipantsList = [];

  // Format tanggal rapi
  function formatTimestamp(isoOrDateStr) {
    if (!isoOrDateStr) {
      return new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return isoOrDateStr;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // --- Data Access Layer ---

  // Ambil list peserta dari Supabase atau LocalStorage
  async function fetchParticipants() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          // Format data dari kolom Supabase ke bentuk objek tampilan
          return data.map((item, index) => ({
            id: String(item.id),
            slot: `#${String(data.length - index).padStart(2, '0')}`,
            teamName: item.team_name || 'Tim Tanpa Nama',
            playerNames: item.player_names || '-',
            gameId: item.game_id || '-',
            discordTag: item.discord_tag || '-',
            suggestions: item.suggestions || 'Tidak ada catatan khusus.',
            registeredAt: formatTimestamp(item.created_at),
            status: item.status || 'Terverifikasi'
          }));
        } else {
          console.info('Supabase query note (mungkin tabel belum dibuat):', error?.message);
        }
      } catch (err) {
        console.warn('Gagal koneksi ke Supabase, membaca dari LocalStorage:', err);
      }
    }

    // Fallback LocalStorage
    try {
      const localStored = localStorage.getItem(STORAGE_KEY);
      if (localStored) {
        return JSON.parse(localStored);
      }
    } catch (e) {}

    return defaultFallbackParticipants;
  }

  // Simpan pendaftaran ke Supabase
  async function submitTournamentRegistration(formData) {
    let savedEntry = null;

    if (supabaseClient) {
      try {
        const payload = {
          team_name: formData.teamName.trim(),
          player_names: formData.playerNames.trim(),
          game_id: formData.gameId.trim(),
          discord_tag: formData.discordTag.trim(),
          suggestions: formData.suggestions.trim() || null,
          status: 'Terverifikasi'
        };

        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .insert([payload])
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        if (data && data.length > 0) {
          const item = data[0];
          savedEntry = {
            id: String(item.id),
            slot: `#${String(currentParticipantsList.length + 1).padStart(2, '0')}`,
            teamName: item.team_name,
            playerNames: item.player_names,
            gameId: item.game_id,
            discordTag: item.discord_tag,
            suggestions: item.suggestions || 'Tidak ada catatan khusus.',
            registeredAt: formatTimestamp(item.created_at),
            status: item.status || 'Terverifikasi'
          };
        }
      } catch (err) {
        console.warn('Gagal insert ke Supabase, beralih simpan lokal:', err);
      }
    }

    // Fallback jika Supabase belum ada tabelnya
    if (!savedEntry) {
      const nextSlotNumber = String(currentParticipantsList.length + 1).padStart(2, '0');
      savedEntry = {
        id: 'team-' + Date.now(),
        slot: `#${nextSlotNumber}`,
        teamName: formData.teamName.trim(),
        playerNames: formData.playerNames.trim(),
        gameId: formData.gameId.trim(),
        discordTag: formData.discordTag.trim(),
        suggestions: formData.suggestions.trim() || 'Tidak ada catatan khusus.',
        registeredAt: formatTimestamp(new Date()),
        status: 'Terverifikasi'
      };

      currentParticipantsList.unshift(savedEntry);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentParticipantsList));
      } catch (e) {}
    }

    return savedEntry;
  }

  // --- Realtime Subscription (Opsional otomatis sync saat ada tim baru) ---
  if (supabaseClient) {
    try {
      supabaseClient
        .channel('public:tournament_registrations')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: TABLE_NAME },
          () => {
            console.log('⚡ Realtime update: Tim baru terdeteksi di Supabase!');
            refreshAndRender();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime channel error:', e);
    }
  }

  // --- DOM Elements ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const tabBadgeCount = document.getElementById('tabBadgeCount');
  const heroRegisteredCount = document.getElementById('heroRegisteredCount');
  const heroRemainingSlots = document.getElementById('heroRemainingSlots');
  const tourneyStatusBadge = document.getElementById('tourneyStatusBadge');

  const registrationForm = document.getElementById('tournamentForm');
  const submitBtn = document.getElementById('regSubmitBtn');
  const slotFullBanner = document.getElementById('slotFullBanner');
  const btnViewFullParticipants = document.getElementById('btnViewFullParticipants');
  const regSlotCountText = document.getElementById('regSlotCountText');
  const regHeaderDesc = document.getElementById('regHeaderDesc');
  const formInputs = registrationForm ? registrationForm.querySelectorAll('input, textarea') : [];

  const teamsGrid = document.getElementById('teamsGrid');
  const searchInput = document.getElementById('participantSearch');
  const searchCountLabel = document.getElementById('searchCountLabel');

  const successModal = document.getElementById('successModal');
  const modalCloseBtn = document.getElementById('modalSuccessClose');
  const modalViewListBtn = document.getElementById('modalViewListBtn');
  const modalTeamName = document.getElementById('modalSummaryTeam');
  const modalSlot = document.getElementById('modalSummarySlot');
  const modalDiscord = document.getElementById('modalSummaryDiscord');

  // --- Tab Switcher ---
  function switchTab(targetTabId) {
    tabBtns.forEach((btn) => {
      if (btn.dataset.target === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabContents.forEach((tab) => {
      if (tab.id === targetTabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    if (history.replaceState) {
      history.replaceState(null, null, `#${targetTabId}`);
    }
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.target);
    });
  });

  if (btnViewFullParticipants) {
    btnViewFullParticipants.addEventListener('click', () => {
      switchTab('tab-participants');
      const container = document.getElementById('tab-participants');
      if (container) {
        container.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Handle URL hash awal
  if (window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'tab-participants' || hash === 'peserta') {
      switchTab('tab-participants');
    } else if (hash === 'tab-register' || hash === 'daftar') {
      switchTab('tab-register');
    }
  }

  // --- Render UI Cards & Update Status Limit ---
  function renderCards(list, filterKeyword = '') {
    const totalSlots = MAX_SLOTS;
    const registeredTotal = list.length;
    const remainingSlots = Math.max(0, totalSlots - registeredTotal);
    const isFull = registeredTotal >= totalSlots;

    // 1. Update counters di Hero & Nav
    if (tabBadgeCount) tabBadgeCount.textContent = `${registeredTotal}/${totalSlots}`;
    if (heroRegisteredCount) heroRegisteredCount.textContent = `${registeredTotal} / ${totalSlots}`;
    
    if (heroRemainingSlots) {
      if (isFull) {
        heroRemainingSlots.innerHTML = `<span style="color:var(--pink); font-weight:700;">0 (Penuh)</span>`;
      } else {
        heroRemainingSlots.textContent = `${remainingSlots} Slot`;
      }
    }

    // 2. Update Badge Status Turnamen (Buka / Penuh)
    if (tourneyStatusBadge) {
      if (isFull) {
        tourneyStatusBadge.className = 'status-badge-closed';
        tourneyStatusBadge.innerHTML = `<span class="status-dot-closed"></span> REGISTRASI DITUTUP (SLOT PENUH)`;
      } else {
        tourneyStatusBadge.className = 'status-badge-open';
        tourneyStatusBadge.innerHTML = `<span class="status-dot-pulse"></span> REGISTRASI DIBUKA`;
      }
    }

    // 3. Update Banner Informasi Slot Penuh di Formulir
    if (slotFullBanner) {
      slotFullBanner.style.display = isFull ? 'flex' : 'none';
    }

    if (regSlotCountText) {
      regSlotCountText.innerHTML = `${registeredTotal} / ${totalSlots} Tim ${isFull ? '<span style="color:var(--pink);">(PENUH)</span>' : ''}`;
    }

    if (regHeaderDesc) {
      if (isFull) {
        regHeaderDesc.innerHTML = `<span style="color:#ff85a1; font-weight:600;">⚠️ Pendaftaran telah ditutup karena kuota maksimal ${totalSlots} tim sudah terpenuhi.</span>`;
      } else {
        regHeaderDesc.textContent = 'Silakan isi data tim dan kontak Anda secara lengkap. Tim harus beranggotakan 1 Laki-laki dan 1 Perempuan.';
      }
    }

    // 4. Update Form Inputs & Submit Button Disabled State
    formInputs.forEach((input) => {
      input.disabled = isFull;
    });

    if (submitBtn) {
      if (isFull) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-slot-full');
        submitBtn.innerHTML = `<span>🔒</span> Pendaftaran Ditutup (Slot Penuh ${registeredTotal}/${totalSlots})`;
      } else {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-slot-full');
        submitBtn.innerHTML = `<span>🚀</span> Submit & Daftar Turnamen Sekarang`;
      }
    }

    if (!teamsGrid) return;

    const filtered = list.filter((p) => {
      const q = filterKeyword.toLowerCase().trim();
      if (!q) return true;
      return (
        p.teamName.toLowerCase().includes(q) ||
        p.playerNames.toLowerCase().includes(q) ||
        p.gameId.toLowerCase().includes(q) ||
        p.discordTag.toLowerCase().includes(q)
      );
    });

    if (searchCountLabel) {
      searchCountLabel.innerHTML = `Menampilkan <b>${filtered.length}</b> dari <b>${registeredTotal}</b> tim terdaftar (Maks. ${totalSlots})`;
    }

    if (filtered.length === 0) {
      teamsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Tidak ada tim yang cocok</div>
          <div class="empty-desc">Coba gunakan kata kunci pencarian lain atau daftarkan tim baru Anda sekarang.</div>
        </div>
      `;
      return;
    }

    teamsGrid.innerHTML = filtered
      .map(
        (team) => `
      <article class="team-card" id="${team.id}">
        <div>
          <div class="team-card-top">
            <span class="team-slot-badge">SLOT ${escapeHtml(team.slot)}</span>
            <span class="team-status-verified">● ${escapeHtml(team.status)}</span>
          </div>
          <h3 class="team-name">${escapeHtml(team.teamName)}</h3>
        </div>

        <div class="team-info-list">
          <div class="team-info-row">
            <span class="team-info-label">👤 Lineup Peserta</span>
            <span class="team-info-val" title="${escapeHtml(team.playerNames)}">${escapeHtml(team.playerNames)}</span>
          </div>
          <div class="team-info-row">
            <span class="team-info-label">🎮 In-Game ID</span>
            <span class="team-info-val game-id">${escapeHtml(team.gameId)}</span>
          </div>
          <div class="team-info-row">
            <span class="team-info-label">💬 Discord</span>
            <span class="team-info-val discord">${escapeHtml(team.discordTag)}</span>
          </div>
        </div>

        ${
          team.suggestions && team.suggestions !== 'Tidak ada catatan khusus.'
            ? `
          <div class="team-saran-box">
            <span class="team-saran-title">💡 Pesan / Saran</span>
            "${escapeHtml(team.suggestions)}"
          </div>
        `
            : ''
        }

        <div class="team-card-foot">
          <span>🕒 Terdaftar: ${escapeHtml(team.registeredAt)}</span>
          <span class="mono" style="color:var(--cyan);">MATCH READY</span>
        </div>
      </article>
    `
      )
      .join('');
  }

  async function refreshAndRender() {
    currentParticipantsList = await fetchParticipants();
    renderCards(currentParticipantsList, searchInput ? searchInput.value : '');
  }

  // --- Form Submission Handling ---
  if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Guard jika slot sudah penuh
      if (currentParticipantsList.length >= MAX_SLOTS) {
        alert(`Mohon maaf, kuota pendaftaran turnamen telah penuh (Maksimal ${MAX_SLOTS} tim). Pendaftaran telah ditutup.`);
        return;
      }

      const teamName = document.getElementById('teamName')?.value || '';
      const playerNames = document.getElementById('playerNames')?.value || '';
      const gameId = document.getElementById('gameId')?.value || '';
      const discordTag = document.getElementById('discordTag')?.value || '';
      const suggestions = document.getElementById('suggestions')?.value || '';

      if (!teamName.trim() || !playerNames.trim() || !gameId.trim() || !discordTag.trim()) {
        alert('Mohon lengkapi semua kolom bertanda bintang (*) sebelum mendaftar.');
        return;
      }

      // UI Loading State
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳</span> Menyimpan ke Database...`;
      }

      try {
        const result = await submitTournamentRegistration({
          teamName,
          playerNames,
          gameId,
          discordTag,
          suggestions
        });

        // Reset form
        registrationForm.reset();

        // Tampilkan modal sukses
        if (modalTeamName) modalTeamName.textContent = result.teamName;
        if (modalSlot) modalSlot.textContent = result.slot;
        if (modalDiscord) modalDiscord.textContent = result.discordTag;

        if (successModal) {
          successModal.classList.add('open');
        }

        // Refresh & render data terbaru
        await refreshAndRender();
      } catch (err) {
        console.error('Registrasi gagal:', err);
        alert(
          'Pemberitahuan: ' +
            (err.message ||
              'Terjadi kendala koneksi ke database. Pastikan tabel tournament_registrations sudah dibuat di Supabase.')
        );
      } finally {
        if (submitBtn && currentParticipantsList.length < MAX_SLOTS) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>🚀</span> Submit & Daftar Turnamen Sekarang`;
        }
      }
    });
  }

  // --- Search Input Listener ---
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderCards(currentParticipantsList, e.target.value);
    });
  }

  // --- Modal Close & Navigation Actions ---
  function closeModal() {
    if (successModal) successModal.classList.remove('open');
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

  if (modalViewListBtn) {
    modalViewListBtn.addEventListener('click', () => {
      closeModal();
      switchTab('tab-participants');
      const container = document.getElementById('tab-participants');
      if (container) {
        container.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (successModal) {
    successModal.addEventListener('click', (e) => {
      if (e.target === successModal) closeModal();
    });
  }

  // Helper Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  refreshAndRender();
});
