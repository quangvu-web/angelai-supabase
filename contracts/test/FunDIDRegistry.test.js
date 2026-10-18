const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FunDIDRegistry", () => {
  let registry, admin, alice, bob;

  beforeEach(async () => {
    [admin, alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory("FunDIDRegistry");
    registry = await F.deploy(admin.address);
    await registry.waitForDeployment();
  });

  it("registerSelf creates DID with did:fun:<chainId>:<wallet>", async () => {
    const tx = await registry.connect(alice).registerSelf("ipfs://meta1");
    await tx.wait();
    const did = await registry.didOf(alice.address);
    expect(did.startsWith("did:fun:")).to.equal(true);
    expect(did.toLowerCase().endsWith(alice.address.toLowerCase())).to.equal(true);
  });

  it("rejects duplicate registerSelf", async () => {
    await registry.connect(alice).registerSelf("ipfs://m");
    await expect(registry.connect(alice).registerSelf("ipfs://m2"))
      .to.be.revertedWith("DID already exists");
  });

  it("registerFor only by REGISTRAR_ROLE", async () => {
    await expect(registry.connect(alice).registerFor(bob.address, "ipfs://x"))
      .to.be.reverted;
    await registry.connect(admin).registerFor(bob.address, "ipfs://x");
    expect(await registry.didOf(bob.address)).to.not.equal("");
  });

  it("updateMetadata only by owner", async () => {
    await registry.connect(alice).registerSelf("ipfs://a");
    await registry.connect(alice).updateMetadata("ipfs://b");
    const did = await registry.didOf(alice.address);
    const doc = await registry.getDocument(did);
    expect(doc.metadataURI).to.equal("ipfs://b");
  });

  it("setDelegate + isDelegateOf", async () => {
    await registry.connect(alice).registerSelf("ipfs://a");
    const did = await registry.didOf(alice.address);
    await registry.connect(alice).setDelegate(bob.address, true);
    expect(await registry.isDelegateOf(did, bob.address)).to.equal(true);
    await registry.connect(alice).setDelegate(bob.address, false);
    expect(await registry.isDelegateOf(did, bob.address)).to.equal(false);
  });

  it("deactivateSelf disables further updates", async () => {
    await registry.connect(alice).registerSelf("ipfs://a");
    await registry.connect(alice).deactivateSelf();
    await expect(registry.connect(alice).updateMetadata("ipfs://b"))
      .to.be.revertedWith("DID inactive");
  });
});
