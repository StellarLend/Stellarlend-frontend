import {
  Address,
  Contract,
  Keypair,
  Operation,
  TimeoutInfinite,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import fs from "node:fs/promises";
import path from "node:path";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "http://localhost:8000/rpc";
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || "http://localhost:8000";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Standalone Network ; February 2017";

const WASM_PATH =
  process.env.LENDING_WASM_PATH ||
  path.resolve(process.cwd(), "contracts", "stellar_lend_lending.wasm");

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRpcReady(server: rpc.Server, timeoutMs = 60000) {
  const start = Date.now();
  console.log(`Checking RPC health at ${RPC_URL}...`);
  while (Date.now() - start < timeoutMs) {
    try {
      const health = await server.getHealth();
      if (health.status === "healthy") {
        console.log("Soroban RPC is healthy!");
        return;
      }
    } catch {
      // Retry
    }
    await wait(2000);
  }
  throw new Error(`Timeout waiting for RPC at ${RPC_URL}`);
}

async function fundKeypair(publicKey: string) {
  console.log(`Funding account ${publicKey} via Friendbot...`);
  const friendbotUrl = `${HORIZON_URL}/friendbot?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(friendbotUrl);
  if (!res.ok) {
    throw new Error(`Friendbot funding failed for ${publicKey}: ${res.status} ${await res.text()}`);
  }
  console.log(`Funded ${publicKey}`);
}

async function main() {
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  await waitForRpcReady(server);

  const adminKeypair = Keypair.random();
  const userKeypair = Keypair.random();

  console.log(`Admin Public: ${adminKeypair.publicKey()}`);
  console.log(`User Public:  ${userKeypair.publicKey()}`);

  await fundKeypair(adminKeypair.publicKey());
  await fundKeypair(userKeypair.publicKey());
  await wait(1500);

  let contractId = process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID;

  if (!contractId) {
    console.log(`Reading WASM from ${WASM_PATH}...`);
    let wasmBytes: Buffer;
    try {
      wasmBytes = await fs.readFile(WASM_PATH);
    } catch (err: unknown) {
      throw new Error(
        `Could not read WASM file at ${WASM_PATH}. Set LENDING_WASM_PATH or build the contract first: ${err}`
      );
    }

    const adminAccount = await server.getAccount(adminKeypair.publicKey());

    console.log("Installing WASM code...");
    const installOp = Operation.uploadContractWasm({ wasm: wasmBytes });
    let installTx = new TransactionBuilder(adminAccount, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(installOp)
      .setTimeout(TimeoutInfinite)
      .build();

    installTx = await server.prepareTransaction(installTx);
    installTx.sign(adminKeypair);
    const installRes = await server.sendTransaction(installTx);

    let txStatus = await server.getTransaction(installRes.hash);
    while (txStatus.status === "NOT_FOUND") {
      await wait(1000);
      txStatus = await server.getTransaction(installRes.hash);
    }
    if (txStatus.status !== "SUCCESS") {
      throw new Error(`WASM upload failed with status: ${txStatus.status}`);
    }

    const wasmHashVal = txStatus.returnValue ? scValToNative(txStatus.returnValue) : null;
    const wasmHash: Buffer = Buffer.isBuffer(wasmHashVal)
      ? wasmHashVal
      : typeof wasmHashVal === "string"
      ? Buffer.from(wasmHashVal, "hex")
      : (installOp as unknown as { wasm: Buffer }).wasm;

    console.log(`Installed WASM.`);

    console.log("Creating contract instance...");
    const adminAccForDeploy = await server.getAccount(adminKeypair.publicKey());
    const createOp = Operation.createCustomContract({
      address: new Address(adminKeypair.publicKey()),
      wasmHash,
    });

    let createTx = new TransactionBuilder(adminAccForDeploy, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(createOp)
      .setTimeout(TimeoutInfinite)
      .build();

    createTx = await server.prepareTransaction(createTx);
    createTx.sign(adminKeypair);
    const deployRes = await server.sendTransaction(createTx);

    let deployStatus = await server.getTransaction(deployRes.hash);
    while (deployStatus.status === "NOT_FOUND") {
      await wait(1000);
      deployStatus = await server.getTransaction(deployRes.hash);
    }
    if (deployStatus.status !== "SUCCESS") {
      throw new Error(`Contract deployment failed: ${deployStatus.status}`);
    }

    const returnAddress = deployStatus.returnValue ? scValToNative(deployStatus.returnValue) : null;
    contractId = typeof returnAddress === "string" ? returnAddress : Address.fromScVal(deployStatus.returnValue!).toString();
    console.log(`Deployed Lending Contract ID: ${contractId}`);
  }

  console.log(`Initializing contract ${contractId}...`);
  const adminAccount = await server.getAccount(adminKeypair.publicKey());
  const contract = new Contract(contractId!);

  let initTx = new TransactionBuilder(adminAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("initialize", new Address(adminKeypair.publicKey()).toScVal())
    )
    .setTimeout(TimeoutInfinite)
    .build();

  initTx = await server.prepareTransaction(initTx);
  initTx.sign(adminKeypair);
  const initRes = await server.sendTransaction(initTx);

  let initStatus = await server.getTransaction(initRes.hash);
  while (initStatus.status === "NOT_FOUND") {
    await wait(1000);
    initStatus = await server.getTransaction(initRes.hash);
  }
  console.log(`Initialized contract. Status: ${initStatus.status}`);

  const depositAmount = 1_000_000_000n;
  console.log(`Depositing ${depositAmount} for user ${userKeypair.publicKey()}...`);

  const userAccount = await server.getAccount(userKeypair.publicKey());
  let depositTx = new TransactionBuilder(userAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "deposit",
        new Address(userKeypair.publicKey()).toScVal(),
        nativeToScVal(depositAmount, { type: "i128" })
      )
    )
    .setTimeout(TimeoutInfinite)
    .build();

  depositTx = await server.prepareTransaction(depositTx);
  depositTx.sign(userKeypair);
  const depRes = await server.sendTransaction(depositTx);

  let depStatus = await server.getTransaction(depRes.hash);
  while (depStatus.status === "NOT_FOUND") {
    await wait(1000);
    depStatus = await server.getTransaction(depRes.hash);
  }
  console.log(`Deposit completed with status: ${depStatus.status}`);

  const envContent = [
    `NEXT_PUBLIC_LENDING_CONTRACT_ID=${contractId}`,
    `NEXT_PUBLIC_SOROBAN_RPC_URL=${RPC_URL}`,
    `NEXT_PUBLIC_HORIZON_URL=${HORIZON_URL}`,
    `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE}"`,
    `TEST_ADMIN_PUBLIC_KEY=${adminKeypair.publicKey()}`,
    `TEST_ADMIN_SECRET=${adminKeypair.secret()}`,
    `TEST_USER_PUBLIC_KEY=${userKeypair.publicKey()}`,
    `TEST_USER_SECRET=${userKeypair.secret()}`,
    `TEST_DEPOSIT_AMOUNT=${depositAmount}`,
  ].join("\n");

  const envPath = path.resolve(process.cwd(), ".env.integration");
  await fs.writeFile(envPath, envContent, "utf8");
  console.log(`Integration test environment configuration written to ${envPath}`);
}

main().catch((err) => {
  console.error("Integration setup failed:", err);
  process.exit(1);
});
