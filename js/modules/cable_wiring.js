/**
 * ProposalApp - Cable Wiring & Cabinet Network Module
 * Manages panel-to-motor electrical cable routing, metraj calculations, and modal UI updates.
 */

import { showNotice } from '../utils/notice_system.js';

export let pathCableLinks = [];
export let activeCabinetNetworkTab = null;

export function openCableLinkCreationDialog(preSelectPanelId = null) {
    console.log("🚀 [Tetiklendi] openCableLinkCreationDialog() çalıştı. PanelID:", preSelectPanelId);
    const modal = document.getElementById('create-cable-link-modal');
    if (!modal) return null;

    // GPU Katman Reflow ve Body appendChild Zorlaması
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.style.display = 'none';
    void modal.offsetWidth; // Force Reflow
    modal.setAttribute('style', 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background-color: rgba(0, 0, 0, 0.85) !important; align-items: center !important; justify-content: center !important;');
    
    const dialogBox = modal.querySelector('div');
    if (dialogBox) {
        dialogBox.setAttribute('style', 'background-color: #0f172a !important; color: #f8fafc !important; border: 2px solid #06b6d4 !important; border-radius: 12px !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.95) !important; position: relative !important; z-index: 1000000 !important; width: 90% !important; max-width: 480px !important; margin: auto !important; padding: 20px !important;');
    }

    if (typeof showNotice === 'function') {
        showNotice('🔌 Kablo Linki Oluşturma Penceresi Açıldı');
    }

    return modal;
}

export function closeCableLinkCreationDialog() {
    const modal = document.getElementById('create-cable-link-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export function openCableLinksModal() {
    const modal = document.getElementById('cable-links-modal');
    if (modal) {
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        modal.style.display = 'none';
        void modal.offsetWidth; // Force Reflow
        modal.setAttribute('style', 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background-color: rgba(0, 0, 0, 0.85) !important; align-items: center !important; justify-content: center !important;');
        
        const dialogBox = modal.querySelector('div');
        if (dialogBox) {
            dialogBox.setAttribute('style', 'background-color: #0f172a !important; color: #f8fafc !important; border: 2px solid #06b6d4 !important; border-radius: 12px !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.95) !important; position: relative !important; z-index: 1000000 !important; width: 95% !important; max-width: 900px !important; margin: auto !important; padding: 16px !important;');
        }
    }
    return modal;
}

export function closeCableLinksModal() {
    const modal = document.getElementById('cable-links-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

if (typeof window !== 'undefined') {
    window.openCableLinkCreationDialog = openCableLinkCreationDialog;
    window.closeCableLinkCreationDialog = closeCableLinkCreationDialog;
    window.openCableLinksModal = openCableLinksModal;
    window.closeCableLinksModal = closeCableLinksModal;
}
