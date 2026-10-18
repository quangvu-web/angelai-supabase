const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const adminAddr = process.env.IDENTITY_ADMIN || deployer.address;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   FUN Identity MVP — Deploy (Registry + SBT + DIB + Auth)   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(" Network :", hre.network.name);
  console.log(" Deployer:", deployer.address);
  console.log(" Admin   :", adminAddr);
  console.log("");

  // 1) DID Registry
  console.log("→ Deploying FunDIDRegistry…");
  const Registry = await hre.ethers.getContractFactory("FunDIDRegistry");
  const registry = await Registry.deploy(adminAddr);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("  ✓", registryAddr);

  // 2) SBT
  console.log("→ Deploying FunSoulboundBadge…");
  const SBT = await hre.ethers.getContractFactory("FunSoulboundBadge");
  const sbt = await SBT.deploy(adminAddr);
  await sbt.waitForDeployment();
  const sbtAddr = await sbt.getAddress();
  console.log("  ✓", sbtAddr);

  // 3) DIB
  console.log("→ Deploying FunDIB…");
  const DIB = await hre.ethers.getContractFactory("FunDIB");
  const dib = await DIB.deploy(adminAddr, registryAddr);
  await dib.waitForDeployment();
  const dibAddr = await dib.getAddress();
  console.log("  ✓", dibAddr);

  // 4) Authority
  console.log("→ Deploying FunIdentityAuthority…");
  const Authority = await hre.ethers.getContractFactory("FunIdentityAuthority");
  const authority = await Authority.deploy(adminAddr, sbtAddr, dibAddr);
  await authority.waitForDeployment();
  const authorityAddr = await authority.getAddress();
  console.log("  ✓", authorityAddr);

  // Grant cross-contract roles
  console.log("");
  console.log("→ Granting roles to Authority…");
  const MINTER_ROLE = await sbt.MINTER_ROLE();
  const SCORER_ROLE = await dib.SCORER_ROLE();
  const BADGE_SYNC_ROLE = await dib.BADGE_SYNC_ROLE();

  await (await sbt.grantRole(MINTER_ROLE, authorityAddr)).wait();
  console.log("  ✓ SBT.MINTER_ROLE → Authority");
  await (await dib.grantRole(SCORER_ROLE, authorityAddr)).wait();
  console.log("  ✓ DIB.SCORER_ROLE → Authority");
  await (await dib.grantRole(BADGE_SYNC_ROLE, authorityAddr)).wait();
  console.log("  ✓ DIB.BADGE_SYNC_ROLE → Authority");

  // Persist deployment
  const out = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    admin: adminAddr,
    contracts: {
      FunDIDRegistry: registryAddr,
      FunSoulboundBadge: sbtAddr,
      FunDIB: dibAddr,
      FunIdentityAuthority: authorityAddr,
    },
    roles: {
      "SBT.MINTER_ROLE": [adminAddr, authorityAddr],
      "DIB.SCORER_ROLE": [adminAddr, authorityAddr],
      "DIB.BADGE_SYNC_ROLE": [adminAddr, authorityAddr],
    },
    version: "identity-mvp-1.0.0",
    timestamp: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = `identity-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify(out, null, 2));

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    Deployment Complete                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(" Saved → deployments/" + file);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
