/* ============================================================
   RT.010 / RW.002 Mabu Park — app.js (Versi Show Password)
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendPasswordResetEmail, onAuthStateChanged, signOut,
    setPersistence, browserLocalPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore, doc, setDoc, getDoc, collection, getDocs,
    updateDoc, deleteDoc, addDoc, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ============================ KONSTANTA ============================ */
const appId = typeof __app_id !== 'undefined' ? __app_id : 'layanan-warga-rt10';
const KETUA_RT_NAMA = "Ade Hilman Fatahillah";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydEnQUz9TIKloH_4TUQIP0jYK-SSHvv3OwLN6gR8lUMlUF554nQrhs1EUfxHezmVSJIQ/exec";

const PILIHAN_NOMINAL_IURAN = [
    20000, 25000, 30000, 35000, 40000, 45000, 50000,
    60000, 70000, 75000, 80000, 90000, 100000,
    110000, 120000, 125000, 130000, 140000, 150000,
    160000, 170000, 175000, 180000, 190000, 200000
];
const DAFTAR_BULAN_IURAN = [
    'Okt 2026', 'Nov 2026', 'Des 2026',
    'Jan 2027', 'Feb 2027', 'Mar 2027', 'Apr 2027',
    'Mei 2027', 'Jun 2027', 'Jul 2027', 'Agu 2027', 'Sep 2027'
];

/* ============================ STATE ============================ */
window.currentUserData = null;
let unSubs = [];
let isFiturSOSEnabled = true;
let nominalIuranDefault = 50000;
let pendingUpdateWorker = null;
let swRegistered = false;

/* ============================ FIREBASE INIT (SAFE) ============================ */
let app, auth, db, secondaryApp, secondaryAuth;
let firebaseReady = false;

try {
    const firebaseConfig = {
        apiKey: "AIzaSyDWaFhPioQK36oJmkCadgwKL9CSo8ILWsM",
        authDomain: "mabu-park-rt-10.firebaseapp.com",
        projectId: "mabu-park-rt-10",
        storageBucket: "mabu-park-rt-10.firebasestorage.app",
        messagingSenderId: "886767560025",
        appId: "1:886767560025:web:96990fde548a7bae8d5848"
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setPersistence(auth, browserLocalPersistence)
        .catch(() => setPersistence(auth, inMemoryPersistence).catch(() => {}));

    secondaryApp = initializeApp(firebaseConfig, "AdminHelperApp");
    secondaryAuth = getAuth(secondaryApp);
    setPersistence(secondaryAuth, inMemoryPersistence).catch(() => {});

    firebaseReady = true;
} catch (err) {
    console.error("[FIREBASE INIT FAILED]", err);
}

/* ============================ HELPERS ============================ */
function formatRupiah(angka) {
    try {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0
        }).format(Number(angka) || 0);
    } catch { return 'Rp 0'; }
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, s => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
}

