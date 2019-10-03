export type TxType = {inputs: {txId: string, idx: number}[], outputs: [], id: string}
export const TX_SUCCESS_STATUS = 'Successful'
export const TX_PENDING_STATUS = 'Pending'
export const TX_FAILED_STATUS = 'Failed'
export const TX_STATUS = {
  TX_SUCCESS_STATUS,
  TX_PENDING_STATUS,
  TX_FAILED_STATUS,
}
