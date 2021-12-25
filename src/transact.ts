import { ethers } from 'ethers'
import { DECIMALS } from './constants'
import { BigNumberish, TradeFlag } from './types'
import { normalizeBigNumberish } from './utils'
import BigNumber from 'bignumber.js'
import type { LiquidityPool } from './abi/LiquidityPool'
import type { Broker } from './abi/Broker'
import { Overrides, PayableOverrides } from '@ethersproject/contracts'
import { getAddress } from '@ethersproject/address'
import { LpGovernor } from './abi/LpGovernor'

export async function perpetualTrade(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  trader: string,
  tradeAmount: BigNumberish, // +1.23 means buy, -1.23 means sell
  limitPrice: BigNumberish,
  deadline: number,
  referrer: string,
  flag: TradeFlag,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  getAddress(trader)
  getAddress(referrer)
  const largeAmount = normalizeBigNumberish(tradeAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  const largeLimitPrice = normalizeBigNumberish(limitPrice)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.trade(
    perpetualIndex, trader, largeAmount.toFixed(), largeLimitPrice.toFixed(),
    deadline, referrer, flag,
    overrides)
}

export async function perpetualDeposit(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  trader: string,
  collateralAmount: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: PayableOverrides = {},
): Promise<ethers.providers.TransactionResponse> {
  getAddress(trader)
  const largeAmount = normalizeBigNumberish(collateralAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.deposit(perpetualIndex, trader, largeAmount.toFixed(), overrides)
}

export async function perpetualWithdraw(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  trader: string,
  collateralAmount: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  const largeAmount = normalizeBigNumberish(collateralAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.withdraw(perpetualIndex, trader, largeAmount.toFixed(), overrides)
}

export async function brokerDeposit(
  broker: Broker,
  tokenAmount: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: PayableOverrides = {},
): Promise<ethers.providers.TransactionResponse> {
  const largeAmount = normalizeBigNumberish(tokenAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  overrides.value = largeAmount.toFixed()
  return await broker.deposit(overrides)
}

export async function brokerWithdraw(
  broker: Broker,
  tokenAmount: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  const largeAmount = normalizeBigNumberish(tokenAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await broker.withdraw(largeAmount.toFixed(), overrides)
}

export async function perpetualClear(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  return await liquidityPool.clear(perpetualIndex, overrides)
}

export async function perpetualSettle(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  trader: string,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  getAddress(trader)
  return await liquidityPool.settle(perpetualIndex, trader, overrides)
}

export async function addLiquidity(
  liquidityPool: LiquidityPool,
  collateralAmount: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  const largeAmount = normalizeBigNumberish(collateralAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.addLiquidity(largeAmount.toFixed(), overrides)
}

export async function removeLiquidity(
  liquidityPool: LiquidityPool,
  shareToRemove: BigNumberish, // should be a decimal number (ie: 1.234)
  cashToReturn: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  const largeShareToRemove = normalizeBigNumberish(shareToRemove)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  const largeCashToReturn = normalizeBigNumberish(cashToReturn)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.removeLiquidity(largeShareToRemove.toFixed(), largeCashToReturn.toFixed(), overrides)
}

export async function donateInsuranceFund(
  liquidityPool: LiquidityPool,
  collateralAmount: BigNumberish, // should be a decimal number (ie: 1.234)
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  const largeAmount = normalizeBigNumberish(collateralAmount)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.donateInsuranceFund(largeAmount.toFixed(), overrides)
}

export async function takerOverOperator(
  liquidityPool: LiquidityPool,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  return await liquidityPool.claimOperator(overrides)
}

export async function transferOperator(
  liquidityPool: LiquidityPool,
  targetAddress: string,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  getAddress(targetAddress)
  return await liquidityPool.transferOperator(targetAddress, overrides)
}

export async function claimMiningReward(
  mining: LpGovernor,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  return await mining.getReward(overrides)
}

export async function setTargetLeverage(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  trader: string,
  targetLeverage: BigNumberish,
  overrides: Overrides = {},
): Promise<ethers.providers.TransactionResponse> {
  getAddress(trader)
  const leverage = normalizeBigNumberish(targetLeverage)
    .shiftedBy(DECIMALS)
    .dp(0, BigNumber.ROUND_DOWN)
  return await liquidityPool.setTargetLeverage(perpetualIndex, trader, leverage.toFixed(), overrides)
}
