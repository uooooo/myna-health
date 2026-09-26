// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Thin boundary around a generated Groth16 verifier. A verifier
/// adapter can implement this interface without changing the ENS policy gate.
interface IMynaHealthVerifier {
    function verify(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}

interface IENSv2UniversalResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory result, address resolver);
}

/// @notice Accepts a medical predicate proof against a live ENSv2 policy.
/// @dev ENSv2 Permissioned Resolver EAC governs writes to the policy record.
/// The policy is resolved in each accept call; cached/stale policies are never
/// accepted. The resolver is restricted to the official ENSv2 hierarchy by
/// the configured UniversalResolverV2 address.
contract MynaHealthGate {
    string public constant POLICY_KEY = "mynahealth.policy.v1";
    bytes4 private constant DATA_SELECTOR = bytes4(keccak256("data(bytes32,string)"));
    uint256 private constant PUBLIC_INPUT_COUNT = 11;
    uint256 private constant POLICY_WORDS = 14;

    /// @dev All fields are ABI-encoded in this order in the ENSIP-24 data record.
    struct Policy {
        uint256 issuerAx;
        uint256 issuerAy;
        uint256[4] acceptedDrugCodes;
        uint32 minDay;
        uint32 maxDay;
        uint256 context;
        uint256 policyHash;
        uint64 receiptExpiry;
        address verifier;
        address consumer;
        uint64 epoch;
    }

    IENSv2UniversalResolver public immutable universalResolver;
    mapping(uint256 nullifier => bool spent) public spentNullifier;

    event ProofAccepted(
        bytes indexed ensName,
        address indexed policyResolver,
        address indexed consumer,
        uint64 policyEpoch,
        uint256 nullifier,
        uint64 receiptExpiry
    );

    error EmptyName();
    error MissingPolicy();
    error InvalidPolicy();
    error PolicyInactive();
    error UnauthorizedConsumer();
    error InvalidPublicInputs();
    error NullifierAlreadySpent();
    error InvalidProof();

    constructor(address universalResolver_) {
        if (universalResolver_ == address(0)) revert InvalidPolicy();
        universalResolver = IENSv2UniversalResolver(universalResolver_);
    }

    /// @dev `ensName` is DNS wire format. Normalize labels using ENSIP-15
    /// before encoding; the contract intentionally does not normalize names.
    function resolvePolicy(bytes calldata ensName) public view returns (Policy memory policy, address policyResolver) {
        if (ensName.length < 2 || ensName[ensName.length - 1] != 0x00) revert EmptyName();
        (bytes memory answer, address resolver) = universalResolver.resolve(
            ensName, abi.encodeWithSelector(DATA_SELECTOR, bytes32(0), POLICY_KEY)
        );
        if (answer.length == 0 || resolver == address(0)) revert MissingPolicy();
        bytes memory encodedPolicy = abi.decode(answer, (bytes));
        if (encodedPolicy.length != POLICY_WORDS * 32) revert MissingPolicy();
        policy = abi.decode(encodedPolicy, (Policy));
        if (
            policy.issuerAx == 0 || policy.issuerAy == 0 || policy.context == 0 || policy.policyHash == 0
                || policy.verifier == address(0) || policy.consumer == address(0)
                || policy.minDay > policy.maxDay || policy.epoch == 0
        ) revert InvalidPolicy();
        return (policy, resolver);
    }

    /// @notice Public input order fixed with the proof kernel:
    /// [issuerAx, issuerAy, acceptedDrugCodes[0..3], minDay, maxDay,
    ///  context, policyHash, nullifier].
    /// @dev The proof kernel enforces policyHash = Poseidon(domain, drug codes,
    /// minDay, maxDay), and nullifier = Poseidon(domain, holder secret, context).
    /// Every public policy input is compared against the live ENS record.
    function accept(bytes calldata ensName, bytes calldata proof, uint256[] calldata publicInputs) external {
        (Policy memory policy, address policyResolver) = resolvePolicy(ensName);
        if (msg.sender != policy.consumer) revert UnauthorizedConsumer();
        uint256 today = block.timestamp / 1 days;
        if (
            today < policy.minDay || today > policy.maxDay
                || block.timestamp > policy.receiptExpiry
        ) revert PolicyInactive();
        if (publicInputs.length != PUBLIC_INPUT_COUNT) revert InvalidPublicInputs();
        if (
            publicInputs[0] != policy.issuerAx || publicInputs[1] != policy.issuerAy
                || publicInputs[2] != policy.acceptedDrugCodes[0]
                || publicInputs[3] != policy.acceptedDrugCodes[1]
                || publicInputs[4] != policy.acceptedDrugCodes[2]
                || publicInputs[5] != policy.acceptedDrugCodes[3]
                || publicInputs[6] != policy.minDay || publicInputs[7] != policy.maxDay
                || publicInputs[8] != policy.context || publicInputs[9] != policy.policyHash
        ) revert InvalidPublicInputs();
        uint256 nullifier = publicInputs[10];
        if (nullifier == 0 || spentNullifier[nullifier]) revert NullifierAlreadySpent();
        if (!IMynaHealthVerifier(policy.verifier).verify(proof, publicInputs)) revert InvalidProof();
        spentNullifier[nullifier] = true;
        emit ProofAccepted(ensName, policyResolver, msg.sender, policy.epoch, nullifier, policy.receiptExpiry);
    }
}
