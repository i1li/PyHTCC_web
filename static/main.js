$(document).ready(function() {
    updateStatus()
    .then(() => {
        initializeUI();
    });
});
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
            const updatePromise = new Promise((resolve) => {
                $.get('/get_status', function(data) {
                    AC.latestReading = data;
                    AC.running = data.running;
                    AC.currentTemp = data.current_temp;
                    AC.currentSetpoint = data.setpoint;
                    AC.currentMode = data.mode;
                    resolve();
                });
            });
            Promise.race([updatePromise, timeoutPromise])
                .then(() => {
                    clearTimeout(timeoutId);
                    $('#status').html(`<pre>${JSON.stringify(AC, null, 2)}</pre>`);
                    $('#latest-reading').html(`<pre>${JSON.stringify(AC.latestReading, null, 2)}</pre>`);
                    const currentTime = getCurrentTime();
                    if (AC.holdType === 'temporary' && AC.holdUntil && currentTime >= AC.holdUntil) {
                        AC.holdType = 'schedule'
                        UI.holdType = 'schedule'
                        $('input[name="hold"][value="schedule"]').prop('checked', true);
                        updateHoldType();
                    } else if (AC.holdType === 'schedule') {
                        updateHoldType();
                    }
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        }, timeToWait);
    });
}
function runTasksOnMinute() {
    updateStatus()
    .then(() => {
        return new Promise((resolve) => {
            setTimeout(() => {
                saveAppData();
                resolve();
            }, 1000);
        });
    })
    .then(() => {
        return new Promise((resolve) => {
            setTimeout(() => {
                hysteresis(AC.setpoint, AC.mode);
                resolve();
            }, 1000);
        });
    });
}
function updateHoldType() {
    UI.holdType = $('input[name="hold"]:checked').val();
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
        } else if (UI.holdType === 'temporary') {
            const sched = getUIScheduleInfo();
            populateTimeslotNavigation(sched.nextTimeslot);
            $('#setpoint').prop('readonly', false);
            $('#temp-hold-options').show();
            UI.holdUntil = $('#hold-until').val();
        } else { 
            $('#setpoint').prop('readonly', false);
            $('#temp-hold-options').hide();
        }
        if (AC.holdType === 'schedule') {
            const sched = getACScheduleInfo();
            AC.setpoint = sched.scheduledTemp;        
        } else if ((AC.holdType === 'permanent' || AC.holdType === 'temporary') && holdTemp !== 0) {        
            AC.setpoint = holdTemp;
        }
    }
$('input[name="hold"]').change(function() {
    UI.holdType = $(this).val();
    updateHoldType();
    checkForChanges();
});
$('input[name="mode"]').on('change', function() {
    UI.mode = $(this).val();
    checkForChanges();
});
$('#setpoint').on('change', function() {
    UI.setpoint = parseInt($(this).val(), 10);
    checkForChanges();
});
$('#passive-hysteresis').on('change', function() {
    UI.passiveHysteresis = parseInt($(this).val(), 10);
    checkForChanges();
});
$('#active-hysteresis').on('change', function() {
    UI.activeHysteresis = parseInt($(this).val(), 10);
    checkForChanges();
});
$('#apply').click(function() {
    AC.holdType = UI.holdType;
    AC.holdUntil = UI.holdUntil;
    AC.passiveHysteresis = UI.passiveHysteresis;
    AC.activeHysteresis = UI.activeHysteresis;
    AC.mode = UI.mode;
    AC.setpoint = UI.setpoint;
    if (UI.holdType === 'permanent' || UI.holdType === 'temporary') {
        holdTemp = UI.setpoint;
    }
    saveAppData()
    .then(() => {
        updateHoldType();
        hysteresis(UI.setpoint, UI.mode);
        hasUnsavedChanges = false;
        updateWarning();
    });
});
