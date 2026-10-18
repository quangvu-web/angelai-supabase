const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FunSoulboundBadge", () => {
  let sbt, admin, alice, bob;

  beforeEach(async () => {
    [admin, alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory("FunSoulboundBadge");
    sbt = await F.deploy(admin.address);
    await sbt.waitForDeployment();
  });

  it("mintBadge by MINTER_ROLE assigns token + records metadata", async () => {
    await sbt.connect(admin).mintBadge(alice.address, 2, "ipfs://b1");
    expect(await sbt.ownerOf(1)).to.equal(alice.address);
    const data = await sbt.badgeInfo(1);
    expect(data.badgeType).to.equal(2);
    expect(data.metadataURI).to.equal("ipfs://b1");
    expect(data.revoked).to.equal(false);
    const list = await sbt.badgesOf(alice.address);
    expect(list.length).to.equal(1);
  });

  it("transferFrom reverts (soulbound)", async () => {
    await sbt.connect(admin).mintBadge(alice.address, 1, "ipfs://x");
    await expect(
      sbt.connect(alice).transferFrom(alice.address, bob.address, 1)
    ).to.be.reverted;
  });

  it("approve and setApprovalForAll revert", async () => {
    await sbt.connect(admin).mintBadge(alice.address, 1, "ipfs://x");
    await expect(sbt.connect(alice).approve(bob.address, 1)).to.be.reverted;
    await expect(sbt.connect(alice).setApprovalForAll(bob.address, true)).to.be.reverted;
  });

  it("revokeBadge flips flag", async () => {
    await sbt.connect(admin).mintBadge(alice.address, 1, "ipfs://x");
    await sbt.connect(admin).revokeBadge(1);
    const data = await sbt.badgeInfo(1);
    expect(data.revoked).to.equal(true);
    await expect(sbt.connect(admin).revokeBadge(1)).to.be.revertedWith("Already revoked");
  });

  it("non-minter cannot mint", async () => {
    await expect(sbt.connect(alice).mintBadge(bob.address, 1, "ipfs://x"))
      .to.be.reverted;
  });
});
