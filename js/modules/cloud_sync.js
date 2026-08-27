/**
 * ProposalApp - Cloud Sync & Customer Projects Dropdown Module
 * Manages project saving, XML state synchronization, and customer authorized projects picker.
 */

import { showNotice } from '../utils/notice_system.js';

export function saveActiveProjectToCloud() {
    console.log("💾 Projeyi Kaydet & Senkronize Et tetiklendi...");
    
    // 1. Proje durumunu derle
    let stateData = null;
    if (typeof window.getExportableStateData === 'function') {
        stateData = window.getExportableStateData();
    }
    
    // 2. Mevcut Proje ID'sini bul
    const urlParams = new URLSearchParams(window.location.search);
    const activeProject = urlParams.get('project') || urlParams.get('xml') || 'OPP-0106989-1-R1.xml';
    
    if (stateData) {
        const jsonStr = JSON.stringify(stateData);
        // LocalStorage'a kaydet (Hem Genel hem Projeye Özel)
        localStorage.setItem('PROPOSAL_APP_SCENE_STATE', jsonStr);
        localStorage.setItem('PROPOSAL_APP_AUTOSAVE', jsonStr);
        localStorage.setItem(`PROPOSAL_APP_PROJECT_${activeProject}`, jsonStr);
        localStorage.setItem(`PROPOSAL_APP_PROJECT_${activeProject.replace('.xml','')}`, jsonStr);
        console.log(`✅ "${activeProject}" yerel depolamaya (LocalStorage) kaydedildi.`);
    }
    
    // 3. XML Dosyasını İndir
    if (typeof window.exportXmlProjectAsNewFile === 'function') {
        window.exportXmlProjectAsNewFile();
    }

    if (typeof showNotice === 'function') {
        showNotice(`💾 "${activeProject}" Projesi Başarıyla Kaydedildi! (Sayfa yenilense de korunacak)`);
    }
}

export function syncCustomerProjectsList() {
    const dropdown = document.getElementById('customer-projects-dropdown');
    if (!dropdown) return;

    const availableProjects = [
        { id: 'OPP-0106989-1-R1.xml', name: '📄 OPP-0106989-1-R1 (PLC & Konveyör Hattı)' },
        { id: 'FirmaA_Projesi.xml', name: '🏢 Firma A - Ana Depo Konveyör Tesisatı' },
        { id: 'Fabrika_v2.xml', name: '🏭 Fabrika v2 - Otomasyon & Pano Yerleşimi' }
    ];

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
    window.syncCustomerProjectsList = syncCustomerProjectsList;
    window.loadCustomerProjectFromDropdown = loadCustomerProjectFromDropdown;
}
