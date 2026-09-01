import sys
import os
import numpy as np

# Add backend to path so we can import modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from app.io.video_io import read_video_frames
from app.analytics.vibration import analyze_vibration
import generate_test_clips

def run_test(name, frame_fn, expected_hz, expected_detect, roi=None):
    print(f"\n--- Running Test: {name} ---")
    frames = generate_test_clips.build_frames_array(frame_fn)
    
    # Run analysis
    res = analyze_vibration(frames, fps=generate_test_clips.FPS, roi=roi)
    
    detected = res["metrics"]["detected"]
    freq = res["metrics"]["dominant_frequency_hz"]
    conf = res["metrics"]["confidence"]
    amp = res["metrics"]["peak_amplitude"]
    
    print(f"Detected: {detected} (Expected: {expected_detect})")
    print(f"Dominant Freq: {freq:.2f} Hz (Expected: {expected_hz:.2f} Hz)")
    print(f"Confidence: {conf}%")
    print(f"Amplitude: {amp:.4f} px")
    
    if "error" in res:
        print(f"Error Message: {res['error']}")
        
    # Validation
    if detected != expected_detect:
        print(">>> FAILED: Detection mismatch")
    elif expected_detect and abs(freq - expected_hz) > 1.0:
        print(f">>> FAILED: Frequency mismatch ({freq} vs {expected_hz})")
    else:
        print(">>> PASSED")

def run_mp4_test(name, path, expected_hz, expected_detect, roi=None):
    print(f"\n--- Running MP4 Test: {name} ---")
    if not os.path.exists(path):
        print(f">>> SKIP: File not found: {path}")
        return
        
    frames, fps = read_video_frames(path)
    # Run analysis
    res = analyze_vibration(frames, fps=fps, roi=roi)
    
    detected = res["metrics"]["detected"]
    freq = res["metrics"]["dominant_frequency_hz"]
    conf = res["metrics"]["confidence"]
    amp = res["metrics"]["peak_amplitude"]
    
    print(f"Detected: {detected} (Expected: {expected_detect})")
    print(f"Dominant Freq: {freq:.2f} Hz (Expected: {expected_hz:.2f} Hz)")
    print(f"Confidence: {conf}%")
    print(f"Amplitude: {amp:.4f} px")
    
    if "error" in res:
        print(f"Error Message: {res['error']}")
        
    # Validation
    if detected != expected_detect:
        print(">>> FAILED: Detection mismatch")
    elif expected_detect and abs(freq - expected_hz) > 1.0:
        print(f">>> FAILED: Frequency mismatch ({freq} vs {expected_hz})")
    else:
        print(">>> PASSED")

if __name__ == "__main__":
    np.random.seed(0)
    print("Testing synthetic clips...")
    
    # 1. Clear vibration (True Positive)
    run_test(
        "Vibrating Panel (15 Hz)",
        generate_test_clips.vibrating_clip(freq_hz=15.0, amplitude_px=0.5, noise_std=1.0),
        expected_hz=15.0,
        expected_detect=True,
        roi=(135, 40, 50, 160)
    )
    
    # 2. Static noise (False Positive handling)
    run_test(
        "Static Panel (Noise Only)",
        generate_test_clips.static_clip(noise_std=2.0),
        expected_hz=0.0,
        expected_detect=False
    )
    
    # 3. Camera Shake (False Positive handling)
    run_test(
        "Camera Shake",
        generate_test_clips.camera_shake_clip(shake_px=3.0, noise_std=1.0),
        expected_hz=0.0,
        expected_detect=False
    )
    
    print("\n\nTesting MP4 Demo Clips...")
    run_mp4_test(
        "Industrial Motor (20 Hz)",
        "demo_industrial_motor_20hz.mp4",
        expected_hz=20.0,
        expected_detect=True,
        roi=(200, 150, 400, 300) # Centered motor block
    )
    
    run_mp4_test(
        "Engine Idle (12 Hz)",
        "demo_engine_idle_12hz.mp4",
        expected_hz=12.0,
        expected_detect=True,
        roi=(200, 150, 400, 300)
    )
    
    run_mp4_test(
        "Edge Case: No Vibration",
        "demo_edgecase_no_vibration.mp4",
        expected_hz=0.0,
        expected_detect=False
    )
    
    run_mp4_test(
        "Edge Case: Camera Shake",
        "demo_edgecase_camera_shake.mp4",
        expected_hz=0.0,
        expected_detect=False
    )