function safeEncode(obj) {
    return encodeURIComponent(JSON.stringify(obj)).replace(/'/g, '%27');
}

function safeDecode(encoded) {
    return JSON.parse(decodeURIComponent(encoded));
}

window.showToast = function (msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-20 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-2xl text-xs font-semibold shadow-2xl z-[140] w-max max-w-[90vw] sm:max-w-sm text-center leading-relaxed ${isError ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`;
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, 8px)'; }, 3500);
    setTimeout(() => toast.remove(), 3800);
};

window.lihatGambarModal = function (judul, base64Src) {
    const t = document.getElementById('imgPreviewTitle');
    const s = document.getElementById('imgPreviewSrc');
    const m = document.getElementById('imgPreviewModal');
    if (t) t.innerText = judul;
    if (s) s.src = base64Src;
    if (m) m.classList.remove('hidden');
};

window.togglePasswordVisibility = function (inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};

/* ============================ SHOW / CLOSE MODAL ============================ */
window.showModal = function (mId, cId) {
    const el = document.getElementById(mId);
    const ct = document.getElementById(cId);
    if (!el || !ct) return;
    el.classList.remove('hidden');
    if (!el.classList.contains('flex')) el.classList.add('flex');
    requestAnimationFrame(() => {
        el.classList.remove('opacity-0');
        ct.classList.remove('translate-y-full', 'translate-y-8', 'scale-95');
    });
};

window.closeModal = function (mId, cId) {
    const el = document.getElementById(mId);
    const ct = document.getElementById(cId);
    if (!el || !ct) return;
    el.classList.add('opacity-0');
    const scaleTargets = ['confirmModalContent', 'sosModalContent', 'editKasModalContent'];
    if (scaleTargets.includes(cId)) ct.classList.add('scale-95');
    else ct.classList.add('translate-y-full');
    setTimeout(() => el.classList.add('hidden'), 300);
};
window.closeConfirmModal = () => closeModal('confirmModal', 'confirmModalContent');
window.closeAdminEditModal = () => closeModal('adminEditModal', 'adminEditModalContent');

/* ============================ DROPDOWN IURAN ============================ */
function initDropdownIuran() {
    const aBln = document.getElementById('adminBulanIuran');
    const aNom = document.getElementById('adminNominalIuran');
    if (aBln && aBln.options.length === 0) DAFTAR_BULAN_IURAN.forEach(b => aBln.add(new Option(b, b)));
    if (aNom && aNom.options.length === 0) PILIHAN_NOMINAL_IURAN.forEach(n => aNom.add(new Option(formatRupiah(n), n)));
}
initDropdownIuran();

/* ============================ BIOMETRIC / FINGERPRINT ============================ */
function bufferToBase64(b) { return btoa(String.fromCharCode.apply(null, new Uint8Array(b))); }
function base64ToBuffer(b) {
    const bin = atob(b); const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
}

window.perbaruiStatusUI_Fingerprint = function () {
    const saved = localStorage.getItem('rt10_fp_cred');
    const txt = document.getElementById('fpStatusText');
    const btn = document.getElementById('btnToggleFp');
    if (!txt || !btn) return;
    if (saved) {
        txt.innerText = 'Aktif di HP ini';
        txt.classList.replace('text-slate-500', 'text-emerald-600');
        btn.innerText = 'Hapus';
        btn.classList.replace('bg-emerald-600', 'bg-red-500');
    } else {
        txt.innerText = 'Belum diaktifkan';
        txt.classList.replace('text-emerald-600', 'text-slate-500');
        btn.innerText = 'Aktifkan';
        btn.classList.replace('bg-red-500', 'bg-emerald-600');
    }
};

window.daftarkanFingerprint = async function () {
    if (localStorage.getItem('rt10_fp_cred')) {
        localStorage.removeItem('rt10_fp_cred');
        perbaruiStatusUI_Fingerprint();
        return showToast("Fingerprint dihapus.");
    }
    if (!window.PublicKeyCredential) return showToast("HP/Browser tidak mendukung Fingerprint.", true);
    const authTemp = sessionStorage.getItem('rt10_temp_auth');
    if (!authTemp) return showToast("Silakan Logout lalu Masuk ulang dengan Password dulu.", true);
    try {
        const creds = JSON.parse(authTemp);
        const chal = new Uint8Array(32); window.crypto.getRandomValues(chal);
        const uidb = new Uint8Array(16); window.crypto.getRandomValues(uidb);
        const namaWarga = (window.currentUserData && window.currentUserData.nama) || "Warga RT.010";
        const c = await navigator.credentials.create({
            publicKey: {
                challenge: chal,
                rp: { name: "Warga RT.010", id: window.location.hostname },
                user: { id: uidb, name: atob(creds.email), displayName: namaWarga },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                    residentKey: "discouraged",
                    requireResidentKey: false
                },
                timeout: 60000, attestation: "none"
            }
        });
        localStorage.setItem('rt10_fp_cred', JSON.stringify({
            credId: bufferToBase64(c.rawId), email: creds.email, pass: creds.pass
        }));
        perbaruiStatusUI_Fingerprint();
        showToast("✅ Fingerprint berhasil diaktifkan!");
    } catch (e) {
        showToast("Gagal aktivasi sidik jari. Pastikan kunci layar HP aktif.", true);
    }
};

window.handleFingerprintLogin = async function () {
    const saved = localStorage.getItem('rt10_fp_cred');
    if (!saved) return showToast("Belum ada Fingerprint. Masuk dengan password dulu.", true);
    if (!firebaseReady) return showToast("Aplikasi belum siap. Coba refresh.", true);
    const btn = document.getElementById('btnFingerprintLogin');
    if (btn) btn.disabled = true;
    try {
        const d = JSON.parse(saved);
        const chal = new Uint8Array(32); window.crypto.getRandomValues(chal);
        await navigator.credentials.get({
            publicKey: {
                challenge: chal,
                rpId: window.location.hostname,
                allowCredentials: [{ id: base64ToBuffer(d.credId), type: 'public-key', transports: ['internal'] }],
                userVerification: "required", timeout: 60000
            }
        });
        sessionStorage.setItem('rt10_temp_auth', JSON.stringify({ email: d.email, pass: d.pass }));
        await signInWithEmailAndPassword(auth, atob(d.email), atob(d.pass));
        showToast("Login Berhasil!");
    } catch (e) {
        showToast("Verifikasi sidik jari gagal.", true);
    } finally {
        if (btn) btn.disabled = false;
    }
};

/* ============================ KAMERA REALTIME (WEBRTC) ============================ */
let liveStream = null;
let currentFacingMode = 'environment';
let camTargetConfig = null;

window.bukaKameraRealtime = async function (prevId, icoId, hidId, textHideId = null, forceFacing = null) {
    camTargetConfig = { prevId, icoId, hidId, textHideId };
    if (forceFacing) currentFacingMode = forceFacing;
    else if (prevId !== 'KEEP') currentFacingMode = 'environment';

    const modal = document.getElementById('liveCameraModal');
    const video = document.getElementById('liveCameraVideo');
    const lbl = document.getElementById('camModeLabel');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return showToast("Browser/HP tidak mengizinkan kamera langsung.", true);
    }
    try {
        if (liveStream) liveStream.getTracks().forEach(t => t.stop());
        liveStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: currentFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        if (video) video.srcObject = liveStream;
        if (lbl) lbl.innerText = currentFacingMode === 'user' ? 'Depan' : 'Belakang';
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        showToast("Gagal membuka kamera. Pastikan izin kamera aktif.", true);
    }
};

window.gantiArahKamera = async function () {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    if (camTargetConfig) {
        await bukaKameraRealtime(
            camTargetConfig.prevId, camTargetConfig.icoId,
            camTargetConfig.hidId, camTargetConfig.textHideId, currentFacingMode
        );
    }
};

window.tutupKameraRealtime = function () {
    if (liveStream) {
        liveStream.getTracks().forEach(t => t.stop());
        liveStream = null;
    }
    const video = document.getElementById('liveCameraVideo');
    if (video) video.srcObject = null;
    const modal = document.getElementById('liveCameraModal');
    if (modal) modal.classList.add('hidden');
};

window.jepretFotoRealtime = async function () {
    const video = document.getElementById('liveCameraVideo');
    if (!video || !liveStream) return;

    const canvas = document.createElement('canvas');
    let w = video.videoWidth || 800;
    let h = video.videoHeight || 600;
    if (w > h && w > 800) { h *= 800 / w; w = 800; }
    else if (h > 800) { w *= 800 / h; h = 800; }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    const b64 = canvas.toDataURL('image/jpeg', 0.65);

    tutupKameraRealtime();

    if (camTargetConfig && camTargetConfig.prevId === 'CHAT') {
        showToast("Mengirim foto kamera...");
        await kirimPayloadChat({ text: '', imageUrl: b64 });
    } else if (camTargetConfig) {
        const prev = document.getElementById(camTargetConfig.prevId);
        if (prev) { prev.src = b64; prev.classList.remove('hidden'); }
        const ico = document.getElementById(camTargetConfig.icoId);
        if (ico) ico.classList.add('hidden');
        const hid = document.getElementById(camTargetConfig.hidId);
        if (hid) hid.value = b64;
        if (camTargetConfig.textHideId) {
            const tx = document.getElementById(camTargetConfig.textHideId);
            if (tx) tx.classList.add('hidden');
        }
        showToast("📸 Foto berhasil diambil!");
    }
};

/* ============================ NOTIFIKASI & SUARA ============================ */
function bunyikanSireneDarurat() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        for (let i = 0; i < 4; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(650, ctx.currentTime + i * 0.6);
            osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + i * 0.6 + 0.3);
            osc.frequency.linearRampToValueAtTime(650, ctx.currentTime + i * 0.6 + 0.55);
            gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.6 + 0.58);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.6);
            osc.stop(ctx.currentTime + i * 0.6 + 0.58);
        }
    } catch (e) { /* silent */ }
}

function cekTombolNotifikasi() {
    const modal = document.getElementById('notifPromptModal');
    if (!modal) return;
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}
window.tutupPromptNotif = function () {
    const m = document.getElementById('notifPromptModal');
    if (m) m.classList.add('hidden');
};
window.mintaIzinNotifikasi = async function () {
    tutupPromptNotif();
    if (!('Notification' in window)) return showToast("Tidak mendukung notifikasi.", true);
    const p = await Notification.requestPermission();
    if (p === 'granted') kirimNotifikasiPesan('Aktif', 'Notifikasi berjalan.');
    else showToast("Mohon izinkan notifikasi di pengaturan browser.", true);
};

window.kirimNotifikasiPesan = function (judul, isi) {
    try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {}); } catch (e) { }
    showToast(`🔔 ${judul}: ${isi}`);
    if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then(r => r.showNotification(judul, { body: isi, icon: '/icon-192.png', vibrate: [250, 100, 250] }))
            .catch(() => {});
    }
};

/* ============================ SOS ============================ */
window.bukaModalSOS = function () {
    if (!isFiturSOSEnabled) return showToast("Fitur SOS dinonaktifkan oleh Pengurus RT.", true);
    showModal('sosModal', 'sosModalContent');
};

window.kirimSinyalSOS = async function (jenisBahaya) {
    if (!firebaseReady || !auth.currentUser) return;
    closeModal('sosModal', 'sosModalContent');
    const u = window.currentUserData || {};
    const namaPelapor = u.nama || 'Warga';
    const blokPelapor = `Blok ${u.blok || '-'} / No. ${u.no || '-'}`;
    try {
        await kirimPayloadChat({
            text: `🚨 [SINYAL DARURAT SOS: ${jenisBahaya}] 🚨\nWarga: ${namaPelapor} (${blokPelapor}) membutuhkan pertolongan segera! Mohon warga sekitar merapat!`
        });
        await addDoc(collection(db, 'artifacts', appId, 'laporan'), {
            userId: auth.currentUser.uid,
            nama: namaPelapor, blok: u.blok || '-', no: u.no || '-',
            layanan: `DARURAT SOS: ${jenisBahaya}`,
            detail: `Panggilan Darurat ${jenisBahaya} di ${blokPelapor}`,
            timestamp: Date.now()
        });
        await setDoc(doc(db, 'artifacts', appId, 'kas', 'config_sos'), {
            activeSOS: { jenis: jenisBahaya, nama: namaPelapor, blok: blokPelapor, timestamp: Date.now() }
        }, { merge: true }).catch(() => {});
        bunyikanSireneDarurat();
        showToast(`🚨 Sinyal Darurat ${jenisBahaya} terkirim ke seluruh warga!`);
    } catch (e) {
        showToast("Gagal mengirim sinyal SOS.", true);
    }
};

window.ubahStatusFiturSOS = async function (aktif) {
    if (!firebaseReady) return;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'kas', 'config_sos'), {
            enabled: aktif, updatedAt: Date.now()
        }, { merge: true });
        showToast(aktif ? "Tombol SOS Warga Diaktifkan." : "Tombol SOS Warga Dinonaktifkan.");
    } catch (e) { showToast("Gagal mengubah pengaturan SOS.", true); }
};

window.matikanSinyalSOS = async function () {
    if (!firebaseReady) return;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'kas', 'config_sos'), {
            activeSOS: null, clearedAt: Date.now()
        }, { merge: true });
        const b = document.getElementById('sosActiveAlertBanner');
        if (b) b.classList.add('hidden');
        showToast("Status darurat telah diselesaikan.");
    } catch (e) { showToast("Gagal mematikan alarm.", true); }
};

/* ============================ CHAT ============================ */
let allChatMessages = [];
let currentChatRoom = 'GLOBAL';
let currentChatPartner = null;
let unreadChatCount = 0;
let replyingTo = null;

function getPrivateRoomId(u1, u2) { return [u1, u2].sort().join('_'); }

window.updateChatBadge = function (count) {
    unreadChatCount = count;
    const nb = document.getElementById('navChatBadge');
    const hb = document.getElementById('headerChatBadge');
    if (count > 0) {
        if (nb) { nb.innerText = count; nb.classList.remove('hidden'); }
        if (hb) { hb.innerText = count; hb.classList.remove('hidden'); }
    } else {
        if (nb) nb.classList.add('hidden');
        if (hb) hb.classList.add('hidden');
    }
};

window.pilihModeChat = async function (mode) {
    const bGrup = document.getElementById('subTabGrup');
    const bJapri = document.getElementById('subTabJapri');
    if (mode === 'grup') {
        currentChatRoom = 'GLOBAL';
        currentChatPartner = null;
        if (bGrup) bGrup.className = "flex-1 py-2 text-xs font-bold bg-white shadow-sm rounded-xl text-emerald-600 transition-all";
        if (bJapri) bJapri.className = "flex-1 py-2 text-xs font-semibold text-slate-500 rounded-xl transition-all";
        document.getElementById('japriContactList')?.classList.add('hidden');
        document.getElementById('activeChatHeader')?.classList.add('hidden');
        document.getElementById('chatMessagesBox')?.classList.remove('hidden');
        document.getElementById('chatInputForm')?.classList.remove('hidden');
        renderChatMessages();
    } else {
        if (bJapri) bJapri.className = "flex-1 py-2 text-xs font-bold bg-white shadow-sm rounded-xl text-emerald-600 transition-all";
        if (bGrup) bGrup.className = "flex-1 py-2 text-xs font-semibold text-slate-500 rounded-xl transition-all";
        document.getElementById('chatMessagesBox')?.classList.add('hidden');
        document.getElementById('chatInputForm')?.classList.add('hidden');
        document.getElementById('activeChatHeader')?.classList.add('hidden');
        document.getElementById('japriContactList')?.classList.remove('hidden');
        await loadDaftarKontakWarga();
    }
};

async function loadDaftarKontakWarga() {
    const cont = document.getElementById('japriContactList');
    if (!cont || !firebaseReady) return;
    cont.innerHTML = '<div class="text-center py-5 text-slate-400 text-sm">Memuat...</div>';
    try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'users'));
        let html = '';
        snap.forEach(d => {
            if (auth.currentUser && d.id === auth.currentUser.uid) return;
            const u = d.data();
            const nm = u.nama || 'Warga';
            const bInfo = `Blok ${u.blok || '-'}/${u.no || '-'}`;
            const badge = u.role === 'Admin RT' ? '<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">RT</span>' : '';
            const safeNm = nm.replace(/'/g, "\\'");
            html += `<div onclick="bukaRuangJapri('${d.id}', '${safeNm}', '${bInfo}')" class="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between mb-2 shadow-sm cursor-pointer hover:border-emerald-300 transition">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl flex items-center justify-center font-bold shrink-0">${escapeHtml(nm.charAt(0))}</div>
                            <div class="min-w-0">
                                <h4 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(nm)}</h4>
                                <p class="text-xs text-slate-500">${escapeHtml(bInfo)}</p>
                            </div>
                        </div>
                        <div>${badge}</div>
                    </div>`;
        });
        cont.innerHTML = html || '<p class="text-xs text-slate-400 text-center py-5">Belum ada warga lain.</p>';
    } catch (e) {
        cont.innerHTML = '<p class="text-xs text-red-500 text-center py-5">Gagal memuat warga.</p>';
    }
}

window.bukaRuangJapri = function (uid, nm, blk, autoMsg = "") {
    if (!auth.currentUser) return;
    currentChatPartner = { uid, nama: nm, blok: blk };
    currentChatRoom = getPrivateRoomId(auth.currentUser.uid, uid);
    closeModal('umkmModal', 'umkmModalContent');
    closeModal('iuranModal', 'iuranModalContent');
    switchTab('chat');
    const bGrup = document.getElementById('subTabGrup');
    const bJapri = document.getElementById('subTabJapri');
    if (bJapri) bJapri.className = "flex-1 py-2 text-xs font-bold bg-white shadow-sm rounded-xl text-emerald-600 transition-all";
    if (bGrup) bGrup.className = "flex-1 py-2 text-xs font-semibold text-slate-500 rounded-xl transition-all";
    document.getElementById('japriContactList')?.classList.add('hidden');
    document.getElementById('activeChatHeader')?.classList.remove('hidden');
    document.getElementById('chatMessagesBox')?.classList.remove('hidden');
    document.getElementById('chatInputForm')?.classList.remove('hidden');
    const at = document.getElementById('activeChatTitle');
    if (at) at.innerText = nm;
    if (autoMsg) {
        const inp = document.getElementById('chatTextInput');
        if (inp) inp.value = autoMsg;
    }
    renderChatMessages();
};

function renderChatMessages() {
    const box = document.getElementById('chatMessagesBox');
    if (!box || !auth.currentUser) return;
    const fil = allChatMessages
        .filter(m => m.roomId === currentChatRoom)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (fil.length === 0) {
        box.innerHTML = '<div class="text-center text-slate-400 py-10 text-xs">Belum ada obrolan.</div>';
        return;
    }

    let html = '';
    fil.forEach(m => {
        const isMe = m.senderId === auth.currentUser.uid;
        const tm = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        let content = '';
        if (m.text) content += `<p class="text-sm leading-relaxed whitespace-pre-line break-words">${escapeHtml(m.text)}</p>`;
        if (m.stickerUrl) content += `<img src="${escapeHtml(m.stickerUrl)}" class="w-16 h-16 object-contain my-1 drop-shadow-sm">`;
        if (m.imageUrl) content += `<img onclick="lihatGambarModal('Foto', '${m.imageUrl.replace(/'/g, "%27")}')" src="${m.imageUrl}" class="w-full max-w-[220px] h-auto rounded-lg my-1.5 cursor-pointer border border-slate-200/50 shadow-sm">`;

        const safeText = escapeHtml(m.text || (m.imageUrl ? '📷 Foto' : '😊 Stiker'));
        const safeSender = escapeHtml(m.senderName || 'Warga');

        let replyQuote = '';
        if (m.replyTo) {
            replyQuote = `<div class="bg-black/10 border-l-4 border-${isMe ? 'white' : 'emerald-500'} pl-2 py-1 rounded mb-1.5 text-left text-[10px] opacity-90">
                <p class="font-bold ${isMe ? 'text-emerald-100' : 'text-emerald-600'} mb-0.5">${escapeHtml(m.replyTo.senderName)}</p>
                <p class="truncate">${escapeHtml(m.replyTo.text)}</p>
            </div>`;
        }

        if (isMe) {
            html += `<div class="flex justify-end mb-3 chat-bubble-wrapper" data-id="${m.id || ''}" data-sender="Anda" data-text="${safeText}">
                <div class="max-w-[80%] bg-brand text-white rounded-2xl rounded-tr-none px-3.5 py-2 shadow-sm">${replyQuote}${content}<p class="text-[9px] text-emerald-100 text-right mt-1">${tm}</p></div>
            </div>`;
        } else {
            html += `<div class="flex justify-start mb-3 chat-bubble-wrapper" data-id="${m.id || ''}" data-sender="${safeSender}" data-text="${safeText}">
                <div class="max-w-[80%] bg-white border border-slate-200 rounded-2xl rounded-tl-none px-3.5 py-2 shadow-sm">
                    <p class="text-[10px] font-bold text-emerald-600 mb-0.5">${safeSender}</p>
                    ${replyQuote}${content}<p class="text-[9px] text-slate-400 text-right mt-1">${tm}</p>
                </div>
            </div>`;
        }
    });
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

window.aktifkanBalas = function (id, sender, text) {
    replyingTo = { id, senderName: sender, text };
    const c = document.getElementById('replyPreviewContainer');
    if (!c) return;
    document.getElementById('replyPreviewSender').innerText = sender;
    document.getElementById('replyPreviewText').innerText = text;
    c.classList.remove('hidden');
};

window.batalBalas = function () {
    replyingTo = null;
    const c = document.getElementById('replyPreviewContainer');
    if (c) c.classList.add('hidden');
};

window.kirimPesanChat = async function (e) {
    e.preventDefault();
    const inp = document.getElementById('chatTextInput');
    if (!inp || !auth.currentUser) return;
    const t = inp.value.trim();
    if (!t) return;
    inp.value = '';
    await kirimPayloadChat({ text: t });
};

window.kirimStiker = async function (url) {
    document.getElementById('stickerMenu')?.classList.add('hidden');
    await kirimPayloadChat({ text: '', stickerUrl: url });
};

window.handleChatPhoto = function (e) {
    const f = e.target.files[0];
    if (!f) return;
    showToast("Memproses foto...");
    const r = new FileReader();
    r.onload = ev => {
        const i = new Image();
        i.onload = async () => {
            const c = document.createElement('canvas');
            let w = i.width, h = i.height;
            if (w > h && w > 800) { h *= 800 / w; w = 800; }
            else if (h > 800) { w *= 800 / h; h = 800; }
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(i, 0, 0, w, h);
            await kirimPayloadChat({ text: '', imageUrl: c.toDataURL('image/jpeg', 0.6) });
        };
        i.src = ev.target.result;
    };
    r.readAsDataURL(f);
    e.target.value = '';
};

async function kirimPayloadChat(payload) {
    if (!firebaseReady || !auth.currentUser) return;
    const u = window.currentUserData || {};
    if (replyingTo) payload.replyTo = replyingTo;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'chats'), Object.assign({
            roomId: currentChatRoom,
            recipientId: currentChatPartner ? currentChatPartner.uid : 'ALL',
            senderId: auth.currentUser.uid,
            senderName: u.nama || 'Warga',
            senderBlok: `${u.blok || '-'}/${u.no || '-'}`,
            senderRole: u.role || 'Warga',
            timestamp: Date.now()
        }, payload));
        batalBalas();
    } catch (err) {
        showToast("Gagal kirim pesan.", true);
    }
}

/* ============================ SWIPE TO REPLY ============================ */
let swipeStartX = 0, swipeStartY = 0, swipingEl = null, isSwiping = false;

document.addEventListener('touchstart', e => {
    const bubble = e.target.closest('.chat-bubble-wrapper');
    if (!bubble) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipingEl = bubble;
    isSwiping = false;
    swipingEl.style.transition = 'none';
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (!swipingEl) return;
    const diffX = e.touches[0].clientX - swipeStartX;
    const diffY = e.touches[0].clientY - swipeStartY;
    if (diffX > 10 && Math.abs(diffX) > Math.abs(diffY)) isSwiping = true;
    if (isSwiping && diffX > 0 && diffX <= 75) {
        swipingEl.style.transform = `translateX(${diffX}px)`;
    }
}, { passive: true });

document.addEventListener('touchend', e => {
    if (!swipingEl) return;
    const endX = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0].clientX : swipeStartX;
    const diffX = endX - swipeStartX;
    swipingEl.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    swipingEl.style.transform = 'translateX(0px)';
    if (isSwiping && diffX > 30) {
        aktifkanBalas(swipingEl.dataset.id, swipingEl.dataset.sender, swipingEl.dataset.text);
    }
    swipingEl = null;
    isSwiping = false;
});

// Ganti window.loadBukuKas yang lama dengan ini
let currentKasFilter = 'semua';
let globalKasList = [];

window.filterKas = function(tipe) {
    currentKasFilter = tipe;
    ['semua', 'masuk', 'keluar'].forEach(t => {
        const btn = document.getElementById('tabKas' + t.charAt(0).toUpperCase() + t.slice(1));
        if(btn) {
            if(t === tipe) btn.className = "flex-1 py-2 text-xs font-bold bg-white shadow-sm rounded-lg text-emerald-600 transition-all";
            else btn.className = "flex-1 py-2 text-xs font-semibold text-slate-500 rounded-lg transition-all";
        }
    });
    renderKasList();
};

window.loadBukuKas = async function () {
    const wCont = document.getElementById('kasWargaListContainer');
    const aCont = document.getElementById('adminKasList');
    if (!firebaseReady || !wCont) return;
    
    wCont.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-slate-400 text-2xl"></i></div>';
    
    try {
        const s = await getDocs(collection(db, 'artifacts', appId, 'kas'));
        let totalMasuk = 0, totalKeluar = 0;
        globalKasList = [];

        s.forEach(d => {
            if (d.id === 'config_iuran' || d.id === 'config_sos') return;
            const item = d.data();
            if (!item.nominal) return;
            
            if (item.jenis === 'masuk') totalMasuk += Number(item.nominal);
            else totalKeluar += Number(item.nominal);
            
            globalKasList.push({ id: d.id, ...item });
        });

        // Urutkan berdasarkan waktu (terbaru di atas)
        globalKasList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Hitung Saldo (Misal Saldo Awal statis 0, atau Anda bisa ubah logicnya)
        const saldoAwal = 0; 
        const saldoAkhir = totalMasuk - totalKeluar;

        // Update angka di UI
        const elSaldo = document.getElementById('kasTotalSaldo');
        const elMasuk = document.getElementById('kasTotalMasuk');
        const elKeluar = document.getElementById('kasTotalKeluar');
        const elSaldoAwal = document.getElementById('kasSaldoAwal');
        
        if (elSaldo) elSaldo.innerText = formatRupiah(saldoAkhir);
        if (elMasuk) elMasuk.innerText = formatRupiah(totalMasuk);
        if (elKeluar) elKeluar.innerText = formatRupiah(totalKeluar);
        if (elSaldoAwal) elSaldoAwal.innerText = formatRupiah(saldoAwal);

        // Render List
        renderKasList();

        // Render List Admin (Jika sedang buka admin panel)
        if(aCont) {
            let hAdmin = '';
            globalKasList.forEach(x => {
                const isMasuk = x.jenis === 'masuk';
                const tgl = x.timestamp ? new Date(x.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                const safeKet = String(x.keterangan || '').replace(/'/g, "\\'");
                hAdmin += `<div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center mb-2 shadow-sm">
                    <div class="min-w-0 flex-1 pr-2">
                        <h4 class="font-bold text-xs text-slate-800 truncate">${escapeHtml(x.keterangan)}</h4>
                        <p class="text-[10px] ${isMasuk ? 'text-emerald-600' : 'text-red-600'} font-bold">${isMasuk ? '➕' : '➖'} ${formatRupiah(x.nominal)} <span class="text-slate-400 font-normal">(${tgl})</span></p>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        <button onclick="bukaEditKas('${x.id}', '${x.jenis}', ${x.nominal}, '${safeKet}')" class="w-7 h-7 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-lg text-xs transition"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="hapusTransaksiKas('${x.id}')" class="w-7 h-7 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-xs transition"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
            });
            aCont.innerHTML = hAdmin || '<p class="text-center text-xs text-slate-400 py-4">Belum ada transaksi.</p>';
        }

    } catch (e) {
        console.error(e);
        wCont.innerHTML = '<p class="text-center text-red-500 text-xs py-5">Gagal memuat laporan.</p>';
    }
};

