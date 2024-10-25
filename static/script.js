let appData = JSON.parse(localStorage.getItem('appData')) || {
    schedules: {},
    currentScheduleName: '',
    currentSchedule: {},
    holdType: 'permanent',
    holdUntilTime: null,
    setpoint: null, 
    scheduledTemp: null, 
    cycleRange: null,
    mode: 'cool',
    latestReading: null,
    running: false,
    resting: false,
    restingSince: null,
    runningSince: null,
    runningAtSetpointSince: null,
};
function saveAppData() {
    localStorage.setItem('appData', JSON.stringify(appData));
}
const runningAtSetpointMinTime = 600000;
$(document).ready(function() {
    function initializeUI() {
        $(`input[name="mode"][value="${appData.mode}"]`).prop('checked', true);
        $(`input[name="hold"][value="${appData.holdType}"]`).prop('checked', true);
        $('#setpoint').val(appData.setpoint);
        $('#cycle_range').val(appData.cycleRange);
        loadScheduleList();
        if (appData.currentScheduleName) {
            $('#load_schedule').val(appData.currentScheduleName);
            loadSchedule(appData.currentScheduleName);
        }
        updateHoldType();
    }
    initializeUI();
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
                    appData.schedules = importedSchedules;
                    saveAppData();
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
        const blob = new Blob([JSON.stringify(appData.schedules)], { type: 'application/json' });
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
        Object.keys(appData.schedules).forEach(name => {
            $loadSelect.append($('<option>', { value: name, text: name }));
        });
        if (appData.currentScheduleName) {
            $loadSelect.val(appData.currentScheduleName);
        }
    }
    function loadSchedule(scheduleName) {
        const schedule = appData.schedules[scheduleName];
        if (schedule) {
            appData.currentSchedule = JSON.parse(JSON.stringify(schedule)); 
            appData.currentScheduleName = scheduleName;
            saveAppData();  
            $('#schedule').empty();
            if (Array.isArray(schedule.timeslots)) {
                schedule.timeslots.forEach(timeslot => addTimeslot(timeslot));
            } else {
                console.error('Invalid schedule format');
            }
            $('#load_schedule').val(scheduleName);
            updateHoldType();
            saveAppData();  
        }
    }
    $('#load_schedule').change(function() {
        const selectedSchedule = $(this).val();
        if (selectedSchedule) {
            loadSchedule(selectedSchedule);
            saveAppData();  
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
        if (appData.currentScheduleName) {
            appData.schedules[appData.currentScheduleName] = { timeslots: schedule };
        }
        appData.currentSchedule = { timeslots: schedule };
        updateHoldType();
        saveAppData();
    }
    $('#save_schedule').click(function() {
        const name = prompt("Enter a name for this schedule:", appData.currentScheduleName);
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
            appData.schedules[name] = { timeslots: schedule };
            appData.currentScheduleName = name;
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
        updateHoldType();
    }
    $('#add_timeslot').click(function() {
        addTimeslot();
    });
    $(document).on('click', '.remove-timeslot', function() {
        $(this).closest('.schedule-timeslot').remove();
        updateHoldType();
    });
    $('#clear_schedule').click(function() {
        $('#schedule').empty();
        updateHoldType();
    });
$('#apply').click(function() {
    updateHoldType(); 
    appData.cycleRange = $('#cycle_range').val();
    appData.mode = $('input[name="mode"]:checked').val();
    if (appData.holdType === 'schedule') {
        appData.setpoint = getScheduledTemp();
    } else {
        appData.setpoint = parseFloat($('#setpoint').val());
        if (appData.holdType === 'temporary') {
            appData.holdUntilTime = $('#hold_until_time').val();
        }
    }
    $('#setpoint').val(appData.setpoint);
    runCycleRange(appData.setpoint, appData.mode);
    saveAppData();
});
setInterval(function() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    if (appData.holdType === 'temporary' && appData.holdUntilTime && currentTime >= appData.holdUntilTime) {
        appData.holdType = 'schedule'; 
        $('input[name="hold"][value="schedule"]').prop('checked', true);
        updateHoldType(); 
        appData.setpoint = getScheduledTemp(); 
        $('#setpoint').val(appData.setpoint);
        runCycleRange(appData.setpoint, appData.mode);
    } else if (appData.holdType === 'schedule') {
        const newScheduledTemp = getScheduledTemp();
        if (newScheduledTemp !== appData.scheduledTemp) {
            appData.scheduledTemp = newScheduledTemp;
            appData.setpoint = appData.scheduledTemp;
            $('#setpoint').val(appData.setpoint);
            runCycleRange(appData.setpoint, appData.mode);
        }
    }
    updateStatus();
    saveAppData();
    runCycleRange(appData.setpoint, appData.mode);
}, 60000);
    loadScheduleList();
    updateHoldType();
    updateStatus();
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
    if (!appData.currentSchedule || !appData.currentSchedule.timeslots) {
        console.error('No current schedule or timeslots');
        return appData.setpoint; 
    }
    const schedule = appData.currentSchedule.timeslots;
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const sortedSchedule = schedule.sort((a, b) => a.time.localeCompare(b.time));
    for (let i = sortedSchedule.length - 1; i >= 0; i--) {
        if (sortedSchedule[i].time <= currentTime) {
            if (appData.mode === 'cool' && sortedSchedule[i].coolTemp) {
                appData.scheduledTemp = parseFloat(sortedSchedule[i].coolTemp);
                return appData.scheduledTemp;
            } else if (appData.mode === 'heat' && sortedSchedule[i].heatTemp) {
                appData.scheduledTemp = parseFloat(sortedSchedule[i].heatTemp);
                return appData.scheduledTemp;
            }
        }
    }
    if (sortedSchedule.length > 0) {
        const lastTimeslot = sortedSchedule[sortedSchedule.length - 1];
        if (appData.mode === 'cool' && lastTimeslot.coolTemp) {
            appData.scheduledTemp = parseFloat(lastTimeslot.coolTemp);
        } else if (appData.mode === 'heat' && lastTimeslot.heatTemp) {
            appData.scheduledTemp = parseFloat(lastTimeslot.heatTemp);
        } else {
            appData.scheduledTemp = parseFloat($('#setpoint').val());
        }
    } else {
        appData.scheduledTemp = parseFloat($('#setpoint').val());
    }
    return appData.scheduledTemp;
}
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}
function getOneHourLaterTime() {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
    return oneHourLater.getHours().toString().padStart(2, '0') + ':' + oneHourLater.getMinutes().toString().padStart(2, '0');
}
function updateHoldType() {
    appData.holdType = $('input[name="hold"]:checked').val();
    const hasSchedule = $('.schedule-timeslot').length > 0;
    $('#follow_schedule').prop('disabled', !hasSchedule);
    if (!hasSchedule) {
        if (appData.holdType === 'schedule') {
            $('input[name="hold"][value="permanent"]').prop('checked', true);
            appData.holdType = 'permanent';
        }
    }
        if (appData.holdType === 'schedule') {
            $('#setpoint').prop('readonly', true);
            appData.scheduledTemp = getScheduledTemp();
            appData.setpoint = appData.scheduledTemp; 
            $('#setpoint').val(appData.setpoint);
            $('#temp_hold_options').hide();
        } else if (appData.holdType === 'temporary') {
            $('#setpoint').prop('readonly', false);
            $('#temp_hold_options').show();
            if (!appData.holdUntilTime) {
                setNextScheduledTime();
                appData.holdUntilTime = $('#hold_until_time').val();
            }
        } else { 
            $('#setpoint').prop('readonly', false);
            $('#temp_hold_options').hide();
        }
        saveAppData();
    }
$('input[name="hold"]').change(function() {
    updateHoldType();
});
function updateHoldUntilFields(timeslot) {
    $('#hold_until_time').val(timeslot.time);
    $('#hold_until_heat_temp').val(timeslot.heatTemp || $('#setpoint').val());
    $('#hold_until_cool_temp').val(timeslot.coolTemp || $('#setpoint').val());
    appData.holdUntilTime = timeslot.time;
}
function updateHoldUntilTime(direction) {
    const timeslots = getScheduleTimeslots();
    const newTimeslot = findNextTimeslot(appData.holdUntilTime, timeslots, direction);
    if (newTimeslot) {
        updateHoldUntilFields(newTimeslot);
    } else {
        updateHoldUntilFields({ time: getOneHourLaterTime() });
    }
    $('input[name="hold"][value="temporary"]').prop('checked', true);
    updateHoldType();
}
$('#next_timeslot, #prev_timeslot').click(function() {
    const direction = $(this).attr('id') === 'next_timeslot' ? 'next' : 'prev';
    updateHoldUntilTime(direction);
});
function findNextTimeslot(currentTime, timeslots, direction) {
    if (direction === 'prev') {
        timeslots = timeslots.slice().reverse();
    }
    return timeslots.find(timeslot => 
        direction === 'next' ? timeslot.time > currentTime : timeslot.time < currentTime
    ) || timeslots[0];
}
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
    if (nextTimeslot) {
        updateHoldUntilFields(nextTimeslot);
    } else {
        updateHoldUntilFields({ time: getOneHourLaterTime() });
    }
    saveAppData();
}
function runCycleRange(setpoint, mode) {
    if (!appData.latestReading) return;
    const currentTemp = appData.latestReading.current_temp;
    const running = appData.latestReading.running;
    const cycleRange = parseFloat(appData.cycleRange);
    const restTemp = mode === 'cool' ? setpoint + cycleRange : setpoint - cycleRange;
    let newState = {
        mode: mode,
        setpoint: setpoint,
        resting: appData.resting
    };
    if (currentTemp !== null) {
        if (mode === 'cool') {
            newState = runCool(currentTemp, running, setpoint, restTemp, newState);
        } else if (mode === 'heat') {
            newState = runHeat(currentTemp, running, setpoint, restTemp, newState);
        }
    }
    cycleStateManagement(newState.mode, newState.setpoint, newState.resting);
}
function runCool(currentTemp, running, setpoint, restTemp, state) {
    if (!state.resting) {
        if (running && currentTemp <= setpoint) {
            if (appData.runningAtSetpointSince === null) {
                appData.runningAtSetpointSince = Date.now();
            }
            if (Date.now() - appData.runningAtSetpointSince >= runningAtSetpointMinTime) {
                return { ...state, setpoint: restTemp, resting: true };
            }
        } else {
            appData.runningAtSetpointSince = null;
            if (currentTemp >= restTemp) {
                return { ...state, setpoint: setpoint, resting: false };
            }
        }
    } else {
        if (currentTemp >= restTemp) {
            return { ...state, setpoint: setpoint, resting: false };
        }
    }
    return state;
}
function runHeat(currentTemp, running, setpoint, restTemp, state) {
    if (!state.resting) {
        if (running && currentTemp >= setpoint) {
            if (appData.runningAtSetpointSince === null) {
                appData.runningAtSetpointSince = Date.now();
            }
            if (Date.now() - appData.runningAtSetpointSince >= runningAtSetpointMinTime) {
                return { ...state, setpoint: restTemp, resting: true };
            }
        } else {
            appData.runningAtSetpointSince = null;
            if (currentTemp <= restTemp) {
                return { ...state, setpoint: setpoint, resting: false };
            }
        }
    } else {
        if (currentTemp <= restTemp) {
            return { ...state, setpoint: setpoint, resting: false };
        }
    }
    return state;
}
function cycleStateManagement(mode, setpoint, isResting) {
    appData.mode = mode;
    appData.setpoint = setpoint;
    appData.resting = isResting;
    appData.restingSince = isResting ? Date.now() : null;
    appData.runningSince = isResting ? null : Date.now();
    appData.runningAtSetpointSince = null;
    saveAppData();
    setThermostat(setpoint, mode);
}
function setThermostat(setpoint, mode) {
    $.post('/set_update', { mode: mode, setpoint: setpoint });
}
function updateStatus() {
    $.get('/get_status', function(data) {
        appData.latestReading = data;
        appData.running = data.running;
        appData.current_temp = data.current_temp;
        if (appData.holdType === 'schedule') {
            appData.scheduledTemp = getScheduledTemp();
            $('#setpoint').val(appData.scheduledTemp);
            appData.setpoint = appData.scheduledTemp;
        }
        $('#status').html(`<pre>${JSON.stringify(appData, null, 2)}</pre>`);
    });
}
