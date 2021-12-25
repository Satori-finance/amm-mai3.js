import BigNumber from 'bignumber.js'
import {
  initAMMTradingContext,
  computeAMMInternalTrade,
  computeAMMPoolMargin,
  isAMMSafe,
  computeDeltaMargin,
  computeAMMSafeShortPositionAmount,
  computeAMMSafeLongPositionAmount,
  computeBestAskBidPrice,
  computeFundingRate,
  computeAMMShareToMint,
  computeAMMCashToReturn,
  computeMaxRemovableShare
} from '../src/amm'
import { _0, _1 } from '../src/constants'
import { PerpetualState, PerpetualStorage, LiquidityPoolStorage, InsufficientLiquidityError } from '../src/types'
import { normalizeBigNumberish } from '../src/utils'
import { extendExpect } from './helper'

extendExpect()

const defaultPool: LiquidityPoolStorage = {
  isSynced: true,
  isRunning: true,
  isFastCreationEnabled: false,
  insuranceFundCap: new BigNumber(10000),

  collateralDecimals: 18,
  creator: '0x0',
  transferringOperator: '0x0',
  operator: '0x0',
  collateral: '0x0',
  vault: '0x0',
  governor: '0x0',
  shareToken: '0x0',

  vaultFeeRate: new BigNumber(0.0001),
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

  markPrice: new BigNumber(95),
  indexPrice: new BigNumber(100),
  fundingRate: _0, // useless
  unitAccumulativeFunding: new BigNumber('1.9'),

  initialMarginRate: new BigNumber(0.1),
  maintenanceMarginRate: new BigNumber(0.05),
  operatorFeeRate: new BigNumber(0.0001),
  lpFeeRate: new BigNumber(0.0008),
  referrerRebateRate: new BigNumber(0.0),
  liquidationPenaltyRate: new BigNumber(0.005),
  keeperGasReward: new BigNumber(2),
  insuranceFundRate: new BigNumber(0.0001),
  openInterest: new BigNumber('10'),
  maxOpenInterestRate: new BigNumber('100'),

  halfSpread: { value: new BigNumber(0.001), minValue: _0, maxValue: _0 },
  openSlippageFactor: { value: new BigNumber(1), minValue: _0, maxValue: _0 },
  closeSlippageFactor: { value: new BigNumber(0.9), minValue: _0, maxValue: _0 },
  fundingRateFactor: { value: new BigNumber(0.005), minValue: _0, maxValue: _0 },
  fundingRateLimit: { value: new BigNumber(0.005), minValue: _0, maxValue: _0 },
  ammMaxLeverage: { value: new BigNumber(3), minValue: _0, maxValue: _0 },
  maxClosePriceDiscount: { value: new BigNumber(0.2), minValue: _0, maxValue: _0 },
  defaultTargetLeverage: { value: new BigNumber(10), minValue: _0, maxValue: _0 },
  baseFundingRate: { value: _0, minValue: _0, maxValue: _0 },

  ammCashBalance: _0, // assign me later
  ammPositionAmount: _0 // assign me later
}

const TEST_MARKET_INDEX0 = 0
const TEST_MARKET_INDEX1 = 1

const poolInit: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: _0,
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: _0 }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: _0 }]
  ])
}

// [0] zero
// available cash = 10000
// available margin = 10000, 10000
// max pos2 = 100, -141.42135623730950488
const poolStorage0: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('10000'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: _0 }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: _0 }]
  ])
}

// [1] short 1: normal
// available cash = 10100 - 1.9 * (-10) - 1.9 * (10) = 10100
// available margin = 10000, 10005.0479311506160242805
// max pos2 = -141.067359796658844252
const poolStorage1: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('10100'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('-10') }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: new BigNumber('10') }]
  ])
}

// [2] short 2: loss but safe
// available cash = 14599 - 1.9 * (-50) - 1.9 * (10) = 14675
// available margin = 9273.09477715884768908142691791, 9428.820844177342198192
// max pos2 = -130.759540184393963844
const poolStorage2: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('14599'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('-50') }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: new BigNumber('10') }]
  ])
}

// [3] short 3: unsafe
// available cash = 17692 - 1.9 * (-80) - 1.9 * (10) = 17825
// available margin = unsafe / unsafe
const poolStorage3: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('17692'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('-80') }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: new BigNumber('10') }]
  ])
}

