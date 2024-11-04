if (noUI) {
    manageState('load');
    updateStatus()
    .then(() => {
        scheduleMinuteStart();
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
        if (pause) return;
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
            resolve();
        }, 1000));
    } catch (error) {
        console.error('Error in runTasksOnMinute:', error);
    }
}
function updateHoldType() {
    const currentTime = getCurrentTime();
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
            if (!populated) {
                const sched = getUIScheduleInfo();
                populateTimeslotNavigation(sched.nextTimeslot);
                populated = true;
                $('#setpoint').prop('readonly', false);
                $('#temp-hold-options').show();
                UI.holdUntil = $('#hold-until').val();
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
        if (AC.holdType === 'temporary' && AC.holdUntil && currentTime >= AC.holdUntil) {
            AC.holdType = 'schedule'
            UI.holdType = 'schedule'
            $('input[name="hold"][value="schedule"]').prop('checked', true);
            handleExpiredHold();
    }
}
function handleExpiredHold() {
    $('#setpoint').prop('readonly', true);
    $('#temp-hold-options').hide();
    const uiSched = getUIScheduleInfo();
    UI.setpoint = uiSched.scheduledTemp;
    $('#setpoint').val(UI.setpoint);
    const acSched = getScheduleInfo();
    AC.setpoint = acSched.scheduledTemp;
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    if (['permanent', 'temporary'].includes(UI.holdType)) {
        holdTemp = UI.setpoint;
    }
    pause = false;
    unsavedSettings = false;
    unsavedSchedule = false;
    updateWarning();
    Promise.resolve(manageState('save'))
        .then(() => Promise.resolve(updateHoldType()))
        .then(() => {
            hys(AC.setpoint, AC.mode);
        })
        .catch(error => {
            console.error('Error in apply process:', error);
        });
});
