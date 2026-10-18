const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FunDIB", () => {
  let registry, dib, admin, alice;

  beforeEach(async () => {
    [admin, alice] = await ethers.getSigners();
    const R = await ethers.getContractFactory("FunDIDRegistry");
    registry = await R.deploy(admin.address);
    await registry.waitForDeployment();

    const D = await ethers.getContractFactory("FunDIB");
    dib = await D.deploy(admin.address, await registry.getAddress());
    await dib.waitForDeployment();
  });

  it("initProfile requires DID", async () => {
    await expect(dib.initProfile(alice.address)).to.be.revertedWith("Missing DID");
    await registry.connect(alice).registerSelf("ipfs://m");
    await dib.initProfile(alice.address);
    const p = await dib.getProfile(alice.address);
    expect(p.active).to.equal(true);
    expect(p.createdAt).to.be.gt(0n);
  });

  it("setScores computes Light Score = 40c + 30t + 20cn + 10i", async () => {
    await registry.connect(alice).registerSelf("ipfs://m");
    await dib.connect(admin).setScores(alice.address, 10, 20, 30, 40);
    const p = await dib.getProfile(alice.address);
    // 10*40 + 20*30 + 30*20 + 40*10 = 400+600+600+400 = 2000
    expect(p.lightScore).to.equal(2000n);
  });

  it("addScoreDelta accumulates and recomputes", async () => {
    await registry.connect(alice).registerSelf("ipfs://m");
    await dib.connect(admin).setScores(alice.address, 1, 1, 1, 1);
    await dib.connect(admin).addScoreDelta(alice.address, 9, 9, 9, 9);
    const p = await dib.getProfile(alice.address);
    // 10*40+10*30+10*20+10*10 = 1000
    expect(p.lightScore).to.equal(1000n);
    expect(p.contributionPoints).to.equal(10n);
  });

  it("incrementBadgeCount auto-inits profile", async () => {
    await registry.connect(alice).registerSelf("ipfs://m");
    await dib.connect(admin).incrementBadgeCount(alice.address);
    const p = await dib.getProfile(alice.address);
    expect(p.badgeCount).to.equal(1n);
  });

  it("setProfileStatus by admin only", async () => {
    await registry.connect(alice).registerSelf("ipfs://m");
    await dib.connect(admin).setScores(alice.address, 1, 1, 1, 1);
    await dib.connect(admin).setProfileStatus(alice.address, false);
    const p = await dib.getProfile(alice.address);
    expect(p.active).to.equal(false);
    await expect(dib.connect(alice).setProfileStatus(alice.address, true)).to.be.reverted;
  });

  it("non-scorer cannot setScores", async () => {
    await registry.connect(alice).registerSelf("ipfs://m");
    await expect(dib.connect(alice).setScores(alice.address, 1, 1, 1, 1)).to.be.reverted;
  });
});
