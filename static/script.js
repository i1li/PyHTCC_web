$(document).ready(function() {
    updateHoldType();
    cycleRange = $('#cycle_range').val();
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
        slotCount = 0;
        if (Array.isArray(schedule)) {
            schedule.forEach(slot => addSlot(slot));
        } else if (schedule && typeof schedule === 'object') {
            if (Array.isArray(schedule.slots)) {
                schedule.slots.forEach(slot => addSlot(slot));
            } else {
                console.error('Invalid schedule format');
            }
        } else {
            console.error('Invalid schedule format');
        }
        currentScheduleName = scheduleName;
        $('#load_schedule').val(scheduleName);
        updateDefaultSchedule();
        updateHoldType();
    }    
    function saveSchedule() {
        const schedule = [];
        $('.schedule-slot').each(function() {
            const time = $(this).find('input[type="time"]').val();
            const heatTemp = $(this).find('input[placeholder="Heat Temp"]').val();
            const coolTemp = $(this).find('input[placeholder="Cool Temp"]').val();
            if (time && (heatTemp || coolTemp)) {
                schedule.push({ time, heatTemp, coolTemp });
            }
        });
        if (currentScheduleName) {
            const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
            savedSchedules[currentScheduleName] = { slots: schedule };
            localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules));
        }
        localStorage.setItem('currentSchedule', JSON.stringify({ slots: schedule }));
        if ($('#default_schedule').is(':checked')) {
            localStorage.setItem('defaultScheduleName', currentScheduleName);
        }
        updateHoldType();
    }
    function updateDefaultSchedule() {
        const defaultScheduleName = localStorage.getItem('defaultScheduleName');
        $('#default_schedule').prop('checked', currentScheduleName === defaultScheduleName);
        const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
        Object.keys(savedSchedules).forEach(name => {
            savedSchedules[name].isDefaultSchedule = (name === defaultScheduleName);
        });
        localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules));
    }  
    $('input[name="hold"]').change(function() {
        updateHoldType();
        if (holdType === 'schedule') {
            const scheduledTemp = getScheduledTemp();
            $('#setpoint').val(scheduledTemp);
        }
    });      
    $('#cycle_range').change(function() {
        cycleRange = $(this).val();
    });    
    $('#submit').click(function() {
        const mode = $('input[name="mode"]:checked').val();
        let setpoint;
        updateHoldType();
        if (holdType === 'schedule') {
            setpoint = getScheduledTemp();
        } else if (holdType === 'temporary') {
            holdUntilTime = $('#hold_until_time').val();
            setpoint = $('#setpoint').val();
        } else {
            setpoint = $('#setpoint').val();
        }
        if (!setpoint) {
            setpoint = $('#setpoint').val();
        }
        setThermostat(setpoint, mode === 'cool');
    });
    function addSlot(slot = {}) {
        const newSlot = `
        <div class="schedule-slot">
            <input type="time" value="${slot.time || ''}">
            <button class="remove-slot-button">Remove Timeslot</button><br>
            <label for="heat_temp">Heat Temp:</label>
            <input type="number" placeholder="Heat Temp" value="${slot.heatTemp || ''}">
            <label for="cool_temp">Cool Temp:</label>
            <input type="number" placeholder="Cool Temp" value="${slot.coolTemp || ''}">
        </div>`;
        $('#schedule').append(newSlot);
        slotCount++;
        updateHoldType();
    }
    $('#add_slot').click(function() {
        addSlot();
    });
    $('#clear_schedule').click(function() {
        $('#schedule').empty();
        slotCount = 0;
        currentScheduleName = '';
        $('#load_schedule').val('');
    });
    $('#save_schedule').click(function() {
        const name = prompt("Enter a name for this schedule:", currentScheduleName);
        if (name) {
            const schedule = [];
            $('.schedule-slot').each(function() {
                const time = $(this).find('input[type="time"]').val();
                const heatTemp = $(this).find('input[placeholder="Heat Temp"]').val();
                const coolTemp = $(this).find('input[placeholder="Cool Temp"]').val();
                if (time && (heatTemp || coolTemp)) {
                    schedule.push({ time, heatTemp, coolTemp });
                }
            });
            const savedSchedules = JSON.parse(localStorage.getItem('savedSchedules')) || {};
            savedSchedules[name] = {
                slots: schedule,
                isDefaultSchedule: false
            };
            localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules));
            currentScheduleName = name;
            loadScheduleList();
            updateDefaultSchedule();
            saveSchedule();
        }
    });
    $('#load_schedule').change(function() {
        const selectedSchedule = $(this).val();
        if (selectedSchedule) {
            loadSchedule(selectedSchedule);
        }
    });
    $('#default_schedule').change(function() {
        if ($(this).is(':checked')) {
            localStorage.setItem('defaultScheduleName', currentScheduleName);
        } else {
            localStorage.removeItem('defaultScheduleName');
        }
        updateDefaultSchedule();
    });
    $(document).on('click', '.remove-slot-button', function() {
        $(this).closest('.schedule-slot').remove();
        slotCount--;
    });
    setInterval(function() {
        if (holdType === 'schedule') {
            const scheduledTemp = getScheduledTemp();
            $('#setpoint').val(scheduledTemp);
            const mode = $('input[name="mode"]:checked').val();
            setThermostat(scheduledTemp, mode === 'cool');
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
    const defaultScheduleName = localStorage.getItem('defaultScheduleName');
    if (defaultScheduleName) {
        loadSchedule(defaultScheduleName);
    }
    loadScheduleList();
    updateHoldType();
    updateDefaultSchedule();
    updateStatus(); 
});
let isResting = false;
let lastUpdateTime = 0;
let cycleRange;
let slotCount = 0;
let holdType = null;
let currentScheduleName = '';
let holdUntilTime = null;
let lastStatusData = null;
let runningSince = null;
let restTemp = null;
let restingSince = null;
const minRunTime = 600000;
function setNextScheduledTime() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    let nextSlot = null;
    $('.schedule-slot').each(function() {
        const slotTime = $(this).find('input[type="time"]').val();
        if (slotTime > currentTime && (!nextSlot || slotTime < nextSlot.time)) {
            nextSlot = {
                time: slotTime,
                heatTemp: $(this).find('input[placeholder="Heat Temp"]').val(),
                coolTemp: $(this).find('input[placeholder="Cool Temp"]').val()
            };
        }
    });
    if (nextSlot) {
        $('#hold_until_time').val(nextSlot.time);
        $('#hold_until_heat_temp').val(nextSlot.heatTemp);
        $('#hold_until_cool_temp').val(nextSlot.coolTemp);
    } else {
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        $('#hold_until_time').val(oneHourLater.getHours().toString().padStart(2, '0') + ':' + oneHourLater.getMinutes().toString().padStart(2, '0'));
        $('#hold_until_heat_temp').val($('#setpoint').val());
        $('#hold_until_cool_temp').val($('#setpoint').val());
    }
}
function getScheduleSlots() {
    const slots = [];
    $('.schedule-slot').each(function() {
        const time = $(this).find('input[type="time"]').val();
        const heatTemp = $(this).find('input[placeholder="Heat Temp"]').val();
        const coolTemp = $(this).find('input[placeholder="Cool Temp"]').val();
        if (time && (heatTemp || coolTemp)) {
            slots.push({ time, heatTemp, coolTemp });
        }
    });
    return slots.sort((a, b) => a.time.localeCompare(b.time));
}
function updateHoldUntilTime(direction) {
    const slots = getScheduleSlots();
    let newSlot;
    if (direction === 'next') {
        newSlot = slots.find(slot => slot.time > holdUntilTime) || slots[0];
    } else if (direction === 'prev') {
        newSlot = slots.reverse().find(slot => slot.time < holdUntilTime) || slots[slots.length - 1];
    }
    if (newSlot) {
        $('#hold_until_time').val(newSlot.time);
        $('#hold_until_heat_temp').val(newSlot.heatTemp);
        $('#hold_until_cool_temp').val(newSlot.coolTemp);
        holdUntilTime = newSlot.time;
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
$('#next_time_slot, #prev_time_slot').click(function() {
    const direction = $(this).attr('id') === 'next_time_slot' ? 'next' : 'prev';
    updateHoldUntilTime(direction);
});
function updateHoldType() {
    holdType = $('input[name="hold"]:checked').val() || 'permanent';
    const hasSchedule = $('.schedule-slot').length > 0;
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
    const schedule = currentSchedule.slots || [];
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const sortedSchedule = schedule.sort((a, b) => a.time.localeCompare(b.time));
    const mode = $('input[name="mode"]:checked').val();
    for (let i = sortedSchedule.length - 1; i >= 0; i--) {
        if (sortedSchedule[i].time <= currentTime) {
            if (mode === 'cool' && sortedSchedule[i].coolTemp) {
                return parseFloat(sortedSchedule[i].coolTemp);
            } else if (mode === 'heat' && sortedSchedule[i].heatTemp) {
                return parseFloat(sortedSchedule[i].heatTemp);
            }
        }
    }
    if (sortedSchedule.length > 0) {
        const lastSlot = sortedSchedule[sortedSchedule.length - 1];
        if (mode === 'cool' && lastSlot.coolTemp) {
            return parseFloat(lastSlot.coolTemp);
        } else if (mode === 'heat' && lastSlot.heatTemp) {
            return parseFloat(lastSlot.heatTemp);
        }
    }
    return parseFloat($('#setpoint').val());
}
function runCycleRange() {
    if (!lastStatusData) {
        return;
    }
    const currentTemp = lastStatusData.current_temp;
    const scheduledTemp = getScheduledTemp();
    const mode = $('input[name="mode"]:checked').val();
    const cycleRange = parseFloat($('#cycle_range').val());
    let setpoint;
    if (holdType === 'schedule') {
        setpoint = scheduledTemp;
    } else {
        setpoint = parseFloat($('#setpoint').val());
    }
    if (currentTemp !== null) {
        restTemp = mode === 'cool' ? setpoint + cycleRange : setpoint - cycleRange;
        if (mode === 'cool') {
            if (!isResting) {
                if (lastStatusData.running && currentTemp <= setpoint) {
                    setThermostat(restTemp, true);
                    isResting = true;
                    restingSince = Date.now();
                    runningSince = null;
                } else if (currentTemp >= restTemp) {
                    setThermostat(setpoint, true);
                    if (!lastStatusData.running) {
                        runningSince = Date.now();
                    }
                }
            } else {
                if (currentTemp >= restTemp) {
                    setThermostat(setpoint, true);
                    isResting = false;
                    restingSince = null;
                    runningSince = Date.now();
                }
            }
        } else if (mode === 'heat') {
            if (!isResting) {
                if (lastStatusData.running && currentTemp >= setpoint) {
                    setThermostat(restTemp, false);
                    isResting = true;
                    restingSince = Date.now();
                    runningSince = null;
                } else if (currentTemp <= restTemp) {
                    setThermostat(setpoint, false);
                    if (!lastStatusData.running) {
                        runningSince = Date.now();
                    }
                }
            } else {
                if (currentTemp <= restTemp) {
                    setThermostat(setpoint, false);
                    isResting = false;
                    restingSince = null;
                    runningSince = Date.now();
                }
            }
        }
    }
}
function setThermostat(setpoint, isCooling) {
    $.post('/update', {
        mode: isCooling ? 'cool' : 'heat',
        setpoint: setpoint,
    });
}
function updateStatus() {
    lastUpdateTime = Date.now();
    $.get('/status', function(data) {
        lastStatusData = data;
        if (holdType === 'schedule') {
            const scheduledTemp = getScheduledTemp();
            $('#setpoint').val(scheduledTemp);
        }
        $('#status').html(`
            Mode: ${data.mode}<br>
            Current Temp: ${data.current_temp}°F<br>
            Set Temp: ${data.setpoint}°F<br>
            Cycle Range: ${cycleRange}°F<br>
            Rest Temp: ${restTemp !== null ? restTemp + '°F' : 'N/A'}<br>
            Running: ${data.running} - Since: ${runningSince ? new Date(runningSince).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'N/A'}<br>
            Resting: ${isResting} - Since: ${restingSince ? new Date(restingSince).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'N/A'}<br>
            Schedule: ${holdType}<br>
            Temporary Hold Until: ${holdUntilTime}
        `);
        runCycleRange();
    });
}
