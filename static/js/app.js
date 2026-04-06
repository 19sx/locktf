document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Logic ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const authForm = document.getElementById('auth-form');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');

    let isLoginMode = true;

    // Show auth screen if not logged in
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                showApp();
            } else {
                showAuth();
            }
        } catch (e) {
            showAuth();
        }
    }

    function showAuth(message = "Sign in to focus", isError = false) {
        if (appContainer) appContainer.style.display = 'none';
        if (authContainer) authContainer.style.display = 'flex';
        if (authSubtitle) {
            authSubtitle.textContent = message;
            authSubtitle.style.color = isError ? 'red' : 'var(--text-secondary)';
        }
    }

    function showApp() {
        if (authContainer) authContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
        loadTasks();
        renderHeatmap();
    }

    if (authToggleBtn) {
        authToggleBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Register';
            authToggleBtn.textContent = isLoginMode ? 'Need an account? Register' : 'Already have an account? Login';
            showAuth(isLoginMode ? "Sign in to focus" : "Create an account", false);
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = authUsername.value.trim();
            const password = authPassword.value.trim();

            if (!username || !password) return;

            const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
            
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (res.ok) {
                    authPassword.value = ''; // clear password
                    if (!isLoginMode) {
                        // Registration successful, log them in automatically or just switch mode
                        showAuth("Registration successful. Logging in...", false);
                        checkAuth();
                    } else {
                        showApp();
                    }
                } else {
                    showAuth(data.error || 'Authentication failed', true);
                }
            } catch (err) {
                showAuth('Network error', true);
            }
        });
    }

    // Add logout functionality dynamically since the button might not exist in HTML yet
    // Assuming we'll add it to the footer or header
    const footer = document.querySelector('footer');
    if (footer) {
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.cssText = 'background: none; border: none; color: var(--text-secondary); cursor: pointer; text-decoration: underline; margin-left: 15px; font-family: inherit; font-size: inherit;';
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                showAuth("Signed out successfully", false);
            } catch(e) {
                console.error("Logout failed", e);
            }
        });
        footer.appendChild(logoutBtn);
    }

    // API Wrapper to handle 401s
    async function apiFetch(url, options = {}) {
        const response = await fetch(url, options);
        if (response.status === 401) {
            showAuth("Session expired. Please log in again.", true);
            throw new Error("Unauthorized");
        }
        return response;
    }


    // --- Current Time & Day Progress ---
    const clockElement = document.getElementById("clock");
    const progressElement = document.getElementById("progress");

    function updateClock() {
        if (clockElement) {
            clockElement.innerHTML = new Date().toLocaleTimeString();
        }
    }

    function updateDayProgress() {
        if (progressElement) {
            // Day Progress Math:
            // 1. Get current time in seconds since midnight: (Hours * 3600) + (Minutes * 60) + Seconds.
            // 2. Divide by total seconds in a day (24 * 3600 = 86400).
            // 3. Multiply by 100 to get the percentage.
            const now = new Date();
            const secondsPassed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            const totalSeconds = 24 * 3600;
            const percent = ((secondsPassed / totalSeconds) * 100).toFixed(0);
            progressElement.textContent = percent;
        }
    }

    setInterval(updateClock, 1000);
    setInterval(updateDayProgress, 1000);
    updateClock();
    updateDayProgress();

    // --- Web Audio API Beep ---
    // Create a minimalist synthetic beep using the native browser AudioContext
    function playBeep() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return; // Browser doesn't support Web Audio API
        
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Pleasant sine wave tone
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note

        // Fade out to avoid clicks
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 1);
    }

    // --- Pomodoro Timer ---
    const POMODORO_DURATION = 25 * 60;
    const SHORT_BREAK = 5 * 60;
    const LONG_BREAK = 15 * 60;

    let isPaused = true;
    let timerId = null;
    let isPomodoro = true;
    let pomodoroCount = 0;
    
    // Timestamp-based logic variables
    let expectedEndTime = 0;
    let remainingSeconds = POMODORO_DURATION;

    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressBar = document.querySelector('.progress-ring-circle');

    const radius = progressBar ? progressBar.r.baseVal.value : 40;
    const circumference = 2 * Math.PI * radius;

    if (progressBar) {
        progressBar.style.strokeDasharray = circumference;
    }

    function updateProgressBar(progress) {
        if (progressBar) {
            const offset = circumference - progress * circumference;
            progressBar.style.strokeDashoffset = offset;
        }
    }

    function updateTimerDisplay(seconds) {
        if (!timerDisplay) return;
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Pomodoro Math:
        // 1. Determine total duration based on phase.
        // 2. Calculate progress ratio.
        // 3. Update the SVG circle.
        let totalPhaseDuration = isPomodoro ? POMODORO_DURATION : (pomodoroCount % 4 === 0 ? LONG_BREAK : SHORT_BREAK);
        const progress = 1 - (seconds / totalPhaseDuration);
        updateProgressBar(progress);
    }

    function tick() {
        if (isPaused) return;
        
        // Calculate remaining time by diffing Date.now() against expectedEndTime
        const now = Date.now();
        remainingSeconds = Math.max(0, (expectedEndTime - now) / 1000);
        
        updateTimerDisplay(remainingSeconds);

        if (remainingSeconds <= 0) {
            clearInterval(timerId);
            timerId = null;
            playBeep();

            if (isPomodoro) {
                pomodoroCount++;
                logSession(); // Log successful pomodoro session
                
                if (pomodoroCount % 4 === 0) {
                    remainingSeconds = LONG_BREAK;
                    alert("Long break time!");
                } else {
                    remainingSeconds = SHORT_BREAK;
                    alert("Short break time!");
                }
            } else {
                remainingSeconds = POMODORO_DURATION;
                alert("New Pomodoro session!");
            }

            isPomodoro = !isPomodoro;
            updateTimerDisplay(remainingSeconds);
            
            // Automatically start the next phase
            expectedEndTime = Date.now() + (remainingSeconds * 1000);
            timerId = setInterval(tick, 100); // Run tick more frequently to ensure UI smoothness
        }
    }

    // --- Analytics: Log Session ---
    async function logSession() {
        try {
            await apiFetch('/api/stats', { method: 'POST' });
            renderHeatmap(); // Refresh heatmap
        } catch (error) {
            console.error('Failed to log session', error);
        }
    }

    // --- Analytics: Heatmap ---
    async function renderHeatmap() {
        const heatmapContainer = document.getElementById('heatmap');
        if (!heatmapContainer) return;

        try {
            const response = await apiFetch('/api/stats');
            const data = await response.json();
            
            heatmapContainer.innerHTML = '';
            
            // Generate last 28 days
            for (let i = 27; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0];
                
                const count = data[dateString] || 0;
                
                const cell = document.createElement('div');
                cell.classList.add('heatmap-cell');
                cell.title = `${dateString}: ${count} sessions`;
                
                // Determine color level (0-4)
                let level = 0;
                if (count > 0) level = 1;
                if (count > 2) level = 2;
                if (count > 4) level = 3;
                if (count > 6) level = 4;
                
                if (level > 0) {
                    cell.setAttribute('data-level', level);
                }
                
                heatmapContainer.appendChild(cell);
            }
        } catch (error) {
            console.error("Failed to load heatmap data", error);
        }
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (isPaused) {
                isPaused = false;
                startBtn.textContent = 'LOCKTF';
                // Set expected end time based on currently remaining seconds
                expectedEndTime = Date.now() + (remainingSeconds * 1000);
                if (!timerId) {
                    timerId = setInterval(tick, 100); // 100ms interval for smoother updates and drift prevention
                }
            }
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            if (!isPaused) {
                isPaused = true;
                clearInterval(timerId);
                timerId = null;
                // remainingSeconds is already updated in the last tick
                if (startBtn) startBtn.textContent = 'Start';
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearInterval(timerId);
            timerId = null;
            isPaused = true;
            remainingSeconds = POMODORO_DURATION;
            isPomodoro = true;
            pomodoroCount = 0;
            updateTimerDisplay(remainingSeconds);
            if (startBtn) startBtn.textContent = 'Start';
        });
    }

    // Initialize display
    updateTimerDisplay(remainingSeconds);


    // --- To-Do List ---
    const taskInput = document.getElementById('new-task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const todoList = document.getElementById('todo-list');

    // Load tasks from API
    async function loadTasks() {
        try {
            const response = await apiFetch('/api/todos');
            const tasks = await response.json();
            todoList.innerHTML = '';
            tasks.forEach(task => {
                addTaskElement(task.task, task.id, task.status);
            });
        } catch (error) {
            console.error('Failed to load tasks', error);
            todoList.innerHTML = '';
        }
    }

    // Save task to API
    async function addTaskElement(taskText, taskId = null, status = 0) {
        if (!todoList || taskText.trim() === '') return;

        const li = document.createElement('li');
        li.textContent = taskText;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.classList.add('delete-btn');

        // Initial render logic
        if (taskId) {
            li.dataset.id = taskId;
        }
        
        li.dataset.status = status;
        if (status === 1) {
            li.classList.add('completed');
        }

        // Toggle complete
        li.addEventListener('click', async (e) => {
            if (e.target === deleteBtn) return;
            
            const newStatus = li.dataset.status === "1" ? 0 : 1;
            li.dataset.status = newStatus;
            li.classList.toggle('completed');

            const id = li.dataset.id;
            if (id) {
                try {
                    await apiFetch(`/api/todos/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    });
                } catch (error) {
                    console.error('API Update failed', error);
                    // Revert UI on failure
                    li.dataset.status = newStatus === 1 ? 0 : 1;
                    li.classList.toggle('completed');
                }
            }
        });

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const id = li.dataset.id;
            if (id) {
                try {
                    await apiFetch(`/api/todos/${id}`, { method: 'DELETE' });
                    li.remove();
                } catch (error) {
                    console.error('API Delete failed', error);
                }
            } else {
                 li.remove(); // Just remove from UI if no ID
            }
        });

        li.appendChild(deleteBtn);
        todoList.appendChild(li);
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const taskText = taskInput.value;
            if (taskText.trim() === '') return;

            taskInput.value = ''; // clear immediately
            let newId = null;

            try {
                const response = await apiFetch('/api/todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task: taskText })
                });
                const data = await response.json();
                newId = data.id;
                addTaskElement(taskText, newId);
            } catch (error) {
                console.error('Failed to save to API', error);
            }
        });
    }

    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTaskBtn.click();
            }
        });
    }

    // --- Random Quote Generator ---
    const quoteDisplay = document.getElementById('random-quote');
    const authorDisplay = document.getElementById('quote-author');

    function fetchAndDisplayQuote() {
        fetch('static/data/quotes.json')
            .then(response => response.json())
            .then(quotes => {
                const randomIndex = Math.floor(Math.random() * quotes.length);
                const randomQuote = quotes[randomIndex];
                if (quoteDisplay) quoteDisplay.textContent = `"${randomQuote.quote}"`;
                if (authorDisplay) authorDisplay.textContent = `- ${randomQuote.author}`;
            })
            .catch(error => {
                console.error('Error fetching quotes:', error);
                if (quoteDisplay) quoteDisplay.textContent = "Could not load a quote.";
            });
    }

    fetchAndDisplayQuote();

    // Start the app by checking auth
    checkAuth();
});
