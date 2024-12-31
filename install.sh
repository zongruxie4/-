#!/bin/bash

# Change to the directory where the script is located
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up the project...${NC}"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}uv not found. Installing...${NC}"
    # Install uv using the standalone installer
    curl -LsSf https://astral.sh/uv/install.sh | sh
else
    echo -e "${GREEN}uv is already installed${NC}"
    # Optionally update uv
    echo "Updating uv..."
    uv self update
fi

# Verify uv installation
if ! command -v uv &> /dev/null; then
    echo -e "${RED}Failed to install uv. Please install it manually.${NC}"
    exit 1
fi

# Initialize the project with uv (only if .venv doesn't exist)
if [ ! -d ".venv" ]; then
    echo -e "\n${GREEN}Creating virtual environment...${NC}"
    uv venv --python 3.10
else
    echo -e "\n${GREEN}Virtual environment already exists${NC}"
fi

# Install dependencies from pyproject.toml
echo -e "\n${GREEN}Installing dependencies...${NC}"
uv pip install .

# Set up pycache directory before build
mkdir -p .cache/__pycache__
PYTHONPYCACHEPREFIX="$(pwd)/.cache/__pycache__"

# Build the project
echo -e "\n${GREEN}Building project...${NC}"
uv build

# Configure config.yaml
if [ ! -f "config.yaml" ] && [ -f "config_example.yaml" ]; then
    echo -e "\n${YELLOW}Setting up configuration...${NC}"
    cp config_example.yaml config.yaml
    
    # Get current directory and update base_dir in config.yaml
    CURRENT_DIR=$(pwd)
    WORKSPACE_DIR="${CURRENT_DIR}/.nanobrowser"
    
    # Create .nanobrowser directory if it doesn't exist
    mkdir -p "${WORKSPACE_DIR}"
    
    # Update base_dir in config.yaml
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|/Users/jason/.nanobrowser|${WORKSPACE_DIR}|" config.yaml
    else
        # Linux
        sed -i "s|/Users/jason/.nanobrowser|${WORKSPACE_DIR}|" config.yaml
    fi
    
    echo "A default config.yaml file has been created in the current directory. Please configure it before running the application."
fi

echo -e "\n${GREEN}Setup completed!${NC}"
echo "To run the project:"
echo "1. Edit config.yaml with your settings, fill in the LLM api keys"
echo "2. Make sure you have a Google Chrome browser installed"
echo "3. Make sure you have the chrome extension installed via the developer mode in chrome"
echo "4. Run: uv run nanobrowser"
