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
            const updatePromise = fetch('/get_status')
            .then(response => response.json())
            .then(reading => Object.assign(thermostat, reading));     
            Promise.race([updatePromise, timeoutPromise])
                .then(() => {
                    clearTimeout(timeoutId);
                    document.getElementById('current-temp').textContent = `Current Temp: ` + thermostat.temp;
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
        if (pause) return;
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
            switchToSchedule();
        }
    }
    function switchToSchedule() {
        $('#setpoint').prop('readonly', true);
        $('#temp-hold-options').hide();
        const uiSched = getUIScheduleInfo();
        UI.setpoint = uiSched.scheduledTemp;
        $('#setpoint').val(UI.setpoint);
        const acSched = getScheduleInfo();
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
        Object.assign(AC, UI);
        if (['permanent', 'temporary'].includes(UI.holdType)) {
            holdTemp = UI.setpoint;
        }
        pause = false;
        unsavedSettings = false;
        unsavedSchedule = false;
        updateWarning();
        Promise.resolve(saveAppData())
            .then(() => Promise.resolve(updateHoldType()))
            .then(() => {
                hys(AC.setpoint, AC.mode);
            })
            .catch(error => {
                console.error('Error in apply process:', error);
            });
    });
    