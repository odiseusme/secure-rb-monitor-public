#!/usr/bin/env python3
import sys
import os

try:
    import qrcode
except ImportError:
    print("ERROR: qrcode module not found!", file=sys.stderr)
    sys.exit(1)

def generate_compact_qr(url, output_file):
    # Adjust box_size based on URL length for optimal size
    if len(url) > 300:
        BOX_SIZE = 5  # Very long URLs (with passphrase)
    elif len(url) > 150:
        BOX_SIZE = 7  # Medium URLs
    else:
        BOX_SIZE = 10  # Short URLs
    
    BORDER = 1
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=BOX_SIZE,
        border=BORDER,
    )
    
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_file)
    
    width, height = img.size
    file_size = os.path.getsize(output_file)
    matrix_size = 17 + (qr.version * 4)
    
    print(f"✓ Compact QR generated: {output_file}", file=sys.stderr)
    print(f"  Version: {qr.version} (matrix: {matrix_size}×{matrix_size})", file=sys.stderr)
    print(f"  Image size: {width}×{height} pixels", file=sys.stderr)
    print(f"  File size: {file_size:,} bytes ({file_size/1024:.1f} KB)", file=sys.stderr)
    
    # Only show in terminal for smaller QR codes (version < 10)
    if os.environ.get('SHOW_TERMINAL') == '1':
        if qr.version < 10:
            print("", file=sys.stderr)
            print_terminal_qr(qr)
        else:
            print("", file=sys.stderr)
            print(f"  (QR too large for terminal display - open {output_file} to view)", file=sys.stderr)
    
    return output_file

def print_terminal_qr(qr):
    matrix = qr.get_matrix()
    for i in range(0, len(matrix), 2):
        line = ""
        for j in range(len(matrix[0])):
            top = matrix[i][j] if i < len(matrix) else False
            bottom = matrix[i+1][j] if i+1 < len(matrix) else False
            if top and bottom:
                line += "█"
            elif top and not bottom:
                line += "▀"
            elif not top and bottom:
                line += "▄"
            else:
                line += " "
        print(line, file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: generate-compact-qr.py <url> <output_file>", file=sys.stderr)
        sys.exit(1)
    generate_compact_qr(sys.argv[1], sys.argv[2])
