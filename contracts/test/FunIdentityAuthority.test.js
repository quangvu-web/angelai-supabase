const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FunIdentityAuthority", () => {
  let registry, sbt, dib, authority, admin, alice, eve;

  beforeEach(async () => {
    [admin, alice, eve] = await ethers.getSigners();

    const R = await ethers.getContractFactory("FunDIDRegistry");
    registry = await R.deploy(admin.address);
    await registry.waitForDeployment();

    const S = await ethers.getContractFactory("FunSoulboundBadge");
    sbt = await S.deploy(admin.address);
    await sbt.waitForDeployment();

    const D = await ethers.getContractFactory("FunDIB");
    dib = await D.deploy(admin.address, await registry.getAddress());
    await dib.waitForDeployment();

    const A = await ethers.getContractFactory("FunIdentityAuthority");
    authority = await A.deploy(admin.address, await sbt.getAddress(), await dib.getAddress());
    await authority.waitForDeployment();

    // wire roles
    const authAddr = await authority.getAddress();
    await sbt.grantRole(await sbt.MINTER_ROLE(), authAddr);
    await dib.grantRole(await dib.SCORER_ROLE(), authAddr);
    await dib.grantRole(await dib.BADGE_SYNC_ROLE(), authAddr);

    await registry.connect(alice).registerSelf("ipfs://m");
  });

  it("issueBadgeAndReward mints SBT, increments badgeCount, applies score delta", async () => {
    const tx = await authority.connect(admin).issueBadgeAndReward(
      alice.address, 3, "ipfs://badge", 5, 10, 0, 0
    );
    await tx.wait();

    expect(await sbt.ownerOf(1)).to.equal(alice.address);
    const p = await dib.getProfile(alice.address);
    expect(p.badgeCount).to.equal(1n);
    // 5*40 + 10*30 = 200 + 300 = 500
    expect(p.lightScore).to.equal(500n);
  });

  it("updateReputationByAI applies delta only (no SBT mint)", async () => {
    await authority.connect(admin).updateReputationByAI(alice.address, 0, 0, 5, 5);
    const p = await dib.getProfile(alice.address);
    // 5*20 + 5*10 = 150
    expect(p.lightScore).to.equal(150n);
    expect(p.badgeCount).to.equal(0n);
  });

  it("non-issuer cannot issueBadgeAndReward", async () => {
    await expect(
      authority.connect(eve).issueBadgeAndReward(alice.address, 1, "ipfs://x", 1, 1, 1, 1)
    ).to.be.reverted;
  });

  it("non-AI cannot updateReputationByAI", async () => {
    await expect(
      authority.connect(eve).updateReputationByAI(alice.address, 1, 1, 1, 1)
    ).to.be.reverted;
  });
});
