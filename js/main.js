/**
 * ProposalApp - ES6 Main Module Entry Point
 * Imports all modules and initializes application.
 */

import { init3D, onWindowResize, animate } from './core/scene_engine.js';
import { showNotice } from './utils/notice_system.js';
import { switchTopRibbonTab, toggleRightPropertiesPanel, toggleProductBrowserPanel } from './core/ui_controller.js';
import { openCableLinkCreationDialog, closeCableLinkCreationDialog, openCableLinksModal, closeCableLinksModal } from './modules/cable_wiring.js';
import { openPanelDesignerModal, closePanelDesignerModal, switchPanelModalTab } from './modules/panel_designer.js';
import { openBuildingLevelsModal, closeBuildingLevelsModal } from './modules/building_levels.js';
import { saveActiveProjectToCloud, openSaveAsNewProjectModal, closeSaveAsNewProjectModal, executeSaveAsNewProject, syncCustomerProjectsList, loadCustomerProjectFromDropdown } from './modules/cloud_sync.js';
import { parseXmlProject, resetSceneContent } from './core/xml_parser.js';
import { toggleConveyorPathDrawer, openConveyorBOMModal, closeConveyorBOMModal, openConveyorBuilderModal, closeConveyorBuilderModal, initConveyorWizardUI } from './modules/conveyor_wizard_ui.js';
import { startConveyorPathDrawing, cancelConveyorPathDrawing, finishConveyorPathDrawing, analyzeConveyorPolyline } from './modules/conveyor_path_drawer.js';
import { calculateAndRenderConveyorBOM, executeConveyorBuild } from './modules/conveyor_builder.js';

console.log("⚡ ProposalApp ES6 Modular Engine Starting...");

if (typeof window !== 'undefined') {
    window.init3D = init3D;
    window.onWindowResize = onWindowResize;
    window.animate = animate;
    window.showNotice = showNotice;
    window.switchTopRibbonTab = switchTopRibbonTab;
    window.toggleRightPropertiesPanel = toggleRightPropertiesPanel;
    window.toggleProductBrowserPanel = toggleProductBrowserPanel;
    window.toggleFusionLeftBrowserPanel = toggleProductBrowserPanel;
    window.openCableLinkCreationDialog = openCableLinkCreationDialog;
    window.closeCableLinkCreationDialog = closeCableLinkCreationDialog;
    window.openCableLinksModal = openCableLinksModal;
    window.closeCableLinksModal = closeCableLinksModal;
    window.openPanelDesignerModal = openPanelDesignerModal;
    window.closePanelDesignerModal = closePanelDesignerModal;
    window.switchPanelModalTab = switchPanelModalTab;
    window.openBuildingLevelsModal = openBuildingLevelsModal;
    window.closeBuildingLevelsModal = closeBuildingLevelsModal;
    window.saveActiveProjectToCloud = saveActiveProjectToCloud;
    window.openSaveAsNewProjectModal = openSaveAsNewProjectModal;
    window.closeSaveAsNewProjectModal = closeSaveAsNewProjectModal;
    window.executeSaveAsNewProject = executeSaveAsNewProject;
    window.syncCustomerProjectsList = syncCustomerProjectsList;
    window.loadCustomerProjectFromDropdown = loadCustomerProjectFromDropdown;
    window.parseXmlProject = parseXmlProject;
    window.resetSceneContent = resetSceneContent;
    window.toggleConveyorPathDrawer = toggleConveyorPathDrawer;
    window.openConveyorBOMModal = openConveyorBOMModal;
    window.closeConveyorBOMModal = closeConveyorBOMModal;
    window.openConveyorBuilderModal = openConveyorBuilderModal;
    window.closeConveyorBuilderModal = closeConveyorBuilderModal;
    window.initConveyorWizardUI = initConveyorWizardUI;
    window.startConveyorPathDrawing = startConveyorPathDrawing;
    window.cancelConveyorPathDrawing = cancelConveyorPathDrawing;
    window.finishConveyorPathDrawing = finishConveyorPathDrawing;
    window.analyzeConveyorPolyline = analyzeConveyorPolyline;
    window.calculateAndRenderConveyorBOM = calculateAndRenderConveyorBOM;
    window.executeConveyorBuild = executeConveyorBuild;
}

window.addEventListener('DOMContentLoaded', () => {
    init3D();
    syncCustomerProjectsList();
    initConveyorWizardUI();
    showNotice("Modüler JavaScript Motoru Başarıyla Başlatıldı! 🚀");
});
