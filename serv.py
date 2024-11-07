from pyhtcc import PyHTCC
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import os
import time
import json
app = Flask(__name__, static_folder='static', static_url_path='/static')
load_dotenv()
username = os.getenv('PYHTCC_EMAIL')
password = os.getenv('PYHTCC_PASS')
port = int(os.getenv('PORT', 5000))
print("Username:", username, "   Password set:", bool(password))
p = PyHTCC(username, password)
zones_info = p.get_zones_info()
print("Zones info:", zones_info)
if zones_info:
    zone = zones_info[0]
    print(f"Connected to zone: {zone['Name']}")
else:
    print("No zones found")
    exit(1)
def read_thermostat(zone_name):
    zones_info = p.get_zones_info()
    zone_info = next((z for z in zones_info if z['Name'] == zone_name), None)
    if zone_info:
        temp = zone_info['DispTemp']
        running = zone_info['IsFanRunning']
        system_mode = zone_info['latestData']['uiData']['SystemSwitchPosition']
        mode = 'heat' if system_mode == 1 else 'cool' if system_mode == 3 else 'off'
        heat_setpoint = zone_info['latestData']['uiData']['HeatSetpoint']
        cool_setpoint = zone_info['latestData']['uiData']['CoolSetpoint']
        setpoint = heat_setpoint if system_mode == 1 else cool_setpoint if system_mode == 3 else 'off'
        return temp, setpoint, mode, running
    return None, None, None, None
thermostat = {
    'temp': None,
    'setpoint': None,
    'mode': None,
    'running': None,
}
update_status = {
    'last_update': None,
    'update_status': None
}
@app.route('/read_thermostat')
def read_thermostat_route():
    global thermostat, update_status
    temp, setpoint, mode, running = read_thermostat(zone['Name'])
    thermostat.update({
        'temp': temp,
        'setpoint': setpoint,
        'mode': mode,
        'running': running
    })
    if update_status['last_update']:
        time_since_update = time.time() - update_status['last_update']['timestamp']
        if time_since_update < 300:
            if (update_status['last_update']['setpoint'] == setpoint and 
                update_status['last_update']['mode'] == mode):
                update_status['update_status'] = 'confirmed'
                if update_status.get('last_update_confirmation') != update_status['last_update']['timestamp']:
                    print(f"Update confirmed at {time.strftime('%H:%M:%S', time.localtime(update_status['last_update']['timestamp']))}: mode={mode}, setpoint={setpoint}")
                    update_status['last_update_confirmation'] = update_status['last_update']['timestamp']
            else:
                update_status['update_status'] = 'pending'
        else:
            update_status['last_update'] = None
            update_status['update_status'] = None
    return jsonify(thermostat)
def set_thermostat(zone_name, setpoint, mode):
    try:
        zone = p.get_zone_by_name(zone_name)
        if mode == 'cool':
            zone.set_permanent_cool_setpoint(setpoint)
        elif mode == 'heat':
            zone.set_permanent_heat_setpoint(setpoint)
    except Exception as e:
        print(f"Error: {e}")
@app.route('/set_thermostat', methods=['POST'])
def set_thermostat_route():
    global thermostat
    new_setpoint = float(request.form['setpoint'])
    new_mode = request.form['mode']
    current_setpoint = thermostat['setpoint']
    current_mode = thermostat['mode']
    if new_mode != current_mode or new_setpoint != current_setpoint:
        try:
            set_thermostat(zone['Name'], new_setpoint, new_mode)
            update_status['last_update'] = {
                'setpoint': new_setpoint,
                'mode': new_mode,
                'timestamp': time.time()
            }
            update_status['update_status'] = 'pending'
            print(f"Update sent mode={new_mode}, setpoint={new_setpoint}")
            return jsonify(success=True, updated=True)
        except Exception as e:
            print(f"Error: {e}")
            return jsonify(success=False, error=str(e), updated=False), 500
    else:
        return jsonify(success=True, updated=False)
app_state = {}
@app.route('/app_state', methods=['GET', 'POST'])
def handle_app_state():
    global app_state
    if request.method == 'GET':
        return jsonify(app_state)
    elif request.method == 'POST':
        new_app_state = request.json
        app_state.update(new_app_state)
        save_app_state()
        return jsonify(success=True)
def save_app_state():
    with open('app_state.json', 'w') as f:
        json.dump(app_state, f)
def load_app_state():
    global app_state
    try:
        with open('app_state.json', 'r') as f:
            app_state = json.load(f)
    except FileNotFoundError:
        app_state = {}
@app.route('/')
def index():
    return render_template('index.html')
if __name__ == '__main__':
    load_app_state()
    app.run(debug=False, port=port)
