function getUIScheduleInfo() {
    const slots = [];
    $('.schedule-timeslot').each(function() {
        const time = $(this).find('input[type="time"]').val();
        const heatTemp = $(this).find('input.heat-input').val();
        const coolTemp = $(this).find('input.cool-input').val();
        if (time && (heatTemp || coolTemp)) {
            slots.push({ time, heatTemp, coolTemp });
        }
    });
    const timeslots = slots.sort((a, b) => a.time.localeCompare(b.time));
    const currentTime = getCurrentTime();
    let currentTimeslot = null;
    let nextTimeslot = null;
    let scheduledTemp = UI.setpoint;
    if (timeslots.length > 0) {
        for (let i = 0; i < timeslots.length; i++) {
            if (timeslots[i].time <= currentTime) {
                currentTimeslot = timeslots[i];
                nextTimeslot = timeslots[i + 1] || timeslots[0];
            } else {
                if (!currentTimeslot) {
                    currentTimeslot = timeslots[timeslots.length - 1];
                }
                nextTimeslot = timeslots[i];
                break;
            }
        }
        UI.holdUntil = nextTimeslot.time;
        if (currentTimeslot) {
            if (UI.mode === 'cool' && currentTimeslot.coolTemp) {
                scheduledTemp = Number(currentTimeslot.coolTemp);
            } else if (UI.mode === 'heat' && currentTimeslot.heatTemp) {
                scheduledTemp = Number(currentTimeslot.heatTemp);
            }
        }
    } else {
        nextTimeslot = { time: getOneHourLaterTime() };
    }
    return {
        scheduledTemp: scheduledTemp,
        timeslots: timeslots,
        currentTimeslot: currentTimeslot,
        nextTimeslot: nextTimeslot
    };
}
function getACScheduleInfo() {
    const slots = AC.currentSchedule.timeslots || [];
    const timeslots = [...slots].sort((a, b) => a.time.localeCompare(b.time));
    const currentTime = getCurrentTime();
    let currentTimeslot = null;
    let nextTimeslot = null;
    let scheduledTemp = AC.setpoint;
    if (timeslots.length > 0) {
        for (let i = 0; i < timeslots.length; i++) {
            if (timeslots[i].time <= currentTime) {
                currentTimeslot = timeslots[i];
                nextTimeslot = timeslots[i + 1] || timeslots[0];
            } else {
                if (!currentTimeslot) {
                    currentTimeslot = timeslots[timeslots.length - 1];
                }
                nextTimeslot = timeslots[i];
                break;
            }
        }
        AC.holdUntil = nextTimeslot.time;
        if (currentTimeslot) {
            if (AC.mode === 'cool' && currentTimeslot.coolTemp) {
                scheduledTemp = Number(currentTimeslot.coolTemp);
            } else if (AC.mode === 'heat' && currentTimeslot.heatTemp) {
                scheduledTemp = Number(currentTimeslot.heatTemp);
            }
        }
    }
    return {
        scheduledTemp: scheduledTemp,
        timeslots: timeslots
    };
}        
function saveSchedule() {
    const sched = getUIScheduleInfo();
    if (AC.currentScheduleName) {
        AC.schedules[AC.currentScheduleName] = { timeslots: sched.timeslots };
    }
    AC.currentSchedule = { timeslots: sched.timeslots };
}
$('#save-schedule').click(function() {
    const name = prompt("Enter a name for this schedule:", AC.currentScheduleName);
    if (name) {
        AC.currentScheduleName = name;
        saveSchedule();
        loadScheduleList();
    }
});
function loadScheduleList() {
    const $loadSelect = $('#load-schedule');
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
        UI.currentSchedule = JSON.parse(JSON.stringify(schedule)); 
        UI.currentScheduleName = scheduleName;
        $('#schedule').empty();
        if (Array.isArray(schedule.timeslots)) {
            schedule.timeslots.forEach(timeslot => addTimeslot(timeslot));
        } else {
            console.error('Invalid schedule format');
        }
        $('#load-schedule').val(scheduleName);
        updateHoldType();
    }
}
$('#load-schedule').change(function() {
    const selectedSchedule = $(this).val();
    if (selectedSchedule) {
        loadSchedule(selectedSchedule);
    }
    checkForChanges();
});
function addTimeslot(timeslot = {}) {
    const newTimeslot = `
    <div class="schedule-timeslot">
    <div class="row"><div class="column">
    <input type="time" value="${timeslot.time}">
    </div><div class="column">
    <button class="remove-timeslot">Remove Timeslot</button>
    </div></div><div class="row"><div class="column">
    <label for="cool-temp">Cool Temp:</label>
    <input type="number" class="cool-input" value="${timeslot.coolTemp}">
    </div><div class="column">
    <label for="heat-temp">Heat Temp:</label>
    <input type="number" class="heat-input" value="${timeslot.heatTemp}">
    </div></div></div>`;
    $('#schedule').append(newTimeslot);
}
$('#add-timeslot').click(function() {
    addTimeslot();
});
$(document).on('click', '.remove-timeslot', function() {
    $(this).closest('.schedule-timeslot').remove();
});
$('#clear-schedule').click(function() {
    $('#schedule').empty();
});
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
