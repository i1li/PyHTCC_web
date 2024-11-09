if (noUI) {
    loadState()
        .then(() => updateStatus())
        .then(() => {
            return scheduleStartOfMinute();
        })
        .catch(error => console.error('Error in noUI flow:', error));
} else {
    $(document).ready(function() {
        loadState()
            .then(() => updateStatus())
            .then(() => {
                return initializeUI();
            })
            .catch(error => console.error('Error in UI flow:', error));
    });
}
function runTasksOnMinute() {
    Promise.resolve()
        .then(() => {
            return new Promise(resolve => {
                updateStatus();
                resolve();
            });
        })
        .then(() => {
            return new Promise(resolve => {
                updateHoldType();
                resolve();
            });
        })
        .then(() => {
            if (!pauseUpdatesUntilSave) {
                return Promise.resolve()
                    .then(() => {
                        return new Promise(resolve => {
                            saveState();
                            resolve();
                        });
                    })
                    .then(() => {
                        return new Promise(resolve => {
                            hys(AC.setpoint, AC.mode);
                            resolve();
                        });
                    })
                    .then(() => {
                        return new Promise(resolve => {
                            setThermostat(V.setpointToUse, AC.mode);
                            resolve();
                        });
                    });
            }
        })
        .catch(error => {
            console.error('Error in runTasksOnMinute:', error);
        });
}
function updateHoldType() {
    const timeNow = getTimeNow();
    const hourLater = getHourLater();
    const hasSchedule = $('.timeslot').length > 0;
    if (!hasSchedule) {
        $('#sched-hold').prop('disabled');
        if (UI.holdType === 'sched') {
            $('input[name="hold"][value="perm"]').prop('checked', true);
            UI.holdType = 'perm';
        }
    }
    if (UI.holdType === 'sched') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').hide();
        populated = false;
        const sched = schedInfoUI();
        UI.setpoint = sched.scheduledTemp;
        $('#setpoint').val(UI.setpoint);
        UI.holdTime = sched.nextTimeslot.time;
    } else if (UI.holdType === 'temp') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').show();
        $('#setpoint').val(UI.setpoint);
        const sched = schedInfoUI();
        if (!populated) {
            shouldPopulate = true;
        } else if (lastHoldTime !== UI.holdTime) {
            shouldPopulate = true;
        }
        if (shouldPopulate) {
            if (!externalUpdate) {
                populateTimeslotNav(sched.nextTimeslot);
            } else {
                initializeTimeslotIndex(hourLater);
                populateTimeslotNav(sched.thisTimeslot);
            }
            populated = true;
            lastHoldTime = UI.holdTime;
        }
        $('#hold-time').val(UI.holdTime);
        lastHoldTime = UI.holdTime;
    } else if (UI.holdType === 'perm') {
        $('#setpoint').prop('readonly', false);
        $('#temp-hold-info').hide();
        populated = false;
    }
    if (AC.holdType === 'sched') {
        const sched = schedInfo();
        AC.setpoint = sched.scheduledTemp;
        AC.holdTime = sched.nextTimeslot.time;
    }
}
$('#apply').click(function() {
    Object.assign(AC, UI);
    pauseUpdatesUntilSave = false;
    unsavedSettings = false;
    unsavedSchedule = false;
    unsavedChangesWarning();
    Promise.resolve()
        .then(() => {
            return new Promise(resolve => {
                saveState();
                resolve();
            });
        })
        .then(() => {
            return new Promise(resolve => {
                updateHoldType();
                resolve();
            });
        })
        .then(() => {
            return new Promise(resolve => {
                hys(AC.setpoint, AC.mode);
                resolve();
            });
        })
        .then(() => {
            return new Promise(resolve => {
                setThermostat(V.setpointToUse, AC.mode);
                resolve();
            });
        })
        .catch(error => {
            console.error('Error applying changes:', error);
        });
});
