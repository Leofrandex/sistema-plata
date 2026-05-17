import type { Client, Company } from '@/lib/types'

export function getClientById(clients: Client[], id: string): Client | undefined {
  return clients.find((c) => c.id === id)
}

export function getCompanyById(companies: Company[], id: string): Company | undefined {
  return companies.find((c) => c.id === id)
}

export function getCompaniesByClient(companies: Company[], clientId: string): Company[] {
  return companies.filter((c) => c.client_id === clientId)
}

export function getCompanyByCodeLetter(
  companies: Company[],
  letter: string
): Company | undefined {
  return companies.find((c) => c.code_letter === letter.toUpperCase())
}
