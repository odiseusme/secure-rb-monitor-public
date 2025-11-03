#!/usr/bin/env python3
"""
Compact QR Code Generator for register-user.sh
Generates small, terminal-friendly QR codes using python-qrcode library.
"""

import os
import sys
import qrcode

def generate_compact_qr(url, output_file=None, show_terminal=False):
    """
    Generate a compact QR code optimized for terminal display.
    
    Args:
        url: The URL to encode
        output_file: Optional path to save PNG file
        show_terminal: If True, print QR to terminal
    """
    # Create QR code with compact settings
    qr = qrcode.QRCode(
        version=1,                                      # Start small, auto-increases if needed
        error_correction=qrcode.constants.ERROR_CORRECT_L,  # Lowest = smallest QR code
        box_size=3,                                     # Smaller pixels for PNG
        border=2,                                       # Minimal border (2 is QR spec minimum)
    )
    
    qr.add_data(url)
    qr.make(fit=True)
    
    # Save PNG file if requested
    if output_file:
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(output_file)
        print(f"QR code saved to: {output_file}", file=sys.stderr)
    
    # Display in terminal if requested
    if show_terminal:
        # Use ASCII art for terminal (compact, no ANSI colors needed)
        qr.print_ascii(invert=True)
    
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: generate-compact-qr.py <url> [output_file]", file=sys.stderr)
        print("  url:         URL to encode in QR code", file=sys.stderr)
        print("  output_file: Optional PNG file path to save", file=sys.stderr)
        print("", file=sys.stderr)
        print("Set SHOW_TERMINAL=1 to display QR in terminal", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    show_terminal = os.environ.get('SHOW_TERMINAL', '0') == '1'
    
    try:
        sys.exit(generate_compact_qr(url, output_file, show_terminal))
    except Exception as e:
        print(f"Error generating QR code: {e}", file=sys.stderr)
        sys.exit(1)
