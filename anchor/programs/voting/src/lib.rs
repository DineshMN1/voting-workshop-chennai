#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_poll(
        ctx: Context<InitializePoll>,
        poll_id: u64,
        description: String,
        poll_start: u64,
        poll_end: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
    
        // Ensure poll_start is in the future
        if poll_start <= current_time {
            return Err(VotingError::PollStartInPast.into());
        }
    
        // Ensure poll_end is in the future and greater than poll_start
        if poll_end <= current_time {
            return Err(VotingError::PollEndInPast.into());
        }
    
        // Ensure poll_end is after poll_start
        if poll_end <= poll_start {
            return Err(VotingError::PollEndBeforeStart.into());
        }
    
        // Ensure poll_end is a valid Unix Timestamp (i.e., it's a positive integer)
        if poll_end <= 0 {
            return Err(VotingError::InvalidTimestamp.into());
        }
    
        let poll = &mut ctx.accounts.poll;
        poll.poll_id = poll_id;
        poll.description = description;
        poll.poll_start = poll_start;
        poll.poll_end = poll_end;
        poll.candidate_amount = 0;
        poll.total_votes = 0;
    
        Ok(())
    }
    

    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,
        candidate_name: String,
        _poll_id: u64,
    ) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate;
        candidate.candidate_name = candidate_name;
        candidate.candidate_votes = 0;

        let poll = &mut ctx.accounts.poll;
        poll.candidate_amount += 1;
        msg!("Candidate {} added to poll {}", candidate.candidate_name, poll.poll_id);
        msg!("Poll {} has {} candidates", poll.poll_id, poll.candidate_amount);
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, _candidate_name: String, _poll_id: u64) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;

        let poll = &mut ctx.accounts.poll;

        if current_time < poll.poll_start {
            return Err(VotingError::PollNotStarted.into());
        }

        if current_time > poll.poll_end {
            return Err(VotingError::PollEnded.into());
        }

        let voter_record = &mut ctx.accounts.voter_record;
        if voter_record.has_voted {
            return Err(VotingError::AlreadyVoted.into());
        }
        voter_record.has_voted = true;

        let candidate = &mut ctx.accounts.candidate;
        candidate.candidate_votes += 1;

        poll.total_votes += 1;

        msg!("Voted for candidate: {}", candidate.candidate_name);
        msg!("Votes: {}", candidate.candidate_votes);
        msg!("Total votes in poll: {}", poll.total_votes);
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct VoterRecord {
    pub has_voted: bool,
}

#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()],
        bump
    )]
    pub candidate: Account<'info, Candidate>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + VoterRecord::INIT_SPACE,
        seeds = [b"voter", signer.key().as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
        constraint = !voter_record.has_voted @ VotingError::AlreadyVoted,
    )]
    pub voter_record: Account<'info, VoterRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(candidate_name: String, poll_id: u64)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        init,
        payer = signer,
        space = 8 + Candidate::INIT_SPACE,
        seeds = [poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()],
        bump
    )]
    pub candidate: Account<'info, Candidate>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Candidate {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer = signer,
        space = 8 + Poll::INIT_SPACE,
        seeds = [poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll: Account<'info, Poll>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub poll_id: u64,
    #[max_len(200)]
    pub description: String,
    pub poll_start: u64,
    pub poll_end: u64,
    pub candidate_amount: u64,
    pub total_votes: u64,
}

#[error_code]
pub enum VotingError {
    #[msg("Poll has not started yet")]
    PollNotStarted,
    #[msg("Poll has ended")]
    PollEnded,
    #[msg("Poll end time is before or equal to start time")]
    PollEndBeforeStart,
    #[msg("Poll start time is in the past")]
    PollStartInPast,
    #[msg("Poll end time is in the past")]
    PollEndInPast,
    #[msg("You have already voted in this poll")]
    AlreadyVoted,
    #[msg("Invalid Unix timestamp")]
    InvalidTimestamp,
}
