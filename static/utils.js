let appData = AC = JSON.parse(localStorage.getItem('appData')) || {
    schedules: {},
    currentTemp: 0,
    currentMode: null,
    currentScheduleName: '',
    currentSchedule: {},
    holdType: 'permanent',
    holdUntilTime: null,
    setpoint: 0, 
    currentSetpoint: 0,
    scheduledTemp: 0, 
    cycleRange: 0,
    mode: 'cool',
    latestReading: null,
    running: false,
    readyToRest: false,
    resting: false,
    restingSince: null,
    runningSince: null,
    runningAtSetpointDuration: 0,
    runningAtSetpointSince: null,
    atSetpointMinTime: 100000,
    setpointToUse: 0,
    rawSetpoint: 0,
    restSetpoint: 0,
    runningAtSetpointSince: 0,
    restingAtSetpointDuration: 0,
};
function saveAppData() {
    localStorage.setItem('appData', JSON.stringify(AC));
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
