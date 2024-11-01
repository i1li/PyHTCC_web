function saveAppData() {
    return new Promise((resolve) => {
        localStorage.setItem('appData', JSON.stringify(AC));
        resolve();
    });
}
function initializeUI() {
    scheduleNextMinute();
    loadScheduleList();
    UI.mode = AC.mode;
    $(`input[name="mode"][value="${AC.mode}"]`).prop('checked', true);
    UI.holdType = AC.holdType;
    $(`input[name="hold"][value="${AC.holdType}"]`).prop('checked', true);
    UI.setpoint = AC.setpoint;
    $('#setpoint').val(AC.setpoint);
    UI.passiveHysteresis = AC.passiveHysteresis;
    $('#passive-hysteresis').val(AC.passiveHysteresis);
    UI.activeHysteresis = AC.activeHysteresis;
    $('#active-hysteresis').val(AC.activeHysteresis);
    if (AC.holdUntil !== undefined) {
        UI.holdUntil = AC.holdUntil;
        $('#hold-until').val(AC.holdUntil);
    } else {
        UI.holdUntil = null;  
        $('#hold-until').val('');
    }
    if (AC.currentScheduleName) {
        UI.currentScheduleName = AC.currentScheduleName;
        $('#load-schedule').val(AC.currentScheduleName);
        loadSchedule(AC.currentScheduleName);
    }
}
function scheduleNextMinute() {
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
function checkForScheduleChanges() {
    const uiSchedule = getUIScheduleInfo();
    const acSchedule = getACScheduleInfo();
    if (!uiSchedule || !acSchedule) return false;
    if (!uiSchedule.timeslots || !acSchedule.timeslots) return false;
    return JSON.stringify(uiSchedule.timeslots) === JSON.stringify(acSchedule.timeslots);
}
function checkForChanges() {
    const modeChanged = UI.mode !== AC.mode;
    const holdTypeChanged = UI.holdType !== AC.holdType;
    const holdUntilChanged = UI.holdUntil !== AC.holdUntil;
    const setpointChanged = UI.setpoint !== AC.setpoint;
    const passiveHysteresisChanged = UI.passiveHysteresis !== AC.passiveHysteresis;
    const activeHysteresisChanged = UI.activeHysteresis !== AC.activeHysteresis;
    const currentScheduleChanged = !checkForScheduleChanges();
    hasUnsavedChanges = modeChanged || holdTypeChanged || holdUntilChanged || setpointChanged || passiveHysteresisChanged || activeHysteresisChanged || currentScheduleChanged;
    updateWarning();
}
function updateWarning() {
    if (hasUnsavedChanges) {
        $('#warning').text('You have unsaved changes.');
    } else {
        $('#warning').text('');
    }
}
