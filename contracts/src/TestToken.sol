// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title TestToken
/// @notice A minimal ERC20-like token used as an integration-test fixture.
/// @dev No external dependencies. Exercises custom errors, plain string
///      reverts, an overloaded function, a payable function, and events.
contract TestToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed from, uint256 amount);

    error InsufficientBalance(uint256 requested, uint256 available);
    error NotOwner();

    constructor(string memory name_, string memory symbol_, uint256 initialSupply) {
        name = name_;
        symbol = symbol_;
        owner = msg.sender;
        _mint(msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 available = balanceOf[msg.sender];
        if (amount > available) {
            revert InsufficientBalance(amount, available);
        }
        balanceOf[msg.sender] = available - amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance exceeded");

        uint256 available = balanceOf[from];
        if (amount > available) {
            revert InsufficientBalance(amount, available);
        }

        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] = available - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    /// @notice Owner-only burn that uses plain Error(string) revert paths.
    function burnFrom(address from, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        require(balanceOf[from] >= amount, "burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    /// @notice Overload: owner-only mint to an arbitrary recipient.
    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _mint(to, amount);
    }

    /// @notice Overload: mint to the caller.
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /// @notice Payable deposit: mints msg.value tokens 1:1 to the sender.
    function deposit() external payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
