function formatTime(hours, minutes) {
    return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
}
function getTimeNow() {
    const now = new Date();
    return formatTime(now.getHours(), now.getMinutes());
}
function getHourLater() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return formatTime(now.getHours(), now.getMinutes());
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
function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
      const context = this;
      const args = arguments;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(function() {
          if ((Date.now() - lastRan) >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, Math.max(0, limit - (Date.now() - lastRan)));
      }
    }
  }  
function goToTop() {
  window.scrollTo(0, 0);
}
function switchHoldType(holdType) {
    AC.holdType = UI.holdType = holdType;
    $(`input[name="hold"][value="${holdType}"]`).prop('checked', true);
}
$(document).ready(function() {
    $('#schedule').on('input change click', debounce(function(event) {
        hasScheduleChanged();
    }, 2500));
    $(window).scroll(throttle(function() {
        if ($(window).scrollTop() > 160) {
            document.getElementById("to-top").style.display = "block";
        } else {
            document.getElementById("to-top").style.display = "none";
        }
    }, 250));
});
function hasScheduleChanged() {
    const schedUI = schedInfoUI();
    const sched = schedInfo();
    if (!schedUI || !sched) return true;
    if (!schedUI.timeslots || !sched.timeslots) return true;
    const sortedTimeslotsUI = sortObject(schedUI.timeslots);
    const sortedTimeslotsAC = sortObject(sched.timeslots);
    const scheduleChanged = !isEqual(sortedTimeslotsUI, sortedTimeslotsAC);
    unsavedSchedule = scheduleChanged;
    unsavedWarning();
    return scheduleChanged;
}
function hasUIChanged() {
    const changedProperties = Object.keys(UI).filter(key => UI[key] !== AC[key]);
    unsavedSettings = changedProperties.length > 0;
    unsavedWarning();
}
function unsavedWarning(givenStatus = null) {
    if (givenStatus !== null) {
        unsavedSettings = givenStatus;
        unsavedSchedule = givenStatus;
    }
    if (unsavedSettings || unsavedSchedule) {
        $('#warning').show();
        $('#apply').css('border', 'red solid 3px');
        pauseUntilSave = true;
    } else {
        $('#warning').hide();
        $('#apply').css('border', 'none');
    }
    if (unsavedSchedule) {
        $('#warning2').show();
        $('#save-sched').css('border', 'red solid 3px');
        pauseUntilSave = true;
    } else {
        $('#warning2').hide();
        $('#save-sched').css('border', 'none');
    }
    pauseUntilSave = unsavedSettings || unsavedSchedule;
}
function handleInputChange(property, parseAsInt = false) {
    return function() {
        UI[property] = parseAsInt ? parseInt($(this).val(), 10) : $(this).val();
        if (property === 'holdType') processSchedule();
        hasUIChanged();
    };
}
$('input[name="mode"]').change(handleInputChange('mode'));
$('input[name="hold"]').change(handleInputChange('holdType'));
$('#hold-time').change(handleInputChange('holdTime'));
$('#setpoint').change(handleInputChange('setpoint', true));
$('#passive-hys').change(handleInputChange('passiveHys', true));
$('#active-hys').change(handleInputChange('activeHys', true));
function clearChanges() {
    initializeUI();
    unsavedSchedule = unsavedSettings = false;
    unsavedWarning();
}
async function initialize() {
    await loadState();
    initializeUI();
    go.start();
}
function initializeUI () {
    loadScheduleList();
    Object.assign(UI, AC);
    $(`input[name="mode"][value="${UI.mode}"]`).prop('checked', true);
    $(`input[name="hold"][value="${UI.holdType}"]`).prop('checked', true);
    $('#hold-time').val(UI.holdTime);
    $('#setpoint').val(UI.setpoint);
    $('#passive-hys').val(UI.passiveHys);
    $('#active-hys').val(UI.activeHys);
    if (schedules.currentScheduleName) {
        $('#load-sched').val(schedules.currentScheduleName);
        loadSchedule(schedules.currentScheduleName);
    }
}
function loadState() {
    return fetch('/app_state')
        .then(response => response.json())
        .then(data => {
            if (Object.keys(data).length === 0) {
                noState = pauseUntilSave = true;
                saveState();
                return;
            } else { noState = pauseUntilSave = false;
             }
            Object.assign(AC, data.AC);
            Object.assign(V, data.V);
            Object.assign(schedules, data.schedules);
            lastState = JSON.parse(JSON.stringify(data)); 
            console.log('State loaded');
        })
        .catch(error => console.error('Error loading state:', error));
}
function hasStateChanged(currentState, lastState) {
    if (!lastState) return false;
    if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
    const sortedCurrent = sortObject(currentState);
    const sortedLast = sortObject(lastState);
    return !isEqual(sortedCurrent.AC, sortedLast.AC) || !isEqual(sortedCurrent.schedules, sortedLast.schedules);
    } else return false;
}
function saveState() {
    const currentState = {
        AC,
        V,
        schedules
    };
    if (noState) { lastState = currentState; }
    if (hasStateChanged(currentState, lastState) || noState) {
        return fetch('/app_state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentState) })
        .then(response => response.json())
        .then(result => {
            if (result.success) { console.log('State saved');
                lastState = JSON.parse(JSON.stringify(currentState));
                if (noState) {
                    noState = false;
                    unsavedSettings = true;
                    unsavedWarning();
                }
            } else { console.error('Failed saving state'); }
        })
        .catch(error => console.error('Error saving state:', error));
    } else { console.log('State unchanged.', JSON.stringify(thermostat, null, 2));
        return Promise.resolve(); } 
}
function readThermostat(retries = 3) {
    return new Promise((resolve, reject) => {
        const attemptRead = (attemptsLeft) => {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('readThermostat timed out')), 50000);
            });
            const updatePromise = fetch('/read_thermostat')
                .then(response => response.json())
                .then(reading => Object.assign(thermostat, reading));
            Promise.race([updatePromise, timeoutPromise])
                .then(() => {
                    clearTimeout(timeoutId);
                    handleReading();
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    if (attemptsLeft > 1) {
                        console.log(`Retrying readThermostat. Attempts left: ${attemptsLeft - 1}`);
                        setTimeout(() => attemptRead(attemptsLeft - 1), 15000);
                    } else {
                        console.error('readThermostat failed after all retry attempts');
                        reject(error);
                    }
                });
        };
        attemptRead(retries);
    });
}
function setThermostat(setpoint, mode) {
    fetch('/set_thermostat', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode, setpoint }).toString() });
}
