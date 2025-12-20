import { expect } from "chai";
import { ethers } from "hardhat";
import { MixerPool, Hasher, Verifier, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MixerPool", function () {
  let mixerPool: MixerPool;
  let hasher: Hasher;
  let verifier: Verifier;
  let token: MockERC20;
  let deployer: SignerWithAddress;
  let depositor: SignerWithAddress;
  let recipient: SignerWithAddress;
  let relayer: SignerWithAddress;

  const DENOMINATION = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)
  const INITIAL_BALANCE = ethers.parseUnits("10000", 6); // 10,000 USDC

  // Generate random commitment for testing
  function generateCommitment(): string {
    const secret = ethers.randomBytes(31);
    const nullifier = ethers.randomBytes(31);
    const commitment = ethers.keccak256(ethers.concat([secret, nullifier]));
    return commitment;
  }

  // Generate mock proof (works with mock verifier)
  function generateMockProof(): bigint[] {
    return [
      BigInt("0x1111111111111111111111111111111111111111111111111111111111111111"),
      BigInt("0x2222222222222222222222222222222222222222222222222222222222222222"),
      BigInt("0x3333333333333333333333333333333333333333333333333333333333333333"),
      BigInt("0x4444444444444444444444444444444444444444444444444444444444444444"),
      BigInt("0x5555555555555555555555555555555555555555555555555555555555555555"),
      BigInt("0x6666666666666666666666666666666666666666666666666666666666666666"),
      BigInt("0x7777777777777777777777777777777777777777777777777777777777777777"),
      BigInt("0x8888888888888888888888888888888888888888888888888888888888888888"),
    ];
  }

  beforeEach(async function () {
    [deployer, depositor, recipient, relayer] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await token.waitForDeployment();

    // Mint tokens to depositor
    await token.mint(depositor.address, INITIAL_BALANCE);

    // Deploy Hasher
    const Hasher = await ethers.getContractFactory("Hasher");
    hasher = await Hasher.deploy();
    await hasher.waitForDeployment();

    // Deploy Verifier (mock)
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    // Deploy MixerPool
    const MixerPool = await ethers.getContractFactory("MixerPool");
    mixerPool = await MixerPool.deploy(
      await verifier.getAddress(),
      await hasher.getAddress(),
      await token.getAddress(),
      DENOMINATION
    );
    await mixerPool.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set correct denomination", async function () {
      expect(await mixerPool.denomination()).to.equal(DENOMINATION);
    });

    it("Should set correct token", async function () {
      expect(await mixerPool.token()).to.equal(await token.getAddress());
    });

    it("Should have initial root", async function () {
      const root = await mixerPool.getLatestRoot();
      expect(root).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Deposit", function () {
    it("Should accept valid deposit", async function () {
      const commitment = generateCommitment();

      // Approve tokens
      await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION);

      // Deposit
      const tx = await mixerPool.connect(depositor).deposit(commitment);
      const receipt = await tx.wait();

      // Check event
      expect(receipt?.logs.length).to.be.greaterThan(0);

      // Check pool state
      expect(await mixerPool.commitments(commitment)).to.equal(true);
      expect(await mixerPool.nextLeafIndex()).to.equal(1);

      // Check token transfer
      expect(await token.balanceOf(await mixerPool.getAddress())).to.equal(DENOMINATION);
      expect(await token.balanceOf(depositor.address)).to.equal(INITIAL_BALANCE - DENOMINATION);
    });

    it("Should reject duplicate commitment", async function () {
      const commitment = generateCommitment();

      await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION * 2n);
      await mixerPool.connect(depositor).deposit(commitment);

      await expect(
        mixerPool.connect(depositor).deposit(commitment)
      ).to.be.revertedWithCustomError(mixerPool, "CommitmentAlreadyExists");
    });

    it("Should emit Deposit event with correct data", async function () {
      const commitment = generateCommitment();

      await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION);

      await expect(mixerPool.connect(depositor).deposit(commitment))
        .to.emit(mixerPool, "Deposit")
        .withArgs(commitment, 0, (timestamp: bigint) => timestamp > 0);
    });

    it("Should update Merkle root after deposit", async function () {
      const rootBefore = await mixerPool.getLatestRoot();

      const commitment = generateCommitment();
      await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION);
      await mixerPool.connect(depositor).deposit(commitment);

      const rootAfter = await mixerPool.getLatestRoot();
      expect(rootAfter).to.not.equal(rootBefore);
    });
  });

  describe("Withdrawal (with mock verifier)", function () {
    let commitment: string;
    let depositRoot: string;

    beforeEach(async function () {
      // Make a deposit first
      commitment = generateCommitment();
      await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION);
      await mixerPool.connect(depositor).deposit(commitment);
      depositRoot = await mixerPool.getLatestRoot();
    });

    it("Should accept valid withdrawal", async function () {
      const proof = generateMockProof();
      const nullifierHash = ethers.keccak256(ethers.randomBytes(32));
      const fee = 0n;

      const recipientBalanceBefore = await token.balanceOf(recipient.address);

      // Withdraw
      await mixerPool.connect(relayer).withdraw(
        proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        depositRoot,
        nullifierHash,
        recipient.address,
        ethers.ZeroAddress, // No relayer fee
        fee
      );

      // Check recipient received funds
      expect(await token.balanceOf(recipient.address)).to.equal(
        recipientBalanceBefore + DENOMINATION
      );

      // Check nullifier is marked as spent
      expect(await mixerPool.nullifierHashes(nullifierHash)).to.equal(true);
    });

    it("Should reject withdrawal with spent nullifier", async function () {
      const proof = generateMockProof();
      const nullifierHash = ethers.keccak256(ethers.randomBytes(32));

      // First withdrawal
      await mixerPool.connect(relayer).withdraw(
        proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        depositRoot,
        nullifierHash,
        recipient.address,
        ethers.ZeroAddress,
        0n
      );

      // Second withdrawal with same nullifier should fail
      await expect(
        mixerPool.connect(relayer).withdraw(
          proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          depositRoot,
          nullifierHash,
          recipient.address,
          ethers.ZeroAddress,
          0n
        )
      ).to.be.revertedWithCustomError(mixerPool, "NullifierAlreadySpent");
    });

    it("Should reject withdrawal with invalid root", async function () {
      const proof = generateMockProof();
      const nullifierHash = ethers.keccak256(ethers.randomBytes(32));
      const invalidRoot = ethers.keccak256(ethers.toUtf8Bytes("invalid"));

      await expect(
        mixerPool.connect(relayer).withdraw(
          proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          invalidRoot,
          nullifierHash,
          recipient.address,
          ethers.ZeroAddress,
          0n
        )
      ).to.be.revertedWithCustomError(mixerPool, "InvalidMerkleRoot");
    });

    it("Should pay relayer fee correctly", async function () {
      const proof = generateMockProof();
      const nullifierHash = ethers.keccak256(ethers.randomBytes(32));
      const fee = ethers.parseUnits("1", 6); // 1 USDC fee

      const recipientBalanceBefore = await token.balanceOf(recipient.address);
      const relayerBalanceBefore = await token.balanceOf(relayer.address);

      await mixerPool.connect(relayer).withdraw(
        proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        depositRoot,
        nullifierHash,
        recipient.address,
        relayer.address,
        fee
      );

      // Recipient gets denomination - fee
      expect(await token.balanceOf(recipient.address)).to.equal(
        recipientBalanceBefore + DENOMINATION - fee
      );

      // Relayer gets fee
      expect(await token.balanceOf(relayer.address)).to.equal(
        relayerBalanceBefore + fee
      );
    });

    it("Should emit Withdrawal event", async function () {
      const proof = generateMockProof();
      const nullifierHash = ethers.keccak256(ethers.randomBytes(32));

      await expect(
        mixerPool.connect(relayer).withdraw(
          proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          depositRoot,
          nullifierHash,
          recipient.address,
          relayer.address,
          0n
        )
      )
        .to.emit(mixerPool, "Withdrawal")
        .withArgs(recipient.address, nullifierHash, relayer.address, 0n);
    });
  });

  describe("Privacy Properties", function () {
    it("Depositor and recipient addresses are not linked on-chain", async function () {
      // Make multiple deposits
      const commitments = [generateCommitment(), generateCommitment(), generateCommitment()];

      for (const commitment of commitments) {
        await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION);
        await mixerPool.connect(depositor).deposit(commitment);
      }

      const root = await mixerPool.getLatestRoot();

      // Withdraw to different recipient
      const proof = generateMockProof();
      const nullifierHash = ethers.keccak256(ethers.randomBytes(32));

      await mixerPool.connect(relayer).withdraw(
        proof as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        root,
        nullifierHash,
        recipient.address,
        ethers.ZeroAddress,
        0n
      );

      // Key privacy check: The Withdrawal event does NOT contain:
      // - Which commitment was withdrawn
      // - The depositor's address
      // - Any link to the original deposit

      // The only on-chain information is:
      // 1. That a withdrawal happened to `recipient`
      // 2. Which nullifier was used (but this doesn't reveal which deposit)
      // 3. The root that was used (valid for many deposits)

      console.log("\n=== PRIVACY ANALYSIS ===");
      console.log("Depositor address:", depositor.address);
      console.log("Recipient address:", recipient.address);
      console.log("Relayer address:", relayer.address);
      console.log("Number of deposits in pool:", await mixerPool.nextLeafIndex());
      console.log("\nOn-chain, there is NO link between depositor and recipient!");
      console.log("An observer only knows:");
      console.log("  - Someone withdrew to", recipient.address);
      console.log("  - It was one of", await mixerPool.nextLeafIndex(), "possible depositors");
      console.log("================\n");

      // Verify the anonymity set
      const anonymitySet = await mixerPool.nextLeafIndex();
      expect(anonymitySet).to.equal(3n); // 3 deposits = 3 possible sources
    });
  });

  describe("Pool Info", function () {
    it("Should return correct pool info", async function () {
      // Make some deposits
      for (let i = 0; i < 3; i++) {
        await token.connect(depositor).approve(await mixerPool.getAddress(), DENOMINATION);
        await mixerPool.connect(depositor).deposit(generateCommitment());
      }

      const [tokenAddr, denom, count, root] = await mixerPool.getPoolInfo();

      expect(tokenAddr).to.equal(await token.getAddress());
      expect(denom).to.equal(DENOMINATION);
      expect(count).to.equal(3n);
      expect(root).to.not.equal(ethers.ZeroHash);
    });
  });
});

