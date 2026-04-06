import os
import sqlite3
from datetime import date
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
# Set secret key securely, falling back to a local default if not in environment
app.secret_key = os.environ.get('SECRET_KEY', 'local_dev_fallback_secret')

# Security: Configure session cookies
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Strict',
)

DB_FILE = 'locktf.db'

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        # Enable foreign key support in SQLite
        conn.execute('PRAGMA foreign_keys = ON;')
        
        # Users table for private accounts
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        
        # Todos table now references the user_id
        conn.execute('''
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                task TEXT NOT NULL,
                status INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Sessions table uses a composite primary key and references user_id
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                count INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, date),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')

init_db()

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self';"
    return response

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
def index():
    return render_template("home.html")

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}
    username, password = data.get("username", "").strip(), data.get("password", "")
    
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if len(username) < 3 or len(username) > 50:
        return jsonify({"error": "Username must be between 3 and 50 characters"}), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "Password must be between 8 and 128 characters"}), 400
    
    hashed_password = generate_password_hash(password)
    try:
        with get_db() as conn:
            cursor = conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
            session['user_id'] = cursor.lastrowid
            conn.commit()
        return jsonify({"success": True}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    username, password = data.get("username", "").strip(), data.get("password", "")
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        
    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        return jsonify({"success": True})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop('user_id', None)
    return jsonify({"success": True})

@app.route("/api/auth/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user_id": session['user_id']})

@app.route("/api/todos", methods=["GET", "POST"])
@login_required
def handle_todos():
    user_id = session['user_id']
    if request.method == "POST":
        data = request.json or {}
        task_text = data.get("task", "").strip()
        if not task_text:
            return jsonify({"error": "Task is required"}), 400
        if len(task_text) > 500:
            return jsonify({"error": "Task exceeds maximum length of 500 characters"}), 400
            
        with get_db() as conn:
            cursor = conn.execute("INSERT INTO todos (user_id, task) VALUES (?, ?)", (user_id, task_text))
            conn.commit()
            return jsonify({"id": cursor.lastrowid, "task": task_text, "status": 0}), 201
    else:
        with get_db() as conn:
            todos = conn.execute("SELECT * FROM todos WHERE user_id = ?", (user_id,)).fetchall()
        return jsonify([dict(t) for t in todos])

@app.route("/api/todos/<int:todo_id>", methods=["PUT", "DELETE"])
@login_required
def update_delete_todo(todo_id):
    user_id = session['user_id']
    if request.method == "PUT":
        data = request.json or {}
        if "status" not in data:
            return jsonify({"error": "Status is required"}), 400
        # Ensure status is integer 0 or 1
        status = 1 if data["status"] else 0
        with get_db() as conn:
            conn.execute("UPDATE todos SET status = ? WHERE id = ? AND user_id = ?", (status, todo_id, user_id))
            conn.commit()
        return jsonify({"success": True})
    else:
        with get_db() as conn:
            conn.execute("DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user_id))
            conn.commit()
        return jsonify({"success": True})

@app.route("/api/stats", methods=["GET", "POST"])
@login_required
def handle_stats():
    user_id = session['user_id']
    if request.method == "POST":
        today = date.today().isoformat()
        with get_db() as conn:
            conn.execute('''
                INSERT INTO sessions (user_id, date, count) 
                VALUES (?, ?, 1) 
                ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
            ''', (user_id, today))
            conn.commit()
        return jsonify({"success": True})
    else:
        with get_db() as conn:
            sessions = conn.execute("SELECT date, count FROM sessions WHERE user_id = ?", (user_id,)).fetchall()
        return jsonify({s['date']: s['count'] for s in sessions})

if __name__ == "__main__":
    app.run()