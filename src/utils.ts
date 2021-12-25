import { BigNumber } from 'bignumber.js'
import { _0, _1, _2, _3, DECIMALS } from './constants'
import { BigNumberish, InvalidArgumentError, OracleRoute } from './types'
import { ethers } from 'ethers'

export function normalizeBigNumberish(bigNumberish: BigNumberish): BigNumber {
  const bigNumber: BigNumber = bigNumberish instanceof BigNumber ? bigNumberish : new BigNumber(bigNumberish.toString())
  if (bigNumber.isNaN()) {
    throw new InvalidArgumentError(
      `Passed bigNumberish '${bigNumberish}' of type '${typeof bigNumberish}' is not valid.`
    )
  }
  return bigNumber
}

export function normalizeAddress(address: string): string {
  return ethers.utils.getAddress(address.toLowerCase())
}

export function hasTheSameSign(x: BigNumber, y: BigNumber): boolean {
  if (x.s === null || y.s === null) {
    throw new InvalidArgumentError(`null x or y`)
  }
  if (x.isZero() || y.isZero()) {
    return true
  }
  return (x.s ^ y.s) == 0
}

export function splitAmount(positionAmount: BigNumber, amount: BigNumber): { close: BigNumber; open: BigNumber } {
  if (hasTheSameSign(positionAmount, amount)) {
    return { close: _0, open: amount }
  } else if (positionAmount.abs().gte(amount.abs())) {
    return { close: amount, open: _0 }
  } else {
    return { close: positionAmount.negated(), open: positionAmount.plus(amount) }
  }
}

export function mostSignificantBit(x: BigNumber): number {
  let t: BigNumber
  let r = 0
  if (x.gt('57896044618658097711785492504343953926634992332820282019728792003956564819967')) {
    // 2**255 - 1
    throw new InvalidArgumentError(`MSB(${x.toFixed()}) is too large`)
  }
  if ((t = x.idiv('340282366920938463463374607431768211456')).gt(_0)) {
    x = t
    r += 128
  }
  if ((t = x.idiv('18446744073709551616')).gt(_0)) {
    x = t
    r += 64
  }
  if ((t = x.idiv('4294967296')).gt(_0)) {
    x = t
    r += 32
  }
  if ((t = x.idiv('65536')).gt(_0)) {
    x = t
    r += 16
  }
  if ((t = x.idiv('256')).gt(_0)) {
    x = t
    r += 8
  }
  if ((t = x.idiv('16')).gt(_0)) {
    x = t
    r += 4
  }
  if ((t = x.idiv('4')).gt(_0)) {
    x = t
    r += 2
  }
  if ((t = x.idiv('2')).gt(_0)) {
    x = t
    r += 1
  }
  return r
}

export function sqrt(x: BigNumber): BigNumber {
  if (x.lt(_0)) {
    throw new InvalidArgumentError('negative sqrt')
  }

  // we use 10**36 before sqrt
  x = x.shiftedBy(DECIMALS * 2).dp(0, BigNumber.ROUND_DOWN)
  if (x.lt(_3)) {
    const z = x.plus(_1).div(_2)
    return z.shiftedBy(-DECIMALS).dp(DECIMALS, BigNumber.ROUND_DOWN)
  }

  // binary estimate
  // inspired by https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Binary_estimates
  let n = mostSignificantBit(x)
  // make sure initial estimate > sqrt(x)
  // 2^ceil((n + 1) / 2) as initial estimate
  // 2^(n + 1) > x
  // => 2^ceil((n + 1) / 2) > 2^((n + 1) / 2) > sqrt(x)
  n = Math.floor((n + 1) / 2) + 1
  
  // modified babylonian method
  // https://github.com/Uniswap/uniswap-v2-core/blob/v1.0.1/contracts/libraries/Math.sol#L11
  let next = _2.pow(n) // 1 << n
  let y: BigNumber
  do {
    y = next
    next = x
      .div(next)
      .plus(next)
      .div(_2)
    next = next.dp(0, BigNumber.ROUND_DOWN)
  } while (next.lt(y));
  return y.shiftedBy(-DECIMALS).dp(DECIMALS, BigNumber.ROUND_DOWN)
}

export function getOracleRouterKey(path: Array<OracleRoute>): string {
  if (path.length === 0) {
    throw new InvalidArgumentError('empty path')
  }
  const encodedPath = ethers.utils.defaultAbiCoder.encode(
    ["tuple(address oracle, bool isInverse)[]"],
    [path]);
  const hash = ethers.utils.keccak256(encodedPath);
  return hash
}

export function getUniswapV3OracleKey(
  path: Array<string>,
  fees: Array<number>, // 500, 3000, 10000
  shortPeriod: number,
  longPeriod: number,
): string {
  if (path.length < 2) {
    throw new InvalidArgumentError('bad path')
  }
  if (path.length !== fees.length + 1) {
    throw new InvalidArgumentError('bad fees')
  }
  const encodedPath = ethers.utils.defaultAbiCoder.encode(
    ["tuple(address[] path, uint24[] fees, uint32 shortPeriod, uint32 longPeriod)"],
    [{ path, fees, shortPeriod, longPeriod }]);
  const hash = ethers.utils.keccak256(encodedPath);
  return hash
}

// search x*, assuming f(x) satisfies:
// * f(0 <= x <= x*) = true which means x is a safe amount
// * f(x > x*) = false
// the returned x MUST satisfy f(x) = true
export function searchMaxAmount(
  f: (x: BigNumber) => boolean,
  guess: BigNumber | null,
  upperLimit: BigNumber | null = null, // x* < upperLimit
  maxIteration: number | null = null,
  tolerance: BigNumber | null = null, // | new - old | / old < tolerance
): BigNumber {
  // x* ∈ [left, right)
  let left = _0
  let right = new BigNumber('Infinite')
  if (maxIteration === null) {
    maxIteration = 100
  }
  if (tolerance === null) {
    tolerance = new BigNumber('1e-7')
  }
  // shortcut of "0"
  if (!f(tolerance)) {
    return _0
  }
  if (upperLimit === null && guess !== null) {
    // search an upper limit
    if (guess.lte(_0) || !guess.isFinite()) {
      guess = _1
    }
    while (maxIteration > 0) {
      maxIteration -= 1
      if (f(guess)) {
        left = guess
        guess = left.times(2)
      } else {
        right = guess
        break
      }
    }
  } else if (upperLimit !== null && guess === null) {
    // a simple bisect
    right = upperLimit
  } else {
    throw new Error('not supported yet')
  }
  // simple bisect
  while (maxIteration > 0) {
    maxIteration -= 1
    guess = left.plus(right).div(2)
    if (f(guess)) {
      left = guess
    } else {
      right = guess
    }
    if (right.minus(left).div(right).lt(tolerance)) {
      return left
    }
  }
  return left
}

export function decodeTargetLeverage(options: number): number {
  return ((options >> 7) & 0xfffff) / 100
}

export function encodeTargetLeverage(targetLeverage: number): number {
  return (targetLeverage * 100) << 7
}
