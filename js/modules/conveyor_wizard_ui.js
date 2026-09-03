/**
 * conveyor_wizard_ui.js
 * ProposalApp - Akıllı Konveyör Çizim & BOM Kullanıcı Arayüzü Yöneticisi
 */

export let isConveyorDrawingActive = false;
export let activeConveyorPathData = null; // En son çizilen veya seçili polyline verisi

export function initConveyorWizardUI() {
    createConveyorBOMModal();
    createConveyorBuilderModal();
    createConveyorHUD();
}

/**
 * 1. "Güzergah Çiz (Path Drawer)" Butonu Tıklandığında
 */
export function toggleConveyorPathDrawer() {
    if (typeof window.startConveyorPathDrawing === 'function') {
        window.startConveyorPathDrawing();
    } else {
        if (typeof showNotice === 'function') {
            showNotice('📐 Konveyör Güzergah Çizim Modu Başlatılıyor...');
        }
    }
}

/**
 * 2. "Hat BOM / Metraj" Butonu Tıklandığında
 */
export function openConveyorBOMModal() {
    const modal = document.getElementById('modal-conveyor-bom');
    if (!modal) return;

    if (!activeConveyorPathData || !activeConveyorPathData.nodes || activeConveyorPathData.nodes.length < 2) {
        if (typeof showNotice === 'function') {
            showNotice('⚠️ Henüz çizilmiş bir konveyör güzergahı bulunamadı. Lütfen önce "Güzergah Çiz" butonuna basarak bir hat belirleyin.');
        }
        return;
    }

    if (typeof window.calculateAndRenderConveyorBOM === 'function') {
        window.calculateAndRenderConveyorBOM(activeConveyorPathData);
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

export function closeConveyorBOMModal() {
    const modal = document.getElementById('modal-conveyor-bom');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

/**
 * 3. "3D Konveyör İnşa Et" Butonu Tıklandığında
 */
export function openConveyorBuilderModal() {
    const modal = document.getElementById('modal-conveyor-builder');
    if (!modal) return;

    if (!activeConveyorPathData || !activeConveyorPathData.nodes || activeConveyorPathData.nodes.length < 2) {
        if (typeof showNotice === 'function') {
            showNotice('⚠️ Henüz çizilmiş bir konveyör güzergahı bulunamadı. Lütfen önce "Güzergah Çiz" butonuna basarak bir hat belirleyin.');
        }
        return;
    }

    const summaryEl = document.getElementById('conveyor-builder-path-summary');
    if (summaryEl && activeConveyorPathData) {
        const totalL = activeConveyorPathData.totalLength || 0;
        const turnCount = (activeConveyorPathData.turns || []).length;
        summaryEl.innerText = `Seçili Hat: ${activeConveyorPathData.nodes.length} Nokta | Toplam: ${totalL.toFixed(2)}m | ${turnCount} Adet Viraj/Dönüş`;
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

export function closeConveyorBuilderModal() {
    const modal = document.getElementById('modal-conveyor-builder');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export function setActiveConveyorPathData(data) {
    activeConveyorPathData = data;
    updateConveyorRibbonBadge();
}

export function updateConveyorRibbonBadge() {
    const badge = document.getElementById('conveyor-path-status-badge');
    if (!badge) return;

    if (activeConveyorPathData && activeConveyorPathData.totalLength > 0) {
        badge.innerText = `📍 ${activeConveyorPathData.totalLength.toFixed(1)}m Hat Hazır`;
        badge.className = 'bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded font-mono text-[10px] border border-cyan-500/40';
    } else {
        badge.innerText = 'Hat Yok';
        badge.className = 'bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono text-[10px] border border-gray-700';
    }
}

/**
 * 4. Çizim Sırasında Ekranda Görünen HUD Bilgi Paneli
 */
function createConveyorHUD() {
    if (document.getElementById('conveyor-draw-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'conveyor-draw-hud';
    hud.className = 'hidden fixed top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-4 py-2 rounded-xl shadow-2xl border border-cyan-500/60 z-50 flex items-center gap-4 text-xs backdrop-blur-md';
    hud.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="animate-pulse text-cyan-400 text-sm">📐</span>
            <span class="font-bold text-cyan-300">Konveyör Güzergah Çizimi:</span>
            <span id="conveyor-draw-hud-info" class="text-gray-300">DXF veya zemin üzerine tıklayarak güzergahı oluşturun</span>
        </div>
        <div class="flex items-center gap-2 border-l border-gray-700 pl-3">
            <span class="text-[10px] text-gray-400">Canlı Hat:</span>
            <span id="conveyor-draw-hud-len" class="font-mono font-bold text-green-400 text-sm">0.00 m</span>
        </div>
        <div class="flex items-center gap-1.5 ml-2">
            <button onclick="window.finishConveyorPathDrawing && window.finishConveyorPathDrawing()" type="button"
                class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded text-[11px] shadow cursor-pointer transition">
                ✓ Tamamla (Enter)
            </button>
            <button onclick="window.cancelConveyorPathDrawing && window.cancelConveyorPathDrawing()" type="button"
                class="bg-rose-700 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded text-[11px] shadow cursor-pointer transition">
                ✕ İptal (Esc)
            </button>
        </div>
    `;
    document.body.appendChild(hud);
}

/**
 * 5. Konveyör BOM (Maliyet & Malzeme) Modalı
 */
function createConveyorBOMModal() {
    if (document.getElementById('modal-conveyor-bom')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-conveyor-bom';
    modal.className = 'hidden fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm';
    modal.innerHTML = `
        <div class="bg-[#18181b] border border-amber-500/40 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="bg-gradient-to-r from-amber-950/80 via-zinc-900 to-zinc-900 px-5 py-3 border-b border-amber-500/30 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <span class="text-xl text-amber-400">📋</span>
                    <div>
                        <h3 class="text-sm font-bold text-white flex items-center gap-2">
                            Konveyör Güzergahı - Ön Maliyet & Malzeme (BOM) Listesi
                        </h3>
                        <p class="text-[10px] text-gray-400">3D model yüklemesi gerektirmeyen anlık metraj ve ekipman hesaplayıcı</p>
                    </div>
                </div>
                <button onclick="closeConveyorBOMModal()" class="text-gray-400 hover:text-white text-lg cursor-pointer">✕</button>
            </div>
            
            <div class="p-5 overflow-y-auto space-y-4 text-xs">
                <!-- Özet Kartları -->
                <div class="grid grid-cols-4 gap-3">
                    <div class="bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-center">
                        <span class="text-[10px] text-gray-400 uppercase font-semibold">Toplam Hat Boyu</span>
                        <p id="bom-total-length" class="text-lg font-bold text-amber-400 font-mono mt-0.5">0.0 m</p>
                    </div>
                    <div class="bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-center">
                        <span class="text-[10px] text-gray-400 uppercase font-semibold">Viraj Sayısı</span>
                        <p id="bom-turns-count" class="text-lg font-bold text-cyan-400 font-mono mt-0.5">0 Adet</p>
                    </div>
                    <div class="bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-center">
                        <span class="text-[10px] text-gray-400 uppercase font-semibold">Tahrik (Motor)</span>
                        <p id="bom-motors-count" class="text-lg font-bold text-emerald-400 font-mono mt-0.5">1 Adet</p>
                    </div>
                    <div class="bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-center">
                        <span class="text-[10px] text-gray-400 uppercase font-semibold">Tahmini Bütçe</span>
                        <p id="bom-est-cost" class="text-lg font-bold text-purple-400 font-mono mt-0.5">~0 €</p>
                    </div>
                </div>

                <!-- Detaylı Parça Listesi Tablosu -->
                <div class="border border-zinc-800 rounded-lg overflow-hidden">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-zinc-900 text-gray-400 text-[10px] uppercase font-semibold border-b border-zinc-800">
                            <tr>
                                <th class="py-2 px-3">Parça / Modül</th>
                                <th class="py-2 px-3">Standart Kod</th>
                                <th class="py-2 px-3">Özellikler</th>
                                <th class="py-2 px-3 text-right">Miktar / Metraj</th>
                            </tr>
                        </thead>
                        <tbody id="bom-table-body" class="divide-y divide-zinc-800 text-gray-300 font-mono text-[11px]">
                            <tr>
                                <td colspan="4" class="text-center py-4 text-gray-500">Güzergah hesaplanıyor...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="bg-zinc-900/90 px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
                <button onclick="closeConveyorBOMModal(); openConveyorBuilderModal();" type="button"
                    class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded text-xs transition shadow flex items-center gap-1.5 cursor-pointer">
                    <span>🏗️</span> Bu Güzergahtan 3D Konveyör Üret
                </button>
                <button onclick="closeConveyorBOMModal()" type="button"
                    class="bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-4 py-1.5 rounded text-xs transition cursor-pointer">
                    Kapat
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * 6. 3D Konveyör İnşa Et Parametre Modalı
 */
function createConveyorBuilderModal() {
    if (document.getElementById('modal-conveyor-builder')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-conveyor-builder';
    modal.className = 'hidden fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm';
    modal.innerHTML = `
        <div class="bg-[#18181b] border border-emerald-500/40 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-zinc-900 px-5 py-3 border-b border-emerald-500/30 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <span class="text-xl text-emerald-400">🏗️</span>
                    <div>
                        <h3 class="text-sm font-bold text-white">3D Konveyör İnşa Sihirbazı</h3>
                        <p class="text-[10px] text-gray-400">Çizilen polyline eksenine göre FlexLink 3D parçalarını otomatik birleştirir</p>
                    </div>
                </div>
                <button onclick="closeConveyorBuilderModal()" class="text-gray-400 hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            <div class="p-5 space-y-4 text-xs">
                <div id="conveyor-builder-path-summary" class="bg-zinc-900 border border-zinc-800 p-2.5 rounded text-emerald-400 font-mono text-[11px]">
                    Seçili Hat Bilgisi Bekleniyor...
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="block text-gray-400 mb-1 font-semibold">Konveyör Montaj Adı:</label>
                        <input id="builder-assembly-name" type="text" value="Conveyor_New"
                            class="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-gray-400 mb-1 font-semibold">Platform Tipi:</label>
                            <select id="builder-platform-type" class="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500">
                                <option value="XH" selected>XH (85 mm Standart)</option>
                                <option value="XK">XK (105 mm Geniş)</option>
                                <option value="X180">X180 (180 mm Ağır Hizmet)</option>
                                <option value="X300">X300 (300 mm Palet)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-gray-400 mb-1 font-semibold">Standart Dönüş Yarıçapı (R):</label>
                            <select id="builder-bend-radius" class="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono">
                                <option value="700" selected>R: 700 mm (Standart)</option>
                                <option value="500">R: 500 mm (Dar Dönüş)</option>
                                <option value="1000">R: 1000 mm (Geniş Dönüş)</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-gray-400 mb-1 font-semibold">Zincir Üstü Kotu (Z / Yükseklik):</label>
                            <div class="flex items-center gap-1.5">
                                <input id="builder-top-of-chain" type="number" step="50" value="850"
                                    class="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500 font-mono">
                                <span class="text-gray-400">mm</span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-gray-400 mb-1 font-semibold">Tahrik (Motor) Konumu:</label>
                            <select id="builder-drive-pos" class="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none focus:border-emerald-500">
                                <option value="head" selected>Hatta Başta (Çekici Motor)</option>
                                <option value="tail">Hatta Sonda (İtici Motor)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-zinc-900/90 px-5 py-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button onclick="closeConveyorBuilderModal()" type="button"
                    class="bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-4 py-1.5 rounded text-xs transition cursor-pointer">
                    İptal
                </button>
                <button onclick="window.executeConveyorBuild && window.executeConveyorBuild()" type="button"
                    class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-1.5 rounded text-xs transition shadow cursor-pointer">
                    🚀 Konveyörü Sahnede İnşa Et
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Global Exports
if (typeof window !== 'undefined') {
    window.toggleConveyorPathDrawer = toggleConveyorPathDrawer;
    window.openConveyorBOMModal = openConveyorBOMModal;
    window.closeConveyorBOMModal = closeConveyorBOMModal;
    window.openConveyorBuilderModal = openConveyorBuilderModal;
    window.closeConveyorBuilderModal = closeConveyorBuilderModal;
    window.initConveyorWizardUI = initConveyorWizardUI;
    window.setActiveConveyorPathData = setActiveConveyorPathData;
    window.updateConveyorRibbonBadge = updateConveyorRibbonBadge;
}
