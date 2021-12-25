import BigNumber from 'bignumber.js'
import {
  computeAccount,
  computeDecreasePosition,
  computeIncreasePosition,
  computeTradeWithPrice,
  computeAMMPrice,
  computeAMMTrade,
  computeOpenInterest
} from '../src/computation'
import { _0, _1 } from '../src/constants'
import {
  BigNumberish,
  PerpetualState,
  PerpetualStorage,
  LiquidityPoolStorage,
  AccountStorage,
  AccountComputed,
  AccountDetails,
  TradeFlag,
} from '../src/types'
import { normalizeBigNumberish } from '../src/utils'
import { extendExpect } from './helper'

extendExpect()

const defaultPool: LiquidityPoolStorage = {
  isSynced: true,
  isRunning: true,
  isFastCreationEnabled: false,
  insuranceFundCap: new BigNumber(10000),

  collateralDecimals: 18,
  transferringOperator: '0x0',
  creator: '0x0',
  operator: '0x0',
  collateral: '0x0',
  vault: '0x0',
  governor: '0x0',
  shareToken: '0x0',

  vaultFeeRate: new BigNumber(0.0002),
  poolCashBalance: _0, // set me later
  isAMMMaintenanceSafe: true,
  fundingTime: 1579601290,
  operatorExpiration: 1579601290,
  insuranceFund: _0,
  donatedInsuranceFund: _0,
  liquidityCap: _0,
  shareTransferDelay: 1,

  perpetuals: new Map() // set me later
}

const perpetual1: PerpetualStorage = {
  symbol: 0,
  underlyingSymbol: 'T',
  isMarketClosed: false,
  isTerminated: false,
  state: PerpetualState.NORMAL,
  oracle: '0x0',
  totalCollateral: _0,
  isInversePerpetual: false,

  markPrice: new BigNumber(6965),
  indexPrice: new BigNumber(7000),
  fundingRate: _0, // useless
  unitAccumulativeFunding: new BigNumber('9.9059375'),

  initialMarginRate: new BigNumber(0.1),
  maintenanceMarginRate: new BigNumber(0.05),
  operatorFeeRate: new BigNumber(0.0001),
  lpFeeRate: new BigNumber(0.0007),
  referrerRebateRate: new BigNumber(0.0),
  liquidationPenaltyRate: new BigNumber(0.005),
  keeperGasReward: new BigNumber(1),
  insuranceFundRate: new BigNumber(0.0001),
  openInterest: new BigNumber('10'),
  maxOpenInterestRate: new BigNumber('100'),

  halfSpread: { value: new BigNumber(0.001), minValue: _0, maxValue: _0 },
  openSlippageFactor: { value: new BigNumber('0.0142857142857142857142857142857'), minValue: _0, maxValue: _0 },
  closeSlippageFactor: { value: new BigNumber('0.0128571428571428571428571428571'), minValue: _0, maxValue: _0 },
  fundingRateFactor: { value: new BigNumber(0.005), minValue: _0, maxValue: _0 },
  fundingRateLimit: { value: new BigNumber(0.005), minValue: _0, maxValue: _0 },
  ammMaxLeverage: { value: new BigNumber(5), minValue: _0, maxValue: _0 },
  maxClosePriceDiscount: { value: new BigNumber(0.05), minValue: _0, maxValue: _0 },
  defaultTargetLeverage: { value: new BigNumber(10), minValue: _0, maxValue: _0 },
  baseFundingRate: { value: _0, minValue: _0, maxValue: _0 },

  ammCashBalance: _0, // assign me later
  ammPositionAmount: _0 // assign me later
}

const TEST_MARKET_INDEX0 = 0

// long normal
// availableCashBalance = 83941.29865625 - (9.9059375 * 2.3) = 83918.515
// poolMargin = 100000, 100001.851808570406996527364893
const poolStorage1: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('83941.29865625'),
  perpetuals: new Map([
    [
      TEST_MARKET_INDEX0,
      {
        ...perpetual1,
        ammPositionAmount: new BigNumber('2.3')
      }
    ]
  ])
}

// short unsafe
// availableCashBalance = 18119.79134375 - (9.9059375 * (-2.3)) = 18142.575
const poolStorage3: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('18119.79134375'),
  perpetuals: new Map([
    [
      TEST_MARKET_INDEX0,
      {
        ...perpetual1,
        ammPositionAmount: new BigNumber('-2.3')
      }
    ]
  ])
}

const accountStorage1: AccountStorage = {
  cashBalance: new BigNumber('7698.86'), // 10000 - 2300.23 + (-0.91)
  positionAmount: new BigNumber('2.3'),
  targetLeverage: new BigNumber('2'),
  entryValue: new BigNumber('2300.23'),
  entryFunding: new BigNumber('-0.91')
}

const accountStorage2: AccountStorage = {
  cashBalance: new BigNumber('-1301.14'), // 1000 - 2300.23 + (-0.91)
  positionAmount: new BigNumber('2.3'),
  targetLeverage: new BigNumber('2'),
  entryValue: new BigNumber('2300.23'),
  entryFunding: new BigNumber('-0.91')
}

const accountStorage3: AccountStorage = {
  cashBalance: new BigNumber('16301.14'), // 14000 + 2300.23 + 0.91
  positionAmount: new BigNumber('-2.3'),
  targetLeverage: new BigNumber('2'),
  entryValue: new BigNumber('-2300.23'),
  entryFunding: new BigNumber('0.91')
}

const accountStorage4: AccountStorage = {
  cashBalance: new BigNumber('10000'),
  positionAmount: _0,
  targetLeverage: new BigNumber('2'),
  entryValue: _0,
  entryFunding: _0
}

const accountDetails1 = computeAccount(poolStorage1, TEST_MARKET_INDEX0, accountStorage1)
const accountDetails3 = computeAccount(poolStorage1, TEST_MARKET_INDEX0, accountStorage3)
const accountDetails4 = computeAccount(poolStorage1, TEST_MARKET_INDEX0, accountStorage4)

