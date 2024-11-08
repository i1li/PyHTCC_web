if (noUI) {
    loadState();
    updateStatus()
    .then(() => { scheduleStartOfMinute(); });
} else {
    $(document).ready(function() {
        loadState();
        updateStatus()
        .then(() => { initializeUI(); });
    });
}
async function runTasksOnMinute() {
    try {
        await updateStatus();
        if (pauseUpdatesUntilSave) return;
        await Promise.resolve(updateHoldType());
        await Promise.resolve(saveState());
        await Promise.resolve(hys(AC.setpoint, AC.mode));
        await Promise.resolve(setThermostat(V.adjustedSetpoint, AC.mode));
    } catch (error) { console.error('Error in runTasksOnMinute:', error); }
}
function updateHoldType() {
    const timeNow = getTimeNow();
    const hourLater = getHourLater();
    const hasSchedule = $('.schedule-timeslot').length > 0;
    if (!hasSchedule) {
        $('#follow-schedule').prop('disabled');
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
        UI.setpoint = AC.holdTemp !== 0 ? AC.holdTemp : $('#setpoint').val();
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
        populated = false;
    }
    if (AC.holdType === 'schedule') {
        const sched = getScheduleInfo();
        AC.setpoint = sched.scheduledTemp;
        AC.holdUntil = sched.nextTimeslot.time;
    } else if (AC.holdType === 'temporary') {
        AC.setpoint = AC.holdTemp;
    } else if (AC.holdType === 'permanent') {
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
    .then(() => { return hys(AC.setpoint, AC.mode); })
    .then(() => { setThermostat(V.adjustedSetpoint, AC.mode); })
    .catch(error => { console.error('Error applying changes:', error); });
});
