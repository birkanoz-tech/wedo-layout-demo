/**
 * ProposalApp - ES6 Main Module Entry Point
 * Imports all modules and initializes application.
 */

import { init3D, onWindowResize, animate } from './core/scene_engine.js';
import { showNotice } from './utils/notice_system.js';
import { openCableLinkCreationDialog, closeCableLinkCreationDialog, openCableLinksModal, closeCableLinksModal } from './modules/cable_wiring.js';
import { openPanelDesignerModal, closePanelDesignerModal, switchPanelModalTab } from './modules/panel_designer.js';
import { openBuildingLevelsModal, closeBuildingLevelsModal } from './modules/building_levels.js';
import { saveActiveProjectToCloud, syncCustomerProjectsList, loadCustomerProjectFromDropdown } from './modules/cloud_sync.js';

console.log("⚡ ProposalApp ES6 Modular Engine Starting...");

window.addEventListener('DOMContentLoaded', () => {
    init3D();
    syncCustomerProjectsList();
    showNotice("Modüler JavaScript Motoru Başarıyla Başlatıldı! 🚀");
});
