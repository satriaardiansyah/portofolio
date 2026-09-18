/**
 * DONATION SYSTEM & DYNAMIC LEADERBOARD MODULE
 * Yabi Dev - Satria Ardiansyah
 * 
 * Mengelola data Target Goal Donasi dan Leaderboard Donatur secara dinamis,
 * tersinkronisasi realtime antara Dashboard Admin dan Halaman Website (index.html),
 * dengan arsitektur dual-layer: LocalStorage + Supabase Cloud Database.
 */

(function () {
  'use strict';

  // --- KONFIGURASI SUPABASE & STORAGE ---
  const SUPABASE_PROJECT_URL = 'https://jvhdbzxhmhqmsgjvsylp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_WQnVqx7Oai2ScoW18pZxow_ThBNl9-4';
  const STORAGE_KEY = 'yabidev_donation_data';
  const CHANNEL_NAME = 'yabidev_donation_sync';

  // Inisialisasi Supabase Client jika SDK tersedia
  let supabaseClient = null;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);
      console.log('⚡ [Donation] Supabase Client terhubung untuk Donasi & Leaderboard');
    } catch (err) {
      console.warn('⚠️ [Donation] Supabase init warning, fallback ke LocalStorage:', err);
    }
  }

  // BroadcastChannel untuk sinkronisasi seketika antar-tab di browser yang sama
  let broadcastChannel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn('[Donation] BroadcastChannel tidak didukung:', e);
    }
  }

  // --- DATA DEFAULT (Sesuai Tampilan Asli Website) ---
  const DEFAULT_DONATION_DATA = {
    targetGoal: {
      enabled: true,
      title: 'Target Goal Donasi Stream & Tooling',
      currentAmount: 450000,
      targetAmount: 1000000,
      percentage: 45,
      autoCalc: true,
      customNote: 'Rp {current} terkumpul dari target Rp {target} — terima kasih banyak buat semua dukungannya! 🙏'
    },
    leaderboard: [
      {
        id: 'lb-1',
        rank: 1,
        name: 'Sambung kata',
        amount: 300000,
        initials: 'SK',
        colorTheme: 'orange',
        badgeText: '👑 Top 1'
      },
      {
        id: 'lb-2',
        rank: 2,
        name: 'Sss',
        amount: 100000,
        initials: 'SS',
        colorTheme: 'cyan',
        badgeText: ''
      },
      {
        id: 'lb-3',
        rank: 3,
        name: 'Vanya',
        amount: 100000,
        initials: 'VN',
        colorTheme: 'pink',
        badgeText: ''
      },
      {
        id: 'lb-4',
        rank: 4,
        name: 'Virgi',
        amount: 50000,
        initials: 'VG',
        colorTheme: 'gray',
        badgeText: ''
      }
    ],
    ctaSettings: {
      buttonText: 'Jadi Donatur Berikutnya ↗',
      buttonUrl: 'https://saweria.co/YabiDev',
      saweriaUsername: 'YabiDev'
    },
    updatedAt: new Date().toISOString()
  };

  // --- HELPER FORMATTING ---
  function formatRupiah(number) {
    const val = Number(number) || 0;
    return 'Rp ' + val.toLocaleString('id-ID');
  }

  function parseRupiah(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const cleaned = String(str).replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  function generateInitials(name) {
    if (!name || typeof name !== 'string') return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function calculatePercentage(current, target) {
    const cur = Number(current) || 0;
    const tar = Number(target) || 1;
    if (tar <= 0) return 0;
    const pct = Math.round((cur / tar) * 100);
    return Math.max(0, Math.min(100, pct)); // clamp 0-100 for visual bar
  }

  // --- STATE MANAGEMENT ---
  let currentDonationData = null;

  // 1. Membaca data dari LocalStorage
  function getLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_DONATION_DATA,
          ...parsed,
          targetGoal: { ...DEFAULT_DONATION_DATA.targetGoal, ...(parsed.targetGoal || {}) },
          ctaSettings: { ...DEFAULT_DONATION_DATA.ctaSettings, ...(parsed.ctaSettings || {}) },
          leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : DEFAULT_DONATION_DATA.leaderboard
        };
      }
    } catch (e) {
      console.error('[Donation] Gagal memuat data dari LocalStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DONATION_DATA));
  }

  // 2. Mengambil data dari Supabase jika ada
  async function fetchCloudData() {
    if (!supabaseClient) return null;
    try {
      const { data, error } = await supabaseClient
        .from('donation_settings')
        .select('data, updated_at')
        .eq('id', 'main_config')
        .maybeSingle();

      if (error) {
        // Jika tabel belum dibuat, jangan crash, gunakan lokal
        return null;
      }

      if (data && data.data) {
        return {
          ...DEFAULT_DONATION_DATA,
          ...data.data,
          updatedAt: data.updated_at || data.data.updatedAt
        };
      }
    } catch (err) {
      console.warn('[Donation] Supabase fetch error (fallback ke LocalStorage):', err);
    }
    return null;
  }

  // 3. Simpan data ke LocalStorage dan Supabase
  async function saveData(newData) {
    const dataToSave = {
      ...newData,
      updatedAt: new Date().toISOString()
    };

    // Auto calculate persentase jika autoCalc aktif
    if (dataToSave.targetGoal && dataToSave.targetGoal.autoCalc !== false) {
      dataToSave.targetGoal.percentage = calculatePercentage(
        dataToSave.targetGoal.currentAmount,
        dataToSave.targetGoal.targetAmount
      );
    }

    currentDonationData = dataToSave;

    // Simpan lokal
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('[Donation] Gagal simpan ke localStorage:', e);
    }

    // Broadcast ke tab lain
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'DONATION_UPDATE', data: dataToSave });
      } catch (e) {}
    }

    // Trigger custom window event
    window.dispatchEvent(new CustomEvent('yabi:donation-updated', { detail: dataToSave }));

    // Simpan ke Supabase jika terhubung
    let cloudSynced = false;
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('donation_settings')
          .upsert({
            id: 'main_config',
            data: dataToSave,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (!error) {
          cloudSynced = true;
          console.log('⚡ [Donation] Tersimpan & tersinkronisasi ke Supabase');
        } else {
          console.warn('[Donation] Supabase save error:', error.message);
        }
      } catch (err) {
        console.warn('[Donation] Gagal push ke Supabase:', err);
      }
    }

    return { success: true, cloudSynced, data: dataToSave };
  }

  // --- RENDER DOM DI WEBSITE UTAMA (index.html) ---
  function renderPublicUI(data) {
    if (!data) return;

    // A. Render Leaderboard Donatur
    const lbContainer = document.getElementById('leaderboardListContainer') || document.querySelector('.leaderboard-list');
    if (lbContainer && Array.isArray(data.leaderboard)) {
      // Pastikan terurut jika ada rank
      const items = [...data.leaderboard];

      let html = '';
      items.forEach((item, idx) => {
        const rank = item.rank || (idx + 1);
        const name = item.name || 'Anonim';
        const amountStr = formatRupiah(item.amount || 0);
        const initials = item.initials || generateInitials(name);
        const badgeText = item.badgeText || '';

        // Class rank styling
        let rankClass = `rank-${rank}`;
        let badgeIcon = `${rank}`;
        if (rank === 1) badgeIcon = '🥇 1';
        else if (rank === 2) badgeIcon = '🥈 2';
        else if (rank === 3) badgeIcon = '🥉 3';

        // Styling kustom tema warna avatar jika bukan standar
        let avatarClass = `rank-${rank}-avatar`;
        let amountClass = `rank-${rank}-amount`;
        let itemClass = `rank-${rank}`;

        if (rank > 3) {
          rankClass = 'rank-4';
          avatarClass = 'rank-4-avatar';
          amountClass = 'rank-4-amount';
          itemClass = 'rank-4';
        }

        // Jika user mengatur colorTheme spesifik
        if (item.colorTheme === 'orange') {
          avatarClass = 'rank-1-avatar';
        } else if (item.colorTheme === 'cyan') {
          avatarClass = 'rank-2-avatar';
        } else if (item.colorTheme === 'pink') {
          avatarClass = 'rank-3-avatar';
        } else if (item.colorTheme === 'gray') {
          avatarClass = 'rank-4-avatar';
        }

        const crownHtml = badgeText ? `<span class="lb-crown-badge">${escapeHtml(badgeText)}</span>` : '';

        html += `
          <div class="lb-item ${itemClass}" data-id="${item.id || idx}">
            <div class="lb-left">
              <span class="rank-badge rank-${Math.min(rank, 4)}-badge">${badgeIcon}</span>
              <div class="lb-avatar ${avatarClass}">${escapeHtml(initials)}</div>
              <div class="lb-user-details">
                <span class="lb-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                ${crownHtml}
              </div>
            </div>
            <span class="lb-amount ${amountClass}">${amountStr}</span>
          </div>
        `;
      });

      if (items.length === 0) {
        html = `
          <div class="lb-item empty-state" style="justify-content:center; padding: 24px; color: var(--muted); font-size:13px;">
            Belum ada donatur yang tercatat. Jadilah yang pertama! ✨
          </div>
        `;
      }

      lbContainer.innerHTML = html;
    }

    // B. Render Tombol Aksi CTA Leaderboard
    const lbActionBtn = document.getElementById('lbActionBtn') || document.querySelector('.lb-action-btn');
    if (lbActionBtn && data.ctaSettings) {
      if (data.ctaSettings.buttonUrl) {
        lbActionBtn.setAttribute('href', data.ctaSettings.buttonUrl);
      }
      if (data.ctaSettings.buttonText) {
        lbActionBtn.innerHTML = `<span>♥</span> ${escapeHtml(data.ctaSettings.buttonText)}`;
      }
    }

    // C. Render Target Goal Box
    const goalBox = document.getElementById('goalBoxContainer') || document.querySelector('.goal-box');
    if (goalBox && data.targetGoal) {
      const goal = data.targetGoal;
      if (goal.enabled === false) {
        goalBox.style.display = 'none';
      } else {
        goalBox.style.display = '';

        // Hitung persentase
        let pct = goal.percentage;
        if (goal.autoCalc !== false || pct === undefined) {
          pct = calculatePercentage(goal.currentAmount, goal.targetAmount);
        }

        // Title
        const titleEl = goalBox.querySelector('h4') || goalBox.querySelector('.goal-title');
        if (titleEl && goal.title) {
          titleEl.textContent = goal.title;
        }

        // Pct element
        const pctEl = goalBox.querySelector('.pct') || goalBox.querySelector('.goal-pct');
        if (pctEl) {
          pctEl.textContent = `${pct}%`;
        }

        // Goal Fill Bar
        const fillEl = goalBox.querySelector('.goal-fill');
        if (fillEl) {
          fillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }

        // Goal Note
        const noteEl = goalBox.querySelector('.goal-note');
        if (noteEl) {
          let noteText = goal.customNote || 'Rp {current} terkumpul dari target Rp {target} — terima kasih banyak buat semua dukungannya! 🙏';
          noteText = noteText
            .replace(/\{current\}/g, (Number(goal.currentAmount) || 0).toLocaleString('id-ID'))
            .replace(/\{target\}/g, (Number(goal.targetAmount) || 0).toLocaleString('id-ID'))
            .replace(/\{pct\}/g, `${pct}%`);
          noteEl.textContent = noteText;
        }
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- INIT & REALTIME LISTENERS ---
  async function init() {
    // 1. Ambil data lokal segera agar antarmuka tidak kedip
    currentDonationData = getLocalData();
    renderPublicUI(currentDonationData);

    // 2. Ambil data cloud di background
    const cloudData = await fetchCloudData();
    if (cloudData) {
      // Bandingkan timestamp updatedAt jika ada
      const localUpdated = currentDonationData.updatedAt ? new Date(currentDonationData.updatedAt).getTime() : 0;
      const cloudUpdated = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;

      if (cloudUpdated >= localUpdated) {
        currentDonationData = cloudData;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
        } catch (e) {}
        renderPublicUI(currentDonationData);
      }
    }

    // 3. Listener Realtime Supabase
    if (supabaseClient) {
      try {
        supabaseClient
          .channel('public:donation_settings')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'donation_settings', filter: 'id=eq.main_config' },
            (payload) => {
              if (payload.new && payload.new.data) {
                console.log('⚡ [Donation] Realtime update dari Supabase diterima!');
                currentDonationData = {
                  ...DEFAULT_DONATION_DATA,
                  ...payload.new.data,
                  updatedAt: payload.new.updated_at
                };
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDonationData));
                } catch (e) {}
                renderPublicUI(currentDonationData);
                window.dispatchEvent(new CustomEvent('yabi:donation-updated', { detail: currentDonationData }));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[Donation] Gagal subscribe Supabase realtime:', err);
      }
    }

    // 4. Listener LocalStorage antar-tab
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          currentDonationData = JSON.parse(e.newValue);
          renderPublicUI(currentDonationData);
          window.dispatchEvent(new CustomEvent('yabi:donation-updated', { detail: currentDonationData }));
        } catch (err) {}
      }
    });

    // 5. Listener BroadcastChannel
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'DONATION_UPDATE' && event.data.data) {
          currentDonationData = event.data.data;
          renderPublicUI(currentDonationData);
          window.dispatchEvent(new CustomEvent('yabi:donation-updated', { detail: currentDonationData }));
        }
      };
    }
  }

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API ke Window
  window.DonationManager = {
    getData: () => currentDonationData || getLocalData(),
    getDefaultData: () => JSON.parse(JSON.stringify(DEFAULT_DONATION_DATA)),
    saveData,
    renderPublicUI,
    formatRupiah,
    parseRupiah,
    generateInitials,
    calculatePercentage,
    isSupabaseConnected: () => Boolean(supabaseClient)
  };
})();
