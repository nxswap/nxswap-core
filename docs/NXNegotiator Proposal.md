# NXNegotiator (NXSwap Negotiator) **(Draft)**

(Party A) The Maker

(Party B) The Taker

Partys communicate throughout the negotiation process using PBMsgr 

## Proposed Negotiation Process

**(Party A) Create Proposal**

Party A Creates a proposal to swap with a peer.

```
A Currency:
B Currency:
A Amount:
B Amount:
B Pubkey:
Expires
```

An expiry time of 60 seconds is set. 
The proposal is signed and issued to Party B

Party B must accept the proposal within the expiry time (subject to contract).

**(Party B) Consider Proposal**

Once Party B has received the proposal, they can review the proposed trade and either accept, decline, or ignore the proposal.

If accepting, the expiry time should be reset to 10 minutes.

Party B should sign the proposal and issue it back to Party A

**(Party A) Start Contract Negotiation**

If Party B has accepted the proposal, the negotiation must be completed and the maker transaction issued onto the blockchain. If Party A’s transaction appears on the blockchain, after the expiry time set by Party B, Party B has the right to not continue with the Swap. At that point Party A must wait out to refund the transaction.
Realistically the negotiation process should take a matter of seconds, and therefore the expiry time is in place to allow time for the transaction to appear on the associated cryptocurrency network.

## The negotiation process is proposed as follows:

(Party A): Request B Currency address from Party B

(Party B): Send B Currency address to Party A

(Party A): Create proposed Atomic Swap contract

(Party A): Create proposed Currency A Transaction (unsigned)

(Party A): Create new Currency B address

(Party A): Create new Atomic Swap shared secret & hash

(Party A): Issue proposed Atomic Swap Contract, Currency A Transaction, Party A’s Currency B Address and Atomic Swap Shared Secret Hash to Party B

(Party B): Review and Audit Party A’s Atomic Swap Contract.

(Party B): Review and verify Party A’s Currency A's proposed transaction

(Party B): Create Party B’s Atomic Swap Contract

(Party B): Create Party B’s Proposed Currency B Transaction (unsigned)

(Party B): Issue Party B's Atomic Swap Contract & Currency B Transaction to Party A

(Party A): Review and Audit Party A’s Atomic Swap Contract

(Party A): Review and verify Party A’s Currency B Transaction

(Party A): Request Swap Start Approval From Party B (An acknowledgement of agreement on contract and permission to Start Swap)

(Party B): Issue Swap Start Approval to Party A

(Party A): Sign Currency A Transaction & Broadcast to Currency A Network

(Party A): Notify Party B that the Swap has started and the transaction has been broadcast. (Although as a courtesy. Party B will already be monitoring the contract address of Party A until the proposal has expired).


## The rest of the process is on-chain and no further communication is required between Party A & B.

(Party B): Monitor the transaction of Party A, on Currency A Network, verify it as per contract

(Party B): Wait for required confirmations of Currency A

(Party B): Sign Currency B Transaction and Broadcast to Currency B Network

(Party A): Monitor Currency B Network for Party A’s transaction

(Party A): Wait for Party B’s transaction on Currency B to reach required confirmations

(Party A): Sweep Party B’s contract using the Atomic Swap Secret Hash

(Party B): Monitor Party B’s transaction, once the funds have been swept, extract the Atomic Swap Secret

(Party B): Using the Atomic Swap Secret, sweep Party A’s funds from the Currency A Network

**Atomic Swap Completed!**