// [4] long 1: normal
// available cash = 8138 - 1.9 * (10) - 1.9 * (10)= 8100
// available margin = 10000, 10005.0479311506160242805
// max pos2 = 100
const poolStorage4: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('8138'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('10') }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: new BigNumber('10') }]
  ])
}

// [5] long 2: loss but safe
// available cash = 1664 - 1.9 * (50) - 1.9 * (10) = 1550
// available margin = 4893.31346231725208539935787445, 5356.336460086846919343
// max pos2 = 48.933134623172520854
const poolStorage5: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('1664'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('50') }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: new BigNumber('10') }]
  ])
}

// [6]
// long 3: unsafe
// available cash = 1996 - 1.9 * (80) - 1.9 * (10) = 1825
// available margin = unsafe / unsafe
const poolStorage6: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('1996'),
  perpetuals: new Map([
    [TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('80') }],
    [TEST_MARKET_INDEX1, { ...perpetual1, ammPositionAmount: new BigNumber('10') }]
  ])
}

describe('computeM0', function() {
  const beta = new BigNumber('1')

  interface ComputeAccountCase {
    amm: LiquidityPoolStorage
    availableCash: BigNumber
    isAMMSafe: boolean
    poolMargin: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      amm: poolInit,
      availableCash: new BigNumber('0'),
      isAMMSafe: true,
      poolMargin: new BigNumber('0')
    },
    {
      amm: poolStorage0,
      availableCash: new BigNumber('10000'),
      isAMMSafe: true,
      poolMargin: new BigNumber('10000')
    },
    {
      amm: poolStorage1,
      availableCash: new BigNumber('10100'),
      isAMMSafe: true,
      poolMargin: new BigNumber('10000')
    },
    {
      amm: poolStorage2,
      availableCash: new BigNumber('14675'),
      isAMMSafe: true,
      poolMargin: new BigNumber('9273.09477715884768908142691791')
    },
    {
      amm: poolStorage3,
      availableCash: new BigNumber('17825'),
      isAMMSafe: false,
      poolMargin: _0
    },
    {
      amm: poolStorage4,
      availableCash: new BigNumber('8100'),
      isAMMSafe: true,
      poolMargin: new BigNumber('10000')
    },
    {
      amm: poolStorage5,
      availableCash: new BigNumber('1550'),
      isAMMSafe: true,
      poolMargin: new BigNumber('4893.31346231725208539935787445')
    },
    {
      amm: poolStorage6,
      availableCash: new BigNumber('1825'),
      isAMMSafe: false,
      poolMargin: _0
    }
  ]

  successCases.forEach((element, index) => {
    it(`${index}`, function() {
      const context1 = initAMMTradingContext(element.amm, TEST_MARKET_INDEX0)
      expect(context1.cash).toApproximate(normalizeBigNumberish(element.availableCash))

      const safe = isAMMSafe(context1, beta)
      expect(safe).toEqual(element.isAMMSafe)

      if (element.isAMMSafe) {
        const context2 = computeAMMPoolMargin(context1, beta)
        expect(context2.poolMargin).toApproximate(normalizeBigNumberish(element.poolMargin))
      }
    })
  })
})

describe('computeDeltaMargin', function() {
  const beta = new BigNumber('1')
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    pos2: BigNumber

    // expected
    deltaMargin: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: '0 -> +5',
      amm: poolStorage0,
      pos2: new BigNumber('5'),
      deltaMargin: new BigNumber('-487.5')
    },
    {
      name: '0 -> -5',
      amm: poolStorage0,
      pos2: new BigNumber('-5'),
      deltaMargin: new BigNumber('512.5')
    }
  ]

  successCases.forEach(element => {
    it(element.name, function() {
      const context = computeAMMPoolMargin(initAMMTradingContext(element.amm, TEST_MARKET_INDEX0), beta)
      const deltaMargin = computeDeltaMargin(context, beta, element.pos2)
      expect(deltaMargin).toApproximate(normalizeBigNumberish(element.deltaMargin))
    })
  })
})

