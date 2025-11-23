#!/usr/bin/env python3
"""
AI CLI Launcher
===============

Launcher script for the AI testing CLI. Run this from the project root.
"""

import sys
import os
from pathlib import Path

# Add the backend-api/src to Python path so ai can be imported as a module
project_root = Path(__file__).parent
backend_api_src = project_root / 'backend-api' / 'src'
sys.path.insert(0, str(backend_api_src))

# Import and run the CLI as a module
from ai.cli import main

if __name__ == '__main__':
    main()
