import { BigNumber } from 'bignumber.js'
import { ethers } from 'ethers'
import { Provider } from '@ethersproject/providers'

export type BigNumberish = BigNumber | ethers.BigNumber | string | number

export type SignerOrProvider = ethers.Signer | Provider

/**
 * Indicates that the AMM has insufficient reserves for a desired amount.
 * I.e. if the trade completes, the margin of the AMM will be not enough.
 */
export class InsufficientLiquidityError extends Error {
  public readonly isInsufficientLiquidityError: true = true

  public constructor(message: string) {
    super()
    this.name = message
  }
}

/**
 * Indicates that calling convention error or bugs happened.
 */
export class BugError extends Error {
  public constructor(message: string) {
    super()
    this.name = message
  }
}

/**
 * Indicates that if the trade completes, the open interest will exceed the limit.
 */
 export class OpenInterestExceededError extends Error {
  public readonly isOpenInterestExceededError: true = true
  public readonly newOpenInterest: BigNumber
  public readonly limit: BigNumber

  public constructor(message: string, newOpenInterest: BigNumber, limit: BigNumber) {
    super()
    this.name = message
    this.newOpenInterest = newOpenInterest
    this.limit = limit
  }
}

/**
 * Invalid argument or the query condition is impossible.
 */
export class InvalidArgumentError extends Error {
  public constructor(message: string) {
    super()
    this.name = message
  }
}

export enum PerpetualState {
  INVALID,
  INITIALIZING,
  NORMAL,
  EMERGENCY,
  CLEARED
}

export enum TradeFlag {
  MASK_CLOSE_ONLY = 0x80000000,
  MASK_MARKET_ORDER = 0x40000000,
  MASK_STOP_LOSS_ORDER = 0x20000000,
  MASK_TAKE_PROFIT_ORDER = 0x10000000,
  MASK_USE_TARGET_LEVERAGE = 0x08000000
}

export interface PerpetualID {
  liquidityPoolAddress: string
  perpetualIndex: number
}

export interface Option {
  value: BigNumber
  minValue: BigNumber
  maxValue: BigNumber
}

export interface LiquidityPoolStorage {
  isSynced: boolean // rue if the funding state is synced to real-time data. False if error happens (oracle error, zero price etc.). In this case, trading, withdraw (if position != 0), addLiquidity, removeLiquidity will fail
  isRunning: boolean // True if the liquidity pool is running
  isFastCreationEnabled: boolean // True if the operator of the liquidity pool is allowed to create new perpetual when the liquidity pool is running
  insuranceFundCap: BigNumber

  creator: string
  operator: string
  transferringOperator: string
  governor: string
  shareToken: string
  collateral: string
  vault: string
  vaultFeeRate: BigNumber
  collateralDecimals: number

  poolCashBalance: BigNumber
  isAMMMaintenanceSafe: boolean
  fundingTime: number
  operatorExpiration: number
  insuranceFund: BigNumber
  donatedInsuranceFund: BigNumber
  liquidityCap: BigNumber
  shareTransferDelay: number

  perpetuals: Map<number, PerpetualStorage>,
}

export interface PerpetualStorage {
  state: PerpetualState
  oracle: string

  totalCollateral: BigNumber
  markPrice: BigNumber // markPrice = settlementPrice if it is in EMERGENCY state
  indexPrice: BigNumber
  fundingRate: BigNumber
  unitAccumulativeFunding: BigNumber // committed funding payment

  initialMarginRate: BigNumber
  maintenanceMarginRate: BigNumber
  operatorFeeRate: BigNumber
  lpFeeRate: BigNumber
  referrerRebateRate: BigNumber
  liquidationPenaltyRate: BigNumber
  keeperGasReward: BigNumber
  insuranceFundRate: BigNumber
  openInterest: BigNumber
  maxOpenInterestRate: BigNumber // openInterest <= poolMargin * maxOpenInterestRate / indexPrice

  halfSpread: Option // ??
  openSlippageFactor: Option // ??1
  closeSlippageFactor: Option // ??2
  fundingRateFactor: Option // ??
  fundingRateLimit: Option // ??
  ammMaxLeverage: Option // ??
  maxClosePriceDiscount: Option // ??
  defaultTargetLeverage: Option
  baseFundingRate: Option

  symbol: number
  underlyingSymbol: string
  isMarketClosed: boolean
  isTerminated: boolean
  ammCashBalance: BigNumber
  ammPositionAmount: BigNumber
  isInversePerpetual: boolean
}

