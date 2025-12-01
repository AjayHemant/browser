// Authentication JavaScript
// API_URL is declared in app.js
let isRegister = false;

function toggleMode() {
    isRegister = !isRegister;
    const title = document.getElementById('formTitle');
    const btn = document.getElementById('actionBtn');
    const switchText = document.getElementById('switchText');
    const errorMsg = document.getElementById('error-msg');
    const userGroup = document.getElementById('username-group');

    errorMsg.innerText = ''; // Clear errors

    if (isRegister) {
        title.innerText = 'Create Account';
        btn.innerText = 'Register';
        switchText.innerText = 'Have an account? Login';
        userGroup.style.display = 'block';
    } else {
        title.innerText = 'Welcome Back';
        btn.innerText = 'Login';
        switchText.innerText = 'Need an account? Register';
        userGroup.style.display = 'none';
    }
}

async function handleAuth(event) {
    event.preventDefault();

    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    const errorMsg = document.getElementById('error-msg');
    const btn = document.getElementById('actionBtn');

    if (!phone || !password) {
        errorMsg.innerText = 'Please fill in all fields.';
        return;
    }

    if (isRegister && !username) {
        errorMsg.innerText = 'Please enter a username.';
        return;
    }

    const endpoint = isRegister ? '/api/register' : '/api/login';
    const remember = document.getElementById('rememberMe').checked;
    const payload = { phone, password, remember };
    if (isRegister) payload.username = username;

    // Show loading state
    btn.disabled = true;
    btn.innerText = isRegister ? 'Creating Account...' : 'Logging in...';

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            if (isRegister) {
                // Show success message
                errorMsg.style.color = '#00d68f';
                errorMsg.innerText = 'Registration successful! Redirecting to login...';

                // Switch to login mode after a short delay
                setTimeout(() => {
                    toggleMode();
                    errorMsg.style.color = '#ff6b6b';
                    errorMsg.innerText = '';
                }, 1500);
            } else {
                // Login successful - redirect to main page
                window.location.href = '/';
            }
        } else {
            errorMsg.innerText = data.error || 'Authentication failed';
        }
    } catch (err) {
        errorMsg.innerText = 'Cannot connect to server. Please try again.';
        console.error('Auth error:', err);
    } finally {
        btn.disabled = false;
        btn.innerText = isRegister ? 'Register' : 'Login';
    }
}

// Add keyboard shortcut to toggle between login/register
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        toggleMode();
    }
});