describe('safePosition', function() {
  it('short: init', function() {
    const beta = new BigNumber('1')
    const context = computeAMMPoolMargin(initAMMTradingContext(poolInit, TEST_MARKET_INDEX0), beta)
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeShortPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('0')))
  })

  it('short: condition3 √, condition2 ∞. condition 3 selected', function() {
    const beta = new BigNumber('1')
    const context = computeAMMPoolMargin(initAMMTradingContext(poolStorage1, TEST_MARKET_INDEX0), beta)
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeShortPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('-141.067359796658844252321636909')))
  })

  it('short: condition3 √, condition2 √. condition 2 selected', function() {
    const beta = new BigNumber('1')
    const context = computeAMMPoolMargin(
      initAMMTradingContext(
        {
          ...poolStorage1,
          perpetuals: new Map([
            [
              TEST_MARKET_INDEX0,
              {
                ...(poolStorage1.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
                ammMaxLeverage: { value: new BigNumber('0.5'), minValue: _0, maxValue: _0 }
              }
            ],
            [TEST_MARKET_INDEX1, poolStorage1.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage]
          ])
        },
        TEST_MARKET_INDEX0
      ),
      beta
    )
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeShortPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('-56.589168238006977708561982164')))
  })

  it('short: condition3 √, condition2 √. condition 3 selected', function() {
    const beta = new BigNumber('1.426933822319389')
    const context = computeAMMPoolMargin(
      initAMMTradingContext(
        {
          ...poolStorage1,
          perpetuals: new Map([
            [
              TEST_MARKET_INDEX0,
              {
                ...(poolStorage1.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
                indexPrice: new BigNumber(100),
                ammPositionAmount: new BigNumber('-10'),
                ammMaxLeverage: { value: new BigNumber('0.5'), minValue: _0, maxValue: _0 },
                openSlippageFactor: { value: beta, minValue: _0, maxValue: _0 }
              }
            ],
            [
              TEST_MARKET_INDEX1,
              {
                ...(poolStorage1.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage),
                indexPrice: new BigNumber('90'),
                ammPositionAmount: new BigNumber('85.5148648938521'),
                openSlippageFactor: { value: new BigNumber('2.222222222222222222'), minValue: _0, maxValue: _0 }
              }
            ]
          ])
        },
        TEST_MARKET_INDEX0
      ),
      beta
    )
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeShortPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('-69.2197544117782')))
  })

  it('short: condition3 ∞', function() {
    // TODO
  })

  it('long: init', function() {
    const beta = new BigNumber('1')
    const context = computeAMMPoolMargin(initAMMTradingContext(poolInit, TEST_MARKET_INDEX0), beta)
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeLongPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('0')))
  })

  it('long: condition3 √, condition2 ∞, condition 1 selected', function() {
    const beta = new BigNumber('1')
    const context = computeAMMPoolMargin(initAMMTradingContext(poolStorage4, TEST_MARKET_INDEX0), beta)
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeLongPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('100')))
  })

  it('long: condition3 √, condition2 √, condition 2 selected', function() {
    const beta = new BigNumber('1')
    const context = computeAMMPoolMargin(
      initAMMTradingContext(
        {
          ...poolStorage4,
          perpetuals: new Map([
            [
              TEST_MARKET_INDEX0,
              {
                ...(poolStorage4.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
                ammMaxLeverage: { value: new BigNumber('0.5'), minValue: _0, maxValue: _0 }
              }
            ],
            [TEST_MARKET_INDEX1, poolStorage4.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage]
          ])
        },
        TEST_MARKET_INDEX0
      ),
      beta
    )
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeLongPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('56.589168238006977708561982164')))
  })

  it('long: condition3 √, condition2 ∞, condition 3 selected', function() {
    const beta = new BigNumber('0.3977')
    const context = computeAMMPoolMargin(
      initAMMTradingContext(
        {
          ...poolStorage4,
          perpetuals: new Map([
            [
              TEST_MARKET_INDEX0,
              {
                ...(poolStorage4.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
                openSlippageFactor: { value: beta, minValue: _0, maxValue: _0 }
              }
            ],
            [
              TEST_MARKET_INDEX1,
              {
                ...(poolStorage4.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage),
                indexPrice: new BigNumber('10'),
                ammPositionAmount: new BigNumber('-109'),
                openSlippageFactor: { value: new BigNumber('3'), minValue: _0, maxValue: _0 }
              }
            ]
          ])
        },
        TEST_MARKET_INDEX0
      ),
      beta
    )
    expect(isAMMSafe(context, beta)).toBeTruthy()
    const pos2 = computeAMMSafeLongPositionAmount(context, beta)
    expect(pos2).toApproximate(normalizeBigNumberish(new BigNumber('176.61598769492977')))
  })

  it('long: condition3 ∞', function() {
    // TODO
  })
})

