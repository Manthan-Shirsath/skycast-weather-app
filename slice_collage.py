import cv2
import numpy as np
import os
import sys

def extract_backgrounds(image_path, output_dir):
    print(f"Reading {image_path}...")
    img = cv2.imread(image_path)
    if img is None:
        print("Failed to read image")
        sys.exit(1)
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # The background of the collage is very light (almost white). 
    # Let's threshold it to find the dark image rectangles.
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    
    # The labels "Morning", "Afternoon", etc. are white on light gray, 
    # but the images themselves are mostly non-white.
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    rects = []
    min_area = (img.shape[0] * img.shape[1]) * 0.01  # At least 1% of the image
    
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if area > min_area:
            # We only want wide rectangles (the images)
            if w > h * 1.2:
                rects.append((x, y, w, h))
                
    print(f"Found {len(rects)} large rectangles.")
    
    rects.sort(key=lambda r: r[1])
    
    rows = []
    current_row = []
    last_y = -100
    
    for r in rects:
        x, y, w, h = r
        if abs(y - last_y) > h * 0.5:
            if current_row:
                current_row.sort(key=lambda cr: cr[0])
                rows.append(current_row)
            current_row = [r]
            last_y = y
        else:
            current_row.append(r)
            
    if current_row:
        current_row.sort(key=lambda cr: cr[0])
        rows.append(current_row)
        
    print(f"Grouped into {len(rows)} rows.")
    for i, row in enumerate(rows):
        print(f"Row {i} has {len(row)} images.")

    categories = [
        ('clear', ['morning', 'afternoon', 'evening', 'night']),
        ('cloudy', ['morning', 'afternoon', 'evening', 'night']),
        ('rain', ['morning', 'afternoon', 'evening', 'night']),
        ('special', ['storm', 'fog', 'snow', 'default'])
    ]
    
    if len(rows) != 4 or any(len(r) != 4 for r in rows):
        print("Warning: Did not find exactly 4x4 grid. Attempting manual slice if possible, or dumping all.")
        
        # Fallback dump
        os.makedirs(os.path.join(output_dir, 'dump'), exist_ok=True)
        for i, row in enumerate(rows):
            for j, (x, y, w, h) in enumerate(row):
                roi = img[y:y+h, x:x+w]
                cv2.imwrite(os.path.join(output_dir, 'dump', f'img_{i}_{j}.jpg'), roi)
        print("Dumped extracted images to dump directory due to layout mismatch.")
        sys.exit(0)

    for row_idx, row in enumerate(rows):
        cat_name, times = categories[row_idx]
        
        for col_idx, (x, y, w, h) in enumerate(row):
            time_name = times[col_idx]
            
            if cat_name == 'special':
                out_dir = os.path.join(output_dir, time_name)
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(out_dir, 'default.jpg')
            else:
                out_dir = os.path.join(output_dir, cat_name)
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(out_dir, f'{time_name}.jpg')
                
            roi = img[y:y+h, x:x+w]
            cv2.imwrite(out_path, roi)
            print(f"Saved {out_path}")

if __name__ == "__main__":
    img_path = sys.argv[1]
    out_dir = sys.argv[2]
    extract_backgrounds(img_path, out_dir)