describe('computeAccount', function() {
  interface ComputeAccountCase {
    name: string
    accountStorage: AccountStorage
    expectedOutput: AccountComputed
  }

  const expectOutput1: AccountComputed = {
    positionValue: new BigNumber('16019.5'),
    positionMargin: new BigNumber('1601.95'),
    maintenanceMargin: new BigNumber('800.975'),
    availableCashBalance: new BigNumber('7676.07634375'),
    marginBalance: new BigNumber('23695.57634375'), // 10000 + (6965 - 2300.23/2.3) * 2.3 - 23.69365625
    availableMargin: new BigNumber('22092.62634375'),
    withdrawableBalance: new BigNumber('22092.62634375'),
    isMMSafe: true,
    isIMSafe: true,
    isMarginSafe: true,
    leverage: new BigNumber('0.67608298910250483047318358956'),
    marginRatio: new BigNumber('0.0338041494551252415236591794781'), // 800.975 / (23695.57634375 - 1)
    entryPrice: new BigNumber('1000.1'),
    fundingPNL: new BigNumber('-23.69365625'), // 9.9059375 * 2.3 -(-0.91)
    pnl1: new BigNumber('13719.27'),
    pnl2: new BigNumber('13695.57634375'),
    roe: new BigNumber('1.369557634375'),
    liquidationPrice: _0
  }

  const expectOutput2: AccountComputed = {
    positionValue: new BigNumber('16019.5'),
    positionMargin: new BigNumber('1601.95'),
    maintenanceMargin: new BigNumber('800.975'),
    availableCashBalance: new BigNumber('-1323.92365625'),
    marginBalance: new BigNumber('14695.57634375'), // 1000 + (6965 - 2300.23/2.3) * 2.3 - 23.69365625
    availableMargin: new BigNumber('13092.62634375'),
    withdrawableBalance: new BigNumber('13092.62634375'),
    isMMSafe: true,
    isIMSafe: true,
    isMarginSafe: true,
    leverage: new BigNumber('1.09016412758395214281898646861'),
    marginRatio: new BigNumber('0.054508206379197607140949323431'), // 800.975 / (14695.57634375 - 1)
    entryPrice: new BigNumber('1000.1'),
    fundingPNL: new BigNumber('-23.69365625'), // 9.9059375 * 2.3 -(-0.91)
    pnl1: new BigNumber('13719.27'),
    pnl2: new BigNumber('13695.57634375'),
    roe: new BigNumber('13.69557634375'),
    liquidationPrice: new BigNumber('607.01134203051266779676547395')
  }

  const expectOutput3: AccountComputed = {
    positionValue: new BigNumber('16019.5'),
    positionMargin: new BigNumber('1601.95'),
    maintenanceMargin: new BigNumber('800.975'),
    availableCashBalance: new BigNumber('16323.92365625'),
    marginBalance: new BigNumber('304.42365625'), // 14000 + (2300.23/2.3 - 6965) * 2.3 - (-23.69365625)
    availableMargin: new BigNumber('-1298.52634375'), // marginBalance - positionMargin
    withdrawableBalance: _0,
    isMMSafe: false,
    isIMSafe: false,
    isMarginSafe: true,
    leverage: new BigNumber('52.795817564076301318381466837'),
    marginRatio: new BigNumber('2.63979087820381506591907334186'), // 800.975 / (304.42365625 - 1)
    entryPrice: new BigNumber('1000.1'),
    fundingPNL: new BigNumber('23.69365625'), // 9.9059375 * (-2.3) -(-0.91)
    pnl1: new BigNumber('-13719.27'),
    pnl2: new BigNumber('-13695.57634375'),
    roe: new BigNumber('-0.978255453125'),
    liquidationPrice: new BigNumber('6752.5436049518057336697968808')
  }

  const expectOutput4: AccountComputed = {
    positionValue: _0,
    positionMargin: _0,
    maintenanceMargin: _0,
    availableCashBalance: new BigNumber('10000'),
    marginBalance: new BigNumber('10000'),
    availableMargin: new BigNumber('10000'),
    withdrawableBalance: new BigNumber('10000'),
    isMMSafe: true,
    isIMSafe: true,
    isMarginSafe: true,
    leverage: _0,
    marginRatio: _0,
    entryPrice: _0,
    fundingPNL: _0,
    pnl1: _0,
    pnl2: _0,
    roe: _0,
    liquidationPrice: _0
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: 'long safe',
      accountStorage: accountStorage1,
      expectedOutput: expectOutput1
    },
    {
      name: 'long critical',
      accountStorage: accountStorage2,
      expectedOutput: expectOutput2
    },
    {
      name: 'short',
      accountStorage: accountStorage3,
      expectedOutput: expectOutput3
    },
    {
      name: 'flat',
      accountStorage: accountStorage4,
      expectedOutput: expectOutput4
    }
  ]

  successCases.forEach(element => {
    it(element.name, function() {
      const accountStorage = element.accountStorage
      const expectedOutput = element.expectedOutput
      const accountDetails = computeAccount(poolStorage1, TEST_MARKET_INDEX0, accountStorage)
      const computed = accountDetails.accountComputed
      expect(computed.positionValue).toBeBigNumber(expectedOutput.positionValue)
      expect(computed.positionMargin).toBeBigNumber(expectedOutput.positionMargin)
      expect(computed.maintenanceMargin).toBeBigNumber(expectedOutput.maintenanceMargin)
      expect(computed.availableCashBalance).toBeBigNumber(expectedOutput.availableCashBalance)
      expect(computed.marginBalance).toBeBigNumber(expectedOutput.marginBalance)
      expect(computed.availableMargin).toBeBigNumber(expectedOutput.availableMargin)
      expect(computed.withdrawableBalance).toBeBigNumber(expectedOutput.withdrawableBalance)
      expect(computed.isMMSafe).toEqual(expectedOutput.isMMSafe)
      expect(computed.isIMSafe).toEqual(expectedOutput.isIMSafe)
      expect(computed.isMarginSafe).toEqual(expectedOutput.isMarginSafe)
      expect(computed.leverage).toApproximate(expectedOutput.leverage)
      expect(computed.marginRatio).toApproximate(expectedOutput.marginRatio)
      expect(computed.entryPrice).not.toBeNull()
      if (computed.entryPrice && expectedOutput.entryPrice) {
        expect(computed.entryPrice).toBeBigNumber(expectedOutput.entryPrice)
      }
      expect(computed.fundingPNL).not.toBeNull()
      if (computed.fundingPNL && expectedOutput.fundingPNL) {
        expect(computed.fundingPNL).toBeBigNumber(expectedOutput.fundingPNL)
      }
      expect(computed.pnl1).not.toBeNull()
      if (computed.pnl1 && expectedOutput.pnl1) {
        expect(computed.pnl1).toBeBigNumber(expectedOutput.pnl1)
      }
      expect(computed.pnl2).not.toBeNull()
      if (computed.pnl2 && expectedOutput.pnl2) {
        expect(computed.pnl2).toBeBigNumber(expectedOutput.pnl2)
      }
      expect(computed.roe).not.toBeNull()
      if (computed.roe && expectedOutput.roe) {
        expect(computed.roe).toBeBigNumber(expectedOutput.roe)
      }
      expect(computed.liquidationPrice).not.toBeNull()
      if (computed.liquidationPrice && expectedOutput.liquidationPrice) {
        expect(computed.liquidationPrice).toApproximate(expectedOutput.liquidationPrice)
      }
    })
  })
})

