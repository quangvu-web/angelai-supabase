const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FunConnectorRegistry", () => {
  let reg, admin, writer, resolver, newcomer, connector, other;
  const TX = "0x" + "ab".repeat(32);
  const EVID = "0x" + "cd".repeat(32);
  const REASON = "0x" + "ef".repeat(32);
  const CHAIN_ID = 97;
  const BLOCK = 50_000_000n;

  beforeEach(async () => {
    [admin, writer, resolver, newcomer, connector, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("FunConnectorRegistry");
    reg = await F.deploy(admin.address);
    await reg.waitForDeployment();
    await reg.connect(admin).grantRole(await reg.CONNECTOR_WRITER_ROLE(), writer.address);
    await reg.connect(admin).grantRole(await reg.DISPUTE_RESOLVER_ROLE(), resolver.address);
  });

  it("registerConnection succeeds and emits event", async () => {
    await expect(
      reg.connect(writer).registerConnection(
        newcomer.address, connector.address, TX, CHAIN_ID, BLOCK, EVID
      )
    ).to.emit(reg, "ConnectionRegistered")
      .withArgs(newcomer.address, connector.address, TX, CHAIN_ID, BLOCK, EVID);

    expect(await reg.isConfirmed(newcomer.address)).to.equal(true);
    expect(await reg.connectorOf(newcomer.address)).to.equal(connector.address);
    expect(await reg.connectorCount(connector.address)).to.equal(1n);
  });

  it("rejects non-writer", async () => {
    await expect(
      reg.connect(other).registerConnection(
        newcomer.address, connector.address, TX, CHAIN_ID, BLOCK, EVID
      )
    ).to.be.reverted;
  });

  it("rejects double registration for same newcomer", async () => {
    await reg.connect(writer).registerConnection(
      newcomer.address, connector.address, TX, CHAIN_ID, BLOCK, EVID
    );
    await expect(
      reg.connect(writer).registerConnection(
        newcomer.address, other.address, TX, CHAIN_ID, BLOCK, EVID
      )
    ).to.be.revertedWith("slot taken");
  });

  it("rejects self-connection and zero inputs", async () => {
    await expect(
      reg.connect(writer).registerConnection(
        newcomer.address, newcomer.address, TX, CHAIN_ID, BLOCK, EVID
      )
    ).to.be.revertedWith("self-connection");

    await expect(
      reg.connect(writer).registerConnection(
        ethers.ZeroAddress, connector.address, TX, CHAIN_ID, BLOCK, EVID
      )
    ).to.be.revertedWith("newcomer=0");

    await expect(
      reg.connect(writer).registerConnection(
        newcomer.address, connector.address, ethers.ZeroHash, CHAIN_ID, BLOCK, EVID
      )
    ).to.be.revertedWith("txHash=0");
  });

  it("revokeConnection clears isConfirmed and decrements count", async () => {
    await reg.connect(writer).registerConnection(
      newcomer.address, connector.address, TX, CHAIN_ID, BLOCK, EVID
    );

    await expect(reg.connect(resolver).revokeConnection(newcomer.address, REASON))
      .to.emit(reg, "ConnectionRevoked")
      .withArgs(newcomer.address, connector.address, REASON);

    expect(await reg.isConfirmed(newcomer.address)).to.equal(false);
    expect(await reg.connectorOf(newcomer.address)).to.equal(ethers.ZeroAddress);
    expect(await reg.connectorCount(connector.address)).to.equal(0n);

    // double revoke fails
    await expect(
      reg.connect(resolver).revokeConnection(newcomer.address, REASON)
    ).to.be.revertedWith("already revoked");

    // slot stays taken — preserves audit trail
    await expect(
      reg.connect(writer).registerConnection(
        newcomer.address, other.address, TX, CHAIN_ID, BLOCK, EVID
      )
    ).to.be.revertedWith("slot taken");
  });

  it("non-resolver cannot revoke", async () => {
    await reg.connect(writer).registerConnection(
      newcomer.address, connector.address, TX, CHAIN_ID, BLOCK, EVID
    );
    await expect(
      reg.connect(other).revokeConnection(newcomer.address, REASON)
    ).to.be.reverted;
  });
});
