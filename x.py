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

airflow_reading = threading.Event()
load_dotenv()
username = os.getenv('PYHTCC_EMAIL')
password = os.getenv('PYHTCC_PASS')
p = PyHTCC(username, password)
zones_info = p.get_zones_info()
zi = zones_info[0]
z = p.get_zone_by_name(zi['Name'])
thermostat = {'temp': None, 'setpoint': None, 'mode': None, 'running': None, 'fan_mode': None}
thermostat_state = None
running = None
airflow = None
RUN_SETPOINT = 64.0
REST_SETPOINT = 85.0
REST_PAUSE_BEGIN = 81.0
REST_PAUSE_END = REST_PAUSE_BEGIN - 2.0
run_time = 0.0
rest_time = 0.0
max_run = 420
max_rest = 369
control_mode = 'unknown'
rest_until = None

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

def read_thermostat():
    global thermostat, thermostat_state, running, max_run, max_rest
    z.refresh_zone_info()
    zi = z.zone_info
    temp = zi['DispTemp']
    fan_mode = 'on' if zi["latestData"]["fanData"]["fanMode"] > 0 else 'auto'
    running = zi["latestData"]["uiData"]["EquipmentOutputStatus"] > 0
    system_mode = zi['latestData']['uiData']['SystemSwitchPosition']
    mode = 'heat' if system_mode == 1 else 'cool' if system_mode == 3 else 'off'
    heat_setpoint = zi['latestData']['uiData']['HeatSetpoint']
    cool_setpoint = zi['latestData']['uiData']['CoolSetpoint']
    setpoint = heat_setpoint if system_mode == 1 else cool_setpoint if system_mode == 3 else None
    new_state = {'temp': temp, 'setpoint': setpoint, 'mode': mode, 'running': running, 'fan_mode': fan_mode}
    changed_vars = [k for k in new_state if thermostat.get(k) != new_state[k]]
    if changed_vars:
        changes = ', '.join(f"{k}: {new_state[k]}" for k in changed_vars)
        print(f"{time.strftime('%H:%M:%S')} {changes}")
        if any(k in ['mode', 'setpoint', 'fan_mode'] for k in changed_vars):
            thermostat_state = {k: new_state[k] for k in ['setpoint', 'mode', 'fan_mode']}
    thermostat.update(new_state)
    max_run = get_max_run_time()
    max_rest = get_max_rest_time()
    return thermostat

