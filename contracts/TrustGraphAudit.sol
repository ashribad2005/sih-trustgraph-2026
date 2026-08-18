// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustGraphAudit
 * @author TRUSTGRAPH 2026 — SIH Team
 * @notice Tamper-proof, immutable on-chain registry for AI-detected financial fraud evidence.
 *
 * @dev ZERO PII POLICY:
 *      This contract NEVER stores UPI IDs, IP addresses, device identifiers,
 *      customer names, or any personally identifiable information.
 *      Only anchors:
 *        - Deterministic SHA-256 evidence hashes (bytes32)
 *        - Case IDs (opaque, non-PII string references)
 *        - Composite risk scores (uint256)
 *        - Unix timestamps (uint256)
 *        - Recommended action codes (string)
 *        - Submitting analyst/service address (address)
 *
 * @dev TARGET NETWORKS:
 *      - Polygon Amoy Testnet  : Chain ID 80002
 *        RPC: https://rpc-amoy.polygon.technology
 *        Explorer: https://amoy.polygonscan.com
 *      - Ethereum Sepolia       : Chain ID 11155111
 *        RPC: https://rpc.sepolia.org
 *        Explorer: https://sepolia.etherscan.io
 *
 * @dev DEPLOYMENT (Hardhat):
 *      npx hardhat run scripts/deploy_audit.js --network polygonAmoy
 *
 * @dev DEPLOYMENT (Foundry):
 *      forge create --rpc-url $RPC_URL --private-key $WALLET_PRIVATE_KEY \
 *        src/TrustGraphAudit.sol:TrustGraphAudit
 */
