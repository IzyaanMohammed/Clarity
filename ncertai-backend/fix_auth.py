import re

with open('routes/auth.py', 'r') as f:
    content = f.read()

new_func = '''@router.get("/locations")
async def get_locations():
    return {
        "countries": ["India", "UAE", "USA", "UK"],
        "states": ["Tamil Nadu", "Delhi", "Maharashtra", "Dubai", "Abu Dhabi"],
        "cities": ["Chennai", "New Delhi", "Mumbai", "Dubai", "Abu Dhabi"]
    }
'''

content = re.sub(r'@router\.get\("/locations"\).*?(?=@router|$)', new_func, content, flags=re.DOTALL)

with open('routes/auth.py', 'w') as f:
    f.write(content)
