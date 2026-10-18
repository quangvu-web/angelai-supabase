// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFunDIB {
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

    function initProfile(address user) external;
    function setScores(
        address user,
        uint256 contributionPoints,
        uint256 trustPoints,
        uint256 consistencyPoints,
        uint256 impactPoints
    ) external;
    function addScoreDelta(
        address user,
        uint256 contributionDelta,
        uint256 trustDelta,
        uint256 consistencyDelta,
        uint256 impactDelta
    ) external;
    function incrementBadgeCount(address user) external;
    function setProfileStatus(address user, bool active) external;
    function getProfile(address user) external view returns (IdentityProfile memory);
}
