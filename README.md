# Locktf

Locktf is a minimalist, single-page work assistant. Its core philosophy is simple: **less is more**. 

Designed to cut out distractions, Locktf uses a clean, monochrome aesthetic inspired by modern, distraction-free design to help you focus entirely on your work. 

Under the hood, it features a robust Python and Flask backend that provides private, secure accounts, ensuring your tasks, timers, and productivity streaks follow you wherever you go.

## Features

- **Private User Accounts:** Simple, secure registration and login.
- **To-Do List:** Persistent task management synced directly to your profile.
- **Pomodoro Timer:** Distraction-free interval timer utilizing native, soothing Web Audio API alerts.
- **Day Progress:** Visual indicators (current time and day percentage) to keep you anchored in the present.
- **Productivity Analytics:** Silent tracking of your completed work sessions.
- **Random Quotes:** A touch of focus-oriented motivation.

## Tech Stack

- **Backend:** Python, Flask, SQLite3
- **Frontend:** HTML5, pure CSS3, Vanilla JavaScript (Zero external dependencies)
- **Security:** Session-based authentication with secure password hashing.

## Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/19sx/locktf.git
   cd locktf
   ```

2. **Set up a virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the environment & install dependencies:**
   - On Windows: `venv\Scripts\activate`
   - On macOS/Linux: `source venv/bin/activate`
   
   ```bash
   pip install -r requirements.txt
   ```

4. **Set a local secret key:**
   - On Windows: `set SECRET_KEY="your-dev-key"`
   - On macOS/Linux: `export SECRET_KEY="your-dev-key"`

5. **Run the app:**
   ```bash
   flask run
   ```

## Authors

- [@19sx](https://www.github.com/19sx)
