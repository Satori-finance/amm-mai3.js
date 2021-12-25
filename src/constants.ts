import BigNumber from 'bignumber.js'

export const DECIMALS = 18
export const FUNDING_TIME = 28800

export const _0: BigNumber = new BigNumber('0')
export const _1: BigNumber = new BigNumber('1')
export const _2: BigNumber = new BigNumber('2')
export const _3: BigNumber = new BigNumber('3')

export const CHAIN_ID_TO_READER_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0xA097B75919F7a41221f140215A4C71fD4EFf7582',
  // s10poa
  1337: '0xBA33bA587645068F3D1d82600F3C8912F121BEAD',
  // arb testnet
  421611: '0xAaa96ce55CF6E2DEc62857Cc4d437381d1413d43',
  // arb one
  42161: '0xf7D17C801b3Df2c818AB5aA07e9108589241B8a5',
  // bsc
  56: '0x942Df696cd1995ba2eAB710D168B2D9CeE53B52c',
  // clover test
  1023: '0x0f3a50449684f9e9D28Eb8F352DdFAb32c50E0B2',
}

export const CHAIN_ID_TO_POOL_CREATOR_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0x0956a627788199bE312c9a1f2d8cBA70ec30fCb5',
  // s10poa
  1337: '0x43B368193Be128ED2e39806F1C1F8CEc860d1BF0',
  // arb testnet
  421611: '0x0A1334aCea4E38a746daC7DCf7C3E61F0AB3D834',
  // arb one
  42161: '0xA017B813652b93a0aF2887913EFCBB4ab250CE65',
  // bsc
  56: '0xfB4cD1bf5C5919A29fb894c8ddC4A69A36f5Ec87',
  // clover test
  1023: '0x6266499e608419bc0A37D5e665EbbE2BCE5EF329',
}

export const CHAIN_ID_TO_BROKER_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0xE852039e483F6E9aDbb0408a7d970d4cf5Ec879b',
  // s10poa
  1337: '0x3b07b719366F7D20881DC0F89D7Bd21cC34D65FF',
  // arb testnet
  421611: '0x637691459e757Aa6826BF32De679AcFf9955bDfA',
  // arb one
  42161: '0xf985cA33B8b787599DE77E4Ccf2d0Ecbf27d87d9',
  // bsc
  56: '0xbCCF6C081d9aa6E8B85602C04e66c5405D9be4A7',
  // clover test
  1023: '0x4f2A265c77304c68F786da5b533e1B62D30d377a',
}

export const CHAIN_ID_TO_ORACLE_ROUTER_CREATOR_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0x5374F824c4EB93e37Ee21B5CF4e762F246D82d12',
  // s10poa
  1337: '0x372d180ef40873887768eb1d29dA1ca657895CBF',
  // arb testnet
  421611: '0x9730DD5a6eb170082c7c71c2e41332853681bb92',
  // arb one
  42161: '0xC3E272F76b3740C2AcF8e5272CbEF06D70e14FF3',
  // bsc
  56: '0xa48823Ff78e0D4D73D90b0Bf4B22Bf8a6EdBbb57',
  // clover test
  1023: '0x53C1732234deee12ADAdd047eec459130Bf6bCdC',
}

export const CHAIN_ID_SYMBOL_SERVICE_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0x0A701c621210859eAbE2F47BE37456BEc2427462',
  // s10poa
  1337: '0x3567788fD2a50eeAE932DF705E976787FB39C4ce',
  // arb testnet
  421611: '0xA4109D0a36E0e66d64F3B7794C60694Ca6D66E22',
  // arb one
  42161: '0x2842c57C2736BB459BdAc97bAA22596e71f05811',
  // bsc
  56: '0x39f632208bb924f5c4c6253b042Cd056eca3710D',
  // clover test
  1023: '0xcEA944502E8092b95AF642F5d053298fb51A1790',
}

export const CHAIN_ID_INVERSE_SERVICE_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0xa72F2f8B0Dd531635f71C43fAC9C817eB4F80f9D',
  // s10poa
  1337: '0x0CeF74EDC3BA4de2C20AC8a40547a24e4d57988D',
  // arb testnet
  421611: '0xc4F97bD99f10Ca08Ce9ec9C9CB05C72F358dbC5E',
  // arb one
  42161: '0x129AD040Bd127c00d6De9051b3CfE9F3E36453D3',
  // bsc
  56: '0x7C55F0CB0DFB6E546a57FE728c8a4bf244789992',
  // clover test
  1023: '0x5232CA8857D797d66ff1924111D67947D6E02F3A',
}

export const CHAIN_ID_TO_UNISWAP_V3_ORACLE_ROUTER_CREATOR_ADDRESS: { [chainID: number]: string } = {
  // kovan
  42: '0xF67b243CF00ae7343Bd177Edf2d0EC4bAC4F47B7',
  // arb testnet
  421611: '0xAb228a61C66934f7C9091C249e47B313d6109325',
  // arb one
  42161: '0xCEda10b4d3bdE429DdA3A6daB87b38360313CBdB',
  // bsc
  56: '0x9734Bf8700C5A403CE3B96a4eC034e7CeDFdf08d',
  // clover test
  1023: '0x1DF507c4974c3D7537905C295C04EAdA6Ea20C22',
}

export const CHAIN_ID_TO_UNISWAP_V3_TOOL_ADDRESS: { [chainID: number]: string } = {
  // arb testnet
  421611: '0xB8834cD136402398AF58590799B0b6b5f94f872C',
  // arb one
  42161: '0xE2Dd46dD043aaD539d156fEEC2448547c1466A04',
  // bsc
  56: '0x2B53c970d5Fd8c1A659c417658ECDbAcC8830a77',
  // clover test
  1023: '0x21C2F99b12a9AaF42aD4D8c438699906F8338629',
}

export const CHAIN_ID_TO_TUNABLE_ORACLE_REGISTER_ADDRESS: { [chainID: number]: string } = {
  // arb testnet
  421611: '0x089543a24c2B96084319072d1BB3c15ad63092D0',
  // arb one
  42161: '0x43800D850C87d5D585D8DDF3DFB23152A826cDeB',
  // bsc
  56: '0x5f2ffBbb40c8FCd7E62f04A70ffe5A039ae25972',
}

// leave 1% when calculating withdrawal penalty if position != 0
export const REMOVE_LIQUIDITY_MAX_SHARE_RELAX = new BigNumber('0.99')
