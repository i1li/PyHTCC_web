from pyhtcc import PyHTCC
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import os
import time
app = Flask(__name__, static_folder='static', static_url_path='/static')
load_dotenv()
username = os.getenv('PYHTCC_EMAIL')
password = os.getenv('PYHTCC_PASS')
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
        current_temp = zone_info['DispTemp']
        running = zone_info['IsFanRunning']
        system_mode = zone_info['latestData']['uiData']['SystemSwitchPosition']
        mode = 'heat' if system_mode == 1 else 'cool' if system_mode == 3 else 'off'
        heat_setpoint = zone_info['latestData']['uiData']['HeatSetpoint']
        cool_setpoint = zone_info['latestData']['uiData']['CoolSetpoint']
        setpoint = heat_setpoint if system_mode == 1 else cool_setpoint if system_mode == 3 else 'off'
        return current_temp, setpoint, mode, running
    return None, None, None, None
def set_thermostat(zone_name, setpoint, mode):
    try:
        zone = p.get_zone_by_name(zone_name)
        if mode == 'cool':
            zone.set_permanent_cool_setpoint(setpoint)
        elif mode == 'heat':
            zone.set_permanent_heat_setpoint(setpoint)
    except Exception as e:
        print(f"Error: {e}")
last_update = None
last_update_confirmation = None
@app.route('/get_status')
def get_status():
    global last_update, last_update_confirmation
    current_temp, setpoint, mode, running = read_thermostat(zone['Name'])
    status_data = {
        'current_temp': current_temp,
        'setpoint': setpoint,
        'mode': mode,
        'running': running
    }
    if last_update:
        time_since_update = time.time() - last_update['timestamp']
        if time_since_update < 300:
            if last_update['setpoint'] == setpoint and last_update['mode'] == mode:
                status_data['update_status'] = 'confirmed'
                if last_update_confirmation != last_update['timestamp']:
                    print(f"Update applied at {time.strftime('%H:%M:%S', time.localtime(last_update['timestamp']))}: mode={mode}, setpoint={setpoint}")
                    last_update_confirmation = last_update['timestamp']
            else:
                status_data['update_status'] = 'pending'
            status_data['last_update'] = last_update
        else:
            last_update = None
    return jsonify(status_data)
@app.route('/set_update', methods=['POST'])
def set_update():
    global last_update
    new_setpoint = float(request.form['setpoint'])
    new_mode = request.form['mode']
    current_temp, current_setpoint, current_mode, current_running = read_thermostat(zone['Name'])
    if new_mode != current_mode or new_setpoint != current_setpoint:
        try:
            set_thermostat(zone['Name'], new_setpoint, new_mode)
            last_update = {
                'setpoint': new_setpoint,
                'mode': new_mode,
                'timestamp': time.time()
            }
            print(f"Update requested: mode={new_mode}, setpoint={new_setpoint}")
            return jsonify(success=True, updated=True)
        except Exception as e:
            print(f"Error: {e}")
            return jsonify(success=False, error=str(e), updated=False), 500
    else:
        return jsonify(success=True, updated=False)
@app.route('/')
def index():
    return render_template('index.html')
if __name__ == '__main__':
    app.run(debug=True, port=5001)
