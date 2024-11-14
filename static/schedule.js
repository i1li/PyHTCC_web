function schedInfo(givenTime = null) {
    const slots = schedules.currentSchedule.timeslots || [];
    const timeslots = [...slots].sort((a, b) => a.time.localeCompare(b.time));
    const timeNow = getTimeNow();
    const timeToUse = givenTime || timeNow;
    const hourLater = getHourLater();
    let thisTimeslot = null;
    let nextTimeslot = null;
    let scheduledTemp = AC.setpoint;
    if (timeslots.length > 0) {
        for (let i = 0; i < timeslots.length; i++) {
            if (timeslots[i].time <= timeToUse) {
                thisTimeslot = timeslots[i];
                nextTimeslot = timeslots[i + 1] || timeslots[0];
            } else {
                if (!thisTimeslot) {
                    thisTimeslot = timeslots[timeslots.length - 1];
                }
                nextTimeslot = timeslots[i];
                break;
            }
        } if (thisTimeslot) {
            if (AC.mode === 'cool' && thisTimeslot.coolTemp) {
                scheduledTemp = Number(thisTimeslot.coolTemp);
            } else if (AC.mode === 'heat' && thisTimeslot.heatTemp) {
                scheduledTemp = Number(thisTimeslot.heatTemp);
            }
        }
    } else { nextTimeslot = { time: hourLater }; }
    return {
        scheduledTemp: scheduledTemp,
        timeslots: timeslots,
        nextTimeslot: nextTimeslot
    };
}
function schedInfoUI(givenTime = null) {
    const slots = [];
    $('.timeslot').each(function() {
        const time = $(this).find('input[type="time"]').val();
        const heatTemp = $(this).find('input.heat-input').val();
        const coolTemp = $(this).find('input.cool-input').val();
        if (time && (heatTemp || coolTemp)) {
            slots.push({ time, heatTemp, coolTemp });
        }
    });
    let timeslots = slots.sort((a, b) => a.time.localeCompare(b.time));
    const timeNow = getTimeNow();
    const timeToUse = givenTime || timeNow;
    const hourLater = getHourLater();
    let thisTimeslot = null;
    let nextTimeslot = null;
    let scheduledTemp = UI.setpoint;
    if (timeslots.length > 0) {
        for (let i = 0; i < timeslots.length; i++) {
            if (timeslots[i].time <= timeToUse) {
                thisTimeslot = timeslots[i];
                nextTimeslot = timeslots[i + 1] || timeslots[0];
            } else {
                if (!thisTimeslot) {
                    thisTimeslot = timeslots[timeslots.length - 1];
                }
                nextTimeslot = timeslots[i];
                break;
            }
        } if (thisTimeslot) {
            if (UI.mode === 'cool' && thisTimeslot.coolTemp) {
                scheduledTemp = Number(thisTimeslot.coolTemp);
            } else if (UI.mode === 'heat' && thisTimeslot.heatTemp) {
                scheduledTemp = Number(thisTimeslot.heatTemp);
            }
        }
    } else { nextTimeslot = { time: hourLater }; }
    return {
        scheduledTemp: scheduledTemp,
        timeslots: timeslots,
        thisTimeslot: thisTimeslot,
        nextTimeslot: nextTimeslot
    };
}
function saveSchedule() {
    const sched = schedInfoUI();
    if (schedules.currentScheduleName) {
        schedules.schedules[schedules.currentScheduleName] = { timeslots: sched.timeslots };
    }
    schedules.currentSchedule = { timeslots: sched.timeslots };
}
$('#save-sched').click(function() {
    const name = prompt("Enter a name for this schedule:", schedules.currentScheduleName);
    if (name) {
        schedules.currentScheduleName = name;
        saveSchedule();
        loadScheduleList();
        pauseUpdatesUntilSave = false;
        unsavedSettings = false;
        unsavedSchedule = false;
        unsavedWarning();
    }
});
function loadScheduleList() {
    const $loadSelect = $('#load-sched');
    $loadSelect.find('option:not(:first)').remove();
    Object.keys(schedules.schedules).forEach(name => {
        $loadSelect.append($('<option>', { value: name, text: name }));
    });
    if (schedules.currentScheduleName) {
        $loadSelect.val(schedules.currentScheduleName);
    }
}
function loadSchedule(scheduleName) {
    const schedule = schedules.schedules[scheduleName];
    if (schedule) {
        schedules.currentSchedule = JSON.parse(JSON.stringify(schedule)); 
        schedules.currentScheduleName = scheduleName;
        $('#schedule').empty();
        if (Array.isArray(schedule.timeslots)) {
            schedule.timeslots.forEach(timeslot => addTimeslot(timeslot));
        } else {
            console.error('Invalid schedule format');
        }
        $('#load-sched').val(scheduleName);
        handleHoldType();
    }
}
$('#load-sched').change(function() {
    const selectedSchedule = $(this).val();
    if (selectedSchedule) {
        pauseUpdatesUntilSave = true;
        unsavedSettings = true;
        unsavedSchedule = true;
        unsavedWarning();
        loadSchedule(selectedSchedule);
    }
});
function addTimeslot(timeslot = {}) {
    const newTimeslot = `
    <div class="timeslot"><div class="row"><div class="column">
    <input type="time" value="${timeslot.time}"></div><div class="column"><button class="remove-timeslot">Remove Timeslot</button></div></div><div class="row"><div class="column">
    <label for="cool-temp">Cool Temp:</label><input type="number" class="cool-input" value="${timeslot.coolTemp}"></div><div class="column">
    <label for="heat-temp">Heat Temp:</label><input type="number" class="heat-input" value="${timeslot.heatTemp}"></div></div></div>`;
    $('#schedule').append(newTimeslot);
}
$('#add-timeslot').click(function() {
    addTimeslot();
});
$(document).on('click', '.remove-timeslot', function() {
    $(this).closest('.timeslot').remove();
});
$('#clear-sched').click(function() {
    $('#schedule').empty();
});
$('#import-sched').click(function() {
    $('#import-sched-file').click();
});
$('#import-sched-file').change(function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedSchedules = JSON.parse(e.target.result);
                schedules.schedules = importedSchedules;
                alert('Schedule import success. Select one from the menu.');
                loadScheduleList();
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Failed to import schedules. Please ensure the file is a valid JSON.');
            }
        };
        reader.readAsText(file);
    }
});
$('#export-sched').click(function() {
    const blob = new Blob([JSON.stringify(schedules.schedules)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thermostat-schedules.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
