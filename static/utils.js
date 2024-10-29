let appData = AC = JSON.parse(localStorage.getItem('appData')) || {
    schedules: {},
    currentTemp: 0,
    mode: 'cool',
    currentMode: null,
    currentScheduleName: '',
    currentSchedule: {},
    holdType: 'permanent',
    holdUntilTime: null,
    setpoint: 0, 
    currentSetpoint: 0,
    scheduledTemp: 0, 
    passiveHysteresis: 0,
    activeHysteresis: 0,
    running: false,
    readyToRest: false,
    resting: false,
    restingSince: 0,
    restingAtEdgeFor: 0,
    runningSince: 0,
    runningAtEdgeSince: 0,
    runningAtEdgeFor: 0,
    atEdgeMinTime: 500000,
    rawSetpoint: 0,
    restSetpoint: 0,
    activeSetpoint: 0,
    hysteresisSetpoint: 0,
    latestReading: null,
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
