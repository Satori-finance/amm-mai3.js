import BigNumber from 'bignumber.js'
import { computeAMMPrice, computeAMMTrade } from '../src/computation'
import {
  computeAMMMaxTradeAmount,
  computeAMMTradeAmountByMargin,
  computeAMMAmountWithPrice,
  computeAMMInverseVWAP,
  computeLimitOrderMaxTradeAmount,
} from '../src/amount_calculator'
import { computeAccount } from '../src/computation'
import { computeAMMPoolMargin, computeBestAskBidPrice, computeBestAskBidPriceIfSafe, initAMMTradingContext, isAMMSafe } from '../src/amm'
import { _0, _1 } from '../src/constants'
import { orderSideAvailable } from '../src/order'
import { LiquidityPoolStorage, PerpetualStorage, AccountStorage, PerpetualState, TradeFlag, Order } from '../src/types'
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

const poolStorage0: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('100000'),
  perpetuals: new Map([[TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: _0 }]])
}

// short normal
// availableCashBalance = 116095.73134375 - (9.9059375 * (-2.3)) = 116118.515
// poolMargin = 100000, 100001.8518085704069965273648933
const poolStorage1: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('116095.73134375'),
  perpetuals: new Map([[TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('-2.3') }]])
}

// short unsafe
// availableCashBalance = 17096.21634375 - (9.9059375 * (-2.3)) = 17119
const poolStorage3: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('17096.21634375'),
  perpetuals: new Map([[TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('-2.3') }]])
}

// long normal
// availableCashBalance = 83941.29865625 - (9.9059375 * 2.3) = 83918.515
// poolMargin = 100000, 100001.8518085704069965273648933
const poolStorage4: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('83941.29865625'),
  perpetuals: new Map([[TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('2.3') }]])
}

// long unsafe
// availableCashBalance = -13677.21634375 - (9.9059375 * (2.3)) = -13700
const poolStorage6: LiquidityPoolStorage = {
  ...defaultPool,
  poolCashBalance: new BigNumber('-13677.21634375'),
  perpetuals: new Map([[TEST_MARKET_INDEX0, { ...perpetual1, ammPositionAmount: new BigNumber('2.3') }]])
}

const accountStorage0: AccountStorage = {
  cashBalance: _0,
  positionAmount: _0,
  targetLeverage: new BigNumber('1'),
  entryValue: null,
  entryFunding: null
}

const accountStorage1: AccountStorage = {
  cashBalance: new BigNumber('7698.86'), // 10000 - 2300.23 + (-0.91)
  positionAmount: new BigNumber('2.3'),
  targetLeverage: new BigNumber('1'),
  entryValue: null,
  entryFunding: null
}

