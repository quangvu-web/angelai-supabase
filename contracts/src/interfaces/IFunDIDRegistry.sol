// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFunDIDRegistry {
    struct DIDDocument {
        string did;
        address owner;
        string metadataURI;
        bool active;
        uint64 createdAt;
        uint64 updatedAt;
    }

    function registerSelf(string calldata metadataURI) external returns (string memory);
    function registerFor(address owner, string calldata metadataURI) external returns (string memory);
    function updateMetadata(string calldata metadataURI) external;
    function setDelegate(address delegate, bool approved) external;
    function deactivateSelf() external;
    function getDocument(string calldata did) external view returns (DIDDocument memory);
    function didOf(address user) external view returns (string memory);
    function isDelegateOf(string calldata did, address operator) external view returns (bool);
}
