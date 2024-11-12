if (noUI) {
    loadState()
        .then(() => {
        return IntervalManager.start(); })
        .catch(error => console.error('Error in noUI flow:', error));
} else {
    $(document).ready(function() {
        loadState()
            .then(() => {
            return initializeUI(); })
            .catch(error => console.error('Error in UI flow:', error));
    });
}
const IntervalManager = (function() {
    let lastEventTime = 0;
    let nextEventTime = 0;
    let timeoutId = null;
    let expediteRequested = false;
    function schedule() {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastEventTime;
        const timeToNextMinute = 60000 - (now % 60000);
        let delay;
        if (expediteRequested) {
            delay = Math.max(30000 - timeSinceLastRefresh, 0);
        } else if (timeToNextMinute >= 50000) {
            delay = timeToNextMinute;
        } else {
            delay = Math.max(50000 - timeSinceLastRefresh, 0);
        }
        nextEventTime = now + delay;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(processRefresh, delay);
    }
    function processRefresh() {
        const now = Date.now();
        dataRefresh();
        lastEventTime = now;
        expediteRequested = false;
        schedule();
    }
    function dataRefresh() {
        console.log(`Refreshing data at ${new Date().toLocaleTimeString()}`);
        Promise.resolve()
        .then(() => {
            return new Promise(resolve => {
                updateStatus();
                resolve();
            });
        })
        .then(() => {
            return new Promise(resolve => {
                updateHoldType();
                resolve();
            });
        })
        .then(() => {
            if (!pauseUpdatesUntilSave) {
                return Promise.resolve()
                    .then(() => {
                        return new Promise(resolve => {
                            hys(AC.setpoint, AC.mode);
                            resolve();
                        });
                    })
                    .then(() => {
                        return new Promise(resolve => {
                            setThermostat(V.setpointToUse, AC.mode);
                            saveState();
                            resolve();
                        });
                    });
            }
        })
        .catch(error => { console.error('Error in dataRefresh:', error); });    }
    return {
        start: function() {
            dataRefresh(); 
            lastEventTime = Date.now();
            schedule();
        },
        expedite: function() {
            if (!expediteRequested) {
                expediteRequested = true;
                clearTimeout(timeoutId);
                schedule();
            }
        }
    };
})();
function updateStatus() {
    return new Promise((resolve, reject) => {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Operation timed out')), 30000);
        });
        const updatePromise = fetch('/read_thermostat')
        .then(response => response.json())
        .then(reading => Object.assign(thermostat, reading));
        Promise.race([updatePromise, timeoutPromise])
            .then(() => {
                clearTimeout(timeoutId);
                handleReadout();                
                resolve();
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}
function updateHoldType() {
    const timeNow = getTimeNow();
    const hourLater = getHourLater();
    const hasSchedule = $('.timeslot').length > 0;
    if (!hasSchedule) {
        $('#sched-hold').prop('disabled');
        if (UI.holdType === 'sched') {
            $('input[name="hold"][value="perm"]').prop('checked', true);
            UI.holdType = 'perm';
        }
    }
    if (UI.holdType === 'sched') {
        $('#setpoint').prop('readonly', true);
        $('#temp-hold-info').hide();
        populated = false;
        const sched = schedInfoUI();
        UI.setpoint = sched.scheduledTemp;
        $('#setpoint').val(UI.setpoint);
        UI.holdTime = sched.nextTimeslot.time;
    } else if (UI.holdType === 'temp') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').show();
        const sched = schedInfoUI();
        if (!populated || lastHoldTime !== UI.holdTime) {
            if (!externalUpdate && !confirmed) {
                populateTimeslotNav(sched.nextTimeslot);
            } else {
                const { sched, givenTime } = initializeTimeslotIndex(hourLater);
                populateTimeslotNav(sched.thisTimeslot, givenTime);
                AC.holdTime = UI.holdTime;
                externalUpdate = false;
                confirmed = false;         
            }
            populated = true;
            lastHoldTime = UI.holdTime;
        }
        if (!pauseUpdatesUntilSave) {
            $('#setpoint').val(AC.setpoint);
            $('#hold-time').val(AC.holdTime);
        } else {
            $('#setpoint').val(UI.setpoint);
            $('#hold-time').val(UI.holdTime);
        }
        lastHoldTime = UI.holdTime;
    } else if (UI.holdType === 'perm') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').hide();
        populated = false;
        if (!pauseUpdatesUntilSave) { $('#setpoint').val(AC.setpoint);
        } else { $('#setpoint').val(UI.setpoint); }
    }
    if (AC.holdType === 'sched') {
        const sched = schedInfo();
        AC.setpoint = sched.scheduledTemp;
        AC.holdTime = sched.nextTimeslot.time;
    } else if (AC.holdType === 'temp' && AC.holdTime && timeNow >= AC.holdTime) {
        pauseUpdatesUntilSave = false;
        switchHoldType('sched');
        updateHoldType();
    }
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    pauseUpdatesUntilSave = false;
    unsavedSettings = false;
    unsavedSchedule = false;
    unsavedChangesWarning();
    updateHoldType();
    IntervalManager.expedite();
});
