import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Voting } from "../target/types/voting";

const IDL = require("../target/idl/voting.json");
const PROGRAM_ID = new PublicKey(IDL.address);

describe("Voting", () => {
  let context;
  let provider;
  let votingProgram: anchor.Program<Voting>;
  let pollId = new anchor.BN(1);
  const pollDescription = "What is your favorite color?";
  const candidateNames = ["Pink", "Blue"];

  beforeAll(async () => {
    context = await startAnchor('', [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(IDL, provider);
  });

  it("initializes a poll", async () => {
    const now = Math.floor(Date.now() / 1000);
  
    // Ensure that the poll starts in the future (poll_start should be in the future)
    const pollStart = now + 10; // Adding 10 seconds to ensure poll_start is in the future
    const pollEnd = now + 1000; // poll_end should be after poll_start
  
    // Generate poll public key using the pollId
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [pollId.toArrayLike(Buffer, "le", 8)],
      votingProgram.programId
    );
  
    let pollAccount = null;
  
    // Check if the poll account already exists
    try {
      pollAccount = await votingProgram.account.poll.fetch(pollAddress);
      console.log("Poll account already exists, will reset or delete it.");
      
      // Here, you may either reset or delete the poll account, depending on your program's requirements
      // One way is to use the `close` method if the poll is not needed anymore (or implement your own logic)
      // await votingProgram.methods.closePoll(pollId).rpc();  // Example method for deleting
    } catch (e) {
      console.log("Poll account does not exist, proceeding with initialization.");
    }
  
    // Initialize the poll with valid timestamps
    await votingProgram.methods.initializePoll(
      pollId,
      pollDescription,
      new anchor.BN(pollStart),
      new anchor.BN(pollEnd)
    ).rpc();
  
    // Test for invalid poll_end (non-positive)
    await expect(
      votingProgram.methods.initializePoll(
        pollId,
        pollDescription,
        new anchor.BN(now - 10),  // Ensure poll_start is not in the past
        new anchor.BN(0)  // Invalid poll_end
      ).rpc()
    ).rejects.toThrowError("Custom program error: 0x0"); // Catch the correct error
  });

  it("initializes candidates", async () => {
    // Generate poll public key using the pollId
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [pollId.toArrayLike(Buffer, "le", 8)],
      votingProgram.programId
    );

    // Ensure poll is initialized first
    const pollAccount = await votingProgram.account.poll.fetch(pollAddress);
    expect(pollAccount).toBeDefined(); // Assert that poll is initialized

    for (const name of candidateNames) {
      await votingProgram.methods.initializeCandidate(name, pollId).rpc();

      const [candidateAddress] = PublicKey.findProgramAddressSync(
        [pollId.toArrayLike(Buffer, "le", 8), Buffer.from(name)],
        votingProgram.programId
      );

      const candidate = await votingProgram.account.candidate.fetch(candidateAddress);

      console.log(`${name} candidate:`, {
        name: candidate.candidateName,
        votes: candidate.candidateVotes.toNumber(),
      });

      expect(candidate.candidateName).toBe(name);
      expect(candidate.candidateVotes.toNumber()).toBe(0);
    }
  });

  it("votes for candidates", async () => {
    const now = Math.floor(Date.now() / 1000);
    const pollStart = now + 10; // Poll starts in the future
    const pollEnd = now + 1000;
  
    // Initialize poll before voting
    await votingProgram.methods.initializePoll(
      pollId,
      pollDescription,
      new anchor.BN(pollStart),
      new anchor.BN(pollEnd)
    ).rpc();
  
    const votes = ["Pink", "Blue", "Pink"];
  
    for (const name of votes) {
      await votingProgram.methods.vote(name, pollId).rpc();
    }
  
    for (const name of candidateNames) {
      const [candidateAddress] = PublicKey.findProgramAddressSync(
        [pollId.toArrayLike(Buffer, "le", 8), Buffer.from(name)],
        votingProgram.programId
      );
  
      const candidate = await votingProgram.account.candidate.fetch(candidateAddress);
  
      console.log(`${name} candidate after votes:`, {
        name: candidate.candidateName,
        votes: candidate.candidateVotes.toNumber(),
      });
  
      const expectedVotes = votes.filter(v => v === name).length;
      expect(candidate.candidateVotes.toNumber()).toBe(expectedVotes);
    }
  });
});
