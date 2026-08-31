import sys
from PIL import Image
import os

def slice_image(img_path, out_dir):
    img = Image.open(img_path)
    w, h = img.size
    
    # Grid is 4 rows, 4 columns
    # There are titles like "CLEAR" and margins.
    # We will estimate the bounding boxes visually based on 1024x682
    
    # 4 rows of images
    row_starts = [45, 203, 361, 532]
    row_height = 142
    
    # 4 cols of images
    col_starts = [8, 258, 508, 758]
    col_width = 246
    
    categories = [
        ('clear', ['morning', 'afternoon', 'evening', 'night']),
        ('cloudy', ['morning', 'afternoon', 'evening', 'night']),
        ('rain', ['morning', 'afternoon', 'evening', 'night']),
        ('special', ['storm', 'fog', 'snow', 'default'])
    ]
    
    for r_idx, y_start in enumerate(row_starts):
        cat_name, times = categories[r_idx]
        for c_idx, x_start in enumerate(col_starts):
            time_name = times[c_idx]
            
            box = (x_start, y_start, x_start + col_width, y_start + row_height)
            cropped = img.crop(box)
            
            if cat_name == 'special':
                dir_path = os.path.join(out_dir, time_name)
                os.makedirs(dir_path, exist_ok=True)
                out_path = os.path.join(dir_path, 'default.jpg')
            else:
                dir_path = os.path.join(out_dir, cat_name)
                os.makedirs(dir_path, exist_ok=True)
                out_path = os.path.join(dir_path, f'{time_name}.jpg')
                
            cropped.save(out_path)
            print(f"Saved {out_path}")

if __name__ == "__main__":
    slice_image(sys.argv[1], sys.argv[2])
