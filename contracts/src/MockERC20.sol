// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice A simple ERC20 token with public minting for testing purposes
 * @dev Anyone can mint tokens - DO NOT USE IN PRODUCTION
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens to any address (for testing only)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in smallest unit)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Mint tokens to yourself (convenience function)
     * @param amount Amount of tokens to mint (in smallest unit)
     */
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
