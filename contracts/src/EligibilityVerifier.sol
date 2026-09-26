// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 1237829826482838685298106753130850834033934706757673377147584167262289275479;
    uint256 constant alphay  = 1622451173013468203318079880442341292075156034808318007127257427684165619560;
    uint256 constant betax1  = 3289716992820205145173356744699382512193654136859566553904129559028457523664;
    uint256 constant betax2  = 17788832017868497250222130406624799403971997686290708751093671044029314029799;
    uint256 constant betay1  = 11380018945496569181913086850148508106982971835324803648117786223509877317774;
    uint256 constant betay2  = 10247247943744483271042968309000933938729666531570749071115868287595722700363;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 8008861012795811016603516679336855106880528264606514769672771293757803598754;
    uint256 constant deltax2 = 15368130203162904773412958764871269084730520663560320378843127571773688580561;
    uint256 constant deltay1 = 10490157375547090671269775555475056632743667397992292053510562344529019562769;
    uint256 constant deltay2 = 9638214218756356221479880135101302615212728815996757292328663747546208545745;


    uint256 constant IC0x = 20532336448945334327418613135784372306608891156966519417457807713427359778824;
    uint256 constant IC0y = 16917036728857554731377699263942439303841443709208579488563169584301954005785;

    uint256 constant IC1x = 13974274780248102406696591745812791899998981768331828856397728322871404042218;
    uint256 constant IC1y = 7976694239222554698454379374969706154420430485205489048801253587389021065272;

    uint256 constant IC2x = 19165592799032067111284895639299785369198776145187397476677757065864291765009;
    uint256 constant IC2y = 611076683860992683770452773595028736381219435330137336871291590468908451168;

    uint256 constant IC3x = 16926792548548033995894522818876972765502692834952559700372679484613356940984;
    uint256 constant IC3y = 14353793363771183664924349644546645479085053110279724615191156460584151699371;

    uint256 constant IC4x = 12784067475970079810149250811861248345550774790089016885504383640424247405768;
    uint256 constant IC4y = 4946278876396928627843448065867700767519789658718022606631221996140377485387;

    uint256 constant IC5x = 12243537247103181248392828627774041161155775697407666744606560755827153215520;
    uint256 constant IC5y = 9790402477723382856997626832441031190768008377024628638651186440357255616221;

    uint256 constant IC6x = 15140301394387626318387097698608668948112693035255797794789171707543821279276;
    uint256 constant IC6y = 18429229614800143006957808940738173423426862078403509482238452832116180636904;

    uint256 constant IC7x = 20281235928160023567805390287656399476918046863168666226002372789768347183284;
    uint256 constant IC7y = 15104967568933110621440704356746706117017798612224310615523138843576158965717;

    uint256 constant IC8x = 20880214383024456684439657654281318478752832086501768125099934224826194247747;
    uint256 constant IC8y = 14224643714301120978210995010584859456359964614967425409563129881140227755711;

    uint256 constant IC9x = 1912914206733543914604511317231034168722338122824167725707694241416978048584;
    uint256 constant IC9y = 654397682810675441869070212442943501522172436806395906939806357956836938019;

    uint256 constant IC10x = 2271646331911677353963382514957585949741418271969626860562624314178748088385;
    uint256 constant IC10y = 15320175925715435530582753089635449984756344619106024733321258300506529586030;

    uint256 constant IC11x = 11958204179164864524895057062730600436620553586742506230419176518395917550732;
    uint256 constant IC11y = 18460001760336562020274394259606985382807484460913197632397740619508899122067;


    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[11] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x

                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))

                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))

                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))

                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))

                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))

                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))

                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))

                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))

                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))

                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))

                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))


                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F

            checkField(calldataload(add(_pubSignals, 0)))

            checkField(calldataload(add(_pubSignals, 32)))

            checkField(calldataload(add(_pubSignals, 64)))

            checkField(calldataload(add(_pubSignals, 96)))

            checkField(calldataload(add(_pubSignals, 128)))

            checkField(calldataload(add(_pubSignals, 160)))

            checkField(calldataload(add(_pubSignals, 192)))

            checkField(calldataload(add(_pubSignals, 224)))

            checkField(calldataload(add(_pubSignals, 256)))

            checkField(calldataload(add(_pubSignals, 288)))

            checkField(calldataload(add(_pubSignals, 320)))


            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
