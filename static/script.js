let appData = AC = JSON.parse(localStorage.getItem('appData')) || {
    schedules: {},
    currentTemp: 0,
    currentMode: null,
    currentScheduleName: '',
    currentSchedule: {},
    holdType: 'permanent',
    holdUntilTime: null,
    setpoint: 0, 
    currentSetpoint: 0,
    scheduledTemp: 0, 
    cycleRange: 0,
    mode: 'cool',
    latestReading: null,
    running: false,
    readyToRest: false,
    resting: false,
    restingSince: null,
    runningSince: null,
    runningAtSetpointDuration: 0,
    runningAtSetpointSince: null,
    atSetpointMinTime: 100000,
    setpointToUse: 0,
    rawSetpoint: 0,
    restSetpoint: 0,
    runningAtSetpointSince: 0,
    restingAtSetpointDuration: 0,
};
function saveAppData() {
    localStorage.setItem('appData', JSON.stringify(AC));
}
$(document).ready(function() {
    initializeUI();
    loadScheduleList();
    updateHoldType();
    updateStatus();
setInterval(function() {
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
                runCycleRange(AC.setpoint, AC.mode);
                resolve();
            }, 1000);
        });
    })
    .catch(error => console.log('Error in update chain:', error.message));
}, 60000);
    function initializeUI() {
        $(`input[name="mode"][value="${AC.mode}"]`).prop('checked', true);
        $(`input[name="hold"][value="${AC.holdType}"]`).prop('checked', true);
        $('#setpoint').val(AC.setpoint);
        $('#cycle_range').val(AC.cycleRange);
        loadScheduleList();
        if (AC.currentScheduleName) {
            $('#load_schedule').val(AC.currentScheduleName);
            loadSchedule(AC.currentScheduleName);
        }
    }
    $('#importSchedules').click(function() {
        $('#importFile').click();
    });
    $('#importFile').change(function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedSchedules = JSON.parse(e.target.result);
                    AC.schedules = importedSchedules;
                    alert('Schedules have been imported successfully.');
                    loadScheduleList();
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    alert('Failed to import schedules. Please ensure the file is a valid JSON.');
                }
            };
            reader.readAsText(file);
        }
    });
    $('#exportSchedules').click(function() {
        const blob = new Blob([JSON.stringify(AC.schedules)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'thermostat-schedules.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    function loadScheduleList() {
        const $loadSelect = $('#load_schedule');
        $loadSelect.find('option:not(:first)').remove();
        Object.keys(AC.schedules).forEach(name => {
            $loadSelect.append($('<option>', { value: name, text: name }));
        });
        if (AC.currentScheduleName) {
            $loadSelect.val(AC.currentScheduleName);
        }
    }
    function loadSchedule(scheduleName) {
        const schedule = AC.schedules[scheduleName];
        if (schedule) {
            AC.currentSchedule = JSON.parse(JSON.stringify(schedule)); 
            AC.currentScheduleName = scheduleName;
            $('#schedule').empty();
            if (Array.isArray(schedule.timeslots)) {
                schedule.timeslots.forEach(timeslot => addTimeslot(timeslot));
            } else {
                console.error('Invalid schedule format');
            }
            $('#load_schedule').val(scheduleName);
        }
    }
    $('#load_schedule').change(function() {
        const selectedSchedule = $(this).val();
        if (selectedSchedule) {
            loadSchedule(selectedSchedule);
        }
    });
    function saveSchedule() {
        const schedule = [];
        $('.schedule-timeslot').each(function() {
            const time = $(this).find('input[type="time"]').val();
            const heatTemp = $(this).find('input[placeholder="Heat Temp"]').val();
            const coolTemp = $(this).find('input[placeholder="Cool Temp"]').val();
            if (time && (heatTemp || coolTemp)) {
                schedule.push({ time, heatTemp, coolTemp });
            }
        });
        if (AC.currentScheduleName) {
            AC.schedules[AC.currentScheduleName] = { timeslots: schedule };
        }
        AC.currentSchedule = { timeslots: schedule };
    }
    $('#save_schedule').click(function() {
        const name = prompt("Enter a name for this schedule:", AC.currentScheduleName);
        if (name) {
            const schedule = [];
            $('.schedule-timeslot').each(function() {
                const time = $(this).find('input[type="time"]').val();
                const heatTemp = $(this).find('input[placeholder="Heat Temp"]').val();
                const coolTemp = $(this).find('input[placeholder="Cool Temp"]').val();
                if (time && (heatTemp || coolTemp)) {
                    schedule.push({ time, heatTemp, coolTemp });
                }
            });
            AC.schedules[name] = { timeslots: schedule };
            AC.currentScheduleName = name;
            loadScheduleList();
            saveSchedule();
        }
    });
    function addTimeslot(timeslot = {}) {
        const newTimeslot = `
        <div class="schedule-timeslot">
            <input type="time" value="${timeslot.time || ''}">
            <button class="remove-timeslot">Remove Timeslot</button><br>
            <label for="heat_temp">Heat Temp:</label>
            <input type="number" placeholder="Heat Temp" value="${timeslot.heatTemp || ''}">
            <label for="cool_temp">Cool Temp:</label>
            <input type="number" placeholder="Cool Temp" value="${timeslot.coolTemp || ''}">
        </div>`;
        $('#schedule').append(newTimeslot);
    }
    $('#add_timeslot').click(function() {
        addTimeslot();
    });
    $(document).on('click', '.remove-timeslot', function() {
        $(this).closest('.schedule-timeslot').remove();
    });
    $('#clear_schedule').click(function() {
        $('#schedule').empty();
        updateHoldType();
    });
$('#apply').click(function() {
    updateHoldType();
    AC.cycleRange = parseInt($('#cycle_range').val(), 10);
    AC.mode = $('input[name="mode"]:checked').val();
    if (AC.holdType === 'schedule') {
        AC.setpoint = getScheduledTemp();
    } else {
        AC.setpoint = parseInt($('#setpoint').val(), 10);
        if (AC.holdType === 'temporary') {
            AC.holdUntilTime = $('#hold_until_time').val();
        }
    }
    $('#setpoint').val(AC.setpoint);
    saveAppData();
});
});
function getScheduleTimeslots() {
    const timeslots = [];
    $('.schedule-timeslot').each(function() {
        const time = $(this).find('input[type="time"]').val();
        const heatTemp = $(this).find('input[placeholder="Heat Temp"]').val();
        const coolTemp = $(this).find('input[placeholder="Cool Temp"]').val();
        if (time && (heatTemp || coolTemp)) {
            timeslots.push({ time, heatTemp, coolTemp });
        }
    });
    return timeslots.sort((a, b) => a.time.localeCompare(b.time));
}
function getScheduledTemp() {
    $('#setpoint').val(AC.setpoint);
    if (!AC.currentSchedule || !AC.currentSchedule.timeslots) {
        console.error('No current schedule or timeslots');
        return AC.setpoint; 
    }
    const schedule = AC.currentSchedule.timeslots;
    const currentTime = getCurrentTime();
    const sortedSchedule = schedule.sort((a, b) => a.time.localeCompare(b.time));
    for (let i = sortedSchedule.length - 1; i >= 0; i--) {
        if (sortedSchedule[i].time <= currentTime) {
            if (AC.mode === 'cool' && sortedSchedule[i].coolTemp) {
                AC.scheduledTemp = Number(sortedSchedule[i].coolTemp);
                return AC.scheduledTemp;
            } else if (AC.mode === 'heat' && sortedSchedule[i].heatTemp) {
                AC.scheduledTemp = Number(sortedSchedule[i].heatTemp);
                return AC.scheduledTemp;
            }
        }
    }
    if (sortedSchedule.length > 0) {
        const lastTimeslot = sortedSchedule[sortedSchedule.length - 1];
        if (AC.mode === 'cool' && lastTimeslot.coolTemp) {
            AC.scheduledTemp = Number(lastTimeslot.coolTemp);
        } else if (AC.mode === 'heat' && lastTimeslot.heatTemp) {
            AC.scheduledTemp = Number(lastTimeslot.heatTemp);
        } else {
            AC.scheduledTemp = $('#setpoint').val();
        }
    } else {
        AC.scheduledTemp = $('#setpoint').val();
    }
    return AC.scheduledTemp;
}
function updateHoldType() {
    AC.holdType = $('input[name="hold"]:checked').val();
    const hasSchedule = $('.schedule-timeslot').length > 0;
    $('#follow_schedule').prop('disabled', !hasSchedule);
    if (!hasSchedule) {
        if (AC.holdType === 'schedule') {
            $('input[name="hold"][value="permanent"]').prop('checked', true);
            AC.holdType = 'permanent';
        }
    }
        if (AC.holdType === 'schedule') {
            $('#setpoint').prop('readonly', true);
            AC.setpoint = getScheduledTemp();
            $('#setpoint').val(AC.setpoint);
            $('#temp_hold_options').hide();
        } else if (AC.holdType === 'temporary') {
            setNextScheduledTime();
            $('#setpoint').prop('readonly', false);
            $('#temp_hold_options').show();
            AC.holdUntilTime = $('#hold_until_time').val();
        } else { 
            $('#setpoint').prop('readonly', false);
            $('#temp_hold_options').hide();
        }
    }
$('input[name="hold"]').change(function() {
    updateHoldType();
});
$('input[id="hold_until_time"]').change(function() {
    AC.holdUntilTime = $('#hold_until_time').val();
});
function findNextTimeslot(currentTime, timeslots, direction) {
    if (direction === 'prev') {
        timeslots = timeslots.slice().reverse();
    }
    return timeslots.find(timeslot => 
        direction === 'next' ? timeslot.time > currentTime : timeslot.time < currentTime
    ) || timeslots[0];
}
function recentTimeslots(direction) {
    const timeslots = getScheduleTimeslots();
    const newTimeslot = findNextTimeslot(AC.holdUntilTime, timeslots, direction);
    if (newTimeslot) {
        recentTimeslotFields(newTimeslot);
    } else {
        recentTimeslotFields({ time: getOneHourLaterTime() });
    }
}
function recentTimeslotFields(timeslot) {
    $('#hold_until_time').val(timeslot.time);
    $('#hold_until_heat_temp').val(timeslot.heatTemp || $('#setpoint').val());
    $('#hold_until_cool_temp').val(timeslot.coolTemp || $('#setpoint').val());
    AC.holdUntilTime = timeslot.time;
}
$('#next_timeslot, #prev_timeslot').click(function() {
    const direction = $(this).attr('id') === 'next_timeslot' ? 'next' : 'prev';
    recentTimeslots(direction);
});
function setNextScheduledTime() {
    const currentTime = getCurrentTime();
    let nextTimeslot = null;
    $('.schedule-timeslot').each(function() {
        const timeslotTime = $(this).find('input[type="time"]').val();
        if (timeslotTime > currentTime && (!nextTimeslot || timeslotTime < nextTimeslot.time)) {
            nextTimeslot = {
                time: timeslotTime,
                heatTemp: $(this).find('input[placeholder="Heat Temp"]').val(),
                coolTemp: $(this).find('input[placeholder="Cool Temp"]').val()
            };
        }
    });
}
function runCycleRange(rawSetpoint, mode) {
    if (!AC.latestReading) return;
    AC.rawSetpoint = rawSetpoint;
    const now = Date.now();
    const isCooling = mode === 'cool';
    AC.restSetpoint = isCooling ? AC.rawSetpoint + AC.cycleRange : AC.rawSetpoint - AC.cycleRange;
    const isAtRawSetpoint = AC.currentTemp === AC.rawSetpoint;
    window.isAtRawSetpoint = isAtRawSetpoint;
    const isAtRestSetpoint = AC.currentTemp === AC.restSetpoint;
    const isInRestRange = isCooling ?
    () => AC.currentTemp >= AC.rawSetpoint :
    () => AC.currentTemp <= AC.rawSetpoint;
    window.isInRestRange = isInRestRange;
    AC.restingDuration = AC.restingSince ? now - AC.restingSince : 0;
    AC.restingAtSetpointDuration = AC.restingAtSetpointSince ? now - AC.restingAtSetpointSince : 0;
    AC.runningDuration = AC.runningSince ? now - AC.runningSince : 0;
    AC.runningAtSetpointDuration = AC.runningAtSetpointSince ? now - AC.runningAtSetpointSince : 0;
    if (AC.running) {
        AC.resting = false;
        AC.restingSince = null;
        AC.restingAtSetpointSince = null;
        if (!AC.runningSince) {
            AC.runningSince = now;
            console.log(`Started running at: ${new Date(AC.runningSince).toISOString()}`);
        }
        if (isAtRawSetpoint) {
            if (!AC.runningAtSetpointSince) {
                AC.runningAtSetpointSince = now;
                console.log(`Started running at setpoint: ${new Date(AC.runningAtSetpointSince).toISOString()}`);
            }
            if (AC.runningAtSetpointDuration >= AC.atSetpointMinTime) {
                AC.readyToRest = true;
                console.log(`Ready to enter rest at: ${new Date(AC.restingSince).toISOString()}`);
            }
        } else {
            AC.readyToRest = false;
            AC.runningAtSetpointSince = null;
        }
    } else { //running=false
        AC.runningSince = null;
        AC.runningAtSetpointSince = null;
        if (isInRestRange()) {
            if (isAtRawSetpoint) {
                if (AC.readyToRest) {
                    AC.resting = true;
                    if (!AC.restingSince) {
                        AC.restingSince = now;
                        console.log(`Started resting at: ${new Date(AC.restingSince).toISOString()}`);
                    }
                    if (!AC.restingAtSetpointSince) {
                        AC.restingAtSetpointSince = now;
                        console.log(`Started resting at setpoint: ${new Date(AC.restingAtSetpointSince).toISOString()}`);
                    }
                }
            } else { // isAtRawSetpoint=false
                AC.readyToRest = false;
                AC.restingAtSetpointSince = null;
            }
        } else { // isInRestRange=false
            AC.resting = false;
            AC.restingSince = null;
            AC.restingAtSetpointSince = null;
            AC.readyToRest = false;
            console.log(`Exited resting state at: ${new Date(now).toISOString()}`);
        }
    }
    AC.setpointToUse = AC.resting ? AC.restSetpoint : AC.rawSetpoint;
    setThermostat(AC.setpointToUse, mode);
    console.log(`Set thermostat to: ${AC.setpointToUse}, Mode: ${mode}`);
}
function setThermostat(setpoint, mode) {
    if (mode !== AC.currentMode || AC.setpointToUse !== AC.currentSetpoint) {
        $.post('/set_update', { mode: mode, setpoint: AC.setpointToUse });
    }
}
function updateStatus() {
    return new Promise((resolve, reject) => {
        let timeoutId;
        const timeoutPromise = new Promise((resolve, reject) => {
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
                if (AC.holdType === 'temporary' && AC.holdUntilTime && currentTime >= AC.holdUntilTime) {
                    $('input[name="hold"][value="schedule"]').prop('checked', true);
                    updateHoldType();
                } else if (AC.holdType === 'schedule' && AC.holdUntilTime && currentTime >= AC.holdUntilTime) {
                    updateHoldType();
                }
                resolve();
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                console.log('updateStatus error:', error.message);
                reject(error);
            });
    });
}
function formatTime(hours, minutes) {
    return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
}
function getCurrentTime() {
    const now = new Date();
    return formatTime(now.getHours(), now.getMinutes());
}
function getOneHourLaterTime() {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
    return formatTime(oneHourLater.getHours(), oneHourLater.getMinutes());
}