describe('computeTrade fail', function() {
  it('decrease flat', function() {
    expect((): void => {
      computeDecreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage4, new BigNumber(7000), _1)
    }).toThrow()
  })

  it('decrease zero price', function() {
    expect((): void => {
      computeDecreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _0, _1)
    }).toThrow()
  })

  it('decrease zero amount', function() {
    expect((): void => {
      computeDecreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _1, _0)
    }).toThrow()
  })

  it('decrease large amount', function() {
    expect((): void => {
      computeDecreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _1, new BigNumber(1000))
    }).toThrow()
  })

  it('increase bad side', function() {
    expect((): void => {
      computeIncreasePosition(
        poolStorage1,
        TEST_MARKET_INDEX0,
        accountStorage1,
        new BigNumber(7000),
        _1.negated() // sell
      )
    }).toThrow()
  })

  it('increase zero price', function() {
    expect((): void => {
      computeIncreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _0, _1)
    }).toThrow()
  })

  it('increase zero amount', function() {
    expect((): void => {
      computeIncreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _1, _0)
    }).toThrow()
  })

  it('increase bad side', function() {
    expect((): void => {
      computeIncreasePosition(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _1, _0)
    }).toThrow()
  })

  it('computeTradeWithPrice zero price', function() {
    expect((): void => {
      computeTradeWithPrice(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _0, _1, _0, 0)
    }).toThrow()
  })

  it('computeTradeWithPrice zero amount', function() {
    expect((): void => {
      computeTradeWithPrice(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, _1, _0, _0, 0)
    }).toThrow()
  })
})

