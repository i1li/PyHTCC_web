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
        populated = pauseUpdatesUntilSave = false;
        switchHoldType('temp');
    }
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
        $('#setpoint').val(AC.setpoint);
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
                externalUpdate = V.resting = false;
            }
        }
        $('#setpoint').val(AC.setpoint);
        $('#hold-time').val(AC.holdTime);
        lastHoldTime = AC.holdTime;
        populated = true;
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').show();
    } else if (UI.holdType === 'perm') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').hide();
        populated = false;
        $('#setpoint').val(AC.setpoint);
    }
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    unsavedSchedule = unsavedSettings = false;
    unsavedWarning();
    IntervalManager.hurry();
});
