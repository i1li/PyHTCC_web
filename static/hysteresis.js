function hysteresis(rawSetpoint, mode) {
    AC.rawSetpoint = rawSetpoint;
    const now = Date.now();
    const isCooling = mode === 'cool';
    AC.activeSetpoint = isCooling ? AC.rawSetpoint - AC.activeHysteresis : AC.rawSetpoint + AC.activeHysteresis;
    const isAtActiveSetpoint = AC.currentTemp === AC.activeSetpoint;
    AC.runningFor = AC.runningSince ? now - AC.runningSince : 0;
    AC.runningAtEdgeFor = AC.runningAtEdgeSince ? now - AC.runningAtEdgeSince : 0;
    AC.restSetpoint = isCooling ? AC.rawSetpoint + AC.passiveHysteresis : AC.rawSetpoint - AC.passiveHysteresis;
    const isAtRestSetpoint = AC.currentTemp === AC.restSetpoint;
    AC.restingFor = AC.restingSince ? now - AC.restingSince : 0;
    AC.restingAtEdgeFor = AC.restingAtEdgeSince ? now - AC.restingAtEdgeSince : 0;
    const isInRestRange = isCooling ? () => AC.currentTemp >= AC.rawSetpoint - AC.activeHysteresis : () => AC.currentTemp <= AC.rawSetpoint + AC.activeHysteresis;
    if (AC.running) {
        AC.resting = false;
        AC.restingSince = null;
        AC.restingAtEdgeSince = null;
        if (!AC.runningSince) {
            AC.runningSince = now;
        }
        if (isAtActiveSetpoint) {
            if (!AC.runningAtEdgeSince) {
                AC.runningAtEdgeSince = now;
            }
            if (AC.runningAtEdgeFor >= AC.atEdgeMinTime) {
                AC.readyToRest = true;
            }
        } else {
            AC.readyToRest = false;
            AC.runningAtEdgeSince = null;
        }
    } else { //running=false
        AC.runningSince = null;
        AC.runningAtEdgeSince = null;
        if (isInRestRange()) {
            if (isAtActiveSetpoint) {
                if (AC.readyToRest) {
                    AC.resting = true;
                    if (!AC.restingSince) {
                        AC.restingSince = now;
                    }
                    if (!AC.restingAtEdgeSince) {
                        AC.restingAtEdgeSince = now;
                    }
                }
            } else { // isAtActiveSetpoint=false
                AC.readyToRest = false;
            }
            if (isAtRestSetpoint) {
                if (!AC.restingAtEdgeSince) {
                    AC.restingAtEdgeSince = now;
                }
                if (AC.restingAtEdgeFor >= AC.atEdgeMaxTime) {
                    AC.resting = false;
                }
            } else {
                AC.restingAtEdgeSince = null;
            }
        } else { // isInRestRange=false
            AC.resting = false;
        }
    }
    AC.hysteresisSetpoint = AC.resting ? AC.restSetpoint : AC.activeSetpoint;
    setThermostat(AC.hysteresisSetpoint, mode);
}
function setThermostat(setpoint, mode) {
    if (mode !== AC.currentMode || AC.hysteresisSetpoint !== AC.currentSetpoint) {
        $.post('/set_update', { mode: mode, setpoint: AC.hysteresisSetpoint });
    }
}
