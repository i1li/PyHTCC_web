if (noUI) {
    manageState('load');
    updateStatus()
    .then(() => {
        scheduleStartOfMinute();
        });
} else {
    $(document).ready(function() {
        manageState('load');
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
            manageState('save');
            resolve();
        }, 1000));
        await new Promise(resolve => setTimeout(() => {
            updateHoldType();
            resolve();
        }, 1000));
        await new Promise(resolve => setTimeout(() => {
            hys(AC.setpoint, AC.mode);
            setThermostat(V.setpointToUse, AC.mode);
            resolve();
        }, 1000));
    } catch (error) {
        console.error('Error in runTasksOnMinute:', error);
    }
}
function updateHoldType() {
    const currentTime = getCurrentTime();
    const hourLater = getOneHourLaterTime();
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
        populated = false;
    } else if (UI.holdType === 'temporary') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-options').show();
        const sched = getUIScheduleInfo();
        UI.setpoint = holdTemp;
        $('#setpoint').val(UI.setpoint);
        if (!populated) {
            if (!externalUpdate) {
                populateTimeslotNavigation(sched.nextTimeslot);
                populated = true;
            } else {
                populateTimeslotNavigation({ time: hourLater });
                populated = true;
            }
        }
    } else {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-options').hide();
        UI.holdUntil = null;
        populated = false;
    }
    if (AC.holdType === 'schedule') {
        const sched = getScheduleInfo();
        AC.setpoint = sched.scheduledTemp;        
    } else if ((AC.holdType === 'permanent' || AC.holdType === 'temporary') && holdTemp !== 0) {        
        AC.setpoint = holdTemp;
    }
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    if (['permanent', 'temporary'].includes(UI.holdType)) {
        holdTemp = UI.setpoint;
    }
    pauseUpdatesUntilSave = false;
    unsavedSettings = false;
    unsavedSchedule = false;
    unsavedChangesWarning();
    Promise.resolve(manageState('save'))
        .then(() => Promise.resolve(updateHoldType()))
        .then(() => {
            hys(AC.setpoint, AC.mode);
            setThermostat(V.setpointToUse, AC.mode);
        })
        .catch(error => {
            console.error('Error in apply process:', error);
        });
});
