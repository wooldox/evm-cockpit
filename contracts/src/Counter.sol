// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title CounterV1
/// @notice A minimal upgradeable-style implementation used behind SlimProxy.
contract CounterV1 {
    uint256 public count;
    bool private initialized;

    function initialize() external {
        require(!initialized, "init");
        initialized = true;
    }

    function increment() external {
        count += 1;
    }

    function version() external pure returns (string memory) {
        return "v1";
    }
}
