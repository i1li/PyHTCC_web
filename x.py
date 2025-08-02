# thermostat app that reads schedule from a CSV file and monitors airflow via a microphone in front of vent, in case of failing blower motor, to protect the HVAC system by automatically switching to rest mode.
from pyhtcc import PyHTCC
from dotenv import load_dotenv
import os
import time
import threading
import numpy as np
import pyaudio
from collections import deque
import pandas as pd
import datetime
import math
import traceback

thermostat = {'temp': None, 'setpoint': None, 'system_mode': None, 'running': None, 'fan_mode': None}
thermostat_state = None
running = None
airflow = None
RUN_SETPOINT = 64.0
REST_SETPOINT = 85.0
QUICK_RUN_BEGIN = 80.0
QUICK_RUN_END = QUICK_RUN_BEGIN - 2.0
run_time = 0.0
rest_time = 0.0
max_run = 420
max_rest = 369
control_mode = 'unknown'
prev_control_mode = None
rest_until = None

def get_time():
    return time.strftime('%H:%M:%S')

airflow_reading = threading.Event()
def airflow_monitor():
    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100
    FREQ_40HZ_RANGE = (30, 50)
    FREQ_80HZ_RANGE = (70, 90)
    FREQ_250HZ_RANGE = (240, 260)
    AMP_THRESHOLD_40HZ = 33000
    AMP_THRESHOLD_80HZ = 17000
    AMP_THRESHOLD_250HZ = 9000
    BUFFER_SIZE = 40
    DEFAULT_BUFFER_THRESHOLD = 0.85
    STRICT_BUFFER_THRESHOLD = 0.95
    HIGH_AMP_THRESHOLD = 160000
    HIGH_AMP_FREQ_MIN = 80
    HIGH_AMP_BUFFER_SIZE = 10
    HIGH_AMP_COUNT_THRESHOLD = 6
    SECONDS_PER_READING = 0.1
    global airflow, airflow_reading, run_time, rest_time, running
    p_audio = pyaudio.PyAudio()
    try:
        device_index = p_audio.get_default_input_device_info()['index']
        stream = p_audio.open(format=FORMAT, channels=CHANNELS, rate=RATE,
                              input=True, frames_per_buffer=CHUNK, input_device_index=device_index)
        status_buffer = deque(maxlen=BUFFER_SIZE)
        high_amp_buffer = deque(maxlen=HIGH_AMP_BUFFER_SIZE)
        freqs = np.fft.fftfreq(CHUNK, 1/RATE)[:CHUNK//2]
        low_freq_mask_40hz = (freqs >= FREQ_40HZ_RANGE[0]) & (freqs <= FREQ_40HZ_RANGE[1])
        low_freq_mask_80hz = (freqs >= FREQ_80HZ_RANGE[0]) & (freqs <= FREQ_80HZ_RANGE[1])
        low_freq_mask_250hz = (freqs >= FREQ_250HZ_RANGE[0]) & (freqs <= FREQ_250HZ_RANGE[1])
        high_freq_mask = freqs > HIGH_AMP_FREQ_MIN
        while len(status_buffer) < BUFFER_SIZE:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)
                audio_data = np.frombuffer(data, dtype=np.int16)
                fft_data = np.abs(np.fft.fft(audio_data))[:CHUNK//2] / 10
                detect_40hz = np.any(fft_data[low_freq_mask_40hz] > AMP_THRESHOLD_40HZ)
                detect_80hz = np.any(fft_data[low_freq_mask_80hz] > AMP_THRESHOLD_80HZ)
                detect_250hz = np.any(fft_data[low_freq_mask_250hz] > AMP_THRESHOLD_250HZ)
                high_amp = np.any(fft_data[high_freq_mask] > HIGH_AMP_THRESHOLD)
                high_amp_buffer.append(high_amp)
                status_buffer.append((detect_40hz, detect_80hz, detect_250hz))
                time.sleep(SECONDS_PER_READING)
            except IOError:
                time.sleep(0.5)
            except Exception:
                time.sleep(1)
        time.sleep(1)
        true_count = sum(1 for det_40, det_80, det_250 in status_buffer if det_40 or det_80 or det_250)
        buffer_threshold = STRICT_BUFFER_THRESHOLD if sum(high_amp_buffer) > HIGH_AMP_COUNT_THRESHOLD else DEFAULT_BUFFER_THRESHOLD
        airflow = true_count >= BUFFER_SIZE * buffer_threshold
        print(f"{get_time()} Airflow {airflow}")
        airflow_reading.set()
        while True:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)
                audio_data = np.frombuffer(data, dtype=np.int16)
                fft_data = np.abs(np.fft.fft(audio_data))[:CHUNK//2] / 10
                detect_40hz = np.any(fft_data[low_freq_mask_40hz] > AMP_THRESHOLD_40HZ)
                detect_80hz = np.any(fft_data[low_freq_mask_80hz] > AMP_THRESHOLD_80HZ)
                detect_250hz = np.any(fft_data[low_freq_mask_250hz] > AMP_THRESHOLD_250HZ)
                high_amp = np.any(fft_data[high_freq_mask] > HIGH_AMP_THRESHOLD)
                high_amp_buffer.append(high_amp)
                buffer_threshold = STRICT_BUFFER_THRESHOLD if sum(high_amp_buffer) > HIGH_AMP_COUNT_THRESHOLD else DEFAULT_BUFFER_THRESHOLD
                status_buffer.append((detect_40hz, detect_80hz, detect_250hz))
                # Update airflow state
                if len(status_buffer) == BUFFER_SIZE:
                    true_count = sum(1 for det_40, det_80, det_250 in status_buffer if det_40 or det_80 or det_250)
                    false_count_all = sum(1 for det_40, det_80, det_250 in status_buffer if not (det_40 or det_80 or det_250))
                    new_airflow = true_count >= BUFFER_SIZE * buffer_threshold if not airflow else not (false_count_all >= BUFFER_SIZE * buffer_threshold)
                    if new_airflow != airflow:
                        airflow = new_airflow
                        print(f"{get_time()} Airflow {airflow}")
                        if running and not airflow:
                            print(f"{get_time()} Airflow lost during RUN, switching to REST mode")
                            # Set this here instead of waiting for main_loop, to avoid equipment damage
                            set_thermostat(REST_SETPOINT, thermostat['system_mode'], thermostat['fan_mode'])
                            global control_mode, rest_until, prev_control_mode
                            prev_control_mode = control_mode
                            control_mode = 'automation_rest'
                            rest_until = datetime.datetime.now() + datetime.timedelta(seconds=max_rest)
                # Update run_time/rest_time
                if running and airflow:
                    run_time += SECONDS_PER_READING
                    rest_time = 0
                else:
                    rest_time += SECONDS_PER_READING
                    run_time = 0
                time.sleep(SECONDS_PER_READING)
            except IOError:
                time.sleep(0.5)
            except Exception:
                time.sleep(1)
    finally:
        stream.stop_stream()
        stream.close()
        p_audio.terminate()
threading.Thread(target=airflow_monitor, daemon=True).start()
time.sleep(20)  # Allow airflow monitor to start
if not airflow_reading.wait(timeout=20):
    print("Airflow detection did not start in time. Exiting.")
    exit(1)
if airflow is None:
    print("Airflow detection failed to initialize. Exiting.")
    exit(1)

load_dotenv()
username = os.getenv('PYHTCC_EMAIL')
password = os.getenv('PYHTCC_PASS')
p = PyHTCC(username, password)
zones_info = p.get_zones_info()
zi = zones_info[0]
z = p.get_zone_by_name(zi['Name'])

def read_thermostat():
    global thermostat, thermostat_state, running, max_run, max_rest
    z.refresh_zone_info()
    zi = z.zone_info
    temp = zi['DispTemp']
    fan_mode = 'on' if zi["latestData"]["fanData"]["fanMode"] > 0 else 'auto'
    running = zi["latestData"]["uiData"]["EquipmentOutputStatus"] > 0
    sys_mode = zi['latestData']['uiData']['SystemSwitchPosition']
    system_mode = 'heat' if sys_mode == 1 else 'cool' if sys_mode == 3 else 'off'
    heat_setpoint = zi['latestData']['uiData']['HeatSetpoint']
    cool_setpoint = zi['latestData']['uiData']['CoolSetpoint']
    setpoint = heat_setpoint if sys_mode == 1 else cool_setpoint if sys_mode == 3 else None
    new_state = {'temp': temp, 'setpoint': setpoint, 'system_mode': system_mode, 'running': running, 'fan_mode': fan_mode}
    changed_vars = [k for k in new_state if thermostat.get(k) != new_state[k]]
    if changed_vars:
        changes = ', '.join(f"{k}: {new_state[k]}" for k in changed_vars)
        print(f"{get_time()} {changes}")
        if any(k in ['system_mode', 'setpoint', 'fan_mode'] for k in changed_vars):
            thermostat_state = {k: new_state[k] for k in ['setpoint', 'system_mode', 'fan_mode']}
    thermostat.update(new_state)
    def get_max_rest(temp=thermostat['temp']):
        if temp is None or temp >= 73:
            return 300
        if temp <= 68:
            return 720
        return min(720, 253.23 * math.exp(0.301 * (73 - temp)))
    def get_max_run(temp=thermostat['temp']):
        if temp is None or temp >= 80:
            return 420
        if temp <= 70:
            return 900
        return min(900, 385.95 * math.exp(0.09963 * (80 - temp)))
    max_rest = get_max_rest()
    max_run = get_max_run()
    return thermostat

def set_thermostat(new_setpoint=None, new_mode=None, new_fan_mode=None):
    global thermostat_state
    update_needed = False
    # If no new value given, stick with current value
    if new_mode is None:
        new_mode = thermostat['system_mode']
    if new_setpoint is None:
        new_setpoint = thermostat['setpoint']
    if new_fan_mode is None:
        new_fan_mode = thermostat['fan_mode']

    if (
        (new_mode != thermostat['system_mode']) or
        (new_setpoint is not None and new_setpoint != thermostat['setpoint']) or
        (new_fan_mode != thermostat['fan_mode'])
    ):
        update_needed = True
    if update_needed:
        try:
            if new_mode == 'cool':
                z.set_permanent_cool_setpoint(new_setpoint)
            elif new_mode == 'heat':
                z.set_permanent_heat_setpoint(new_setpoint)
            if new_fan_mode == 'on':
                z.turn_fan_on()
            elif new_fan_mode == 'auto':
                z.turn_fan_auto()
            thermostat_state = {'setpoint': new_setpoint, 'system_mode': new_mode, 'fan_mode': new_fan_mode}
            print(f"{get_time()} Set thermostat: {thermostat_state}")
            return True, None
        except Exception as e:
            print(f"{get_time()} Error: {e}")
            return False, str(e)
    return True, None
    
def load_schedule():
    sched = pd.read_csv('sched.csv', dtype={'setpoint': str, 'system_mode': str, 'fan_mode': str})
    sched['time'] = pd.to_datetime(sched['time'], format='%H:%M').dt.time
    # Clean string columns safely (only non-nan are stripped)
    for col in ['setpoint', 'system_mode', 'fan_mode']:
        sched[col] = sched[col].fillna('').astype(str).str.strip().str.lower()
    # Find the last non-empty setpoint string to use as default for circular fill
    setpoints = sched['setpoint'].tolist()
    valid = [sp for sp in setpoints if sp and sp not in ('', 'nan', 'none')]
    last = valid[-1] if valid else None
    filled = []
    for s in setpoints:
        if s and s not in ('', 'nan', 'none'):
            last = s
        filled.append(last if last is not None else '')
    sched['setpoint_filled'] = filled
    return sched.sort_values('time')

def get_current_schedule_entry(sched, now):
    times = sched['time'].tolist()
    idx = len(times) - 1  # default: last row
    for i, t in enumerate(times):
        if now < t:
            idx = i - 1
            break
    return sched.iloc[idx % len(sched)]

def main_loop():
    global control_mode, rest_until, prev_control_mode
    sched = load_schedule()
    last_schedule_time = None
    last_logged_schedule = None
    while True:
        now_dt = datetime.datetime.now()
        now = now_dt.time()
        try:
            read_thermostat()
        except Exception as e:
            print(f"{get_time()} Error reading thermostat: {type(e).__name__}: {e}")
            traceback.print_exc()
            time.sleep(30)
            continue
        if sched.empty:
            print(f"{get_time()} Schedule is empty, skipping update.")
            time.sleep(50)
            continue
        row = get_current_schedule_entry(sched, now)
        schedule_time = row['time']
        system_mode = row['system_mode'] if pd.notna(row['system_mode']) and row['system_mode'] not in ('', 'nan', 'none') else thermostat['system_mode']
        fan_mode = row['fan_mode'] if pd.notna(row['fan_mode']) and row['fan_mode'] not in ('', 'nan', 'none') else thermostat['fan_mode']
        run_mode = row['setpoint_filled'] if row['setpoint_filled'] != '' else None
        current_schedule = (schedule_time, run_mode, system_mode, fan_mode)
        if current_schedule != last_logged_schedule:
            print(f"{get_time()} Schedule: time={schedule_time}, setpoint={run_mode}, system_mode={system_mode}, fan_mode={fan_mode}")
            last_logged_schedule = current_schedule
        # Always check if we must EXIT automation_rest, regardless of schedule
        if control_mode == 'automation_rest':
            # Exit automation_rest if airflow restored and either rest_time exceeds max_rest, or rest_until has passed
            if airflow and ((rest_time >= max_rest) or (now_dt >= rest_until and rest_until is not None)):
                print(f"{get_time()} Exiting automation_rest, resuming RUN_SETPOINT")
                if prev_control_mode == 'quick_run':
                    set_thermostat(RUN_SETPOINT, system_mode, 'on')
                    control_mode = 'quick_run'
                else:
                    set_thermostat(RUN_SETPOINT, system_mode, fan_mode)
                    control_mode = 'scheduled_run'
                    prev_control_mode = None
                    rest_until = None
                # Let the next loop pick up normal schedule logic
            else:
                # Maintain REST state during automation_rest
                if thermostat_state is None or thermostat_state['setpoint'] != REST_SETPOINT or thermostat_state['system_mode'] != system_mode or thermostat_state['fan_mode'] != fan_mode:
                    print(f"{get_time()} Maintaining automation_rest REST_SETPOINT and system_mode/fan_mode")
                    set_thermostat(REST_SETPOINT, system_mode, fan_mode)
                time.sleep(50)
                continue  # Ignore schedule during automation_rest
        # Detect schedule time changes and reset any auto-rest overrides accordingly
        if last_schedule_time != schedule_time:
            rest_until = None
            if run_mode == 'rest':
                control_mode = 'scheduled_rest'
            elif run_mode == 'run':
                control_mode = 'scheduled_run'
            else:
                control_mode = 'unknown'
            last_schedule_time = schedule_time
        ##### Scheduled REST block, with QUICK_RUN for efficient maintenance #####
        if run_mode == 'rest':
            # QUICK_RUN: if temp >= QUICK_RUN_BEGIN, force fan ON, require airflow, then switch to RUN_SETPOINT until temp <= QUICK_RUN_END
            if control_mode == 'scheduled_rest':
                if thermostat['temp'] is not None and thermostat['temp'] >= QUICK_RUN_BEGIN:
                    if thermostat['fan_mode'] != 'on':
                        print(f"{get_time()} QUICK_RUN triggered: temp >= QUICK_RUN_BEGIN ({thermostat['temp']}°F). Setting fan_mode ON.")
                        set_thermostat(REST_SETPOINT, system_mode, 'on')
                    elif airflow:
                        print(f"{get_time()} QUICK_RUN: fan_mode & airflow ON, entering quick_run mode (RUN until temp <= {QUICK_RUN_END})")
                        set_thermostat(RUN_SETPOINT, system_mode, 'on')
                        control_mode = 'quick_run'
                # Enforce scheduled rest params unless QUICK_RUN is active
                if control_mode == 'scheduled_rest':
                    # Don't overwrite fan on if we're in QUICK_RUN waiting for airflow confirmation
                    desired_fan_mode = fan_mode
                    if thermostat['temp'] is not None and thermostat['temp'] >= QUICK_RUN_BEGIN and thermostat['fan_mode'] == 'on':
                        desired_fan_mode = 'on'
                    if thermostat_state is None or thermostat_state['setpoint'] != REST_SETPOINT or \
                       thermostat_state['system_mode'] != system_mode or thermostat_state['fan_mode'] != desired_fan_mode:
                        print(f"{get_time()} Enforcing scheduled REST_SETPOINT and system_mode/fan_mode")
                        set_thermostat(REST_SETPOINT, system_mode, desired_fan_mode)
            # Maintain run mode for QUICK_RUN as long as temp > QUICK_RUN_END
            elif control_mode == 'quick_run':
                if thermostat['temp'] is not None and thermostat['temp'] <= QUICK_RUN_END:
                    print(f"{get_time()} QUICK_RUN ending: temp <= QUICK_RUN_END ({thermostat['temp']}°F). Returning to scheduled_rest mode")
                    set_thermostat(REST_SETPOINT, system_mode, 'auto')
                    control_mode = 'scheduled_rest'
                else:
                    if thermostat_state is None or thermostat_state['setpoint'] != RUN_SETPOINT or thermostat_state['system_mode'] != system_mode or thermostat_state['fan_mode'] != 'on':
                        print(f"{get_time()} QUICK_RUN running: enforcing RUN_SETPOINT and fan_mode ON")
                        set_thermostat(RUN_SETPOINT, system_mode, 'on')
            rest_until = None
        ##### Scheduled RUN, allow automation-imposed rest #####
        elif run_mode == 'run':
            if (airflow is False or run_time >= max_run):
                if control_mode != 'automation_rest':
                    print(f"{get_time()} Entering automation_rest for up to {max_rest} seconds")
                    set_thermostat(REST_SETPOINT, system_mode, fan_mode)
                    control_mode = 'automation_rest'
                    rest_until = now_dt + datetime.timedelta(seconds=max_rest)
            else:
                # Enforce RUN as usual if not resting
                if thermostat_state is None or thermostat_state['setpoint'] != RUN_SETPOINT or \
                   thermostat_state['system_mode'] != system_mode or thermostat_state['fan_mode'] != fan_mode:
                    print(f"{get_time()} Enforcing scheduled RUN_SETPOINT and system_mode/fan_mode")
                    set_thermostat(RUN_SETPOINT, system_mode, fan_mode)
                control_mode = 'scheduled_run'
                rest_until = None
        ##### system_mode and fan_mode change only #####
        elif run_mode is None:
            current_setpoint = thermostat_state['setpoint'] if thermostat_state else thermostat['setpoint']
            mode_changed = system_mode != (thermostat_state['system_mode'] if thermostat_state else None)
            fan_mode_changed = fan_mode != (thermostat_state['fan_mode'] if thermostat_state else None)
            if mode_changed or fan_mode_changed:
                print(f"{get_time()} Updating system_mode/fan_mode only: system_mode={system_mode}, fan_mode={fan_mode}")
                set_thermostat(current_setpoint, system_mode, fan_mode)
            control_mode = 'scheduled_run'
            rest_until = None
        else:
            print(f"{get_time()} Unknown schedule setpoint: {run_mode}, doing nothing.")
        time.sleep(50)
threading.Thread(target=main_loop, daemon=True).start()
while True:
    time.sleep(999)
