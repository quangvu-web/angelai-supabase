// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title FunDIDRegistry
 * @notice Registry-first DID for FUN Ecosystem.
 *         DID format: did:fun:<chainId>:<wallet>
 *         - Self-register or registrar-mode
 *         - Per-DID delegate keys
 *         - Soft deactivation (no destructive deletes)
 */
contract FunDIDRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct DIDDocument {
        string did;
        address owner;
        string metadataURI;
        bool active;
        uint64 createdAt;
        uint64 updatedAt;
    }

    mapping(address => string) public walletToDid;
    mapping(string => DIDDocument) private didDocs;
    mapping(string => mapping(address => bool)) public delegates;

    event DIDRegistered(address indexed owner, string did, string metadataURI);
    event DIDMetadataUpdated(string indexed did, string metadataURI);
    event DIDDelegateUpdated(string indexed did, address indexed delegate, bool approved);
    event DIDDeactivated(string indexed did);

    constructor(address admin) {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function _buildDID(address owner) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                "did:fun:",
                Strings.toString(block.chainid),
                ":",
                Strings.toHexString(uint160(owner), 20)
            )
        );
    }

    function registerSelf(string calldata metadataURI) external returns (string memory did) {
        require(bytes(walletToDid[msg.sender]).length == 0, "DID already exists");
        did = _buildDID(msg.sender);
        didDocs[did] = DIDDocument({
            did: did,
            owner: msg.sender,
            metadataURI: metadataURI,
            active: true,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        walletToDid[msg.sender] = did;
        emit DIDRegistered(msg.sender, did, metadataURI);
    }

    function registerFor(address owner, string calldata metadataURI)
        external
        onlyRole(REGISTRAR_ROLE)
        returns (string memory did)
    {
        require(owner != address(0), "Invalid owner");
        require(bytes(walletToDid[owner]).length == 0, "DID already exists");
        did = _buildDID(owner);
        didDocs[did] = DIDDocument({
            did: did,
            owner: owner,
            metadataURI: metadataURI,
            active: true,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        walletToDid[owner] = did;
        emit DIDRegistered(owner, did, metadataURI);
    }

    function updateMetadata(string calldata metadataURI) external {
        string memory did = walletToDid[msg.sender];
        require(bytes(did).length != 0, "DID not found");
        DIDDocument storage doc = didDocs[did];
        require(doc.active, "DID inactive");
        require(doc.owner == msg.sender, "Not DID owner");
        doc.metadataURI = metadataURI;
        doc.updatedAt = uint64(block.timestamp);
        emit DIDMetadataUpdated(did, metadataURI);
    }

    function setDelegate(address delegate, bool approved) external {
        require(delegate != address(0), "Invalid delegate");
        string memory did = walletToDid[msg.sender];
        require(bytes(did).length != 0, "DID not found");
        DIDDocument storage doc = didDocs[did];
        require(doc.active, "DID inactive");
        require(doc.owner == msg.sender, "Not DID owner");
        delegates[did][delegate] = approved;
        emit DIDDelegateUpdated(did, delegate, approved);
    }

    function deactivateSelf() external {
        string memory did = walletToDid[msg.sender];
        require(bytes(did).length != 0, "DID not found");
        DIDDocument storage doc = didDocs[did];
        require(doc.owner == msg.sender, "Not DID owner");
        require(doc.active, "Already inactive");
        doc.active = false;
        doc.updatedAt = uint64(block.timestamp);
        emit DIDDeactivated(did);
    }

    function getDocument(string calldata did) external view returns (DIDDocument memory) {
        return didDocs[did];
    }

    function didOf(address user) external view returns (string memory) {
        return walletToDid[user];
    }

    function isDelegateOf(string calldata did, address operator) external view returns (bool) {
        return delegates[did][operator];
    }
}
