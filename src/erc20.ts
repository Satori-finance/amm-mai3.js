import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import { getAddress } from '@ethersproject/address'
import { CallOverrides } from '@ethersproject/contracts'
import { Provider } from '@ethersproject/providers'
import { parseBytes32String } from '@ethersproject/strings'
import { SignerOrProvider } from './types'
import { IERC20 } from './abi/IERC20'
import { IERC20Factory } from './abi/IERC20Factory'
import { IERC20Bytes32 } from './abi/IERC20Bytes32'
import { IERC20Bytes32Factory } from './abi/IERC20Bytes32Factory'
import { normalizeBigNumberish } from './utils'

export function getERC20Contract(erc20Address: string, signerOrProvider: SignerOrProvider): IERC20 {
  getAddress(erc20Address)
  return IERC20Factory.connect(erc20Address, signerOrProvider)
}

export function getERC20Bytes32Contract(erc20Address: string, signerOrProvider: SignerOrProvider): IERC20Bytes32 {
  getAddress(erc20Address)
  return IERC20Bytes32Factory.connect(erc20Address, signerOrProvider)
}

export async function erc20Symbol(erc20Contract: IERC20): Promise<string> {
  try {
    return await erc20Contract.symbol()
  } catch (err) {
    if (err.code === 'CALL_EXCEPTION') {
      return erc20SymbolBytes32(erc20Contract.address, erc20Contract.provider)
    } else {
      throw err
    }
  }
}

export async function erc20Name(erc20Contract: IERC20): Promise<string> {
  try {
    return await erc20Contract.name()
  } catch (err) {
    if (err.code === 'CALL_EXCEPTION') {
      return erc20NameBytes32(erc20Contract.address, erc20Contract.provider)
    } else {
      throw err
    }
  }
}

export async function erc20SymbolBytes32(erc20Address: string, provider: Provider): Promise<string> {
  getAddress(erc20Address)
  const erc20Contract = getERC20Bytes32Contract(erc20Address, provider)
  const bytes32 = await erc20Contract.symbol()
  return parseBytes32String(bytes32)
}

export async function erc20NameBytes32(erc20Address: string, provider: Provider): Promise<string> {
  getAddress(erc20Address)
  const erc20Contract = getERC20Bytes32Contract(erc20Address, provider)
  const bytes32 = await erc20Contract.name()
  return parseBytes32String(bytes32)
}

export async function erc20Decimals(erc20Contract: IERC20): Promise<number> {
  const decimals = await erc20Contract.decimals()
  return decimals
}

export async function allowance(
  erc20Contract: IERC20,
  accountAddress: string,
  perpetualAddress: string,
  decimals: number
): Promise<BigNumber> {
  getAddress(accountAddress)
  getAddress(perpetualAddress)
  const allowance = await erc20Contract.allowance(accountAddress, perpetualAddress)
  return normalizeBigNumberish(allowance).shiftedBy(-decimals)
}

export async function approveToken(
  erc20Contract: IERC20,
  spenderAddress: string,
  allowance: BigNumber,
  decimals: number,
  overrides: CallOverrides = {}
): Promise<ethers.providers.TransactionResponse> {
  getAddress(spenderAddress)
  allowance = allowance.shiftedBy(decimals)
  return erc20Contract.approve(spenderAddress, allowance.toFixed(), overrides)
}

export async function balanceOf(
  erc20Contract: IERC20,
  accountAddress: string,
  decimals: number
): Promise<BigNumber> {
  getAddress(accountAddress)
  const balance = await erc20Contract.balanceOf(accountAddress)
  return normalizeBigNumberish(balance).shiftedBy(-decimals)
}

export async function totalSupply(erc20Contract: IERC20, decimals: number): Promise<BigNumber> {
  const totalSupply = await erc20Contract.totalSupply()
  return normalizeBigNumberish(totalSupply).shiftedBy(-decimals)
}
