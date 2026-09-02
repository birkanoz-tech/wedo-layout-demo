/**
 * ProposalApp - Vention / Onshape Style JSON Cloud Architecture Module
 * 100% loss-free 3D scene document serialization (Conveyors, Panels, Cables, DXF Drawings, Manual Models).
 * Direct GitHub Cloud API Sync with zero LocalStorage pollution.
 */

import { showNotice } from '../utils/notice_system.js';

export function saveActiveProjectToCloud() {
    openSaveAsNewProjectModal();
}

export function openSaveAsNewProjectModal() {
    let modal = document.getElementById('modal-save-as-project');
    const urlParams = new URLSearchParams(window.location.search);
    const activeProj = urlParams.get('project') || urlParams.get('json') || urlParams.get('xml') || 'OPP-0106989-1-R1.json';
    
    // Auto-suggest next version/revision name in .json format (Vention/Onshape Cloud Standard)
    let suggestedName = activeProj.trim();
    if (!suggestedName.toLowerCase().endsWith('.json') && !suggestedName.toLowerCase().endsWith('.xml')) {
        suggestedName += '.json';
    }
    // Convert default export extension to .json for 100% loss-free cloud save
    const baseName = suggestedName.replace(/\.(json|xml)$/i, '');
    
    if (baseName.includes('-R')) {
        const parts = baseName.split('-R');
        const revNum = parseInt(parts[1], 10) || 1;
        suggestedName = `${parts[0]}-R${revNum + 1}.json`;
    } else if (/_v\d+$/i.test(baseName)) {
        suggestedName = baseName.replace(/_v(\d+)$/i, (m, p1) => `_v${parseInt(p1, 10) + 1}`) + '.json';
    } else {
        suggestedName = `${baseName}_v2.json`;
    }

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-save-as-project';
        modal.className = 'fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = `
            <div style="background-color: #0f172a; color: #f8fafc; border: 2px solid #06b6d4; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.95); padding: 20px; width: 90%; max-width: 460px; margin: auto;" class="space-y-4 text-xs">
                <div class="flex items-center justify-between border-b border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-cyan-400 flex items-center gap-2">
                        <span>☁️</span> Sahneyi GitHub Bulutuna Kaydet (Vention/Onshape 3D Format)
                    </h3>
                    <button onclick="closeSaveAsNewProjectModal()" class="text-gray-400 hover:text-white text-base font-bold">✕</button>
                </div>
                <div class="space-y-2">
                    <label class="block text-gray-300 text-[11px] font-semibold">
                        GitHub Bulut Dosya / Versiyon Adı (.json):
                    </label>
                    <input id="save-as-project-name-input" type="text" value="${suggestedName}" class="w-full bg-gray-950 border border-gray-700 focus:border-cyan-400 rounded px-3 py-2 text-gray-100 text-xs outline-none font-mono" />
                    <p class="text-[10px] text-gray-400">Vention/Onshape tarzı %100 kayıpsız bulut mimarisi. Konveyörler, Panolar, Kablo Ağları ve DXF Mimari Çizimleri eksiksiz saklanır.</p>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-gray-800">
                    <button onclick="closeSaveAsNewProjectModal()" class="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition">İptal</button>
                    <button onclick="executeSaveAsNewProject()" class="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition flex items-center gap-1 shadow">
                        <span>☁️</span> GitHub Bulutuna Kaydet
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const inputEl = document.getElementById('save-as-project-name-input');
        if (inputEl) inputEl.value = suggestedName;
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

export async function saveProjectDirectlyToGitHubRepo(filename, fileContent) {
    let token = localStorage.getItem('GITHUB_ACCESS_TOKEN');
    if (!token) {
        token = prompt('GitHub Bulutuna kaydetmek için GitHub Access Token (PAT) girin:');
        if (token && token.trim()) {
            token = token.trim();
            localStorage.setItem('GITHUB_ACCESS_TOKEN', token);
        } else {
            alert('GitHub Token girilmediği için GitHub bulutuna yazma yapılamadı.');
            return false;
        }
    }

    const owner = 'birkanoz-tech';
    const repo = 'wedo-layout-demo';
    const cleanFilename = filename.startsWith('projects/') ? filename.replace('projects/', '') : filename;
    const path = `projects/${cleanFilename}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    if (typeof showNotice === 'function') {
        showNotice(`⏳ "${cleanFilename}" GitHub bulutuna kaydediliyor...`);
    }

    // 1. Existing SHA Check
    let sha = null;
    try {
        const getRes = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
        }
    } catch(e) {}

    // 2. Base64 Encode UTF-8 String Content
    const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

    // 3. PUT request to GitHub API
    const bodyData = {
        message: `Update ${path} via ProposalApp Web UI`,
        content: base64Content,
        branch: 'main'
    };
    if (sha) bodyData.sha = sha;

    try {
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(bodyData)
        });

        if (putRes.ok) {
            if (typeof showNotice === 'function') {
                showNotice(`☁️ "${cleanFilename}" Başarıyla GitHub Bulutuna Kaydedildi!`);
            }
            return true;
        } else {
            const errData = await putRes.json();
            if (putRes.status === 401) {
                localStorage.removeItem('GITHUB_ACCESS_TOKEN');
                alert('GitHub Token geçersiz veya yetkisiz. Lütfen doğru token ile tekrar deneyin.');
            } else {
                alert(`GitHub Kayıt Hatası: ${errData.message || putRes.statusText}`);
            }
            return false;
        }
    } catch(err) {
        alert(`GitHub Bağlantı Hatası: ${err.message}`);
        return false;
    }
}

export async function executeSaveAsNewProject() {
    const inputEl = document.getElementById('save-as-project-name-input');
    let newName = inputEl ? inputEl.value.trim() : '';
    if (!newName) {
        newName = `Proje_${Date.now()}.json`;
    }
    if (!newName.toLowerCase().endsWith('.json') && !newName.toLowerCase().endsWith('.xml')) {
        newName += '.json';
    }

    // Generate Vention/Onshape 3D Scene JSON Document (or XML fallback)
    let fileContent = '';
    if (newName.toLowerCase().endsWith('.json')) {
        const stateData = typeof window.getSerializableState === 'function' ? window.getSerializableState() : {};
        fileContent = JSON.stringify(stateData, null, 2);
    } else {
        if (typeof window.generateXmlProjectContent === 'function') {
            fileContent = window.generateXmlProjectContent();
        } else {
            const stateData = typeof window.getSerializableState === 'function' ? window.getSerializableState() : {};
            fileContent = `<?xml version="1.0" encoding="utf-8"?>\n<flexport version="3.6">\n<state>${JSON.stringify(stateData)}</state>\n</flexport>`;
        }
    }

    // Save directly to GitHub Cloud without LocalStorage caching
    const success = await saveProjectDirectlyToGitHubRepo(newName, fileContent);

    if (success) {
        closeSaveAsNewProjectModal();

        // Refresh project list from GitHub API
        await syncCustomerProjectsList();

        setTimeout(() => {
            const currentUrlParams = new URLSearchParams(window.location.search);
            currentUrlParams.set('project', newName);
            window.location.search = currentUrlParams.toString();
        }, 800);
    }
}

export async function syncCustomerProjectsList() {
    const dropdown = document.getElementById('customer-projects-dropdown');
    if (!dropdown) return;

    let availableProjects = [];

    // 100% EXCLUSIVELY fetch all live JSON and XML project files from GitHub Cloud ("projects/" folder)
    try {
        const ghRes = await fetch('https://api.github.com/repos/birkanoz-tech/wedo-layout-demo/contents/projects');
        if (ghRes.ok) {
            const files = await ghRes.json();
            if (Array.isArray(files)) {
                files.forEach(f => {
                    if (f.name && (f.name.toLowerCase().endsWith('.json') || f.name.toLowerCase().endsWith('.xml'))) {
                        if (!availableProjects.some(p => p.id === f.name)) {
                            const icon = f.name.toLowerCase().endsWith('.json') ? '🚀' : '☁️';
                            availableProjects.push({ id: f.name, name: `${icon} ${f.name}` });
                        }
                    }
                });
            }
        }
    } catch(err) {
        console.warn("GitHub proje listesi çekilirken ağ hatası:", err);
    }

    // Fallback default project if network is offline
    if (availableProjects.length === 0) {
        availableProjects.push({ id: 'OPP-0106989-1-R1.json', name: '🚀 OPP-0106989-1-R1.json' });
    }

    const currentUrlParams = new URLSearchParams(window.location.search);
    const activeProj = currentUrlParams.get('project') || 'OPP-0106989-1-R1.json';

    let html = '';
    availableProjects.forEach(proj => {
        const isSelected = (proj.id === activeProj || proj.id.replace(/\.(json|xml)$/i,'') === activeProj.replace(/\.(json|xml)$/i,'')) ? 'selected' : '';
        html += `<option value="${proj.id}" ${isSelected}>${proj.name}</option>`;
    });

    dropdown.innerHTML = html;
}

export function loadCustomerProjectFromDropdown(projectId) {
    if (!projectId) return;
    if (typeof showNotice === 'function') {
        showNotice(`⏳ "${projectId}" GitHub bulutundan yükleniyor...`);
    }
    const currentUrlParams = new URLSearchParams(window.location.search);
    currentUrlParams.set('project', projectId);
    window.location.search = currentUrlParams.toString();
}

if (typeof window !== 'undefined') {
    window.saveActiveProjectToCloud = saveActiveProjectToCloud;
    window.openSaveAsNewProjectModal = openSaveAsNewProjectModal;
    window.closeSaveAsNewProjectModal = closeSaveAsNewProjectModal;
    window.saveProjectDirectlyToGitHubRepo = saveProjectDirectlyToGitHubRepo;
    window.executeSaveAsNewProject = executeSaveAsNewProject;
    window.syncCustomerProjectsList = syncCustomerProjectsList;
    window.loadCustomerProjectFromDropdown = loadCustomerProjectFromDropdown;
}
