import os
from dotenv import load_dotenv

# Try loading from local dir
load_dotenv(".env")

print(f"DEBUG: KEY = {os.getenv('OPENROUTER_API_KEY')}")