describe('trade - success', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    amount: BigNumber

    // expected
    deltaMargin: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: 'open 0 -> -141.421, near pos2 limit',
      amm: poolStorage0,
      amount: new BigNumber('-141.421'),
      deltaMargin: new BigNumber('24142.0496205')
    },
    {
      name: 'open 0 -> -0.1, effected by spread',
      amm: poolStorage0,
      amount: new BigNumber('-0.1'),
      deltaMargin: new BigNumber('10.01')
    },
    {
      name: 'open -10 -> -141.067, near pos2 limit',
      amm: poolStorage1,
      amount: new BigNumber('-131.067'),
      deltaMargin: new BigNumber('23006.6492445')
    },
    {
      name: 'open -10 -> -10.1, effected by spread',
      amm: poolStorage1,
      amount: new BigNumber('-0.1'),
      deltaMargin: new BigNumber('11.011')
    },
    {
      name: 'open 0 -> 100, near pos2 limit',
      amm: poolStorage0,
      amount: new BigNumber('100'),
      deltaMargin: new BigNumber('-5000')
    },
    {
      name: 'open 0 -> 0.1, effected by spread',
      amm: poolStorage0,
      amount: new BigNumber('0.1'),
      deltaMargin: new BigNumber('-9.99')
    },
    {
      name: 'open 10 -> 100, near pos2 limit',
      amm: poolStorage4,
      amount: new BigNumber('90'),
      deltaMargin: new BigNumber('-4050')
    },
    {
      name: 'open 10 -> 10.1, effected by spread',
      amm: poolStorage4,
      amount: new BigNumber('0.1'),
      deltaMargin: new BigNumber('-8.991')
    },
    {
      name: 'close -10 -> -9, normal',
      amm: poolStorage1,
      amount: new BigNumber('1'),
      deltaMargin: new BigNumber('-108.54568619644455781471685713')
    },
    {
      name: 'close -10 -> -9.9, effected by spread',
      amm: poolStorage1,
      amount: new BigNumber('0.1'),
      deltaMargin: new BigNumber('-10.88864636949980139546338319')
    },
    {
      name: 'close -10 -> 0, to zero',
      amm: poolStorage1,
      amount: new BigNumber('10'),
      deltaMargin: new BigNumber('-1044.97729577076083060377293227')
    },
    {
      name: 'close 10 -> 9, normal',
      amm: poolStorage4,
      amount: new BigNumber('-1'),
      deltaMargin: new BigNumber('91.45431380355544218528314287')
    },
    {
      name: 'close 10 -> 9.9, effected by spread',
      amm: poolStorage4,
      amount: new BigNumber('-0.1'),
      deltaMargin: new BigNumber('9.109554538669368171312465896')
    },
    {
      name: 'close 10 -> 0',
      amm: poolStorage4,
      amount: new BigNumber('-10'),
      deltaMargin: new BigNumber('955.02270422923916939622706773')
    },
    {
      name: 'close unsafe -10 -> -9, normal',
      amm: poolStorage3,
      amount: new BigNumber('1'),
      deltaMargin: new BigNumber('-100')
    },
    {
      name: 'close unsafe -10 -> -9.9, small',
      amm: poolStorage3,
      amount: new BigNumber('0.1'),
      deltaMargin: new BigNumber('-10')
    },
    {
      name: 'close unsafe 10 -> 9, normal',
      amm: poolStorage6,
      amount: new BigNumber('-1'),
      deltaMargin: new BigNumber('100')
    },
    {
      name: 'close unsafe 10 -> 9, small',
      amm: poolStorage6,
      amount: new BigNumber('-0.1'),
      deltaMargin: new BigNumber('10')
    }
  ]

  successCases.forEach(element => {
    it(element.name, function() {
      const context = computeAMMInternalTrade(element.amm, TEST_MARKET_INDEX0, element.amount)
      expect(context.deltaMargin).toApproximate(normalizeBigNumberish(element.deltaMargin))
    })
  })
})

