let firstReading = true; 
let pauseUntilSave = true;
let noState = true;
let lastState = null;
let UI = {};
let populated = false;
let lastHoldTime = '';
let currentTimeslotIndex = -1;
let unsavedSchedule = false;
let unsavedSettings = false;
let externalUpdate = false;
let unconfirmedUpdate = false;
let settings = AC = {
    holdType: '',
    holdTime: '',
    mode: '',
    setpoint: 0, 
    passiveHys: 0,
    activeHys: 0
};
const advancedSettings = {
    runAtEdgeMinTime: 5,
    restAtEdgeMaxTime: 7,
    runMaxTime: 25,
    restMaxTime: 50,
    quickRestMaxTime: 5
};
function minutesToMilliseconds(minutes) {
    return Math.round(minutes * 60 * 1000);
}
Object.entries(advancedSettings).forEach(([key, value]) => {
    AC[key] = minutesToMilliseconds(value);
});
let variables = V = {
    activeSetpoint: 0,
    restSetpoint: 0,
    adjustedSetpoint: 0,
    shouldRest: false,
    resting: false,
    quickResting: false,
    restingSince: 0,
    restingFor: 0,
    restingAtEdgeSince: 0,
    restingAtEdgeFor: 0,
    runningSince: 0,
    runningFor: 0,
    runningAtEdgeSince: 0,
    runningAtEdgeFor: 0,
};
let schedules = {
    schedules: {},
    currentSchedule: {},
    currentScheduleName: '',
};
let thermostat = {
    temp: 0,
    mode: '',
    setpoint: 0,
    running: false,
};
