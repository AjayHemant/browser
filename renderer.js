
// renderer.js


window.addEventListener('DOMContentLoaded', () => {
  const webview = document.getElementById('webview');
  const addressBar = document.getElementById('address-bar');
  const backButton = document.getElementById('back-button');
  const forwardButton = document.getElementById('forward-button');
  const reloadButton = document.getElementById('reload-button');

  // Check for incognito mode
  const urlParams = new URLSearchParams(window.location.search);
  const isIncognito = urlParams.get('incognito') === 'true';

  if (isIncognito) {
    // Set unique partition for this session
    const partition = `incognito-${Date.now()}`;
    webview.partition = partition;

    // Update UI to show incognito state
    document.body.classList.add('incognito-mode');
    document.getElementById('controls').style.background = 'rgba(20, 20, 25, 0.95)';
    document.getElementById('address-bar').placeholder = 'Search or enter URL (Incognito)';

    // Add incognito indicator
    const indicator = document.createElement('div');
    indicator.innerHTML = '🕵️';
    indicator.title = 'Incognito Mode';
    indicator.style.cssText = 'margin-left: 10px; font-size: 20px; cursor: help;';
    document.querySelector('.address-container').appendChild(indicator);
  }

  // Menu elements
  const menuButton = document.getElementById('menu-button');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const menuNewIncognito = document.getElementById('menu-new-incognito');
  const menuPasswordManager = document.getElementById('menu-password-manager');


  const navigate = () => {
    let url = addressBar.value.trim();
    const isSearch = url.includes(' ') || (!url.includes('.') && !url.startsWith('localhost'));

    if (isSearch) {
      // Route search queries to the Flask search endpoint
      url = `http://127.0.0.1:5000/search?q=${encodeURIComponent(url)}`;
      if (isIncognito) url += '&incognito=true';
    } else {
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Route all external URLs through Flask proxy for better compatibility
      // Only allow direct loading of localhost/Flask backend
      if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
        url = `http://127.0.0.1:5000/view?url=${encodeURIComponent(url)}`;
        if (isIncognito) url += '&incognito=true';
      }
    }
    webview.loadURL(url);
  };

  // --- Navigation Button Event Listeners ---
  backButton.addEventListener('click', () => webview.goBack());
  forwardButton.addEventListener('click', () => webview.goForward());
  reloadButton.addEventListener('click', () => webview.reload());

  addressBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigate();
    }
  });

  // --- Menu Toggle ---
  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdownMenu.style.display === 'block';
    dropdownMenu.style.display = isVisible ? 'none' : 'block';
    menuButton.classList.toggle('active', !isVisible);
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && e.target !== menuButton) {
      dropdownMenu.style.display = 'none';
      menuButton.classList.remove('active');
    }
  });

  // Menu item: New Incognito Tab
  menuNewIncognito.addEventListener('click', () => {
    // Open new incognito window
    if (window.electronAPI && window.electronAPI.newIncognitoWindow) {
      window.electronAPI.newIncognitoWindow();
    } else {
      console.error('Electron API not available');
    }
    dropdownMenu.style.display = 'none';
    menuButton.classList.remove('active');
  });

  // Menu item: Password Manager
  menuPasswordManager.addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    menuButton.classList.remove('active');

    // Open password manager modal
    if (window.passwordManager) {
      window.passwordManager.open();
    }
  });


  // --- Webview Event Listeners ---

  const handleNavigation = (url) => {
    addressBar.value = url;
  };

  webview.addEventListener('did-navigate', (e) => {
    handleNavigation(e.url);
  });

  webview.addEventListener('did-navigate-in-page', (e) => {
    handleNavigation(e.url);
  });

  webview.addEventListener('did-stop-loading', () => {
    backButton.disabled = !webview.canGoBack();
    forwardButton.disabled = !webview.canGoForward();
    reloadButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
  });

  webview.addEventListener('did-start-loading', () => {
    reloadButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    // Hide any previous error messages when starting a new load
    const errorBanner = document.getElementById('error-banner');
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  });

  // --- Error Handling ---
  webview.addEventListener('did-fail-load', (e) => {
    // Ignore -3 (ABORTED) errors as they occur during normal navigation
    if (e.errorCode === -3) return;

    console.error('Page failed to load:', e.errorDescription, 'Code:', e.errorCode);

    // Show error banner
    const errorBanner = document.getElementById('error-banner');
    const errorText = document.getElementById('error-text');

    if (errorBanner && errorText) {
      errorText.innerText = `Failed to load page: ${e.errorDescription}`;
      errorBanner.style.display = 'flex';
    }
  });

  // --- Initial Load with Session ---
  // --- Initial Load ---
  // We rely on session cookies established during login.
  webview.src = "http://127.0.0.1:5000/";

  // --- History Notification Banner ---
  const banner = document.getElementById('history-banner');
  const dismissBtn = document.getElementById('dismiss-banner');

  // Don't show banner by default to maximize screen space
  // banner.style.display = 'flex';

  dismissBtn.addEventListener('click', () => {
    banner.style.display = 'none';
  });

  // --- Error Banner Retry ---
  const retryBtn = document.getElementById('retry-error');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const errorBanner = document.getElementById('error-banner');
      if (errorBanner) {
        errorBanner.style.display = 'none';
      }
      webview.reload();
    });
  }


  // --- Permission Handling ---
  const permModal = document.getElementById('permission-modal');
  const permText = document.getElementById('perm-text');
  const allowBtn = document.getElementById('perm-allow');
  const denyBtn = document.getElementById('perm-deny');

  let currentPermissionRequest = null;

  webview.addEventListener('permissionrequest', (e) => {
    console.log('Permission requested:', e.permission, 'by', e.requestingUrl);

    // 1. Prevent default behavior (which usually denies or auto-allows based on settings)
    // Note: In Electron webview, we must handle the request manually.

    currentPermissionRequest = e;

    // 2. Show Modal
    permText.innerText = `The website "${e.requestingUrl}" wants to access your ${e.permission}.`;
    permModal.style.display = 'block';
  });

  allowBtn.onclick = () => {
    if (currentPermissionRequest) {
      currentPermissionRequest.request.allow();
      permModal.style.display = 'none';
      currentPermissionRequest = null;
    }
  };

  denyBtn.onclick = () => {
    if (currentPermissionRequest) {
      currentPermissionRequest.request.deny();
      permModal.style.display = 'none';
      currentPermissionRequest = null;
    }
  };
});

