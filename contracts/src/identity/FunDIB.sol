// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IFunDIDRegistry {
    function didOf(address user) external view returns (string memory);
}

/**
 * @title FunDIB — Digital Identity Bank
 * @notice On-chain reputation profile coupled to a DID.
 *         Stores Light Score + 4 sub-scores + badge count + status.
 *         Light Score = 40*contribution + 30*trust + 20*consistency + 10*impact (MVP).
 *         Replaceable in v2 (Phase C).
 */
contract FunDIB is AccessControl {
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");
    bytes32 public constant BADGE_SYNC_ROLE = keccak256("BADGE_SYNC_ROLE");

    IFunDIDRegistry public immutable didRegistry;

    struct IdentityProfile {
        uint256 lightScore;
        uint256 contributionPoints;
        uint256 trustPoints;
        uint256 consistencyPoints;
        uint256 impactPoints;
        uint256 badgeCount;
        bool active;
        uint64 createdAt;
        uint64 updatedAt;
    }

    mapping(address => IdentityProfile) public profiles;

    event ProfileInitialized(address indexed user, string did);
    event ScoreUpdated(
        address indexed user,
        uint256 lightScore,
        uint256 contributionPoints,
        uint256 trustPoints,
        uint256 consistencyPoints,
        uint256 impactPoints
    );
    event BadgeCountIncremented(address indexed user, uint256 newBadgeCount);
    event ProfileStatusUpdated(address indexed user, bool active);

    constructor(address admin, address didRegistry_) {
        require(admin != address(0), "Invalid admin");
        require(didRegistry_ != address(0), "Invalid registry");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SCORER_ROLE, admin);
        _grantRole(BADGE_SYNC_ROLE, admin);
        didRegistry = IFunDIDRegistry(didRegistry_);
    }

    function _computeLightScore(IdentityProfile storage p) internal view returns (uint256) {
        return (p.contributionPoints * 40)
            + (p.trustPoints * 30)
            + (p.consistencyPoints * 20)
            + (p.impactPoints * 10);
    }

    function initProfile(address user) public {
        require(user != address(0), "Invalid user");
        IdentityProfile storage p = profiles[user];
        require(p.createdAt == 0, "Profile exists");
        string memory did = didRegistry.didOf(user);
        require(bytes(did).length != 0, "Missing DID");
        p.active = true;
        p.createdAt = uint64(block.timestamp);
        p.updatedAt = uint64(block.timestamp);
        emit ProfileInitialized(user, did);
    }

    function setScores(
        address user,
        uint256 contributionPoints,
        uint256 trustPoints,
        uint256 consistencyPoints,
        uint256 impactPoints
    ) external onlyRole(SCORER_ROLE) {
        IdentityProfile storage p = profiles[user];
        if (p.createdAt == 0) {
            initProfile(user);
        }
        p.contributionPoints = contributionPoints;
        p.trustPoints = trustPoints;
        p.consistencyPoints = consistencyPoints;
        p.impactPoints = impactPoints;
        p.lightScore = _computeLightScore(p);
        p.updatedAt = uint64(block.timestamp);
        emit ScoreUpdated(user, p.lightScore, contributionPoints, trustPoints, consistencyPoints, impactPoints);
    }

    function addScoreDelta(
        address user,
        uint256 contributionDelta,
        uint256 trustDelta,
        uint256 consistencyDelta,
        uint256 impactDelta
    ) external onlyRole(SCORER_ROLE) {
        IdentityProfile storage p = profiles[user];
        if (p.createdAt == 0) {
            initProfile(user);
        }
        p.contributionPoints += contributionDelta;
        p.trustPoints += trustDelta;
        p.consistencyPoints += consistencyDelta;
        p.impactPoints += impactDelta;
        p.lightScore = _computeLightScore(p);
        p.updatedAt = uint64(block.timestamp);
        emit ScoreUpdated(
            user,
            p.lightScore,
            p.contributionPoints,
            p.trustPoints,
            p.consistencyPoints,
            p.impactPoints
        );
    }

    function incrementBadgeCount(address user) external onlyRole(BADGE_SYNC_ROLE) {
        IdentityProfile storage p = profiles[user];
        if (p.createdAt == 0) {
            initProfile(user);
        }
        p.badgeCount += 1;
        p.updatedAt = uint64(block.timestamp);
        emit BadgeCountIncremented(user, p.badgeCount);
    }

    function setProfileStatus(address user, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IdentityProfile storage p = profiles[user];
        require(p.createdAt != 0, "Profile missing");
        p.active = active;
        p.updatedAt = uint64(block.timestamp);
        emit ProfileStatusUpdated(user, active);
    }

    function getProfile(address user) external view returns (IdentityProfile memory) {
        return profiles[user];
    }
}
