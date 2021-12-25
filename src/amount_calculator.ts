/*
  Some peripheral tools to calculate trading amounts

  If you don't need these tools, you can remove this file to reduce the package size.
*/
import { computeAccount, computeAMMTrade, computeAMMPrice, computeAMMOpenInterest, computePerpetualOpenInterestLimit } from './computation'
import { BigNumberish, InvalidArgumentError, AccountStorage, LiquidityPoolStorage, AMMTradingContext, Order, OrderContext } from './types'
import {
  initAMMTradingContext,
  isAMMSafe,
  computeAMMPoolMargin,
  computeAMMSafeShortPositionAmount,
  computeAMMSafeLongPositionAmount,
  computeAMMInternalOpen,
  computeAMMInternalClose,
  computeBestAskBidPriceIfSafe,
  computeBestAskBidPriceIfUnsafe
} from './amm'
import { BugError } from './types'
import { DECIMALS, _0, _1, _2 } from './constants'
import { sqrt, normalizeBigNumberish, searchMaxAmount, encodeTargetLeverage } from './utils'
import BigNumber from 'bignumber.js'
import { orderSideAvailable, splitOrdersByLimitPrice, splitOrderPerpetual, orderPerpetualAvailable } from './order'

// max amount when a trader uses market-order with targetLeverage, 0 means don't automatically deposit / withdraw
// the returned amount is the trader's perspective
export function computeAMMMaxTradeAmount(
  p: LiquidityPoolStorage,
  perpetualIndex: number,
  trader: AccountStorage,
  walletBalance: BigNumberish,
  isTraderBuy: boolean,
  targetLeverage: number
): BigNumber {
  const normalizeWalletBalance = normalizeBigNumberish(walletBalance)

  // if AMM is unsafe, return 0
  const ammContext = initAMMTradingContext(p, perpetualIndex)
  if (!isAMMSafe(ammContext, ammContext.openSlippageFactor)) {
    if (isTraderBuy && ammContext.position1.lt(_0)) {
      return _0
    }
    if (!isTraderBuy && ammContext.position1.gt(_0)) {
      return _0
    }
  }
  // guess = (marginBalance + walletBalance) * lev / index - position
  const traderDetails = computeAccount(p, perpetualIndex, trader)
  let guess
  if (targetLeverage > 0) {
    guess = traderDetails.accountComputed.marginBalance.plus(normalizeWalletBalance)
    guess = guess.times(new BigNumber(targetLeverage)).div(ammContext.index)
  } else {
    guess = traderDetails.accountComputed.marginBalance.div(ammContext.index)
  }
  if (!isTraderBuy) {
    guess = guess.negated()
  }
  guess = guess.minus(trader.positionAmount)
  
  // search
  function checkTrading(a: BigNumber): boolean {
    if (a.isZero()) {
      return true
    }
    if (!isTraderBuy) {
      a = a.negated()
    }
    try {
      const result = computeAMMTrade(p, perpetualIndex, trader, a, encodeTargetLeverage(targetLeverage))
      if (!result.tradeIsSafe || result.adjustCollateral.gt(normalizeWalletBalance)) {
        return false
      }
      return true
    } catch (e) {
      // typically means a is too large
      return false
    }
  }
  let maxAmount = searchMaxAmount(checkTrading, guess.abs())
  if (!isTraderBuy) {
    maxAmount = maxAmount.negated()
  }
  return maxAmount
}

// get amount according to a given (price(amount) * amount) when using market-order with USE_TARGET_LEVERAGE
// the returned amount is the trader's perspective
export function computeAMMTradeAmountByMargin(
  p: LiquidityPoolStorage,
  perpetualIndex: number,
  deltaMargin: BigNumberish, // trader's margin change. < 0 if buy, > 0 if sell
): BigNumber {
  const normalizeDeltaMargin = normalizeBigNumberish(deltaMargin)

  // if AMM is unsafe, return 0
  const ammContext = initAMMTradingContext(p, perpetualIndex)
  if (!isAMMSafe(ammContext, ammContext.openSlippageFactor)) {
    if (normalizeDeltaMargin.lt(_0) && ammContext.position1.lt(_0)) {
      return _0
    }
    if (normalizeDeltaMargin.gt(_0) && ammContext.position1.gt(_0)) {
      return _0
    }
  }

  // shortcut for 0
  if (normalizeDeltaMargin.isZero()) {
    return _0
  }

  // guess = deltaMargin / index
  const guess = normalizeDeltaMargin.div(ammContext.index).negated()
  let isTraderBuy: boolean = true
  if (guess.lt(_0)) {
    isTraderBuy = false
  }

  // search
  function checkTrading(a: BigNumber): boolean {
    if (a.isZero()) {
      return true
    }
    if (!isTraderBuy) {
      a = a.negated()
    }
    try {
      const res = computeAMMPrice(p, perpetualIndex, a)
      return res.deltaAMMMargin.abs().lte(normalizeDeltaMargin.abs())
    } catch (e) {
      // typically means a is too large
      return false
    }
  }
  let maxAmount = searchMaxAmount(checkTrading, guess.abs())
  if (!isTraderBuy) {
    maxAmount = maxAmount.negated()
  }
  return maxAmount
}

