import {
  EventType,
  PublicClientApplication,
  type AuthenticationResult,
} from "@azure/msal-browser"

import { msalConfig } from "@/core/config"

export const msalInstance = new PublicClientApplication(msalConfig)

msalInstance.addEventCallback((event) => {
  if (event.eventType !== EventType.LOGIN_SUCCESS) {
    return
  }

  const account = (event.payload as AuthenticationResult | null)?.account

  if (account) {
    msalInstance.setActiveAccount(account)
  }
})

export async function initializeMsal(): Promise<void> {
  await msalInstance.initialize()

  const activeAccount = msalInstance.getActiveAccount()
  const firstAccount = msalInstance.getAllAccounts()[0]

  if (!activeAccount && firstAccount) {
    msalInstance.setActiveAccount(firstAccount)
  }
}