// === FORM DETECTION AND AUTOFILL ===

// Inject form detection script into webview
function injectFormDetection() {
  const webview = document.getElementById('webview');
  if (!webview) return;

  const script = `
    (function() {
      // Track form submissions
      let formData = {};
      let passwordFields = {};

      // Monitor all forms
      document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form.tagName !== 'FORM') return;

        const formFields = [];
        let username = '';
        let password = '';

        // Extract form data
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          if (!input.name || !input.value) return;

          const fieldData = {
            name: input.name,
            value: input.value,
            type: input.type || 'text'
          };

          // Detect username/email fields
          if (input.type === 'email' || 
              input.name.toLowerCase().includes('email') ||
              input.name.toLowerCase().includes('user') ||
              input.autocomplete === 'username') {
            username = input.value;
          }

          // Detect password fields
          if (input.type === 'password') {
            password = input.value;
          }

          formFields.push(fieldData);
        });

        // Send form data to main process
        window.postMessage({
          type: 'FORM_SUBMIT',
          url: window.location.href,
          formData: formFields,
          credentials: username && password ? { username, password } : null
        }, '*');
      }, true);

      // Monitor input focus for autofill
      document.addEventListener('focusin', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return;
        if (input.type === 'password' || input.type === 'submit' || input.type === 'button') return;

        const rect = input.getBoundingClientRect();
        window.postMessage({
          type: 'INPUT_FOCUS',
          fieldName: input.name || input.id || input.placeholder,
          fieldType: input.type || 'text',
          position: {
            x: rect.left,
            y: rect.bottom,
            width: rect.width
          }
        }, '*');
      }, true);

      // Monitor input blur to hide autofill
      document.addEventListener('focusout', function(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return;

        setTimeout(() => {
          window.postMessage({
            type: 'INPUT_BLUR'
          }, '*');
        }, 200);
      }, true);

      // Check for password fields on page load
      setTimeout(() => {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        const usernameInputs = document.querySelectorAll('input[type="email"], input[autocomplete="username"], input[name*="user"], input[name*="email"]');
        
        if (passwordInputs.length > 0 && usernameInputs.length > 0) {
          window.postMessage({
            type: 'LOGIN_FORM_DETECTED',
            url: window.location.href
          }, '*');
        }
      }, 1000);
    })();
  `;

  try {
    webview.executeJavaScript(script);
  } catch (error) {
    console.error('Error injecting form detection:', error);
  }
}

