#!/bin/bash
# Build fonts using the correct Python with FontForge bindings

echo "Building Shorthand font..."
/opt/homebrew/bin/python3.13 build_font.py
echo "Done! Check the output/ directory for generated fonts."