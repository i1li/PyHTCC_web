if (noUI) {
    loadState();
    updateStatus()
    .then(() => {
        scheduleStartOfMinute();
        });
} else {
    $(document).ready(function() {
        loadState();
        updateStatus()
        .then(() => {
            initializeUI();
        });
    });
}
async function runTasksOnMinute() {
    try {
        await updateStatus();
        if (pauseUpdatesUntilSave) return;
        await new Promise(resolve => setTimeout(() => {
            saveState();
            resolve();
        }, 1000));
        await new Promise(resolve => setTimeout(() => {
            updateHoldType();
            resolve();
        }, 1000));
        await new Promise(resolve => setTimeout(() => {
            adjustedSetpoint = hys(AC.setpoint, AC.mode);
            setThermostat(adjustedSetpoint, AC.mode);
            resolve();
        }, 1000));
    } catch (error) {
        console.error('Error in runTasksOnMinute:', error);
    }
}
function updateHoldType() {
    const timeNow = getTimeNow();
    const hourLater = getHourLater();
    const hasSchedule = $('.schedule-timeslot').length > 0;
    $('#follow-schedule').prop('disabled', !hasSchedule);
    if (!hasSchedule) {
        if (UI.holdType === 'schedule') {
            $('input[name="hold"][value="permanent"]').prop('checked', true);
            UI.holdType = 'permanent';
        }
    }
    if (UI.holdType === 'schedule') {
        $('#setpoint').prop('readonly', true);
        $('#temp-hold-options').hide();
        const sched = getUIScheduleInfo();
        UI.setpoint = sched.scheduledTemp;
        $('#setpoint').val(UI.setpoint);
        UI.holdUntil = sched.nextTimeslot.time;
        populated = false;
    } else if (UI.holdType === 'temporary') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-options').show();
        UI.setpoint = AC.holdTemp;
        $('#setpoint').val(UI.setpoint);
        const sched = getUIScheduleInfo();
        if (!populated) {
            if (!externalUpdate) {
                populateTimeslotNavigation(sched.nextTimeslot);
                populated = true;
            } else {
                initializeTimeslotIndex(hourLater);
                populateTimeslotNavigation(sched.thisTimeslot);
                UI.holdUntil = hourLater;
                $('#hold-until').val(hourLater);
                populated = true;
            }
        }
    } else if (UI.holdType === 'permanent') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-options').hide();
        UI.holdUntil = null;
        populated = false;
    }
    if (AC.holdType === 'schedule') {
        const sched = getScheduleInfo();
        AC.setpoint = sched.scheduledTemp;
        AC.holdUntil = sched.nextTimeslot.time;
    } else if (AC.holdType === 'temporary') {
        AC.setpoint = AC.holdTemp;
    } else if (AC.holdType === 'permanent') {
        AC.holdUntil = null;
        if (AC.holdTemp !== 0) {
            AC.setpoint = AC.holdTemp;
        }        
    }
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    if (['permanent', 'temporary'].includes(UI.holdType)) {
        AC.holdTemp = UI.setpoint;
    }
    pauseUpdatesUntilSave = false;
    unsavedSettings = false;
    unsavedSchedule = false;
    unsavedChangesWarning();
    Promise.resolve(saveState)
        .then(() => Promise.resolve(updateHoldType()))
        .then(() => {
            adjustedSetpoint = hys(AC.setpoint, AC.mode);
            setThermostat(adjustedSetpoint, AC.mode);
        })
        .catch(error => {console.error('Error applying changes:', error);});
});
