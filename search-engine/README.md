# Search Engine Backend

This is the Flask/Quart backend for the Next-Gen Browser application.

## Structure

```
search-engine/
├── app.py              # Main Flask application
├── .env                # Environment variables (API keys, DB config)
├── static/             # Static assets (CSS, JS)
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       ├── auth.js
│       └── password-manager.js
└── templates/          # HTML templates
    ├── index.html      # Main browser interface
    └── login.html      # Login page
```

## Features

- **User Authentication**: Secure login/registration with password hashing
- **Search API**: Google Custom Search integration
- **History Tracking**: Logs user searches and page visits
- **Password Manager**: Encrypted password storage with Fernet
- **Autofill**: Smart form autofill based on usage patterns
- **Incognito Mode**: No logging for private browsing

## Database Schema

The application uses MySQL with the following tables:
- `users`: User accounts with authentication
- `history`: Search and browsing history
- `saved_passwords`: Encrypted password storage
- `autofill_data`: Form autofill suggestions

## Environment Variables

Required in `.env`:
```
SECRET_KEY=<your-secret-key>
API_KEY=<google-api-key>
CSE_ID=<custom-search-engine-id>
DB_HOST=localhost
DB_USER=<mysql-user>
DB_PASSWORD=<mysql-password>
DB_NAME=browser_history
ENCRYPTION_KEY=<fernet-encryption-key>
```

## Running Standalone

```bash
cd search-engine
python3 app.py
```

Or with Hypercorn (production):
```bash
hypercorn app:app --bind 127.0.0.1:5000
```

## API Endpoints

### Authentication
- `POST /api/register` - Create new user
- `POST /api/login` - User login
- `GET /api/logout` - User logout
- `GET /api/user` - Get current user info

### Search & Browse
- `GET /api/search?q=<query>` - Search the web
- `GET /view?url=<url>` - Proxy web pages

### Password Manager
- `GET /api/passwords` - List saved passwords
- `GET /api/passwords/<id>` - Get specific password (decrypted)
- `POST /api/passwords` - Save new password
- `DELETE /api/passwords/<id>` - Delete password
- `GET /api/passwords/search?url=<url>` - Search passwords by URL

### Autofill
- `GET /api/autofill?field_name=<name>` - Get autofill suggestions
- `POST /api/autofill` - Save form data for autofill
