if (noUI) {
    loadState()
        .then(() => { return IntervalManager.start(); })
        .catch(error => console.error('Error in noUI flow:', error));
} else {
    $(document).ready(function() {
        loadState()
            .then(() => { return initializeUI(); })
            .catch(error => console.error('Error in UI flow:', error));
    });
}
const IntervalManager = (function() {
    let lastEventTime = 0;
    let nextEventTime = 0;
    let timeoutId = null;
    let expediteRequested = false;
    function intervalSchedule() {
        const now = Date.now();
        const timeSinceLastEvent = now - lastEventTime;
        const timeToNextMinute = 60000 - (now % 60000);
        let timeBetweenEvents;
        if (expediteRequested) {
            timeBetweenEvents = Math.max(30000 - timeSinceLastEvent, 0);
        } else if (timeToNextMinute >= 50000) {
            timeBetweenEvents = timeToNextMinute;
        } else {
            timeBetweenEvents = Math.max(50000 - timeSinceLastEvent, 0);
        }
        nextEventTime = now + timeBetweenEvents;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(processEvent, timeBetweenEvents);
    }
    function processEvent() {
        const now = Date.now();
        eventChain();
        lastEventTime = now;
        expediteRequested = false;
        intervalSchedule();
    }
    async function eventChain() {
        console.log(`Processing eventChain at ${new Date().toLocaleTimeString()}`);
        try {
            await readThermostat();
            if (!pauseUpdatesUntilSave) {
                await new Promise(resolve => {
                    handleHoldType();
                    resolve();
                });
                await new Promise(resolve => {
                    V.adjustedSetpoint = hys(AC.setpoint, AC.mode);
                    resolve();
                });
                await new Promise(resolve => {
                    if (thermostat.mode != AC.mode || thermostat.setpoint != V.adjustedSetpoint && !unconfirmedUpdate) {
                        setThermostat(V.adjustedSetpoint, AC.mode);
                        unconfirmedUpdate = true;
                        saveState();
                    }
                    resolve();
                });
            }
        } catch (error) {
            console.error('Error in eventChain:', error);
        }
    }
    return {
        start: function() {
            eventChain(); 
            lastEventTime = Date.now();
            intervalSchedule();
        },
        expedite: function() {
            if (!expediteRequested) {
                expediteRequested = true;
                clearTimeout(timeoutId);
                intervalSchedule();
            }
        }
    };
})();
function handleReadout() {
    document.getElementById('current-temp').textContent = `Current Temp: ` + thermostat.temp;
    if (firstReading) {
        firstReading = false;
        pauseUpdatesUntilSave = false;
        const firstReadout = hys(AC.setpoint, AC.mode)
        if (thermostat.setpoint != firstReadout || thermostat.mode != AC.mode) {
            unsavedSettings = true;
            unsavedWarning();
        }
    } else if (V.adjustedSetpoint == thermostat.setpoint && AC.mode == thermostat.mode) { unconfirmedUpdate = externalUpdate = false;
    } else if (!unconfirmedUpdate && V.adjustedSetpoint != thermostat.setpoint || AC.mode != thermostat.mode) {
        AC.mode = UI.mode = thermostat.mode;
        const externalAdjustedSetpoint = hys(thermostat.setpoint, thermostat.mode);
        const adjustmentDifference = thermostat.setpoint - externalAdjustedSetpoint;
        const reverseAdjustment = externalAdjustedSetpoint + adjustmentDifference;
        AC.setpoint = UI.setpoint = reverseAdjustment;
        externalUpdate = true;
        pauseUpdatesUntilSave = false;
        populated = false;
        switchHoldType('temp');
    }
}
function readThermostat() {
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
function handleHoldType() {
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
    if (AC.holdType === 'temp' && !externalUpdate && AC.holdTime) {
        if (AC.holdTime === '00:00') {
            if (timeNow === '00:00') {
                pauseUpdatesUntilSave = false;
                switchHoldType('sched');
            }
        } else if (timeNow >= AC.holdTime) {
            pauseUpdatesUntilSave = false;
            switchHoldType('sched');
        }
    }
    if (AC.holdType === 'sched') {
        const sched = schedInfo();
        AC.setpoint = sched.scheduledTemp;
        AC.holdTime = sched.nextTimeslot.time;
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
        const sched = schedInfoUI();
        if (!populated || lastHoldTime !== UI.holdTime) {
            if (!externalUpdate) {
                populateTimeslotNav(sched.nextTimeslot);
            } else if (externalUpdate) {
                const { sched, givenTime } = initializeTimeslotIndex(hourLater);
                populateTimeslotNav(sched.thisTimeslot, givenTime);
                AC.holdTime = UI.holdTime;
                externalUpdate = false;
                V.resting = false; 
            }
        }
        $('#setpoint').val(UI.setpoint);
        $('#hold-time').val(UI.holdTime);
        lastHoldTime = UI.holdTime;
        populated = true;
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').show();
    } else if (UI.holdType === 'perm') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').hide();
        populated = false;
        $('#setpoint').val(UI.setpoint);
    }
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    unsavedSchedule = unsavedSettings = false;
    unsavedWarning();
    handleHoldType();
    IntervalManager.expedite();
});
