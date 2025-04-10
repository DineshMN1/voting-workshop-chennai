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

  beforeAll(async () => {
    context = await startAnchor('', [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(
      IDL,
      provider,
    );
  });

  it("initializes a poll", async () => {
    const now = Math.floor(Date.now() / 1000);

    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(now - 10),
      new anchor.BN(now + 1000),
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    console.log("Poll:", {
      pollId: poll.pollId.toNumber(),
      description: poll.description,
      start: poll.pollStart.toNumber(),
      end: poll.pollEnd.toNumber(),
    });

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(now - 10);
  });

  it("initializes candidates", async () => {
    await votingProgram.methods.initializeCandidate("Pink", new anchor.BN(1)).rpc();
    await votingProgram.methods.initializeCandidate("Blue", new anchor.BN(1)).rpc();

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);

    console.log("Pink candidate:", {
      name: pinkCandidate.candidateName,
      votes: pinkCandidate.candidateVotes.toNumber(),
    });

    expect(pinkCandidate.candidateVotes.toNumber()).toBe(0);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);

    console.log("Blue candidate:", {
      name: blueCandidate.candidateName,
      votes: blueCandidate.candidateVotes.toNumber(),
    });

    expect(blueCandidate.candidateVotes.toNumber()).toBe(0);
    expect(blueCandidate.candidateName).toBe("Blue");
  });

  it("votes for candidates", async () => {
    try {
      await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();
      await votingProgram.methods.vote("Blue", new anchor.BN(1)).rpc();
      await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();
    } catch (e) {
      console.error("Vote error:", e);
    }

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);

    console.log("Pink candidate after votes:", {
      name: pinkCandidate.candidateName,
      votes: pinkCandidate.candidateVotes.toNumber(),
    });

    expect(pinkCandidate.candidateVotes.toNumber()).toBe(2);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);

    console.log("Blue candidate after votes:", {
      name: blueCandidate.candidateName,
      votes: blueCandidate.candidateVotes.toNumber(),
    });

    expect(blueCandidate.candidateVotes.toNumber()).toBe(1);
    expect(blueCandidate.candidateName).toBe("Blue");
  });
});
