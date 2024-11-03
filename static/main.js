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
                    document.getElementById('current-temp').textContent = `Current Temp: ` + AC.currentTemp;
                    $('#latest-reading').html(`<pre>${JSON.stringify(AC.latestReading, null, 2)}</pre>`);
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
async function runTasksOnMinute() {
    try {
        await updateStatus();
        await new Promise(resolve => setTimeout(() => {
            saveAppData();
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
        } else if ((AC.holdType === 'permanent' || AC.holdType === 'temporary') && AC.holdTemp !== 0) {        
            AC.setpoint = AC.holdTemp;
        }
        const currentTime = getCurrentTime();
        if (AC.holdType === 'temporary' && AC.holdUntil && currentTime >= AC.holdUntil) {
            AC.holdType = 'schedule'
            UI.holdType = 'schedule'
            $('input[name="hold"][value="schedule"]').prop('checked', true);
            switchToSchedule();
        }
    }
    function switchToSchedule() {
        $('#setpoint').prop('readonly', true);
        $('#temp-hold-options').hide();
        const uiSched = getUIScheduleInfo();
        UI.setpoint = uiSched.scheduledTemp;
        $('#setpoint').val(UI.setpoint);
        const acSched = getACScheduleInfo();
        AC.setpoint = acSched.scheduledTemp;
    }
    function handleInputChange(property, parseAsInt = false) {
        return function() {
            UI[property] = parseAsInt ? parseInt($(this).val(), 10) : $(this).val();
            if (property === 'holdType') updateHoldType();
            checkForChanges();
        };
    }
    $('input[name="hold"]').change(handleInputChange('holdType'));
    $('#hold-until').change(handleInputChange('holdUntil'));
    $('input[name="mode"]').change(handleInputChange('mode'));
    $('#setpoint').change(handleInputChange('setpoint', true));
    $('#passive-hys').change(handleInputChange('passiveHys', true));
    $('#active-hys').change(handleInputChange('activeHys', true));    
    $('#apply').click(function() {
        Object.assign(AC, {...UI, holdTemp: ['permanent', 'temporary'].includes(UI.holdType) ? UI.setpoint : AC.holdTemp});
        Promise.resolve(saveAppData())
            .then(() => Promise.resolve(updateHoldType()))
            .then(() => {
                hys(AC.setpoint, AC.mode);
                hasUnsavedChanges = false;
                updateWarning();
            })
            .catch(error => {
                console.error('Error in apply process:', error);
            });
    });
    