function renderKasList() {
    const cont = document.getElementById('kasWargaListContainer');
    if(!cont) return;

    // Filter data berdasarkan tab
    let filteredList = globalKasList;
    if (currentKasFilter === 'masuk') filteredList = globalKasList.filter(x => x.jenis === 'masuk');
    else if (currentKasFilter === 'keluar') filteredList = globalKasList.filter(x => x.jenis === 'keluar');

    if (filteredList.length === 0) {
        cont.innerHTML = '<p class="text-center text-xs text-slate-400 py-10">Belum ada data transaksi.</p>';
        return;
    }

    let hWarga = '';
    
    // Grouping by Date
    let grouped = {};
    filteredList.forEach(x => {
        const dateObj = new Date(x.timestamp || Date.now());
        const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
        if(!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(x);
    });

    // Build HTML
    for (const [dateLabel, items] of Object.entries(grouped)) {
        hWarga += `<div class="mb-3">
            <h4 class="text-xs font-bold text-slate-800 mb-2 text-center tracking-wide">${dateLabel}</h4>
            <div class="space-y-2">`;

        items.forEach(x => {
            const isMasuk = x.jenis === 'masuk';
            const amtColor = isMasuk ? 'text-emerald-500' : 'text-red-500';
            const iconColor = isMasuk ? 'text-emerald-500 border-emerald-200' : 'text-red-500 border-red-200';
            const sign = isMasuk ? '+' : '-';
            const icon = isMasuk ? 'fa-arrow-down' : 'fa-arrow-up';
            
            hWarga += `<div class="bg-white p-3.5 rounded-2xl flex justify-between items-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${iconColor}">
                        <i class="fa-solid ${icon} text-xs"></i>
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(x.keterangan)}</h4>
                    </div>
                </div>
                <span class="font-bold text-sm shrink-0 ${amtColor}">${sign} ${formatRupiah(x.nominal)}</span>
            </div>`;
        });

        hWarga += `</div></div>`;
    }

    cont.innerHTML = hWarga;
}

// Tambahan fitur Download Laporan Kas (Export ke CSV sederhana)
window.downloadLaporanKas = function() {
    if(globalKasList.length === 0) return showToast("Tidak ada data untuk diunduh.", true);
    
    let csvContent = "Tanggal,Keterangan,Jenis,Nominal\n";
    globalKasList.forEach(x => {
        const tgl = new Date(x.timestamp).toLocaleDateString('id-ID');
        const ket = x.keterangan.replace(/,/g, ''); // Hapus koma agar CSV valid
        csvContent += `${tgl},${ket},${x.jenis},${x.nominal}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Kas_RT010_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📄 Laporan Kas berhasil diunduh!");
};

/* ============================ CETAK PDF ============================ */
window.cetakSuratPDF = function (encodedData) {
    try {
        const d = safeDecode(encodedData);
        if (!window.jspdf || !window.jspdf.jsPDF) return showToast("Library PDF belum siap, coba lagi.", true);
        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(13);
        docPdf.text("RUKUN TETANGGA 010 RUKUN WARGA 002", 105, 18, { align: "center" });
        docPdf.setFontSize(15);
        docPdf.text("PERUMAHAN MABU PARK", 105, 25, { align: "center" });
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(10);
        docPdf.text("Desa Aweh, Kecamatan Kalanganyar, Kabupaten Lebak - Provinsi Banten", 105, 31, { align: "center" });

        docPdf.setLineWidth(0.8);
        docPdf.line(20, 35, 190, 35);
        docPdf.setLineWidth(0.2);
        docPdf.line(20, 36.2, 190, 36.2);

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(12);
        docPdf.text("SURAT PENGANTAR / KETERANGAN", 105, 46, { align: "center" });
        docPdf.setLineWidth(0.4);
        docPdf.line(68, 47, 142, 47);

        const tglSkrg = d.approvedAt ? new Date(d.approvedAt) : new Date();
        const noUrut = String(d.timestamp || Date.now()).slice(-4);
        const blnRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][tglSkrg.getMonth()];
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(10);
        docPdf.text(`Nomor: ${noUrut}/SP-RT.010/RW.002/${blnRomawi}/${tglSkrg.getFullYear()}`, 105, 52, { align: "center" });

        docPdf.setFontSize(11);
        const pembuka = "Yang bertanda tangan di bawah ini Ketua RT. 010 RW. 002 Perumahan Mabu Park, Desa Aweh, Kecamatan Kalanganyar, Kabupaten Lebak, dengan ini menerangkan bahwa:";
        docPdf.text(docPdf.splitTextToSize(pembuka, 170), 20, 64);

        let yPos = 78;
        const rows = [
            ["Nama Lengkap", d.nama || "-"],
            ["NIK / No. KTP", d.nik || "-"],
            ["Tempat, Tanggal Lahir", d.ttl || "-"],
            ["Jenis Kelamin", d.jk || "-"],
            ["Agama", d.agama || "-"],
            ["Status Perkawinan", d.status_nikah || "-"],
            ["Pekerjaan", d.pekerjaan || "-"],
            ["Alamat Domisili", `Perumahan Mabu Park Blok ${d.blok || '-'} No. ${d.no || '-'}, RT.010/RW.002, Desa Aweh, Kec. Kalanganyar, Kab. Lebak`],
            ["Keperluan Surat", d.keperluan || d.detail || "-"]
        ];
        rows.forEach(r => {
            docPdf.setFont("helvetica", "normal");
            docPdf.text(r[0], 25, yPos);
            docPdf.text(":", 73, yPos);
            docPdf.setFont("helvetica", (r[0] === "Nama Lengkap" || r[0] === "Keperluan Surat") ? "bold" : "normal");
            const valLines = docPdf.splitTextToSize(String(r[1]), 112);
            docPdf.text(valLines, 77, yPos);
            yPos += (valLines.length * 6.5) + 1.5;
        });

        yPos += 4;
        docPdf.setFont("helvetica", "normal");
        const penutup = "Orang tersebut di atas adalah benar warga kami yang berdomisili di lingkungan RT. 010 RW. 002 Perumahan Mabu Park. Demikian surat pengantar ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.";
        docPdf.text(docPdf.splitTextToSize(penutup, 170), 20, yPos);

        yPos += 25;
        const tglIndo = tglSkrg.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        docPdf.text(`Kalanganyar, ${tglIndo}`, 145, yPos, { align: "center" });
        docPdf.text("Ketua RT. 010 / RW. 002", 145, yPos + 6, { align: "center" });

        docPdf.setDrawColor(0, 138, 15);
        docPdf.setTextColor(0, 138, 15);
        docPdf.setLineWidth(0.6);
        docPdf.circle(122, yPos + 18, 12, 'S');
        docPdf.setLineWidth(0.2);
        docPdf.circle(122, yPos + 18, 10.5, 'S');
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(6.5);
        docPdf.text("PENGURUS RT. 010", 122, yPos + 15.5, { align: "center" });
        docPdf.text("RW. 002 MABU PARK", 122, yPos + 18.5, { align: "center" });
        docPdf.text("TERVERIFIKASI", 122, yPos + 21.5, { align: "center" });

        docPdf.setTextColor(0, 0, 0);
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.text(KETUA_RT_NAMA, 145, yPos + 30, { align: "center" });
        docPdf.setLineWidth(0.4);
        docPdf.setDrawColor(0, 0, 0);
        docPdf.line(118, yPos + 31, 172, yPos + 31);

        const fileName = `Surat_Pengantar_RT010_${(d.nama || 'Warga').replace(/[^a-z0-9]/gi, '_')}.pdf`;
        docPdf.save(fileName);
        showToast("📄 Surat PDF berhasil diunduh!");
    } catch (err) {
        console.error("[cetakSuratPDF]", err);
        showToast("Gagal membuat PDF.", true);
    }
};

/* ============================ POLLING ============================ */
let activePollDoc = null;

window.loadPollingUtama = async function () {
    const cont = document.getElementById('pollingHomeContainer');
    if (!cont || !auth.currentUser || !firebaseReady) return;
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'polling'), orderBy('timestamp', 'desc')));
        if (s.empty) { cont.classList.add('hidden'); return; }
        activePollDoc = { id: s.docs[0].id, ...s.docs[0].data() };
        cont.classList.remove('hidden');
        const tEl = document.getElementById('pollHomeTitle');
        if (tEl) tEl.innerText = activePollDoc.judul || 'Musyawarah Warga';

        const opsiList = activePollDoc.opsi || [];
        const votesMap = activePollDoc.votes || {};
        const myVote = votesMap[auth.currentUser.uid];
        const totalSuara = Object.keys(votesMap).length;
        const totEl = document.getElementById('pollHomeTotal');
        if (totEl) totEl.innerText = `Total Partisipasi: ${totalSuara} suara`;

        let h = '';
        opsiList.forEach((op, idx) => {
            const countOpsi = Object.values(votesMap).filter(v => v === op).length;
            const persen = totalSuara > 0 ? Math.round((countOpsi / totalSuara) * 100) : 0;
            const isMyChoice = myVote === op;
            h += `<div onclick="kirimSuaraPolling('${idx}')" class="bg-white border ${isMyChoice ? 'border-purple-600 ring-2 ring-purple-200' : 'border-purple-200'} rounded-xl p-2.5 cursor-pointer hover:bg-purple-50/40 transition">
                <div class="flex justify-between items-center text-xs font-semibold text-slate-800 mb-1">
                    <span>${isMyChoice ? '<i class="fa-solid fa-circle-check text-purple-600 mr-1"></i>' : ''}${escapeHtml(op)}</span>
                    <span class="text-[11px] font-bold text-purple-700">${persen}% (${countOpsi})</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div class="bg-purple-600 h-full transition-all duration-500" style="width: ${persen}%"></div>
                </div>
            </div>`;
        });
        const opt = document.getElementById('pollHomeOptions');
        if (opt) opt.innerHTML = h;
    } catch (e) {
        cont.classList.add('hidden');
    }
};

window.kirimSuaraPolling = async function (opsiIdx) {
    if (!activePollDoc || !auth.currentUser) return;
    const pilihan = activePollDoc.opsi[Number(opsiIdx)];
    if (!pilihan) return;
    try {
        const fieldVote = `votes.${auth.currentUser.uid}`;
        await updateDoc(doc(db, 'artifacts', appId, 'polling', activePollDoc.id), { [fieldVote]: pilihan });
        showToast(`🗳️ Suara tercatat: "${pilihan}"`);
        loadPollingUtama();
    } catch (e) { showToast("Gagal menyimpan suara.", true); }
};

window.buatPollingBaru = async function () {
    const jEl = document.getElementById('pollJudulInput');
    const oEl = document.getElementById('pollOpsiInput');
    const judul = jEl ? jEl.value.trim() : '';
    const opsiRaw = oEl ? oEl.value.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!judul || opsiRaw.length < 2) return showToast("Isi judul & minimal 2 pilihan (pisahkan koma)!", true);
    try {
        await addDoc(collection(db, 'artifacts', appId, 'polling'), { judul, opsi: opsiRaw, votes: {}, timestamp: Date.now() });
        if (jEl) jEl.value = '';
        if (oEl) oEl.value = '';
        showToast("e-Voting berhasil diterbitkan!");
        loadAdminPolling();
        loadPollingUtama();
    } catch (e) { showToast("Gagal membuat polling.", true); }
};

window.loadAdminPolling = async function () {
    const cont = document.getElementById('adminPollingList');
    if (!cont) return;
    cont.innerHTML = 'Loading...';
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'polling'), orderBy('timestamp', 'desc')));
        let h = '';
        s.forEach(d => {
            const p = d.data();
            const total = p.votes ? Object.keys(p.votes).length : 0;
            h += `<div class="p-3 border border-slate-200 rounded-xl bg-white flex justify-between items-center">
                <div class="min-w-0">
                    <h4 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(p.judul)}</h4>
                    <p class="text-[11px] text-slate-500 truncate">Opsi: ${escapeHtml((p.opsi || []).join(', '))} • <b>${total} Suara</b></p>
                </div>
                <button onclick="hapusPolling('${d.id}')" class="w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-xs text-slate-500 text-center">Belum ada e-Voting aktif.</p>';
    } catch (e) { cont.innerHTML = 'Gagal memuat.'; }
};

window.hapusPolling = async function (id) {
    if (!confirm("Hapus polling ini?")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'polling', id));
        showToast("Polling dihapus.");
        loadAdminPolling();
        loadPollingUtama();
    } catch (e) { /* silent */ }
};

