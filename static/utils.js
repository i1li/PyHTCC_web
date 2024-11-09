function scheduleStartOfMinute() {
    const now = new Date();
    const delay = 60000 - (now.getSeconds() * 1000);
    setTimeout(() => {
        runTasksOnMinute();
        setInterval(runTasksOnMinute, 60000);
    }, delay);
}
function formatTime(hours, minutes) {
    return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
}
function getTimeNow() {
    const now = new Date();
    return formatTime(now.getHours(), now.getMinutes());
}
function getHourLater() {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
    return formatTime(oneHourLater.getHours(), oneHourLater.getMinutes());
}
function sortObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObject);
    }
    return Object.keys(obj).sort().reduce((result, key) => {
        result[key] = sortObject(obj[key]);
        return result;
    }, {});
}
function isEqual(obj1, obj2, tolerance = 1e-10) {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) return false;
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (typeof obj1[key] === 'number' && typeof obj2[key] === 'number') {
            if (Math.abs(obj1[key] - obj2[key]) > tolerance) return false;
        } else if (!isEqual(obj1[key], obj2[key], tolerance)) {
            return false;
        }
    }
    return true;
}
function switchHoldType(holdType) {
    AC.holdType = holdType;
    UI.holdType = holdType;
    $(`input[name="hold"][value="${holdType}"]`).prop('checked', true);

}
function handleExternalUpdate() {
    externalUpdate = true;
    switchHoldType('temp');
    const hourLater = getHourLater();
    AC.holdTime = hourLater;
    UI.holdTime = hourLater;
    AC.mode = thermostat.mode;
    UI.mode = thermostat.mode;
    AC.setpoint = thermostat.setpoint;
    UI.setpoint = thermostat.setpoint;
}
function unsavedChangesWarning() {
    const warningElement = document.getElementById('warning');
    const applyElement = document.getElementById('apply');
    const saveScheduleElement = document.getElementById('save-sched');
    const warning2Element = document.getElementById('warning2');
    if (unsavedSettings || unsavedSchedule) {
        warningElement.style.display = 'block';
        applyElement.style.border = 'red solid 3px';
    } else {
        warningElement.style.display = 'none';
        applyElement.style.border = 'none';
    }
    if (!unsavedSettings && unsavedSchedule) {
        warning2Element.style.display = 'block';
        saveScheduleElement.style.border = 'red solid 3px';
    } else if (!unsavedSchedule) {
        warning2Element.style.display = 'none';
        saveScheduleElement.style.border = 'none';
    }
}
function hasUIChanged() {
    const changedProperties = Object.keys(UI).filter(key => UI[key] !== AC[key]);
    unsavedSettings = changedProperties.length > 0;
    unsavedChangesWarning();
}
function hasScheduleChanged() {
    const uiSchedule = schedInfoUI();
    const acSchedule = schedInfo();
    if (!uiSchedule || !acSchedule) return true;
    if (!uiSchedule.timeslots || !acSchedule.timeslots) return true;
    const sortedUITimeslots = sortObject(uiSchedule.timeslots);
    const sortedACTimeslots = sortObject(acSchedule.timeslots);
    const scheduleChanged = !isEqual(sortedUITimeslots, sortedACTimeslots);
    unsavedSchedule = scheduleChanged;
    unsavedChangesWarning();
    return scheduleChanged;
}
document.addEventListener('DOMContentLoaded', function() {
    const scheduleDiv = document.getElementById('schedule');
    scheduleDiv.addEventListener('input', debounce(function(event) {
        hasScheduleChanged();
    }, 1500));
    scheduleDiv.addEventListener('change', function(event) {
        hasScheduleChanged();
    });
    scheduleDiv.addEventListener('click', debounce(function(event) {
        hasScheduleChanged();
    }, 1500));
});
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
const toTop = document.getElementById("toTop");
function handleScroll() {
  if (document.body.scrollTop > 160 || document.documentElement.scrollTop > 160) {
    toTop.style.display = "block";
  } else {
    toTop.style.display = "none";
  }
}
window.addEventListener('scroll', handleScroll);
function topFunction() {
  window.scrollTo(0, 0);
}
