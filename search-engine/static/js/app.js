// Main Browser Application JavaScript
const API_URL = 'http://127.0.0.1:5000'; // Force local backend URL
const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');

// === STATE MANAGEMENT ===
const state = {
    tabs: [],
    activeTabId: null,
    user: null,
    isLoading: false
};

// === DOM ELEMENTS ===
const elements = {
    tabsList: document.getElementById('tabs-list'),
    newTabBtn: document.getElementById('new-tab-button'),
    newIncognitoTabBtn: document.getElementById('new-incognito-tab-button'),

    // Menu
    menuBtn: document.getElementById('menu-button'),
    dropdownMenu: document.getElementById('dropdown-menu'),
    menuNewIncognito: document.getElementById('menu-new-incognito'),
    menuPasswordManager: document.getElementById('menu-password-manager'),
    browserContent: document.getElementById('browser-content'),

    // Controls
    addressBar: document.getElementById('address-bar'),
    backBtn: document.getElementById('back-button'),
    fwdBtn: document.getElementById('forward-button'),
    reloadBtn: document.getElementById('reload-button'),
    homeBtn: document.getElementById('home-button'),
    logoutBtn: document.getElementById('logout-button'),
    username: document.getElementById('username-display'),

    loading: document.getElementById('loading-indicator'),
    toastContainer: document.getElementById('toast-container'),

    // Templates
    welcomeTemplate: document.getElementById('welcome-screen-template'),
    searchResultsTemplate: document.getElementById('search-results-template')
};

// === INITIALIZATION ===
async function init() {
    await checkAuth();
    setupGlobalListeners();
    restoreTabs(); // Restore previous tabs or create new one
}

// === AUTH ===
async function checkAuth() {
    try {
        const res = await fetch(`${API_URL}/api/user`);
        if (res.ok) {
            const data = await res.json();
            state.user = data;
            elements.username.textContent = data.username || 'User';
        } else {
            window.location.href = '/login';
        }
    } catch (err) {
        console.error('Auth check failed', err);
        window.location.href = '/login';
    }
}

async function handleLogout() {
    try {
        // Clear saved tabs on logout
        localStorage.removeItem('savedTabs');
        await fetch(`${API_URL}/api/logout`);
        window.location.href = '/login';
    } catch (err) {
        showToast('Logout failed', 'error');
    }
}

// === TAB MANAGEMENT ===
class Tab {
    constructor(id, isIncognito = false) {
        this.id = id;
        this.isIncognito = isIncognito;
        this.history = [];
        this.currentIndex = -1;
        this.title = isIncognito ? 'Incognito Tab' : 'New Tab';
        this.currentUrl = '';
        this.view = 'welcome'; // welcome, search, browser

        // Create DOM elements
        this.render();
    }

