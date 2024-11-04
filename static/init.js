let unsavedSchedule = false;
let unsavedSettings = false;
let currentTimeslotIndex = -1;
let lastUpdateTime = 0;
let populated = false;
let pause = false;
let holdTemp = 0;
let UI = {};
let settings = AC = JSON.parse(localStorage.getItem('settings')) || {
    holdType: 'permanent',
    holdUntil: null,
    mode: 'cool',
    setpoint: 82, 
    passiveHys: 0,
    activeHys: 0,
    runAtEdgeMinTime: 300000,
    restAtEdgeMaxTime: 500000,
    maxRunTime: 1500000,
    quickRestTime: 300000,
};
let variables = V = {
    activeSetpoint: 0,
    restSetpoint: 0,
    setpointToUse: 0,
    readyToRest: false,
    readyForQuickRest: false,
    resting: false,
    quickResting: false,
    restingSince: 0,
    restingFor: 0,
    restingAtEdgeFor: 0,
    runningSince: 0,
    runningFor: 0,
    runningAtEdgeSince: 0,
    runningAtEdgeFor: 0,
};
let schedules = JSON.parse(localStorage.getItem('schedules')) || {
    schedules: {},
    currentSchedule: {},
    currentScheduleName: '',
}
let thermostat = {
    temp: 0,
    mode: null,
    setpoint: 0,
    running: false,
};
