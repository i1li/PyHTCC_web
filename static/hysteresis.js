function hysteresis(rawSetpoint, mode) {
    AC.rawSetpoint = rawSetpoint;
    const now = Date.now();
    const isCooling = mode === 'cool';
    AC.restSetpoint = isCooling ? AC.rawSetpoint + AC.passiveHysteresis : AC.rawSetpoint - AC.passiveHysteresis;
    AC.activeSetpoint = isCooling ? AC.rawSetpoint - AC.activeHysteresis : AC.rawSetpoint + AC.activeHysteresis;
    const isInRestRange = isCooling ? () => AC.currentTemp >= AC.rawSetpoint - AC.activeHysteresis : () => AC.currentTemp <= AC.rawSetpoint + AC.activeHysteresis;
    const isAtActiveSetpoint = AC.currentTemp === AC.activeSetpoint;
    const isAtRestSetpoint = AC.currentTemp === AC.restSetpoint;
    AC.restingDuration = AC.restingSince ? now - AC.restingSince : 0;
    AC.restingAtLimitDuration = AC.restingAtLimitSince ? now - AC.restingAtLimitSince : 0;
    AC.runningDuration = AC.runningSince ? now - AC.runningSince : 0;
    AC.runningAtLimitDuration = AC.runningAtLimitSince ? now - AC.runningAtLimitSince : 0;
    if (AC.running) {
        AC.resting = false;
        AC.restingSince = null;
        AC.restingAtLimitSince = null;
        if (!AC.runningSince) {
            AC.runningSince = now;
        }
        if (isAtActiveSetpoint) {
            if (!AC.runningAtLimitSince) {
                AC.runningAtLimitSince = now;
            }
            if (AC.runningAtLimitDuration >= AC.atLimitMinTime) {
                AC.readyToRest = true;
            }
        } else {
            AC.readyToRest = false;
            AC.runningAtLimitSince = null;
        }
    } else { //running=false
        AC.runningSince = null;
        AC.runningAtLimitSince = null;
        if (isInRestRange()) {
            if (isAtActiveSetpoint) {
                if (AC.readyToRest) {
                    AC.resting = true;
                    if (!AC.restingSince) {
                        AC.restingSince = now;
                    }
                    if (!AC.restingAtLimitSince) {
                        AC.restingAtLimitSince = now;
                    }
                }
            } else { // isAtActiveSetpoint=false
                AC.readyToRest = false;
                AC.restingAtLimitSince = null;
            }
        } else { // isInRestRange=false
            AC.resting = false;
            AC.restingSince = null;
            AC.restingAtLimitSince = null;
            AC.readyToRest = false;
        }
    }
    AC.setpointToUse = AC.resting ? AC.restSetpoint : AC.activeSetpoint;
    setThermostat(AC.setpointToUse, mode);
}
function setThermostat(setpoint, mode) {
    if (mode !== AC.currentMode || AC.setpointToUse !== AC.currentSetpoint) {
        $.post('/set_update', { mode: mode, setpoint: AC.setpointToUse });
    }
}
