const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║        FUNMoneyMinter — Deployment                           ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("");

  // Configuration
  const config = {
    funToken: process.env.FUN_TOKEN_ADDRESS, // ERC20 FUN token with mint() support
    platformTreasury: process.env.PLATFORM_TREASURY || deployer.address,
  };

  if (!config.funToken) {
    console.error("ERROR: FUN_TOKEN_ADDRESS environment variable is required");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log("  Contract: FUNMoneyMinter");
  console.log("  FUN Token:", config.funToken);
  console.log("  Platform Treasury:", config.platformTreasury);
  console.log("  Split: 99% User (9900 BPS) / 1% Platform (100 BPS)");
  console.log("");

  // Deploy
  console.log("Deploying FUNMoneyMinter...");
  const FUNMoneyMinter = await hre.ethers.getContractFactory("FUNMoneyMinter");
  const minter = await FUNMoneyMinter.deploy(
    config.funToken,
    config.platformTreasury
  );

  await minter.waitForDeployment();
  const contractAddress = await minter.getAddress();

  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                    Deployment Complete!                       ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("  Contract Address:", contractAddress);
  console.log("");

  // Set up authorized minter (backend wallet)
  const backendMinter = process.env.BACKEND_MINTER_ADDRESS;
  if (backendMinter) {
    console.log("Setting authorized minter:", backendMinter);
    const tx = await minter.setAuthorizedMinter(backendMinter, true);
    await tx.wait();
    console.log("  ✓ Authorized minter set");
  }

  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contract on BscScan:");
  console.log(`     npx hardhat verify --network ${hre.network.name} ${contractAddress} "${config.funToken}" "${config.platformTreasury}"`);
  console.log("");
  console.log("  2. Grant MINTER_ROLE on FUN token to this contract:");
  console.log(`     funToken.grantRole(MINTER_ROLE, "${contractAddress}")`);
  console.log("");
  console.log("  3. Set authorized backend minter (if not done above):");
  console.log(`     minter.setAuthorizedMinter(<backend_wallet>, true)`);
  console.log("");
  console.log("  4. Update src/lib/funMoneyABI.ts with contract address:");
  console.log(`     FUN_MONEY_ADDRESSES[97] = "${contractAddress}"`);
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    contractAddress,
    contractName: "FUNMoneyMinter",
    version: "2.0.0",
    tag: "FUNMoneyMinter-v2.0.0",
    deployer: deployer.address,
    config,
    timestamp: new Date().toISOString(),
  };

  const fs = require("fs");
  const path = require("path");
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info saved to: deployments/${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
