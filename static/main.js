$(document).ready(async function() {
    try {
        await initialize();
        console.log("Initialization complete");
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
async function updateCycle() {
    console.log(`Processing updateCycle at ${new Date().toLocaleTimeString()}`);
    try {
        await readThermostat();
        if (!pauseUntilSave) {
            processSchedule();
            if (!unconfirmedUpdate) {
                V.adjustedSetpoint = hys(AC.setpoint, AC.mode);
            }
            if (V.adjustedSetpoint != thermostat.setpoint || AC.mode != thermostat.mode) {
                setThermostat(V.adjustedSetpoint, AC.mode);
                unconfirmedUpdate = true;
                saveState();
            }
        }
    } catch (error) {
        console.error('Error in updateCycle:', error);
    }
}
function handleReading() {
    $('#current-temp').text(`Current Temp: ${thermostat.temp}`);
    if (firstReading) {
        firstReading = false;
        pauseUntilSave = false;
        const firstReadout = hys(AC.setpoint, AC.mode)
        if (thermostat.setpoint != firstReadout || thermostat.mode != AC.mode) {
            unsavedSettings = true;
            unsavedWarning();
        }
    } else if (V.adjustedSetpoint == thermostat.setpoint && AC.mode == thermostat.mode && unconfirmedUpdate) { unconfirmedUpdate = externalUpdate = false;
    } else if (V.adjustedSetpoint != thermostat.setpoint || AC.mode != thermostat.mode) {
        AC.mode = UI.mode = thermostat.mode;
        const externalAdjustedSetpoint = hys(thermostat.setpoint, thermostat.mode);
        const adjustmentDifference = externalAdjustedSetpoint - thermostat.setpoint;
        const reverseAdjustment = externalAdjustedSetpoint - adjustmentDifference * 2;
        AC.setpoint = UI.setpoint = reverseAdjustment;
        externalUpdate = true;
        unconfirmedUpdate = populated = pauseUntilSave = false;
        switchHoldType('temp');
    }
}
function processSchedule() {
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
                pauseUntilSave = false;
                switchHoldType('sched');
            }
        } else if (timeNow >= AC.holdTime) {
            pauseUntilSave = false;
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
    unsavedWarning(false);
    go.hurry();
});
