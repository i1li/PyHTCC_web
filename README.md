### PyHTCC_web
JavaScript thermostat with full scheduling and hysteresis customization. Uses jQuery & a minimal Flask server with [PyHTCC](https://github.com/csm10495/pyhtcc), (Python library for Honeywell TCC thermostats.) Can run browserless with jsdom.

Limitations Addressed: The Honeywell app only allows 1 saved schedule, 4 schedule timeslots per day, and scheduled changes must be in intervals of 15 minutes.

### Features
- Unlimited schedule timeslots with 1 minute increments
- Save & choose from multiple schedules
- Import & export saved schedules in JSON
- Choose to follow the set schedule, temporarily hold a temperature, or hold permanently
- [Hysteresis (AKA deadband)](#what-is-hysteresis) - Adds optional temperature tolerance to reduce frequent on/off cycles.

### Getting Started
Update the `.env` file with your login credentials you use for the Honeywell app or their web portal at [mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/). (Optionally set a value for `PORT` here too, or it will default to 5000.)

### Install Requirements & Run Flask Server:
(Requires Python installed on your system:)
```bash
pip install -r requirements.txt
py serv.py
```

With the Flask server running, open a browser window to `localhost:5001`. To load sample schedules click `Import Schedules` and select the `sample-schedules.json` file in project directory.

In this case, your browser runs the app, and sends the state back to the Flask server for persistence. Once you have saved your settings and schedule, you can run the app in a way that does not require a browser window:

### State Persistence & Running Without Browser or UI
Using Node.js and jsdom (which simulates a browser environment), you can continue thermostat management without a UI by running the `no-ui.js` file while the Flask server is running.

(Requires Node.js installed on your system:)
```bash
npm i jsdom dotenv
node no-ui.js
```

For state persistence both the browser version, and the "no UI" jsdom version, use a file created by the Flask server: `app_state.json`, saved in the project directory. When a custom `app_state.json` has not been saved yet, default app state is initialized from `default_app_state.json`, which also comes with sample schedules.

### External Changes
Changes made from outside this app, (from the official app, or buttons on the thermostat), are detected and run through the hysteresis function, then placed on temporary hold for an hour. After an hour from latest external change, scheduled settings resume.

### What is Hysteresis?
<a href="https://search.brave.com/search?q=hvac+deadband+hysteresis&source=web&summary=1&summary_og=391a2b9ee4a6faf7cb0377">Hysteresis (AKA deadband)</a> is the amount of degrees away from the setpoint allowed between active & rest cycles.

(these terms have different meanings across different engineering fields, the link above describes Hysteresis & Deadband specifically in HVAC)

- Useful to reduce frequent on/off cycles, especially when the output of the unit is high relative to the space controlled.
- Optional fields: leave blank or `0` for default behavior.

A more descriptive term I prefer to Hysteresis is Run/Rest Cycle Tolerance, since:

**Active Hysteresis (Run Cycle Tolerance)** is the amount of degrees tolerated beyond setpoint, which the system runs to before switching to rest.

**Passive Hysteresis (Rest Cycle Tolerance)** is the amount of degrees tolerated beyond setpoint, which system rests to before switching back to active/run cycle.

Typical or "neutral" hysteresis doesn't differentiate between active & passive, splitting the hysteresis setting evenly in both directions of setpoint.

**Hysteresis Example:**  With Temp set at 72 degrees, Active Hysteresis at 1, and Passive Hysteresis at 2:

- In cool mode, runs until 71, then rests until 74.

- In heat mode, runs until 73, then rests until 70.

Tracks multiple variables to switch between two different setpoints (active and rest), based on how long the system has been at edges of the range. Minimum and maximum times for running and resting states are also enforced.

Whether active or rest setpoints differ from "raw" user setpoint, depends on active & passive hysteresis values, & cool/heat mode. For more: [hysteresis.js](static/hysteresis.js)
