// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FunSoulboundBadge
 * @notice ERC721-compatible Soulbound Badge (non-transferable).
 *         - Mint by MINTER_ROLE only
 *         - Transfers/approvals disabled (true SBT)
 *         - Revocable (revoked flag, token still exists for audit)
 *
 * Badge type taxonomy (off-chain enum):
 *   1 = Early Believer        5 = Teacher
 *   2 = Contributor           6 = Community Giver
 *   3 = Trusted Collaborator  7 = Governance Steward
 *   4 = Pure Creator          8 = Milestone Achiever
 *   100+ = FUN Profile, 200+ = FUN Academy, 300+ = FUN Charity
 */
contract FunSoulboundBadge is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public nextTokenId = 1;

    struct BadgeData {
        uint16 badgeType;
        uint64 issuedAt;
        string metadataURI;
        bool revoked;
    }

    mapping(uint256 => BadgeData) public badgeInfo;
    mapping(address => uint256[]) private _ownedBadges;

    event BadgeMinted(address indexed to, uint256 indexed tokenId, uint16 badgeType, string metadataURI);
    event BadgeRevoked(uint256 indexed tokenId);

    constructor(address admin) ERC721("FUN Soulbound Badge", "FUNSBT") {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function mintBadge(address to, uint16 badgeType, string calldata metadataURI)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        require(to != address(0), "Invalid recipient");
        tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        badgeInfo[tokenId] = BadgeData({
            badgeType: badgeType,
            issuedAt: uint64(block.timestamp),
            metadataURI: metadataURI,
            revoked: false
        });
        _ownedBadges[to].push(tokenId);
        emit BadgeMinted(to, tokenId, badgeType, metadataURI);
    }

    function revokeBadge(uint256 tokenId) external onlyRole(MINTER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        require(!badgeInfo[tokenId].revoked, "Already revoked");
        badgeInfo[tokenId].revoked = true;
        emit BadgeRevoked(tokenId);
    }

    function badgesOf(address user) external view returns (uint256[] memory) {
        return _ownedBadges[user];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return badgeInfo[tokenId].metadataURI;
    }

    // === Soulbound enforcement (OZ v5 hook) ===
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert("Soulbound: approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: approvals disabled");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