/* ============================ UMKM ============================ */
window.openUmkmModal = () => {
    loadUmkmWarga();
    showModal('umkmModal', 'umkmModalContent');
};

window.toggleUmkmForm = (show) => {
    const f = document.getElementById('umkmForm');
    if (!f) return;
    if (show) {
        f.classList.remove('hidden');
    } else {
        f.classList.add('hidden');
        f.reset();
        document.getElementById('umkmImgPreview')?.classList.add('hidden');
        document.getElementById('umkmImgIcon')?.classList.remove('hidden');
        document.getElementById('umkmImgText')?.classList.remove('hidden');
        const b = document.getElementById('umkmBase64');
        if (b) b.value = '';
    }
};

window.submitUmkm = async function (e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    const nm = document.getElementById('umkmNamaBarang')?.value;
    const hrg = document.getElementById('umkmHarga')?.value;
    const desk = document.getElementById('umkmDeskripsi')?.value || '';
    const img = document.getElementById('umkmBase64')?.value || '';
    try {
        const u = window.currentUserData || {};
        await addDoc(collection(db, 'artifacts', appId, 'pasar'), {
            sellerId: auth.currentUser.uid,
            sellerName: u.nama || 'Warga',
            sellerBlok: `${u.blok || '-'}/${u.no || '-'}`,
            namaBarang: nm, harga: hrg, deskripsi: desk,
            imageBase64: img, timestamp: Date.now()
        });
        showToast("Dagangan diposting!");
        toggleUmkmForm(false);
        loadUmkmWarga();
    } catch (err) { showToast("Gagal memposting dagangan.", true); }
};

window.loadUmkmWarga = async function () {
    const cont = document.getElementById('umkmListContainer');
    if (!cont || !firebaseReady) return;
    cont.innerHTML = '<div class="col-span-2 text-center py-5 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'pasar'), orderBy('timestamp', 'desc')));
        let h = '';
        s.forEach(d => {
            const b = d.data();
            const isMe = auth.currentUser && b.sellerId === auth.currentUser.uid;
            const isAdmin = window.currentUserData && window.currentUserData.role === 'Admin RT';
            const hrgFmt = formatRupiah(b.harga || 0);
            const safeSeller = String(b.sellerName || 'Warga').replace(/'/g, "\\'");
            const safeBarang = String(b.namaBarang || 'Produk').replace(/'/g, "\\'");
            h += `<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
                ${(isMe || isAdmin) ? `<button onclick="hapusUmkm('${d.id}')" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs shadow z-10"><i class="fa-solid fa-trash"></i></button>` : ''}
                <div class="h-32 bg-slate-100 w-full overflow-hidden flex justify-center items-center">
                    ${b.imageBase64 ? `<img onclick="lihatGambarModal('${safeBarang}', '${b.imageBase64.replace(/'/g, "%27")}')" src="${b.imageBase64}" class="w-full h-full object-cover cursor-pointer">` : `<i class="fa-solid fa-store text-3xl text-slate-300"></i>`}
                </div>
                <div class="p-3 flex-1 flex flex-col">
                    <h4 class="font-bold text-sm text-slate-800 leading-tight mb-1 line-clamp-2">${escapeHtml(b.namaBarang)}</h4>
                    <p class="text-orange-600 font-bold text-sm mb-2">${hrgFmt}</p>
                    <p class="text-[10px] text-slate-500 mb-2 flex-1 line-clamp-2">${escapeHtml(b.deskripsi)}</p>
                    <div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <div class="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex justify-center items-center text-[10px] font-bold shrink-0">${escapeHtml((b.sellerName || 'W').charAt(0))}</div>
                            <span class="text-[10px] font-medium text-slate-600 truncate max-w-[70px]">${escapeHtml(b.sellerName || 'Warga')}</span>
                        </div>
                        ${!isMe ? `<button onclick="bukaRuangJapri('${b.sellerId}', '${safeSeller}', '${escapeHtml(b.sellerBlok || '-')}', 'Halo, saya mau pesan ${safeBarang} (${hrgFmt}).')" class="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-700 transition shrink-0">Beli</button>` : `<span class="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Lapak Anda</span>`}
                    </div>
                </div>
            </div>`;
        });
        cont.innerHTML = h || '<div class="col-span-2 text-center text-slate-500 py-5 text-sm">Belum ada dagangan warga.</div>';
    } catch (e) {
        cont.innerHTML = '<div class="col-span-2 text-center text-red-500 py-5 text-xs">Gagal memuat.</div>';
    }
};

window.hapusUmkm = async function (id) {
    if (!confirm("Hapus dagangan ini?")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'pasar', id));
        showToast("Dihapus.");
        loadUmkmWarga();
    } catch (e) { /* silent */ }
};

/* ============================ IURAN ============================ */
window.openIuranModal = () => {
    initDropdownIuran();
    const u = window.currentUserData || {};
    const el1 = document.getElementById('kartuIuranNama');
    const el2 = document.getElementById('kartuIuranBlok');
    const el3 = document.getElementById('kartuIuranNominalAktif');
    if (el1) el1.innerText = u.nama || 'Warga';
    if (el2) el2.innerText = `Blok ${u.blok || '-'} / No. ${u.no || '-'}`;
    if (el3) el3.innerText = formatRupiah(nominalIuranDefault) + ' / bln';
    loadIuranUser();
    showModal('iuranModal', 'iuranModalContent');
};

window.loadIuranUser = async function () {
    const cont = document.getElementById('iuranListContainer');
    if (!cont || !auth.currentUser || !firebaseReady) return;
    cont.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-slate-400 text-2xl"></i></div>';
    try {
        const s = await getDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid));
        const dataIuran = (s.exists() && s.data().iuran) || {};
        const dataNominal = (s.exists() && s.data().iuranNominal) || {};
        let h = '';
        DAFTAR_BULAN_IURAN.forEach(bln => {
            const status = dataIuran[bln];
            const isLunas = ['L', 'LK', 'LA', 'LC', 'P', 'T'].includes(status);
            const nomBln = dataNominal[bln] || nominalIuranDefault;
            h += `<div class="p-3.5 border ${isLunas ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'} rounded-xl flex justify-between items-center shadow-sm">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex justify-center items-center shrink-0 ${isLunas ? 'bg-emerald-600 text-white' : 'bg-red-50 text-red-500'}">
                        <i class="fa-solid ${isLunas ? 'fa-check' : 'fa-clock'} text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm ${isLunas ? 'text-emerald-900' : 'text-slate-800'}">${bln}</h4>
                        <p class="text-[11px] ${isLunas ? 'text-emerald-700 font-semibold' : 'text-slate-500'}">Iuran: ${formatRupiah(nomBln)}</p>
                    </div>
                </div>
                <span class="px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 ${isLunas ? 'bg-emerald-600 text-white' : 'bg-red-100 text-red-600'}">${isLunas ? '✓ LUNAS' : 'BELUM'}</span>
            </div>`;
        });
        cont.innerHTML = h;
    } catch (e) {
        cont.innerHTML = '<p class="text-center text-red-500 text-xs">Gagal memuat kartu iuran.</p>';
    }
};

window.simpanNominalDefault = async function () {
    const aNom = document.getElementById('adminNominalIuran');
    if (!aNom) return;
    nominalIuranDefault = Number(aNom.value);
    try {
        await setDoc(doc(db, 'artifacts', appId, 'kas', 'config_iuran'), {
            nominalDefault: nominalIuranDefault, updatedAt: Date.now()
        }, { merge: true });
        showToast(`Nominal aktif: ${formatRupiah(nominalIuranDefault)}`);
    } catch (e) { /* silent */ }
};

window.kirimPengingatIuran = async function () {
    const bln = document.getElementById('adminBulanIuran')?.value;
    const nom = document.getElementById('adminNominalIuran')?.value;
    if (!bln || !nom) return;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'kas', 'config_iuran'), {
            nominalDefault: Number(nom),
            reminderBulan: bln,
            reminderNominal: Number(nom),
            reminderTimestamp: Date.now()
        }, { merge: true });
        showToast(`🔔 Pengingat iuran ${bln} (${formatRupiah(nom)}) dikirim!`);
    } catch (e) { showToast("Gagal mengirim pengingat.", true); }
};

window.loadAdminIuran = async function () {
    initDropdownIuran();
    const blnSelect = document.getElementById('adminBulanIuran');
    if (!blnSelect) return;
    const selectedBln = blnSelect.value;
    const cont = document.getElementById('adminIuranWargaList');
    if (!cont) return;
    cont.innerHTML = 'Loading...';
    try {
        const s = await getDocs(collection(db, 'artifacts', appId, 'users'));
        let h = '';
        s.forEach(d => {
            const u = d.data();
            const statusSaatIni = (u.iuran && u.iuran[selectedBln]) || 'BL';
            const nomTercatat = (u.iuranNominal && u.iuranNominal[selectedBln]) !== undefined
                ? Number(u.iuranNominal[selectedBln]) : 0;
            const safeNama = String(u.nama || 'Warga').replace(/'/g, "\\'");
            const safeBlok = escapeHtml(u.blok || '-');
            const safeNo = escapeHtml(u.no || '-');

            let optNominal = '';
            for (let i = 0; i <= 135000; i += 5000) {
                optNominal += `<option value="${i}" ${nomTercatat === i ? 'selected' : ''}>${formatRupiah(i)}</option>`;
            }

            h += `<div class="p-3 border border-slate-200 rounded-xl flex flex-col gap-2 mb-2 bg-white shadow-sm">
                <div class="flex justify-between items-start">
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(u.nama || 'Warga')}</h4>
                        <p class="text-[11px] text-slate-500">Blok ${safeBlok}/${safeNo}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[11px] font-bold px-2 py-0.5 rounded ${statusSaatIni !== 'BL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">${escapeHtml(statusSaatIni)}</p>
                        <p class="text-[10px] text-slate-500 font-semibold mt-0.5">${formatRupiah(nomTercatat)}</p>
                    </div>
                </div>
                <div class="flex items-center justify-between border-t border-slate-100 pt-2 mt-1 gap-2">
                    <select id="stat_${d.id}" onchange="simpanIuranWarga('${d.id}', '${selectedBln}', '${safeNama}', '${safeBlok}', '${safeNo}', true)" class="w-1/2 text-[11px] font-bold border border-slate-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50">
                        <option value="BL" ${statusSaatIni === 'BL' ? 'selected' : ''}>BL - Belum</option>
                        <option value="L" ${statusSaatIni === 'L' ? 'selected' : ''}>L - Huni</option>
                        <option value="LK" ${statusSaatIni === 'LK' ? 'selected' : ''}>LK - Kosong</option>
                        <option value="LA" ${statusSaatIni === 'LA' ? 'selected' : ''}>LA - Non-Air</option>
                        <option value="LC" ${statusSaatIni === 'LC' ? 'selected' : ''}>LC - CCTV</option>
                        <option value="P" ${statusSaatIni === 'P' ? 'selected' : ''}>P - Pengurus</option>
                        <option value="A" ${statusSaatIni === 'A' ? 'selected' : ''}>A - Abai</option>
                        <option value="T" ${statusSaatIni === 'T' ? 'selected' : ''}>T - Tdk Mampu</option>
                    </select>
                    <select id="nom_${d.id}" onchange="simpanIuranWarga('${d.id}', '${selectedBln}', '${safeNama}', '${safeBlok}', '${safeNo}', false)" class="w-1/2 text-[11px] font-bold border border-slate-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50">
                        ${optNominal}
                    </select>
                </div>
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-xs text-slate-500 text-center">Data warga kosong.</p>';
    } catch (e) {
        cont.innerHTML = 'Gagal memuat.';
    }
};

window.simpanIuranWarga = async function (uid, bulan, nama, blok, no, isStatusChange) {
    const statEl = document.getElementById('stat_' + uid);
    const nomEl = document.getElementById('nom_' + uid);
    if (!statEl || !nomEl) return;
    let statusCode = statEl.value;
    let nomValue = Number(nomEl.value);
    if (isStatusChange) {
        const DAFTAR_NOMINAL = { 'L': 100000, 'LK': 50000, 'LA': 70000, 'LC': 80000, 'P': 0, 'A': 0, 'BL': 0, 'T': 0 };
        if (DAFTAR_NOMINAL[statusCode] !== undefined) {
            nomValue = DAFTAR_NOMINAL[statusCode];
            nomEl.value = nomValue;
        }
    }
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', uid), {
            [`iuran.${bulan}`]: statusCode,
            [`iuranNominal.${bulan}`]: nomValue
        });
        const payloadIuran = {
            action: "update_iuran", nama, blok, no_rumah: no, bulan,
            nominal: nomValue, status: statusCode,
            waktu: new Date().toLocaleString('id-ID')
        };
        if (GOOGLE_SCRIPT_URL) fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payloadIuran) }).catch(() => {});
        showToast(`Tersimpan: ${statusCode} (${formatRupiah(nomValue)})`);
        loadAdminIuran();
    } catch (e) { showToast("Gagal update iuran.", true); }
};

