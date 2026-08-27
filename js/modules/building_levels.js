/**
 * ProposalApp - Building Levels & Glass Floors Module
 */

export function openBuildingLevelsModal() {
    const modal = document.getElementById('modal-building-levels');
    if (modal) {
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        modal.style.display = 'none';
        void modal.offsetWidth; // Force Reflow
        modal.setAttribute('style', 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background-color: rgba(0, 0, 0, 0.85) !important; align-items: center !important; justify-content: center !important;');
    }
}

export function closeBuildingLevelsModal() {
    const modal = document.getElementById('modal-building-levels');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

if (typeof window !== 'undefined') {
    window.openBuildingLevelsModal = openBuildingLevelsModal;
    window.closeBuildingLevelsModal = closeBuildingLevelsModal;
}
