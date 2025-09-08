// Initial values for Pomodoro and break timers
const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK = 5 * 60; // 5 minutes
const LONG_BREAK = 15 * 60; // 15 minutes

let timerSeconds = POMODORO_DURATION;
let isPaused = true;
let timerId = null;
let isPomodoro = true;
let pomodoroCount = 0;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');

const progressBar = document.querySelector('.progress-ring-circle');
const radius = progressBar.r.baseVal.value;
const circumference = 2 * Math.PI * radius;

progressBar.style.strokeDasharray = circumference; // Set once

function updateProgressBar(progress) {
    // progress is a value from 0 to 1, where 1 means full progress
    const offset = circumference - progress * circumference;
    progressBar.style.strokeDashoffset = offset;
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Calculate progress for the current phase (pomodoro or break)
    let totalPhaseDuration;
    if (isPomodoro) {
        totalPhaseDuration = POMODORO_DURATION;
    } else if (pomodoroCount % 4 === 0) {
        totalPhaseDuration = LONG_BREAK;
    } else {
        totalPhaseDuration = SHORT_BREAK;
    }

    const progress = 1 - (timerSeconds / totalPhaseDuration);
    updateProgressBar(progress);
}

function tick() {
    // If the timer is paused, do nothing
    if (isPaused) return;

    timerSeconds--;
    updateTimerDisplay();

    // The logic to handle the transition should run when the timer hits zero or goes below.
    if (timerSeconds <= 0) {
        // Stop the current timer from running.
        clearInterval(timerId);
        timerId = null;

        if (isPomodoro) {
            pomodoroCount++;
            if (pomodoroCount % 4 === 0) {
                timerSeconds = LONG_BREAK;
                document.getElementById('xyz').play();
                alert("Long break time!");
            } else {
                timerSeconds = SHORT_BREAK;
                document.getElementById('xyz').play();
                alert("Short break time!");
            }
        } else {
            timerSeconds = POMODORO_DURATION;
            document.getElementById('xyz').play();
            alert("New Pomodoro session!");
        }

        isPomodoro = !isPomodoro;
        updateTimerDisplay(); // Update display immediately for the new phase
        timerId = setInterval(tick, 1000); // Automatically start the next session
    }
}
startBtn.addEventListener('click', () => {
    isPaused = false;
    startBtn.textContent = 'LOCKTF';
    if (!timerId) {
        timerId = setInterval(tick, 1000);
    }
});

pauseBtn.addEventListener('click', () => {
    isPaused = true;
    document.getElementById('xyz').play();
    startBtn.textContent = 'Start';
});

// Modified reset button logic to also reset progress bar
resetBtn.addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    isPaused = true;
    timerSeconds = POMODORO_DURATION;
    isPomodoro = true;
    pomodoroCount = 0;
    updateTimerDisplay(); // This will also reset the progress bar
    startBtn.textContent = 'Start';
});


// Initial display update (this will also set the initial progress bar state)
updateTimerDisplay();
