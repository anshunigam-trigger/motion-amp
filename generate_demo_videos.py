import cv2
import numpy as np
import os
import math
import imageio

os.makedirs("test_clips", exist_ok=True)

def generate_vibrating_circle(filename, fps=30, duration=3, freq_hz=15.0, amplitude_pixels=0.5):
    """
    Generates a video of a circle vibrating at a specific frequency.
    Amplitude is intentionally very small (sub-pixel possible using anti-aliasing/sub-pixel rendering,
    but here we'll just use a small pixel shift which cv2 handles gracefully with anti-aliasing).
    """
    width, height = 400, 400
    writer = imageio.get_writer(f"test_clips/{filename}", fps=fps, codec='libx264', macro_block_size=None)
    
    total_frames = int(fps * duration)
    
    for t in range(total_frames):
        time_sec = t / fps
        # Calculate subtle shift
        shift_x = amplitude_pixels * math.sin(2 * math.pi * freq_hz * time_sec)
        
        # Create a white background
        frame = np.ones((height, width, 3), dtype=np.uint8) * 240
        
        # Draw some grid lines for reference (static)
        for i in range(0, width, 50):
            cv2.line(frame, (i, 0), (i, height), (200, 200, 200), 1)
            cv2.line(frame, (0, i), (width, i), (200, 200, 200), 1)
        
        # Draw the vibrating object
        center_x = int(width / 2 + shift_x)
        center_y = int(height / 2)
        
        # Draw a dark circle
        cv2.circle(frame, (center_x, center_y), 50, (30, 40, 100), -1, lineType=cv2.LINE_AA)
        # Draw a small contrasting dot in the center to give high frequency edges for EVM
        cv2.circle(frame, (center_x, center_y), 10, (200, 100, 50), -1, lineType=cv2.LINE_AA)
        
        writer.append_data(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
    writer.close()
    print(f"Generated test_clips/{filename} (Freq: {freq_hz}Hz, Amp: {amplitude_pixels}px)")

def generate_industrial_motor(filename, fps=60, duration=4, freq_hz=20.0, amplitude_pixels=0.4):
    """
    Generates a realistic "industrial motor" test video. The block is textured with noise
    and high-contrast vents. It vibrates vertically with an almost invisible amplitude.
    The texture helps the phase-based EVM algorithm latch onto the motion perfectly.
    """
    width, height = 800, 600
    writer = imageio.get_writer(f"test_clips/{filename}", fps=fps, codec='libx264', macro_block_size=None)
    
    total_frames = int(fps * duration)
    
    # Pre-generate a static textured block to move around
    block_w, block_h = 400, 300
    motor_block = np.ones((block_h, block_w, 3), dtype=np.uint8) * 120
    # Add noise for texture (EVM loves texture)
    noise = np.random.randint(-20, 20, (block_h, block_w, 3), dtype=np.int16)
    motor_block = np.clip(motor_block + noise, 0, 255).astype(np.uint8)
    
    # Draw dark vents on the motor
    for y in range(40, block_h - 40, 30):
        cv2.rectangle(motor_block, (50, y), (block_w - 50, y + 15), (30, 30, 30), -1)
        
    # Draw a "warning" label (high contrast orange)
    cv2.rectangle(motor_block, (block_w - 150, 40), (block_w - 50, 100), (0, 100, 255), -1)
    
    for t in range(total_frames):
        time_sec = t / fps
        shift_y = amplitude_pixels * math.sin(2 * math.pi * freq_hz * time_sec)
        
        # Background: static factory wall (light gray)
        frame = np.ones((height, width, 3), dtype=np.uint8) * 200
        # Draw some static pipes in background
        cv2.rectangle(frame, (100, 0), (140, height), (150, 150, 150), -1)
        cv2.rectangle(frame, (0, 200), (width, 220), (130, 130, 130), -1)
        
        # Composite the motor block onto the frame with the sub-pixel shift
        # For sub-pixel rendering in a simple way, we round the shift, but since amplitude is < 1,
        # we can simulate sub-pixel blending, OR we just use OpenCV's warpAffine.
        # warpAffine is perfect for sub-pixel shifting!
        
        # Create a blank canvas for the motor
        motor_canvas = np.zeros((height, width, 3), dtype=np.uint8)
        # Place motor in center
        start_x = (width - block_w) // 2
        start_y = (height - block_h) // 2
        motor_canvas[start_y:start_y+block_h, start_x:start_x+block_w] = motor_block
        
        # Shift the canvas via warpAffine to get true sub-pixel vibration
        M = np.float32([[1, 0, 0], [0, 1, shift_y]])
        shifted_motor = cv2.warpAffine(motor_canvas, M, (width, height), flags=cv2.INTER_LINEAR)
        
        # Create a mask to blend the shifted motor over the background
        gray_shifted = cv2.cvtColor(shifted_motor, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray_shifted, 1, 255, cv2.THRESH_BINARY)
        mask_inv = cv2.bitwise_not(mask)
        
        bg = cv2.bitwise_and(frame, frame, mask=mask_inv)
        frame = cv2.add(bg, shifted_motor)
        
        writer.append_data(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
    writer.close()
    print(f"Generated test_clips/{filename} (Freq: {freq_hz}Hz, Amp: {amplitude_pixels}px)")


def generate_static_scene(filename, fps=30, duration=3):
    """Generates a perfectly static scene to test the 'No Vibration Detected' logic."""
    width, height = 640, 480
    writer = imageio.get_writer(f"test_clips/{filename}", fps=fps, codec='libx264', macro_block_size=None)
    
    # Static textured background
    frame = np.ones((height, width, 3), dtype=np.uint8) * 150
    noise = np.random.randint(-15, 15, (height, width, 3), dtype=np.int16)
    frame = np.clip(frame + noise, 0, 255).astype(np.uint8)
    
    # Static red box in center
    cv2.rectangle(frame, (250, 150), (390, 330), (50, 50, 200), -1)
    # Add an X
    cv2.line(frame, (250, 150), (390, 330), (200, 200, 255), 3)
    cv2.line(frame, (390, 150), (250, 330), (200, 200, 255), 3)

    for t in range(int(fps * duration)):
        writer.append_data(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
    writer.close()
    print(f"Generated test_clips/{filename} (Perfectly Static)")


def generate_camera_shake(filename, fps=30, duration=4):
    """Generates a scene with random camera shake (broad-spectrum noise, no dominant peak)."""
    width, height = 640, 480
    writer = imageio.get_writer(f"test_clips/{filename}", fps=fps, codec='libx264', macro_block_size=None)
    
    # Base canvas larger than frame to allow shifting
    canvas_w, canvas_h = width + 40, height + 40
    canvas = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 200
    
    # Draw a scene on the canvas
    cv2.rectangle(canvas, (100, 100), (300, 400), (100, 150, 100), -1)
    cv2.circle(canvas, (400, 250), 80, (50, 50, 150), -1, lineType=cv2.LINE_AA)
    
    # Add random texture dots
    for _ in range(500):
        x, y = np.random.randint(0, canvas_w), np.random.randint(0, canvas_h)
        cv2.circle(canvas, (x, y), 2, (30, 30, 30), -1)

    for t in range(int(fps * duration)):
        # Random translational shake (1 to 3 pixels)
        shake_x = np.random.randint(-3, 4)
        shake_y = np.random.randint(-3, 4)
        
        # Crop the frame from the shifted canvas
        start_x = 20 + shake_x
        start_y = 20 + shake_y
        frame = canvas[start_y:start_y+height, start_x:start_x+width]
        
        writer.append_data(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
    writer.close()
    print(f"Generated test_clips/{filename} (Random Camera Shake)")


def generate_multi_frequency(filename, fps=60, duration=4):
    """Generates two objects vibrating at entirely different frequencies (5Hz and 25Hz)."""
    width, height = 800, 400
    writer = imageio.get_writer(f"test_clips/{filename}", fps=fps, codec='libx264', macro_block_size=None)
    
    for t in range(int(fps * duration)):
        time_sec = t / fps
        
        # Object 1: Low frequency, high amplitude (5Hz)
        shift_1 = 1.5 * math.sin(2 * math.pi * 5.0 * time_sec)
        
        # Object 2: High frequency, sub-pixel amplitude (25Hz)
        shift_2 = 0.4 * math.sin(2 * math.pi * 25.0 * time_sec)
        
        frame = np.ones((height, width, 3), dtype=np.uint8) * 220
        
        # Object 1 Block (Left)
        c1_x, c1_y = 200 + int(shift_1 * 5), 200
        cv2.rectangle(frame, (c1_x - 80, c1_y - 80), (c1_x + 80, c1_y + 80), (180, 80, 80), -1)
        cv2.putText(frame, "5 Hz", (c1_x - 30, c1_y + 10), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Object 2 Canvas (Right)
        motor_block = np.ones((160, 160, 3), dtype=np.uint8) * 100
        cv2.putText(motor_block, "25 Hz", (35, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        motor_canvas = np.zeros((height, width, 3), dtype=np.uint8)
        motor_canvas[120:280, 520:680] = motor_block
        
        # Subpixel shift for Object 2
        M = np.float32([[1, 0, 0], [0, 1, shift_2]])
        shifted_motor = cv2.warpAffine(motor_canvas, M, (width, height), flags=cv2.INTER_LINEAR)
        
        gray_shifted = cv2.cvtColor(shifted_motor, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray_shifted, 1, 255, cv2.THRESH_BINARY)
        mask_inv = cv2.bitwise_not(mask)
        bg = cv2.bitwise_and(frame, frame, mask=mask_inv)
        frame = cv2.add(bg, shifted_motor)
        
        writer.append_data(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
    writer.close()
    print(f"Generated test_clips/{filename} (Multi-frequency: 5Hz & 25Hz)")


if __name__ == '__main__':
    generate_industrial_motor("demo_industrial_motor_20hz.mp4", fps=60, duration=4, freq_hz=20.0, amplitude_pixels=0.3)
    generate_industrial_motor("demo_engine_idle_12hz.mp4", fps=30, duration=5, freq_hz=12.0, amplitude_pixels=0.6)
    
    # Edge Cases for Demo
    generate_static_scene("demo_edgecase_no_vibration.mp4", fps=30, duration=3)
    generate_camera_shake("demo_edgecase_camera_shake.mp4", fps=30, duration=4)
    generate_multi_frequency("demo_feature_multi_frequency.mp4", fps=60, duration=4)
