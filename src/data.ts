import { ethers } from 'ethers'
import { getAddress } from '@ethersproject/address'
import { BigNumber } from 'bignumber.js'
import { normalizeBigNumberish } from './utils'
import { _0, DECIMALS, CHAIN_ID_TO_READER_ADDRESS, _1 } from './constants'
import { AccountStorage, LiquidityPoolStorage, PerpetualState, PerpetualID, PreviewOracleRouterResult } from './types'
import { InvalidArgumentError, BugError, SignerOrProvider, OracleRoute } from './types'
import { Broker } from './abi/Broker'
import { BrokerFactory } from './abi/BrokerFactory'
import { LiquidityPool } from './abi/LiquidityPool'
import { LiquidityPoolFactory } from './abi/LiquidityPoolFactory'
import { PoolCreator } from './abi/PoolCreator'
import { PoolCreatorFactory } from './abi/PoolCreatorFactory'
import { Reader } from './abi/Reader'
import { ReaderFactory } from './abi/ReaderFactory'
import { SymbolService } from './abi/SymbolService'
import { SymbolServiceFactory } from './abi/SymbolServiceFactory'
import { LpGovernor } from './abi/LpGovernor'
import { LpGovernorFactory } from './abi/LpGovernorFactory'
import { IOracle } from './abi/IOracle'
import { IOracleFactory } from './abi/IOracleFactory'
import { OracleRouterCreatorFactory } from './abi/OracleRouterCreatorFactory'
import { OracleRouterCreator } from './abi/OracleRouterCreator'
import { InverseStateService } from './abi/InverseStateService'
import { InverseStateServiceFactory } from './abi/InverseStateServiceFactory'

export function getLiquidityPoolContract(contractAddress: string, signerOrProvider: SignerOrProvider): LiquidityPool {
  getAddress(contractAddress)
  return LiquidityPoolFactory.connect(contractAddress, signerOrProvider)
}

export function getOracleContract(contractAddress: string, signerOrProvider: SignerOrProvider): IOracle {
  getAddress(contractAddress)
  return IOracleFactory.connect(contractAddress, signerOrProvider)
}

export function getBrokerContract(contractAddress: string, signerOrProvider: SignerOrProvider): Broker {
  getAddress(contractAddress)
  return BrokerFactory.connect(contractAddress, signerOrProvider)
}

export function getPoolCreatorContract(contractAddress: string, signerOrProvider: SignerOrProvider): PoolCreator {
  getAddress(contractAddress)
  return PoolCreatorFactory.connect(contractAddress, signerOrProvider)
}

export function getOracleRouterCreatorContract(contractAddress: string, signerOrProvider: SignerOrProvider): OracleRouterCreator {
  getAddress(contractAddress)
  return OracleRouterCreatorFactory.connect(contractAddress, signerOrProvider)
}

export function getSymbolServiceContract(contractAddress: string, signerOrProvider: SignerOrProvider): SymbolService {
  getAddress(contractAddress)
  return SymbolServiceFactory.connect(contractAddress, signerOrProvider)
}

export function getLpGovernorContract(contractAddress: string, signerOrProvider: SignerOrProvider): LpGovernor {
  getAddress(contractAddress)
  return LpGovernorFactory.connect(contractAddress, signerOrProvider)
}

export async function getReaderContract(signerOrProvider: SignerOrProvider, contractAddress?: string): Promise<Reader> {
  if (!contractAddress) {
    let chainId = 0
    if (signerOrProvider instanceof ethers.Signer) {
      if (!signerOrProvider.provider) {
        throw new InvalidArgumentError('the given Signer does not have a Provider')
      }
      chainId = (await signerOrProvider.provider.getNetwork()).chainId
    } else {
      chainId = (await signerOrProvider.getNetwork()).chainId
    }
    contractAddress = CHAIN_ID_TO_READER_ADDRESS[chainId]
    if (!contractAddress) {
      throw new InvalidArgumentError(`unknown chainId ${chainId}`)
    }
  }
  return ReaderFactory.connect(contractAddress, signerOrProvider)
}

export function getInverseStateService(contractAddress: string, signerOrProvider: SignerOrProvider): InverseStateService {
  getAddress(contractAddress)
  return InverseStateServiceFactory.connect(contractAddress, signerOrProvider)
}