export interface AccountStorage {
  cashBalance: BigNumber
  positionAmount: BigNumber
  targetLeverage: BigNumber

  // read from the graph
  entryValue: BigNumber | null
  entryFunding: BigNumber | null
}

export interface AccountComputed {
  positionValue: BigNumber // mark * | position |
  positionMargin: BigNumber // positionValue * IMRate
  maintenanceMargin: BigNumber // positionValue * MMRate
  availableCashBalance: BigNumber // cash - accumulatedFunding * position
  marginBalance: BigNumber // cash + i pos - accumulatedFunding * position
  availableMargin: BigNumber // marginBalance - positionMargin, possibly negative
  withdrawableBalance: BigNumber
  isMMSafe: boolean // use this if check liquidation
  isIMSafe: boolean // use this if open positions
  isMarginSafe: boolean // use this if close positions. also known as bankrupt
  leverage: BigNumber // positionValue / marginBalance
  marginRatio: BigNumber // maintenanceMargin / marginBalance

  entryPrice: BigNumber | null
  fundingPNL: BigNumber | null // entryFunding - pos * accumulatedFunding
  pnl1: BigNumber | null // pos * (exitPrice - entryPrice) if entry != null
  pnl2: BigNumber | null // pnl1 + funding if entry != null
  roe: BigNumber | null

  // the estimated liquidation price helps traders to know when to close their positions.
  // it has already considered the close position trading fee. this value is different
  // from the keeper's liquidation price who does not pay the trading fee.
  liquidationPrice: BigNumber
}

export interface AccountDetails {
  accountStorage: AccountStorage
  accountComputed: AccountComputed
}

export interface TradeCost {
  account: AccountDetails
  marginCost: BigNumber
  fee: BigNumber
}

export interface AMMTradingContext {
  // current trading perpetual
  index: BigNumber // P_i_m
  position1: BigNumber // N_m
  halfSpread: BigNumber // ??_m
  openSlippageFactor: BigNumber // ??1_m
  closeSlippageFactor: BigNumber // ??2_m
  fundingRateFactor: BigNumber // ??_m
  fundingRateLimit: BigNumber // ??_m
  maxClosePriceDiscount: BigNumber // ??_m
  ammMaxLeverage: BigNumber // ??_m
  
  // other perpetuals
  otherIndex: BigNumber[] // P_i_j
  otherPosition: BigNumber[] // N_j
  otherOpenSlippageFactor: BigNumber[] // ??1_j
  otherAMMMaxLeverage: BigNumber[] // ??_j

  // total
  cash: BigNumber // M_c
  poolMargin: BigNumber // M

  // trading result
  deltaMargin: BigNumber // cash2 - cash1
  deltaPosition: BigNumber // position2 - position1
  bestAskBidPrice: BigNumber | null // best ask price or best bid price (also the price at spread)

  // eager evaluation
  valueWithoutCurrent: BigNumber // ??_j (P_i_j * N_j) where j ??? id
  squareValueWithoutCurrent: BigNumber // ??_j (??1_j * P_i_j^2 * N_j^2) where j ??? id
  positionMarginWithoutCurrent: BigNumber // ??_j (P_i_j * | N_j | / ??_j) where j ??? id
}

export interface TradeWithPriceResult {
  afterTrade: AccountDetails
  tradeIsSafe: boolean
  totalFee: BigNumber
  adjustCollateral: BigNumber // auto deposit or withdraw if option = MASK_USE_TARGET_LEVERAGE. > 0 means auto deposit from wallet
}

export interface AMMTradingResult {
  tradeIsSafe: boolean
  trader: AccountDetails
  newPool: LiquidityPoolStorage
  totalFee: BigNumber
  tradingPrice: BigNumber
  adjustCollateral: BigNumber // auto deposit or withdraw if option = MASK_USE_TARGET_LEVERAGE. > 0 means auto deposit from wallet
}

export interface OracleRoute {
  oracle: string
  isInverse: boolean
}

export interface PreviewOracleRouterResult {
  markPrice: BigNumber
  markPriceTime: number
  indexPrice: BigNumber
  indexPriceTime: number
  isMarketClosed: boolean
  isTerminated: boolean
}

export interface Order {
  symbol: number // PerpetualStorage.symbol
  limitPrice: BigNumber
  amount: BigNumber // should be availableAmount + pendingAmount
  targetLeverage: BigNumber
}

export interface OrderContext {
  pool: LiquidityPoolStorage
  perpetualIndex: number
  account: AccountStorage
}
