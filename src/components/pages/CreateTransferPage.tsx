import { MovementForm } from '../movement/MovementForm'

export function CreateTransferPage() {
  return (
    <MovementForm
      movementType="Transfer"
      title="Transfer"
      backPath="/transfers"
    />
  )
}