describe('computeTradeWithPrice', function() {
  interface TradeCase {
    name: string
    input: {
      accountDetails: AccountDetails
      price: BigNumberish
      amount: BigNumberish
      targetLeverage: BigNumberish
      feeRate: BigNumberish
    }
    expectedOutput: {
      account: {
        cashBalance: BigNumberish
        marginBalance: BigNumberish
        positionAmount: BigNumberish
        entryValue: BigNumberish
        entryFunding: BigNumberish
      }
      tradeIsSafe: boolean
      fee: BigNumberish
    }
  }

  //console.log(fundingResult.markPrice.toString())
  //fundingResult.unitAccumulativeFunding = 9.9059375
  //fundingResult.markPrice = 6965
  //new BigNumber('23694.9847500349122')
  const tradeCases: Array<TradeCase> = [
    {
      name: 'increase long',
      input: {
        accountDetails: accountDetails1,
        price: 2000,
        amount: 1,
        targetLeverage: 2,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 10000 - 20 - 4300.23 + 8.9959375
          cashBalance: '5688.7659375',
          /*
            10000 - 20 +
            (6965 * 3.3 - 4300.23) -
            (9.9059375 * 3.3 - 8.9959375),
          */
          marginBalance: '28640.57634375',
          positionAmount: '3.3',
          entryValue: '4300.23',
          entryFunding: '8.9959375'
        },
        tradeIsSafe: true,
        fee: 20
      }
    },
    {
      name: 'increase long with leverage cost',
      input: {
        accountDetails: accountDetails1,
        price: 7000,
        amount: 5,
        targetLeverage: 2,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 10000 - 350 - 37300.23 + 48.6196875
          cashBalance: '-27601.6103125',
          /*
            10000 - 350 +
            (6965 * 7.3 - 37300.23) -
            (9.9059375 * 7.3 - 48.6196875),
          */
          marginBalance: '23170.57634375',
          positionAmount: '7.3',
          entryValue: '37300.23',
          entryFunding: '48.6196875'
        },
        tradeIsSafe: true,
        fee: 350
      }
    },
    {
      name: 'increase long with loss',
      input: {
        accountDetails: accountDetails1,
        price: 10000,
        amount: 10,
        targetLeverage: 10,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 9000 - 102300.23 + 98.149375
          cashBalance: '-93202.080625',
          /*
            9000 +
            (6965 * 12.3 - 102300.23) -
            (9.9059375 * 12.3 - 98.149375),
          */
          marginBalance: '-7654.42365625',
          positionAmount: '12.3',
          entryValue: '102300.23',
          entryFunding: '98.149375'
        },
        tradeIsSafe: false,
        fee: 1000
      }
    },
    {
      name: 'decrease long',
      input: {
        accountDetails: accountDetails1,
        price: 2000,
        amount: -1, // sell
        targetLeverage: 2,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 10000 + 999.9 - 20 - (9.9059375 - (-0.91)/2.3 ) * 1
          // = 10969.59841032608695652174
          // 10969.59841032608695652174 - 1300.13 + (-0.514347826087)
          cashBalance: '9668.95406249999995652174',
          positionAmount: '1.3',
          entryValue: '1300.13',
          entryFunding: '-0.514347826087',
          /*
            10969.59841032608695652174 +
            (6965 * 1.3 - 1300.13) -
            (9.9059375 * 1.3 - (-0.514347826087)),
          */
          marginBalance: '18710.57634375'
        },
        tradeIsSafe: true,
        fee: 20
      }
    },
    {
      name: 'decrease long to zero',
      input: {
        accountDetails: accountDetails1,
        price: 2000,
        amount: -2.3, // sell
        targetLeverage: 1,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 10000 + 2299.77‬ - 46 - (9.9059375 * 2.3 - (-0.91))
          cashBalance: '12230.07634375',
          positionAmount: 0,
          entryValue: 0,
          entryFunding: 0,
          marginBalance: '12230.07634375'
        },
        tradeIsSafe: true,
        fee: 46
      }
    },
    {
      name: 'decrease long to short',
      input: {
        accountDetails: accountDetails1,
        price: 2000,
        amount: -3.3, // sell
        targetLeverage: 1,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 10000 + 2299.77‬ - 66 - (9.9059375 * 2.3 - (-0.91))
          // = 12210.07634375
          // 12210.07634375 - (-2000) + (-9.9059375)
          cashBalance: '14200.17040625',
          positionAmount: -1,
          entryValue: -2000,
          entryFunding: '-9.9059375',
          /*
            12210.07634375 + (2000 - 6965 * 1)
          */
          marginBalance: '7245.076343750000000000002'
        },
        tradeIsSafe: true,
        fee: 66
      }
    },
    {
      name: 'increase zero to long with cost',
      input: {
        accountDetails: accountDetails4,
        price: 7000,
        amount: 2,
        targetLeverage: 1,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 9860 - 14000 + 19.811875
          cashBalance: '-4120.188125',
          positionAmount: 2,
          entryValue: 14000,
          entryFunding: '19.811875',
          /*
            9860 + (6965 * 2 - 14000)
          */
          marginBalance: '9790'
        },
        tradeIsSafe: true,
        fee: 140
      }
    },
    {
      name: 'decrease zero to short with cost',
      input: {
        accountDetails: accountDetails4,
        price: 7000,
        amount: -2, // sell
        targetLeverage: 1,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 10000 - 140 = 9860
          // 9860 - (-14000) + (-19.811875)
          cashBalance: '23840.188125',
          positionAmount: -2,
          entryValue: -14000,
          entryFunding: '-19.811875',
          /*
            9860 + (14000-6965 * 2)
          */
          marginBalance: '9930'
        },
        tradeIsSafe: true,
        fee: 140
      }
    },
    {
      name: 'decrease short',
      input: {
        accountDetails: accountDetails3,
        price: 2000,
        amount: 1,
        targetLeverage: 2,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 14000 - 999.9 - 20 + (9.9059375 - (-0.91)/2.3 ) * 1
          // = 12990.401589673913
          // 12990.401589673913 - (-1300.13) + 0.514347826087
          cashBalance: '14291.0459375',
          positionAmount: '-1.3',
          entryValue: '-1300.13',
          entryFunding: '0.514347826087',
          /*
            12990.401589673913 +
            (1300.13 - 6965 * 1.3)
            + (9.9059375 * 1.3 - (-0.514347826087)),
          */
          marginBalance: '5249.42365625'
        },
        tradeIsSafe: true,
        fee: 20
      }
    },
    {
      name: 'decrease short to zero',
      input: {
        accountDetails: accountDetails3,
        price: 2000,
        amount: 2.3,
        targetLeverage: 2,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 14000 - 2299.77 - 46 + (9.9059375 * 2.3 - (-0.91))
          cashBalance: '11677.92365625',
          positionAmount: 0,
          entryValue: 0,
          entryFunding: 0,
          marginBalance: '11677.92365625'
        },
        tradeIsSafe: true,
        fee: 46
      }
    },
    {
      name: 'decrease short to long with leverage',
      input: {
        accountDetails: accountDetails3,
        price: 2000,
        amount: 3.3,
        targetLeverage: 0.1,
        feeRate: 0.01
      },
      expectedOutput: {
        account: {
          // 14000 - 2299.77 - 66 + (9.9059375 * 2.3 - (-0.91))
          // = 11657.92365625
          // 11657.92365625 - 2000 + 9.9059375
          cashBalance: '9667.82959375',
          positionAmount: 1,
          entryValue: 2000,
          entryFunding: '9.9059375',
          // 11657.92365625 + (6965-2000) * 1
          marginBalance: '16622.92365625'
        },
        tradeIsSafe: true,
        fee: 66
      }
    }
  ]

  tradeCases.forEach(element => {
    const input = element.input
    const name = element.name
    const expectedOutput = element.expectedOutput

    it(name, function() {
      const result = computeTradeWithPrice(
        poolStorage1,
        TEST_MARKET_INDEX0,
        input.accountDetails.accountStorage,
        input.price,
        input.amount,
        input.feeRate,
        0
      )
      expect(result.afterTrade.accountStorage.cashBalance).toApproximate(
        normalizeBigNumberish(expectedOutput.account.cashBalance)
      )
      expect(result.afterTrade.accountStorage.positionAmount).toBeBigNumber(
        normalizeBigNumberish(expectedOutput.account.positionAmount)
      )
      expect(result.afterTrade.accountStorage.entryValue).toBeBigNumber(
        normalizeBigNumberish(expectedOutput.account.entryValue)
      )
      expect(result.afterTrade.accountStorage.entryFunding).toApproximate(
        normalizeBigNumberish(expectedOutput.account.entryFunding)
      )
      expect(result.afterTrade.accountComputed.marginBalance).toApproximate(
        normalizeBigNumberish(expectedOutput.account.marginBalance)
      )
      expect(result.tradeIsSafe).toEqual(expectedOutput.tradeIsSafe)
    })
  })
})

