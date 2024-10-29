function runCycleRange(rawSetpoint, mode) {
    AC.rawSetpoint = rawSetpoint;
    const now = Date.now();
    const isCooling = mode === 'cool';
    AC.restSetpoint = isCooling ? AC.rawSetpoint + AC.cycleRange : AC.rawSetpoint - AC.cycleRange;
    const isInRestRange = isCooling ? () => AC.currentTemp >= AC.rawSetpoint : () => AC.currentTemp <= AC.rawSetpoint;
    const isAtRawSetpoint = AC.currentTemp === AC.rawSetpoint;
    const isAtRestSetpoint = AC.currentTemp === AC.restSetpoint;
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
        }
        if (isAtRawSetpoint) {
            if (!AC.runningAtSetpointSince) {
                AC.runningAtSetpointSince = now;
            }
            if (AC.runningAtSetpointDuration >= AC.atSetpointMinTime) {
                AC.readyToRest = true;
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
                    }
                    if (!AC.restingAtSetpointSince) {
                        AC.restingAtSetpointSince = now;
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
        }
    }
    AC.setpointToUse = AC.resting ? AC.restSetpoint : AC.rawSetpoint;
    setThermostat(AC.setpointToUse, mode);
}
function setThermostat(setpoint, mode) {
    if (mode !== AC.currentMode || AC.setpointToUse !== AC.currentSetpoint) {
        $.post('/set_update', { mode: mode, setpoint: AC.setpointToUse });
    }
}
