# Shorthand Font Builder

A simple tool to create fonts from SVG source files using FontForge.

## Prerequisites

Install FontForge with Python bindings:
```bash
# macOS
brew install fontforge

# Ubuntu/Debian
apt install fontforge python3-fontforge

# Fedora
dnf install fontforge python3-fontforge
```

## Usage

1. Add SVG glyphs to the `glyphs/` directory
   - Name files as single characters: `A.svg`, `B.svg`, `1.svg`
   - Or use Unicode notation: `U+0041.svg` for A

2. Run the build script:
```bash
cd static/shorthand
python3 build_font.py
```

3. Find generated fonts in `output/`:
   - `Shorthand.otf` - OpenType Font
   - `Shorthand.ttf` - TrueType Font
   - `Shorthand.woff` - Web Open Font Format
   - `Shorthand.woff2` - Web Open Font Format 2

## SVG Glyph Format

SVG files should:
- Use a 1000x1000 viewBox
- Use paths with strokes (will be converted to outlines)
- Keep shapes simple for clean conversion

Example glyph:
```svg
<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <path d="M 100,800 L 500,200 L 900,800" 
        fill="none" 
        stroke="black" 
        stroke-width="60"/>
</svg>
```

## Customization

Edit `build_font.py` to change:
- Font name and metadata
- Em size and metrics
- Glyph width calculation
- Output formats