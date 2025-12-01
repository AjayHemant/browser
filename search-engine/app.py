from quart import Quart, request, jsonify, render_template, Response, session, send_from_directory
import aiohttp
from werkzeug.security import generate_password_hash, check_password_hash
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote, urlparse
import asyncio
import aiomysql
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use current directory for templates so it picks up the root index.html
app = Quart(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key")

# === CONFIGURATION ===
class Config:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "browser_db")
    API_KEY = os.getenv("API_KEY")
    CSE_ID = os.getenv("CSE_ID")
    PORT = int(os.getenv("PORT", 5000))

# === DATABASE MANAGER ===
class DatabaseManager:
    def __init__(self):
        self.pool = None

    async def init_pool(self):
        """Initialize database connection pool with retry logic."""
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                # First ensure DB exists
                await self._ensure_database_exists()
                
                self.pool = await aiomysql.create_pool(
                    host=Config.DB_HOST,
                    port=3306,
                    user=Config.DB_USER,
                    password=Config.DB_PASSWORD,
                    db=Config.DB_NAME,
                    autocommit=True,
                    minsize=1,
                    maxsize=10,
                    pool_recycle=3600,
                    echo=False
                )
                logger.info(f"✓ Connected to MySQL at {Config.DB_HOST}:{Config.DB_NAME}")
                await self._init_tables()
                return
            except Exception as e:
                logger.error(f"Failed to connect to MySQL (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error("Could not establish database connection. Running without database.")
                    self.pool = None

    async def _ensure_database_exists(self):
        """Ensure the database exists before connecting to it."""
        try:
            conn = await aiomysql.connect(
                host=Config.DB_HOST, 
                port=3306, 
                user=Config.DB_USER, 
                password=Config.DB_PASSWORD
            )
            async with conn.cursor() as cur:
                await cur.execute(f"CREATE DATABASE IF NOT EXISTS `{Config.DB_NAME}`")
            conn.close()
            logger.info(f"Database '{Config.DB_NAME}' is ready")
        except Exception as e:
            logger.error(f"Database creation check failed: {e}")
            raise

    async def _init_tables(self):
        """Initialize database tables with proper schema."""
        if not self.pool:
            logger.warning("No database pool available, skipping table initialization")
            return
            
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    # Users Table
                    await cur.execute("""
                        CREATE TABLE IF NOT EXISTS users (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            phone VARCHAR(20) UNIQUE NOT NULL,
                            username VARCHAR(50) NOT NULL,
                            password VARCHAR(255) NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            last_login TIMESTAMP NULL,
                            INDEX idx_phone (phone)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)
                    
                    # History Table
                    await cur.execute("""
                        CREATE TABLE IF NOT EXISTS history (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            user_id INT NOT NULL,
                            username VARCHAR(50),
                            type VARCHAR(10) NOT NULL,
                            query_or_url TEXT,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                            INDEX idx_user_timestamp (user_id, timestamp),
                            INDEX idx_type (type)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)
                    
                    # Saved Passwords Table
                    await cur.execute("""
                        CREATE TABLE IF NOT EXISTS saved_passwords (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            user_id INT NOT NULL,
                            username VARCHAR(50),
                            site_url VARCHAR(500) NOT NULL,
                            site_name VARCHAR(200),
                            login_username VARCHAR(200) NOT NULL,
                            encrypted_password TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                            UNIQUE KEY unique_site_user (user_id, site_url(255), login_username(100)),
                            INDEX idx_user_site (user_id, site_url(255))
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)
                    
                    # Autofill Data Table
                    await cur.execute("""
                        CREATE TABLE IF NOT EXISTS autofill_data (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            user_id INT NOT NULL,
                            username VARCHAR(50),
                            field_name VARCHAR(100) NOT NULL,
                            field_value TEXT NOT NULL,
                            field_type VARCHAR(50) DEFAULT 'text',
                            use_count INT DEFAULT 1,
                            last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                            UNIQUE KEY unique_field (user_id, field_name, field_value(255)),
                            INDEX idx_user_field (user_id, field_name)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)
                    
                    # Downloads Table
                    await cur.execute("""
                        CREATE TABLE IF NOT EXISTS downloads (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            user_id INT NOT NULL,
                            username VARCHAR(50),
                            filename VARCHAR(500) NOT NULL,
                            file_path TEXT NOT NULL,
                            file_size BIGINT,
                            mime_type VARCHAR(200),
                            source_url TEXT,
                            download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                            INDEX idx_user_date (user_id, download_date)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)

                    # Extensions Table
                    await cur.execute("""
                        CREATE TABLE IF NOT EXISTS extensions (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            user_id INT NOT NULL,
                            name VARCHAR(100) NOT NULL,
                            description TEXT,
                            code TEXT NOT NULL,
                            enabled BOOLEAN DEFAULT TRUE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """)
                    
            logger.info("✓ Database tables initialized successfully")


        except Exception as e:
            logger.error(f"Table initialization failed: {e}")
            raise

    async def close(self):
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("Database pool closed.")

    async def execute(self, query, args=()):
        """Execute a database query."""
        if not self.pool:
            logger.warning("No database pool available")
            return None
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, args)
                    return cur
        except Exception as e:
            logger.error(f"DB Execute Error: {e}")
            logger.debug(f"Query: {query}, Args: {args}")
            return None

    async def fetch_one(self, query, args=()):
        """Fetch a single row from the database."""
        if not self.pool:
            logger.warning("No database pool available")
            return None
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, args)
                    return await cur.fetchone()
        except Exception as e:
            logger.error(f"DB Fetch Error: {e}")
            logger.debug(f"Query: {query}, Args: {args}")
            return None
    
    async def fetch_all(self, query, args=()):
        """Fetch all rows from the database."""
        if not self.pool:
            logger.warning("No database pool available")
            return []
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, args)
                    return await cur.fetchall()
        except Exception as e:
            logger.error(f"DB Fetch All Error: {e}")
            logger.debug(f"Query: {query}, Args: {args}")
            return []

db = DatabaseManager()

# === CACHE ===
SEARCH_CACHE = {}
PAGE_CACHE = {}

# === LIFECYCLE HOOKS ===
@app.before_serving
async def startup():
    await db.init_pool()

@app.after_serving
async def shutdown():
    await db.close()

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    
    # Disable caching to ensure updates are seen immediately
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# === HELPER FUNCTIONS ===
async def fetch_url_content(url):
    """Fetches URL content with proper headers and error handling."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=15) as resp:
                content = await resp.read()
                return content, resp.headers.get('Content-Type', '')
    except Exception as e:
        logger.error(f"Fetch error for {url}: {e}")
        return None, None

async def google_search(query, num_results=8):
    if query in SEARCH_CACHE:
        return SEARCH_CACHE[query]

    if not Config.API_KEY or not Config.CSE_ID:
        logger.warning("Search API keys missing.")
        return []

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "q": query,
        "key": Config.API_KEY,
        "cx": Config.CSE_ID,
        "num": num_results
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as response:
                if response.status != 200:
                    logger.error(f"Search API returned {response.status}")
                    return []
                data = await response.json()
    except Exception as e:
        logger.error(f"Search API error: {e}")
        return []

    results = []
    if "items" in data:
        for item in data["items"]:
            website = item.get("link")
            if not website: continue
            
            # Extract domain for favicon
            try:
                domain = urlparse(website).netloc
                favicon = f"https://{domain}/favicon.ico"
            except:
                favicon = ""

            results.append({
                "title": item.get("title", website),
                "url": website,
                "snippet": item.get("snippet", ""),
                "icon": favicon
            })
    
    SEARCH_CACHE[query] = results
    return results

# === ROUTES ===

@app.route("/")
async def index():
    if 'user_id' not in session:
        return await render_template("login.html")
    return await render_template("index.html")

@app.route("/login", methods=["GET"])
async def login_page():
    return await render_template("login.html")

@app.route("/api/register", methods=["POST"])
async def register():
    data = await request.get_json()
    phone = data.get("phone")
    username = data.get("username")
    password = data.get("password")

    if not all([phone, username, password]):
        return jsonify({"error": "Missing fields"}), 400

    hashed_pw = generate_password_hash(password)
    
    # Check if user exists
    existing = await db.fetch_one("SELECT id FROM users WHERE phone = %s", (phone,))
    if existing:
        return jsonify({"error": "User already exists"}), 409

    await db.execute(
        "INSERT INTO users (phone, username, password) VALUES (%s, %s, %s)",
        (phone, username, hashed_pw)
    )
    return jsonify({"message": "User created"}), 201

@app.route("/api/login", methods=["POST"])
async def login():
    data = await request.get_json()
    phone = data.get("phone")
    password = data.get("password")

    if not phone or not password:
        return jsonify({"error": "Missing credentials"}), 400

    user = await db.fetch_one("SELECT id, password, username FROM users WHERE phone = %s", (phone,))
    
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        session['phone'] = phone
        session['username'] = user[2]
        if data.get("remember"):
            session.permanent = True
        
        logger.info(f"User {user[2]} logged in successfully")
        return jsonify({"message": "Logged in", "username": user[2]})
    
    logger.warning(f"Failed login attempt for phone: {phone}")
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/logout")
async def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

@app.route("/api/user")
async def get_user():
    if 'user_id' in session:
        return jsonify({"phone": session.get('phone'), "username": session.get('username')})
    return jsonify(None), 401

@app.route("/api/search")
async def search():
    query = request.args.get("q", "")
    logger.info(f"Search request received for: {query}")
    incognito = request.args.get("incognito", "false") == "true"
    
    if not query:
        return jsonify([])
    
    # Log to DB if not incognito and user is logged in
    if not incognito and 'user_id' in session:
        await db.execute(
            "INSERT INTO history (user_id, username, type, query_or_url) VALUES (%s, %s, 'search', %s)",
            (session['user_id'], session.get('username'), query)
        )

    return jsonify(await google_search(query))

@app.route("/view")
async def view():
    url = request.args.get("url")
    incognito = request.args.get("incognito", "false") == "true"
    
    if not url:
        return "Invalid URL", 400

    # Log visit if not incognito and user is logged in
    if not incognito and 'user_id' in session:
        await db.execute(
            "INSERT INTO history (user_id, username, type, query_or_url) VALUES (%s, %s, 'visit', %s)",
            (session['user_id'], session.get('username'), url)
        )

    # Check cache
    if url in PAGE_CACHE:
        content, c_type = PAGE_CACHE[url]
        return Response(content, content_type=c_type)

    content, content_type = await fetch_url_content(url)
    
    if not content:
        return "Failed to load page", 502

    if content_type and 'text/html' in content_type:
        try:
            soup = BeautifulSoup(content, 'lxml')
            
            # Rewrite links to proxy
            for tag in soup.find_all(['a', 'link', 'script', 'img', 'iframe', 'form']):
                attr = 'href' if tag.name in ['a', 'link'] else 'action' if tag.name == 'form' else 'src'
                if tag.has_attr(attr):
                    val = tag[attr]
                    # Make absolute
                    abs_url = urljoin(url, val)
                    # Rewrite to proxy, preserving incognito state
                    proxy_url = f"/view?url={quote(abs_url)}"
                    if incognito:
                        proxy_url += "&incognito=true"
                    tag[attr] = proxy_url
            
            content = str(soup)
            PAGE_CACHE[url] = (content, content_type)
            return Response(content, content_type="text/html")
        except Exception as e:
            logger.error(f"Parsing error: {e}")
            return Response(content, content_type=content_type)
    
    return Response(content, content_type=content_type)

# === PASSWORD MANAGER ROUTES ===

# Generate a key for encryption (In production, load this from env)
from cryptography.fernet import Fernet
# Try to load key from env, otherwise generate one (Note: generating one means data loss on restart if not saved)
# For this demo, we'll use a fixed key if not provided to avoid losing access during dev restarts
# BUT this is still not production safe without proper key management.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Generate a key and log it (for dev purposes)
    key = Fernet.generate_key()
    ENCRYPTION_KEY = key.decode()
    logger.warning(f"Generated new encryption key: {ENCRYPTION_KEY}")
    logger.warning("Set this as ENCRYPTION_KEY in .env to persist data!")

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

@app.route("/api/passwords", methods=["GET"])
async def get_passwords():
    """Get all saved passwords for the current user"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    SELECT id, site_url, site_name, login_username, created_at, updated_at
                    FROM saved_passwords
                    WHERE user_id = %s
                    ORDER BY updated_at DESC
                """, (session['user_id'],))
                rows = await cur.fetchall()
                
                passwords = []
                for row in rows:
                    passwords.append({
                        "id": row[0],
                        "site_url": row[1],
                        "site_name": row[2],
                        "login_username": row[3],
                        "created_at": row[4].isoformat() if row[4] else None,
                        "updated_at": row[5].isoformat() if row[5] else None
                    })
                
                return jsonify(passwords)
    except Exception as e:
        logger.error(f"Error fetching passwords: {e}")
        return jsonify({"error": "Failed to fetch passwords"}), 500

@app.route("/api/passwords/<int:password_id>", methods=["GET"])
async def get_password(password_id):
    """Get a specific password (decrypted)"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        row = await db.fetch_one("""
            SELECT encrypted_password FROM saved_passwords
            WHERE id = %s AND user_id = %s
        """, (password_id, session['user_id']))
        
        if not row:
            return jsonify({"error": "Password not found"}), 404
        
        encrypted_data = row[0]
        
        try:
            # Try decrypting with Fernet
            decrypted = cipher_suite.decrypt(encrypted_data.encode()).decode()
        except Exception:
            # Fallback: Try base64 (migration path)
            try:
                import base64
                decrypted = base64.b64decode(encrypted_data).decode('utf-8')
                
                # Re-encrypt with Fernet and update DB
                new_encrypted = cipher_suite.encrypt(decrypted.encode()).decode()
                await db.execute("""
                    UPDATE saved_passwords 
                    SET encrypted_password = %s 
                    WHERE id = %s
                """, (new_encrypted, password_id))
                logger.info(f"Migrated password {password_id} to Fernet encryption")
            except Exception as e:
                logger.error(f"Failed to decrypt password {password_id}: {e}")
                return jsonify({"error": "Failed to decrypt password"}), 500
        
        return jsonify({"password": decrypted})
    except Exception as e:
        logger.error(f"Error fetching password: {e}")
        return jsonify({"error": "Failed to fetch password"}), 500

@app.route("/api/passwords", methods=["POST"])
async def save_password():
    """Save a new password or update existing one"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = await request.get_json()
    site_url = data.get("site_url")
    site_name = data.get("site_name")
    login_username = data.get("login_username")
    password = data.get("password")
    
    if not all([site_url, login_username, password]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        # Encrypt with Fernet
        encrypted = cipher_suite.encrypt(password.encode()).decode()
        
        # Try to update first, if not exists then insert
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    INSERT INTO saved_passwords 
                    (user_id, username, site_url, site_name, login_username, encrypted_password)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    encrypted_password = VALUES(encrypted_password),
                    site_name = VALUES(site_name),
                    updated_at = CURRENT_TIMESTAMP
                """, (session['user_id'], session['username'], site_url, site_name, login_username, encrypted))
                
        return jsonify({"message": "Password saved successfully"}), 200
    except Exception as e:
        logger.error(f"Error saving password: {e}")
        return jsonify({"error": "Failed to save password"}), 500

@app.route("/api/passwords/<int:password_id>", methods=["DELETE"])
async def delete_password(password_id):
    """Delete a saved password"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        await db.execute("""
            DELETE FROM saved_passwords
            WHERE id = %s AND user_id = %s
        """, (password_id, session['user_id']))
        
        return jsonify({"message": "Password deleted"}), 200
    except Exception as e:
        logger.error(f"Error deleting password: {e}")
        return jsonify({"error": "Failed to delete password"}), 500

@app.route("/api/passwords/search", methods=["GET"])
async def search_passwords():
    """Search for saved passwords by URL"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    url = request.args.get("url", "")
    if not url:
        return jsonify([])
    
    try:
        # Extract domain from URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    SELECT id, site_url, site_name, login_username
                    FROM saved_passwords
                    WHERE user_id = %s AND site_url LIKE %s
                    ORDER BY updated_at DESC
                """, (session['user_id'], f"%{domain}%"))
                rows = await cur.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        "id": row[0],
                        "site_url": row[1],
                        "site_name": row[2],
                        "login_username": row[3]
                    })
                
                return jsonify(results)
    except Exception as e:
        logger.error(f"Error searching passwords: {e}")
        return jsonify([])

# === AUTOFILL ROUTES ===

@app.route("/api/autofill", methods=["GET"])
async def get_autofill_suggestions():
    """Get autofill suggestions for a field"""
    if 'user_id' not in session:
        return jsonify([])
    
    field_name = request.args.get("field_name", "")
    field_type = request.args.get("field_type", "")
    
    if not field_name:
        return jsonify([])
    
    try:
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                if field_type:
                    await cur.execute("""
                        SELECT field_value, use_count
                        FROM autofill_data
                        WHERE user_id = %s AND field_name = %s AND field_type = %s
                        ORDER BY use_count DESC, last_used DESC
                        LIMIT 5
                    """, (session['user_id'], field_name, field_type))
                else:
                    await cur.execute("""
                        SELECT field_value, use_count
                        FROM autofill_data
                        WHERE user_id = %s AND field_name = %s
                        ORDER BY use_count DESC, last_used DESC
                        LIMIT 5
                    """, (session['user_id'], field_name))
                
                rows = await cur.fetchall()
                suggestions = [{"value": row[0], "count": row[1]} for row in rows]
                
                return jsonify(suggestions)
    except Exception as e:
        logger.error(f"Error fetching autofill: {e}")
        return jsonify([])

@app.route("/api/autofill", methods=["POST"])
async def save_autofill_data():
    """Save autofill data from form submission"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = await request.get_json()
    form_data = data.get("form_data", [])
    
    if not form_data:
        return jsonify({"error": "No data provided"}), 400
    
    try:
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                for field in form_data:
                    field_name = field.get("name")
                    field_value = field.get("value")
                    field_type = field.get("type", "text")
                    
                    # Skip password fields and empty values
                    if not field_name or not field_value or field_type == "password":
                        continue
                    
                    # Insert or update
                    await cur.execute("""
                        INSERT INTO autofill_data 
                        (user_id, username, field_name, field_value, field_type, use_count)
                        VALUES (%s, %s, %s, %s, %s, 1)
                        ON DUPLICATE KEY UPDATE
                        use_count = use_count + 1,
                        last_used = CURRENT_TIMESTAMP
                    """, (session['user_id'], session['username'], field_name, field_value, field_type))
        
        return jsonify({"message": "Autofill data saved"}), 200
    except Exception as e:
        logger.error(f"Error saving autofill: {e}")
        return jsonify({"error": "Failed to save autofill data"}), 500

# === HISTORY ROUTES ===

@app.route("/api/history", methods=["GET"])
async def get_history():
    """Get browsing history for the current user"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    SELECT id, type, query_or_url, timestamp
                    FROM history
                    WHERE user_id = %s
                    ORDER BY timestamp DESC
                    LIMIT 500
                """, (session['user_id'],))
                rows = await cur.fetchall()
                
                history = []
                for row in rows:
                    history.append({
                        "id": row[0],
                        "type": row[1],
                        "url": row[2],
                        "timestamp": row[3].isoformat() if row[3] else None
                    })
                
                return jsonify(history)
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return jsonify({"error": "Failed to fetch history"}), 500

@app.route("/api/history", methods=["DELETE"])
async def clear_history():
    """Clear all browsing history for the current user"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        await db.execute("""
            DELETE FROM history
            WHERE user_id = %s
        """, (session['user_id'],))
        
        return jsonify({"message": "History cleared"}), 200
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        return jsonify({"error": "Failed to clear history"}), 500

@app.route("/api/history/<int:history_id>", methods=["DELETE"])
async def delete_history_item(history_id):
    """Delete a single history item"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        await db.execute("""
            DELETE FROM history
            WHERE id = %s AND user_id = %s
        """, (history_id, session['user_id']))
        
        return jsonify({"message": "History item deleted"}), 200
    except Exception as e:
        logger.error(f"Error deleting history item: {e}")
        return jsonify({"error": "Failed to delete history item"}), 500

# === DOWNLOADS ROUTES ===

@app.route("/api/downloads", methods=["GET"])
async def get_downloads():
    """Get all downloads for the current user"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    SELECT id, filename, file_path, file_size, mime_type, source_url, download_date
                    FROM downloads
                    WHERE user_id = %s
                    ORDER BY download_date DESC
                    LIMIT 500
                """, (session['user_id'],))
                rows = await cur.fetchall()
                
                downloads = []
                for row in rows:
                    downloads.append({
                        "id": row[0],
                        "filename": row[1],
                        "file_path": row[2],
                        "file_size": row[3],
                        "mime_type": row[4],
                        "source_url": row[5],
                        "download_date": row[6].isoformat() if row[6] else None
                    })
                
                return jsonify(downloads)
    except Exception as e:
        logger.error(f"Error fetching downloads: {e}")
        return jsonify({"error": "Failed to fetch downloads"}), 500

@app.route("/api/downloads", methods=["POST"])
async def record_download():
    """Record a new download"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = await request.get_json()
    filename = data.get("filename")
    file_path = data.get("file_path")
    file_size = data.get("file_size", 0)
    mime_type = data.get("mime_type", "")
    source_url = data.get("source_url", "")
    
    if not all([filename, file_path]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        await db.execute("""
            INSERT INTO downloads (user_id, username, filename, file_path, file_size, mime_type, source_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (session['user_id'], session['username'], filename, file_path, file_size, mime_type, source_url))
        
        return jsonify({"message": "Download recorded"}), 200
    except Exception as e:
        logger.error(f"Error recording download: {e}")
        return jsonify({"error": "Failed to record download"}), 500

@app.route("/api/downloads", methods=["DELETE"])
async def clear_downloads():
    """Clear all downloads for the current user"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        await db.execute("""
            DELETE FROM downloads
            WHERE user_id = %s
        """, (session['user_id'],))
        
        return jsonify({"message": "Downloads cleared"}), 200
    except Exception as e:
        logger.error(f"Error clearing downloads: {e}")
        return jsonify({"error": "Failed to clear downloads"}), 500

@app.route("/api/downloads/<int:download_id>", methods=["DELETE"])
async def delete_download(download_id):
    """Delete a single download record"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        await db.execute("""
            DELETE FROM downloads
            WHERE id = %s AND user_id = %s
        """, (download_id, session['user_id']))
        
        return jsonify({"message": "Download deleted"}), 200
    except Exception as e:
        logger.error(f"Error deleting download: {e}")
        return jsonify({"error": "Failed to delete download"}), 500

# === EXTENSIONS ROUTES ===

@app.route("/api/extensions", methods=["GET"])
async def get_extensions():
    """Get all extensions for the current user"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        async with db.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    SELECT id, name, description, code, enabled, created_at
                    FROM extensions
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """, (session['user_id'],))
                rows = await cur.fetchall()
                
                extensions = []
                for row in rows:
                    extensions.append({
                        "id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "code": row[3],
                        "enabled": bool(row[4]),
                        "created_at": row[5].isoformat() if row[5] else None
                    })
                
                return jsonify(extensions)
    except Exception as e:
        logger.error(f"Error fetching extensions: {e}")
        return jsonify({"error": "Failed to fetch extensions"}), 500

@app.route("/api/extensions", methods=["POST"])
async def add_extension():
    """Add a new extension"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = await request.get_json()
    name = data.get("name")
    description = data.get("description", "")
    code = data.get("code")
    
    if not all([name, code]):
        return jsonify({"error": "Name and code are required"}), 400
    
    try:
        await db.execute("""
            INSERT INTO extensions (user_id, name, description, code, enabled)
            VALUES (%s, %s, %s, %s, TRUE)
        """, (session['user_id'], name, description, code))
        
        return jsonify({"message": "Extension added successfully"}), 201
    except Exception as e:
        logger.error(f"Error adding extension: {e}")
        return jsonify({"error": "Failed to add extension"}), 500

@app.route("/api/extensions/<int:ext_id>/toggle", methods=["POST"])
async def toggle_extension(ext_id):
    """Toggle extension enabled state"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = await request.get_json()
    enabled = data.get("enabled")
    
    if enabled is None:
        return jsonify({"error": "Enabled state required"}), 400
    
    try:
        await db.execute("""
            UPDATE extensions 
            SET enabled = %s 
            WHERE id = %s AND user_id = %s
        """, (enabled, ext_id, session['user_id']))
        
        return jsonify({"message": "Extension updated"}), 200
    except Exception as e:
        logger.error(f"Error toggling extension: {e}")
        return jsonify({"error": "Failed to update extension"}), 500

@app.route("/api/extensions/generate", methods=["POST"])
async def generate_extension():
    """Generate extension code using Gemini"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = await request.get_json()
    prompt = data.get("prompt")
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
        
    try:
        import google.generativeai as genai
        
        # Configure Gemini
        api_key = os.getenv("API_KEY") # Using the same key if it supports Gemini, otherwise needs GOOGLE_API_KEY
        # Fallback to specific env var if available
        if os.getenv("GOOGLE_API_KEY"):
            api_key = os.getenv("GOOGLE_API_KEY")
            
        if not api_key:
            return jsonify({"error": "AI API key not configured"}), 500
            
        genai.configure(api_key=api_key)
        
        # Try to use the latest model
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
        except:
            # Fallback to older model if flash is not available
            model = genai.GenerativeModel('gemini-pro')
        
        system_prompt = """
        You are an expert JavaScript developer creating browser extensions.
        Generate ONLY the JavaScript code for a browser extension based on the user's request.
        
        The extension has access to a simple API `window.browserAPI` with methods:
        - `alert(msg)`: Show an alert
        - `log(msg)`: Log to console
        - `onNavigate(callback)`: Register a callback for navigation events
        
        It can also use standard DOM APIs to manipulate the page.
        
        IMPORTANT:
        1. Return ONLY valid JavaScript code. No markdown formatting, no backticks, no explanations.
        2. The code should be ready to execute.
        3. Be creative but safe.
        4. If the user asks for something impossible (like accessing file system), gracefully handle it or explain in a comment.
        """
        
        response = await asyncio.to_thread(
            model.generate_content, 
            f"{system_prompt}\n\nUser Request: {prompt}"
        )
        
        generated_code = response.text
        
        # Clean up if the model returned markdown
        if generated_code.startswith("```javascript"):
            generated_code = generated_code.replace("```javascript", "", 1)
        if generated_code.startswith("```"):
            generated_code = generated_code.replace("```", "", 1)
        if generated_code.endswith("```"):
            generated_code = generated_code.rsplit("```", 1)[0]
            
        return jsonify({"code": generated_code.strip()})
        
    except Exception as e:
        logger.error(f"AI Generation failed: {e}")
        return jsonify({"error": f"Failed to generate extension: {str(e)}"}), 500

@app.route("/api/extensions/<int:ext_id>", methods=["DELETE"])
async def delete_extension(ext_id):
    """Delete an extension"""
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        await db.execute("""
            DELETE FROM extensions
            WHERE id = %s AND user_id = %s
        """, (ext_id, session['user_id']))
        
        return jsonify({"message": "Extension deleted"}), 200
    except Exception as e:
        logger.error(f"Error deleting extension: {e}")
        return jsonify({"error": "Failed to delete extension"}), 500

@app.route("/<path:filename>")



async def serve_root_files(filename):
    return await send_from_directory('.', filename)

if __name__ == "__main__":
    app.run(debug=True, port=Config.PORT)
