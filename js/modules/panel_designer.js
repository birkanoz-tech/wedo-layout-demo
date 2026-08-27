/**
 * ProposalApp - Panel Designer & Properties Module
 * Handles PLC Panel parameters, connected equipments tab, and parametric panel generation.
 */

import { showNotice } from '../utils/notice_system.js';

export let activePanelModalTab = 'params';

export function openPanelDesignerModal() {
    const modal = document.getElementById('modal-panel-designer');
    if (!modal) return null;

    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.style.display = 'none';
    void modal.offsetWidth; // Force Reflow
    modal.setAttribute('style', 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background-color: rgba(0, 0, 0, 0.85) !important; align-items: center !important; justify-content: center !important;');
    
    const dialogBox = modal.querySelector('div');
    if (dialogBox) {
        dialogBox.setAttribute('style', 'background-color: #0f172a !important; color: #f8fafc !important; border: 2px solid #06b6d4 !important; border-radius: 12px !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.95) !important; position: relative !important; z-index: 1000000 !important; width: 95% !important; max-width: 900px !important; margin: auto !important;');
    }

    if (typeof showNotice === 'function') {
        showNotice('⚡ PLC Kontrol Panosu Özellikleri Açıldı');
    }

    return modal;
}

export function closePanelDesignerModal() {
    const modal = document.getElementById('modal-panel-designer');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export function switchPanelModalTab(tabName) {
    activePanelModalTab = tabName;
    const tabParams = document.getElementById('panel-modal-tab-params');
    const tabConnected = document.getElementById('panel-modal-tab-connected');
    const bodyParams = document.getElementById('panel-modal-body-params');
    const bodyConnected = document.getElementById('panel-modal-body-connected');

    if (tabName === 'connected') {
        if (tabParams) tabParams.className = 'px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 border-b-2 border-transparent transition cursor-pointer';
        if (tabConnected) tabConnected.className = 'px-3 py-1.5 text-xs font-bold text-cyan-400 border-b-2 border-cyan-400 transition cursor-pointer flex items-center gap-1.5';
        if (bodyParams) bodyParams.classList.add('hidden');
        if (bodyConnected) bodyConnected.classList.remove('hidden');
    } else {
        if (tabParams) tabParams.className = 'px-3 py-1.5 text-xs font-bold text-cyan-400 border-b-2 border-cyan-400 transition cursor-pointer flex items-center gap-1.5';
        if (tabConnected) tabConnected.className = 'px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 border-b-2 border-transparent transition cursor-pointer';
        if (bodyParams) bodyParams.classList.remove('hidden');
        if (bodyConnected) bodyConnected.classList.add('hidden');
    }
}

if (typeof window !== 'undefined') {
    window.openPanelDesignerModal = openPanelDesignerModal;
    window.closePanelDesignerModal = closePanelDesignerModal;
    window.switchPanelModalTab = switchPanelModalTab;
}
