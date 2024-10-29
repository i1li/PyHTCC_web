
$(document).ready(function() {
    initializeUI();
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
                hysteresis(AC.setpoint, AC.mode);
                resolve();
            }, 1000);
        });
    })
}, 60000);
    function initializeUI() {
        $(`input[name="mode"][value="${AC.mode}"]`).prop('checked', true);
        $(`input[name="hold"][value="${AC.holdType}"]`).prop('checked', true);
        $('#setpoint').val(AC.setpoint);
        $('#passive_hysteresis').val(AC.passiveHysteresis);
        $('#active_hysteresis').val(AC.activeHysteresis);
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
    AC.passiveHysteresis = parseInt($('#passive_hysteresis').val(), 10);
    AC.activeHysteresis = parseInt($('#active_hysteresis').val(), 10);
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
                reject(error);
            });
    });
}