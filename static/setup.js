function initializeUI() {
    IntervalManager.start();
    loadScheduleList();
    Object.assign(UI, AC);
    $(`input[name="mode"][value="${UI.mode}"]`).prop('checked', true);
    $(`input[name="hold"][value="${UI.holdType}"]`).prop('checked', true);
    $('#hold-time').val(UI.holdTime);
    $('#setpoint').val(UI.setpoint);
    $('#passive-hys').val(UI.passiveHys);
    $('#active-hys').val(UI.activeHys);
    if (schedules.currentScheduleName) {
        $('#load-sched').val(schedules.currentScheduleName);
        loadSchedule(schedules.currentScheduleName);
    }
}
function handleInputChange(property, parseAsInt = false) {
    return function() {
        UI[property] = parseAsInt ? parseInt($(this).val(), 10) : $(this).val();
        if (property === 'holdType') handleHoldType();
        hasUIChanged();
    };
}
$('input[name="mode"]').change(handleInputChange('mode'));
$('input[name="hold"]').change(handleInputChange('holdType'));
$('#hold-time').change(handleInputChange('holdTime'));
$('#setpoint').change(handleInputChange('setpoint', true));
$('#passive-hys').change(handleInputChange('passiveHys', true));
$('#active-hys').change(handleInputChange('activeHys', true));
function loadState() {
    return fetch('/app_state')
        .then(response => response.json())
        .then(data => {
            if (Object.keys(data).length === 0) {
                noState = pauseUpdatesUntilSave = true;
                saveState();
                return;
            } else { noState = false;
                pauseUpdatesUntilSave = false;
             }
            Object.assign(AC, data.AC);
            Object.assign(V, data.V);
            Object.assign(schedules, data.schedules);
            lastState = JSON.parse(JSON.stringify(data)); 
            console.log('App state loaded');
        })
        .catch(error => console.error('Error getting app state:', error));
}
function saveState() {
    const currentState = {
        AC,
        V,
        schedules
    };
    if (noState) { lastState = currentState; }
    if (hasStateChanged(currentState, lastState) || noState) {
        return fetch('/app_state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentState) })
        .then(response => response.json())
        .then(result => {
            if (result.success) { console.log('App state sent');
                lastState = JSON.parse(JSON.stringify(currentState));
                if (noState) {
                    noState = false;
                    unsavedSettings = true;
                    unsavedWarning();
                }
            } else { console.error('Failed sending app state'); }
        })
        .catch(error => console.error('Error sending app state:', error));
    } else { console.log('App state unchanged.', JSON.stringify(thermostat, null, 2));
        return Promise.resolve(); } 
}
function hasStateChanged(currentState, lastState) {
    if (!lastState) return false;
    const _ = lastState;
    if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
    const sortedCurrent = sortObject(currentState);
    const sortedLast = sortObject(lastState);
    return !isEqual(sortedCurrent.AC, sortedLast.AC) || !isEqual(sortedCurrent.schedules, sortedLast.schedules);
    } else return false;
}
function readThermostat() {
    return new Promise((resolve, reject) => {
        let thermostatTimeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            thermostatTimeoutId = setTimeout(() => reject(new Error('Operation timed out')), 30000);
        });
        const updatePromise = fetch('/read_thermostat')
        .then(response => response.json())
        .then(reading => Object.assign(thermostat, reading));
        Promise.race([updatePromise, timeoutPromise])
            .then(() => {
                clearTimeout(thermostatTimeoutId);
                handleReadout();                
                resolve();
            })
            .catch((error) => {
                clearTimeout(thermostatTimeoutId);
                reject(error);
            });
    });
}
function setThermostat(setpoint, mode) {
    fetch('/set_thermostat', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode, setpoint }).toString() });
}
const IntervalManager = (function() {
    let lastEventTime = 0;
    let nextEventTime = 0;
    let intervalManagerTimeoutId = null;
    let hurryRequested = false;
    let repeatHurryRequests = 0;
    let lastHurryTime = 0;
    const defaultMinInterval = 50000;
    function scheduleInterval() {
        const now = Date.now();
        const timeSinceLastEvent = now - lastEventTime;
        const maxInterval = timeToMinuteStart = 60000 - (now % 60000);
        let interval;
        if (hurryRequested) {
            const hurryMinInterval = 15000;
            const hurryInterval = hurryMinInterval * Math.pow(2, repeatHurryRequests);
            interval = Math.max(hurryInterval - timeSinceLastEvent, 0);
        } else if (maxInterval >= defaultMinInterval) {
            interval = maxInterval;
        } else {
            interval = defaultMinInterval;
        }
        nextEventTime = now + interval;
        clearTimeout(intervalManagerTimeoutId);
        intervalManagerTimeoutId = setTimeout(processEvent, interval);
    }
    function processEvent() {
        const now = Date.now();
        eventChain();
        lastEventTime = now;
        hurryRequested = false;
        repeatHurryRequests = 0;
        scheduleInterval();
    }
    return {
        start: function() {
            processEvent();
        },
        hurry: function() {
            const now = Date.now();
            if (!hurryRequested) {
                hurryRequested = true;
                if (now - lastHurryTime < defaultMinInterval) { 
                    repeatHurryRequests = Math.min(repeatHurryRequests + 1, 2); 
                } else {
                    repeatHurryRequests = 0;
                }
                lastHurryTime = now;
                clearTimeout(intervalManagerTimeoutId);
                scheduleInterval();
            }
        }
    };
})();
