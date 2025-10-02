#!/usr/bin/env python3
"""
Simple font builder using FontForge
Converts SVG glyphs into OTF/WOFF fonts
"""

import fontforge
import os
import glob

# Font metadata
FONT_NAME = "Shorthand"
FONT_FAMILY = "Shorthand"
FONT_FULLNAME = "Shorthand Regular"
FONT_VERSION = "1.0"

# Font metrics
EM_SIZE = 1000  # Units per em
ASCENT = 800
DESCENT = 200

def build_font():
    # Create new font
    font = fontforge.font()
    
    # Set font properties
    font.fontname = f"{FONT_NAME}-Regular"
    font.familyname = FONT_FAMILY
    font.fullname = FONT_FULLNAME
    font.version = FONT_VERSION
    
    # Set font metrics
    font.em = EM_SIZE
    font.ascent = ASCENT
    font.descent = DESCENT
    
    # Load all SVG files from glyphs directory
    glyph_files = sorted(glob.glob("glyphs/*.svg"))
    
    for svg_file in glyph_files:
        # Extract character from filename (e.g., "A.svg" -> "A")
        basename = os.path.basename(svg_file)
        char_name = os.path.splitext(basename)[0]
        
        # Handle different naming conventions
        if len(char_name) == 1:
            # Single character (A, B, C, etc.)
            char_code = ord(char_name)
        elif char_name.startswith("U+"):
            # Unicode notation (U+0041)
            char_code = int(char_name[2:], 16)
        else:
            print(f"Skipping {svg_file}: Unknown naming convention")
            continue
        
        try:
            # Create glyph and import SVG
            glyph = font.createChar(char_code, char_name)
            glyph.importOutlines(svg_file)
            
            # Auto-width based on glyph bounds
            glyph.width = int(glyph.boundingBox()[2]) + 100
            
            print(f"Added glyph: {char_name} (U+{char_code:04X})")
            
        except Exception as e:
            print(f"Error processing {svg_file}: {e}")
    
    # Generate font files
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate OTF
    otf_path = os.path.join(output_dir, f"{FONT_NAME}.otf")
    font.generate(otf_path)
    print(f"Generated: {otf_path}")
    
    # Generate WOFF
    woff_path = os.path.join(output_dir, f"{FONT_NAME}.woff")
    font.generate(woff_path)
    print(f"Generated: {woff_path}")
    
    # Generate WOFF2
    woff2_path = os.path.join(output_dir, f"{FONT_NAME}.woff2")
    font.generate(woff2_path)
    print(f"Generated: {woff2_path}")
    
    # Generate TTF
    ttf_path = os.path.join(output_dir, f"{FONT_NAME}.ttf")
    font.generate(ttf_path)
    print(f"Generated: {ttf_path}")

if __name__ == "__main__":
    build_font()