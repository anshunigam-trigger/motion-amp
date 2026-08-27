import sys
sys.path.insert(0, '.')
from app.io.video_io import read_video_frames
from app.analytics.vibration import analyze_vibration

for name in ['vibrating_panel', 'static_panel', 'camera_shake']:
    frames, fps = read_video_frames(f'../test_clips/{name}.mp4')
    result = analyze_vibration(frames, fps, low_hz=10, high_hz=20)
    print(f"\n--- {name} ---")
    print(result["metrics"])