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
Update the `.env` file with your login credentials you use for the Honeywell app or their web portal at [mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/).

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
npm i jsdom
node no-ui.js
```

For state persistence both the browser version, and the "no UI" jsdom version, use a file created by the Flask server: `app_state.json`, saved in the project directory.

### What is Hysteresis?
<a href="https://search.brave.com/search?q=hvac+deadband+hysteresis&source=web&summary=1&summary_og=391a2b9ee4a6faf7cb0377">Hysteresis (AKA deadband)</a> is the amount of degrees away from the setpoint allowed between active & rest cycles.

(these terms have different meanings across different engineering fields, the link above describes Hysteresis & Deadband specifically in HVAC)

- Useful to reduce frequent on/off cycles, especially when the output of the unit is high relative to the space controlled.
- Optional fields: leave blank or `0` for default behavior.

Active Hysteresis is the amount of degrees beyond setpoint system runs to before switching to rest.
- (A clearer term might be "Run Cycle Tolerance")

Passive Hysteresis is the amount of degrees beyond setpoint system rests before switching on again.
- (A clearer term might be "Rest Cycle Tolerance")

Typical hysteresis doesn't differentiate between active & passive, splitting the hysteresis setting evenly in both directions of setpoint. (Setting the same value for active & passive will give this result.)

**Example:**  With Temp set at 72 degrees, Active Hysteresis at 1, and Passive Hysteresis at 2:

- In cool mode, runs until 71, then rests until 74.

- In heat mode, runs until 73, then rests until 70.

Switches between two different setpoints (active and rest), based on how long the system has been at edges of the range.

Whether active or rest setpoints differ from "raw" user setpoint, depends on active & passive hysteresis values, & cool/heat mode.

[hysteresis.js](https://github.com/i1li/PyHTCC_web/blob/main/static/hysteresis.js)

### External Changes

Changes made from outside this app, (from buttons on the thermostat, or the official app), are detected and run through the hysteresis function, then placed on temporary hold for an hour. After an hour from latest external change, scheduled settings resume.
