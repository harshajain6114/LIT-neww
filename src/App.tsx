import { useState, useEffect, useCallback } from "react";

import TelegramLoginButton from "./TelegramLoginButton";
import { mintPkp } from "./mintPkp";
import { getPkpSessionSigs } from "./getPkpSessionSigs";
import { type TelegramUser } from "./types";

type MintedPkp = {
  tokenId: string;
  publicKey: string;
  ethAddress: string;
};
type PkpSessionSigs = any;

interface EnvVariables {
  VITE_TELEGRAM_BOT_NAME: string;
  VITE_TELEGRAM_BOT_SECRET: string;
}

function App() {
  const {
    VITE_TELEGRAM_BOT_NAME = "LitDevGuidesBot",
    VITE_TELEGRAM_BOT_SECRET,
  } = import.meta.env as unknown as EnvVariables;

  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [mintedPkp, setMintedPkp] = useState<MintedPkp | null>(null);
  const [pkpSessionSigs, setPkpSessionSigs] = useState<PkpSessionSigs | null>(
    null
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (telegramUser) {
      console.log("Current telegramUser state:", telegramUser);
    }
  }, [telegramUser]);

  // Validating the Telegram user data, go here to learn more:
  // https://core.telegram.org/widgets/login#checking-authorization
  const verifyTelegramUser = useCallback(
    async (
      user: TelegramUser
    ): Promise<{ isValid: boolean; isRecent: boolean }> => {
      console.log("🔄 Validating user Telegram info client side...");
      const { hash, ...otherData } = user;

      const dataCheckString = Object.entries(otherData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

      const encoder = new TextEncoder();
      const secretKeyHash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(VITE_TELEGRAM_BOT_SECRET)
      );
      const key = await crypto.subtle.importKey(
        "raw",
        secretKeyHash,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(dataCheckString)
      );

      const calculatedHash = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const isValid = calculatedHash === user.hash;
      const isRecent = Date.now() / 1000 - user.auth_date < 600;

      console.log(
        `ℹ️ User Telegram data is valid: ${isValid}. User data is recent: ${isRecent}`
      );

      return { isValid, isRecent };
    },
    [VITE_TELEGRAM_BOT_SECRET]
  );

  const handleTelegramResponse = useCallback(
    async (user: TelegramUser) => {
      console.log("Telegram auth response received:", user);
      if (user && typeof user === "object") {
        setTelegramUser(user);

        const { isValid, isRecent } = await verifyTelegramUser(user);
        if (!isValid || !isRecent) {
          setValidationError(
            !isValid
              ? "Failed to validate Telegram user info. Please try again."
              : "Authentication has expired. Please log in again."
          );
        } else {
          setValidationError(null);
        }
      } else {
        console.error("Invalid user data received:", user);
        setValidationError("Invalid user data received. Please try again.");
      }
    },
    [verifyTelegramUser]
  );

  const handleMintPkp = async () => {
    if (telegramUser) {
      try {
        const minted = await mintPkp(telegramUser);
        setMintedPkp(minted!);
      } catch (error) {
        console.error("Failed to mint PKP:", error);
        setValidationError("Failed to mint PKP. Please try again.");
      }
    }
  };

  const handleGetPkpSessionSigs = async () => {
    if (telegramUser && mintedPkp) {
      try {
        const sessionSigs = await getPkpSessionSigs(telegramUser, mintedPkp);
        setPkpSessionSigs(sessionSigs);
      } catch (error) {
        console.error("Failed to get PKP session signatures:", error);
        setValidationError(
          "Failed to get PKP session signatures. Please try again."
        );
      }
    }
  };

  const isUserValid = telegramUser && !validationError;

  return (
    <div>
      <div className="card">
        <h3>Mint a PKP Using a Telegram Account</h3>
        <hr />
      </div>

      <div className="card">
        <h4>Step 1: Authenticate with Telegram</h4>
        {!telegramUser ? (
          <TelegramLoginButton
            botName={VITE_TELEGRAM_BOT_NAME}
            dataOnauth={handleTelegramResponse}
            buttonSize="large"
          />
        ) : (
          <div>
            <p>Authenticated as:</p>
            <pre>{JSON.stringify(telegramUser, null, 2)}</pre>
          </div>
        )}
        {validationError && (
          <div className="error-message">
            <p>{validationError}</p>
          </div>
        )}
        <hr />
      </div>

      {isUserValid && (
        <div className="card">
          <h4>Step 2: Mint PKP</h4>
          <button onClick={handleMintPkp} disabled={!!mintedPkp}>
            {mintedPkp ? "PKP Minted" : "Mint PKP"}
          </button>
          {mintedPkp && (
            <div>
              <p>Successfully minted PKP!</p>
              <p>Check the JavaScript console for PKP info</p>
            </div>
          )}
          <hr />
        </div>
      )}

      {mintedPkp && (
        <div className="card">
          <h4>Step 3: Get PKP Session Signatures</h4>
          <button onClick={handleGetPkpSessionSigs} disabled={!!pkpSessionSigs}>
            {pkpSessionSigs ? "Session Sigs Retrieved" : "Get PKP Session Sigs"}
          </button>
          {pkpSessionSigs && (
            <div>
              <p>Successfully generated Session Signatures!</p>
              <p>Check the JavaScript console for Session Sigs info</p>
            </div>
          )}
          <hr />
        </div>
      )}
    </div>
  );
}

export default App;