describe('trade - cross 0', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    amount: BigNumber
    halfSpread: BigNumber

    // expected
    deltaMargin: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: '-10 -> 10, normal',
      amm: poolStorage1,
      amount: new BigNumber('20'),
      halfSpread: new BigNumber('0.001'),
      deltaMargin: new BigNumber('-1995.0025226921376854884718017300')
    },
    {
      name: '-10 -> 10, spread effects closing and part of opening',
      amm: poolStorage1,
      amount: new BigNumber('20'),
      halfSpread: new BigNumber('0.05'),
      deltaMargin: new BigNumber('-1995.0025226921376854884718017300')
    },
    {
      name: '-10 -> 10, spread effects all',
      amm: poolStorage1,
      amount: new BigNumber('20'),
      halfSpread: new BigNumber('0.10'),
      deltaMargin: new BigNumber('-1961.918264774738990173582556163')
    },
    {
      name: '10 -> -10, normal',
      amm: poolStorage4,
      amount: new BigNumber('-20'),
      halfSpread: new BigNumber('0.001'),
      deltaMargin: new BigNumber('2004.9974773078623145115281982700')
    },
    {
      name: '10 -> -10, spread effects closing and part of opening',
      amm: poolStorage4,
      amount: new BigNumber('-20'),
      halfSpread: new BigNumber('0.06'),
      deltaMargin: new BigNumber('2004.9974773078623145115281982700')
    },
    {
      name: '10 -> -10, spread effects all',
      amm: poolStorage4,
      amount: new BigNumber('-20'),
      halfSpread: new BigNumber('0.15'),
      deltaMargin: new BigNumber('2093.104439454500179222644511570')
    }
  ]

  successCases.forEach(element => {
    it(element.name, function() {
      const p1 = element.amm.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage
      const context = computeAMMInternalTrade(
        {
          ...element.amm,
          perpetuals: new Map([
            ...element.amm.perpetuals,
            [TEST_MARKET_INDEX0, { ...p1, halfSpread: { value: element.halfSpread, minValue: _0, maxValue: _0 } }]
          ])
        },
        TEST_MARKET_INDEX0,
        element.amount
      )
      expect(context.deltaMargin).toApproximate(normalizeBigNumberish(element.deltaMargin))
    })
  })
})

describe('trade - fail', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    amount: BigNumber
  }

  const failCases: Array<ComputeAccountCase> = [
    {
      name: 'poolMargin = 0',
      amm: poolInit,
      amount: new BigNumber('1')
    },
    {
      name: 'open 0 -> -141.422, pos2 too large',
      amm: poolStorage0,
      amount: new BigNumber('-141.422')
    },
    {
      name: 'open -10 -> -141.068, pos2 too large',
      amm: poolStorage1,
      amount: new BigNumber('-131.068')
    },
    {
      name: 'open -10 already unsafe',
      amm: poolStorage3,
      amount: new BigNumber('-0.01')
    },
    {
      name: 'open 0 -> 100.001',
      amm: poolStorage0,
      amount: new BigNumber('100.001')
    },
    {
      name: 'open 10 -> 100.001',
      amm: poolStorage4,
      amount: new BigNumber('90.001')
    },
    {
      name: 'open 10 already unsafe',
      amm: poolStorage6,
      amount: new BigNumber('0.01')
    }
  ]

  failCases.forEach(element => {
    it(element.name, () => {
      expect((): void => {
        computeAMMInternalTrade(element.amm, TEST_MARKET_INDEX0, element.amount)
      }).toThrow(InsufficientLiquidityError)
    })
  })
})