// max amount when a trader uses limit-order with USE_TARGET_LEVERAGE
// the returned amount is the trader's perspective
export function computeLimitOrderMaxTradeAmount(
  context: Map<number /* symbol */, OrderContext>,
  walletBalance: BigNumberish,
  orders: Order[],
  symbol: number,
  limitPrice: BigNumberish,
  isTraderBuy: boolean,
  targetLeverage: BigNumberish,
): BigNumber {
  const normalizeWalletBalance = normalizeBigNumberish(walletBalance)
  const normalizeLimitPrice = normalizeBigNumberish(limitPrice)
  const normalizeTargetLeverage = normalizeBigNumberish(targetLeverage)

  // get available margin other than current perpetual
  const symbol2Orders = splitOrderPerpetual(orders)
  let available = normalizeWalletBalance
  symbol2Orders.forEach((otherMarketOrders: Order[], otherMarketSymbol: number) => {
    if (otherMarketSymbol === symbol) {
      return
    }
    const otherMarketContext = context.get(otherMarketSymbol)
    if (!otherMarketContext) {
      throw new InvalidArgumentError(`unknown symbol ${otherMarketSymbol}`)
    }
    available = orderPerpetualAvailable(otherMarketContext.pool, otherMarketContext.perpetualIndex, otherMarketContext.account, available, otherMarketOrders)
  })

  // current perpetual
  const currentMarketContext = context.get(symbol)
  if (!currentMarketContext) {
    throw new InvalidArgumentError(`unknown symbol ${symbol}`)
  }
  const perpetual = currentMarketContext.pool.perpetuals.get(currentMarketContext.perpetualIndex)
  if (!perpetual) {
    throw new InvalidArgumentError(`perpetual ${currentMarketContext.perpetualIndex} not found in the pool`)
  }
  const oldOpenInterest = perpetual.openInterest
  const trader = currentMarketContext.account
  const currentPerpetualOrders: Order[] = symbol2Orders.get(symbol) || [] // probably the 1st order
  const openInterestLimit = computePerpetualOpenInterestLimit(currentMarketContext.pool, currentMarketContext.perpetualIndex)

  // guess = available * lev / index - position
  if (normalizeTargetLeverage.isZero()) {
    throw new InvalidArgumentError('target leverage = 0')
  }
  const traderDetails = computeAccount(currentMarketContext.pool, currentMarketContext.perpetualIndex, trader)
  let guess = available.times(normalizeTargetLeverage).div(perpetual.markPrice)
  if (!isTraderBuy) {
    guess = guess.negated()
  }
  guess = guess.minus(trader.positionAmount)

  // state after executing pre-orders
  const { preOrders, postOrders } = splitOrdersByLimitPrice(currentPerpetualOrders, normalizeLimitPrice, isTraderBuy)
  const preState = orderSideAvailable(
    currentMarketContext.pool, currentMarketContext.perpetualIndex, traderDetails.accountComputed.marginBalance,
    trader.positionAmount, available, preOrders)
  
  // search
  function checkTrading(a: BigNumber): boolean {
    if (a.isZero()) {
      return true
    }
    if (!isTraderBuy) {
      a = a.negated()
    }
    const targetLeverage = normalizeTargetLeverage
    let newOrderState = orderSideAvailable(
      currentMarketContext!.pool, currentMarketContext!.perpetualIndex, preState.remainMargin,
      preState.remainPosition, preState.remainWalletBalance,
      [{ symbol, limitPrice: normalizeLimitPrice, amount: a, targetLeverage }])
    let postState = orderSideAvailable(
      currentMarketContext!.pool, currentMarketContext!.perpetualIndex, newOrderState.remainMargin,
      newOrderState.remainPosition, newOrderState.remainWalletBalance, postOrders)
    if (postState.remainWalletBalance.lt(_0)) {
      // a is too large
      return false
    }
    const newOpenInterest = computeAMMOpenInterest(
      currentMarketContext!.pool, currentMarketContext!.perpetualIndex,
      trader, a
    )
    if (newOpenInterest.gt(oldOpenInterest) && newOpenInterest.gt(openInterestLimit)) {
      // a is too large
      return false
    }
    return true
  }
  let maxAmount = searchMaxAmount(checkTrading, guess.abs())
  if (!isTraderBuy) {
    maxAmount = maxAmount.negated()
  }
  return maxAmount
}

