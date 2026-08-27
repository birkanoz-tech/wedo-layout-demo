/**
 * ProposalApp - Cloud Sync & Customer Projects Dropdown Module
 * Manages project saving, XML state synchronization, and customer authorized projects picker.
 */

import { showNotice } from '../utils/notice_system.js';

export function saveActiveProjectToCloud() {
    console.log("💾 Projeyi Kaydet & Senkronize Et tetiklendi...");
    
    // Proje kaydetme fonksiyonunu çağır (exportXmlProjectAsNewFile veya localStorage senkronizasyonu)
    if (typeof window.exportXmlProjectAsNewFile === 'function') {
        window.exportXmlProjectAsNewFile();
    } else if (typeof window.scheduleAutoSave === 'function') {
        window.scheduleAutoSave();
    }

    if (typeof showNotice === 'function') {
        showNotice('💾 Projeniz Başarıyla Kaydedildi! Müşterileriniz anında görebilir.');
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

    let html = '';
    availableProjects.forEach(proj => {
        html += `<option value="${proj.id}">${proj.name}</option>`;
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
