import { getDefaultProvider } from '@ethersproject/providers'
import { getERC20Contract, erc20Symbol } from '../src/erc20'

describe('symbol', function() {
  it('USDT', async function() {
    const c = getERC20Contract('0xdac17f958d2ee523a2206206994597c13d831ec7', getDefaultProvider('mainnet'))
    expect(await erc20Symbol(c)).toBe('USDT')
  })

  it('DAI', async function() {
    const c = getERC20Contract('0x6b175474e89094c44da98b954eedeac495271d0f', getDefaultProvider('mainnet'))
    expect(await erc20Symbol(c)).toBe('DAI')
  })

  it('SAI', async function() {
    const c = getERC20Contract('0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359', getDefaultProvider('mainnet'))
    expect(await erc20Symbol(c)).toBe('DAI')
  })

  it('MKR', async function() {
    const c = getERC20Contract('0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', getDefaultProvider('mainnet'))
    expect(await erc20Symbol(c)).toBe('MKR')
  })
})