export async function getLiquidityPool(reader: Reader, liquidityPoolAddress: string): Promise<LiquidityPoolStorage> {
  getAddress(liquidityPoolAddress)
  let { isSynced, pool } = await reader.callStatic.getLiquidityPoolStorage(liquidityPoolAddress)
  // there is an edge case. if the oracle is terminated, the Reader will automatically set the Perpetual into
  // Emergency mode if it was Normal mode (because it calls forceToSyncState), which is only useful for on-chain
  // programs and useless for off-chain programs. instead, in this case, we re-read from Getter to get the
  // real chain state
  const hasTerminatedOracle = !!pool.perpetuals.find(m => m.isTerminated)
  const getter = getLiquidityPoolContract(liquidityPoolAddress, reader.provider)
  type ThenArg<T> = T extends PromiseLike<infer U> ? U : T
  type GetterGetLiquidityPoolInfo = ThenArg<ReturnType<typeof getter.callStatic.getLiquidityPoolInfo>>
  type GetterGetPerpetualInfo = ThenArg<ReturnType<typeof getter.callStatic.getPerpetualInfo>>
  let chainStates: (GetterGetLiquidityPoolInfo | GetterGetPerpetualInfo)[] = []
  if (hasTerminatedOracle) {
    // query getter
    const chainStateRequests: Promise<GetterGetLiquidityPoolInfo | GetterGetPerpetualInfo>[] = []
    chainStateRequests.push(getter.callStatic.getLiquidityPoolInfo())
    for (let i = 0; i < pool.perpetuals.length; i++) {
      chainStateRequests.push(getter.callStatic.getPerpetualInfo(i))
    }
    chainStates = await Promise.all(chainStateRequests)
    // overwrite pool state
    const chainState = chainStates[0] as GetterGetLiquidityPoolInfo
    isSynced = false
    pool = {
      ...pool,
      isRunning: chainState.isRunning,
      isFastCreationEnabled: chainState.isFastCreationEnabled,
      addresses: chainState.addresses,
      intNums: chainState.intNums,
      uintNums: chainState.uintNums,
    }
  }
  // copy the pool state
  const ret: LiquidityPoolStorage = {
    isSynced,
    isRunning: pool.isRunning,
    isFastCreationEnabled: pool.isFastCreationEnabled,
    creator: pool.addresses[0],
    operator: pool.addresses[1],
    transferringOperator: pool.addresses[2],
    governor: pool.addresses[3],
    shareToken: pool.addresses[4],
    collateral: pool.addresses[5],
    vault: pool.addresses[6],
    vaultFeeRate: normalizeBigNumberish(pool.intNums[0]).shiftedBy(-DECIMALS),
    poolCashBalance: normalizeBigNumberish(pool.intNums[1]).shiftedBy(-DECIMALS),
    isAMMMaintenanceSafe: pool.isAMMMaintenanceSafe,
    insuranceFundCap: normalizeBigNumberish(pool.intNums[2]).shiftedBy(-DECIMALS),
    insuranceFund: normalizeBigNumberish(pool.intNums[3]).shiftedBy(-DECIMALS),
    donatedInsuranceFund: normalizeBigNumberish(pool.intNums[4]).shiftedBy(-DECIMALS),
    collateralDecimals: pool.uintNums[0].toNumber(),
    fundingTime: pool.uintNums[2].toNumber(),
    operatorExpiration: pool.uintNums[3].toNumber(),
    liquidityCap: normalizeBigNumberish(pool.uintNums[4]).shiftedBy(-DECIMALS),
    shareTransferDelay: pool.uintNums[5].toNumber(),

    perpetuals: new Map(),
  }
  // copy the perpetual state
  for (let i = 0; i < pool.perpetuals.length; i++) {
    let m = pool.perpetuals[i]
    if (m.state < PerpetualState.INVALID || m.state > PerpetualState.CLEARED) {
      throw new Error(`unrecognized perpetual state: ${m.state}`)
    }
    const parsePerpNums = (index: number) => {
      return normalizeBigNumberish(m.nums[index]).shiftedBy(-DECIMALS)
    }
    if (hasTerminatedOracle) {
      // overwrite perp state
      const chainState = chainStates[i + 1] as GetterGetPerpetualInfo
      m = {
        ...m,
        state: chainState.state,
        oracle: chainState.oracle,
        nums: chainState.nums,
      }
    }
    ret.perpetuals.set(i, {
      state: m.state as PerpetualState,
      oracle: m.oracle,

      totalCollateral: parsePerpNums(0),
      markPrice: parsePerpNums(1),
      indexPrice: parsePerpNums(2),
      fundingRate: parsePerpNums(3),
      unitAccumulativeFunding: parsePerpNums(4),

      initialMarginRate: parsePerpNums(5),
      maintenanceMarginRate: parsePerpNums(6),
      operatorFeeRate: parsePerpNums(7),
      lpFeeRate: parsePerpNums(8),
      referrerRebateRate: parsePerpNums(9),
      liquidationPenaltyRate: parsePerpNums(10),
      keeperGasReward: parsePerpNums(11),
      insuranceFundRate: parsePerpNums(12),

      halfSpread: {
        value: parsePerpNums(13),
        minValue: parsePerpNums(14),
        maxValue: parsePerpNums(15)
      },
      openSlippageFactor: {
        value: parsePerpNums(16),
        minValue: parsePerpNums(17),
        maxValue: parsePerpNums(18)
      },
      closeSlippageFactor: {
        value: parsePerpNums(19),
        minValue: parsePerpNums(20),
        maxValue: parsePerpNums(21)
      },
      fundingRateLimit: {
        value: parsePerpNums(22),
        minValue: parsePerpNums(23),
        maxValue: parsePerpNums(24)
      },
      ammMaxLeverage: {
        value: parsePerpNums(25),
        minValue: parsePerpNums(26),
        maxValue: parsePerpNums(27)
      },
      maxClosePriceDiscount: {
        value: parsePerpNums(28),
        minValue: parsePerpNums(29),
        maxValue: parsePerpNums(30)
      },
      openInterest: parsePerpNums(31),
      maxOpenInterestRate: parsePerpNums(32),
      fundingRateFactor: {
        value: parsePerpNums(33),
        minValue: parsePerpNums(34),
        maxValue: parsePerpNums(35)
      },
      defaultTargetLeverage: {
        value: parsePerpNums(36),
        minValue: parsePerpNums(37),
        maxValue: parsePerpNums(38)
      },
      baseFundingRate: {
        value: parsePerpNums(39),
        minValue: parsePerpNums(40),
        maxValue: parsePerpNums(41)
      },
      symbol: m.symbol.toNumber(),
      underlyingSymbol: m.underlyingAsset,
      isMarketClosed: m.isMarketClosed,
      isTerminated: m.isTerminated,
      ammCashBalance: normalizeBigNumberish(m.ammCashBalance).shiftedBy(-DECIMALS),
      ammPositionAmount: normalizeBigNumberish(m.ammPositionAmount).shiftedBy(-DECIMALS),
      isInversePerpetual: m.isInversePerpetual,
    })
  } // foreach perpetual
  return ret
}

