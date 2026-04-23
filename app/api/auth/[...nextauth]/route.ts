import NextAuth from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"

class TokenRefreshError extends Error {}

const handler = NextAuth({
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
      authorization: {
        params: {
          scope: "openid email read-decks write-deck"
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.accessTokenExpires = (account.expires_at ?? 0) * 1000
        token.refreshToken = account.refresh_token
      }

      const expiresAt = token.accessTokenExpires as number | undefined;
      if (!expiresAt || Date.now() < expiresAt) {
        return token
      }

      if (!token.refreshToken) {
        throw new TokenRefreshError()
      }

      try {
        const response = await fetch(
          `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.KEYCLOAK_CLIENT_ID!,
              client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
            }),
          }
        )

        const tokens = await response.json()

        if (!response.ok) {
          throw new TokenRefreshError()
        }

        token.accessToken = tokens.access_token
        token.accessTokenExpires = Date.now() + tokens.expires_in * 1000
        token.refreshToken = tokens.refresh_token ?? token.refreshToken
      } catch {
        throw new TokenRefreshError()
      }

      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    }
  }
})

export { handler as GET, handler as POST }