describe('computeAMMMaxTradeAmount', function () {
  it(`new user`, function () {
    const walletBalance = _0
    const amount = computeAMMMaxTradeAmount(poolStorage4, TEST_MARKET_INDEX0, accountStorage0, walletBalance, true, accountStorage0.targetLeverage.toNumber())
    expect(amount).toBeBigNumber(_0)
  })

  it(`new user with walletBalance(old targetLeverage)`, function () {
    const walletBalance = 7000
    const amount = computeAMMMaxTradeAmount(poolStorage4, TEST_MARKET_INDEX0, accountStorage0, walletBalance, true, accountStorage0.targetLeverage.toNumber()) // 0.999
    const res = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage0, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(res.tradeIsSafe).toBeTruthy()
    expect(res.trader.accountComputed.leverage).toBeBigNumber(_1)
    expect(amount.gt('0.99')).toBeTruthy()
    expect(amount.lt('1.00')).toBeTruthy()
    expect(res.adjustCollateral.gt('6999')).toBeTruthy()
    expect(res.adjustCollateral.lt('7001')).toBeTruthy()
  })

  it(`new user with walletBalance(new targetLeverage)`, function () {
    const walletBalance = 7000
    const amount = computeAMMMaxTradeAmount(poolStorage4, TEST_MARKET_INDEX0, accountStorage0, walletBalance, true, accountStorage0.targetLeverage.toNumber()) // 0.999
    // 100 << 7 = 12800
    const res = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage0, amount, 12800)
    expect(res.tradeIsSafe).toBeTruthy()
    expect(res.trader.accountComputed.leverage).toBeBigNumber(_1)
    expect(amount.gt('0.99')).toBeTruthy()
    expect(amount.lt('1.00')).toBeTruthy()
    expect(res.adjustCollateral.gt('6999')).toBeTruthy()
    expect(res.adjustCollateral.lt('7001')).toBeTruthy()
  })

  it(`safe trader + safe amm, trader buy. open positions only`, function () {
    const walletBalance = 7000
    const amount = computeAMMMaxTradeAmount(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, walletBalance, true, accountStorage1.targetLeverage.toNumber()) // 1.1
    const res = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(res.tradeIsSafe).toBeTruthy()
    expect(amount.gt('1.0')).toBeTruthy()
    expect(amount.lt('1.2')).toBeTruthy()
    expect(res.adjustCollateral.gt('6999')).toBeTruthy()
    expect(res.adjustCollateral.lt('7001')).toBeTruthy()
  })

  it(`safe trader + safe amm, trader sell. close + open. withdraw covers deposit`, function () {
    const walletBalance = 0
    const amount = computeAMMMaxTradeAmount(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, walletBalance, false, accountStorage1.targetLeverage.toNumber()) // -5.6
    const res = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(res.tradeIsSafe).toBeTruthy()
    expect(amount.lt('-5')).toBeTruthy()
    expect(amount.gt('-6')).toBeTruthy()
    expect(res.trader.accountComputed.leverage.gt('0.99')).toBeTruthy()
    expect(res.trader.accountComputed.leverage.lte('1.01')).toBeTruthy()
  })

  it(`safe trader + safe amm, trader sell. close + open. withdraw covers deposit`, function () {
    const walletBalance = 70000
    const amount = computeAMMMaxTradeAmount(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, walletBalance, false, accountStorage1.targetLeverage.toNumber()) // -5.6
    const res = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(res.tradeIsSafe).toBeTruthy()
    expect(amount.lt('-15')).toBeTruthy()
    expect(amount.gt('-16')).toBeTruthy()
    expect(res.trader.accountComputed.leverage.gt('0.99')).toBeTruthy()
    expect(res.trader.accountComputed.leverage.lte('1.01')).toBeTruthy()
  })

  it(`safe trader + unsafe amm(holds short), trader buy`, function () {
    const walletBalance = 0
    const amount = computeAMMMaxTradeAmount(poolStorage3, TEST_MARKET_INDEX0, accountStorage1, walletBalance, true, accountStorage1.targetLeverage.toNumber())
    expect(amount.isZero()).toBeTruthy()
  })

  it(`safe trader + unsafe amm(holds long), trader sell`, function () {
    const walletBalance = 0
    const amount = computeAMMMaxTradeAmount(poolStorage6, TEST_MARKET_INDEX0, accountStorage1, walletBalance, false, accountStorage1.targetLeverage.toNumber())
    expect(amount.isZero()).toBeTruthy()
  })
})