/* ============================ REALTIME LISTENERS ============================ */
function mulaiPantau(user) {
    if (!firebaseReady || !db) return;
    unSubs.forEach(u => { try { u(); } catch (e) {} });
    unSubs = [];
    cekTombolNotifikasi();

    let initL = true;
    try { unSubs.push(onSnapshot(collection(db, 'artifacts', appId, 'laporan'), (s) => {
        if (initL) { initL = false; return; }
        s.docChanges().forEach(c => {
            if (c.type === 'added' && c.doc.data().userId !== user.uid) {
                const lap = c.doc.data();
                if (lap.layanan && lap.layanan.startsWith('DARURAT SOS')) {
                    bunyikanSireneDarurat();
                    kirimNotifikasiPesan(`🚨 ${lap.layanan}`, `${lap.nama} (Blok ${lap.blok}/${lap.no}) butuh bantuan!`);
                } else {
                    kirimNotifikasiPesan(`Laporan Baru`, lap.layanan || 'Laporan');
                }
                const admView = document.getElementById('admViewLaporan');
                if (admView && !admView.classList.contains('hidden')) loadAdminLaporan();
            }
        });
    }, (e) => console.warn("[laporan listener]", e))); } catch (e) {}

    let initC = true;
    try { unSubs.push(onSnapshot(collection(db, 'artifacts', appId, 'chats'), (s) => {
        allChatMessages = [];
        s.forEach(d => allChatMessages.push(Object.assign({ id: d.id }, d.data())));
        renderChatMessages();
        if (initC) { initC = false; return; }
        s.docChanges().forEach(c => {
            const m = c.doc.data();
            const isRT = window.currentUserData && window.currentUserData.role === 'Admin RT';
            if (c.type === 'added' && m.senderId !== user.uid && (m.roomId === 'GLOBAL' || m.recipientId === user.uid || isRT)) {
                const msgText = m.text || (m.imageUrl ? '[Foto]' : '[Stiker]');
                if (msgText.includes('SINYAL DARURAT SOS')) bunyikanSireneDarurat();
                kirimNotifikasiPesan(`Chat: ${m.senderName}`, msgText);
                const cv = document.getElementById('chatView');
                if (cv && cv.classList.contains('hidden')) updateChatBadge(unreadChatCount + 1);
            }
        });
    }, (e) => console.warn("[chat listener]", e))); } catch (e) {}

    let initP = true;
    try { unSubs.push(onSnapshot(collection(db, 'artifacts', appId, 'pengumuman'), (s) => {
        if (initP) { initP = false; return; }
        s.docChanges().forEach(c => {
            if (c.type === 'added') {
                loadPengumumanUtama();
                const isRT = window.currentUserData && window.currentUserData.role === 'Admin RT';
                if (!isRT) kirimNotifikasiPesan(`Pengumuman RT`, c.doc.data().judul);
            }
        });
    }, (e) => console.warn("[pengumuman listener]", e))); } catch (e) {}

    try { unSubs.push(onSnapshot(collection(db, 'artifacts', appId, 'polling'), () => { loadPollingUtama(); }, () => {})); } catch (e) {}

    try { unSubs.push(onSnapshot(doc(db, 'artifacts', appId, 'kas', 'config_sos'), (snap) => {
        const d = snap.exists() ? snap.data() : { enabled: true };
        isFiturSOSEnabled = d.enabled !== false;
        const bHead = document.getElementById('btnHeaderSOS');
        const bHome = document.getElementById('btnHomeSOS');
        const cbAdmin = document.getElementById('toggleFiturSOSCheckbox');
        if (cbAdmin) cbAdmin.checked = isFiturSOSEnabled;
        if (isFiturSOSEnabled) {
            if (bHead) bHead.classList.remove('hidden');
            if (bHome) bHome.classList.remove('hidden');
        } else {
            if (bHead) bHead.classList.add('hidden');
            if (bHome) bHome.classList.add('hidden');
        }
        const alertBanner = document.getElementById('sosActiveAlertBanner');
        const statusTxt = document.getElementById('adminStatusSOSText');
        const isRT = window.currentUserData && ['Admin RT', 'Pengurus RT', 'Bendahara', 'Sekretaris'].includes(window.currentUserData.role);
        const btnStopBanner = document.getElementById('btnAdminStopSOSBanner');
        if (btnStopBanner) btnStopBanner.classList.toggle('hidden', !isRT);
        if (d.activeSOS && d.activeSOS.jenis) {
            if (alertBanner) {
                const t = document.getElementById('sosAlertTitle');
                const desc = document.getElementById('sosAlertDesc');
                if (t) t.innerText = `DARURAT: ${d.activeSOS.jenis}!`;
                if (desc) desc.innerText = `Pelapor: ${d.activeSOS.nama} (${d.activeSOS.blok}) butuh bantuan!`;
                alertBanner.classList.remove('hidden');
            }
            if (statusTxt) statusTxt.innerText = `🚨 DARURAT AKTIF: ${d.activeSOS.jenis} oleh ${d.activeSOS.nama} (${d.activeSOS.blok})`;
        } else {
            if (alertBanner) alertBanner.classList.add('hidden');
            if (statusTxt) statusTxt.innerText = "Aman. Tidak ada sinyal darurat aktif.";
        }
    }, () => {})); } catch (e) {}

    try { unSubs.push(onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid), (snap) => {
        if (!snap.exists()) return;
        window.currentUserData = snap.data();
        const iuranMod = document.getElementById('iuranModal');
        if (iuranMod && !iuranMod.classList.contains('hidden')) loadIuranUser();
    }, () => {})); } catch (e) {}

    let initK = true;
    try { unSubs.push(onSnapshot(doc(db, 'artifacts', appId, 'kas', 'config_iuran'), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        if (d.nominalDefault) nominalIuranDefault = d.nominalDefault;
        if (d.reminderBulan) {
            const myIuran = (window.currentUserData && window.currentUserData.iuran) || {};
            const sudahLunas = ['L', 'LK', 'LA', 'LC', 'P', 'T'].includes(myIuran[d.reminderBulan]);
            const banner = document.getElementById('iuranReminderBanner');
            if (!sudahLunas && banner) {
                const t = document.getElementById('iuranReminderTitle');
                const txt = document.getElementById('iuranReminderText');
                if (t) t.innerText = `Pengingat Iuran ${d.reminderBulan}`;
                if (txt) txt.innerText = `Iuran ${formatRupiah(d.reminderNominal || nominalIuranDefault)} belum tercatat lunas.`;
                banner.classList.remove('hidden');
                if (!initK) kirimNotifikasiPesan(`Pengingat Iuran ${d.reminderBulan}`, `Mohon cek Kartu Iuran Anda.`);
            } else if (banner) {
                banner.classList.add('hidden');
            }
        }
        initK = false;
    }, () => {})); } catch (e) {}

    let initH = true;
    try { unSubs.push(onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), (s) => {
        if (initH) { initH = false; return; }
        s.docChanges().forEach(c => {
            if (c.type === 'modified') {
                kirimNotifikasiPesan(`Status Update`, `Permohonan ${c.doc.data().layanan}: ${c.doc.data().status}`);
                const rv = document.getElementById('riwayatView');
                if (rv && !rv.classList.contains('hidden')) loadRiwayat();
            }
        });
    }, () => {})); } catch (e) {}
}

/* ============================ AUTH ============================ */
if (firebaseReady && auth) {
    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid));
                window.currentUserData = snap.exists()
                    ? snap.data()
                    : { nama: user.email.split('@')[0], role: 'Warga' };
                showAppScreen();
                prefillFormData();
                perbaruiStatusUI_Fingerprint();
                loadPengumumanUtama();
                loadPollingUtama();
                mulaiPantau(user);
            } else {
                showAuthScreen();
            }
        } catch (e) {
            console.error("[onAuthStateChanged]", e);
            showAuthScreen();
        }
    });
} else {
    setTimeout(() => {
        if (typeof showToast === 'function') {
            showToast("Gagal memuat aplikasi. Periksa koneksi & refresh.", true);
        }
    }, 800);
    showAuthScreen();
}

window.setLoginRole = function (role) {
    const w = document.getElementById('tabWarga');
    const a = document.getElementById('tabAdmin');
    const e = document.getElementById('loginEmailContainer');
    const mail = document.getElementById('loginEmail');
    if (role === 'admin') {
        if (a) a.className = "flex-1 py-2.5 text-sm font-bold bg-white shadow-sm rounded-xl text-emerald-600 transition-all";
        if (w) w.className = "flex-1 py-2.5 text-sm font-semibold text-slate-500 rounded-xl transition-all";
        if (e) e.classList.add('hidden');
        if (mail) mail.value = 'rt';
    } else {
        if (w) w.className = "flex-1 py-2.5 text-sm font-bold bg-white shadow-sm rounded-xl text-emerald-600 transition-all";
        if (a) a.className = "flex-1 py-2.5 text-sm font-semibold text-slate-500 rounded-xl transition-all";
        if (e) e.classList.remove('hidden');
        if (mail) mail.value = '';
    }
};

window.switchAuthView = function (view) {
    ['loginForm', 'registerForm', 'forgotForm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const vEl = document.getElementById(view + 'Form');
    if (vEl) vEl.classList.remove('hidden');
};

function showAuthScreen() {
    const m = document.getElementById('mainAppContainer');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    const a = document.getElementById('authContainer');
    if (a) { a.classList.remove('hidden'); a.classList.add('flex'); }
}

function showAppScreen() {
    const a = document.getElementById('authContainer');
    if (a) { a.classList.add('hidden'); a.classList.remove('flex'); }
    const m = document.getElementById('mainAppContainer');
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }

    const btnAd = document.getElementById('navAdminBtn');
    const isRT = window.currentUserData && ['Admin RT', 'Pengurus RT', 'Bendahara', 'Sekretaris'].includes(window.currentUserData.role);
    if (btnAd) {
        if (isRT) { btnAd.classList.remove('hidden'); btnAd.classList.add('flex'); }
        else { btnAd.classList.add('hidden'); btnAd.classList.remove('flex'); }
    }

    const nm = (window.currentUserData && window.currentUserData.nama) || 'Warga';
    const wN = document.getElementById('welcomeName');
    if (wN) wN.innerText = nm.split(' ')[0] + '!';
    const pN = document.getElementById('profNama'); if (pN) pN.innerText = nm;
    const pR = document.getElementById('profRole'); if (pR) pR.innerText = (window.currentUserData && window.currentUserData.role) || 'Warga';
    const pE = document.getElementById('profEmail'); if (pE) pE.innerText = (window.currentUserData && window.currentUserData.email) || '-';
    const pH = document.getElementById('profHp'); if (pH) pH.innerText = (window.currentUserData && window.currentUserData.hp) || '-';
    const pB = document.getElementById('profBlok'); if (pB) pB.innerText = (window.currentUserData && window.currentUserData.blok) || '-';
    const pNo = document.getElementById('profNo'); if (pNo) pNo.innerText = (window.currentUserData && window.currentUserData.no) || '-';

    const pPic = (window.currentUserData && window.currentUserData.photoBase64) || null;
    const pd = document.getElementById('profPhotoDisplay');
    const pi = document.getElementById('profIconDisplay');
    if (pPic && pd && pi) {
        pd.src = pPic; pd.classList.remove('hidden'); pi.classList.add('hidden');
    }
}

function prefillFormData() {
    try {
        const u = window.currentUserData;
        if (!u) return;
        ['stdNama', 'tlNama', 'invNama', 'spNama', 'dwNamaSingle'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = u.nama || '';
        });
        ['stdBlok', 'tlBlok', 'dwBlok', 'invBlok', 'spBlok'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = u.blok || '';
        });
        ['stdNo', 'tlNo', 'dwNo', 'invNo', 'spNo'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = u.no || '';
        });
        if (u.status_keluarga === 'Sudah Berkeluarga') {
            const radioSudah = document.querySelector('input[name="statusKeluarga"][value="Sudah Berkeluarga"]');
            if (radioSudah) {
                radioSudah.checked = true;
                const nsuEl = document.getElementById('dwNamaSuami');
                if (nsuEl) nsuEl.value = u.nama_suami || '';
                const nisEl = document.getElementById('dwNamaIstri');
                if (nisEl) nisEl.value = u.nama_istri || '';
            }
        } else {
            const radioSingle = document.querySelector('input[name="statusKeluarga"][value="Belum Berkeluarga/Single"]');
            if (radioSingle) radioSingle.checked = true;
        }
        if (window.toggleKeluargaStatus) window.toggleKeluargaStatus();
    } catch (e) { /* silent */ }
}

