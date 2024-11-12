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
        if (property === 'holdType') updateHoldType();
        hasUIChanged();
    };
}
$('input[name="mode"]').change(handleInputChange('mode'));
$('input[name="hold"]').change(handleInputChange('holdType'));
$('#hold-time').change(handleInputChange('holdTime'));
$('#setpoint').change(handleInputChange('setpoint', true));
$('#passive-hys').change(handleInputChange('passiveHys', true));
$('#active-hys').change(handleInputChange('activeHys', true));
function handleReadout() {
    document.getElementById('current-temp').textContent = `Current Temp: ` + thermostat.temp;
    if (firstReading) {
        if (!AC.setpoint || !AC.mode) {
            lastSetpoint = AC.setpoint = UI.setpoint = thermostat.setpoint;
            lastMode = AC.mode = UI.mode = thermostat.mode;
            pauseUpdatesUntilSave = false;
        } else {
            lastMode = UI.mode = thermostat.mode;
            lastSetpoint = UI.setpoint = thermostat.setpoint;
            pauseUpdatesUntilSave = true;
        }
        externalUpdate = false;
        firstReading = false;
        return;
    }
    else if (thermostat.setpoint == lastSetpoint && thermostat.mode == lastMode) { externalUpdate = false;
    } else {
        if (confirmed) {
            populated = false;
            externalUpdate = true;
            switchHoldType('temp');
            lastMode = AC.mode = UI.mode = thermostat.mode;
            lastSetpoint = AC.setpoint = UI.setpoint = thermostat.setpoint;
            pauseUpdatesUntilSave = false;
            updateHoldType();
        } else {
            confirmed = true;
            pauseUpdatesUntilSave = true;
        }
    }
}
function loadState() {
    return fetch('/app_state')
        .then(response => response.json())
        .then(data => {
            if (Object.keys(data).length === 0) {
                pauseUpdatesUntilSave = true;
                noState = true;
                saveState();
                return;
            } else { noState = false;
                pauseUpdatesUntilSave = true;
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
                    pauseUpdatesUntilSave = true;
                    unsavedChangesWarning();
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
