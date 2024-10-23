# PyHTCC_web
 A JavaScript web thermostat control, built on a minimal Flask server using PyHTCC, a Python library for interfacing with Honeywell Total Connect Comfort (TCC) thermostats

What is Cycle Range?

Cycle Range is the amount of degrees away from setpoint allowed while in rest between cycles, before starting another cycle of cooling/heating to setpoint. Leave this value blank or 0 for default behavior. Useful to reduce frequent on/off cycles, such as when the output of the unit is high relative to the space controlled. The system will cool/heat until reaching setpoint, and then rests until temp reaches the set temp plus (or minus in the case of heat) the Cycle Range.

The runCycleRange function uses restTemp, encapsulated in the following line of code:
        restTemp = mode === 'cool' ? setpoint + cycleRange : setpoint - cycleRange;
This means restTemp, when the mode is cool, is the setpoint plus the cycleRange. When the mode is heat, restTemp is the setpoint minus the cycleRange

The transitions in the `runCycleRange` function are based on updates of `lastStatusData.running` and whether it is switching states while reaching or departing from the setpoint or rest temperature.

1. For cooling mode:
   - The system enters the resting state when `lastStatusData.running` changes from true to false while the current temperature is at or below the setpoint.
   - It exits the resting state and starts cooling again when the current temperature reaches or exceeds the rest temperature.

2. For heating mode:
   - The system enters the resting state when `lastStatusData.running` changes from true to false while the current temperature is at or above the setpoint.
   - It exits the resting state and starts heating again when the current temperature drops to or below the rest temperature.

The `isResting` and `restingSince` variables should be updated as follows:
- `isResting` is set to `true` when entering the resting state (when `lastStatusData.running` becomes false at the appropriate temperature).
- `restingSince` is set to the current time (`Date.now()`) when entering the resting state.
- Both are reset (`isResting` to `false` and `restingSince` to `null`) when exiting the resting state.

These transitions are dependent on both the `lastStatusData.running` state and the temperature conditions, ensuring that the system cycles appropriately based on the thermostat's actual running state and the current temperature in relation to the setpoint and rest temperature.