describe('computeAMMPrice', function() {
  it(`amm holds long. trader sells`, function() {
    const { tradingPrice } = computeAMMPrice(poolStorage1, TEST_MARKET_INDEX0, '-0.5')
    expect(tradingPrice).toApproximate(new BigNumber('6976.9161'))
  })

  it(`amm holds long. trader buys without cross 0`, function() {
    const { tradingPrice } = computeAMMPrice(poolStorage1, TEST_MARKET_INDEX0, '0.5')
    expect(tradingPrice).toApproximate(new BigNumber('6992.4957785904151334990367462'))
  })

  it(`amm holds long. trader buys cross 0. spread only effects closing`, function() {
    const { tradingPrice } = computeAMMPrice(poolStorage1, TEST_MARKET_INDEX0, '3.3')
    expect(tradingPrice).toApproximate(new BigNumber('6996.0111344722143116062591487')) // 16083.3368085704069965273648933 + 7003.49993518790023177329029757141254665377
  })

  it(`amm holds short unsafe. trader sells cross 0. spread effects closing and part of opening`, function() {
    const { tradingPrice } = computeAMMPrice(poolStorage3, TEST_MARKET_INDEX0, '-3.3')
    // m0 = 18142.575 - 7000 * 2.3 when pos = 0
    expect(tradingPrice).toApproximate(new BigNumber('6948.0750493565200491506747091'))
  })

  it(`amm holds short unsafe. trader sells cross 0. spread effects all`, function() {
    const { tradingPrice } = computeAMMPrice(poolStorage3, TEST_MARKET_INDEX0, '-2.31')
    // m0 = 18142.575 - 7000 * 2.3 when pos = 0
    expect(tradingPrice).toApproximate(new BigNumber('6999.9925821499080742927358107'))
  })

  it(`buy too large`, function() {
    expect((): void => {
      computeAMMPrice(poolStorage1, TEST_MARKET_INDEX0, '95.398') // 2.3 to -93.098
    }).toThrow()
  })

  it(`sell too large`, function() {
    expect((): void => {
      computeAMMPrice(poolStorage1, TEST_MARKET_INDEX0, '-90.796') // 2.3 to 93.096
    }).toThrow()
  })
})

describe('computeAMMTrade', function() {
  it(`sell`, function() {
    const res = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, '-0.5', 0)
    expect(res.tradingPrice).toApproximate(new BigNumber('6976.9161')) // see computeAMMPrice's test case
    expect(res.totalFee).toApproximate(new BigNumber('3.48845805')) // lpFee = 2.441920635

    // 7698.86 - 6976.9161 * (-0.5) + 9.9059375 * (-0.5) - 6976.9161 * 0.5 * 0.001
    expect(res.trader.accountStorage.cashBalance).toApproximate(new BigNumber('11178.8766232'))
    // 83941.29865625 - 6976.9161 * 0.5 + 9.9059375 * (0.5) + 2.441920635
    expect(res.newPool.poolCashBalance).toApproximate(new BigNumber('80460.235495635'))
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.ammPositionAmount).toApproximate(new BigNumber('2.8'))
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.openInterest).toApproximate(new BigNumber('10'))
  })

  it(`buy without cross 0`, function() {
    const res = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, '0.5', 0)
    expect(res.tradingPrice).toApproximate(new BigNumber('6992.4957785904151334990367462')) // see computeAMMPrice's test case
    expect(res.totalFee).toApproximate(new BigNumber('3.4962478892952075667495183731')) // lpFee = 2.44737352250664529672466286117

    // 7698.86 - 6992.4957785904151334990367462 * (0.5) + 9.9059375 * (0.5) - 6992.4957785904151334990367462 * 0.5 * 0.001
    expect(res.trader.accountStorage.cashBalance).toApproximate(new BigNumber('4204.0688315654972256837321085'))
    // 83941.29865625 - 6992.4957785904151334990367462 * (-0.5) + 9.9059375 * (-0.5) + 2.44737352250664529672466286117
    expect(res.newPool.poolCashBalance).toApproximate(new BigNumber('87435.0409503177142120462430360'))
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.ammPositionAmount).toApproximate(new BigNumber('1.8'))
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.openInterest).toApproximate(new BigNumber('10'))
  })

  it(`buy cross 0`, function() {
    const res = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, '3.3', 0)
    expect(res.tradingPrice).toApproximate(new BigNumber('6996.0111344722143116062591487')) // see computeAMMPrice's test case
    expect(res.totalFee).toApproximate(new BigNumber('23.0868367437583072283006551907')) // lpFee = 16.1607857206308150598104586335

    // 7698.86 - 6996.0111344722143116062591487 * (3.3) + 9.9059375 * (3.3) - 6996.0111344722143116062591487 * 3.3 * 0.001
    expect(res.trader.accountStorage.cashBalance).toApproximate(new BigNumber('-15378.3739867520655355289558459'))
    // 83941.29865625 - 6996.0111344722143116062591487 * (-3.3) + 9.9059375 * (-3.3) + 16.1607857206308150598104586335
    expect(res.newPool.poolCashBalance).toApproximate(new BigNumber('107011.606591978938043360465649'))
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.ammPositionAmount).toApproximate(new BigNumber('-1'))
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.openInterest).toApproximate(new BigNumber('11'))
  })

  it(`(saw) buy+sell`, function() {
    const res1 = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, '0.5', 0)
    expect(res1.tradingPrice).toApproximate(new BigNumber('6992.4957785904151334990367462'))
    expect(res1.newPool.poolCashBalance).toApproximate(new BigNumber('87435.0409503177142120462430360')) // see the above case
    expect(res1.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.ammPositionAmount).toApproximate(new BigNumber('1.8'))
    expect(res1.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.openInterest).toApproximate(new BigNumber('10'))

    // availableCash = 87435.0409503177142120462430360 - 9.9059375 * (1.8) = 87417.2102628177142120462430360
    // m0 = 100005.870928541926673731114517
    const res2 = computeAMMTrade(res1.newPool, TEST_MARKET_INDEX0, res1.trader.accountStorage, '-0.5', 0)
    expect(res2.tradingPrice).toApproximate(new BigNumber('6980.4133389538758324702073441'))

    // 4204.0688315654972256837321085 - 6980.4133389538758324702073441 * (-0.5) + 9.9059375 * (-0.5) - 6980.4133389538758324702073441 * 0.5 * 0.001
    expect(res2.trader.accountStorage.cashBalance).toApproximate(new BigNumber('7685.8323256229582040026006769'))
    // 87435.0409503177142120462430360 - 6980.4133389538758324702073441 * (0.5) + 9.9059375 * (0.5) + 6980.4133389538758324702073441 * 0.5 * 0.0007
    expect(res2.newPool.poolCashBalance).toApproximate(new BigNumber('83952.2303942594101523525039365'))
    expect(res2.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.ammPositionAmount).toApproximate(new BigNumber('2.3'))
    expect(res2.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.openInterest).toApproximate(new BigNumber('10'))
  })
})

