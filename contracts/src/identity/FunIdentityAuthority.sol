// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IFunSoulboundBadge {
    function mintBadge(address to, uint16 badgeType, string calldata metadataURI) external returns (uint256);
}

interface IFunDIB {
    function incrementBadgeCount(address user) external;
    function addScoreDelta(
        address user,
        uint256 contributionDelta,
        uint256 trustDelta,
        uint256 consistencyDelta,
        uint256 impactDelta
    ) external;
}

/**
 * @title FunIdentityAuthority
 * @notice Coordinator that mints SBT + updates DIB atomically.
 *         - ISSUER_ROLE: human/curated badge issuance
 *         - AI_ROLE: Angel A.I. reputation deltas (no badge mint)
 */
contract FunIdentityAuthority is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant AI_ROLE = keccak256("AI_ROLE");

    IFunSoulboundBadge public immutable sbt;
    IFunDIB public immutable dib;

    event ContributionBadgeIssued(address indexed user, uint16 badgeType, uint256 tokenId);
    event ReputationUpdated(address indexed user);

    constructor(address admin, address sbt_, address dib_) {
        require(admin != address(0), "Invalid admin");
        require(sbt_ != address(0) && dib_ != address(0), "Invalid module");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(AI_ROLE, admin);
        sbt = IFunSoulboundBadge(sbt_);
        dib = IFunDIB(dib_);
    }

    function issueBadgeAndReward(
        address user,
        uint16 badgeType,
        string calldata metadataURI,
        uint256 contributionDelta,
        uint256 trustDelta,
        uint256 consistencyDelta,
        uint256 impactDelta
    ) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        tokenId = sbt.mintBadge(user, badgeType, metadataURI);
        dib.incrementBadgeCount(user);
        dib.addScoreDelta(user, contributionDelta, trustDelta, consistencyDelta, impactDelta);
        emit ContributionBadgeIssued(user, badgeType, tokenId);
        emit ReputationUpdated(user);
    }

    function updateReputationByAI(
        address user,
        uint256 contributionDelta,
        uint256 trustDelta,
        uint256 consistencyDelta,
        uint256 impactDelta
    ) external onlyRole(AI_ROLE) {
        dib.addScoreDelta(user, contributionDelta, trustDelta, consistencyDelta, impactDelta);
        emit ReputationUpdated(user);
    }
}