    render() {
        // 1. Tab Button in Tab Bar
        this.tabElement = document.createElement('div');
        this.tabElement.className = 'tab active' + (this.isIncognito ? ' incognito' : '');
        this.tabElement.dataset.id = this.id;
        this.tabElement.innerHTML = `
            <span class="tab-title">${this.title}</span>
            <span class="tab-close">×</span>
        `;

        // 2. Content Container
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'tab-content';
        this.contentElement.id = `tab-content-${this.id}`;

        // Initialize with Welcome Screen
        const welcomeClone = elements.welcomeTemplate.content.cloneNode(true);
        this.contentElement.appendChild(welcomeClone);

        // Append to DOM
        elements.tabsList.appendChild(this.tabElement);
        elements.browserContent.appendChild(this.contentElement);

        // Events
        this.tabElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                e.stopPropagation();
                closeTab(this.id);
            } else {
                switchTab(this.id);
            }
        });
    }

    updateTitle(title) {
        this.title = title || 'New Tab';
        this.tabElement.querySelector('.tab-title').textContent = this.title;
    }

    setView(viewName) {
        this.view = viewName;
        this.contentElement.innerHTML = ''; // Clear current content

        if (viewName === 'welcome') {
            const clone = elements.welcomeTemplate.content.cloneNode(true);
            this.contentElement.appendChild(clone);
            this.updateTitle('New Tab');
            this.currentUrl = '';
        } else if (viewName === 'search') {
            const clone = elements.searchResultsTemplate.content.cloneNode(true);
            this.contentElement.appendChild(clone);
            this.updateTitle('Search');
        } else if (viewName === 'browser') {
            // Create Webview or Iframe
            const container = document.createElement('div');
            container.className = 'web-view-container';
            container.style.height = '100%';

            if (isElectron) {
                const webview = document.createElement('webview');
                webview.style.width = '100%';
                webview.style.height = '100%';

                // Set partition for incognito mode
                if (this.isIncognito) {
                    webview.partition = 'incognito';
                }

                webview.addEventListener('did-start-loading', () => setLoading(true));
                webview.addEventListener('did-stop-loading', () => {
                    setLoading(false);
                    this.updateTitle(webview.getTitle());
                });
                webview.addEventListener('did-navigate', (e) => {
                    this.currentUrl = e.url;
                    if (state.activeTabId === this.id) elements.addressBar.value = e.url;
                });

                container.appendChild(webview);
                this.webview = webview;
            } else {
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';

                iframe.onload = () => setLoading(false);

                container.appendChild(iframe);
                this.iframe = iframe;
            }

            this.contentElement.appendChild(container);
        }
    }

    loadUrl(url) {
        setLoading(true);
        this.currentUrl = url;

        // Proxy logic
        let targetUrl = url;
        if (!isElectron) {
            targetUrl = `${API_URL}/view?url=${encodeURIComponent(url)}`;
            if (this.isIncognito) {
                targetUrl += '&incognito=true';
            }
        }

        if (this.view !== 'browser') {
            this.setView('browser');
        }

        if (isElectron) {
            this.webview.src = targetUrl;
        } else {
            this.iframe.src = targetUrl;
        }

        this.addToHistory({ type: 'page', value: url });
        this.updateTitle(url); // Temporary until page loads
        saveTabs();
    }

    addToHistory(item) {
        this.history = this.history.slice(0, this.currentIndex + 1);
        this.history.push(item);
        this.currentIndex++;
        if (state.activeTabId === this.id) updateNavButtons();
    }
}

function createNewTab(isIncognito = false) {
    const id = Date.now().toString();
    const newTab = new Tab(id, isIncognito);
    state.tabs.push(newTab);
    switchTab(id);
    saveTabs();
}

function switchTab(id) {
    state.activeTabId = id;

    // Update UI
    state.tabs.forEach(tab => {
        if (tab.id === id) {
            tab.tabElement.classList.add('active');
            tab.contentElement.style.display = 'flex';

            // Update controls
            elements.addressBar.value = tab.currentUrl;
            updateNavButtons();
        } else {
            tab.tabElement.classList.remove('active');
            tab.contentElement.style.display = 'none';
        }
    });
    saveTabs();
}

function closeTab(id) {
    const index = state.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = state.tabs[index];

    // Remove DOM
    tab.tabElement.remove();
    tab.contentElement.remove();

    // Remove from state
    state.tabs.splice(index, 1);

    // Switch if active was closed
    if (state.activeTabId === id) {
        if (state.tabs.length > 0) {
            // Switch to previous tab or next available
            const newIndex = Math.max(0, index - 1);
            switchTab(state.tabs[newIndex].id);
        } else {
            createNewTab(); // Always keep one tab
        }
    }
    saveTabs();
}

function getActiveTab() {
    return state.tabs.find(t => t.id === state.activeTabId);
}

