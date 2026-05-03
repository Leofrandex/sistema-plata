import type { Client } from '@/lib/types'

export function getClientById(clients: Client[], id: string): Client | undefined {
  return clients.find((c) => c.id === id)
}

export function getClientByCodeLetter(clients: Client[], letter: string): Client | undefined {
  return clients.find((c) => c.code_letter === letter.toUpperCase())
}
