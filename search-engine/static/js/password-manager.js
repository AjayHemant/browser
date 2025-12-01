// Password Manager Module
// API_URL is declared in app.js

class PasswordManager {
    constructor() {
        this.modal = document.getElementById('password-manager-modal');
        this.passwordList = document.getElementById('password-list');
        this.closeBtn = document.getElementById('close-password-manager');
        this.openBtn = document.getElementById('password-manager-button');
        this.generateBtn = document.getElementById('generate-password-btn');

        this.init();
    }

    init() {
        // Event listeners
        this.openBtn?.addEventListener('click', () => this.open());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.generateBtn?.addEventListener('click', () => window.passwordGenerator.open());

        // Close on outside click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    async open() {
        if (this.modal) this.modal.style.display = 'block';
        await this.loadPasswords();
    }

    close() {
        if (this.modal) this.modal.style.display = 'none';
    }

    async loadPasswords() {
        if (!this.passwordList) return;
        this.passwordList.innerHTML = '<div class="loading">Loading passwords...</div>';

        try {
            const response = await fetch(`${API_URL}/api/passwords`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load passwords');
            }

            const passwords = await response.json();
            this.renderPasswords(passwords);
        } catch (error) {
            console.error('Error loading passwords:', error);
            this.passwordList.innerHTML = `
                <div class="empty-state">
                    <h4>Failed to load passwords</h4>
                    <p>Please try again later</p>
                </div>
            `;
        }
    }