describe('computeBestAskBidPrice', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    isAMMBuy: boolean

    // expected
    price: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: 'open 0 -> -x',
      amm: poolStorage0,
      isAMMBuy: false,
      price: new BigNumber('100.1') // trader buy, (1 + α)
    },
    {
      name: 'open -10',
      amm: poolStorage1,
      isAMMBuy: false,
      price: new BigNumber('110.11') // trader buy, (1 + α)
    },
    {
      name: 'open 0 -> +x',
      amm: poolStorage0,
      isAMMBuy: true,
      price: new BigNumber('99.9') // trader sell, (1 - α)
    },
    {
      name: 'open 10',
      amm: poolStorage4,
      isAMMBuy: true,
      price: new BigNumber('89.91') // trader sell, (1 - α)
    },
    {
      name: 'close -10',
      amm: poolStorage1,
      isAMMBuy: true,
      price: new BigNumber('108.88646369499801395463383186703') // trader sell, (1 - α)
    },
    {
      name: 'close 10',
      amm: poolStorage4,
      isAMMBuy: false,
      price: new BigNumber('91.09554538669368171312465896007') // trader buy, (1 + α)
    },
    {
      name: 'close unsafe -10',
      amm: poolStorage3,
      isAMMBuy: true,
      price: new BigNumber('100')
    },
    {
      name: 'close unsafe 10',
      amm: poolStorage6,
      isAMMBuy: false,
      price: new BigNumber('100')
    }
  ]

  const failCases: Array<ComputeAccountCase> = [
    {
      name: 'open unsafe -10',
      amm: poolStorage3,
      isAMMBuy: false,
      price: _0, // unused
    },
    {
      name: 'open unsafe 10',
      amm: poolStorage6,
      isAMMBuy: true,
      price: _0, // unused
    },
  ]

  successCases.forEach(element => {
    it(element.name, function() {
      const price = computeBestAskBidPrice(element.amm, TEST_MARKET_INDEX0, element.isAMMBuy)
      expect(price).toApproximate(normalizeBigNumberish(element.price))
    })
  })

  failCases.forEach(element => {
    it(element.name, async () => {
      expect((): void => {
        computeBestAskBidPrice(element.amm, TEST_MARKET_INDEX0, element.isAMMBuy)
      }).toThrow(InsufficientLiquidityError)
    })
  })
})