window.handleLogin = async function (e) {
    e.preventDefault();
    if (!firebaseReady) return showToast("Aplikasi belum siap. Refresh & coba lagi.", true);
    const mailEl = document.getElementById('loginEmail');
    const passEl = document.getElementById('loginPassword');
    const btn = document.getElementById('btnLogin');
    if (!mailEl || !passEl || !btn) return;

    const id = mailEl.value.trim();
    const pw = passEl.value;
    if (!pw) return showToast("Password wajib diisi.", true);

    btn.disabled = true;
    let em = id.includes('@') ? id : id.replace(/[^a-z0-9]/gi, '') + '@mabupark.local';

    if (id.toLowerCase() === 'rt' && pw === 'Kosong.19') {
        em = 'hilmanmabu@gmail.com';
        try {
            sessionStorage.setItem('rt10_temp_auth', JSON.stringify({ email: btoa(em), pass: btoa(pw) }));
            await signInWithEmailAndPassword(auth, em, pw);
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                try {
                    const u = await createUserWithEmailAndPassword(auth, em, pw);
                    await setDoc(doc(db, 'artifacts', appId, 'users', u.user.uid), {
                        nama: KETUA_RT_NAMA, email: em, hp: '089',
                        blok: 'RT', no: '10', role: 'Admin RT', password: pw
                    });
                    showToast("Akun RT baru berhasil dibuat & login.");
                } catch (e2) {
                    showToast("Gagal membuat akun RT: " + (e2.message || 'Cek koneksi'), true);
                }
            } else {
                showToast("Login RT gagal: Password salah atau akun sudah diubah.", true);
            }
        } finally {
            btn.disabled = false;
        }
        return;
    }

    try {
        sessionStorage.setItem('rt10_temp_auth', JSON.stringify({ email: btoa(em), pass: btoa(pw) }));
        await signInWithEmailAndPassword(auth, em, pw);
    } catch (err) {
        showToast("Login gagal. Periksa akun / password.", true);
    } finally {
        btn.disabled = false;
    }
};

window.handleRegister = async function (e) {
    e.preventDefault();
    if (!firebaseReady) return showToast("Aplikasi belum siap.", true);
    const nEl = document.getElementById('regNama');
    const eEl = document.getElementById('regEmail');
    const pEl = document.getElementById('regPassword');
    const b = document.getElementById('btnRegister');
    if (!nEl || !eEl || !pEl || !b) return;

    const nm = nEl.value.trim();
    const id = eEl.value.trim();
    const pw = pEl.value;
    if (pw.length < 6) return showToast("Password min. 6 karakter.", true);

    b.disabled = true;
    let em = id.includes('@') ? id : id.replace(/[^a-z0-9]/gi, '') + '@mabupark.local';
    try {
        sessionStorage.setItem('rt10_temp_auth', JSON.stringify({ email: btoa(em), pass: btoa(pw) }));
        const c = await createUserWithEmailAndPassword(auth, em, pw);
        const hpV = document.getElementById('regHp')?.value || '';
        const blkV = (document.getElementById('regBlok')?.value || '').toUpperCase();
        const noV = document.getElementById('regNo')?.value || '';
        await setDoc(doc(db, 'artifacts', appId, 'users', c.user.uid), {
            nama: nm, email: id, hp: hpV, blok: blkV, no: noV, role: 'Warga',
            password: pw // Menyimpan password untuk fitur lupa password
        });
        showToast("Daftar sukses!");
    } catch (err) {
        showToast("Gagal mendaftar: akun mungkin sudah terdaftar.", true);
    } finally {
        b.disabled = false;
    }
};

window.handleForgot = async function (e) {
    e.preventDefault();
    if (!firebaseReady) return showToast("Aplikasi belum siap.", true);
    const em = document.getElementById('forgotEmail')?.value.trim();
    const btn = document.getElementById('btnForgot');
    if (!em) return;
    if (btn) { btn.disabled = true; btn.innerText = "Mencari..."; }
    
    try {
        const s = await getDocs(collection(db, 'artifacts', appId, 'users'));
        let foundPass = null;
        let foundName = null;
        
        s.forEach(d => {
            const u = d.data();
            const cleanEmail = u.email ? u.email.replace(/[^a-z0-9]/gi, '') : '';
            const cleanInput = em.replace(/[^a-z0-9]/gi, '');
            
            if ((u.email && u.email.toLowerCase() === em.toLowerCase()) || 
                (cleanEmail && cleanEmail === cleanInput) || 
                (u.email && u.email.toLowerCase() === em.toLowerCase() + '@mabupark.local')) {
                foundPass = u.password;
                foundName = u.nama;
            }
        });

        if (foundPass) {
            alert(`Halo ${foundName || 'Warga'},\n\nPassword Anda saat ini adalah: ${foundPass}\n\nMohon simpan dengan baik dan jangan bagikan ke orang lain.`);
            showToast("Password berhasil ditemukan!");
            switchAuthView('login');
        } else {
            const sAll = await getDocs(collection(db, 'artifacts', appId, 'users'));
            let hasUser = false;
            sAll.forEach(d => {
               const u = d.data();
               if (u.email && u.email.toLowerCase() === em.toLowerCase()) hasUser = true;
            });
            
            if (hasUser) {
                showToast("Akun lama terdeteksi, password tidak tersimpan. Hubungi Pengurus RT.", true);
            } else {
                showToast("Email / Akun tidak ditemukan di sistem.", true);
            }
        }
    } catch (err) {
        showToast("Gagal mencari data.", true);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Tampilkan Password"; }
    }
};

window.handleLogout = async function () {
    try {
        unSubs.forEach(u => { try { u(); } catch (e) {} });
        unSubs = [];
        await signOut(auth);
        closeModal('profileModal', 'profileModalContent');
        showToast("Logout berhasil.");
    } catch (e) {
        showToast("Logout gagal.", true);
    }
};

/* ============================ PROFILE ============================ */
window.toggleEditProfile = function (isEdit) {
    const vMode = document.getElementById('profileViewMode');
    const eMode = document.getElementById('profileEditMode');
    if (isEdit) {
        if (vMode) vMode.classList.add('hidden');
        if (eMode) eMode.classList.remove('hidden');
        const eN = document.getElementById('editNama'); if (eN) eN.value = (window.currentUserData && window.currentUserData.nama) || '';
        const eH = document.getElementById('editHp'); if (eH) eH.value = (window.currentUserData && window.currentUserData.hp) || '';
        const eB = document.getElementById('editBlok'); if (eB) eB.value = (window.currentUserData && window.currentUserData.blok) || '';
        const eNo = document.getElementById('editNo'); if (eNo) eNo.value = (window.currentUserData && window.currentUserData.no) || '';
        const pPic = (window.currentUserData && window.currentUserData.photoBase64) || null;
        const ePrev = document.getElementById('editPhotoPreview');
        const eIco = document.getElementById('editIconPreview');
        const eB64 = document.getElementById('editPhotoBase64');
        if (pPic && ePrev && eIco && eB64) {
            ePrev.src = pPic; ePrev.classList.remove('hidden');
            eIco.classList.add('hidden'); eB64.value = pPic;
        }
    } else {
        if (vMode) vMode.classList.remove('hidden');
        if (eMode) eMode.classList.add('hidden');
    }
};

window.handleDocPhoto = function (e, prevId, icoId, hidId) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        const i = new Image();
        i.onload = () => {
            const c = document.createElement('canvas');
            let w = i.width, h = i.height;
            if (w > h && w > 800) { h *= 800 / w; w = 800; }
            else if (h > 800) { w *= 800 / h; h = 800; }
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(i, 0, 0, w, h);
            const b64 = c.toDataURL('image/jpeg', 0.6);
            const prev = document.getElementById(prevId);
            if (prev) { prev.src = b64; prev.classList.remove('hidden'); }
            const ico = document.getElementById(icoId);
            if (ico) ico.classList.add('hidden');
            const hid = document.getElementById(hidId);
            if (hid) hid.value = b64;
        };
        i.src = ev.target.result;
    };
    r.readAsDataURL(f);
};

window.handleProfilePhoto = e => window.handleDocPhoto(e, 'editPhotoPreview', 'editIconPreview', 'editPhotoBase64');

window.saveProfile = async function (e) {
    e.preventDefault();
    try {
        const nV = document.getElementById('editNama')?.value.trim() || '';
        const hV = document.getElementById('editHp')?.value.trim() || '';
        const bV = (document.getElementById('editBlok')?.value || '').toUpperCase();
        const noV = document.getElementById('editNo')?.value || '';
        const pbV = document.getElementById('editPhotoBase64')?.value || '';
        const u = { nama: nV, hp: hV, blok: bV, no: noV, photoBase64: pbV };
        await setDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid), u, { merge: true });
        window.currentUserData = Object.assign({}, window.currentUserData, u);
        showAppScreen();
        toggleEditProfile(false);
        showToast("Tersimpan.");
    } catch (e) {
        showToast("Gagal menyimpan.", true);
    }
};

/* ============================ ORDER MODAL & FORM ============================ */
window.openModal = function (srv) {
    try {
        const mT = document.getElementById('modalTitle');
        if (mT) mT.innerText = srv === 'Surat Menyurat' ? 'Surat Pengantar RT' : srv;
        const sT = document.getElementById('serviceType');
        if (sT) sT.value = srv;
        const mF = document.getElementById('mainForm');
        if (mF) mF.reset();
        prefillFormData();
        if (window.toggleKeluargaStatus) window.toggleKeluargaStatus();
        ['stdBukti', 'dwKtp', 'dwKk'].forEach(p => {
            const img = document.getElementById(p + 'Preview');
            const ico = document.getElementById(p + 'Icon');
            const b64 = document.getElementById(p + 'Base64');
            if (img) { img.src = ''; img.classList.add('hidden'); }
            if (ico) ico.classList.remove('hidden');
            if (b64) b64.value = '';
        });
        ['standardForm', 'suratPengantarForm', 'tanyaLaporForm', 'dataWargaForm'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });
        if (srv === 'Isi Data Warga') document.getElementById('dataWargaForm')?.classList.remove('hidden');
        else if (srv === 'Tanya & Lapor RT') document.getElementById('tanyaLaporForm')?.classList.remove('hidden');
        else if (srv === 'Surat Menyurat') document.getElementById('suratPengantarForm')?.classList.remove('hidden');
        else document.getElementById('standardForm')?.classList.remove('hidden');
        showModal('orderModal', 'modalContent');
    } catch (err) {
        showToast("Terjadi kesalahan sistem.", true);
    }
};

window.openProfileModal = () => {
    if (window.toggleEditProfile) window.toggleEditProfile(false);
    perbaruiStatusUI_Fingerprint();
    showModal('profileModal', 'profileModalContent');
};

window.openInventarisModal = () => {
    const f = document.getElementById('inventarisForm');
    if (f) f.reset();
    prefillFormData();
    loadInventarisWarga();
    showModal('inventarisModal', 'inventarisModalContent');
};

