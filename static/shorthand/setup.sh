#!/bin/bash
# Setup script for shorthand font builder

echo "Setting up shorthand font builder..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Create virtual environment
echo "Creating Python virtual environment..."
uv venv

# Check if FontForge is installed
if ! command -v fontforge &> /dev/null; then
    echo ""
    echo "⚠️  FontForge is not installed!"
    echo "Please install it first:"
    echo "  brew install fontforge"
    echo ""
    echo "After installing FontForge, you can run:"
    echo "  python3 build_font.py"
    echo ""
    echo "Note: FontForge Python bindings work best with system Python,"
    echo "so you may need to use: /usr/bin/python3 build_font.py"
else
    echo "✓ FontForge is installed"
fi

echo ""
echo "Setup complete! To use:"
echo "  source .venv/bin/activate"
echo "  python3 build_font.py"