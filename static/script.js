$(document).ready(function() {
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
                    localStorage.setItem('savedSchedules', JSON.stringify(importedSchedules));
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
        const savedSchedules = localStorage.getItem('savedSchedules');
        if (savedSchedules) {
            const blob = new Blob([savedSchedules], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'thermostat-schedules.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert('No schedules found to export.');
        }
    });
    function loadScheduleList() {
        const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
        const $loadSelect = $('#load_schedule');
        $loadSelect.find('option:not(:first)').remove();
        Object.keys(savedSchedules).forEach(name => {
            $loadSelect.append($('<option>', {
                value: name,
                text: name
            }));
        });
        if (currentScheduleName) {
            $loadSelect.val(currentScheduleName);
        }
    }
    function loadSchedule(scheduleName) {
        const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
        const schedule = savedSchedules[scheduleName];
        if (schedule) {
            localStorage.setItem('currentSchedule', JSON.stringify(schedule));
        }
        $('#schedule').empty();
        timeslotCount = 0;
        if (Array.isArray(schedule)) {
            schedule.forEach(timeslot => addTimeslot(timeslot));
        } else if (schedule && typeof schedule === 'object') {
            if (Array.isArray(schedule.timeslots)) {
                schedule.timeslots.forEach(timeslot => addTimeslot(timeslot));
            } else {
                console.error('Invalid schedule format');
            }
        } else {
            console.error('Invalid schedule format');
        }
        currentScheduleName = scheduleName;
        $('#load_schedule').val(scheduleName);
        updateHoldType();
    }    
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
        if (currentScheduleName) {
            const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
            savedSchedules[currentScheduleName] = { timeslots: schedule };
            localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules));
        }
        localStorage.setItem('currentSchedule', JSON.stringify({ timeslots: schedule }));
        updateHoldType();
    } 
    $('#submit').click(function() {
        updateHoldType();
        cycleRange = $('#cycle_range').val();
        const mode = $('input[name="mode"]:checked').val();
        let setpoint;
        updateHoldType();
        if (holdType === 'schedule') {
            setpoint = getScheduledTemp();
            $('#setpoint').val(scheduledTemp);
        } else if (holdType === 'temporary') {
            holdUntilTime = $('#hold_until_time').val();
            setpoint = $('#setpoint').val();
        } else {
            setpoint = $('#setpoint').val();
        }
        if (!setpoint) {
            setpoint = $('#setpoint').val();
        }
        setThermostat(setpoint, mode);
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
        timeslotCount++;
        updateHoldType();
    }
    $('#add_timeslot').click(function() {
        addTimeslot();
    });
    $('#clear_schedule').click(function() {
        $('#schedule').empty();
        timeslotCount = 0;
        currentScheduleName = '';
        $('#load_schedule').val('');
    });
    $('#save_schedule').click(function() {
        const name = prompt("Enter a name for this schedule:", currentScheduleName);
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
            const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
            savedSchedules[name] = {
                timeslots: schedule,
            };
            localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules));
            currentScheduleName = name;
            loadScheduleList();
            saveSchedule();
        }
    });
    $('#load_schedule').change(function() {
        const selectedSchedule = $(this).val();
        if (selectedSchedule) {
            loadSchedule(selectedSchedule);
        }
    });
    $(document).on('click', '.remove-timeslot', function() {
        $(this).closest('.schedule-timeslot').remove();
        timeslotCount--;
    });
    setInterval(function() {
        if (holdType === 'schedule') {
            const scheduledTemp = getScheduledTemp();
            $('#setpoint').val(scheduledTemp);
            setThermostat(scheduledTemp, mode);
        } else if (holdType === 'temporary') {
            const now = new Date();
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            if (currentTime === holdUntilTime) {
                holdType = 'schedule';
                $('input[name="hold"][value="schedule"]').prop('checked', true);
                updateHoldType();
            }
        }
        updateStatus();
    }, 60000);
    loadScheduleList();
    updateHoldType();
    updateStatus(); 
});
let lastUpdateTime = 0;
let latestReading = null;
let cycleRange;
let currentScheduleName = '';
let scheduledTemp;
let timeslotCount = 0;
let mode = 'cool';
let holdType = null;
let holdUntilTime = null;
let restTemp = null;
let resting = false;
let restingSince = null;
let running = false;
let runningSince = null;
let setpointSince = null; 
const minSetpointRunTime = 600000;
function setNextScheduledTime() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
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
        $('#hold_until_time').val(nextTimeslot.time);
        $('#hold_until_heat_temp').val(nextTimeslot.heatTemp);
        $('#hold_until_cool_temp').val(nextTimeslot.coolTemp);
    } else {
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        $('#hold_until_time').val(oneHourLater.getHours().toString().padStart(2, '0') + ':' + oneHourLater.getMinutes().toString().padStart(2, '0'));
        $('#hold_until_heat_temp').val($('#setpoint').val());
        $('#hold_until_cool_temp').val($('#setpoint').val());
    }
}
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
function updateHoldUntilTime(direction) {
    const timeslots = getScheduleTimeslots();
    let newTimeslot;
    if (direction === 'next') {
        newTimeslot = timeslots.find(timeslot => timeslot.time > holdUntilTime) || timeslots[0];
    } else if (direction === 'prev') {
        newTimeslot = timeslots.reverse().find(timeslot => timeslot.time < holdUntilTime) || timeslots[timeslots.length - 1];
    }
    if (newTimeslot) {
        $('#hold_until_time').val(newTimeslot.time);
        $('#hold_until_heat_temp').val(newTimeslot.heatTemp);
        $('#hold_until_cool_temp').val(newTimeslot.coolTemp);
        holdUntilTime = newTimeslot.time;
    } else {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const newTime = oneHourLater.getHours().toString().padStart(2, '0') + ':' + oneHourLater.getMinutes().toString().padStart(2, '0');
        $('#hold_until_time').val(newTime);
        $('#hold_until_heat_temp').val($('#setpoint').val());
        $('#hold_until_cool_temp').val($('#setpoint').val());
        holdUntilTime = newTime;
    }
    $('input[name="hold"][value="temporary"]').prop('checked', true);
    updateHoldType();
}
$('#next_timeslot, #prev_timeslot').click(function() {
    const direction = $(this).attr('id') === 'next_timeslot' ? 'next' : 'prev';
    updateHoldUntilTime(direction);
});
function updateHoldType() {
    holdType = $('input[name="hold"]:checked').val() || 'permanent';
    const hasSchedule = $('.schedule-timeslot').length > 0;
    $('#follow_schedule').prop('disabled', !hasSchedule);
    if (!hasSchedule) {
        if (holdType === 'schedule') {
            $('input[name="hold"][value="permanent"]').prop('checked', true);
            holdType = 'permanent';
        }
    }
    if (holdType === 'schedule') {
        $('#setpoint').prop('readonly', true);
        const scheduledTemp = getScheduledTemp();
        $('#setpoint').val(scheduledTemp);
        $('#temp_hold_options').hide();
    } else if (holdType === 'temporary') {
        $('#setpoint').prop('readonly', false);
        $('#temp_hold_options').show();
        if (!holdUntilTime) {
            setNextScheduledTime();
            holdUntilTime = $('#hold_until_time').val();
        }
     } else {
        $('#setpoint').prop('readonly', false);
        $('#temp_hold_options').hide();
    }
}
function getScheduledTemp() {
    const currentSchedule = JSON.parse(localStorage.getItem('currentSchedule')) || {};
    const schedule = currentSchedule.timeslots || [];
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const sortedSchedule = schedule.sort((a, b) => a.time.localeCompare(b.time));
    for (let i = sortedSchedule.length - 1; i >= 0; i--) {
        if (sortedSchedule[i].time <= currentTime) {
            if (mode === 'cool' && sortedSchedule[i].coolTemp) {
                scheduledTemp = parseFloat(sortedSchedule[i].coolTemp);
                return;
            } else if (mode === 'heat' && sortedSchedule[i].heatTemp) {
                scheduledTemp = parseFloat(sortedSchedule[i].heatTemp);
                return;
            }
        }
    }
    if (sortedSchedule.length > 0) {
        const lastTimeslot = sortedSchedule[sortedSchedule.length - 1];
        if (mode === 'cool' && lastTimeslot.coolTemp) {
            scheduledTemp = parseFloat(lastTimeslot.coolTemp);
        } else if (mode === 'heat' && lastTimeslot.heatTemp) {
            scheduledTemp = parseFloat(lastTimeslot.heatTemp);
        } else {
            scheduledTemp = parseFloat($('#setpoint').val());
        }
    } else {
        scheduledTemp = parseFloat($('#setpoint').val());
    }
}
function updateRunState(mode, setpoint) {
    if (resting) { 
        setThermostat(setpoint, mode);
        resting = false;
        restingSince = null;
        runningSince = Date.now(); 
        setpointSince = null; 
    }
}
function updateRestState(mode, restTemp) {
    if (!resting) { 
        setThermostat(restTemp, mode);
        resting = true;
        restingSince = Date.now(); 
        runningSince = null;
        setpointSince = null; 
    }
}
function runCool(currentTemp, running, setpoint, restTemp) {
    if (!resting) {
        if (running && currentTemp <= setpoint) {
            if (setpointSince === null) {
                setpointSince = Date.now(); 
            }
            if (Date.now() - setpointSince >= minSetpointRunTime) {
                updateRestState('cool', restTemp);
            }
        } else {
            setpointSince = null; 
            if (currentTemp >= restTemp) {
                updateRunState('cool', setpoint);
            }
        }
    } else {
        if (currentTemp >= restTemp) {
            updateRunState('cool', setpoint);
        }
    }
}
function runHeat(currentTemp, running, setpoint, restTemp) {
    if (!resting) {
        if (running && currentTemp >= setpoint) {
            if (setpointSince === null) {
                setpointSince = Date.now(); 
            }
            if (Date.now() - setpointSince >= minSetpointRunTime) {
                updateRestState('heat', restTemp);
            }
        } else {
            setpointSince = null; 
            if (currentTemp <= restTemp) {
                updateRunState('heat', setpoint);
            }
        }
    } else {
        if (currentTemp <= restTemp) {
            updateRunState('heat', setpoint);
        }
    }
}
function runCycleRange() {
    if (!latestReading) {
        return;
    }
    const scheduledTemp = getScheduledTemp();
    let setpoint;
    if (holdType === 'schedule') {
        setpoint = scheduledTemp;
    } else {
        setpoint = parseFloat($('#setpoint').val());
    }
    if (currentTemp !== null) {
        if (mode === 'cool') {
            runCool(currentTemp, running, setpoint, restTemp);
        } else if (mode === 'heat') {
            runHeat(currentTemp, running, setpoint, restTemp);
        }
    }
}
function setThermostat(setpoint, mode) {
    $.post('/set_update', {
        mode: mode,
        setpoint: setpoint,
    });
}
function updateStatus() {
    lastUpdateTime = Date.now();
    $.get('/get_status', function(data) {
        latestReading = data;
        running = data.running;
        currentTemp = data.current_temp;
        restTemp = mode === 'cool' ? 
        parseFloat(data.setpoint) + parseFloat(cycleRange) : 
        parseFloat(data.setpoint) - parseFloat(cycleRange);
        if (holdType === 'schedule') {
            const scheduledTemp = getScheduledTemp();
            $('#setpoint').val(scheduledTemp);
        }
        $('#status').html(`
            Mode: ${data.mode}<br>
            Current Temp: ${currentTemp}°F<br>
            Set Temp: ${data.setpoint}°F<br>
            Cycle Range: ${cycleRange}°F<br>
            Rest Temp: ${restTemp !== null ? restTemp + '°F' : 'N/A'}<br>
            Running: ${running} - Since: ${runningSince ? new Date(runningSince).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'N/A'}<br>
            Resting: ${resting} - Since: ${restingSince ? new Date(restingSince).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'N/A'}<br>
            Schedule: ${holdType}<br>
            Temporary Hold Until: ${holdUntilTime}
        `);
        runCycleRange();
    });
}
