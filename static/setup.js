function updateStatus() {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        const timeToWait = Math.max(0, 30000 - (now - lastUpdateTime));
        setTimeout(() => {
            lastUpdateTime = Date.now();
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Operation timed out')), 50000);
            });
            const updatePromise = fetch('/get_status')
            .then(response => response.json())
            .then(reading => Object.assign(thermostat, reading));     
            Promise.race([updatePromise, timeoutPromise])
                .then(() => {
                    clearTimeout(timeoutId);
                    const currentTime = getCurrentTime();
                    if (thermostat.setpoint !== lastEnteredSetpoint || thermostat.mode !== lastEnteredMode && !externalUpdate) {
                        handleExternalUpdate();
                    } else if (thermostat.setpoint === lastEnteredSetpoint || thermostat.mode === lastEnteredMode) {
                        externalUpdate = false;
                    }
                    if (AC.holdType === 'temporary' && AC.holdUntil && currentTime >= AC.holdUntil) {
                        switchHoldType('schedule')
                }
                    document.getElementById('current-temp').textContent = `Current Temp: ` + thermostat.temp;
                    $('#status').html(`<pre>${JSON.stringify(AC, null, 2)}</pre>`);
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        }, timeToWait);
    });
}
function manageState(action) {
    if (action === 'load') {
        return fetch('/app_data')
            .then(response => response.json())
            .then(data => {
                Object.assign(AC, data.AC);
                Object.assign(UI, data.UI);
                Object.assign(V, data.V);
                Object.assign(schedules, data.schedules);
                lastFetchedState = JSON.parse(JSON.stringify(data)); 
                console.log('App state retrieved from server');
            })
            .catch(error => console.error('Error getting app state from server:', error));
    } else if (action === 'save') {
        const currentState = {
            AC,
            UI,
            V,
            schedules
        };
        if (hasStateChanged(currentState, lastFetchedState)) {
            return fetch('/app_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(currentState)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    console.log('App state sent to server');
                    lastFetchedState = JSON.parse(JSON.stringify(currentState)); 
                } else {
                    console.error('Failed to send app state to server');
                }
            })
            .catch(error => console.error('Error sending app state to server:', error));
        } else {
            console.log('No updates.', JSON.stringify(thermostat, null, 2));
            return Promise.resolve(); 
        }
    } else {
        console.error('Invalid action for manageState');
        return Promise.reject('Invalid action');
    }
}
function hasStateChanged(currentState, lastFetchedState) {
    if (!lastFetchedState) return false;
    if (JSON.stringify(currentState) !== JSON.stringify(lastFetchedState)) {
    const sortedCurrent = sortObject(currentState);
    const sortedLast = sortObject(lastFetchedState);
    return !isEqual(sortedCurrent.AC, sortedLast.AC) ||
           !isEqual(sortedCurrent.schedules, sortedLast.schedules) ||
           !isEqual(sortedCurrent.V.setpointToUse, sortedLast.V.setpointToUse);
    } else return false;
}
function initializeUI() {
    scheduleStartOfMinute();
    loadScheduleList();
    Object.assign(UI, AC);
    $(`input[name="mode"][value="${UI.mode}"]`).prop('checked', true);
    $(`input[name="hold"][value="${UI.holdType}"]`).prop('checked', true);
    $('#setpoint').val(UI.setpoint);
    $('#passive-hys').val(UI.passiveHys);
    $('#active-hys').val(UI.activeHys);
    $('#hold-until').val(UI.holdUntil);
    if (schedules.currentScheduleName) {
        $('#load-schedule').val(schedules.currentScheduleName);
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
$('input[name="hold"]').change(handleInputChange('holdType'));
$('#hold-until').change(handleInputChange('holdUntil'));
$('input[name="mode"]').change(handleInputChange('mode'));
$('#setpoint').change(handleInputChange('setpoint', true));
$('#passive-hys').change(handleInputChange('passiveHys', true));
$('#active-hys').change(handleInputChange('activeHys', true));
function handleExternalUpdate() {
    externalUpdate = true;
    const hourLater = getOneHourLaterTime();
    AC.holdUntil = hourLater;
    UI.holdUntil = AC.holdUntil;
    AC.mode = thermostat.mode;
    UI.mode = AC.mode;
    holdTemp = thermostat.setpoint;
    switchHoldType('temporary');
}