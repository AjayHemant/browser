# Next-Gen Browser

A modern, secure browser application built with **Electron** and **Flask (Quart)**, featuring a beautiful UI, user authentication, password manager, and advanced search capabilities.

## 🚀 Features

### Browser Features
- ✨ **Modern Electron UI** - Beautiful dark theme with smooth animations
- 🔐 **Secure Authentication** - Phone-based login with password hashing
- 🔍 **Powerful Search** - Google Custom Search API integration
- 🕵️ **Incognito Mode** - Private browsing with no history tracking
- 🔑 **Password Manager** - Encrypted password storage with Fernet
- 📝 **Smart Autofill** - Form autofill based on usage patterns
- 🌐 **Web Proxy** - Secure page viewing through Flask backend
- 📊 **History Tracking** - Track searches and page visits

### Technical Features
- **Async Backend** - High-performance Quart (async Flask)
- **MySQL Database** - Robust data storage with connection pooling
- **Ad Blocker** - Built-in ad blocking (Ghostery)
- **Permission System** - User-facing permission requests
- **Tab Management** - Multi-tab browsing with tab persistence
- **Cookie Support** - Native cookie handling via webview

## 📁 Project Structure

```
browser-main/
├── search-engine/          # Flask Backend
│   ├── app.py             # Main Flask application
│   ├── .env               # Environment variables
│   ├── static/            # CSS & JavaScript
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       ├── app.js
│   │       ├── auth.js
│   │       └── password-manager.js
│   ├── templates/         # HTML templates
│   │   ├── index.html
│   │   └── login.html
│   └── README.md          # Backend documentation
│
├── main.js                # Electron main process
├── preload.js             # Electron preload script
├── renderer.js            # Electron renderer (legacy)
├── run.sh                 # Startup script
├── package.json           # Node dependencies
└── README.md              # This file
```

## 🛠️ Installation

### Prerequisites
- **Node.js** (v14 or higher)
- **Python 3.8+**
- **MySQL Server**

### Setup Steps

1. **Install Node dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   pip install quart hypercorn aiohttp aiomysql werkzeug beautifulsoup4 lxml python-dotenv cryptography
   ```

3. **Configure MySQL:**
   - Start MySQL server
   - Create database (or let app auto-create)
   - Note your credentials

4. **Set up environment variables:**
   
   Create `search-engine/.env`:
   ```env
   SECRET_KEY=your-secret-key-here
   API_KEY=your-google-api-key
   CSE_ID=your-custom-search-engine-id
   DB_HOST=localhost
   DB_USER=your-mysql-username
   DB_PASSWORD=your-mysql-password
   DB_NAME=browser_history
   ENCRYPTION_KEY=your-fernet-key
   ```

5. **Get Google API credentials:**
   - Create project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Custom Search API
   - Create CSE at [Programmable Search](https://programmablesearchengine.google.com/)

## 🚀 Running the Application

### Quick Start (Recommended)
```bash
bash run.sh
```

This will:
1. Clean up any previous instances
2. Install Python dependencies
3. Start the Flask backend
4. Wait for backend to be ready
5. Launch the Electron browser

### Manual Start

**Terminal 1 - Backend:**
```bash
cd search-engine
python3 app.py
# or with Hypercorn:
hypercorn app:app --bind 127.0.0.1:5000
```

**Terminal 2 - Frontend:**
```bash
npm start
```

## 📖 Usage

1. **First Launch:**
   - Browser opens to login page
   - Click "Need an account? Register"

2. **Registration:**
   - Enter phone number (e.g., +1 234 567 8900)
   - Choose username
   - Create password
   - Click "Register"

3. **Browsing:**
   - Use address bar to search or enter URLs
   - Click search results to view pages
   - Use navigation buttons (back/forward/reload)
   - Open new tabs or incognito tabs

4. **Password Manager:**
   - Click menu (⋮) → Password Manager
   - View, copy, or delete saved passwords
   - Generate strong passwords
   - Auto-save passwords on login forms

## 🔒 Security Features

- **Password Hashing** - Werkzeug secure password hashing
- **Encryption** - Fernet symmetric encryption for passwords
- **Session Security** - Secure session cookies
- **SQL Injection Protection** - Parameterized queries
- **XSS Protection** - HTML escaping in JavaScript
- **Incognito Mode** - No data persistence for private browsing
- **HTTPS Enforcement** - Blocks insecure HTTP navigation

## 🗄️ Database Schema

### Users Table
- User authentication and profile data
- Password hashing with Werkzeug
- Last login tracking

### History Table
- Search queries and page visits
- Timestamp tracking
- User association with cascade delete

### Saved Passwords Table
- Encrypted password storage
- Site URL and username tracking
- Automatic updates on duplicate entries

### Autofill Data Table
- Form field suggestions
- Usage count tracking
- Smart field matching

## 🐛 Troubleshooting

**Backend won't start:**
- Check MySQL is running: `sudo systemctl status mysql`
- Verify `.env` credentials
- Check port 5000 is available: `lsof -i :5000`

**Database errors:**
- Ensure MySQL user has CREATE DATABASE permission
- Check database name matches `.env`
- Verify connection credentials

**Search not working:**
- Verify Google API key in `.env`
- Check API quotas in Google Cloud Console
- Ensure Custom Search API is enabled

**Electron issues:**
- Run `npm install` to reinstall dependencies
- Clear cache: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version`

## 📚 Documentation

- [Backend API Documentation](search-engine/README.md)
- [Menu Implementation](MENU_IMPLEMENTATION.md)
- [Password Manager](PASSWORD_MANAGER.md)

## 🔧 Development

### Backend Development
```bash
cd search-engine
python3 app.py  # Debug mode enabled
```

### Frontend Development
```bash
npm start  # Opens Electron with DevTools
```

### Database Migrations
The app automatically creates/updates tables on startup. For manual migrations, connect to MySQL and run SQL directly.

## 📝 License

This project is for educational purposes.

## 🙏 Credits

- **Framework:** Electron + Flask (Quart)
- **Database:** MySQL with aiomysql
- **Ad Blocker:** @ghostery/adblocker-electron
- **Fonts:** Google Fonts (Inter)
- **Icons:** Inline SVG

---

Built with ❤️ for modern, secure web browsing