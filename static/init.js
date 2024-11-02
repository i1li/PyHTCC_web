let lastUpdateTime = 0;
let hasUnsavedChanges = false;
let currentTimeslotIndex = -1;
let UI = {};
let appData = AC = JSON.parse(localStorage.getItem('appData')) || {
    schedules: {},
    currentScheduleName: '',
    currentSchedule: {},
    holdType: 'permanent',
    holdUntil: null,
    holdTemp: 0,
    mode: 'cool',
    currentTemp: 0,
    currentMode: null,
    setpoint: 82, 
    currentSetpoint: 0,
    rawSetpoint: 0,
    activeSetpoint: 0,
    restSetpoint: 0,
    hysSetpoint: 0,
    passiveHys: 0,
    activeHys: 0,
    running: false,
    readyToRest: false,
    resting: false,
    restingSince: 0,
    restingAtEdgeFor: 0,
    runningSince: 0,
    runningAtEdgeSince: 0,
    runningAtEdgeFor: 0,
    atEdgeMinTime: 300000,
    atEdgeMaxTime: 500000,
    latestReading: null,
};
