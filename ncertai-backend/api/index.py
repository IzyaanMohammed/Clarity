import sys
import os

# Add parent directory to sys.path so absolute imports in the backend project resolve correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
