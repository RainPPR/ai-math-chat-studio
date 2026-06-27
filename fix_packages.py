import json

with open('package.json', 'r') as f:
    data = json.load(f)

data['overrides'] = {
    "katex": "^0.17.0"
}
data['resolutions'] = {
    "katex": "^0.17.0"
}

with open('package.json', 'w') as f:
    json.dump(data, f, indent=2)
