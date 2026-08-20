import json
import hashlib

class EvidenceService:
    @staticmethod
    def generate_evidence_hash(case_data: dict) -> str:
        """
        Generates a deterministic SHA-256 evidence fingerprint using canonical JSON.
        Removes any sensitive/unnecessary information (though we shouldn't have passwords here).
        Requires:
        - sorted keys
        - stable representation (no spaces after separators for consistency)
        - UTF-8 encoding
        - SHA-256
        """
        # Create a copy to avoid mutating the original
        payload = case_data.copy()
        
        # Remove any fields that might change post-creation and affect the original evidence hash
        for field in ['created_at', 'status', 'blockchain_tx_hash', 'evidence_hash']:
            payload.pop(field, None)
            
        # Serialize to canonical JSON (sorted keys, no extra whitespace)
        canonical_json = json.dumps(
            payload,
            sort_keys=True,
            separators=(',', ':'),
            ensure_ascii=False
        )
        
        # Encode to UTF-8
        encoded_data = canonical_json.encode('utf-8')
        
        # Generate SHA-256 Hash
        return hashlib.sha256(encoded_data).hexdigest()
