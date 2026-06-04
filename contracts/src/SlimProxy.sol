// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title SlimProxy
/// @notice A minimal EIP-1967 transparent-less proxy that delegates all calls
///         to an implementation stored at the standard EIP-1967 impl slot.
contract SlimProxy {
    /// @dev keccak256("eip1967.proxy.implementation") - 1
    bytes32 private constant _IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address impl) {
        assembly {
            sstore(_IMPL_SLOT, impl)
        }
    }

    function _delegate() private {
        assembly {
            let impl := sload(_IMPL_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    fallback() external payable {
        _delegate();
    }

    receive() external payable {
        _delegate();
    }
}
