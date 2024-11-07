let lastEnteredMode = null;
let lastEnteredSetpoint = null;
let unsavedSchedule = false;
let unsavedSettings = false;
let currentTimeslotIndex = -1;
let lastFetchedState = null;
let lastUpdateTime = 0;
let externalUpdate = false;
let populated = false;
let pauseUpdatesUntilSave = false;
let noUI = false;
let UI = {};
let settings = AC = {
    holdType: 'permanent',
    holdUntil: null,
    holdTemp: 0,
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
let schedules = {
    schedules: {},
    currentSchedule: {},
    currentScheduleName: '',
};
let thermostat = {
    temp: 0,
    mode: null,
    setpoint: 0,
    running: false,
};