def set_thermostat(new_setpoint=None, new_mode=None, new_fan_mode=None):
    global thermostat_state
    update_needed = False
    # If no new value given, stick with current value
    if new_mode is None:
        new_mode = thermostat['mode']
    if new_setpoint is None:
        new_setpoint = thermostat['setpoint']
    if new_fan_mode is None:
        new_fan_mode = thermostat['fan_mode']

    if (
        (new_mode != thermostat['mode']) or
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
            thermostat_state = {'setpoint': new_setpoint, 'mode': new_mode, 'fan_mode': new_fan_mode}
            print(f"{time.strftime('%H:%M:%S')} Set thermostat: {thermostat_state}")
            return True, None
        except Exception as e:
            print(f"{time.strftime('%H:%M:%S')} Error: {e}")
            return False, str(e)
    return True, None

def airflow_monitor():
    global airflow, airflow_reading, run_time, rest_time, running
    p_audio = pyaudio.PyAudio()
    run_time = 0.0
    rest_time = 0.0
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
        print(f"{time.strftime('%H:%M:%S')} Airflow {airflow}")
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
                        print(f"{time.strftime('%H:%M:%S')} Airflow {airflow}")
                        if running and not airflow:
                            print(f"{time.strftime('%H:%M:%S')} Airflow lost during RUN, switching to REST mode")
                            # Set this here instead of waiting for main_loop, to avoid equipment damage
                            set_thermostat(REST_SETPOINT, thermostat['mode'], thermostat['fan_mode'])
                            global control_mode, rest_until
                            control_mode = 'automation_rest'
                            rest_until = datetime.datetime.now() + datetime.timedelta(seconds=max_rest)
                # Update run_time/rest_time
                if running:
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

def get_max_rest_time(temp=None):
    if temp is None:
        temp = thermostat['temp']
    if temp is None:
        return 300
    if temp >= 73:
        return 300
    if temp <= 68:
        return 720
    return min(720, 253.23 * math.exp(0.301 * (73 - temp)))

def get_max_run_time(temp=None):
    if temp is None:
        temp = thermostat['temp']
    if temp is None:
        return 420
    if temp >= 80:
        return 420
    if temp <= 70:
        return 900
    return min(900, 385.95 * math.exp(0.09963 * (80 - temp)))
    
def load_schedule():
    sched = pd.read_csv('sched.csv', dtype={'setpoint': str, 'mode': str, 'fan_mode': str})
    sched['time'] = pd.to_datetime(sched['time'], format='%H:%M').dt.time

    # Clean string columns safely (only non-nan are stripped)
    for col in ['setpoint', 'mode', 'fan_mode']:
        sched[col] = sched[col].fillna('').astype(str).str.strip().str.lower()

    # Find the last non-empty setpoint string to use as default for circular fill
    setpoints = sched['setpoint'].tolist()
    valid = [sp for sp in setpoints if sp and sp not in ('', 'nan', 'none')]
    default = valid[-1] if valid else None

    last = default
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
    global control_mode, rest_until
    sched = load_schedule()
    last_schedule_time = None
    last_logged_schedule = None

    while True:
        now_dt = datetime.datetime.now()
        now = now_dt.time()
        read_thermostat()
        if sched.empty:
            print(f"{time.strftime('%H:%M:%S')} Schedule is empty, skipping update.")
            time.sleep(50)
            continue

        row = get_current_schedule_entry(sched, now)
        schedule_time = row['time']
        sched_mode = row['mode'] if pd.notna(row['mode']) and row['mode'] not in ('', 'nan', 'none') else thermostat['mode']
        fan_mode = row['fan_mode'] if pd.notna(row['fan_mode']) and row['fan_mode'] not in ('', 'nan', 'none') else thermostat['fan_mode']
        scheduled_run_rest = row['setpoint_filled'] if row['setpoint_filled'] != '' else None

        current_schedule = (schedule_time, scheduled_run_rest, sched_mode, fan_mode)
        if current_schedule != last_logged_schedule:
            print(f"{time.strftime('%H:%M:%S')} Schedule: time={schedule_time}, setpoint={scheduled_run_rest}, mode={sched_mode}, fan_mode={fan_mode}")
            last_logged_schedule = current_schedule

        # Detect schedule time changes and reset any auto-rest overrides accordingly
        if last_schedule_time != schedule_time:
            rest_until = None
            if scheduled_run_rest == 'rest':
                control_mode = 'scheduled_rest'
            elif scheduled_run_rest == 'run':
                control_mode = 'scheduled_run'
            else:
                control_mode = 'unknown'
            last_schedule_time = schedule_time

        # --- Begin REST handling with rest pause ---
        if scheduled_run_rest == 'rest':
            # REST PAUSE logic: can temporarily run if temp >= REST_PAUSE_BEGIN,
            # fan_mode forced to 'on', airflow confirmed true
            if control_mode == 'scheduled_rest':
                if thermostat['temp'] is not None and thermostat['temp'] >= REST_PAUSE_BEGIN:
                    if thermostat['fan_mode'] != 'on':
                        # First set fan mode ON but keep REST setpoint
                        print(f"{time.strftime('%H:%M:%S')} REST_PAUSE triggered: temp >= REST_PAUSE_BEGIN ({thermostat['temp']}°F). Setting fan_mode ON.")
                        set_thermostat(REST_SETPOINT, sched_mode, 'on')
                    elif airflow:
                        # Fan on and airflow confirmed, now switch to run mode temporarily
                        print(f"{time.strftime('%H:%M:%S')} REST_PAUSE: fan_mode ON & airflow OK, entering rest_pause_run mode (RUN until temp <= {REST_PAUSE_END})")
                        set_thermostat(RUN_SETPOINT, sched_mode, 'on')
                        control_mode = 'rest_pause_run'
                # Enforce scheduled rest parameters if not in rest_pause_run
                if control_mode == 'scheduled_rest':
                    # If REST_PAUSE is active (temp high but haven't switched to run), keep fan_mode ON
                    desired_fan_mode = fan_mode
                    if thermostat['temp'] is not None and thermostat['temp'] >= REST_PAUSE_BEGIN and thermostat['fan_mode'] == 'on':
                        # Keep fan_mode ON during REST_PAUSE pre-run phase, don't reset to schedule fan_mode ('auto')
                        desired_fan_mode = 'on'  

                    if thermostat_state is None or thermostat_state['setpoint'] != REST_SETPOINT or thermostat_state['mode'] != sched_mode or thermostat_state['fan_mode'] != desired_fan_mode:
                        print(f"{time.strftime('%H:%M:%S')} Enforcing scheduled REST_SETPOINT and mode/fan_mode")
                        set_thermostat(REST_SETPOINT, sched_mode, desired_fan_mode)

                rest_until = None

            # Handle the temporary run mode during REST due to rest pause
            elif control_mode == 'rest_pause_run':
                # Stay in run mode unless temp drops to <= REST_PAUSE_END
                if thermostat['temp'] is not None and thermostat['temp'] <= REST_PAUSE_END:
                    print(f"{time.strftime('%H:%M:%S')} REST_PAUSE ending: temp <= REST_PAUSE_END ({thermostat['temp']}°F). Returning to scheduled_rest mode")
                    set_thermostat(REST_SETPOINT, sched_mode, 'auto')  # Fan back to scheduled mode, usually 'auto'
                    control_mode = 'scheduled_rest'
                else:
                    # Keep running; optionally reapply RUN setpoint if needed
                    if thermostat_state is None or thermostat_state['setpoint'] != RUN_SETPOINT or thermostat_state['mode'] != sched_mode or thermostat_state['fan_mode'] != 'on':
                        print(f"{time.strftime('%H:%M:%S')} REST_PAUSE running: enforcing RUN_SETPOINT and fan_mode ON")
                        set_thermostat(RUN_SETPOINT, sched_mode, 'on')

        # --- End REST handling ---

        # Scheduled RUN handling (unchanged) ...
        elif scheduled_run_rest == 'run':
            # your existing automation REST/run logic
            # (for brevity not repeated here, presumably your existing code)

            # Example (partial):
            if (airflow is False or run_time >= max_run):
                if control_mode != 'automation_rest':
                    print(f"{time.strftime('%H:%M:%S')} Entering AUTOMATION REST for up to {max_rest} seconds")
                    set_thermostat(REST_SETPOINT, sched_mode, fan_mode)
                    control_mode = 'automation_rest'
                    rest_until = now_dt + datetime.timedelta(seconds=max_rest)
            elif control_mode == 'automation_rest':
                # Exit automation rest if conditions met
                if (rest_time >= max_rest and airflow) or (rest_until is not None and now_dt >= rest_until):
                    print(f"{time.strftime('%H:%M:%S')} Exiting AUTOMATION REST, resuming RUN_SETPOINT")
                    set_thermostat(RUN_SETPOINT, sched_mode, fan_mode)
                    control_mode = 'scheduled_run'
                    rest_until = None
                else:
                    # Keep enforcing REST setpoint during automation rest
                    if thermostat_state is None or thermostat_state['setpoint'] != REST_SETPOINT or thermostat_state['mode'] != sched_mode or thermostat_state['fan_mode'] != fan_mode:
                        print(f"{time.strftime('%H:%M:%S')} Maintaining AUTOMATION REST_SETPOINT and mode/fan_mode")
                        set_thermostat(REST_SETPOINT, sched_mode, fan_mode)

            else:
                # enforce RUN setpoint as usual
                if thermostat_state is None or thermostat_state['setpoint'] != RUN_SETPOINT or thermostat_state['mode'] != sched_mode or thermostat_state['fan_mode'] != fan_mode:
                    print(f"{time.strftime('%H:%M:%S')} Enforcing scheduled RUN_SETPOINT and mode/fan_mode")
                    set_thermostat(RUN_SETPOINT, sched_mode, fan_mode)
                control_mode = 'scheduled_run'
                rest_until = None

        # mode/fan_mode changes only when no scheduled setpoint
        elif scheduled_run_rest is None:
            current_setpoint = thermostat_state['setpoint'] if thermostat_state else thermostat['setpoint']
            mode_changed = sched_mode != (thermostat_state['mode'] if thermostat_state else None)
            fan_mode_changed = fan_mode != (thermostat_state['fan_mode'] if thermostat_state else None)
            if mode_changed or fan_mode_changed:
                print(f"{time.strftime('%H:%M:%S')} Updating mode/fan_mode only: mode={sched_mode}, fan_mode={fan_mode}")
                set_thermostat(current_setpoint, sched_mode, fan_mode)
            control_mode = 'scheduled_run'
            rest_until = None

        else:
            print(f"{time.strftime('%H:%M:%S')} Unknown schedule setpoint: {scheduled_run_rest}, doing nothing.")

        time.sleep(50)

# Start threads
threading.Thread(target=airflow_monitor, daemon=True).start()
time.sleep(20)  # Allow airflow monitor to start
if not airflow_reading.wait(timeout=20):
    print("Airflow detection did not start in time. Exiting.")
    exit(1)
if airflow is None:
    print("Airflow detection failed to initialize. Exiting.")
    exit(1)

threading.Thread(target=main_loop, daemon=True).start()
while True:
    time.sleep(3600)
