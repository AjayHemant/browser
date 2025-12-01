// Extensions Manager Module
const ExtensionsManager = {
    modal: null,
    addModal: null,
    extensionsList: null,
    addBtn: null,
    closeBtn: null,
    closeAddBtn: null,
    saveBtn: null,

    generateBtn: null,

    // Form inputs
    nameInput: null,
    descInput: null,
    codeInput: null,

    init() {
        this.modal = document.getElementById('extensions-modal');
        this.addModal = document.getElementById('add-extension-modal');
        this.extensionsList = document.getElementById('extensions-list');
        this.addBtn = document.getElementById('add-extension-btn');
        this.closeBtn = document.getElementById('close-extensions');
        this.closeAddBtn = document.getElementById('close-add-extension');
        this.saveBtn = document.getElementById('save-extension-btn');
        this.generateBtn = document.getElementById('generate-code-btn');

        this.nameInput = document.getElementById('ext-name');
        this.descInput = document.getElementById('ext-desc');
        this.codeInput = document.getElementById('ext-code');

        this.setupEventListeners();
        this.runEnabledExtensions();
    },

    setupEventListeners() {
        // Close modals
        this.closeBtn.addEventListener('click', () => this.close());
        this.closeAddBtn.addEventListener('click', () => this.closeAdd());

        // Open Add Modal
        this.addBtn.addEventListener('click', () => this.openAdd());

        // Save Extension
        this.saveBtn.addEventListener('click', () => this.saveExtension());

        // Generate Code
        if (this.generateBtn) {
            this.generateBtn.addEventListener('click', () => this.generateCode());
        }

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
            if (e.target === this.addModal) this.closeAdd();
        });
    },

    async generateCode() {
        const prompt = this.descInput.value.trim();
        if (!prompt) {
            alert('Please enter a description/prompt first');
            return;
        }

        const originalText = this.generateBtn.innerHTML;
        this.generateBtn.innerHTML = 'Generating...';
        this.generateBtn.disabled = true;
        this.codeInput.value = '// Generating code... please wait...';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/extensions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to generate code');
            }

            const data = await response.json();
            this.codeInput.value = data.code;

            // Auto-fill name if empty
            if (!this.nameInput.value) {
                this.nameInput.value = "AI Extension " + Math.floor(Math.random() * 1000);
            }

            if (typeof showToast === 'function') {
                showToast('Code generated successfully!', 'success');
            }
        } catch (error) {
            console.error('Error generating code:', error);
            this.codeInput.value = '// Error: ' + error.message;

            if (error.message.includes('Generative Language API') || error.message.includes('403')) {
                if (confirm('The AI API is not enabled for your project. Would you like to open the Google Cloud Console to enable it?')) {
                    // Extract URL from error message if present
                    const match = error.message.match(/https:\/\/console\.developers\.google\.com[^\s]*/);
                    const url = match ? match[0] : 'https://console.developers.google.com/apis/library/generativelanguage.googleapis.com';

                    if (window.electronAPI && window.electronAPI.openExternal) {
                        window.electronAPI.openExternal(url);
                    } else {
                        alert('Please visit this URL to enable the API:\n' + url);
                    }
                }
            } else {
                alert('Failed to generate code: ' + error.message);
            }
        } finally {
            this.generateBtn.innerHTML = originalText;
            this.generateBtn.disabled = false;
        }
    },

    async open() {
        this.modal.style.display = 'block';
        await this.loadExtensions();
    },

    close() {
        this.modal.style.display = 'none';
    },

    openAdd() {
        this.nameInput.value = '';
        this.descInput.value = '';
        this.codeInput.value = '';
        this.addModal.style.display = 'block';
    },

    closeAdd() {
        this.addModal.style.display = 'none';
    },

    async loadExtensions() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/extensions', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to fetch extensions');

            const extensions = await response.json();
            this.renderExtensions(extensions);
        } catch (error) {
            console.error('Error loading extensions:', error);
            this.extensionsList.innerHTML = '<p class="error-text">Failed to load extensions</p>';
        }
    },

    renderExtensions(extensions) {
        if (!extensions || extensions.length === 0) {
            this.extensionsList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                        <line x1="16" y1="8" x2="2" y2="22"></line>
                        <line x1="17.5" y1="15" x2="9" y2="15"></line>
                    </svg>
                    <p>No extensions installed</p>
                </div>
            `;
            return;
        }

        let html = '';
        extensions.forEach(ext => {
            html += `
                <div class="extension-item ${ext.enabled ? 'enabled' : 'disabled'}">
                    <div class="extension-info">
                        <div class="extension-header">
                            <h3 class="extension-name">${this.escapeHtml(ext.name)}</h3>
                            <span class="extension-status">${ext.enabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <p class="extension-desc">${this.escapeHtml(ext.description || 'No description')}</p>
                    </div>
                    <div class="extension-actions">
                        <label class="switch">
                            <input type="checkbox" ${ext.enabled ? 'checked' : ''} 
                                onchange="ExtensionsManager.toggleExtension(${ext.id}, this.checked)">
                            <span class="slider round"></span>
                        </label>
                        <button class="icon-btn delete-btn" onclick="ExtensionsManager.deleteExtension(${ext.id})" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        this.extensionsList.innerHTML = html;
    },

    async saveExtension() {
        const name = this.nameInput.value.trim();
        const description = this.descInput.value.trim();
        const code = this.codeInput.value.trim();

        if (!name || !code) {
            alert('Name and Code are required');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5000/api/extensions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, description, code })
            });

            if (!response.ok) throw new Error('Failed to save extension');

            this.closeAdd();
            this.loadExtensions();
            this.runEnabledExtensions(); // Re-run to include new one
            showToast('Extension installed successfully', 'success');
        } catch (error) {
            console.error('Error saving extension:', error);
            showToast('Failed to install extension', 'error');
        }
    },

    async toggleExtension(id, enabled) {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/extensions/${id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled })
            });

            if (!response.ok) throw new Error('Failed to toggle extension');

            this.loadExtensions(); // Refresh UI
            if (enabled) {
                this.runEnabledExtensions(); // Re-run if enabled
            } else {
                showToast('Extension disabled (reload to fully stop)', 'info');
            }
        } catch (error) {
            console.error('Error toggling extension:', error);
            showToast('Failed to toggle extension', 'error');
        }
    },

    async deleteExtension(id) {
        if (!confirm('Are you sure you want to delete this extension?')) return;

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/extensions/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete extension');

            this.loadExtensions();
            showToast('Extension deleted', 'success');
        } catch (error) {
            console.error('Error deleting extension:', error);
            showToast('Failed to delete extension', 'error');
        }
    },

    async runEnabledExtensions() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/extensions', {
                credentials: 'include'
            });

            if (!response.ok) return;

            const extensions = await response.json();
            const enabledExts = extensions.filter(e => e.enabled);

            console.log(`Loading ${enabledExts.length} extensions...`);

            enabledExts.forEach(ext => {
                try {
                    // Safe-ish execution
                    const func = new Function('browser', ext.code);
                    func(window.browserAPI);
                    console.log(`Extension "${ext.name}" loaded`);
                } catch (err) {
                    console.error(`Error running extension "${ext.name}":`, err);
                }
            });
        } catch (error) {
            console.error('Error running extensions:', error);
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Simple Browser API for Extensions
window.browserAPI = {
    onNavigate: (callback) => {
        // Hook into navigation (mock implementation for now)
        console.log('Extension registered navigation listener');
    },
    alert: (msg) => alert('[Extension] ' + msg),
    log: (msg) => console.log('[Extension] ' + msg)
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ExtensionsManager.init());
} else {
    ExtensionsManager.init();
}

window.extensionsManager = ExtensionsManager;