describe('computeAMMTradeAmountByMargin', function () {
  it(`safe trader + safe amm, trader buy`, function () {
    const amount = computeAMMTradeAmountByMargin(poolStorage4, TEST_MARKET_INDEX0, '-100') // 0.0147487
    const p = computeAMMPrice(poolStorage4, TEST_MARKET_INDEX0, amount)
    const actualTraderMargin = p.deltaAMMMargin.negated()
    expect(amount.lt('0.015')).toBeTruthy()
    expect(amount.gt('0.014')).toBeTruthy()
    expect(actualTraderMargin.gt('-100.1')).toBeTruthy()
    expect(actualTraderMargin.lt('-99.9')).toBeTruthy()
  })

  it(`safe trader + safe amm, trader sell`, function () {
    const amount = computeAMMTradeAmountByMargin(poolStorage4, TEST_MARKET_INDEX0, '100') // -0.01525
    const p = computeAMMPrice(poolStorage4, TEST_MARKET_INDEX0, amount)
    const actualTraderMargin = p.deltaAMMMargin.negated()
    expect(amount.gt('-0.015')).toBeTruthy()
    expect(amount.lt('-0.014')).toBeTruthy()
    expect(actualTraderMargin.gt('99.9')).toBeTruthy()
    expect(actualTraderMargin.lt('100.1')).toBeTruthy()
  })

  it(`safe trader + unsafe amm(holds short), trader buy`, function () {
    const amount = computeAMMTradeAmountByMargin(poolStorage3, TEST_MARKET_INDEX0, '-100')
    expect(amount.isZero()).toBeTruthy()
  })

  it(`safe trader + unsafe amm(holds long), trader sell`, function () {
    const amount = computeAMMTradeAmountByMargin(poolStorage6, TEST_MARKET_INDEX0, '100')
    expect(amount.isZero()).toBeTruthy()
  })
})