export async function getAccountStorage(
  reader: Reader,
  liquidityPoolAddress: string,
  perpetualIndex: number,
  traderAddress: string
): Promise<AccountStorage> {
  getAddress(liquidityPoolAddress)
  getAddress(traderAddress)
  const { accountStorage } = await reader.callStatic.getAccountStorage(
    liquidityPoolAddress,
    perpetualIndex,
    traderAddress
  )
  return {
    cashBalance: normalizeBigNumberish(accountStorage.cash).shiftedBy(-DECIMALS),
    positionAmount: normalizeBigNumberish(accountStorage.position).shiftedBy(-DECIMALS),
    targetLeverage: normalizeBigNumberish(accountStorage.targetLeverage).shiftedBy(-DECIMALS),
    entryValue: null,
    entryFunding: null
  }
}

export async function getBrokerBalanceOf(broker: Broker, trader: string): Promise<BigNumber> {
  getAddress(trader)
  const balance = await broker.balanceOf(trader)
  return normalizeBigNumberish(balance).shiftedBy(-DECIMALS)
}

export async function listActivatePerpetualsOfTrader(poolCreator: PoolCreator, trader: string): Promise<PerpetualID[]> {
  getAddress(trader)
  const count = (await poolCreator.getActiveLiquidityPoolCountOf(trader)).toNumber()
  if (count > 10000) {
    throw new BugError(`activate pool count is too large: ${count}`)
  }
  let ret: PerpetualID[] = []
  const step = 100
  for (let begin = 0; begin < count; begin = ret.length) {
    let end = Math.min(begin + step, count)
    const ids = await poolCreator.listActiveLiquidityPoolsOf(trader, begin, end)
    if (ids.length === 0) {
      break
    }
    ids.forEach(j => {
      ret.push({
        liquidityPoolAddress: j.liquidityPool,
        perpetualIndex: j.perpetualIndex.toNumber()
      })
    })
  }
  return ret
}

