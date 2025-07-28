import pyaudio
import numpy as np
import matplotlib.pyplot as plt
import time
import argparse
from collections import deque

# Audio processing parameters
CHUNK = 1024  # Samples per frame
FORMAT = pyaudio.paInt16  # 16-bit audio
CHANNELS = 1  # Mono for headset mic
RATE = 44100  # Sample rate (Hz)
FREQ_RANGE = 2000  # Hz, max frequency to display
MAX_AMPLITUDE = 1e6 / 6  # Static y-axis max for plot (~166,667)
FREQ_40HZ_RANGE = (30, 50)  # Hz, for 40Hz ±10Hz
FREQ_80HZ_RANGE = (70, 90)  # Hz, for 80Hz ±10Hz
FREQ_250HZ_RANGE = (240, 260)  # Hz, for 250Hz ±10Hz
AMP_THRESHOLD_40HZ = 33000  # Amplitude threshold for 40Hz band
AMP_THRESHOLD_80HZ = 17000  # Amplitude threshold for 80Hz band
AMP_THRESHOLD_250HZ = 9000  # Amplitude threshold for 250Hz band
BUFFER_SIZE = 50  # Number of reports for buffered status
DEFAULT_BUFFER_THRESHOLD = 0.8  # Default 80% (40/50)
STRICT_BUFFER_THRESHOLD = 0.95  # Strict 95% (48/50)
HIGH_AMP_THRESHOLD = 160000  # Amplitude threshold for >80Hz
HIGH_AMP_FREQ_MIN = 80  # Hz, for high-amplitude check
HIGH_AMP_BUFFER_SIZE = 10  # Number of readings for high-amplitude check
HIGH_AMP_COUNT_THRESHOLD = 6  # More than 3 readings in last 10

