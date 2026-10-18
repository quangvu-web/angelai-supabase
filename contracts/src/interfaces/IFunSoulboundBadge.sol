// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFunSoulboundBadge {
    function mintBadge(address to, uint16 badgeType, string calldata metadataURI) external returns (uint256);
    function revokeBadge(uint256 tokenId) external;
    function badgesOf(address user) external view returns (uint256[] memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