// === TAB PERSISTENCE ===
function saveTabs() {
    try {
        // Filter out incognito tabs - they should not be saved
        const tabsData = state.tabs
            .filter(tab => !tab.isIncognito)
            .map(tab => ({
                id: tab.id,
                isIncognito: tab.isIncognito,
                title: tab.title,
                currentUrl: tab.currentUrl,
                view: tab.view
            }));

        const saveData = {
            tabs: tabsData,
            activeTabId: state.activeTabId
        };

        localStorage.setItem('savedTabs', JSON.stringify(saveData));
    } catch (err) {
        console.error('Failed to save tabs:', err);
    }
}

function restoreTabs() {
    try {
        const savedData = localStorage.getItem('savedTabs');

        if (!savedData) {
            createNewTab();
            return;
        }

        const { tabs, activeTabId } = JSON.parse(savedData);

        if (!tabs || tabs.length === 0) {
            createNewTab();
            return;
        }

        // Restore each tab
        tabs.forEach((tabData) => {
            const tab = new Tab(tabData.id, tabData.isIncognito);
            state.tabs.push(tab);

            // Restore the tab's state
            if (tabData.currentUrl) {
                if (tabData.view === 'browser') {
                    tab.loadUrl(tabData.currentUrl);
                } else if (tabData.view === 'search') {
                    performSearch(tabData.currentUrl, tab);
                }
            }
        });

        // Switch to the previously active tab
        if (activeTabId && state.tabs.find(t => t.id === activeTabId)) {
            switchTab(activeTabId);
        } else if (state.tabs.length > 0) {
            switchTab(state.tabs[0].id);
        }
    } catch (err) {
        console.error('Failed to restore tabs:', err);
        createNewTab();
    }
}