// the inverse function of VWAP of AMM pricing function
// call computeAMMPoolMargin before this function
// the returned amount(= pos2 - pos1) is the AMM's perspective
// make sure ammSafe before this function
export function computeAMMInverseVWAP(
  context: AMMTradingContext,
  price: BigNumber,
  beta: BigNumber,
  isAMMBuy: boolean
): BigNumber {
  const previousMa1MinusMa2 = context.deltaMargin.negated()
  const previousAmount = context.deltaPosition

  /*
  A = P_i^2 β;
  B = -2 P_i M + 2 A N1 + 2 M price;
  C = -2 M (previousMa1MinusMa2 - previousAmount price);
  sols = (-B ± sqrt(B^2 - 4 A C)) / (2 A);
  */
  const a = context.index.times(context.index).times(beta)
  let denominator = a.times(_2)
  if (denominator.isZero()) {
    throw Error(`bad perpetual parameter beta ${beta.toFixed()} or index ${context.index}.`)
  }
  let b = context.index.times(context.poolMargin).negated()
  b = b.plus(a.times(context.position1))
  b = b.plus(context.poolMargin.times(price))
  b = b.times(_2)
  const c = previousMa1MinusMa2
    .minus(previousAmount.times(price))
    .times(context.poolMargin)
    .times(_2)
    .negated()
  const beforeSqrt = a
    .times(c)
    .times(4)
    .negated()
    .plus(b.times(b))
  if (beforeSqrt.lt(_0)) {
    throw new InvalidArgumentError(
      `computeAMMInverseVWAP: impossible price. ` +
        `index = ${context.index.toFixed()}, price = ${price.toFixed()}, ` +
        `M = ${context.poolMargin.toFixed()}, position1 = ${context.position1.toFixed()}, ` +
        `previousMa1MinusMa2 = ${previousMa1MinusMa2.toFixed()}, previousAmount = ${previousAmount.toFixed()}`
    )
  }
  let numerator = sqrt(beforeSqrt)
  if (!isAMMBuy) {
    numerator = numerator.negated()
  }
  numerator = numerator.minus(b)
  const amount = numerator.div(denominator)
  return amount.dp(DECIMALS, BigNumber.ROUND_DOWN)
}

// the returned amount is the trader's perspective
export function computeAMMAmountWithPrice(
  p: LiquidityPoolStorage,
  perpetualIndex: number,
  isTraderBuy: boolean,
  limitPrice: BigNumberish
): BigNumber {
  const perpetual = p.perpetuals.get(perpetualIndex)
  if (!perpetual) {
    throw new InvalidArgumentError(`perpetual ${perpetualIndex} not found in the pool`)
  }
  let normalizedLimitPrice = normalizeBigNumberish(limitPrice)

  // get amount
  const isAMMBuy = !isTraderBuy
  let context = initAMMTradingContext(p, perpetualIndex)
  if (context.position1.lte(_0) && !isAMMBuy) {
    return computeAMMOpenAmountWithPrice(context, normalizedLimitPrice, isAMMBuy).negated()
  } else if (context.position1.lt(_0) && isAMMBuy) {
    //                         ^^ == 0 is another story
    return computeAMMCloseAndOpenAmountWithPrice(context, normalizedLimitPrice, isAMMBuy).negated()
  } else if (context.position1.gte(_0) && isAMMBuy) {
    return computeAMMOpenAmountWithPrice(context, normalizedLimitPrice, isAMMBuy).negated()
  } else if (context.position1.gt(_0) && !isAMMBuy) {
    //                         ^^ == 0 is another story
    return computeAMMCloseAndOpenAmountWithPrice(context, normalizedLimitPrice, isAMMBuy).negated()
  }
  throw new InvalidArgumentError('bug: unknown trading direction')
}

