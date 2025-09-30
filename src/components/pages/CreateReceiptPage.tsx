import { MovementForm } from '../movement/MovementForm'

export function CreateReceiptPage() {
  return (
    <MovementForm
      movementType="Receipt"
      title="Receipt"
      backPath="/receipts"
    />
  )
}