document.addEventListener('DOMContentLoaded', () => {
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
            await fetch('/api/stats', { method: 'POST' });
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
            const response = await fetch('/api/stats');
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

    // Initialize display & Heatmap
    updateTimerDisplay(remainingSeconds);
    renderHeatmap();

    // --- To-Do List ---
    const taskInput = document.getElementById('new-task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const todoList = document.getElementById('todo-list');

    // Load tasks from API, fallback to localStorage
    async function loadTasks() {
        try {
            const response = await fetch('/api/todos');
            if (!response.ok) throw new Error('API unreachable');
            const tasks = await response.json();
            todoList.innerHTML = '';
            tasks.forEach(task => {
                addTaskElement(task.task, task.id, task.status);
            });
            // Update local storage cache
            localStorage.setItem('tasks', JSON.stringify(tasks));
        } catch (error) {
            console.error('Failed to load from API, falling back to localStorage', error);
            const localTasks = JSON.parse(localStorage.getItem('tasks')) || [];
            todoList.innerHTML = '';
            localTasks.forEach(task => {
                addTaskElement(task.task || task, task.id, task.status || 0); // Handle old format
            });
        }
    }

    // Save task to API, fallback to localStorage
    async function addTaskElement(taskText, taskId = null, status = 0) {
        if (!todoList || taskText.trim() === '') return;

        const li = document.createElement('li');
        li.textContent = taskText;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.classList.add('delete-btn');

        // Initial render logic (from API or local cache)
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
                    await fetch(`/api/todos/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    });
                } catch (error) {
                    console.error('API Update failed', error);
                }
            }
            syncFallbackCache();
        });

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            li.remove();
            
            const id = li.dataset.id;
            if (id) {
                try {
                    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
                } catch (error) {
                    console.error('API Delete failed', error);
                }
            }
            
            // Always sync fallback cache
            syncFallbackCache();
        });

        li.appendChild(deleteBtn);
        todoList.appendChild(li);
    }

    function syncFallbackCache() {
        const tasks = [];
        todoList.querySelectorAll('li').forEach(item => {
            tasks.push({
                id: item.dataset.id,
                task: item.firstChild.textContent,
                status: parseInt(item.dataset.status || 0)
            });
        });
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const taskText = taskInput.value;
            if (taskText.trim() === '') return;

            taskInput.value = ''; // clear immediately
            let newId = null;

            try {
                const response = await fetch('/api/todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task: taskText })
                });
                if (response.ok) {
                    const data = await response.json();
                    newId = data.id;
                }
            } catch (error) {
                console.error('Failed to save to API, saving locally', error);
            }

            addTaskElement(taskText, newId);
            syncFallbackCache();
        });
    }

    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTaskBtn.click();
            }
        });
    }

    loadTasks();

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
});
