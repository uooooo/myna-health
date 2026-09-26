// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MynaHealthGate, IMynaHealthVerifier, IENSv2UniversalResolver} from "../src/MynaHealthGate.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockENSv2UniversalResolver is IENSv2UniversalResolver {
    bytes public policy;
    address public policyResolver = address(0xCAFE);

    function setPolicy(bytes memory value) external {
        policy = value;
    }

    function resolve(bytes calldata, bytes calldata) external view returns (bytes memory result, address resolver) {
        return (abi.encode(policy), policyResolver);
    }
}

contract MockVerifier is IMynaHealthVerifier {
    function verify(bytes calldata proof, uint256[] calldata) external pure returns (bool) {
        return keccak256(proof) == keccak256(hex"deadbeef");
    }
}

contract MynaHealthGateTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes private constant NAME = hex"04636172650a6d796e616865616c74680365746800"; // care.mynahealth.eth

    MockENSv2UniversalResolver private ens;
    MockVerifier private verifier;
    MynaHealthGate private gate;
    MynaHealthGate.Policy private policy;

    function setUp() public {
        vm.warp(100 * 1 days);
        ens = new MockENSv2UniversalResolver();
        verifier = new MockVerifier();
        gate = new MynaHealthGate(address(ens));
        policy.issuerAx = 123;
        policy.issuerAy = 456;
        policy.acceptedDrugCodes = [uint256(11), 22, 33, 44];
        policy.minDay = 95;
        policy.maxDay = 105;
        policy.context = 789;
        policy.policyHash = 901;
        policy.receiptExpiry = uint64(105 days);
        policy.verifier = address(verifier);
        policy.consumer = address(this);
        policy.epoch = 1;
        ens.setPolicy(abi.encode(policy));
    }

    function inputs(uint256 nullifier) internal view returns (uint256[] memory a) {
        a = new uint256[](11);
        a[0] = policy.issuerAx;
        a[1] = policy.issuerAy;
        for (uint256 i; i < 4; ++i) a[2 + i] = policy.acceptedDrugCodes[i];
        a[6] = policy.minDay;
        a[7] = policy.maxDay;
        a[8] = policy.context;
        a[9] = policy.policyHash;
        a[10] = nullifier;
    }

    function testAcceptAndRejectReplay() public {
        uint256[] memory a = inputs(555);
        gate.accept(NAME, hex"deadbeef", a);
        require(gate.spentNullifier(555), "nullifier not spent");
        vm.expectRevert(MynaHealthGate.NullifierAlreadySpent.selector);
        gate.accept(NAME, hex"deadbeef", a);
    }

    function testRejectWrongPolicyField() public {
        uint256[] memory a = inputs(555);
        a[3] = 99;
        vm.expectRevert(MynaHealthGate.InvalidPublicInputs.selector);
        gate.accept(NAME, hex"deadbeef", a);
    }

    function testRejectOldPolicyAfterLiveENSUpdate() public {
        uint256[] memory a = inputs(555);
        policy.epoch = 2;
        policy.context = 999;
        ens.setPolicy(abi.encode(policy));
        vm.expectRevert(MynaHealthGate.InvalidPublicInputs.selector);
        gate.accept(NAME, hex"deadbeef", a);
    }

    function testRejectExpiredReceipt() public {
        uint256[] memory a = inputs(555);
        vm.warp(104 days);
        policy.receiptExpiry = uint64(103 days);
        ens.setPolicy(abi.encode(policy));
        vm.expectRevert(MynaHealthGate.PolicyInactive.selector);
        gate.accept(NAME, hex"deadbeef", a);
    }

    function testRejectOutsideUTCDateWindow() public {
        uint256[] memory a = inputs(555);
        vm.warp(106 days);
        vm.expectRevert(MynaHealthGate.PolicyInactive.selector);
        gate.accept(NAME, hex"deadbeef", a);
    }

    function testRejectUnauthorizedConsumerAndInvalidProof() public {
        uint256[] memory a = inputs(555);
        vm.prank(address(0xBAD));
        vm.expectRevert(MynaHealthGate.UnauthorizedConsumer.selector);
        gate.accept(NAME, hex"deadbeef", a);
        vm.expectRevert(MynaHealthGate.InvalidProof.selector);
        gate.accept(NAME, hex"bad0", a);
        require(!gate.spentNullifier(555), "invalid proof spent nullifier");
    }
}
