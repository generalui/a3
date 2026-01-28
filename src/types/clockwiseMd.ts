export interface Address {
  address_1: string | null
  address_2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
}

export interface AppointmentResponse {
  id: number
  first_name: string
  last_name: string
  apt_time: string
  current_status: string
  confirmation_code: string
  phone_number: string
  email: string | null
  dob: string
  reason_description: string
  queue_name: string
  address: Address
  additional_patients: unknown[]
  custom_payload: Record<string, unknown>
  [key: string]: unknown
}

export interface HospitalResponse {
  id: number
  name: string
  group_id: number | null
  latitude: number
  longitude: number
  full_address: string
  phone_number: string
  time_zone: string
  todays_business_hours: string
}