// === NAVIGATION ===
function handleSearch(query) {
    console.log('handleSearch called with:', query);
    const tab = getActiveTab();
    if (!tab) {
        console.error('No active tab found');
        return;
    }

    if (!query) return;

    const isUrl = /^(http|https):\/\/[^ "]+$/.test(query) ||
        /^www\.[^ "]+$/.test(query) ||
        (query.includes('.') && !query.includes(' '));

    console.log('isUrl:', isUrl);

    if (isUrl) {
        let url = query;
        if (!url.startsWith('http')) url = 'https://' + url;
        console.log('Loading URL:', url);
        tab.loadUrl(url);
    } else {
        console.log('Performing search for:', query);
        performSearch(query, tab);
    }
}


async function performSearch(query, tab) {
    setLoading(true);
    try {
        let url = `${API_URL}/api/search?q=${encodeURIComponent(query)}`;
        if (tab.isIncognito) {
            url += '&incognito=true';
        }
        const res = await fetch(url);
        const results = await res.json();

        tab.setView('search');
        tab.addToHistory({ type: 'search', value: query });
        tab.currentUrl = query;
        elements.addressBar.value = query;

        displayResults(results, tab);
    } catch (err) {
        showToast('Search failed', 'error');
    } finally {
        setLoading(false);
    }
}

function displayResults(results, tab) {
    const list = tab.contentElement.querySelector('.search-results-list');
    if (!list) return;

    list.innerHTML = '';

    if (results.length === 0) {
        list.innerHTML = '<div class="no-results">No results found.</div>';
        return;
    }

    results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
            <div class="result-title">${escapeHtml(item.title)}</div>
            <div class="result-url">${escapeHtml(item.url)}</div>
            <div class="result-snippet">${escapeHtml(item.snippet)}</div>
        `;
        card.onclick = () => tab.loadUrl(item.url);
        list.appendChild(card);
    });
}

function updateNavButtons() {
    const tab = getActiveTab();
    if (!tab) return;

    elements.backBtn.disabled = tab.currentIndex <= 0;
    elements.fwdBtn.disabled = tab.currentIndex >= tab.history.length - 1;
}

// === GLOBAL LISTENERS ===
function setupGlobalListeners() {
    elements.newTabBtn.addEventListener('click', () => createNewTab(false));
    elements.newIncognitoTabBtn.addEventListener('click', () => createNewTab(true));

    elements.addressBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch(elements.addressBar.value);
    });

    elements.backBtn.addEventListener('click', () => {
        const tab = getActiveTab();
        if (tab && tab.currentIndex > 0) {
            tab.currentIndex--;
            restoreState(tab);
        }
    });

    elements.fwdBtn.addEventListener('click', () => {
        const tab = getActiveTab();
        if (tab && tab.currentIndex < tab.history.length - 1) {
            tab.currentIndex++;
            restoreState(tab);
        }
    });

    elements.reloadBtn.addEventListener('click', () => {
        const tab = getActiveTab();
        if (tab) {
            if (tab.view === 'browser') {
                if (isElectron) tab.webview.reload();
                else tab.iframe.contentWindow.location.reload();
            } else if (tab.view === 'search') {
                handleSearch(tab.currentUrl);
            }
        }
    });

    elements.homeBtn.addEventListener('click', () => {
        const tab = getActiveTab();
        if (tab) {
            tab.setView('welcome');
            elements.addressBar.value = '';
        }
    });

    elements.logoutBtn.addEventListener('click', handleLogout);

    // === MENU HANDLERS ===
    elements.menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = elements.dropdownMenu.style.display === 'block';
        elements.dropdownMenu.style.display = isVisible ? 'none' : 'block';
        elements.menuBtn.classList.toggle('active', !isVisible);
    });

    document.addEventListener('click', (e) => {
        if (!elements.dropdownMenu.contains(e.target) && e.target !== elements.menuBtn) {
            elements.dropdownMenu.style.display = 'none';
            elements.menuBtn.classList.remove('active');
        }
    });

    elements.menuNewIncognito.addEventListener('click', () => {
        elements.dropdownMenu.style.display = 'none';
        elements.menuBtn.classList.remove('active');

        if (isElectron && window.electronAPI) {
            window.electronAPI.newIncognitoWindow();
        } else {
            // Fallback for non-electron or if API missing: create incognito tab
            createNewTab(true);
        }
    });

    elements.menuPasswordManager.addEventListener('click', () => {
        elements.dropdownMenu.style.display = 'none';
        elements.menuBtn.classList.remove('active');
        if (window.passwordManager) {
            window.passwordManager.open();
        }
    });

    // Menu item: History
    const menuHistory = document.getElementById('menu-history');
    if (menuHistory) {
        menuHistory.addEventListener('click', () => {
            elements.dropdownMenu.style.display = 'none';
            elements.menuBtn.classList.remove('active');
            if (window.historyManager) {
                window.historyManager.open();
            }
        });
    }



    // Menu item: Extensions
    const menuExtensions = document.getElementById('menu-extensions');
    if (menuExtensions) {
        menuExtensions.addEventListener('click', () => {
            elements.dropdownMenu.style.display = 'none';
            elements.menuBtn.classList.remove('active');
            if (window.extensionsManager) {
                window.extensionsManager.open();
            }
        });
    }

    // Global search helper



    window.searchFor = (query) => {
        elements.addressBar.value = query;
        handleSearch(query);
    };
}

function restoreState(tab) {
    const item = tab.history[tab.currentIndex];
    elements.addressBar.value = item.value;
    tab.currentUrl = item.value;

    if (item.type === 'search') {
        performSearch(item.value, tab);
    } else {
        tab.loadUrl(item.value);
    }
    updateNavButtons();
}

// === UI HELPERS ===
function setLoading(isLoading) {
    state.isLoading = isLoading;
    elements.loading.style.display = isLoading ? 'block' : 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', init);

// Warn user when closing with incognito tabs
window.addEventListener('beforeunload', (e) => {
    const hasIncognitoTabs = state.tabs.some(tab => tab.isIncognito);

    if (hasIncognitoTabs) {
        e.preventDefault();
        e.returnValue = 'You have incognito tabs open. They will be closed and not saved.';
        return e.returnValue;
    }
});