// Handle messages from webview
window.addEventListener('DOMContentLoaded', () => {
  const webview = document.getElementById('webview');

  webview.addEventListener('did-stop-loading', () => {
    injectFormDetection();
  });

  webview.addEventListener('ipc-message', async (event) => {
    const { channel, args } = event;

    if (channel === 'FORM_SUBMIT') {
      const data = args[0];

      // Check for incognito mode
      const urlParams = new URLSearchParams(window.location.search);
      const isIncognito = urlParams.get('incognito') === 'true';

      if (isIncognito) return; // Don't save anything in incognito mode

      // Save autofill data
      if (data.formData && data.formData.length > 0) {
        try {
          await fetch('http://127.0.0.1:5000/api/autofill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ form_data: data.formData })
          });
        } catch (error) {
          console.error('Error saving autofill data:', error);
        }
      }

      // Prompt to save password
      if (data.credentials && window.savePasswordPrompt) {
        const { username, password } = data.credentials;
        const url = data.url;

        // Extract site name from URL
        let siteName = '';
        try {
          const urlObj = new URL(url);
          siteName = urlObj.hostname;
        } catch (e) {
          siteName = url;
        }

        window.savePasswordPrompt.prompt({
          site_url: url,
          site_name: siteName,
          login_username: username,
          password: password
        });
      }
    } else if (channel === 'INPUT_FOCUS') {
      // Check for incognito mode
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('incognito') === 'true') return;

      const data = args[0];
      showAutofillSuggestions(data);
    } else if (channel === 'INPUT_BLUR') {
      hideAutofillSuggestions();
    } else if (channel === 'LOGIN_FORM_DETECTED') {
      const data = args[0];
      checkSavedPasswords(data.url);
    }
  });

  // Enable IPC messages
  webview.addEventListener('console-message', (e) => {
    // Parse console messages for our custom events
    try {
      const message = JSON.parse(e.message);
      if (message.type) {
        webview.send('ipc-message', { channel: message.type, args: [message] });
      }
    } catch (e) {
      // Not a JSON message, ignore
    }
  });
});

// Autofill suggestions
async function showAutofillSuggestions(data) {
  const { fieldName, fieldType, position } = data;

  if (!fieldName) return;

  try {
    const response = await fetch(`http://127.0.0.1:5000/api/autofill?field_name=${encodeURIComponent(fieldName)}&field_type=${encodeURIComponent(fieldType)}`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const suggestions = await response.json();

    if (suggestions.length === 0) return;

    // Show dropdown
    const dropdown = document.getElementById('autofill-dropdown');
    const suggestionsContainer = document.getElementById('autofill-suggestions');

    suggestionsContainer.innerHTML = suggestions.map(s => `
      <div class="autofill-suggestion" data-value="${escapeHtml(s.value)}">
        <span class="autofill-value">${escapeHtml(s.value)}</span>
        <span class="autofill-count">${s.count}×</span>
      </div>
    `).join('');

    // Position dropdown
    dropdown.style.left = `${position.x}px`;
    dropdown.style.top = `${position.y + 5}px`;
    dropdown.style.minWidth = `${position.width}px`;
    dropdown.style.display = 'block';

    // Add click handlers
    suggestionsContainer.querySelectorAll('.autofill-suggestion').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.dataset.value;
        fillInput(value);
        hideAutofillSuggestions();
      });
    });
  } catch (error) {
    console.error('Error fetching autofill suggestions:', error);
  }
}

function hideAutofillSuggestions() {
  const dropdown = document.getElementById('autofill-dropdown');
  dropdown.style.display = 'none';
}

function fillInput(value) {
  const webview = document.getElementById('webview');
  const script = `
    (function() {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.value = ${JSON.stringify(value)};
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })();
  `;

  try {
    webview.executeJavaScript(script);
  } catch (error) {
    console.error('Error filling input:', error);
  }
}

async function checkSavedPasswords(url) {
  try {
    const response = await fetch(`http://127.0.0.1:5000/api/passwords/search?url=${encodeURIComponent(url)}`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const passwords = await response.json();

    if (passwords.length > 0) {
      // Show notification that saved passwords are available
      // You could add a UI element here to let users know
      console.log('Saved passwords available for this site:', passwords.length);
    }
  } catch (error) {
    console.error('Error checking saved passwords:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