window.submitForm = async function (e) {
    e.preventDefault();
    if (!auth.currentUser) return showToast("Silakan login ulang.", true);
    const stEl = document.getElementById('serviceType');
    const srv = stEl ? stEl.value : '';
    const b = e.target.querySelector('button[type="submit"]');
    if (b) b.disabled = true;
    let dObj = { layanan: srv, waktu: new Date().toLocaleString('id-ID') };
    let suratData = null;

    try {
        if (srv === 'Isi Data Warga') {
            const sk = document.querySelector('input[name="statusKeluarga"]:checked')?.value || '';
            const sr = document.querySelector('input[name="statusRumah"]:checked')?.value || '';
            const k = document.querySelector('input[name="statusKtp"]:checked')?.value || '';
            const nsEl = document.getElementById('dwNamaSingle');
            const nsuEl = document.getElementById('dwNamaSuami');
            const nisEl = document.getElementById('dwNamaIstri');
            const nm = sk === 'Belum Berkeluarga/Single' ? (nsEl?.value || '') : (nsuEl?.value || '');
            const bEl = document.getElementById('dwBlok');
            const noEl = document.getElementById('dwNo');
            const alEl = document.getElementById('dwAlamat');
            const agEl = document.getElementById('dwAgama');
            const jwEl = document.getElementById('dwJiwa');
            const ktpB = document.getElementById('dwKtpBase64');
            const kkB = document.getElementById('dwKkBase64');
            dObj = Object.assign(dObj, {
                nama: nm, blok: bEl?.value || '', no_rumah: noEl?.value || '',
                detail: `Pembaruan Data (${sk})`,
                status_keluarga: sk, status_rumah: sr,
                nama_suami: nsuEl?.value || '', nama_istri: nisEl?.value || '',
                alamat_semula: alEl?.value || '', agama: agEl?.value || '',
                status_ktp: k, jumlah_jiwa: jwEl?.value || '',
                foto_ktp: ktpB?.value || null, foto_kk: kkB?.value || null
            });
            await setDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid), {
                foto_ktp: dObj.foto_ktp, foto_kk: dObj.foto_kk
            }, { merge: true });
        } else if (srv === 'Surat Menyurat') {
            const kepPilihan = document.getElementById('spKeperluanSelect')?.value || '';
            const kepFinal = kepPilihan === 'Lainnya'
                ? (document.getElementById('spKeperluanLain')?.value || '')
                : kepPilihan;
            suratData = {
                nama: document.getElementById('spNama')?.value.trim() || '',
                nik: document.getElementById('spNik')?.value.trim() || '',
                ttl: document.getElementById('spTtl')?.value.trim() || '',
                jk: document.getElementById('spJk')?.value || '',
                agama: document.getElementById('spAgama')?.value || '',
                status_nikah: document.getElementById('spStatusNikah')?.value || '',
                pekerjaan: document.getElementById('spPekerjaan')?.value.trim() || '',
                blok: (document.getElementById('spBlok')?.value || '').toUpperCase().trim(),
                no: document.getElementById('spNo')?.value.trim() || '',
                keperluan: kepFinal
            };
            dObj = Object.assign(dObj, {
                nama: suratData.nama, blok: suratData.blok, no_rumah: suratData.no,
                detail: `Surat Pengantar: ${kepFinal} (NIK: ${suratData.nik})`
            });
        } else if (srv === 'Tanya & Lapor RT') {
            const nEl = document.getElementById('tlNama');
            const bEl = document.getElementById('tlBlok');
            const noEl = document.getElementById('tlNo');
            const jEl = document.getElementById('tlJenis');
            const dEl = document.getElementById('tlDetail');
            dObj = Object.assign(dObj, {
                nama: nEl?.value || '', blok: bEl?.value || '', no_rumah: noEl?.value || '',
                jenis_laporan: jEl?.value || '',
                detail: (jEl?.value || '') + ' - ' + (dEl?.value || '')
            });
        } else {
            const nEl = document.getElementById('stdNama');
            const bEl = document.getElementById('stdBlok');
            const noEl = document.getElementById('stdNo');
            const dEl = document.getElementById('stdDetail');
            const fEl = document.getElementById('stdBuktiBase64');
            dObj = Object.assign(dObj, {
                nama: nEl?.value || '', blok: bEl?.value || '', no_rumah: noEl?.value || '',
                detail: dEl?.value || '', foto_bukti: fEl?.value || null
            });
        }
        if (GOOGLE_SCRIPT_URL) {
            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(dObj) }).catch(() => {});
        }
        await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'history'), {
            layanan: srv, timestamp: Date.now(), detail: dObj.detail,
            suratData, foto_bukti: dObj.foto_bukti || null,
            foto_ktp: dObj.foto_ktp || null, foto_kk: dObj.foto_kk || null,
            status: 'Menunggu'
        });
        await addDoc(collection(db, 'artifacts', appId, 'laporan'), {
            userId: auth.currentUser.uid, nama: dObj.nama, blok: dObj.blok,
            no: dObj.no_rumah, layanan: srv, detail: dObj.detail, timestamp: Date.now()
        });
        showToast("Permohonan terkirim ke Pengurus RT.");
        closeModal('orderModal', 'modalContent');
        const rv = document.getElementById('riwayatView');
        if (rv && !rv.classList.contains('hidden')) loadRiwayat();
    } catch (e) {
        showToast("Gagal mengirim laporan.", true);
    } finally {
        if (b) b.disabled = false;
    }
};

window.submitInventaris = async function (e) {
    e.preventDefault();
    const cbs = document.querySelectorAll('.inv-checkbox:checked');
    if (cbs.length === 0) return showToast("Pilih minimal 1 barang.", true);
    if (!auth.currentUser) return;
    const b = e.target.querySelector('button[type="submit"]');
    if (b) b.disabled = true;
    const itm = [];
    cbs.forEach(c => itm.push(c.value));
    try {
        const dt = `Pinjam: ${itm.join(', ')}`;
        const nEl = document.getElementById('invNama');
        const bEl = document.getElementById('invBlok');
        const noEl = document.getElementById('invNo');
        await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'history'), {
            layanan: 'Inventaris', timestamp: Date.now(), detail: dt, status: 'Menunggu'
        });
        await addDoc(collection(db, 'artifacts', appId, 'laporan'), {
            userId: auth.currentUser.uid, nama: nEl?.value || '',
            blok: bEl?.value || '', no: noEl?.value || '',
            layanan: 'Inventaris', detail: dt, timestamp: Date.now()
        });
        showToast("Permintaan terkirim.");
        closeModal('inventarisModal', 'inventarisModalContent');
        const rv = document.getElementById('riwayatView');
        if (rv && !rv.classList.contains('hidden')) loadRiwayat();
    } catch (e) {
        showToast("Gagal mengirim.", true);
    } finally {
        if (b) b.disabled = false;
    }
};

window.toggleKeluargaStatus = function () {
    const st = document.querySelector('input[name="statusKeluarga"]:checked')?.value || 'Belum Berkeluarga/Single';
    const fB = document.getElementById('formBelumKeluarga');
    const fS = document.getElementById('formSudahKeluarga');
    if (st === 'Belum Berkeluarga/Single') {
        fB?.classList.remove('hidden');
        fS?.classList.add('hidden');
    } else {
        fB?.classList.add('hidden');
        fS?.classList.remove('hidden');
    }
};

/* ============================ ADMIN ============================ */
window.openAdminModal = function () {
    const isRT = window.currentUserData && ['Admin RT', 'Pengurus RT', 'Bendahara', 'Sekretaris'].includes(window.currentUserData.role);
    if (!isRT) return showToast("Akses ditolak.", true);
    showModal('adminModal', 'adminModalContent');
    switchAdminTab('warga');
};

window.switchAdminTab = function (t) {
    ['Warga', 'Laporan', 'Iuran', 'Kas', 'Polling', 'Sos', 'Inventaris', 'Pengumuman'].forEach(x => {
        const v = document.getElementById('admView' + x);
        const b = document.getElementById('tabAdm' + x);
        if (x.toLowerCase() === t) {
            if (v) { v.classList.remove('hidden'); v.classList.add('block'); }
            if (b) b.className = "flex-1 whitespace-nowrap px-3 py-2 text-xs font-bold bg-white text-emerald-600 rounded-xl shadow-sm";
        } else {
            if (v) { v.classList.add('hidden'); v.classList.remove('block'); }
            if (b) b.className = "flex-1 whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-500 rounded-xl";
        }
    });
    if (t === 'warga') loadAdminWargaList();
    else if (t === 'laporan') loadAdminLaporan();
    else if (t === 'pengumuman') loadAdminPengumuman();
    else if (t === 'inventaris') loadAdminInventaris();
    else if (t === 'polling') loadAdminPolling();
    else if (t === 'kas') loadBukuKas();
    else if (t === 'iuran') loadAdminIuran();
};

window.toggleAdminAddWarga = function (show) {
    const f = document.getElementById('adminAddWargaForm');
    const b = document.getElementById('btnToggleAddWarga');
    if (!f || !b) return;
    if (show) { f.classList.remove('hidden'); b.classList.add('hidden'); }
    else {
        f.classList.add('hidden'); b.classList.remove('hidden');
        f.reset();
        const p = document.getElementById('admNewPass');
        if (p) p.value = 'warga010';
    }
};

window.simpanWargaBaruAdmin = async function (e) {
    e.preventDefault();
    if (!firebaseReady) return showToast("Aplikasi belum siap.", true);
    const nm = document.getElementById('admNewNama')?.value.trim();
    const hp = document.getElementById('admNewHp')?.value.trim();
    const blok = (document.getElementById('admNewBlok')?.value || '').toUpperCase().trim();
    const no = document.getElementById('admNewNo')?.value.trim();
    const role = document.getElementById('admNewRole')?.value || 'Warga';
    const rawId = document.getElementById('admNewEmail')?.value.trim();
    const pw = document.getElementById('admNewPass')?.value;
    const btn = document.getElementById('btnSubmitNewWarga');

    if (!nm || !rawId || !pw || pw.length < 6) return showToast("Lengkapi data & password min. 6 karakter!", true);
    if (btn) { btn.disabled = true; btn.innerText = "Mendaftarkan..."; }

    const emailFinal = rawId.includes('@') ? rawId : rawId.replace(/[^a-z0-9]/gi, '') + '@mabupark.local';

    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFinal, pw);
        const newUid = cred.user.uid;
        await signOut(secondaryAuth).catch(() => {});
        await setDoc(doc(db, 'artifacts', appId, 'users', newUid), {
            nama: nm, email: rawId, hp, blok, no, role, createdAt: Date.now(),
            password: pw // Menyimpan password untuk fitur lupa password
        });
        showToast(`✅ Warga "${nm}" berhasil ditambahkan!`);
        toggleAdminAddWarga(false);
        loadAdminWargaList();
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            const customId = 'warga_' + Date.now();
            try {
                await setDoc(doc(db, 'artifacts', appId, 'users', customId), {
                    nama: nm, email: rawId, hp, blok, no, role, createdAt: Date.now(),
                    password: pw // Menyimpan password untuk fitur lupa password
                });
                showToast(`✅ Data warga "${nm}" ditambahkan.`);
                toggleAdminAddWarga(false);
                loadAdminWargaList();
            } catch (e2) {
                showToast("Gagal menambah warga.", true);
            }
        } else {
            showToast("Gagal: " + (err.message || 'Periksa input'), true);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Simpan & Buat Akun Warga"; }
    }
};

async function loadAdminWargaList() {
    const cont = document.getElementById('adminWargaList');
    if (!cont || !firebaseReady) return;
    cont.innerHTML = 'Loading...';
    try {
        const s = await getDocs(collection(db, 'artifacts', appId, 'users'));
        let h = '';
        s.forEach(d => {
            const u = d.data();
            const dStr = safeEncode({
                nama: u.nama || '', hp: u.hp || '', blok: u.blok || '', no: u.no || '', role: u.role || ''
            });
            h += `<div class="warga-card p-3 border border-slate-200 rounded-xl bg-white flex items-center gap-3">
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(u.nama || 'Warga')}</h3>
                    <p class="text-xs text-slate-500 truncate">Blok ${escapeHtml(u.blok || '-')}/${escapeHtml(u.no || '-')} • HP: ${escapeHtml(u.hp || '-')} • <span class="font-semibold text-emerald-600">${escapeHtml(u.role || 'Warga')}</span></p>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="openAdminEditModal('${d.id}', '${dStr}')" class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-200 transition"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="hapusLaporanWarga('${d.id}', null, 'warga')" class="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-center text-xs text-slate-400 py-4">Belum ada data warga.</p>';
    } catch (e) { cont.innerHTML = 'Gagal memuat.'; }
}

window.filterWarga = function () {
    const input = (document.getElementById('searchWarga')?.value || '').toLowerCase();
    document.querySelectorAll('.warga-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(input) ? 'flex' : 'none';
    });
};

async function loadAdminLaporan() {
    const cont = document.getElementById('adminLaporanList');
    if (!cont || !firebaseReady) return;
    cont.innerHTML = 'Loading...';
    try {
        const r = [];
        const us = await getDocs(collection(db, 'artifacts', appId, 'users'));
        for (let i = 0; i < us.docs.length; i++) {
            const u = us.docs[i];
            const hs = await getDocs(collection(db, 'artifacts', appId, 'users', u.id, 'history'));
            hs.forEach(h => r.push(Object.assign({
                docId: h.id, userId: u.id,
                userName: u.data().nama, userBlok: u.data().blok
            }, h.data())));
        }
        r.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        let h = '';
        r.forEach(x => {
            let pdfBtn = '';
            const isSelesai = x.status === 'Selesai';
            if (x.layanan === 'Surat Menyurat' && isSelesai) {
                const payloadPdf = safeEncode(Object.assign({
                    nama: x.userName, blok: x.userBlok, detail: x.detail,
                    timestamp: x.timestamp, approvedAt: x.approvedAt
                }, x.suratData || {}));
                pdfBtn = `<button onclick="cetakSuratPDF('${payloadPdf}')" class="text-[10px] bg-emerald-600 text-white px-2.5 py-1 rounded font-bold hover:bg-emerald-700 transition"><i class="fa-solid fa-file-pdf mr-1"></i>Unduh PDF</button>`;
            }
            h += `<div class="p-3 bg-white border border-slate-200 rounded-xl shadow-sm mb-2">
                <div class="flex justify-between items-start mb-1">
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-slate-800">${escapeHtml(x.layanan)}</h4>
                        <p class="text-[10px] text-slate-500">${escapeHtml(x.userName)} (Blok ${escapeHtml(x.userBlok)})</p>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${isSelesai ? 'bg-emerald-100 text-emerald-700' : x.status === 'Diproses' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}">${escapeHtml(x.status || 'Menunggu')}</span>
                </div>
                <p class="text-xs mb-2 text-slate-600">${escapeHtml(x.detail || '-')}</p>
                ${x.foto_bukti ? `<img onclick="lihatGambarModal('Bukti', '${x.foto_bukti.replace(/'/g, "%27")}')" src="${x.foto_bukti}" class="h-20 rounded mb-2 cursor-pointer border border-slate-200">` : ''}
                <div class="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2 bg-slate-50 p-2 rounded-lg">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" ${isSelesai ? 'checked' : ''} onchange="toggleVerifikasiAdmin('${x.userId}', '${x.docId}', this.checked)" class="w-4 h-4 accent-emerald-600 rounded cursor-pointer">
                        <span class="text-xs font-bold ${isSelesai ? 'text-emerald-700' : 'text-slate-700'}">
                            ${isSelesai ? '✓ Terverifikasi' : 'Centang untuk Verifikasi'}
                        </span>
                    </label>
                    ${pdfBtn}
                    <button onclick="hapusLaporanWarga('${x.userId}', '${x.docId}', 'laporan')" class="text-xs text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-xs text-slate-400 text-center py-4">Belum ada laporan.</p>';
    } catch (e) { cont.innerHTML = '<p class="text-xs text-red-500 text-center">Gagal memuat laporan.</p>'; }
}

window.toggleVerifikasiAdmin = async function (userId, docId, isChecked) {
    const statusBaru = isChecked ? 'Selesai' : 'Diproses';
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'history', docId), {
            status: statusBaru, approvedBy: KETUA_RT_NAMA, approvedAt: Date.now()
        });
        showToast(isChecked ? "✅ Berhasil diverifikasi!" : "Verifikasi dibatalkan.");
        loadAdminLaporan();
    } catch (err) {
        showToast("Gagal memperbarui status.", true);
        loadAdminLaporan();
    }
};