contract TrustGraphAudit {

    // ─────────────────────────────────────────────────────────────────────────
    // STRUCTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Immutable fraud proof record stored for each anchored case.
     * @param caseId            Opaque internal case reference (e.g., "TG-2026-00142"). Non-PII.
     * @param evidenceHash      SHA-256 digest of the canonical JSON evidence snapshot (bytes32).
     * @param riskScore         Composite AI/rule risk score (0–100).
     * @param timestamp         Unix timestamp of when the proof was anchored on-chain.
     * @param recommendedAction Recommended disposition code (e.g., "SIMULATED_HOLD_AND_INVESTIGATE").
     * @param loggedBy          Ethereum address of the service wallet that anchored the proof.
     */
    struct FraudProof {
        string  caseId;
        bytes32 evidenceHash;
        uint256 riskScore;
        uint256 timestamp;
        string  recommendedAction;
        address loggedBy;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE VARIABLES
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Contract owner — recorded at deployment, no elevated permissions.
    address public immutable owner;

    /// @notice Maps caseId -> FraudProof. Once anchored, immutable.
    mapping(string => FraudProof) private _proofs;

    /// @notice Tracks which caseIds have been anchored (prevents duplicate anchoring).
    mapping(string => bool) private _anchored;

    /// @notice Sequential list of all anchored case IDs for enumeration.
    string[] private _allCaseIds;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new fraud proof is anchored on-chain.
     * @param caseId         The opaque case identifier (indexed for fast log filtering).
     * @param evidenceHash   The SHA-256 evidence fingerprint (indexed for integrity queries).
     * @param riskScore      The composite AI risk score at time of anchoring.
     * @param loggedBy       The address that submitted the proof.
     * @param timestamp      Block-level Unix timestamp of anchoring.
     */
    event ProofAnchored(
        string  indexed caseId,
        bytes32 indexed evidenceHash,
        uint256 riskScore,
        address indexed loggedBy,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a proof integrity verification is performed on-chain.
     * @param caseId         The case being verified.
     * @param challenger     The address requesting verification.
     * @param matches        True if the supplied hash matches the anchored hash.
     */
    event IntegrityChecked(
        string  indexed caseId,
        address indexed challenger,
        bool    matches
    );

    // ─────────────────────────────────────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Raised when attempting to anchor a caseId that already exists.
    error CaseAlreadyAnchored(string caseId);

    /// @notice Raised when querying a caseId that has never been anchored.
    error CaseNotFound(string caseId);

    /// @notice Raised when a zero-hash is provided (prevents trivially invalid anchors).
    error InvalidEvidenceHash();

    /// @notice Raised when riskScore exceeds 100.
    error RiskScoreOutOfRange(uint256 provided);

    /// @notice Raised when caseId or recommendedAction is an empty string.
    error EmptyStringArgument(string field);

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WRITE FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Anchors a tamper-proof fraud evidence record immutably on-chain.
     * @dev    Reverts if the same caseId is submitted twice — immutability guarantee.
     *         Uses block.timestamp for record timestamp; callers should also log
     *         their own application-layer timestamp in the evidence hash.
     *
     * @param _caseId         Opaque case reference string (e.g., "TG-2026-00142").
     * @param _evidenceHash   SHA-256 digest of canonical sorted-JSON evidence snapshot.
     * @param _riskScore      Composite risk score in range [0, 100].
     * @param _action         Recommended action code string.
     *
     * @return txTimestamp    The block.timestamp at which the proof was anchored.
     */
    function anchorProof(
        string  calldata _caseId,
        bytes32 _evidenceHash,
        uint256 _riskScore,
        string  calldata _action
    ) external returns (uint256 txTimestamp) {
        // Input validation
        if (bytes(_caseId).length == 0)   revert EmptyStringArgument("caseId");
        if (bytes(_action).length == 0)   revert EmptyStringArgument("recommendedAction");
        if (_evidenceHash == bytes32(0))  revert InvalidEvidenceHash();
        if (_riskScore > 100)             revert RiskScoreOutOfRange(_riskScore);
        if (_anchored[_caseId])           revert CaseAlreadyAnchored(_caseId);

        // Commit to state
        txTimestamp = block.timestamp;

        _proofs[_caseId] = FraudProof({
            caseId:            _caseId,
            evidenceHash:      _evidenceHash,
            riskScore:         _riskScore,
            timestamp:         txTimestamp,
            recommendedAction: _action,
            loggedBy:          msg.sender
        });

        _anchored[_caseId] = true;
        _allCaseIds.push(_caseId);

        emit ProofAnchored(_caseId, _evidenceHash, _riskScore, msg.sender, txTimestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieves the complete tamper-evident fraud proof record for a given caseId.
     * @param  _caseId  The opaque case identifier to look up.
     * @return proof    The complete FraudProof struct for the given case.
     */
    function getProof(string calldata _caseId)
        external
        view
        returns (FraudProof memory proof)
    {
        if (!_anchored[_caseId]) revert CaseNotFound(_caseId);
        return _proofs[_caseId];
    }

    /**
     * @notice On-chain integrity check — verifies whether a supplied hash matches
     *         the immutably anchored evidence hash for a given case.
     * @dev    Emits IntegrityChecked so verifications are themselves auditable.
     * @param  _caseId         The case to verify.
     * @param  _suppliedHash   The hash computed from current local DB state.
     * @return isValid         True if the supplied hash matches the anchored hash.
     * @return anchoredHash    The original immutable hash stored on-chain.
     * @return anchoredScore   The risk score stored at anchoring time.
     * @return anchoredAt      Unix timestamp of original anchoring.
     */
    function verifyIntegrity(
        string  calldata _caseId,
        bytes32 _suppliedHash
    )
        external
        returns (
            bool    isValid,
            bytes32 anchoredHash,
            uint256 anchoredScore,
            uint256 anchoredAt
        )
    {
        if (!_anchored[_caseId]) revert CaseNotFound(_caseId);

        FraudProof storage proof = _proofs[_caseId];
        isValid       = (proof.evidenceHash == _suppliedHash);
        anchoredHash  = proof.evidenceHash;
        anchoredScore = proof.riskScore;
        anchoredAt    = proof.timestamp;

        emit IntegrityChecked(_caseId, msg.sender, isValid);
    }

    /**
     * @notice Returns whether a given caseId has already been anchored.
     * @param  _caseId  The case identifier to check.
     */
    function isAnchored(string calldata _caseId) external view returns (bool) {
        return _anchored[_caseId];
    }

    /**
     * @notice Returns the total number of fraud proofs anchored in this registry.
     */
    function totalAnchored() external view returns (uint256) {
        return _allCaseIds.length;
    }

    /**
     * @notice Returns the caseId at a given registry index (for enumeration / dashboards).
     * @param  _index  Zero-based index into the registry.
     */
    function caseIdAtIndex(uint256 _index) external view returns (string memory) {
        require(_index < _allCaseIds.length, "TrustGraphAudit: index out of bounds");
        return _allCaseIds[_index];
    }
}