describe('computeLimitOrderMaxTradeAmount', function () {
  it('empty order book. close + open. withdraw covers deposit', function () {
    const walletBalance = _0
    const limitPrice = new BigNumber('6900')
    const isBuy = false
    const targetLeverage = accountStorage1.targetLeverage
    const orders: Order[] = []
    const context = new Map([
      [TEST_MARKET_INDEX0, { pool: poolStorage1, perpetualIndex: TEST_MARKET_INDEX0, account: accountStorage1 }]
    ])
    const amount = computeLimitOrderMaxTradeAmount(context, walletBalance, orders, TEST_MARKET_INDEX0, limitPrice, isBuy, targetLeverage)
    // marginBalance = 23695.57634375, amount = -5.67
    // withdraw = 23695.57634375 - (6965 - 6900)*2.3 - 6900*2.3*0.001 = 23530.20634375
    // deposit = (5.67 - 2.3)*6900*(1/1 + 0.001) + (6965 - 6900)*(5.67 - 2.3) = 23495.3
    // cost = deposit - withdraw ≈ 0
    expect(amount.gt('-5.7')).toBeTruthy()
    expect(amount.lt('-5.6')).toBeTruthy()
    const marginBalance = computeAccount(poolStorage1, TEST_MARKET_INDEX0, accountStorage1).accountComputed.marginBalance
    const oldAvailable = orderSideAvailable(poolStorage1, TEST_MARKET_INDEX0, marginBalance, accountStorage1.positionAmount,
      walletBalance, orders)
    const newAvailable = orderSideAvailable(poolStorage1, TEST_MARKET_INDEX0, marginBalance, accountStorage1.positionAmount,
      walletBalance, orders.concat([
        { symbol: TEST_MARKET_INDEX0, limitPrice, amount, targetLeverage }
      ]))
    expect(oldAvailable.remainWalletBalance).toApproximate(_0)
    expect(newAvailable.remainWalletBalance.lt('1')).toBeTruthy()
  })

  it('empty order book. close + open', function () {
    const walletBalance = new BigNumber('70000')
    const limitPrice = new BigNumber('6900')
    const isBuy = false
    const targetLeverage = accountStorage1.targetLeverage
    const orders: Order[] = []
    const context = new Map([
      [TEST_MARKET_INDEX0, { pool: poolStorage1, perpetualIndex: TEST_MARKET_INDEX0, account: accountStorage1 }]
    ])
    const amount = computeLimitOrderMaxTradeAmount(context, walletBalance, orders, TEST_MARKET_INDEX0, limitPrice, isBuy, targetLeverage)
    // marginBalance = 23695.57634375, amount = -15.59
    // withdraw = 23695.57634375 - (6965 - 6900)*2.3 - 6900*2.3*0.001 = 23530.20634375
    // deposit = (15.59 - 2.3)*6900*(1/1 + 0.001) + (6965 - 6900)*(15.59 - 2.3) = 92656.551
    // cost = deposit - 70000 - withdraw ≈ 0
    expect(amount.gt('-15.6')).toBeTruthy()
    expect(amount.lt('-15.5')).toBeTruthy()
    const marginBalance = computeAccount(poolStorage1, TEST_MARKET_INDEX0, accountStorage1).accountComputed.marginBalance
    const oldAvailable = orderSideAvailable(poolStorage1, TEST_MARKET_INDEX0, marginBalance, accountStorage1.positionAmount,
      walletBalance, orders)
    const newAvailable = orderSideAvailable(poolStorage1, TEST_MARKET_INDEX0, marginBalance, accountStorage1.positionAmount,
      walletBalance, orders.concat([
        { symbol: TEST_MARKET_INDEX0, limitPrice, amount, targetLeverage }
      ]))
    expect(oldAvailable.remainWalletBalance).toApproximate(new BigNumber('70000'))
    expect(newAvailable.remainWalletBalance.lt('1')).toBeTruthy()
  })

  it('(open a + open b) should be equivalent to open (a + b)', function () {
    const walletBalance = new BigNumber('70000')
    const limitPrice = new BigNumber('6900')
    const amount = new BigNumber('1')
    const isBuy = false
    const targetLeverage = accountStorage1.targetLeverage
    let orders: Order[] = []
    const context = new Map([
      [TEST_MARKET_INDEX0, { pool: poolStorage1, perpetualIndex: TEST_MARKET_INDEX0, account: accountStorage1 }]
    ])
    orders.push({
      symbol: TEST_MARKET_INDEX0,
      limitPrice,
      amount: amount,
      targetLeverage
    })
    orders.push({
      symbol: TEST_MARKET_INDEX0,
      limitPrice,
      amount: amount,
      targetLeverage
    })
    const amount1 = computeLimitOrderMaxTradeAmount(context, walletBalance, orders, TEST_MARKET_INDEX0, limitPrice, isBuy, targetLeverage)
    orders = []
    orders.push({
      symbol: TEST_MARKET_INDEX0,
      limitPrice,
      amount: amount.plus(amount),
      targetLeverage
    })
    const amount2 = computeLimitOrderMaxTradeAmount(context, walletBalance, orders, TEST_MARKET_INDEX0, limitPrice, isBuy, targetLeverage)
    expect(amount2).toApproximate(amount1)
  })

  it('the max amount should not exceeds max open interest', function () {
    const walletBalance = new BigNumber('10000000000')
    const limitPrice = new BigNumber('6965')
    const isBuy = true
    const orders: Order[] = []
    const context = new Map([
      [TEST_MARKET_INDEX0, { pool: poolStorage1, perpetualIndex: TEST_MARKET_INDEX0, account: accountStorage1 }]
    ])
    const targetLeverage = accountStorage1.targetLeverage
    const amount = computeLimitOrderMaxTradeAmount(context, walletBalance, orders, TEST_MARKET_INDEX0, limitPrice, isBuy, targetLeverage)
    // poolMargin = 100000, maxOpenInterestRate = 100
    // maxOpenInterest = 100000 * 100 / 7000 = 1428.5
    // current oi = 10
    expect(amount.gt('1418')).toBeTruthy()
    expect(amount.lt('1419')).toBeTruthy()
  })
})