export async function listLiquidityPoolOfOperator(poolCreator: PoolCreator, operator: string): Promise<string[]> {
  getAddress(operator)
  const count = (await poolCreator.getOwnedLiquidityPoolsCountOf(operator)).toNumber()
  if (count > 10000) {
    throw new BugError(`activate pool count is too large: ${count}`)
  }
  let ret: string[] = []
  const step = 100
  for (let begin = 0; begin < count; begin = ret.length) {
    let end = Math.min(begin + step, count)
    const ids = await poolCreator.listLiquidityPoolOwnedBy(operator, begin, end)
    if (ids.length === 0) {
      break
    }
    ret = ret.concat(ids)
  }
  return ret
}

export async function getPerpetualClearProgress(
  liquidityPool: LiquidityPool,
  perpetualIndex: number
): Promise<{
  left: BigNumber
  total: BigNumber
}> {
  const progressInfo = await liquidityPool.callStatic.getClearProgress(perpetualIndex)
  const left = normalizeBigNumberish(progressInfo.left)
  const total = normalizeBigNumberish(progressInfo.total)
  return { left, total }
}

export async function getPerpetualClearGasReward(
  liquidityPool: LiquidityPool,
  perpetualIndex: number,
  collateralDecimals: number
): Promise<BigNumber> {
  const perpetualInfo = await liquidityPool.callStatic.getPerpetualInfo(perpetualIndex)
  const keeperGasReward = normalizeBigNumberish(perpetualInfo.nums[11]).shiftedBy(-collateralDecimals)
  return keeperGasReward
}

export async function previewOracleRouter(path: Array<OracleRoute>, signerOrProvider: SignerOrProvider): Promise<PreviewOracleRouterResult> {
  if (path.length === 0) {
    throw new InvalidArgumentError('empty path')
  }
  const ret: PreviewOracleRouterResult = {
    markPrice: _1,
    markPriceTime: 0,
    indexPrice: _1,
    indexPriceTime: 0,
    isMarketClosed: false,
    isTerminated: false,
  }
  const query: Array<Promise<boolean | { newPrice: ethers.BigNumber; newTimestamp: ethers.BigNumber; }>> = []
  for (let i = 0; i < path.length; i++) {
    const iOracle = getOracleContract(path[i].oracle, signerOrProvider)
    query.push(iOracle.callStatic.priceTWAPLong())
    query.push(iOracle.callStatic.priceTWAPShort())
    query.push(iOracle.callStatic.isMarketClosed())
    query.push(iOracle.callStatic.isTerminated())
  }
  const prices = await Promise.all(query)
  for (let i = 0; i < path.length; i++) {
    {
      const { newPrice, newTimestamp } = prices[i * 4 + 0] as { newPrice: ethers.BigNumber; newTimestamp: ethers.BigNumber; }
      let p = new BigNumber(newPrice.toString()).shiftedBy(-DECIMALS)
      if (path[i].isInverse && !p.isZero()) {
        p = _1.div(p)
      }
      ret.markPrice = ret.markPrice.times(p)
      ret.markPriceTime = Math.max(ret.markPriceTime, newTimestamp.toNumber())
    }
    {
      const { newPrice, newTimestamp } = prices[i * 4 + 1] as { newPrice: ethers.BigNumber; newTimestamp: ethers.BigNumber; }
      let p = new BigNumber(newPrice.toString()).shiftedBy(-DECIMALS)
      if (path[i].isInverse && !p.isZero()) {
        p = _1.div(p)
      }
      ret.indexPrice = ret.indexPrice.times(p)
      ret.indexPriceTime = Math.max(ret.indexPriceTime, newTimestamp.toNumber())
    }
    if (prices[i * 4 + 2] as boolean) {
      ret.isMarketClosed = true
    }
    if (prices[i * 4 + 3] as boolean) {
      ret.isTerminated = true
    }
  }
  return ret
}

export async function getClaimableMiningReward(mining: LpGovernor, account: string): Promise<BigNumber> {
  const claimableMiningRewardAmount = await mining.earned(account)
  return normalizeBigNumberish(claimableMiningRewardAmount).shiftedBy(-DECIMALS)
}

