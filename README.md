### PyHTCC_web

A JavaScript web thermostat control built on a minimal Flask server using [PyHTCC](https://github.com/csm10495/pyhtcc), a Python library for interfacing with Honeywell Total Connect Comfort (TCC) thermostats. Active and passive hysteresis.

Limitations Addressed: The Honeywell app only alows 1 saved schedule, 4 schedule timeslots per day, and must be in intervals of 15 minutes.

## Features
- Unlimited schedule timeslots with 1 minute increments
- Save & choose from multiple schedules
- Import & export saved schedules
- Choose to follow the set schedule, temporarily hold a temperature, or hold permanently
- [Hysteresis (AKA deadband)](#what-is-hysteresis) - Adds optional temerature tolerance to reduce frequent on/off cycles.

## Getting Started

### Install Requirements
```bash
pip install -r requirements.txt
```

### Update Environment Variables
Update the `.env` file with the credentials you use for your Honeywell app or their web portal at [mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/).

### Run the Application
Run `pyhtcc_web.py`, then open a browser window to `localhost:5001`. To load sample schedules click `Import Schedules` and select the `sample-schedules.json` file in project directory.

## What is Hysteresis?
<a href="https://search.brave.com/search?q=hvac+deadband+hysteresis&source=web&summary=1&summary_og=391a2b9ee4a6faf7cb0377">Hysteresis (AKA deadband)</a> is the amount of degrees away from the setpoint allowed between active & rest cycles.

Active Hysteresis is the amount of degrees beyond setpoint system run to before switching to rest. A clearer term for this might be "Run Cycle Tolerance"

Passive Hysteresis is the amount of degrees beyond setpoint system rests before switching on again. A clearer term for this might be "Rest Cycle Tolerance"

- Optional fields: leave blank or `0` for default behavior.
- Useful to reduce frequent on/off cycles, especially when the output of the unit is high relative to the space controlled.

Typical hysteresis doesn't differentiate between active & passive, splitting the hysteresis setting evenly in both directions of setpoint. (Setting the same value for active & passive will give this result.)

### State Transitions
The transitions in the `hysteresis` function are based on updates received from the thermostat of current temp and running status, and whether reaching or departing from the temp limit ranges based on heat/cool mode, and rest/running state.

Example: An Active Hysteresis at 1 and Passive Hysteresis at 2, in cool mode, set at 72 degrees, will cool until 71, then enter rest until 74.

In heat mode this same setting will heat until 73, then enter rest until 70.