describe('computeAMMTrade should fail on limits', function() {
  it(`lower than keeperGasReward`, function() {
    const trader: AccountStorage = {
      ...accountStorage4,
      cashBalance: new BigNumber('1')
    }

    // trade should fail
    const amount = '0.0001'
    const query1 = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, trader, amount, 0)
    expect(query1.trader.accountComputed.withdrawableBalance).toBeBigNumber(new BigNumber('0'))
    expect(query1.tradeIsSafe).toBeFalsy()
    expect(query1.tradingPrice).toApproximate(normalizeBigNumberish('6992.495778590415133499'))

    // cost
    trader.cashBalance = trader.cashBalance.plus('0.07209882743690055486324990000')
    const query2 = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, trader, amount, 0)
    expect(query2.tradeIsSafe).toBeFalsy()
    expect(query2.trader.accountComputed.availableMargin).toApproximate(normalizeBigNumberish('-0.001'))

    // trade again, should success
    trader.cashBalance = trader.cashBalance.plus('0.001')
    const query3 = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, trader, amount, 0)
    expect(query3.tradeIsSafe).toBeTruthy()
    expect(query3.trader.accountComputed.availableMargin).toApproximate(normalizeBigNumberish('0'))
  })

  it(`exceeds open interest limit`, function() {
    const poolStorage = {
      ...poolStorage1,
      perpetuals: new Map([
        [
          TEST_MARKET_INDEX0,
          {
            ...(poolStorage1.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
            maxOpenInterestRate: new BigNumber(0.77),
          }
        ],
      ])
    }
    const res = computeAMMTrade(poolStorage, TEST_MARKET_INDEX0, accountStorage1, '3.3', 0)
    expect(res.newPool.perpetuals.get(TEST_MARKET_INDEX0)!.openInterest).toApproximate(new BigNumber('11'))
    poolStorage.perpetuals.get(TEST_MARKET_INDEX0)!.maxOpenInterestRate = new BigNumber(0.76)
    expect((): void => {
      computeAMMTrade(poolStorage, TEST_MARKET_INDEX0, accountStorage1, '3.3', 0)
    }).toThrow()
  })
})

