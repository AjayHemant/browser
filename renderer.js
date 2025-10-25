// renderer.js

window.addEventListener('DOMContentLoaded', () => {
  const webview = document.getElementById('webview');
  const addressBar = document.getElementById('address-bar');
  const backButton = document.getElementById('back-button');
  const forwardButton = document.getElementById('forward-button');
  const reloadButton = document.getElementById('reload-button');

  const navigate = () => {
    let url = addressBar.value.trim();

    // Check if the input is likely a URL or a search query.
    // A simple heuristic: if it contains a space or doesn't contain a dot,
    // it's probably a search query. We also handle 'localhost'.
    const isSearch = url.includes(' ') || (!url.includes('.') && !url.startsWith('localhost'));

    if (isSearch) {
      // It's a search query. We'll use Google as the search engine.
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else {
      // It's likely a URL. Add https:// if the protocol is missing.
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
    }
    webview.loadURL(url);
  };

  // --- Navigation Button Event Listeners ---
  backButton.addEventListener('click', () => webview.goBack());
  forwardButton.addEventListener('click', () => webview.goForward());
  reloadButton.addEventListener('click', () => webview.reload());
  // Navigate when "Enter" is pressed in the address bar
  addressBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigate();
    }
  });

  // --- Webview Event Listeners ---

  // Update the address bar when the webview navigates.
  webview.addEventListener('did-navigate', (e) => {
    addressBar.value = e.url;
  });

  // Update the navigation buttons' state (enabled/disabled) when a page finishes loading.
  webview.addEventListener('did-stop-loading', () => {
    backButton.disabled = !webview.canGoBack();
    forwardButton.disabled = !webview.canGoForward();
  });

  // Change the reload icon to a "stop" icon while loading.
  webview.addEventListener('did-start-loading', () => {
    reloadButton.innerHTML = '&#10005;'; // "X" symbol
  });
  webview.addEventListener('did-stop-loading', () => {
    reloadButton.innerHTML = '&#x21bb;'; // Reload symbol
  });
});
