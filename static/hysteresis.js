function hys(setpoint, mode) {
    const now = Date.now();
    const isCooling = mode === 'cool';
    V.activeSetpoint = isCooling ? setpoint - AC.activeHys : setpoint + AC.activeHys;
    const isAtActiveSetpoint = thermostat.temp === V.activeSetpoint;
    V.runningFor = V.runningSince ? now - V.runningSince : 0;
    V.runningAtEdgeFor = V.runningAtEdgeSince ? now - V.runningAtEdgeSince : 0;
    V.restSetpoint = isCooling ? setpoint + AC.passiveHys : setpoint - AC.passiveHys;
    const isAtRestSetpoint = thermostat.temp === V.restSetpoint;
    AC.restingFor = V.restingSince ? now - V.restingSince : 0;
    V.restingAtEdgeFor = AC.restingAtEdgeSince ? now - AC.restingAtEdgeSince : 0;
    const isInRestRange = isCooling ? () => thermostat.temp >= setpoint - AC.activeHys : () => thermostat.temp <= setpoint + AC.activeHys;
    if (thermostat.running) {
        AC.resting = false;
        V.restingSince = null;
        AC.restingAtEdgeSince = null;
        if (!V.runningSince && V.runningFor < V.maxRunTime) {
            V.runningSince = now;
        } else if (V.runningFor >= V.maxRunTime) {
            V.readyForQuickRest = true;
        }
        if (isAtActiveSetpoint) {
            if (!V.runningAtEdgeSince) {
                V.runningAtEdgeSince = now;
            }
            if (V.runningAtEdgeFor >= AC.runAtEdgeMinTime) {
                V.readyToRest = true;
            }
        } else {
            V.readyToRest = false;
            V.runningAtEdgeSince = null;
        }
    } else { //running=false
        V.runningSince = null;
        V.runningAtEdgeSince = null;
        if (isInRestRange()) {
            if (isAtActiveSetpoint) {
                if (V.readyToRest) {
                    AC.resting = true;
                    if (!V.restingSince) {
                        V.restingSince = now;
                    } 
                    if (!AC.restingAtEdgeSince) {
                        AC.restingAtEdgeSince = now;
                    }
                } else if (V.readyForQuickRest) {
                    quickResting = true;
                    if (!V.restingSince && V.restingFor < AC.quickRest) {
                        V.restingSince = now;
                    } else if (V.restingFor >= AC.quickRest) {
                        AC.resting = false;
                    }
                }
            } else { // isAtActiveSetpoint=false
                V.readyToRest = false;
            }
            if (isAtRestSetpoint) {
                if (!AC.restingAtEdgeSince) {
                    AC.restingAtEdgeSince = now;
                }
                if (V.restingAtEdgeFor >= AC.restAtEdgeMaxTime) {
                    AC.resting = false;
                }
            } else {
                AC.restingAtEdgeSince = null;
            }
        } else { // isInRestRange=false
            AC.resting = false;
        }
    }
    V.setpointToUse = AC.resting ? V.restSetpoint : V.activeSetpoint;
    setThermostat(V.setpointToUse, mode);
}
function setThermostat(setpoint, mode) {
    if (mode !== thermostat.mode || V.setpointToUse !== thermostat.setpoint) {
        fetch('/set_update', { method: 'POST', body: new URLSearchParams({ mode, setpoint: V.setpointToUse }) });
    }
}
