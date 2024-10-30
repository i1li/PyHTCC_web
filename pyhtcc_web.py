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
thermostat_status = {
    'current_temp': None,
    'setpoint': None,
    'mode': None,
    'running': None,
    'last_update': None,
    'update_status': None
}
@app.route('/get_status')
def get_status():
    global thermostat_status
    current_temp, setpoint, mode, running = read_thermostat(zone['Name'])
    thermostat_status.update({
        'current_temp': current_temp,
        'setpoint': setpoint,
        'mode': mode,
        'running': running
    })
    if thermostat_status['last_update']:
        time_since_update = time.time() - thermostat_status['last_update']['timestamp']
        if time_since_update < 300:
            if (thermostat_status['last_update']['setpoint'] == setpoint and 
                thermostat_status['last_update']['mode'] == mode):
                thermostat_status['update_status'] = 'confirmed'
                if thermostat_status.get('last_update_confirmation') != thermostat_status['last_update']['timestamp']:
                    print(f"Update confirmed at {time.strftime('%H:%M:%S', time.localtime(thermostat_status['last_update']['timestamp']))}: mode={mode}, setpoint={setpoint}")
                    thermostat_status['last_update_confirmation'] = thermostat_status['last_update']['timestamp']
            else:
                thermostat_status['update_status'] = 'pending'
        else:
            thermostat_status['last_update'] = None
            thermostat_status['update_status'] = None
    return jsonify(thermostat_status)
@app.route('/set_update', methods=['POST'])
def set_update():
    global thermostat_status
    new_setpoint = float(request.form['setpoint'])
    new_mode = request.form['mode']
    current_setpoint = thermostat_status['setpoint']
    current_mode = thermostat_status['mode']
    if new_mode != current_mode or new_setpoint != current_setpoint:
        try:
            set_thermostat(zone['Name'], new_setpoint, new_mode)
            thermostat_status['last_update'] = {
                'setpoint': new_setpoint,
                'mode': new_mode,
                'timestamp': time.time()
            }
            thermostat_status['update_status'] = 'pending'
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
