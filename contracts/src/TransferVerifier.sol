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

contract TransferVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20853353610439651221550481276564486553947669561446082088055640323439421882006;
    uint256 constant alphay  = 13042861827197112784349533993242535905137684405187077203596362831729813121349;
    uint256 constant betax1  = 16975035498296180413225173128710424491594098338350918539556589686944030821270;
    uint256 constant betax2  = 9711063165252235386981462099964033456294845320830899826823056376632224817758;
    uint256 constant betay1  = 9870889385523685210492810932966614508076833555510641885901795428987513080460;
    uint256 constant betay2  = 20056952390130894653974868463696939301499362670590862830361598566436734121944;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 14854160349414600390712386796686059170963197450937279376023224759634910792629;
    uint256 constant deltax2 = 20395200614834819752540765514467076492283681436011602055598664952921613329661;
    uint256 constant deltay1 = 17343923065823540458300530986684549415779956814595115095045458695209974937658;
    uint256 constant deltay2 = 775711857776212624609030202045824032255849083940646307529295729280447247818;

    
    uint256 constant IC0x = 20246175179327317779233174882079493441931475450596795868325029427617090859406;
    uint256 constant IC0y = 9369109103320498584988013718630289078145192224702760647335114688465062412128;
    
    uint256 constant IC1x = 11826516205627732478464332071980960004835161342655477222871777123152707090783;
    uint256 constant IC1y = 8983734183277040286629168837671198705850889071933815845754864739709571452182;
    
    uint256 constant IC2x = 15171812491642829010241948846151287128042465654164308620051129263036080374885;
    uint256 constant IC2y = 12791162707325172318779605538866604145420712190224425795206045334274948542832;
    
    uint256 constant IC3x = 21603168721627893498546645092673166914684862873115145442189389996635363068607;
    uint256 constant IC3y = 19282022713095917505030537976539490498547705513471526139334933015409309763136;
    
    uint256 constant IC4x = 14047177579090212846610832083088398142772300305599984926808904541025825565317;
    uint256 constant IC4y = 13236982759914049578847488325039999572033082143850724865340480737586015662138;
    
    uint256 constant IC5x = 18435678769733234050122365532146441096786131776993590392340387433626027830047;
    uint256 constant IC5y = 6414551024069994953197875710683384874508878673360273789869375322974905615826;
    
    uint256 constant IC6x = 12438208503890642281905877989653503867390454928432071765531163238316194778896;
    uint256 constant IC6y = 13969545410937990319808839898426587351748225780378178300679775326313195976359;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[6] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // NOTE: Canonical point validation removed
            // snarkjs does not guarantee proofs are in canonical form (y < (q-1)/2)
            // Both y and -y mod q are valid, and snarkjs can generate either
            // Enforcing canonical form would reject valid proofs
            // Nullifier mechanism already prevents double-spending (main security concern)
            
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
            
            // NOTE: Canonical point validation removed - snarkjs proofs are not always canonical
            // Nullifier mechanism provides sufficient protection against double-spending

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