window.updateLaporanStatus = async (uid, did, st) => {
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', uid, 'history', did), {
            status: st, approvedBy: KETUA_RT_NAMA, approvedAt: Date.now()
        });
        showToast(st === 'Selesai' ? "Disetujui! PDF siap diunduh." : "Status diubah.");
        loadAdminLaporan();
    } catch (e) { /* silent */ }
};

window.hapusLaporanWarga = async (uid, did, type) => {
    if (!confirm("Yakin hapus?")) return;
    try {
        if (type === 'laporan') await deleteDoc(doc(db, 'artifacts', appId, 'users', uid, 'history', did));
        else await deleteDoc(doc(db, 'artifacts', appId, 'users', uid));
        showToast("Dihapus.");
        if (type === 'laporan') loadAdminLaporan();
        else loadAdminWargaList();
    } catch (e) { /* silent */ }
};

window.openAdminEditModal = (uid, data) => {
    try {
        const d = safeDecode(data);
        const uidE = document.getElementById('adminEditUid'); if (uidE) uidE.value = uid;
        const nE = document.getElementById('aEditNama'); if (nE) nE.value = d.nama || '';
        const hE = document.getElementById('aEditHp'); if (hE) hE.value = d.hp || '';
        const bE = document.getElementById('aEditBlok'); if (bE) bE.value = d.blok || '';
        const noE = document.getElementById('aEditNo'); if (noE) noE.value = d.no || '';
        const rE = document.getElementById('aEditRole'); if (rE) rE.value = d.role || 'Warga';
        showModal('adminEditModal', 'adminEditModalContent');
    } catch (e) {
        showToast("Gagal memuat data warga.", true);
    }
};

window.saveAdminEdit = async (e) => {
    e.preventDefault();
    try {
        const uid = document.getElementById('adminEditUid')?.value;
        const nm = document.getElementById('aEditNama')?.value || '';
        const hp = document.getElementById('aEditHp')?.value || '';
        const b = (document.getElementById('aEditBlok')?.value || '').toUpperCase();
        const no = document.getElementById('aEditNo')?.value || '';
        const r = document.getElementById('aEditRole')?.value || 'Warga';
        await setDoc(doc(db, 'artifacts', appId, 'users', uid), {
            nama: nm, hp, blok: b, no, role: r
        }, { merge: true });
        showToast("Disimpan.");
        closeAdminEditModal();
        loadAdminWargaList();
    } catch (e) { showToast("Gagal menyimpan.", true); }
};

window.loadAdminPengumuman = async function () {
    const cont = document.getElementById('adminPengumumanList');
    if (!cont) return;
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'pengumuman'), orderBy('timestamp', 'desc')));
        let h = '';
        s.forEach(d => {
            h += `<div class="p-2.5 border border-slate-200 rounded-xl bg-white flex justify-between items-start mb-2 gap-2">
                <div class="min-w-0">
                    <h4 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(d.data().judul)}</h4>
                    <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(d.data().isi)}</p>
                </div>
                <button onclick="hapusPengumuman('${d.id}')" class="text-red-500 shrink-0 w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-xs text-slate-400 text-center py-3">Belum ada pengumuman.</p>';
    } catch (e) { /* silent */ }
};

window.postPengumuman = async function () {
    try {
        const jEl = document.getElementById('pengJudul');
        const iEl = document.getElementById('pengIsi');
        const judul = jEl?.value.trim();
        const isi = iEl?.value.trim();
        if (!judul || !isi) return showToast("Judul & isi wajib diisi.", true);
        await addDoc(collection(db, 'artifacts', appId, 'pengumuman'), {
            judul, isi, timestamp: Date.now()
        });
        showToast("Diposting.");
        if (jEl) jEl.value = '';
        if (iEl) iEl.value = '';
        loadAdminPengumuman();
        loadPengumumanUtama();
    } catch (e) { showToast("Gagal memposting.", true); }
};

window.hapusPengumuman = async function (id) {
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'pengumuman', id));
        showToast("Dihapus.");
        loadAdminPengumuman();
        loadPengumumanUtama();
    } catch (e) { /* silent */ }
};

window.loadPengumumanUtama = async function () {
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'pengumuman'), orderBy('timestamp', 'desc')));
        const pc = document.getElementById('pengumumanContainer');
        if (!s.empty) {
            const d = s.docs[0].data();
            const pj = document.getElementById('pengumumanJudul');
            const pi = document.getElementById('pengumumanIsi');
            if (pj) pj.innerText = d.judul;
            if (pi) pi.innerText = d.isi;
            if (pc) pc.classList.remove('hidden');
        } else {
            if (pc) pc.classList.add('hidden');
        }
    } catch (e) { /* silent */ }
};

/* ============================ INVENTARIS ============================ */
window.loadAdminInventaris = async function () {
    const cont = document.getElementById('adminInventarisList');
    if (!cont) return;
    cont.innerHTML = 'Loading...';
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'inventaris'), orderBy('timestamp', 'asc')));
        let h = '';
        s.forEach(d => {
            h += `<div class="p-2 border border-slate-200 rounded-xl bg-white flex justify-between items-center mb-2">
                <div class="min-w-0">
                    <h4 class="font-bold text-sm text-slate-800 truncate">${escapeHtml(d.data().nama)}</h4>
                    <p class="text-[10px] text-slate-500 truncate">${escapeHtml(d.data().detail || '-')}</p>
                </div>
                <button onclick="hapusInventaris('${d.id}')" class="text-red-500 w-8 h-8 flex items-center justify-center bg-red-50 rounded-lg hover:bg-red-100 shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-xs text-slate-500 text-center">Belum ada barang. Klik "Muat 13 Bawaan".</p>';
    } catch (e) { cont.innerHTML = '<p class="text-xs text-red-500">Gagal memuat.</p>'; }
};

window.tambahInventaris = async function () {
    const nEl = document.getElementById('invBaruNama');
    const dEl = document.getElementById('invBaruDetail');
    const nm = nEl?.value.trim();
    const dt = dEl?.value.trim() || '';
    if (!nm) return showToast("Nama barang wajib diisi!", true);
    try {
        await addDoc(collection(db, 'artifacts', appId, 'inventaris'), { nama: nm, detail: dt, timestamp: Date.now() });
        showToast("Barang ditambahkan.");
        if (nEl) nEl.value = '';
        if (dEl) dEl.value = '';
        loadAdminInventaris();
    } catch (e) { showToast("Gagal menambah.", true); }
};

window.hapusInventaris = async function (id) {
    if (!confirm("Hapus barang ini?")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'inventaris', id));
        showToast("Barang dihapus.");
        loadAdminInventaris();
    } catch (e) { showToast("Gagal menghapus.", true); }
};

window.muatBarangBawaan = async function () {
    const btn = document.getElementById('btnMuatBawaan');
    if (btn) { btn.disabled = true; btn.innerText = "Memuat..."; }
    const b = [
        { nama: "Gerobak", detail: "" },
        { nama: "Linggis", detail: "" },
        { nama: "Mesin potong rumput (Unit 1)", detail: "Tersedia 2 unit" },
        { nama: "Mesin potong rumput (Unit 2)", detail: "Tersedia 2 unit" },
        { nama: "Alat semprot tanaman elektrik", detail: "" },
        { nama: "Karpet", detail: "" },
        { nama: "Tenda 1", detail: "RUSAK - Patungan dengan RT 9" },
        { nama: "Kursi Plastik", detail: "Tersedia 30 pcs" },
        { nama: "Kabel + Lampu", detail: "" },
        { nama: "Garpu tanah kecil", detail: "" },
        { nama: "Pacul", detail: "" },
        { nama: "Speaker Aktif", detail: "" },
        { nama: "Sekop", detail: "" },
        { nama: "Megaphone", detail: "" }
    ];
    try {
        for (let i = 0; i < b.length; i++) {
            await addDoc(collection(db, 'artifacts', appId, 'inventaris'), {
                nama: b[i].nama, detail: b[i].detail, timestamp: Date.now() + i
            });
        }
        showToast("Daftar barang berhasil dimuat!");
        loadAdminInventaris();
    } catch (e) {
        showToast("Gagal memuat.", true);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Muat 13 Bawaan"; }
    }
};

window.loadInventarisWarga = async function () {
    const cont = document.getElementById('inventarisDynamicList');
    if (!cont) return;
    cont.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-slate-400"></i></div>';
    try {
        const s = await getDocs(query(collection(db, 'artifacts', appId, 'inventaris'), orderBy('timestamp', 'asc')));
        let h = '', i = 1;
        s.forEach(d => {
            const data = d.data();
            h += `<label class="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-emerald-50 transition bg-white">
                <div class="min-w-0">
                    <span class="font-medium text-sm text-slate-800 block truncate">${i}. ${escapeHtml(data.nama)}</span>
                    ${data.detail ? `<span class="text-[10px] text-slate-500 mt-0.5 block truncate">${escapeHtml(data.detail)}</span>` : ''}
                </div>
                <input type="checkbox" value="${escapeHtml(data.nama)}" class="w-5 h-5 border-slate-300 rounded inv-checkbox shrink-0 ml-2">
            </label>`;
            i++;
        });
        cont.innerHTML = h || '<p class="text-sm text-center text-slate-500 py-4">Belum ada barang.</p>';
    } catch (e) {
        cont.innerHTML = '<p class="text-xs text-center text-red-500 py-4">Gagal memuat.</p>';
    }
};

/* ============================ SWITCH TAB & RIWAYAT ============================ */
window.switchTab = function (t) {
    ['homeView', 'chatView', 'riwayatView'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['navBerandaBtn', 'navChatBtn', 'navRiwayatBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('text-emerald-600'); el.classList.add('text-slate-400'); }
    });

    if (t === 'riwayat') {
        document.getElementById('riwayatView')?.classList.remove('hidden');
        const nr = document.getElementById('navRiwayatBtn');
        if (nr) { nr.classList.remove('text-slate-400'); nr.classList.add('text-emerald-600'); }
        loadRiwayat();
    } else if (t === 'chat') {
        document.getElementById('chatView')?.classList.remove('hidden');
        const nc = document.getElementById('navChatBtn');
        if (nc) { nc.classList.remove('text-slate-400'); nc.classList.add('text-emerald-600'); }
        updateChatBadge(0);
        renderChatMessages();
    } else {
        document.getElementById('homeView')?.classList.remove('hidden');
        const nb = document.getElementById('navBerandaBtn');
        if (nb) { nb.classList.remove('text-slate-400'); nb.classList.add('text-emerald-600'); }
    }
};

window.loadRiwayat = async function () {
    const cont = document.getElementById('riwayatListContainer');
    if (!cont || !auth.currentUser) return;
    cont.innerHTML = 'Loading...';
    try {
        const s = await getDocs(query(
            collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'history'),
            orderBy('timestamp', 'desc')
        ));
        let h = '';
        const u = window.currentUserData || {};
        s.forEach(d => {
            const item = d.data();
            const l = item.layanan;
            const stat = item.status || 'Menunggu';
            const bg = stat === 'Selesai' ? 'bg-emerald-100 text-emerald-700'
                : stat === 'Diproses' ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700';

            let btnDownloadPdf = '';
            if (l === 'Surat Menyurat' && stat === 'Selesai') {
                const payloadPdf = safeEncode(Object.assign({
                    nama: u.nama || 'Warga', blok: u.blok || '-', no: u.no || '-',
                    detail: item.detail, timestamp: item.timestamp, approvedAt: item.approvedAt
                }, item.suratData || {}));
                btnDownloadPdf = `<button onclick="cetakSuratPDF('${payloadPdf}')" class="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow flex items-center justify-center gap-2 transition"><i class="fa-solid fa-file-pdf text-sm"></i> Download Surat PDF</button>`;
            }

            h += `<div class="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="font-bold text-sm text-slate-800">${l === 'Surat Menyurat' ? 'Surat Pengantar RT' : escapeHtml(l)}</h4>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${bg}">${escapeHtml(stat)}</span>
                </div>
                <p class="text-xs text-slate-500 mt-1">${new Date(item.timestamp).toLocaleString('id-ID')}</p>
                ${item.detail ? `<p class="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">${escapeHtml(item.detail)}</p>` : ''}
                ${btnDownloadPdf}
            </div>`;
        });
        cont.innerHTML = h || '<p class="text-xs text-slate-400 text-center py-5">Belum ada riwayat.</p>';
    } catch (e) { cont.innerHTML = 'Gagal memuat.'; }
};

/* ============================ PWA INSTALL & SW ============================ */
let dPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    dPrompt = e;
    if (localStorage.getItem('pwaDismissed') === 'true') return;
    setTimeout(() => document.getElementById('pwaBanner')?.classList.remove('hidden'), 2000);
});

window.hidePwaBanner = () => {
    document.getElementById('pwaBanner')?.classList.add('hidden');
    localStorage.setItem('pwaDismissed', 'true');
};

window.installPwa = async () => {
    hidePwaBanner();
    if (dPrompt) {
        dPrompt.prompt();
        await dPrompt.userChoice;
        dPrompt = null;
    }
};

window.refreshAppUpdate = function () {
    const banner = document.getElementById('updateBanner');
    if (banner) banner.classList.add('hidden');
    if (pendingUpdateWorker) {
        pendingUpdateWorker.postMessage({ action: 'skipWaiting' });
        setTimeout(() => window.location.reload(), 600);
    } else {
        window.location.reload();
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        if (swRegistered) return;
        swRegistered = true;
        navigator.serviceWorker.register('sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        pendingUpdateWorker = newWorker;
                        const banner = document.getElementById('updateBanner');
                        if (banner) banner.classList.remove('hidden');
                    }
                });
            });
        }).catch(err => console.warn("[SW register]", err));
    });
}