def visualize_airflow(device_index=None, freq_40hz_range=FREQ_40HZ_RANGE, freq_80hz_range=FREQ_80HZ_RANGE, 
                      freq_250hz_range=FREQ_250HZ_RANGE, amp_threshold_40hz=AMP_THRESHOLD_40HZ, 
                      amp_threshold_80hz=AMP_THRESHOLD_80HZ, amp_threshold_250hz=AMP_THRESHOLD_250HZ, 
                      max_amplitude=MAX_AMPLITUDE, buffer_size=BUFFER_SIZE, 
                      default_buffer_threshold=DEFAULT_BUFFER_THRESHOLD, 
                      strict_buffer_threshold=STRICT_BUFFER_THRESHOLD):
    p_audio = pyaudio.PyAudio()
    try:
        # List available input devices
        print("Available audio input devices:")
        input_devices = []
        for i in range(p_audio.get_device_count()):
            dev = p_audio.get_device_info_by_index(i)
            if dev['maxInputChannels'] > 0:
                input_devices.append((i, dev['name']))
                print(f"Device {i}: {dev['name']}")
        
        # Select device
        if device_index is None:
            usb_names = ['usb', 'microphone']
            selected_device = next((dev for dev in input_devices if any(name.lower() in dev[1].lower() for name in usb_names)), None)
            if selected_device:
                device_index = selected_device[0]
            else:
                device_index = p_audio.get_default_input_device_info()['index']
        selected_device = next((dev for dev in input_devices if dev[0] == device_index), None)
        if selected_device:
            print(f"\nUsing device: {selected_device[1]} (index {device_index})")
        else:
            print(f"Error: Device index {device_index} not found.")
            return

        # Open audio stream
        stream = p_audio.open(format=FORMAT, channels=CHANNELS, rate=RATE,
                              input=True, frames_per_buffer=CHUNK, input_device_index=device_index)
        
        # Set up real-time plot
        plt.ion()
        fig, ax = plt.subplots(figsize=(10, 6))
        freqs = np.fft.fftfreq(CHUNK, 1/RATE)[:CHUNK//2]
        freq_mask = freqs <= FREQ_RANGE
        line, = ax.plot(freqs[freq_mask], np.zeros(sum(freq_mask)), 'b-')
        ax.axvspan(30, 50, color='green', alpha=0.2, label='40Hz Band (30-50Hz)')
        ax.axvspan(70, 90, color='blue', alpha=0.2, label='80Hz Band (70-90Hz)')
        ax.axvspan(240, 260, color='purple', alpha=0.2, label='250Hz Band (240-260Hz)')
        ax.axhline(amp_threshold_40hz, color='r', linestyle='--', label=f'40Hz Threshold ({amp_threshold_40hz:.0f})')
        ax.axhline(amp_threshold_80hz, color='orange', linestyle='--', label=f'80Hz Threshold ({amp_threshold_80hz:.0f})')
        ax.axhline(amp_threshold_250hz, color='green', linestyle='--', label=f'250Hz Threshold ({amp_threshold_250hz:.0f})')
        ax.axhline(HIGH_AMP_THRESHOLD, color='purple', linestyle=':', label=f'High-Amp Threshold ({HIGH_AMP_THRESHOLD:.0f})')
        ax.set_xlabel('Frequency (Hz)')
        ax.set_ylabel('Amplitude')
        ax.set_title('Real-Time Frequency Spectrum (Vent Sound)')
        ax.set_xlim(0, FREQ_RANGE)
        ax.set_ylim(0, max_amplitude)
        ax.grid(True)
        ax.legend()
        
        # Initialize buffers
        status_buffer = deque(maxlen=buffer_size)  # Stores tuples of (detect_40hz, detect_80hz, detect_250hz)
        high_amplitude_buffer = deque(maxlen=HIGH_AMP_BUFFER_SIZE)
        airflow_detected = False  # Initial state
        
        print(f"\nStarting airflow visualization. Press Ctrl+C to stop.")
        print(f"Initial settings: FREQ_40HZ_RANGE={freq_40hz_range}Hz, AMP_THRESHOLD_40HZ={amp_threshold_40hz:.0f}")
        print(f"                FREQ_80HZ_RANGE={freq_80hz_range}Hz, AMP_THRESHOLD_80HZ={amp_threshold_80hz:.0f}")
        print(f"                FREQ_250HZ_RANGE={freq_250hz_range}Hz, AMP_THRESHOLD_250HZ={amp_threshold_250hz:.0f}")
        print(f"                MAX_AMPLITUDE={max_amplitude:.0f}, BUFFER_SIZE={buffer_size}")
        print(f"                DEFAULT_BUFFER_THRESHOLD={default_buffer_threshold*100:.0f}% ({default_buffer_threshold*buffer_size:.0f}/{buffer_size})")
        print(f"                STRICT_BUFFER_THRESHOLD={strict_buffer_threshold*100:.0f}% ({strict_buffer_threshold*buffer_size:.0f}/{buffer_size})")
        print(f"Buffer threshold increases to {strict_buffer_threshold*100:.0f}% if >{HIGH_AMP_COUNT_THRESHOLD}/{HIGH_AMP_BUFFER_SIZE} recent readings have amplitude >{HIGH_AMP_THRESHOLD:.0f} above {HIGH_AMP_FREQ_MIN}Hz.")
        print(f"Airflow ON if ≥{default_buffer_threshold*buffer_size:.0f}/{buffer_size} reports have ≥1 band above threshold; OFF if ≥{default_buffer_threshold*buffer_size:.0f}/{buffer_size} reports have all bands below threshold.")
        print("To adjust, edit thresholds or ranges in the script or use --max-amplitude.")
        print("Run with vent on/off to calibrate. Watch plot for peaks at 30-50Hz (>{amp_threshold_40hz:.0f}), 70-90Hz (>{amp_threshold_80hz:.0f}), 240-260Hz (>{amp_threshold_250hz:.0f}).")
        print("Check microphone gain in Windows Sound Settings if peaks are missing.")

        while True:
            try:
                # Read audio data
                data = stream.read(CHUNK, exception_on_overflow=False)
                audio_data = np.frombuffer(data, dtype=np.int16)
                fft_data = np.abs(np.fft.fft(audio_data))[:CHUNK//2] / 10  # Moderate normalization
                low_freq_mask_40hz = (freqs >= freq_40hz_range[0]) & (freqs <= freq_40hz_range[1])
                low_freq_mask_80hz = (freqs >= freq_80hz_range[0]) & (freqs <= freq_80hz_range[1])
                low_freq_mask_250hz = (freqs >= freq_250hz_range[0]) & (freqs <= freq_250hz_range[1])
                high_freq_mask = freqs > HIGH_AMP_FREQ_MIN
                
                # Compute power and detection for each band
                power_40hz = np.sum(fft_data[low_freq_mask_40hz]**2) / CHUNK
                power_80hz = np.sum(fft_data[low_freq_mask_80hz]**2) / CHUNK
                power_250hz = np.sum(fft_data[low_freq_mask_250hz]**2) / CHUNK
                detect_40hz = np.any(fft_data[low_freq_mask_40hz] > amp_threshold_40hz)
                detect_80hz = np.any(fft_data[low_freq_mask_80hz] > amp_threshold_80hz)
                detect_250hz = np.any(fft_data[low_freq_mask_250hz] > amp_threshold_250hz)
                
                # Check for high-amplitude frequencies >80Hz
                high_amplitude_detected = np.any(fft_data[high_freq_mask] > HIGH_AMP_THRESHOLD)
                high_amplitude_buffer.append(high_amplitude_detected)
                
                # Set buffer threshold dynamically
                buffer_threshold = strict_buffer_threshold if sum(high_amplitude_buffer) > HIGH_AMP_COUNT_THRESHOLD else default_buffer_threshold
                
                # Update status buffer with individual band statuses
                status_buffer.append((detect_40hz, detect_80hz, detect_250hz))
                
                # Compute buffered status with hysteresis
                true_count = 0
                false_count_all = 0
                if len(status_buffer) == buffer_size:
                    true_count = sum(1 for det_40, det_80, det_250 in status_buffer if det_40 or det_80 or det_250)
                    false_count_all = sum(1 for det_40, det_80, det_250 in status_buffer if not (det_40 or det_80 or det_250))
                    if airflow_detected:
                        # Stay ON unless ≥buffer_threshold reports have all bands False
                        airflow_detected = not (false_count_all >= buffer_size * buffer_threshold)
                    else:
                        # Switch to ON if ≥buffer_threshold reports have ≥1 band True
                        airflow_detected = true_count >= buffer_size * buffer_threshold
                else:
                    airflow_detected = False  # Wait for buffer to fill
                
                # Update plot
                line.set_ydata(fft_data[freq_mask])
                plt.draw()
                plt.pause(0.01)
                
                # Log results
                print(f"[{time.strftime('%H:%M:%S')}] 40Hz: Power={power_40hz:.0f}, Airflow={'Yes' if detect_40hz else 'No'}")
                print(f"[{time.strftime('%H:%M:%S')}] 80Hz: Power={power_80hz:.0f}, Airflow={'Yes' if detect_80hz else 'No'}")
                print(f"[{time.strftime('%H:%M:%S')}] 250Hz: Power={power_250hz:.0f}, Airflow={'Yes' if detect_250hz else 'No'}")
                print(f"[{time.strftime('%H:%M:%S')}] Overall: Buffer True={true_count}/{len(status_buffer)}, "
                      f"False Count (all bands)={false_count_all}/{len(status_buffer)}, "
                      f"Buffer Threshold={buffer_threshold*100:.0f}% ({buffer_threshold*buffer_size:.0f}/{buffer_size}), "
                      f"High Amp >{HIGH_AMP_FREQ_MIN}Hz: {sum(high_amplitude_buffer)}/{len(high_amplitude_buffer)}, Airflow={'Yes' if airflow_detected else 'No'}\n")
                time.sleep(0.1)
            except IOError as e:
                print(f"Audio stream error: {e}. Retrying...")
                time.sleep(0.5)
    except Exception as e:
        print(f"Error in visualize_airflow: {e}")
    finally:
        stream.stop_stream()
        stream.close()
        p_audio.terminate()
        plt.close()
        print("Airflow visualization stopped.")

if __name__ == "__main__":
    print("Airflow Visualization Test App")
    print("Position microphone 1-2 inches from HVAC vent and run with vent on/off to calibrate thresholds.")
    parser = argparse.ArgumentParser()
    parser.add_argument("--device", type=int, default=None, help="Audio device index")
    parser.add_argument("--max-amplitude", type=float, default=MAX_AMPLITUDE, help="Max y-axis amplitude for plot")
    args = parser.parse_args()
    visualize_airflow(device_index=args.device, max_amplitude=args.max_amplitude)