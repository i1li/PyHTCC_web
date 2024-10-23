# PyHTCC_web

A JavaScript web thermostat control built on a minimal Flask server using [PyHTCC](https://github.com/csm10495/pyhtcc), a Python library for interfacing with Honeywell Total Connect Comfort (TCC) thermostats.

Limitations Addressed: The Honeywell app only alows 4 schedule timeslots, 1 saved schedule, and timeslots can only be in intervals of 15 minutes.

## Features
- Unlimited schedule timeslots
- Save and choose from multiple schedules
- Choose to follow the set schedule, temporarily hold a temperature, or permanently hold
- [Cycle Range](#what-is-cycle-range)


## Getting Started

### Install Requirements
```bash
pip install -r requirements.txt
```

### Update Environment Variables
Update the `.env` file with the credentials you use for your Honeywell app or their web portal at [mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/).

### Run the Application
Run `pyhtcc_web.py`, then open a browser window to `localhost:5001`.


## What is Cycle Range?
Cycle Range is the amount of degrees away from the setpoint allowed while in rest between cycles before starting another cycle of cooling/heating to setpoint. 

- Optional field: leave this value blank or `0` for default behavior.
- Useful to reduce frequent on/off cycles, especially when the output of the unit is high relative to the space controlled.

The system will cool/heat until reaching the setpoint, and then rests until the temperature reaches the set temperature plus (or minus in the case of heat) the Cycle Range.

### Code Explanation
The `runCycleRange` function uses `restTemp`, encapsulated in the following line of code:
```javascript
restTemp = mode === 'cool' ? setpoint + cycleRange : setpoint - cycleRange;
```
This means:
- When the mode is **cool**, `restTemp` is the setpoint plus the cycleRange.
- When the mode is **heat**, `restTemp` is the setpoint minus the cycleRange.

### State Transitions
The transitions in the `runCycleRange` function are based on updates of `lastStatusData.running` and whether it is switching states while reaching or departing from the setpoint or rest temperature.

1. **For Cooling Mode:**
   - The system enters the resting state when `lastStatusData.running` changes from true to false while the current temperature is at or below the setpoint.
   - It exits the resting state and starts cooling again when the current temperature reaches or exceeds the rest temperature.

2. **For Heating Mode:**
   - The system enters the resting state when `lastStatusData.running` changes from true to false while the current temperature is at or above the setpoint.
   - It exits the resting state and starts heating again when the current temperature drops to or below the rest temperature.

### Variable Updates
The `isResting` and `restingSince` variables should be updated as follows:
- **isResting** is set to `true` when entering the resting state (when `lastStatusData.running` becomes false at the appropriate temperature).
- **restingSince** is set to the current time (`Date.now()`) when entering the resting state.
- Both are reset (`isResting` to `false` and `restingSince` to `null`) when exiting the resting state.

These transitions are dependent on both the `lastStatusData.running` state and temperature conditions, ensuring that the system cycles appropriately based on its actual running state and current temperature in relation to both setpoint and rest temperature.
