import { beforeEach, describe, test } from '@jest/globals'
import { cachedAlgorandFixture } from '../fixture'
import { GetSubscribedTransactionsFromSender, SendXTransactions } from '../transactions'

describe('Subscribing using sync-oldest', () => {
  const localnet = cachedAlgorandFixture()

  beforeEach(localnet.beforeEach, 10e6)
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Only processes the first chain round when starting from beginning of chain', async () => {
    const { algod, testAccount, generateAccount } = localnet.context
    // Ensure that if we are at round 0 there is a different transaction that won't be synced
    await SendXTransactions(1, await generateAccount({ initialFunds: (3).algos() }), algod)
    const { lastTxnRound } = await SendXTransactions(1, testAccount, algod)

    const subscribed = await GetSubscribedTransactionsFromSender(
      { roundsToSync: 1, syncBehaviour: 'sync-oldest', watermark: 0, currentRound: lastTxnRound },
      testAccount,
      algod,
    )

    expect(subscribed.currentRound).toBe(lastTxnRound)
    expect(subscribed.newWatermark).toBe(1)
    expect(subscribed.syncedRoundRange).toEqual([1, 1])
    expect(subscribed.subscribedTransactions.length).toBe(0)
  })

  test('Only processes the first transaction after watermark when starting from an earlier round with other transactions', async () => {
    const { algod, testAccount } = localnet.context
    const { txns, lastTxnRound: olderTxnRound } = await SendXTransactions(2, testAccount, algod)
    const { lastTxnRound: currentRound } = await SendXTransactions(1, testAccount, algod)

    const subscribed = await GetSubscribedTransactionsFromSender(
      { roundsToSync: 1, syncBehaviour: 'sync-oldest', watermark: olderTxnRound - 1, currentRound },
      testAccount,
      algod,
    )

    expect(subscribed.currentRound).toBe(currentRound)
    expect(subscribed.newWatermark).toBe(olderTxnRound)
    expect(subscribed.syncedRoundRange).toEqual([olderTxnRound, olderTxnRound])
    expect(subscribed.subscribedTransactions.length).toBe(1)
    expect(subscribed.subscribedTransactions[0].id).toBe(txns[1].transaction.txID())
  })

  test('Process multiple transactions', async () => {
    const { algod, testAccount } = localnet.context
    const { txns, lastTxnRound, rounds } = await SendXTransactions(3, testAccount, algod)

    const subscribed = await GetSubscribedTransactionsFromSender(
      { roundsToSync: rounds[1] - rounds[0] + 1, syncBehaviour: 'sync-oldest', watermark: rounds[0] - 1, currentRound: lastTxnRound },
      testAccount,
      algod,
    )

    expect(subscribed.currentRound).toBe(lastTxnRound)
    expect(subscribed.newWatermark).toBe(rounds[1])
    expect(subscribed.syncedRoundRange).toEqual([rounds[0], rounds[1]])
    expect(subscribed.subscribedTransactions.length).toBe(2)
    expect(subscribed.subscribedTransactions[0].id).toBe(txns[0].transaction.txID())
    expect(subscribed.subscribedTransactions[1].id).toBe(txns[1].transaction.txID())
  })
})