describe('computeAMMInverseVWAP', function () {
  const getZeroAlphaPool = (pool: LiquidityPoolStorage): LiquidityPoolStorage => {
    const p = pool.perpetuals.get(TEST_MARKET_INDEX0) as PerpetualStorage
    const newPool = { ...pool, perpetuals: new Map(pool.perpetuals) }
    newPool.perpetuals.set(TEST_MARKET_INDEX0, { ...p, halfSpread: { value: _0, minValue: _0, maxValue: _0 } })
    return newPool
  }

  it(`short: open without vwap`, function () {
    const price = new BigNumber('7050')
    const pool = getZeroAlphaPool(poolStorage1)
    const context = computeAMMPoolMargin(
      initAMMTradingContext(pool, TEST_MARKET_INDEX0),
      perpetual1.openSlippageFactor.value
    )
    const amount = computeAMMInverseVWAP(context, price, perpetual1.openSlippageFactor.value, false)
    expect(amount).toApproximate(normalizeBigNumberish('-9.68571428571428571428571429'))
    const trade = computeAMMTrade(pool, TEST_MARKET_INDEX0, accountStorage1, amount.negated(), TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(price)
  })

  it(`short: open with vwap`, function () {
    const price = new BigNumber('7050')
    const pool = getZeroAlphaPool(poolStorage0)
    const context = computeAMMPoolMargin(
      initAMMTradingContext(pool, TEST_MARKET_INDEX0),
      perpetual1.openSlippageFactor.value
    )
    context.deltaMargin = new BigNumber('6950')
    context.deltaPosition = new BigNumber('-1')
    const amount = computeAMMInverseVWAP(context, price, perpetual1.openSlippageFactor.value, false)
    expect(amount).toApproximate(normalizeBigNumberish('-16.06428285485485457978127589'))
  })

  it(`short: close`, function () {
    const price = new BigNumber('7010')
    const pool = getZeroAlphaPool(poolStorage1)
    const context = computeAMMPoolMargin(
      initAMMTradingContext(pool, TEST_MARKET_INDEX0),
      perpetual1.closeSlippageFactor.value
    )
    const amount = computeAMMInverseVWAP(context, price, perpetual1.closeSlippageFactor.value, true)
    expect(amount).toApproximate(normalizeBigNumberish('1.42533803782316168264992492'))
    const trade = computeAMMTrade(pool, TEST_MARKET_INDEX0, accountStorage1, amount.negated(), TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(price)
  })

  it(`long: open without vwap`, function () {
    const price = new BigNumber('6950')
    const pool = getZeroAlphaPool(poolStorage4)
    const context = computeAMMPoolMargin(
      initAMMTradingContext(pool, TEST_MARKET_INDEX0),
      perpetual1.openSlippageFactor.value
    )
    const amount = computeAMMInverseVWAP(context, price, perpetual1.openSlippageFactor.value, true)
    expect(amount).toApproximate(normalizeBigNumberish('9.68571428571428571428571429'))
    const trade = computeAMMTrade(pool, TEST_MARKET_INDEX0, accountStorage1, amount.negated(), TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(price)
  })

  it(`long: open with vwap`, function () {
    const price = new BigNumber('6950')
    const pool = getZeroAlphaPool(poolStorage0)
    const context = computeAMMPoolMargin(
      initAMMTradingContext(pool, TEST_MARKET_INDEX0),
      perpetual1.openSlippageFactor.value
    )
    context.deltaMargin = new BigNumber('-7050')
    context.deltaPosition = new BigNumber('1')
    const amount = computeAMMInverseVWAP(context, price, perpetual1.openSlippageFactor.value, true)
    expect(amount).toApproximate(normalizeBigNumberish('16.06428285485485457978127589'))
  })

  it(`long: close`, function () {
    const price = new BigNumber('6990')
    const pool = getZeroAlphaPool(poolStorage4)
    const context = computeAMMPoolMargin(
      initAMMTradingContext(pool, TEST_MARKET_INDEX0),
      perpetual1.closeSlippageFactor.value
    )
    const amount = computeAMMInverseVWAP(context, price, perpetual1.closeSlippageFactor.value, false)
    expect(amount).toApproximate(normalizeBigNumberish('-1.42533803782316168264992492'))
    const trade = computeAMMTrade(pool, TEST_MARKET_INDEX0, accountStorage1, amount.negated(), TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(price)
  })
})

describe('computeAMMAmountWithPrice - amm holds short, trader buys', function () {
  it(`amm unsafe`, function () {
    const limitPrice = new BigNumber('100000')
    const amount = computeAMMAmountWithPrice(poolStorage3, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`lower than spread`, function () {
    const limitPrice = new BigNumber('7023.1160999') // spread = 7023.1161
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`exactly the best ask/bid price`, function () {
    const limitPrice = new BigNumber('7023.1161')
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('2.0046'))
    const trade = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
  })

  it(`limitPrice is far away`, function () {
    const limitPrice = new BigNumber('100000')
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, true, limitPrice)
    // -2.3 => max -93.095503235030246126178607648
    expect(amount).toApproximate(normalizeBigNumberish('90.795503235030246126178607648'))
    const trade = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
  })

  it(`normal`, function () {
    const limitPrice = new BigNumber('7200')
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('52.542857142857142857'))
    const trade = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })
})

describe('computeAMMAmountWithPrice - amm holds short, trader sells', function () {
  it(`amm unsafe - higher than spread`, function () {
    const limitPrice = new BigNumber('7000.001') // best ask/bid = 6993
    const amount = computeAMMAmountWithPrice(poolStorage3, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`amm unsafe - exactly the best ask/bid price - close + open`, function () {
    const limitPrice = new BigNumber('7000')
    const amount = computeAMMAmountWithPrice(poolStorage3, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-2.3'))
    const trade = computeAMMTrade(poolStorage3, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
  })

  it(`amm unsafe - largest amount`, function () {
    const limitPrice = new BigNumber(0)
    const amount = computeAMMAmountWithPrice(poolStorage3, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-3.248643177964958208'))
    const trade = computeAMMTrade(poolStorage3, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.gte(limitPrice)).toBeTruthy()
  })

  it(`amm unsafe close + open`, function () {
    const limitPrice = new BigNumber('6992')
    const amount = computeAMMAmountWithPrice(poolStorage3, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-2.54339106672133532007243536012'))
    const trade = computeAMMTrade(poolStorage3, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })

  it(`safe - higher than spread`, function () {
    const limitPrice = new BigNumber('7007.476') // spread = 7007.4752419462290525818804101137
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`safe - exactly the best ask/bid price - close + open`, function () {
    const limitPrice = new BigNumber('7007.4752419462290525818804101137')
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-2.226863373523786822'))
    const trade = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })

  it(`safe - close only`, function () {
    const limitPrice = new BigNumber('7007.4')
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-2.250750147989139645'))
    const trade = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })

  it(`safe - close + open`, function () {
    const limitPrice = new BigNumber('7006')
    const amount = computeAMMAmountWithPrice(poolStorage1, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-2.688951590780905289'))
    const trade = computeAMMTrade(poolStorage1, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })
})

describe('computeAMMAmountWithPrice - amm holds long, trader buys', function () {
  it(`amm unsafe - lower than spread`, function () {
    const limitPrice = new BigNumber('6999.999') // best ask/bid = 7000
    const amount = computeAMMAmountWithPrice(poolStorage6, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`amm unsafe - exactly the best ask/bid price - close + open`, function () {
    const limitPrice = new BigNumber('7000')
    const amount = computeAMMAmountWithPrice(poolStorage6, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('2.3'))
    const trade = computeAMMTrade(poolStorage6, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
  })

  it(`amm unsafe - largest amount`, function () {
    const limitPrice = new BigNumber('100000')
    const amount = computeAMMAmountWithPrice(poolStorage6, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('4.534292077640725907'))
    const trade = computeAMMTrade(poolStorage6, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
  })

  it(`amm unsafe - close + open`, function () {
    const limitPrice = new BigNumber('7008')
    const amount = computeAMMAmountWithPrice(poolStorage6, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('2.68369217482083603940884140606'))
    const trade = computeAMMTrade(poolStorage6, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })

  it(`safe - lower than spread`, function () {
    const limitPrice = new BigNumber('6992.495') // spread = 6992.4957785904151334990367462224
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`safe - exactly the best ask/bid price - close + open`, function () {
    const limitPrice = new BigNumber('6992.4957785904151334990367462224')
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('2.217663373523786822'))
    const trade = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })

  it(`safe - close only`, function () {
    const limitPrice = new BigNumber('6992.7')
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('2.282496767610908028'))
    const trade = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })

  it(`safe - close + open`, function () {
    const limitPrice = new BigNumber('6994')
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, true, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('2.688951590780905289'))
    const trade = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })
})

describe('computeAMMAmountWithPrice - amm holds long, trader sells', function () {
  it(`amm unsafe`, function () {
    const limitPrice = new BigNumber(0)
    const amount = computeAMMAmountWithPrice(poolStorage6, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`higher than index`, function () {
    const limitPrice = new BigNumber('6976.9161001')
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount.isZero()).toBeTruthy()
  })

  it(`exactly the best ask/bid price`, function () {
    const limitPrice = new BigNumber('6976.9161')
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-1.9954'))
    const trade = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
  })

  it(`limitPrice is far away`, function () {
    const limitPrice = new BigNumber(0)
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, false, limitPrice)
    // 2.3 => 93.095503235030246126178607648
    expect(amount).toApproximate(normalizeBigNumberish('-90.795503235030246126178607648'))
    const trade = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice.gte(limitPrice)).toBeTruthy()
  })

  it(`normal`, function () {
    const limitPrice = new BigNumber('6800')
    const amount = computeAMMAmountWithPrice(poolStorage4, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-52.542857142857142857'))
    const trade = computeAMMTrade(poolStorage4, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
    expect(trade.tradingPrice).toApproximate(limitPrice)
  })
})

describe('computeAMMAmountWithPrice - online cases', function () {
  it(`slow20210531`, function () {
    const limitPrice = new BigNumber('2399')
    const perp: PerpetualStorage = {
      ...perpetual1,
      initialMarginRate: new BigNumber('0.04'),
      maintenanceMarginRate: new BigNumber('0.03'),
      operatorFeeRate: new BigNumber('0'),
      lpFeeRate: new BigNumber('0.00055'),
      referrerRebateRate: new BigNumber('0.2'),
      liquidationPenaltyRate: new BigNumber('0.01'),
      keeperGasReward: new BigNumber('30'),
      insuranceFundRate: new BigNumber('0.5'),
      maxOpenInterestRate: new BigNumber('3'),
    }
    perp.halfSpread.value = new BigNumber('0.0008')
    perp.openSlippageFactor.value = new BigNumber('0.015')
    perp.closeSlippageFactor.value = new BigNumber('0.011')
    perp.fundingRateFactor.value = new BigNumber('0.005')
    perp.fundingRateLimit.value = new BigNumber('0.01')
    perp.ammMaxLeverage.value = new BigNumber('3')
    perp.maxClosePriceDiscount.value = new BigNumber('0.05')
    const pool: LiquidityPoolStorage = {
      ...defaultPool,
      vaultFeeRate: new BigNumber('0.00015'),
      poolCashBalance: new BigNumber('61439594.83745874751912811'),
      perpetuals: new Map([
        [TEST_MARKET_INDEX0, {
          ...perp,
          markPrice: new BigNumber('2483.26'),
          indexPrice: new BigNumber('2483.26'),
          unitAccumulativeFunding: new BigNumber('5.251555799327968135'),
          openInterest: new BigNumber('29371.273105471586573539'),
          ammCashBalance: new BigNumber('8298681.979842171583354906'),
          ammPositionAmount: new BigNumber('-3229.051128971586573539'),
        }],
        [1, {
          ...perp,
          markPrice: new BigNumber('36074.44'),
          indexPrice: new BigNumber('36074.44'),
          unitAccumulativeFunding: new BigNumber('19.621235681904859106'),
          openInterest: new BigNumber('1275.166235484256783314'),
          ammCashBalance: new BigNumber('3914040.067954807914861364'),
          ammPositionAmount: new BigNumber('-104.380535484256783314'),
        }],
      ])
    }
    const amount = computeAMMAmountWithPrice(pool, TEST_MARKET_INDEX0, false, limitPrice)
    expect(amount).toApproximate(normalizeBigNumberish('-82085.982451575864585182'))
  })

  describe(`limited by δ`, function () {
    let pool = defaultPool

    beforeEach(() => {
      const perp: PerpetualStorage = {
        ...perpetual1,
        initialMarginRate: new BigNumber('0.1'),
        maintenanceMarginRate: new BigNumber('0.05'),
        operatorFeeRate: new BigNumber('0.00005'),
        lpFeeRate: new BigNumber('0.00055'),
        referrerRebateRate: new BigNumber('0.2'),
        liquidationPenaltyRate: new BigNumber('0.01'),
        keeperGasReward: new BigNumber('12'),
        insuranceFundRate: new BigNumber('0.5'),
        maxOpenInterestRate: new BigNumber('3'),
      }
      perp.openSlippageFactor.value = new BigNumber('10')
      perp.closeSlippageFactor.value = new BigNumber('10')
      perp.ammMaxLeverage.value = new BigNumber('1')
      perp.maxClosePriceDiscount.value = new BigNumber('0.05')
      pool = {
        ...defaultPool,
        vaultFeeRate: new BigNumber('0.00015'),
        poolCashBalance: new BigNumber('1039.22753645713125'),
        perpetuals: new Map([
          [TEST_MARKET_INDEX0, {
            ...perp,
            markPrice: new BigNumber('1900.52'),
            indexPrice: new BigNumber('1900.52'),
            unitAccumulativeFunding: new BigNumber('-0.444798988576290844'),
            openInterest: new BigNumber('0.052'),
            ammCashBalance: new BigNumber('-51.67197526787653408'),
            ammPositionAmount: new BigNumber('0.052'),
          }],
        ])
      }
    })

    it('basic info', () => {
      let context = initAMMTradingContext(pool, TEST_MARKET_INDEX0)
      expect(isAMMSafe(context, context.closeSlippageFactor)).toBeTruthy()
      context = computeAMMPoolMargin(context, context.closeSlippageFactor)
      expect(computeBestAskBidPriceIfSafe(context, context.closeSlippageFactor, false)).toApproximate(normalizeBigNumberish('93.605929646536617768'))
      expect(computeBestAskBidPrice(pool, TEST_MARKET_INDEX0, false)).toApproximate(normalizeBigNumberish('1805.494'))
    })

    it('below δ', () => {
      const limitPrice = new BigNumber('1000')
      const amount = computeAMMAmountWithPrice(pool, TEST_MARKET_INDEX0, true, limitPrice)
      expect(amount).toBeBigNumber(_0)
    })

    it('above δ', () => {
      const limitPrice = new BigNumber('1820')      
      const amount = computeAMMAmountWithPrice(pool, TEST_MARKET_INDEX0, true, limitPrice)
      expect(amount).toApproximate(normalizeBigNumberish('0.056729315849480609'))
      const trade = computeAMMTrade(pool, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
      expect(trade.tradingPrice.lte('1820')).toBeTruthy()
      expect(trade.tradingPrice.gte('1819.99')).toBeTruthy()
    })

    it('to the other position side', () => {
      const limitPrice = new BigNumber('10000')      
      const amount = computeAMMAmountWithPrice(pool, TEST_MARKET_INDEX0, true, limitPrice)
      expect(amount).toApproximate(normalizeBigNumberish('0.306480654357728561'))
      const trade = computeAMMTrade(pool, TEST_MARKET_INDEX0, accountStorage1, amount, TradeFlag.MASK_USE_TARGET_LEVERAGE)
      expect(trade.tradingPrice.lte(limitPrice)).toBeTruthy()
    })
  })
})
