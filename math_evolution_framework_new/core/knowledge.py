import json
import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional

class KnowledgeManager:
    """Manages Capsules and Genes in the data/ directory."""

    CAPSULES_DIR = 'data/capsules'
    GENES_DIR = 'data/genes'

    # Mapping of domains to capsule filenames
    DOMAIN_MAP = {
        'general': 'general.json',
        'algebra': 'algebra.json',
        'functions': 'functions.json',
        'geometry_planar': 'geometry_planar.json',
        'geometry_solid': 'geometry_solid.json',
        'trigonometry': 'trigonometry.json',
        'calculus': 'calculus.json',
        'probability': 'probability.json',
        'number_theory': 'number_theory.json'
    }

    def __init__(self, base_dir: str = '.'):
        self.base_dir = base_dir
        self.capsules_path = os.path.join(base_dir, self.CAPSULES_DIR)
        self.genes_path = os.path.join(base_dir, self.GENES_DIR)
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.capsules_path, exist_ok=True)
        os.makedirs(self.genes_path, exist_ok=True)

    def get_capsule(self, domain: str) -> Dict:
        filename = self.DOMAIN_MAP.get(domain, 'general.json')
        file_path = os.path.join(self.capsules_path, filename)

        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)

        return {
            "id": f"capsule-{domain}",
            "domain": domain,
            "genes": [],
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

    def save_capsule(self, capsule: Dict):
        domain = capsule.get('domain', 'general')
        filename = self.DOMAIN_MAP.get(domain, 'general.json')
        file_path = os.path.join(self.capsules_path, filename)

        capsule['last_updated'] = datetime.now(timezone.utc).isoformat()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(capsule, f, indent=2, ensure_ascii=False)

    def add_gene(self, domain: str, content: str, source_session: str = None, type: str = "heuristic") -> str:
        gene_id = f"gene-{uuid.uuid4().hex[:8]}"
        gene = {
            "id": gene_id,
            "domain": domain,
            "content": content,
            "type": type,
            "strength": 0.5,
            "success_count": 0,
            "failure_count": 0,
            "source": {"session_id": source_session},
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Save individual gene file
        gene_file = os.path.join(self.genes_path, f"{gene_id}.json")
        with open(gene_file, 'w', encoding='utf-8') as f:
            json.dump(gene, f, indent=2, ensure_ascii=False)

        # Update capsule
        capsule = self.get_capsule(domain)
        if gene_id not in capsule['genes']:
            capsule['genes'].append(gene_id)
        self.save_capsule(capsule)

        return gene_id

    def list_genes(self, domain: str = None) -> List[Dict]:
        genes = []
        for filename in os.listdir(self.genes_path):
            if filename.endswith('.json'):
                with open(os.path.join(self.genes_path, filename), 'r', encoding='utf-8') as f:
                    gene = json.load(f)
                    if not domain or gene['domain'] == domain:
                        genes.append(gene)
        return genes

if __name__ == "__main__":
    km = KnowledgeManager()
    gid = km.add_gene('algebra', 'Test gene for quadratic equations', source_session='demo-session')
    print(f"Added gene: {gid}")
    print(f"Current algebra genes: {km.get_capsule('algebra')['genes']}")