    renderPasswords(passwords) {
        if (passwords.length === 0) {
            this.passwordList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <h4>No saved passwords</h4>
                    <p>Your saved passwords will appear here</p>
                </div>
            `;
            return;
        }

        this.passwordList.innerHTML = passwords.map(pwd => `
            <div class="password-item" data-id="${pwd.id}">
                <div class="password-info">
                    <div class="password-site">${this.escapeHtml(pwd.site_name || pwd.site_url)}</div>
                    <div class="password-username">${this.escapeHtml(pwd.login_username)}</div>
                </div>
                <div class="password-actions">
                    <button class="password-action-btn copy-btn" data-id="${pwd.id}" title="Copy Password">
                        📋
                    </button>
                    <button class="password-action-btn delete delete-btn" data-id="${pwd.id}" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        this.passwordList.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyPassword(btn.dataset.id);
            });
        });

        this.passwordList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePassword(btn.dataset.id);
            });
        });
    }

    async copyPassword(id) {
        try {
            const response = await fetch(`${API_URL}/api/passwords/${id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to get password');
            }

            const data = await response.json();

            // Copy to clipboard
            await navigator.clipboard.writeText(data.password);

            // Show feedback
            this.showNotification('Password copied to clipboard!');
        } catch (error) {
            console.error('Error copying password:', error);
            this.showNotification('Failed to copy password', 'error');
        }
    }

    async deletePassword(id) {
        if (!confirm('Are you sure you want to delete this password?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/passwords/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to delete password');
            }

            // Reload passwords
            await this.loadPasswords();
            this.showNotification('Password deleted successfully');
        } catch (error) {
            console.error('Error deleting password:', error);
            this.showNotification('Failed to delete password', 'error');
        }
    }

    showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification-banner ${type === 'error' ? 'error-banner' : ''}`;
        notification.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">${type === 'error' ? '⚠️' : '✓'}</span>
                <span>${message}</span>
            </div>
        `;
        notification.style.display = 'flex';

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Password Generator
class PasswordGenerator {
    constructor() {
        this.modal = document.getElementById('password-generator-modal');
        this.closeBtn = document.getElementById('close-generator');
        this.generatedInput = document.getElementById('generated-password');
        this.copyBtn = document.getElementById('copy-generated');
        this.refreshBtn = document.getElementById('refresh-generated');
        this.lengthRange = document.getElementById('length-range');
        this.lengthVal = document.getElementById('length-val');
        this.useBtn = document.getElementById('use-generated-password');

        this.options = {
            upper: document.getElementById('use-upper'),
            lower: document.getElementById('use-lower'),
            numbers: document.getElementById('use-numbers'),
            symbols: document.getElementById('use-symbols')
        };

        this.init();
    }

    init() {
        this.closeBtn?.addEventListener('click', () => this.close());
        this.copyBtn?.addEventListener('click', () => this.copy());
        this.refreshBtn?.addEventListener('click', () => this.generate());

        this.lengthRange?.addEventListener('input', (e) => {
            this.lengthVal.textContent = e.target.value;
            this.generate();
        });

        Object.values(this.options).forEach(opt => {
            opt?.addEventListener('change', () => this.generate());
        });

        // Close on outside click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    open() {
        if (this.modal) {
            this.modal.style.display = 'block';
            this.generate();
        }
    }

    close() {
        if (this.modal) this.modal.style.display = 'none';
    }

    generate() {
        const length = parseInt(this.lengthRange.value);
        const hasUpper = this.options.upper.checked;
        const hasLower = this.options.lower.checked;
        const hasNumbers = this.options.numbers.checked;
        const hasSymbols = this.options.symbols.checked;

        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        let chars = '';
        if (hasUpper) chars += upper;
        if (hasLower) chars += lower;
        if (hasNumbers) chars += numbers;
        if (hasSymbols) chars += symbols;

        if (chars === '') return;

        let password = '';
        const array = new Uint32Array(length);
        window.crypto.getRandomValues(array);

        for (let i = 0; i < length; i++) {
            password += chars[array[i] % chars.length];
        }

        if (this.generatedInput) this.generatedInput.value = password;
    }

    async copy() {
        if (this.generatedInput && this.generatedInput.value) {
            await navigator.clipboard.writeText(this.generatedInput.value);
            // Could show a small tooltip here
        }
    }
}

// Save Password Prompt
class SavePasswordPrompt {
    constructor() {
        this.modal = document.getElementById('save-password-modal');
        this.siteNameEl = document.getElementById('save-site-name');
        this.usernameEl = document.getElementById('save-username');
        this.saveBtn = document.getElementById('save-password-save');
        this.notNowBtn = document.getElementById('save-password-not-now');
        this.neverBtn = document.getElementById('save-password-never');

        this.currentData = null;
        this.neverSaveList = this.loadNeverSaveList();

        this.init();
    }

    init() {
        this.saveBtn?.addEventListener('click', () => this.save());
        this.notNowBtn?.addEventListener('click', () => this.close());
        this.neverBtn?.addEventListener('click', () => this.neverSave());

        // Close on outside click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    loadNeverSaveList() {
        try {
            return JSON.parse(localStorage.getItem('neverSavePasswords') || '[]');
        } catch {
            return [];
        }
    }

    saveNeverSaveList() {
        localStorage.setItem('neverSavePasswords', JSON.stringify(this.neverSaveList));
    }

    shouldPrompt(url) {
        return !this.neverSaveList.some(site => url.includes(site));
    }

    prompt(data) {
        if (!this.shouldPrompt(data.site_url)) {
            return;
        }

        this.currentData = data;
        if (this.siteNameEl) this.siteNameEl.textContent = data.site_name || data.site_url;
        if (this.usernameEl) this.usernameEl.textContent = data.login_username;
        if (this.modal) this.modal.style.display = 'block';
    }

    async save() {
        if (!this.currentData) return;

        try {
            const response = await fetch(`${API_URL}/api/passwords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(this.currentData)
            });

            if (!response.ok) {
                throw new Error('Failed to save password');
            }

            this.close();
            window.passwordManager?.showNotification('Password saved successfully!');
        } catch (error) {
            console.error('Error saving password:', error);
            window.passwordManager?.showNotification('Failed to save password', 'error');
        }
    }

    neverSave() {
        if (this.currentData) {
            // Extract domain
            try {
                const url = new URL(this.currentData.site_url);
                const domain = url.hostname;
                this.neverSaveList.push(domain);
                this.saveNeverSaveList();
            } catch (e) {
                console.error('Error parsing URL:', e);
            }
        }
        this.close();
    }

    close() {
        if (this.modal) this.modal.style.display = 'none';
        this.currentData = null;
    }
}

// Initialize
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        window.passwordManager = new PasswordManager();
        window.passwordGenerator = new PasswordGenerator();
        window.savePasswordPrompt = new SavePasswordPrompt();
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PasswordManager, SavePasswordPrompt, PasswordGenerator };
}
