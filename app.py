import sqlite3
from datetime import date
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DB_FILE = 'locktf.db'

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task TEXT NOT NULL,
                status INTEGER DEFAULT 0
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                date TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0
            )
        ''')

init_db()

@app.route("/")
def index():
    return render_template("home.html")

@app.route("/api/todos", methods=["GET"])
def get_todos():
    with get_db() as conn:
        todos = conn.execute("SELECT * FROM todos").fetchall()
    return jsonify([dict(t) for t in todos])

@app.route("/api/todos", methods=["POST"])
def add_todo():
    data = request.json
    if not data or not data.get("task"):
        return jsonify({"error": "Task is required"}), 400
    with get_db() as conn:
        cursor = conn.execute("INSERT INTO todos (task) VALUES (?)", (data["task"],))
        conn.commit()
        return jsonify({"id": cursor.lastrowid, "task": data["task"], "status": 0}), 201

@app.route("/api/todos/<int:todo_id>", methods=["PUT"])
def update_todo(todo_id):
    data = request.json
    if not data or "status" not in data:
        return jsonify({"error": "Status is required"}), 400
    with get_db() as conn:
        conn.execute("UPDATE todos SET status = ? WHERE id = ?", (data["status"], todo_id))
        conn.commit()
    return jsonify({"success": True})

@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    with get_db() as conn:
        conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        conn.commit()
    return jsonify({"success": True})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    with get_db() as conn:
        sessions = conn.execute("SELECT date, count FROM sessions").fetchall()
    return jsonify({s['date']: s['count'] for s in sessions})

@app.route("/api/stats", methods=["POST"])
def log_session():
    today = date.today().isoformat()
    with get_db() as conn:
        conn.execute('''
            INSERT INTO sessions (date, count) 
            VALUES (?, 1) 
            ON CONFLICT(date) DO UPDATE SET count = count + 1
        ''', (today,))
        conn.commit()
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run()