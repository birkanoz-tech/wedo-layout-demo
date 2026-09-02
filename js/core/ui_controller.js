/**
 * ProposalApp - UI Controller Core Module
 * Manages top ribbon tabs, left browser panels, right property panel toggles, and UI interactions.
 */

export function switchTopRibbonTab(tabName) {
    const tabs = ['file', 'home', 'conveyor', 'controls', 'library', 'view', 'building'];
    tabs.forEach((t) => {
        const btn = document.getElementById(`ribbon-tab-btn-${t}`);
        const content = document.getElementById(`ribbon-tab-content-${t}`);
        if (t === tabName) {
            if (btn) btn.className = 'top-ribbon-tab px-3.5 py-1 text-xs font-bold text-white border-b-2 border-blue-500 bg-[#252526] rounded-t transition cursor-pointer flex items-center gap-1.5';
            if (content) content.classList.remove('hidden');
        } else {
            if (btn) btn.className = 'top-ribbon-tab px-3.5 py-1 text-xs font-bold text-gray-400 hover:text-gray-200 border-b-2 border-transparent hover:bg-[#2a2a2a] rounded-t transition cursor-pointer flex items-center gap-1.5';
            if (content) content.classList.add('hidden');
        }
    });
    if (typeof window.onWindowResize === 'function') {
        window.onWindowResize();
    }
}

export function toggleRightPropertiesPanel() {
    const panel = document.getElementById('right-properties-panel-overlay');
    const expandedView = document.getElementById('right-properties-expanded-view');
    const collapsedView = document.getElementById('right-properties-collapsed-view');
    const axisGizmoWrapper = document.getElementById('axis-gizmo-wrapper');
    if (!panel || !expandedView || !collapsedView) return;

    const isCollapsed = expandedView.classList.contains('hidden');
    if (isCollapsed) {
        expandedView.classList.remove('hidden');
        collapsedView.classList.add('hidden');
        collapsedView.style.display = 'none';
        panel.className = 'absolute top-0 right-0 h-full w-[260px] bg-[#1e1e1e]/95 backdrop-blur border-l border-[#2d2d2d] flex flex-col z-20 pointer-events-auto select-none shadow-2xl transition-all duration-300';
        if (axisGizmoWrapper) {
            axisGizmoWrapper.className = 'absolute bottom-4 right-[275px] z-30 pointer-events-auto transition-all duration-300';
        }
    } else {
        expandedView.classList.add('hidden');
        collapsedView.classList.remove('hidden');
        collapsedView.style.display = 'flex';
        panel.className = 'absolute top-0 right-0 h-full w-9 bg-[#1e1e1e]/90 backdrop-blur border-l border-[#2d2d2d] flex flex-col z-20 pointer-events-auto select-none shadow-2xl transition-all duration-300 cursor-pointer hover:bg-[#252526]';
        if (axisGizmoWrapper) {
            axisGizmoWrapper.className = 'absolute bottom-4 right-[48px] z-30 pointer-events-auto transition-all duration-300';
        }
    }
    if (typeof window.onWindowResize === 'function') {
        window.onWindowResize();
        setTimeout(window.onWindowResize, 100);
    }
}

export function toggleProductBrowserPanel() {
    const panel = document.getElementById('fusion-left-browser-panel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

if (typeof window !== 'undefined') {
    window.switchTopRibbonTab = switchTopRibbonTab;
    window.toggleRightPropertiesPanel = toggleRightPropertiesPanel;
    window.toggleProductBrowserPanel = toggleProductBrowserPanel;
    window.toggleFusionLeftBrowserPanel = toggleProductBrowserPanel;
}