// spread and fees are ignored. add them after calling this function
// the returned amount is the AMM's perspective
export function computeAMMOpenAmountWithPrice(
  context: AMMTradingContext,
  limitPrice: BigNumber,
  isAMMBuy: boolean
): BigNumber {
  if (
    (isAMMBuy && context.position1.lt(_0)) /* short buy */ ||
    (!isAMMBuy && context.position1.gt(_0)) /* long sell */
  ) {
    throw new InvalidArgumentError(`this is not opening. pos1: ${context.position1} isBuy: ${isAMMBuy}`)
  }

  // case 1: unsafe open
  if (!isAMMSafe(context, context.openSlippageFactor)) {
    return _0
  }
  context = computeAMMPoolMargin(context, context.openSlippageFactor)

  // case 2: limit by spread
  if (context.bestAskBidPrice === null) {
    context.bestAskBidPrice = computeBestAskBidPriceIfSafe(context, context.openSlippageFactor, isAMMBuy)
  }
  if (isAMMBuy) {
    if (limitPrice.gt(context.bestAskBidPrice)) {
      return _0
    }
  } else {
    if (limitPrice.lt(context.bestAskBidPrice)) {
      return _0
    }
  }

  // case 3: limit by safePos
  let safePos2: BigNumber
  if (isAMMBuy) {
    safePos2 = computeAMMSafeLongPositionAmount(context, context.openSlippageFactor)
    if (safePos2.lt(context.position1)) {
      return _0
    }
  } else {
    safePos2 = computeAMMSafeShortPositionAmount(context, context.openSlippageFactor)
    if (safePos2.gt(context.position1)) {
      return _0
    }
  }
  const maxAmount = safePos2.minus(context.position1)
  const safePos2Context = computeAMMInternalOpen(context, maxAmount)
  if (!maxAmount.eq(safePos2Context.deltaPosition.minus(context.deltaPosition))) {
    throw new BugError('open positions failed')
  }
  const safePos2Price = safePos2Context.deltaMargin.div(safePos2Context.deltaPosition).abs()
  if (
    (isAMMBuy && safePos2Price.gte(limitPrice)) /* long open. trader sell */ ||
    (!isAMMBuy && safePos2Price.lte(limitPrice)) /* short open. trader buy */
  ) {
    return maxAmount
  }

  // case 3: inverse function of price function
  const amount = computeAMMInverseVWAP(context, limitPrice, context.openSlippageFactor, isAMMBuy)
  if ((isAMMBuy && amount.gt(_0)) /* long open success */ || (!isAMMBuy && amount.lt(_0)) /* short open success */) {
    return amount
  }

  // invalid open. only close is possible
  return _0
}

// spread and fees are ignored. add them after calling this function
// the returned amount is the AMM's perspective
export function computeAMMCloseAndOpenAmountWithPrice(
  context: AMMTradingContext,
  limitPrice: BigNumber,
  isAMMBuy: boolean
): BigNumber {
  if (!context.deltaMargin.isZero() || !context.deltaPosition.isZero()) {
    throw new InvalidArgumentError('partial close is not supported')
  }
  if (context.position1.isZero()) {
    throw new InvalidArgumentError('close from 0 is not supported')
  }

  // case 1: limit by α
  const ammSafe = isAMMSafe(context, context.closeSlippageFactor)
  if (ammSafe) {
    context = computeAMMPoolMargin(context, context.closeSlippageFactor)
    context.bestAskBidPrice = computeBestAskBidPriceIfSafe(context, context.closeSlippageFactor, isAMMBuy)
  } else {
    context.bestAskBidPrice = computeBestAskBidPriceIfUnsafe(context)
  }
  if (isAMMBuy) {
    if (limitPrice.gt(context.bestAskBidPrice)) {
      return _0
    }
  } else {
    if (limitPrice.lt(context.bestAskBidPrice)) {
      return _0
    }
  }

  // case 2: limit by δ
  let discount = context.maxClosePriceDiscount
  if (context.position1.gt(_0)) {
    discount = discount.negated()
  }
  const discountLimitPrice = _1.plus(discount).times(context.index)
  if (isAMMBuy) {
    if (limitPrice.gt(discountLimitPrice)) {
      return _0
    }
  } else {
    if (limitPrice.lt(discountLimitPrice)) {
      return _0
    }
  }

  // case 3: if close all (amm position = 0), check the price
  const zeroContext = computeAMMInternalClose(context, context.position1.negated())
  if (zeroContext.deltaPosition.isZero()) {
    throw new BugError('close to zero failed')
  }

  const zeroPrice = zeroContext.deltaMargin.div(zeroContext.deltaPosition).abs()
  if (
    (isAMMBuy && zeroPrice.gte(limitPrice)) /* short close */ ||
    (!isAMMBuy && zeroPrice.lte(limitPrice)) /* long close */
  ) {
    // close all
    context = zeroContext
  } else if (!ammSafe) {
    // case 4: unsafe close, but price not matched
    return _0
  } else {
    // case 5: close by price
    const amount = computeAMMInverseVWAP(context, limitPrice, context.closeSlippageFactor, isAMMBuy)
    if (
      (isAMMBuy && amount.gt(_0)) /* short close success */ ||
      (!isAMMBuy && amount.lt(_0)) /* long close success */
    ) {
      context = computeAMMInternalClose(context, amount)
    } else {
      // invalid close. only open is possible
    }
  }

  // case 6: open positions
  if (
    (isAMMBuy && context.position1.gte(_0)) /* cross 0 after short close */ ||
    (!isAMMBuy && context.position1.lte(_0)) /* cross 0 after long close */
  ) {
    const openAmount = computeAMMOpenAmountWithPrice(context, limitPrice, isAMMBuy)
    return context.deltaPosition.plus(openAmount)
  }
  return context.deltaPosition
}
