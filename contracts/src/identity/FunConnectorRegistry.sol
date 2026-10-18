// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FunConnectorRegistry
 * @notice On-chain registry of "First On-Chain Giver" (Light Connector) relationships.
 *         Each newcomer wallet has exactly ONE confirmed connector — the first wallet
 *         to send them ≥ threshold tokens within their 48h window.
 *
 *         Public verifiability lets cross-app integrations (Globe, FUN.rich, Academy,
 *         third-party wallets) prove a connection exists without trusting a centralized DB.
 *
 *         Off-chain indexer (`connector-indexer` edge function) is the sole CONNECTOR_WRITER_ROLE
 *         holder in MVP. Disputes upheld by governance call `revokeConnection` to clear
 *         the slot and free the newcomer for a future re-claim (rare, audit-only).
 */
contract FunConnectorRegistry is AccessControl {
    bytes32 public constant CONNECTOR_WRITER_ROLE = keccak256("CONNECTOR_WRITER_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");

    struct Connection {
        address connector;       // the giver
        bytes32 txHash;          // origin tx that triggered the link
        uint64 blockNumber;      // block on source chain (BSC Testnet = 97)
        uint64 confirmedAt;      // unix seconds when registry recorded it
        uint16 chainId;          // source chain id (97 for BSC Testnet)
        bool revoked;            // true if dispute upheld
    }

    /// @notice newcomer wallet → connection record
    mapping(address => Connection) public connections;
    /// @notice connector wallet → number of confirmed (non-revoked) connections made
    mapping(address => uint256) public connectorCount;

    event ConnectionRegistered(
        address indexed newcomer,
        address indexed connector,
        bytes32 indexed txHash,
        uint16 chainId,
        uint64 blockNumber,
        bytes32 evidenceHash
    );
    event ConnectionRevoked(
        address indexed newcomer,
        address indexed connector,
        bytes32 indexed reasonHash
    );

    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Register a confirmed first-giver relationship. One slot per newcomer.
     * @param newcomer    Wallet that received the first qualifying transfer.
     * @param connector   Wallet that sent the first qualifying transfer.
     * @param txHash      Origin tx hash on source chain.
     * @param chainId     Source chain id.
     * @param blockNumber Source block number.
     * @param evidenceHash Off-chain evidence hash (sha256 of canonical payload).
     */
    function registerConnection(
        address newcomer,
        address connector,
        bytes32 txHash,
        uint16 chainId,
        uint64 blockNumber,
        bytes32 evidenceHash
    ) external onlyRole(CONNECTOR_WRITER_ROLE) {
        require(newcomer != address(0), "newcomer=0");
        require(connector != address(0), "connector=0");
        require(newcomer != connector, "self-connection");
        require(txHash != bytes32(0), "txHash=0");
        require(connections[newcomer].confirmedAt == 0, "slot taken");

        connections[newcomer] = Connection({
            connector: connector,
            txHash: txHash,
            blockNumber: blockNumber,
            confirmedAt: uint64(block.timestamp),
            chainId: chainId,
            revoked: false
        });
        unchecked { connectorCount[connector] += 1; }

        emit ConnectionRegistered(newcomer, connector, txHash, chainId, blockNumber, evidenceHash);
    }

    /**
     * @notice Revoke a previously registered connection (dispute upheld).
     *         Slot stays occupied with `revoked=true` so history is preserved
     *         but `isConfirmed` returns false. A new connection can NOT be
     *         registered for the same newcomer (preserves audit trail).
     * @param reasonHash keccak256 of the dispute reason text.
     */
    function revokeConnection(address newcomer, bytes32 reasonHash)
        external
        onlyRole(DISPUTE_RESOLVER_ROLE)
    {
        Connection storage c = connections[newcomer];
        require(c.confirmedAt != 0, "no connection");
        require(!c.revoked, "already revoked");
        c.revoked = true;
        unchecked {
            if (connectorCount[c.connector] > 0) connectorCount[c.connector] -= 1;
        }
        emit ConnectionRevoked(newcomer, c.connector, reasonHash);
    }

    /// @notice True if newcomer has a confirmed (non-revoked) connector.
    function isConfirmed(address newcomer) external view returns (bool) {
        Connection memory c = connections[newcomer];
        return c.confirmedAt != 0 && !c.revoked;
    }

    /// @notice Returns connector address (or zero if none / revoked).
    function connectorOf(address newcomer) external view returns (address) {
        Connection memory c = connections[newcomer];
        if (c.confirmedAt == 0 || c.revoked) return address(0);
        return c.connector;
    }
}
