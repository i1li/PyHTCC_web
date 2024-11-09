let initial = true; 
let pauseUpdatesUntilSave = true;
let noState = true;
let lastState = null;
let noUI = false;
let UI = {};
let history = {};
let lastMode = '';
let lastSetpoint = 0;
let lastUpdateTime = 0;
let externalUpdate = false;
let populated = false;
let shouldPopulate = false;
let lastHoldTime = '';
let currentTimeslotIndex = -1;
let unsavedSchedule = false;
let unsavedSettings = false;
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
    restAtEdgeMaxTime: 8.5,
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
    setpointToUse: 0,
    shouldRest: false,
    shouldQuickRest: false,
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
