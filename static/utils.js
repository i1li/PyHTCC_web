function saveAppData() {
    localStorage.setItem('appData', JSON.stringify(AC));
}
function initializeUI() {
    scheduleMinuteStart();
    loadScheduleList();
    Object.assign(UI, AC);
    $(`input[name="mode"][value="${UI.mode}"]`).prop('checked', true);
    $(`input[name="hold"][value="${UI.holdType}"]`).prop('checked', true);
    $('#setpoint').val(UI.setpoint);
    $('#passive-hys').val(UI.passiveHys);
    $('#active-hys').val(UI.activeHys);
    $('#hold-until').val(UI.holdUntil);
    if (UI.currentScheduleName) {
        $('#load-schedule').val(UI.currentScheduleName);
        loadSchedule(UI.currentScheduleName);
    }
}
function scheduleMinuteStart() {
    const now = new Date();
    const delay = 60000 - (now.getSeconds() * 1000);
    setTimeout(() => {
        runTasksOnMinute();
        setInterval(runTasksOnMinute, 60000);
    }, delay);
}
function formatTime(hours, minutes) {
    return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
}
function getCurrentTime() {
    const now = new Date();
    return formatTime(now.getHours(), now.getMinutes());
}
function getOneHourLaterTime() {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
    return formatTime(oneHourLater.getHours(), oneHourLater.getMinutes());
}
function updateWarning() {
    const warningElement = document.getElementById('warning');
    const applyElement = document.getElementById('apply');
    const saveScheduleElement = document.getElementById('save-schedule');
    const warning2Element = document.getElementById('warning2');
    if (hasUnsavedChanges || hasUnsavedSchedule) {
        warningElement.style.display = 'block';
        applyElement.style.border = 'red solid 3px';
    } else {
        warningElement.style.display = 'none';
        applyElement.style.border = 'none';
    }
    if (!hasUnsavedChanges && hasUnsavedSchedule) {
        warning2Element.style.display = 'block';
        saveScheduleElement.style.border = 'red solid 3px';
    } else if (!hasUnsavedSchedule) {
        warning2Element.style.display = 'none';
        saveScheduleElement.style.border = 'none';
    }
}
function checkForChanges() {
    const modeChanged = UI.mode !== AC.mode;
    const holdTypeChanged = UI.holdType !== AC.holdType;
    const holdUntilChanged = UI.holdUntil !== AC.holdUntil;
    const setpointChanged = UI.setpoint !== AC.setpoint;
    const passiveHysChanged = UI.passiveHys !== AC.passiveHys;
    const activeHysChanged = UI.activeHys !== AC.activeHys;
    hasUnsavedChanges = modeChanged || holdTypeChanged || holdUntilChanged || setpointChanged || passiveHysChanged || activeHysChanged;
    updateWarning();
}
function checkForScheduleChanges() {
    const uiSchedule = getUIScheduleInfo();
    const acSchedule = getACScheduleInfo();
    if (!uiSchedule || !acSchedule) return true; 
    if (!uiSchedule.timeslots || !acSchedule.timeslots) return true; 
    const schedulesEqual = JSON.stringify(uiSchedule.timeslots) === JSON.stringify(acSchedule.timeslots);
    const scheduleChanged = !schedulesEqual;
    hasUnsavedSchedule = scheduleChanged;
    updateWarning();
    return scheduleChanged;
}
document.addEventListener('DOMContentLoaded', function() {
    const scheduleDiv = document.getElementById('schedule');
    scheduleDiv.addEventListener('input', debounce(function(event) {
        checkForScheduleChanges();
    }, 1500));
    scheduleDiv.addEventListener('change', function(event) {
        checkForScheduleChanges();
    });
    scheduleDiv.addEventListener('click', debounce(function(event) {
        checkForScheduleChanges();
    }, 1500));
});
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
const toTop = document.getElementById("toTop");
function handleScroll() {
  if (document.body.scrollTop > 160 || document.documentElement.scrollTop > 160) {
    toTop.style.display = "block";
  } else {
    toTop.style.display = "none";
  }
}
window.addEventListener('scroll', handleScroll);
function topFunction() {
  window.scrollTo(0, 0);
}
