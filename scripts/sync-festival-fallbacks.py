import json
import re
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_file = os.path.join(base_dir, 'data', 'FESTIVAL_YANGJAE_2026.json')
hook_file = os.path.join(base_dir, 'src', 'hooks', 'useYangjaeFestival.ts')
func_file = os.path.join(base_dir, 'functions', 'api', 'festival', 'yangjae.ts')

with open(data_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

json_str = json.dumps(data, ensure_ascii=False, indent=2)

if os.path.exists(hook_file):
    with open(hook_file, 'r', encoding='utf-8') as f:
        hook_content = f.read()
    hook_pattern = r'(export const YANGJAE_FALLBACK_DATA: FestivalData = )[\s\S]*?(;\r?\n\r?\nexport const initialFallbackData)'
    new_hook = re.sub(hook_pattern, r'\g<1>' + json_str.replace('\\', '\\\\') + r'\g<2>', hook_content)
    with open(hook_file, 'w', encoding='utf-8') as f:
        f.write(new_hook)

if os.path.exists(func_file):
    with open(func_file, 'r', encoding='utf-8') as f:
        func_content = f.read()
    func_pattern = r'(const FALLBACK_FESTIVAL_DATA = )[\s\S]*?(;\s*$)'
    new_func = re.sub(func_pattern, r'\g<1>' + json_str.replace('\\', '\\\\') + r';\n', func_content)
    with open(func_file, 'w', encoding='utf-8') as f:
        f.write(new_func)

print('[OK] Synced festival fallbacks')