describe('computeFundingRate', function() {
  it('normal', () => {
    expect(computeFundingRate(poolStorage0, TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0'))
    expect(computeFundingRate(poolStorage1, TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.0005'))
    expect(computeFundingRate(poolStorage2, TEST_MARKET_INDEX0)).toApproximate(
      normalizeBigNumberish('0.00269597158238683137')
    )
    expect(computeFundingRate(poolStorage3, TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.005'))
    expect(computeFundingRate(poolStorage4, TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.0005'))
    expect(computeFundingRate(poolStorage5, TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.005')) // clip
    expect(computeFundingRate(poolStorage6, TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.005'))
  })

  const addPhi0 = (pool: LiquidityPoolStorage, phi0: BigNumber, oi: BigNumber) => {
    return {
      ...pool,
      perpetuals: new Map([
        [
          TEST_MARKET_INDEX0,
          {
            ...(pool.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
            baseFundingRate: { minValue: _0, maxValue: _0, value: phi0 },
            openInterest: oi,
          }
        ],
        [TEST_MARKET_INDEX1, poolStorage4.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage]
      ]),
    }
  }

  it('baseFundingRate +0.01%, oi > 0', () => {
    const phi0 = new BigNumber('0.0001')
    const oi = new BigNumber('10')
    expect(computeFundingRate(addPhi0(poolStorage0, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.0001'))
    expect(computeFundingRate(addPhi0(poolStorage1, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.0006'))
    expect(computeFundingRate(addPhi0(poolStorage2, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.00279597158238683137'))
    expect(computeFundingRate(addPhi0(poolStorage3, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.005'))
    expect(computeFundingRate(addPhi0(poolStorage4, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.0005'))
    expect(computeFundingRate(addPhi0(poolStorage5, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.005')) // clip
    expect(computeFundingRate(addPhi0(poolStorage6, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.005'))
  })

  it('baseFundingRate +0.01%, oi = 0', () => {
    const phi0 = new BigNumber('0.0001')
    const oi = new BigNumber('0')
    expect(computeFundingRate(addPhi0(poolStorage0, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0'))
  })

  it('baseFundingRate -0.01%, oi > 0', () => {
    const phi0 = new BigNumber('-0.0001')
    const oi = new BigNumber('10')
    expect(computeFundingRate(addPhi0(poolStorage0, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.0001'))
    expect(computeFundingRate(addPhi0(poolStorage1, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.0005'))
    expect(computeFundingRate(addPhi0(poolStorage2, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.00269597158238683137'))
    expect(computeFundingRate(addPhi0(poolStorage3, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0.005'))
    expect(computeFundingRate(addPhi0(poolStorage4, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.0006'))
    expect(computeFundingRate(addPhi0(poolStorage5, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.005')) // clip
    expect(computeFundingRate(addPhi0(poolStorage6, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('-0.005'))
  })

  it('baseFundingRate -0.01%, oi = 0', () => {
    const phi0 = new BigNumber('-0.0001')
    const oi = new BigNumber('0')
    expect(computeFundingRate(addPhi0(poolStorage0, phi0, oi), TEST_MARKET_INDEX0)).toApproximate(normalizeBigNumberish('0'))
  })
})

describe('computeAMMShareToMint', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    totalShare: BigNumber
    cashToAdd: BigNumber

    // expected
    share: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: 'init',
      amm: poolInit,
      totalShare: _0,
      cashToAdd: new BigNumber(1000),
      share: new BigNumber(1000)
    },
    {
      name: 'before safe, after safe',
      amm: poolStorage1,
      totalShare: new BigNumber(100),
      cashToAdd: new BigNumber(1000),
      share: new BigNumber('10.0916660306314520522392020897')
    },
    {
      name: 'short, before unsafe, after unsafe',
      amm: poolStorage3,
      totalShare: new BigNumber(100),
      cashToAdd: new BigNumber(576),
      share: new BigNumber('5.321016166281755196304849885')
    },
    {
      name: 'short, before unsafe, after safe',
      amm: poolStorage3,
      totalShare: new BigNumber(100),
      cashToAdd: new BigNumber(577),
      share: new BigNumber('6.021800176340430529365414419')
    },
    {
      name: 'long, before unsafe, after unsafe',
      amm: poolStorage6,
      totalShare: new BigNumber(100),
      cashToAdd: new BigNumber(576),
      share: new BigNumber('5.321016166281755196304849885')
    },
    {
      name: 'long, before unsafe, after safe',
      amm: poolStorage6,
      totalShare: new BigNumber(100),
      cashToAdd: new BigNumber(577),
      share: new BigNumber('6.021800176340430529365414419')
    }
  ]

  successCases.forEach(element => {
    it(element.name, function() {
      const ret = computeAMMShareToMint(element.amm, element.totalShare, element.cashToAdd)
      expect(ret.shareToMint).toApproximate(normalizeBigNumberish(element.share))
    })
  })
})

describe('computeAMMCashToReturn', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    totalShare: BigNumber
    shareToRemove: BigNumber
    isEmergency: boolean

    // expected
    marginToRemove: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: 'poolMargin = 0',
      amm: poolInit,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      isEmergency: false,
      marginToRemove: _0
    },
    {
      name: 'no position',
      amm: poolStorage0,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      isEmergency: false,
      marginToRemove: new BigNumber('1000')
    },
    {
      name: 'no position, remove all',
      amm: poolStorage0,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('100'),
      isEmergency: false,
      marginToRemove: new BigNumber('10000')
    },
    {
      name: 'short',
      amm: poolStorage1,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      isEmergency: false,
      marginToRemove: new BigNumber('988.888888888888888888888888889')
    },
    {
      name: 'long',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      isEmergency: false,
      marginToRemove: new BigNumber('988.888888888888888888888888889')
    },
    {
      name: 'state != NORMAL',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      isEmergency: true,
      marginToRemove: new BigNumber('900.25420688843233693447638834')
    }
  ]

  successCases.forEach(element => {
    it(element.name, async () => {
      let pool = element.amm
      if (element.isEmergency) {
        pool.perpetuals.set(TEST_MARKET_INDEX1, {
          ...(pool.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage),
          state: PerpetualState.EMERGENCY
        })
      }
      const ret = computeAMMCashToReturn(pool, element.totalShare, element.shareToRemove)
      expect(ret.cashToReturn).toApproximate(normalizeBigNumberish(element.marginToRemove))
    })
  })
})

describe('computeAMMCashToReturn', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    totalShare: BigNumber
    shareToRemove: BigNumber
    ammMaxLeverage: BigNumber
  }

  const failCases: Array<ComputeAccountCase> = [
    {
      name: 'short, before unsafe',
      amm: poolStorage3,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      ammMaxLeverage: new BigNumber('3')
    },
    {
      name: 'long, before unsafe',
      amm: poolStorage6,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('10'),
      ammMaxLeverage: new BigNumber('3')
    },
    {
      name: 'short, after unsafe',
      amm: poolStorage1,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('90.001'),
      ammMaxLeverage: new BigNumber('3')
    },
    {
      name: 'long, after unsafe',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('90.001'),
      ammMaxLeverage: new BigNumber('3')
    },
    {
      name: 'long, after negative price',
      amm: poolStorage5,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('0.001'),
      ammMaxLeverage: new BigNumber('3')
    },
    {
      name: 'long, after exceed leverage',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      shareToRemove: new BigNumber('0.001'),
      ammMaxLeverage: new BigNumber('0.1')
    }
  ]

  failCases.forEach(element => {
    it(element.name, async () => {
      expect((): void => {
        let pool = element.amm
        pool.perpetuals.set(TEST_MARKET_INDEX0, {
          ...(pool.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
          ammMaxLeverage: {
            value: element.ammMaxLeverage,
            minValue: _0,
            maxValue: element.ammMaxLeverage
          }
        })
        pool.perpetuals.set(TEST_MARKET_INDEX1, {
          ...(pool.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage),
          ammMaxLeverage: {
            value: element.ammMaxLeverage,
            minValue: _0,
            maxValue: element.ammMaxLeverage
          }
        })
        computeAMMCashToReturn(pool, element.totalShare, element.shareToRemove)
      }).toThrow(InsufficientLiquidityError)
    })
  })
})

describe('computeMaxRemovableShare', function() {
  interface ComputeAccountCase {
    name: string
    amm: LiquidityPoolStorage
    totalShare: BigNumber
    isEmergency: boolean
    ammMaxLeverage: BigNumber

    // expected
    shareToRemove?: BigNumber
  }

  const successCases: Array<ComputeAccountCase> = [
    {
      name: 'poolMargin = 0',
      amm: poolInit,
      totalShare: new BigNumber('0'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: new BigNumber('0')
    },
    {
      name: 'no position',
      amm: poolStorage0,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: new BigNumber('100')
    },
    {
      name: 'short',
      amm: poolStorage1,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: undefined // relaxed
    },
    {
      name: 'short, limited by lev',
      amm: poolStorage1,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('0.5'),
      shareToRemove: undefined // relaxed
    },
    {
      name: 'long',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: undefined // relaxed
    },
    {
      name: 'state != NORMAL',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      isEmergency: true,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: undefined // relaxed
    },
    {
      name: 'short, before unsafe',
      amm: poolStorage3,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: new BigNumber('0')
    },
    {
      name: 'long, before unsafe',
      amm: poolStorage6,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: new BigNumber('0')
    },
    {
      name: 'long, after negative price',
      amm: poolStorage5,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('3'),
      shareToRemove: new BigNumber('0')
    },
    {
      name: 'long, after exceed leverage',
      amm: poolStorage4,
      totalShare: new BigNumber('100'),
      isEmergency: false,
      ammMaxLeverage: new BigNumber('0.1'),
      shareToRemove: new BigNumber('0')
    }
  ]

  successCases.forEach(element => {
    it(element.name, async () => {
      let pool = element.amm
      if (element.isEmergency) {
        pool.perpetuals.set(TEST_MARKET_INDEX1, {
          ...(pool.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage),
          state: PerpetualState.EMERGENCY
        })
      }
      pool.perpetuals.set(TEST_MARKET_INDEX0, {
        ...(pool.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage),
        ammMaxLeverage: {
          value: element.ammMaxLeverage,
          minValue: _0,
          maxValue: element.ammMaxLeverage
        }
      })
      pool.perpetuals.set(TEST_MARKET_INDEX1, {
        ...(pool.perpetuals.get(TEST_MARKET_INDEX1) as PerpetualStorage),
        ammMaxLeverage: {
          value: element.ammMaxLeverage,
          minValue: _0,
          maxValue: element.ammMaxLeverage
        }
      })
      const ret = computeMaxRemovableShare(pool, element.totalShare)
      if (element.shareToRemove) {
        expect(ret).toApproximate(normalizeBigNumberish(element.shareToRemove))
      }
      if (!ret.isZero()) {
        computeAMMCashToReturn(pool, element.totalShare, ret)
        if (ret.times('1.015').lte(element.totalShare)) {
          expect((): void => {
            computeAMMCashToReturn(pool, element.totalShare, ret.times('1.015'))
          }).toThrow(InsufficientLiquidityError)
        }
      }
    })
  })
})
