import { MovementForm } from '../movement/MovementForm'

export function CreateShipmentPage() {
  return (
    <MovementForm
      movementType="Shipment"
      title="Shipment"
      backPath="/shipments"
    />
  )
}