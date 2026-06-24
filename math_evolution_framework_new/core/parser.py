import json
import re
import os
from typing import List, Dict, Optional

class SessionParser:
    """Parses session JSON files to extract thinking processes and math content."""

    # Updated pattern to handle different variants of details/summary
    THINKING_PATTERN = re.compile(r'<details.*?>\s*<summary>Thinking Process</summary>\s*?\n\n\`\`\`text\n(.*?)\n\`\`\`\n\n</details>', re.DOTALL)

    # Alternative pattern for when thought might be slightly different
    ALT_THINKING_PATTERN = re.compile(r'<details.*?>\s*<summary>Thinking Process</summary>(.*?)</details>', re.DOTALL)

    MATH_BLOCK_PATTERN = re.compile(r'\$\$(.*?)\$\$', re.DOTALL)
    INLINE_MATH_PATTERN = re.compile(r'\$(.*?)\$')

    def __init__(self, sessions_dir: str):
        self.sessions_dir = sessions_dir

    def parse_session(self, session_id: str) -> Dict:
        """Parses a single session file."""
        file_path = os.path.join(self.sessions_dir, f"{session_id}.json")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Session file not found: {file_path}")

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        messages = data.get('messages', [])
        extracted_data = {
            'session_id': session_id,
            'title': data.get('title', ''),
            'turns': []
        }

        for i, msg in enumerate(messages):
            if msg['role'] == 'model':
                content = msg['content']
                thinking = self.extract_thinking(content)
                math_blocks = self.extract_math(content)

                # Try to find the user prompt for this model response
                user_prompt = ""
                if i > 0 and messages[i-1]['role'] == 'user':
                    user_prompt = messages[i-1]['content']

                extracted_data['turns'].append({
                    'user_prompt': user_prompt,
                    'thinking': thinking,
                    'content': content,
                    'math_blocks': math_blocks
                })

        return extracted_data

    def extract_thinking(self, content: str) -> Optional[str]:
        """Extracts the thinking process block."""
        match = self.THINKING_PATTERN.search(content)
        if match:
            return match.group(1).strip()

        # Try alternative
        match = self.ALT_THINKING_PATTERN.search(content)
        if match:
            inner = match.group(1).strip()
            # Clean up markdown code blocks if present
            inner = re.sub(r'^\`\`\`text\n', '', inner)
            inner = re.sub(r'\n\`\`\`$', '', inner)
            return inner.strip()

        return None

    def extract_math(self, content: str) -> Dict[str, List[str]]:
        """Extracts block and inline math."""
        # Remove thinking process before extracting math to avoid duplicates if thinking contains math
        clean_content = self.THINKING_PATTERN.sub('', content)
        clean_content = self.ALT_THINKING_PATTERN.sub('', clean_content)

        return {
            'blocks': self.MATH_BLOCK_PATTERN.findall(clean_content),
            'inline': self.INLINE_MATH_PATTERN.findall(clean_content)
        }

    def list_sessions(self) -> List[str]:
        """Lists all available session IDs."""
        if not os.path.exists(self.sessions_dir):
            return []
        return [f.replace('.json', '') for f in os.listdir(self.sessions_dir) if f.endswith('.json')]

if __name__ == "__main__":
    parser = SessionParser('data/sessions')
    sessions = parser.list_sessions()
    if sessions:
        parsed = parser.parse_session('8dd09afd-9df0-4c48-9691-97a2d6b3b070')
        print(f"Thinking extracted: {parsed['turns'][0]['thinking'] is not None}")