// the same as Integration2Lev.test.ts of mai-protocol-v3
describe('computeAMMTrade with USE_TARGET_LEVERAGE', function() {
  let perpetual: PerpetualStorage = {
    symbol: 0,
    underlyingSymbol: 'T',
    isMarketClosed: false,
    isTerminated: false,
    state: PerpetualState.NORMAL,
    oracle: '0x0',
    totalCollateral: _0,
    isInversePerpetual: false,
  
    markPrice: new BigNumber(1000),
    indexPrice: new BigNumber(1000),
    fundingRate: _0, // useless
    unitAccumulativeFunding: new BigNumber('0'),
  
    initialMarginRate: new BigNumber(0.01),
    maintenanceMarginRate: new BigNumber(0.005),
    operatorFeeRate: new BigNumber(0.001),
    lpFeeRate: new BigNumber(0.001),
    referrerRebateRate: new BigNumber(0.2),
    liquidationPenaltyRate: new BigNumber(0.002),
    keeperGasReward: new BigNumber(0.5),
    insuranceFundRate: new BigNumber(0.5),
    openInterest: new BigNumber('0'),
    maxOpenInterestRate: new BigNumber('4'),
  
    halfSpread: { value: new BigNumber(0.01), minValue: _0, maxValue: _0 },
    openSlippageFactor: { value: new BigNumber('0.1'), minValue: _0, maxValue: _0 },
    closeSlippageFactor: { value: new BigNumber('0.06'), minValue: _0, maxValue: _0 },
    fundingRateFactor: { value: new BigNumber(0.01), minValue: _0, maxValue: _0 },
    fundingRateLimit: { value: new BigNumber(0), minValue: _0, maxValue: _0 },
    ammMaxLeverage: { value: new BigNumber(5), minValue: _0, maxValue: _0 },
    maxClosePriceDiscount: { value: new BigNumber(0.05), minValue: _0, maxValue: _0 },
    defaultTargetLeverage: { value: new BigNumber(1), minValue: _0, maxValue: _0 },
    baseFundingRate: { value: _0, minValue: _0, maxValue: _0 },
  
    ammCashBalance: _0,
    ammPositionAmount: _0
  }
  const poolStorage: LiquidityPoolStorage = {
    ...defaultPool,
    vaultFeeRate: new BigNumber('0.001'),
    poolCashBalance: new BigNumber('1000'),
    perpetuals: new Map([
      [ 0, perpetual ],
      [ 1, perpetual ],
    ])
  }
  const accountStorage: AccountStorage = {
    cashBalance: _0,
    positionAmount: _0,
    targetLeverage: new BigNumber('2'),
    entryValue: _0,
    entryFunding: _0
  }
  it(`addLiq + tradeWithLev long 3, short 2, short 2, long 1`, () => {
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, accountStorage, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 3450
    // margin = cash + positionValue = 0.5 + | positionValue | / 2xLev = 1500.5. so cash = -1499.5
    // cash = deposit - 3450 - 3450 * 0.003(fee). so deposit = 1960.85
    expect(res.tradingPrice).toBeBigNumber(normalizeBigNumberish('1150'))
    expect(res.totalFee).toBeBigNumber(normalizeBigNumberish('10.35'))
    expect(res.adjustCollateral).toBeBigNumber(normalizeBigNumberish('1960.85'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-1499.5'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('3'))
    expect(res.trader.accountComputed.marginBalance).toBeBigNumber(normalizeBigNumberish('1500.5'))
    expect(res.trader.accountComputed.isMMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toBeBigNumber(normalizeBigNumberish('4453.45')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-3'))

    // short 2 (partial close)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '-2', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -2100
    // (margin - 0.5) / 1 = (1500.5 - 0.5) / 3, margin = 500.5, so cash = -499.5
    // newCash = oldCash - withdraw + 2100 - 2100 * 0.003(fee). so withdraw = 1093.7
    expect(res.tradingPrice).toBeBigNumber(normalizeBigNumberish('1050'))
    expect(res.totalFee).toBeBigNumber(normalizeBigNumberish('6.3'))
    expect(res.adjustCollateral).toBeBigNumber(normalizeBigNumberish('-1093.7'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-499.5'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('1'))
    expect(res.trader.accountComputed.isMMSafe).toEqual(true)
    // AMM rebalance. margin = 1000 * 1 * 1% = 10
    // amm cash + mark pos. so cash = 10 + 1000 * 1
    // final transferFee, cash += 2100 * 0.001(fee)
    expect(res.newPool.poolCashBalance).toBeBigNumber(normalizeBigNumberish('2355.55')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-1'))

    // short 2 (close all + open)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '-2', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -1984.996757074682502
    // margin = cash + positionValue = 0.5 + | positionValue | / 2xLev = 500.5. so cash = 1500.5
    // idealMargin = oldCash + deltaCash + deposit - fee + mark newPos.
    // so deposit = 500.5 - (-499.5) - (1984...) + 1984... * 0.003 - (-1000) = 20.958233196541545506
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('992.498378537341251'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('5.95499027122404751'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('20.958233196541545506'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('1500.5'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('-1'))
    expect(res.trader.accountComputed.isMMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('372.53823968239218050')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('1'))

    // long 1 (close all)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 977.783065493367778
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('977.783065493367778'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('2.93334919648010333'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('-519.783585310152118666')) // ctk.balanceOf - last ctk.balanceOf
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('0'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('0'))
    expect(res.trader.accountComputed.isMMSafe).toEqual(true)
    // AMM rebalance. margin = 1000 * 1 * 1% = 10
    // amm cash + mark pos. so cash = 10 + 1000 * 1
    // final transferFee, cash += 2100 * 0.001(fee)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('1351.29908824125332628')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('0'))
  })
  it("deposit + long 3(auto deposit on demand)", async () => {
    // deposit
    const a = {
      ...accountStorage,
      cashBalance: new BigNumber('500')
    }
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, a, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 3450
    // margin = cash + positionValue = 0.5 + | positionValue | / 2xLev = 1500.5. so cash = -1499.5
    // newCash = oldCash + deposit - 3450 - 3450 * 0.003(fee). so deposit = 1460.85
    expect(res.tradingPrice).toBeBigNumber(normalizeBigNumberish('1150'))
    expect(res.totalFee).toBeBigNumber(normalizeBigNumberish('10.35'))
    expect(res.adjustCollateral).toBeBigNumber(normalizeBigNumberish('1460.85'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-1499.5'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('3'))
    expect(res.trader.accountComputed.marginBalance).toBeBigNumber(normalizeBigNumberish('1500.5'))
    expect(res.trader.accountComputed.isMMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toBeBigNumber(normalizeBigNumberish('4453.45')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-3'))
  })
  it("short 1 when MM < margin < IM, normal fees", async () => {
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, accountStorage, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)

    // close when MM < margin < IM, normal fees
    res.newPool.perpetuals.get(0)!.markPrice = new BigNumber('505')
    res.newPool.perpetuals.get(0)!.indexPrice = new BigNumber('505')
    expect(computeAccount(res.newPool, 0, res.trader.accountStorage).accountComputed.isIMSafe).toEqual(false)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '-1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -515.541132467602916841
    // newMargin = newCash + 505 * 2 = 505 * 2 * 0.01 + 0.5. so cash = -999.4
    // newCash = oldCash - withdraw + 515... - 515... * 0.003(fee). so withdraw = 13.894509070200108090477
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('515.541132467602916841'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('1.54662339740280875052'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('-13.894509070200108090477'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-999.4'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('2'))
    expect(res.trader.accountComputed.isIMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('3938.42440866486468608')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-2'))
  })
  it("short 1 when margin < mm, the profit is large enough, normal fees", async () => {
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, accountStorage, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)

    // user 2 longs. make a higher price
    res.newPool.perpetuals.get(0)!.markPrice = new BigNumber('501')
    res.newPool.perpetuals.get(0)!.indexPrice = new BigNumber('501')
    const res2 = computeAMMTrade(res.newPool, 0, accountStorage, '2', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 1070.964429859700685024
    expect(res2.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('5525.485394289560385709')) // poolCash + amm cash
    expect(res2.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-5'))

    // close when margin < MM, but profit is large, normal fees
    res = computeAMMTrade(res2.newPool, 0, res.trader.accountStorage, '-1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -521.201994206724030199
    // old lev = 501x, margin = 501 * 2 * 1% = cash + 501 * 2 + 0.5
    // cash = oldCash + deltaCash - fee - withdraw. so withdraw = 11.618388224103858108403
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('521.201994206724030199'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('1.56360598262017209060'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('-11.618388224103858108403'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-991.48'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('2'))
    expect(res.trader.accountComputed.isIMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('5004.80460207704307954')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-4'))
  })
  it("short 1 when mm unsafe (close positions will cause profit), reduced fees", async () => {
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, accountStorage, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)

    // close when margin < MM, reduces fees. margin should be IM
    res.newPool.perpetuals.get(0)!.markPrice = new BigNumber('500.3')
    res.newPool.perpetuals.get(0)!.indexPrice = new BigNumber('500.3')
    expect(computeAccount(res.newPool, 0, res.trader.accountStorage).accountComputed.isMMSafe).toEqual(false)
    expect(computeAccount(res.newPool, 0, res.trader.accountStorage).accountComputed.isMarginSafe).toEqual(true)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '-1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -510.522727823788730153
    // fee = 1.116727823788730153 (72% of normal fees)
    // withdraw = 0
    // margin = cash + positionValue = im + 0.5 = 10.506. so cash = -990.094
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('510.522727823788730153'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('1.116727823788730153'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('0'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-990.094'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('2'))
    expect(res.trader.accountComputed.isIMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('3943.299514784140846566')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-2'))
  })
  it("short 1 when safe (close positions will cause loss), fees = 0", async () => {
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, accountStorage, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)

    // user 2 sells. make a lower price
    res.newPool.perpetuals.get(0)!.markPrice = new BigNumber('506')
    res.newPool.perpetuals.get(0)!.indexPrice = new BigNumber('506')
    const res2 = computeAMMTrade(res.newPool, 0, accountStorage, '-4', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -2043.34531884932172233
    expect(res2.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('2412.148026469527599388')) // poolCash + amm cash
    expect(res2.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('1'))

    // close when margin < MM, reduces fees
    res = computeAMMTrade(res2.newPool, 0, res.trader.accountStorage, '-1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = -492.240720624875890864
    // required im = 10.12, margin(after trade) = 4.240720624875890864 < im
    // so withdraw = 0, fee = 0
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('492.240720624875890864'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('0'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('0'))
    expect(res.trader.accountStorage.cashBalance).toApproximate(normalizeBigNumberish('-1007.259279375124109136')) // oldCash + deltaCash - fee, keeperGasReward is still there
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('2'))
    expect(res.trader.accountComputed.isMMSafe).toEqual(false)
    expect(res.trader.accountComputed.isMarginSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('1919.907305844651708524')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('2'))
  })
  it("a very small amount. long small amount from 0 position, margin = value / lev + keeperGasReward", async () => {
    // long 1e-7 (open)
    let res = computeAMMTrade(poolStorage, 0, accountStorage, '1e-7', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 0.000101
    // margin = cash + positionValue = 0.5 + | positionValue | / 2xLev = 0.50005. so cash = 0.49995
    // deposit = newCash + deltaCash = 0.49995 + 1010 * 1e-7 + 1010 * 1e-7 * 0.003 = 0.500051303
    expect(res.tradingPrice).toBeBigNumber(normalizeBigNumberish('1010'))
    expect(res.totalFee).toBeBigNumber(normalizeBigNumberish('0.000000303'))
    expect(res.adjustCollateral).toBeBigNumber(normalizeBigNumberish('0.500051303'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('0.49995'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('1e-7'))
    expect(res.trader.accountComputed.marginBalance).toBeBigNumber(normalizeBigNumberish('0.50005'))
    expect(res.trader.accountComputed.isIMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toBeBigNumber(normalizeBigNumberish('1000.000101101')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-1e-7'))
  })
  it("long + long", async () => {
    // deposit
    const a = {
      ...accountStorage,
      cashBalance: new BigNumber('500')
    }
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, a, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)

    // long 1 (open)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 1347.829178578730146
    // deposit = deltaPosition * mark / 2xLev + pnl + fee = 1000 / 2 + 347.829178578730146 + 1347.829178578730146 * 0.003 = 851.872666114466336438
    // newCash = old cash - deltaCash + deposit - fee = -1499.5 - 1347.829178578730146 + 847.829178578730146 = -1999.5
    // margin = newCash + mark * position = -1999.5 + 4 * 1000 = 2000.5
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('1347.829178578730146'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('4.043487535736190438'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('851.872666114466336438'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-1999.5'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('4'))
    expect(res.trader.accountComputed.marginBalance).toBeBigNumber(normalizeBigNumberish('2000.5'))
    expect(res.trader.accountComputed.isIMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('5802.627007757308876146')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-4'))
  })
  it("unsafe long + long", async () => {
    // deposit
    const a = {
      ...accountStorage,
      cashBalance: new BigNumber('500')
    }
    // long 3 (open)
    let res = computeAMMTrade(poolStorage, 0, a, '3', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    res.newPool.perpetuals.get(0)!.markPrice = new BigNumber('100')
    res.newPool.perpetuals.get(0)!.indexPrice = new BigNumber('100')
    expect(computeAccount(res.newPool, 0, res.trader.accountStorage).accountComputed.isIMSafe).toBeFalsy()
    
    // long 1 (open)
    res = computeAMMTrade(res.newPool, 0, res.trader.accountStorage, '1', TradeFlag.MASK_USE_TARGET_LEVERAGE)
    // amm deltaCash = 101.729704413161927575
    // margin = initialMargin = 4 * 100 * 0.01 = 4
    // newCash = margin - mark * pos = 4 - 100 * 4 = -396
    // deposit = newMargin - oldMargin - pnl + fee = 4.5 - (-1199.5) - (-1.729704413161927575) + 101.729704413161927575 * 0.003 = 1206.034893526401413357725
    expect(res.tradingPrice).toApproximate(normalizeBigNumberish('101.729704413161927575'))
    expect(res.totalFee).toApproximate(normalizeBigNumberish('0.305189113239485782725'))
    expect(res.adjustCollateral).toApproximate(normalizeBigNumberish('1206.034893526401413357725'))
    expect(res.trader.accountStorage.cashBalance).toBeBigNumber(normalizeBigNumberish('-395.5'))
    expect(res.trader.accountStorage.positionAmount).toBeBigNumber(normalizeBigNumberish('4'))
    expect(res.trader.accountComputed.marginBalance).toBeBigNumber(normalizeBigNumberish('4.5'))
    expect(res.trader.accountComputed.isIMSafe).toEqual(true)
    expect(res.newPool.poolCashBalance).toApproximate(normalizeBigNumberish('4555.281434117575089503')) // poolCash + amm cash
    expect(res.newPool.perpetuals.get(0)!.ammPositionAmount).toBeBigNumber(normalizeBigNumberish('-4'))
  })
})

describe('computeOpenInterest', function() {
  it(`1 account`, function() {
    let openInterest = _0
    // 0 -> 5
    openInterest = computeOpenInterest(openInterest, new BigNumber('0'), new BigNumber('5'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('5'))
    // 5 -> 7
    openInterest = computeOpenInterest(openInterest, new BigNumber('5'), new BigNumber('2'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('7'))
    // 7 -> 5
    openInterest = computeOpenInterest(openInterest, new BigNumber('7'), new BigNumber('-2'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('5'))
    // 5 -> -2
    openInterest = computeOpenInterest(openInterest, new BigNumber('5'), new BigNumber('-7'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('0'))
    // -2 -> -5
    openInterest = computeOpenInterest(openInterest, new BigNumber('-2'), new BigNumber('-3'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('0'))
    // -5 -> -3
    openInterest = computeOpenInterest(openInterest, new BigNumber('-5'), new BigNumber('2'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('0'))
    // -3 -> 1
    openInterest = computeOpenInterest(openInterest, new BigNumber('-3'), new BigNumber('4'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('1'))
    // 1 -> 0
    openInterest = computeOpenInterest(openInterest, new BigNumber('1'), new BigNumber('-1'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('0'))
    // 0 -> -1
    openInterest = computeOpenInterest(openInterest, new BigNumber('0'), new BigNumber('-1'))
    expect(openInterest).toBeBigNumber(normalizeBigNumberish('0'))
  })
})
