/**
 * ProposalApp - Cloud Sync & Custom Project Save As Module
 * Manages saving current 3D scene as a brand new named XML file and updating project picker.
 */

import { showNotice } from '../utils/notice_system.js';

export function saveActiveProjectToCloud() {
    openSaveAsNewProjectModal();
}

export function openSaveAsNewProjectModal() {
    let modal = document.getElementById('modal-save-as-project');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-save-as-project';
        modal.className = 'fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = `
            <div style="background-color: #0f172a; color: #f8fafc; border: 2px solid #06b6d4; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.95); padding: 20px; width: 90%; max-width: 440px; margin: auto;" class="space-y-4 text-xs">
                <div class="flex items-center justify-between border-b border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-cyan-400 flex items-center gap-2">
                        <span>💾</span> Sahneyi Bambaşka Bir Dosya Olarak Kaydet
                    </h3>
                    <button onclick="closeSaveAsNewProjectModal()" class="text-gray-400 hover:text-white text-base font-bold">✕</button>
                </div>
                <div class="space-y-2">
                    <label class="block text-gray-300 text-[11px] font-semibold">
                        Yeni Proje Dosya Adı (.xml):
                    </label>
                    <input id="save-as-project-name-input" type="text" value="Proje_${new Date().toISOString().slice(0,10)}.xml" class="w-full bg-gray-950 border border-gray-700 focus:border-cyan-400 rounded px-3 py-2 text-gray-100 text-xs outline-none font-mono" />
                    <p class="text-[10px] text-gray-400">Bu sahne tüm 3D yerleşimi, panoları ve kablo metrajlarıyla birlikte yepyeni bağımsız bir dosya olarak kaydedilecek.</p>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
                    <button onclick="closeSaveAsNewProjectModal()" class="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition">İptal</button>
                    <button onclick="executeSaveAsNewProject()" class="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition flex items-center gap-1">
                        <span>✨</span> Yeni Dosya Olarak Kaydet
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.style.display = 'none';
    void modal.offsetWidth; // Force Reflow
    modal.style.display = 'flex';
}

export function closeSaveAsNewProjectModal() {
    const modal = document.getElementById('modal-save-as-project');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export function executeSaveAsNewProject() {
    const inputEl = document.getElementById('save-as-project-name-input');
    let newName = inputEl ? inputEl.value.trim() : '';
    if (!newName) {
        newName = `Proje_${Date.now()}.xml`;
    }
    if (!newName.toLowerCase().endsWith('.xml')) {
        newName += '.xml';
    }

    // 1. Proje durumunu derle
    let stateData = null;
    if (typeof window.getExportableStateData === 'function') {
        stateData = window.getExportableStateData();
    }
    
    if (stateData) {
        const jsonStr = JSON.stringify(stateData);
        // Hem yeni ada hem genel hafızaya kaydet
        localStorage.setItem(`PROPOSAL_APP_PROJECT_${newName}`, jsonStr);
        localStorage.setItem(`PROPOSAL_APP_PROJECT_${newName.replace('.xml','')}`, jsonStr);
        localStorage.setItem('PROPOSAL_APP_SCENE_STATE', jsonStr);
        localStorage.setItem('PROPOSAL_APP_AUTOSAVE', jsonStr);

        // Dinamik Projelerim listesine ekle
        let userCustomProjects = JSON.parse(localStorage.getItem('PROPOSAL_APP_USER_CUSTOM_PROJECTS') || '[]');
        if (!userCustomProjects.includes(newName)) {
            userCustomProjects.push(newName);
            localStorage.setItem('PROPOSAL_APP_USER_CUSTOM_PROJECTS', JSON.stringify(userCustomProjects));
        }
    }

    // 2. Yeni XML Dosyasını İndir
    if (typeof window.exportXmlProjectAsNewFile === 'function') {
        window.exportXmlProjectAsNewFile(newName);
    }

    closeSaveAsNewProjectModal();

    if (typeof showNotice === 'function') {
        showNotice(`✨ Sahne "${newName}" Adıyla Yepyeni Dosya Olarak Kaydedildi!`);
    }

    // Yeni dosyaya geç
    setTimeout(() => {
        const currentUrlParams = new URLSearchParams(window.location.search);
        currentUrlParams.set('project', newName);
        window.location.search = currentUrlParams.toString();
    }, 800);
}

export function syncCustomerProjectsList() {
    const dropdown = document.getElementById('customer-projects-dropdown');
    if (!dropdown) return;

    let availableProjects = [
        { id: 'OPP-0106989-1-R1.xml', name: '📄 OPP-0106989-1-R1 (PLC & Konveyör Hattı)' },
        { id: 'FirmaA_Projesi.xml', name: '🏢 Firma A - Ana Depo Konveyör Tesisatı' },
        { id: 'Fabrika_v2.xml', name: '🏭 Fabrika v2 - Otomasyon & Pano Yerleşimi' }
    ];

    // Kullanıcının yeni kaydettiği özel dosyaları ekle
    const userCustomProjects = JSON.parse(localStorage.getItem('PROPOSAL_APP_USER_CUSTOM_PROJECTS') || '[]');
    userCustomProjects.forEach(customId => {
        if (!availableProjects.some(p => p.id === customId)) {
            availableProjects.push({ id: customId, name: `✨ ${customId} (Yeni Kayıtlı Projeniz)` });
        }
    });

    const currentUrlParams = new URLSearchParams(window.location.search);
    const activeProj = currentUrlParams.get('project') || 'OPP-0106989-1-R1.xml';

    let html = '';
    availableProjects.forEach(proj => {
        const isSelected = (proj.id === activeProj || proj.id.replace('.xml','') === activeProj.replace('.xml','')) ? 'selected' : '';
        html += `<option value="${proj.id}" ${isSelected}>${proj.name}</option>`;
    });

    dropdown.innerHTML = html;
}

export function loadCustomerProjectFromDropdown(projectId) {
    if (!projectId) return;
    if (typeof showNotice === 'function') {
        showNotice(`⏳ "${projectId}" projesi yükleniyor...`);
    }
    const currentUrlParams = new URLSearchParams(window.location.search);
    currentUrlParams.set('project', projectId);
    window.location.search = currentUrlParams.toString();
}

if (typeof window !== 'undefined') {
    window.saveActiveProjectToCloud = saveActiveProjectToCloud;
    window.openSaveAsNewProjectModal = openSaveAsNewProjectModal;
    window.closeSaveAsNewProjectModal = closeSaveAsNewProjectModal;
    window.executeSaveAsNewProject = executeSaveAsNewProject;
    window.syncCustomerProjectsList = syncCustomerProjectsList;
    window.loadCustomerProjectFromDropdown = loadCustomerProjectFromDropdown;
}
