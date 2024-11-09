function hys(rawSetpoint, mode) {
    const now = Date.now();
    const isCooling = mode === 'cool';
    V.activeSetpoint = isCooling ? rawSetpoint - AC.activeHys : rawSetpoint + AC.activeHys;
    const isAtActiveSetpoint = thermostat.temp === V.activeSetpoint;
    V.runningFor = V.runningSince ? now - V.runningSince : 0;
    V.runningAtEdgeFor = V.runningAtEdgeSince ? now - V.runningAtEdgeSince : 0;
    V.restSetpoint = isCooling ? rawSetpoint + AC.passiveHys : rawSetpoint - AC.passiveHys;
    const isAtRestSetpoint = thermostat.temp === V.restSetpoint;
    V.restingFor = V.restingSince ? now - V.restingSince : 0;
    V.restingAtEdgeFor = V.restingAtEdgeSince ? now - V.restingAtEdgeSince : 0;
    const isInRestRange = isCooling ? () => thermostat.temp >= rawSetpoint - AC.activeHys : () => thermostat.temp <= rawSetpoint + AC.activeHys;
    if (thermostat.running) {
        V.resting = false;
        V.restingSince = null;
        V.restingAtEdgeSince = null;
        if (!V.runningSince && V.runningFor < AC.runMaxTime) {
            V.runningSince = now;
        } else if (V.runningFor >= AC.runMaxTime) {
            V.shouldQuickRest = true;
        }
        if (isAtActiveSetpoint) {
            if (!V.runningAtEdgeSince) {
                V.runningAtEdgeSince = now;
            }
            if (V.runningAtEdgeFor >= AC.runAtEdgeMinTime) {
                V.shouldRest = true;
            }
        } else if (!isAtActiveSetpoint) {
            V.shouldRest = false;
            V.runningAtEdgeSince = null;
        }
    } else if (!thermostat.running) { 
        V.runningSince = null;
        V.runningAtEdgeSince = null;
        if (isInRestRange()) {
            if (isAtActiveSetpoint) {
                if (V.shouldRest) {
                    V.resting = true;
                    if (!V.restingSince) {
                        V.restingSince = now;
                    } 
                    if (!V.restingAtEdgeSince) {
                        V.restingAtEdgeSince = now;
                    }
                } else if (V.shouldQuickRest) {
                    V.quickResting = true;
                    if (!V.restingSince && V.restingFor < AC.quickRestMaxTime) {
                        V.restingSince = now;
                    } else if (V.restingFor >= AC.quickRestMaxTime) {
                        V.resting = false;
                    }
                } 
            } else if (!isAtActiveSetpoint) { 
                V.shouldRest = false;
            } else if (isAtRestSetpoint) {
                if (!V.restingAtEdgeSince) {
                    V.restingAtEdgeSince = now;
                } else if (V.restingAtEdgeFor >= AC.restAtEdgeMaxTime) {
                    V.resting = false;
                }
            } else if (!isAtRestSetpoint) {
                V.restingAtEdgeSince = null;
            }
            if (V.restingFor >= AC.restMaxTime) {
                V.resting = false;
            }
        } else if (!isInRestRange) { 
            V.resting = false;
        }
    }
    const setpointToUse = V.resting ? V.restSetpoint : V.activeSetpoint;
    V.setpointToUse = setpointToUse;
    return setpointToUse;
}
function setThermostat(setpoint, mode) {
    if (mode !== thermostat.mode || setpoint !== thermostat.setpoint) {
        fetch('/set_thermostat', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode, setpoint }).toString() });
        lastMode = mode;
        lastSetpoint = setpoint;
    }
}
